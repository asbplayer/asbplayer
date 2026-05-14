import {
    DictionaryBuildWaniKaniCacheProgress,
    DictionaryBuildWaniKaniCacheStart,
    DictionaryBuildWaniKaniCacheState,
    DictionaryBuildWaniKaniCacheStateError as DictionaryBuildWaniKaniCacheError,
    DictionaryBuildWaniKaniCacheStateErrorCode,
    DictionaryBuildWaniKaniCacheStateType,
    DictionaryBuildWaniKaniCacheStats,
    Progress,
} from '@project/common';
import { AsbplayerSettings, dictionaryStatusCollectionEnabled, DictionaryTokenSource } from '@project/common/settings';
import { HAS_LETTER_REGEX, inBatches } from '@project/common/util';
import {
    WaniKani,
    WaniKaniApiError,
    WaniKaniAssignment,
    WaniKaniReset,
    WaniKaniSpacedRepetitionSystem,
    WaniKaniSubject,
} from '@project/common/wanikani';
import { Yomitan } from '@project/common/yomitan/yomitan';
import { v4 as uuidv4 } from 'uuid';
import {
    _DictionaryDatabase,
    BUILD_MIN_EXPIRATION_MS,
    _buildIdExpiration,
    _buildIdHealthCheck,
    _clearBuildIds,
    DictionaryMetaKey,
    _DictionaryTokenRecord,
    DictionaryWaniKaniAssignmentKey,
    DictionaryWaniKaniAssignmentRecord,
    DictionaryWaniKaniSubjectKey,
    DictionaryWaniKaniSubjectRecord,
    _ensureBuildId,
    _gatherModifiedTokensForTrack,
    _getFromSourceBulk,
    _newWaniKaniMeta,
    _saveRecordBulk,
    TrackStateForDB,
    WaniKaniDataUpdatedAt,
    WaniKaniMetaBuildChanges,
} from '@project/common/dictionary-db';

/**
 * If adding/removing fields here, add/remove the UI helperText in the settings tab.
 */
interface WaniKaniCacheSettingsDependencies {
    dictionaryYomitanUrl: string;
    dictionaryYomitanParser: string;
    dictionaryYomitanScanLength: number;
    dictionaryWaniKaniApiToken: string;
}

interface WaniKaniTrackStateForDB extends TrackStateForDB {
    assignmentsToPut: DictionaryWaniKaniAssignmentRecord[];
    subjectsToPut: DictionaryWaniKaniSubjectRecord[];
    spacedRepetitionSystems: WaniKaniSpacedRepetitionSystem[];
    numFetchedAssignments: number;
    numFetchedSubjects: number;
    affectedSubjectIds: Set<number>;
    clearTokens: boolean;
    clearResources: boolean;
    settings: string;
    dataUpdatedAt: WaniKaniDataUpdatedAt;
}

interface WaniKaniTrackStats {
    track: number;
    numFetchedAssignments?: number;
    numFetchedSubjects?: number;
    numImportedTokens?: number;
    isTokensCleared?: boolean;
}

type WaniKaniTrackStatesForDB = Map<number, WaniKaniTrackStateForDB>;
type ModifiedTokensByTrack = Map<number, Set<string>>;

function _modifiedTokensForTrack(modifiedTokensByTrack: ModifiedTokensByTrack, track: number): Set<string> {
    let modifiedTokens = modifiedTokensByTrack.get(track);
    if (!modifiedTokens) {
        modifiedTokens = new Set();
        modifiedTokensByTrack.set(track, modifiedTokens);
    }
    return modifiedTokens;
}

function _modifiedTokensArrayForTrack(modifiedTokensByTrack: ModifiedTokensByTrack, track: number): string[] {
    return Array.from(modifiedTokensByTrack.get(track) ?? []);
}

export async function buildWaniKaniCachePipeline(
    db: _DictionaryDatabase,
    profile: string,
    settings: AsbplayerSettings,
    statusUpdates: (state: DictionaryBuildWaniKaniCacheState) => void
): Promise<void> {
    const modifiedTokensByTrack: ModifiedTokensByTrack = new Map();
    const buildId = uuidv4();
    const buildTs = Date.now();
    const activeTracks: DictionaryMetaKey[] = [];
    const tracksWithStatus = new Set<number>();
    let currentTrack: number | undefined;
    let shouldClearBuildIds = true;

    try {
        const trackStates: WaniKaniTrackStatesForDB = new Map();
        const tokenlessMetaUpdates: { key: DictionaryMetaKey; changes: WaniKaniMetaBuildChanges }[] = [];
        const tracksWithClearedData = new Set<number>();
        const tracksClearedWithoutBuild = new Set<number>();

        for (const [track, dt] of settings.dictionaryTracks.entries()) {
            currentTrack = track;
            const key: DictionaryMetaKey = [profile, track];
            let prevWaniKaniMeta = _newWaniKaniMeta();
            const existingBuild = await db.transaction('rw', db.meta, async () => {
                if (await _ensureBuildId(db, key, buildId, 'waniKani', { mode: 'claim', buildTs })) {
                    prevWaniKaniMeta = (await db.meta.get(key))!.waniKaniMeta;
                    return;
                }
                return db.meta.where('[profile+track]').equals(key).first();
            });
            if (existingBuild !== undefined) {
                const expiration = _buildIdExpiration(existingBuild, 'waniKani');
                console.error(`Build already in progress - expires at ${expiration}`);
                statusUpdates({
                    type: DictionaryBuildWaniKaniCacheStateType.error,
                    body: {
                        code: DictionaryBuildWaniKaniCacheStateErrorCode.concurrentBuild,
                        track,
                        modifiedTokens: _modifiedTokensArrayForTrack(modifiedTokensByTrack, track),
                        data: { expiration },
                    } as DictionaryBuildWaniKaniCacheError,
                });
                return; // Since we set the buildId for all tracks regardless of enabled status, concurrent builds are prevented
            }
            activeTracks.push(key);
            if (!dictionaryStatusCollectionEnabled(dt)) continue; // Keep cache but don't update it TODO: Clear tracks that have been disabled for a while from db?
            tracksWithStatus.add(track);

            statusUpdates({
                type: DictionaryBuildWaniKaniCacheStateType.start,
                body: { buildTimestamp: buildTs, track } as DictionaryBuildWaniKaniCacheStart,
            });

            const currSettings: WaniKaniCacheSettingsDependencies = {
                dictionaryYomitanUrl: dt.dictionaryYomitanUrl,
                dictionaryYomitanParser: dt.dictionaryYomitanParser,
                dictionaryYomitanScanLength: dt.dictionaryYomitanScanLength,
                dictionaryWaniKaniApiToken: dt.dictionaryWaniKaniApiToken.trim(),
            };
            if (!currSettings.dictionaryWaniKaniApiToken) {
                tracksWithClearedData.add(track);
                tracksClearedWithoutBuild.add(track);
                tokenlessMetaUpdates.push({
                    key,
                    changes: { settings: null, dataUpdatedAt: {}, spacedRepetitionSystems: [] },
                });
                continue;
            }

            const yomitan = new Yomitan(dt);
            try {
                await yomitan.version();
            } catch (e) {
                console.error(e);
                statusUpdates({
                    type: DictionaryBuildWaniKaniCacheStateType.error,
                    body: {
                        code: DictionaryBuildWaniKaniCacheStateErrorCode.noYomitan,
                        msg: e instanceof Error ? e.message : String(e),
                        track,
                        modifiedTokens: _modifiedTokensArrayForTrack(modifiedTokensByTrack, track),
                    } as DictionaryBuildWaniKaniCacheError,
                });
                return;
            }

            const waniKani = new WaniKani(currSettings.dictionaryWaniKaniApiToken);
            try {
                const currSettingsStr = JSON.stringify(currSettings);
                const settingsChanged = currSettingsStr !== prevWaniKaniMeta.settings;
                let dataUpdatedAt: WaniKaniDataUpdatedAt = settingsChanged ? {} : { ...prevWaniKaniMeta.dataUpdatedAt };
                let clearTokens = settingsChanged;
                let clearResources = settingsChanged;

                const resetResponse = await waniKani.resets({ updatedAfter: dataUpdatedAt.resets });
                if (_hasConfirmedWaniKaniReset(resetResponse.data)) {
                    dataUpdatedAt = {
                        ...dataUpdatedAt,
                        assignments: undefined,
                        subjects: undefined,
                        spacedRepetitionSystems: undefined,
                    };
                    clearTokens = true;
                    clearResources = true;
                }
                dataUpdatedAt = {
                    ...dataUpdatedAt,
                    resets: resetResponse.dataUpdatedAt ?? dataUpdatedAt.resets,
                };

                const spacedRepetitionSystemsResponse = await waniKani.spacedRepetitionSystems({
                    updatedAfter: dataUpdatedAt.spacedRepetitionSystems,
                });
                const spacedRepetitionSystems = _mergeWaniKaniSpaceRepetitionSystems(
                    clearResources ? [] : prevWaniKaniMeta.spacedRepetitionSystems,
                    spacedRepetitionSystemsResponse.data
                );
                const spacedRepetitionSystemsChanged = spacedRepetitionSystemsResponse.data.length > 0;
                dataUpdatedAt = {
                    ...dataUpdatedAt,
                    spacedRepetitionSystems:
                        spacedRepetitionSystemsResponse.dataUpdatedAt ?? dataUpdatedAt.spacedRepetitionSystems,
                };

                const existingSubjectIds = clearResources
                    ? new Set<number>()
                    : await _getWaniKaniSubjectIdsForTrack(db, profile, track);
                const [hasAssignmentCache, hasSubjectCache] = clearResources
                    ? [false, false]
                    : await Promise.all([
                          db.waniKaniAssignments.where('[profile+track]').equals([profile, track]).count(),
                          db.waniKaniSubjects.where('[profile+track]').equals([profile, track]).count(),
                      ]).then(([assignmentCount, subjectCount]) => [assignmentCount > 0, subjectCount > 0]);

                const assignmentsResponse = await waniKani.assignments({
                    subjectTypes: ['vocabulary', 'kana_vocabulary'],
                    updatedAfter: hasAssignmentCache ? dataUpdatedAt.assignments : undefined,
                });
                const subjectsResponse = await waniKani.subjects({
                    types: ['vocabulary', 'kana_vocabulary'],
                    updatedAfter: hasSubjectCache ? dataUpdatedAt.subjects : undefined,
                });

                const responseSubjectIds = new Set([
                    ...assignmentsResponse.data.map((assignment) => assignment.data.subject_id),
                    ...subjectsResponse.data.map((subject) => subject.id),
                ]);
                const affectedSubjectIds =
                    clearTokens || spacedRepetitionSystemsChanged
                        ? new Set([...existingSubjectIds, ...responseSubjectIds])
                        : new Set([
                              ...assignmentsResponse.data.map((assignment) => assignment.data.subject_id),
                              ...subjectsResponse.data.map((subject) => subject.id),
                          ]);
                dataUpdatedAt = {
                    ...dataUpdatedAt,
                    assignments: assignmentsResponse.dataUpdatedAt ?? dataUpdatedAt.assignments,
                    subjects: subjectsResponse.dataUpdatedAt ?? dataUpdatedAt.subjects,
                };

                trackStates.set(track, {
                    dt,
                    yomitan,
                    assignmentsToPut: assignmentsResponse.data.map((assignment) =>
                        _waniKaniAssignmentRecord(profile, track, assignment)
                    ),
                    subjectsToPut: subjectsResponse.data.map((subject) =>
                        _waniKaniSubjectRecord(profile, track, subject)
                    ),
                    spacedRepetitionSystems,
                    numFetchedAssignments: assignmentsResponse.data.length,
                    numFetchedSubjects: subjectsResponse.data.length,
                    affectedSubjectIds,
                    clearTokens,
                    clearResources,
                    settings: currSettingsStr,
                    dataUpdatedAt,
                });
                if (clearTokens || clearResources) tracksWithClearedData.add(track);
            } catch (e) {
                console.error(e);
                statusUpdates({
                    type: DictionaryBuildWaniKaniCacheStateType.error,
                    body: {
                        code:
                            e instanceof WaniKaniApiError && e.status === 401
                                ? DictionaryBuildWaniKaniCacheStateErrorCode.invalidWaniKaniToken
                                : DictionaryBuildWaniKaniCacheStateErrorCode.failedToBuild,
                        msg: e instanceof Error ? e.message : String(e),
                        track,
                        modifiedTokens: _modifiedTokensArrayForTrack(modifiedTokensByTrack, track),
                    } as DictionaryBuildWaniKaniCacheError,
                });
                return;
            }
        }

        const trackStats: WaniKaniTrackStats[] = [];
        for (const [track, ts] of trackStates.entries()) {
            trackStats.push({
                track,
                numFetchedAssignments: ts.numFetchedAssignments,
                numFetchedSubjects: ts.numFetchedSubjects,
                isTokensCleared: tracksWithClearedData.has(track),
            });
        }
        for (const track of tracksClearedWithoutBuild) {
            if (!trackStates.has(track)) trackStats.push({ track, isTokensCleared: true });
        }
        _sortWaniKaniTrackStats(trackStats);

        if (trackStates.size || tracksClearedWithoutBuild.size || tokenlessMetaUpdates.length) {
            const tracksWithTokensToClear = new Set([
                ...tracksClearedWithoutBuild,
                ...Array.from(trackStates.entries())
                    .filter(([, ts]) => ts.clearTokens)
                    .map(([track]) => track),
            ]);
            const tracksWithResourcesToClear = new Set([
                ...tracksClearedWithoutBuild,
                ...Array.from(trackStates.entries())
                    .filter(([, ts]) => ts.clearResources)
                    .map(([track]) => track),
            ]);
            await db.transaction('rw', db.meta, db.tokens, db.waniKaniSubjects, db.waniKaniAssignments, async () => {
                await _buildIdHealthCheck(db, buildId, 'waniKani', activeTracks);
                await _deleteWaniKaniTokensForTracks(db, profile, tracksWithTokensToClear, modifiedTokensByTrack);
                await _deleteWaniKaniResourcesForTracks(db, profile, tracksWithResourcesToClear);
                for (const { key, changes } of tokenlessMetaUpdates) {
                    const trackMeta = await db.meta.get(key);
                    if (!trackMeta) continue;
                    await db.meta.update(key, {
                        waniKaniMeta: {
                            ...trackMeta.waniKaniMeta,
                            ...changes,
                        },
                    });
                }
                for (const [track, ts] of trackStates.entries()) {
                    if (ts.subjectsToPut.length) await db.waniKaniSubjects.bulkPut(ts.subjectsToPut);
                    if (ts.assignmentsToPut.length) {
                        await db.waniKaniAssignments.bulkPut(ts.assignmentsToPut);
                    }
                    const key: DictionaryMetaKey = [profile, track];
                    const trackMeta = await db.meta.get(key);
                    if (!trackMeta) continue;
                    await db.meta.update(key, {
                        waniKaniMeta: {
                            ...trackMeta.waniKaniMeta,
                            spacedRepetitionSystems: ts.spacedRepetitionSystems,
                        },
                    });
                }
                for (const [track, modifiedTokens] of modifiedTokensByTrack.entries()) {
                    await _gatherModifiedTokensForTrack(db, profile, track, modifiedTokens);
                }
            });
            if (!trackStates.size) {
                _publishWaniKaniTrackStats(statusUpdates, buildTs, trackStats, modifiedTokensByTrack);
                return;
            }
        } else if (!trackStates.size) {
            return;
        }

        void _processWaniKaniTracks(
            db,
            profile,
            buildId,
            trackStates,
            trackStats,
            modifiedTokensByTrack,
            activeTracks,
            buildTs,
            statusUpdates
        );
        shouldClearBuildIds = false;

        _publishWaniKaniTrackStats(statusUpdates, buildTs, trackStats);
    } catch (e) {
        console.error(e);
        const errorTracks = tracksWithStatus.size ? tracksWithStatus : currentTrack === undefined ? [] : [currentTrack];
        _publishWaniKaniTrackErrors(statusUpdates, errorTracks, e, modifiedTokensByTrack);
    } finally {
        if (shouldClearBuildIds) await _clearBuildIds(db, activeTracks, buildId, 'waniKani');
    }
}

async function _deleteWaniKaniTokensForTracks(
    db: _DictionaryDatabase,
    profile: string,
    tracks: Iterable<number>,
    modifiedTokensByTrack: ModifiedTokensByTrack
): Promise<void> {
    const trackSet = new Set(tracks);
    if (!trackSet.size) return;
    const existingRecords = await db.tokens
        .where('profile')
        .equals(profile)
        .filter((record) => record.source === DictionaryTokenSource.WANIKANI && trackSet.has(record.track))
        .toArray();
    for (const record of existingRecords) {
        const modifiedTokens = _modifiedTokensForTrack(modifiedTokensByTrack, record.track);
        modifiedTokens.add(record.token);
        for (const lemma of record.lemmas) modifiedTokens.add(lemma);
    }
    await db.tokens.bulkDelete(
        existingRecords.map((record) => [record.token, record.source, record.track, record.profile])
    );
}

async function _deleteWaniKaniResourcesForTracks(
    db: _DictionaryDatabase,
    profile: string,
    tracks: Iterable<number>
): Promise<void> {
    const trackSet = new Set(tracks);
    if (!trackSet.size) return;
    const subjectKeys: DictionaryWaniKaniSubjectKey[] = [];
    const assignmentKeys: DictionaryWaniKaniAssignmentKey[] = [];
    for (const track of trackSet) {
        subjectKeys.push(
            ...(await db.waniKaniSubjects.where('[profile+track]').equals([profile, track]).primaryKeys())
        );
        assignmentKeys.push(
            ...(await db.waniKaniAssignments.where('[profile+track]').equals([profile, track]).primaryKeys())
        );
    }
    await Promise.all([db.waniKaniSubjects.bulkDelete(subjectKeys), db.waniKaniAssignments.bulkDelete(assignmentKeys)]);
}

async function _getWaniKaniSubjectIdsForTrack(
    db: _DictionaryDatabase,
    profile: string,
    track: number
): Promise<Set<number>> {
    const [subjects, assignments] = await Promise.all([
        db.waniKaniSubjects.where('[profile+track]').equals([profile, track]).toArray(),
        db.waniKaniAssignments.where('[profile+track]').equals([profile, track]).toArray(),
    ]);
    return new Set([...subjects.map((subject) => subject.subjectId), ...assignments.map((a) => a.subjectId)]);
}

function _mergeWaniKaniSpaceRepetitionSystems(
    existing: WaniKaniSpacedRepetitionSystem[],
    updated: WaniKaniSpacedRepetitionSystem[]
): WaniKaniSpacedRepetitionSystem[] {
    const systemsById = new Map(existing.map((system) => [system.id, system]));
    for (const system of updated) systemsById.set(system.id, system);
    return Array.from(systemsById.values()).sort((lhs, rhs) => lhs.id - rhs.id);
}

function _hasConfirmedWaniKaniReset(resets: WaniKaniReset[]): boolean {
    return resets.some((reset) => reset.data.confirmed_at !== null);
}

function _waniKaniAssignmentRecord(
    profile: string,
    track: number,
    assignment: WaniKaniAssignment
): DictionaryWaniKaniAssignmentRecord {
    return {
        profile,
        track,
        assignmentId: assignment.id,
        subjectId: assignment.data.subject_id,
        data: {
            srs_stage: assignment.data.srs_stage,
            hidden: assignment.data.hidden,
        },
    };
}

function _waniKaniSubjectRecord(
    profile: string,
    track: number,
    subject: WaniKaniSubject
): DictionaryWaniKaniSubjectRecord {
    return {
        profile,
        track,
        subjectId: subject.id,
        data: {
            characters: subject.data.characters,
            hidden_at: subject.data.hidden_at,
            spaced_repetition_system_id: subject.data.spaced_repetition_system_id,
        },
    };
}

function _sortWaniKaniTrackStats(trackStats: WaniKaniTrackStats[]): void {
    trackStats.sort((lhs, rhs) => lhs.track - rhs.track);
}

function _publishWaniKaniTrackStats(
    statusUpdates: (state: DictionaryBuildWaniKaniCacheState) => void,
    buildTs: number,
    trackStats: WaniKaniTrackStats[],
    modifiedTokensByTrack?: ModifiedTokensByTrack
): void {
    for (const stats of trackStats) {
        statusUpdates({
            type: DictionaryBuildWaniKaniCacheStateType.stats,
            body: {
                buildTimestamp: buildTs,
                track: stats.track,
                isTokensCleared: stats.isTokensCleared,
                numFetchedAssignments: stats.numFetchedAssignments,
                numFetchedSubjects: stats.numFetchedSubjects,
                numImportedTokens: stats.numImportedTokens,
                modifiedTokens: modifiedTokensByTrack
                    ? _modifiedTokensArrayForTrack(modifiedTokensByTrack, stats.track)
                    : undefined,
            } as DictionaryBuildWaniKaniCacheStats,
        });
    }
}

function _publishWaniKaniTrackErrors(
    statusUpdates: (state: DictionaryBuildWaniKaniCacheState) => void,
    tracks: Iterable<number>,
    error: unknown,
    modifiedTokensByTrack: ModifiedTokensByTrack
): void {
    const msg = error instanceof Error ? error.message : String(error);
    for (const track of Array.from(new Set(tracks)).sort((lhs, rhs) => lhs - rhs)) {
        statusUpdates({
            type: DictionaryBuildWaniKaniCacheStateType.error,
            body: {
                track,
                msg,
                code: DictionaryBuildWaniKaniCacheStateErrorCode.failedToBuild,
                modifiedTokens: _modifiedTokensArrayForTrack(modifiedTokensByTrack, track),
            } as DictionaryBuildWaniKaniCacheError,
        });
    }
}

async function _processWaniKaniTracks(
    db: _DictionaryDatabase,
    profile: string,
    buildId: string,
    trackStates: WaniKaniTrackStatesForDB,
    trackStats: WaniKaniTrackStats[],
    modifiedTokensByTrack: ModifiedTokensByTrack,
    activeTracks: DictionaryMetaKey[],
    buildTs: number,
    statusUpdates: (state: DictionaryBuildWaniKaniCacheState) => void
): Promise<void> {
    let error: any;
    let errorTracks: number[] = [];

    try {
        for (const [track, ts] of trackStates.entries()) {
            const progress: Progress = {
                current: 0,
                total: ts.affectedSubjectIds.size,
                startedAt: Date.now(),
            };
            let importedTokens: Set<string>;
            try {
                importedTokens = await _buildWaniKaniTokensForTrack(
                    db,
                    profile,
                    track,
                    ts,
                    buildId,
                    activeTracks,
                    progress,
                    _modifiedTokensForTrack(modifiedTokensByTrack, track),
                    statusUpdates
                );
            } catch (e) {
                errorTracks = [track];
                throw e;
            }
            const stats = trackStats.find((stats) => stats.track === track);
            if (stats) stats.numImportedTokens = importedTokens.size;
        }

        await _saveWaniKaniTrackMetadataForDB(db, profile, buildId, activeTracks, trackStates);
    } catch (e) {
        error = e;
        console.error(e);
    } finally {
        await _clearBuildIds(db, activeTracks, buildId, 'waniKani');
        if (error) {
            if (!errorTracks.length) errorTracks = Array.from(trackStates.keys());
            _publishWaniKaniTrackErrors(statusUpdates, errorTracks, error, modifiedTokensByTrack);
        } else {
            _publishWaniKaniTrackStats(statusUpdates, buildTs, trackStats, modifiedTokensByTrack);
        }
    }
}

async function _buildWaniKaniTokensForTrack(
    db: _DictionaryDatabase,
    profile: string,
    track: number,
    ts: WaniKaniTrackStateForDB,
    buildId: string,
    activeTracks: DictionaryMetaKey[],
    progress: Progress,
    modifiedTokens: Set<string>,
    statusUpdates: (state: DictionaryBuildWaniKaniCacheState) => void
): Promise<Set<string>> {
    const affectedSubjectIds = Array.from(ts.affectedSubjectIds);
    const importedTokens = new Set<string>();
    if (!affectedSubjectIds.length) return importedTokens;

    const subjects = await db.waniKaniSubjects
        .where('[subjectId+track+profile]')
        .anyOf(affectedSubjectIds.map((subjectId) => [subjectId, track, profile]))
        .toArray();
    const subjectById = new Map(subjects.map((subject) => [subject.subjectId, subject]));

    await inBatches(
        affectedSubjectIds,
        async (batch) => {
            const batchSubjectIds = new Set(batch);
            const existingRecords = await db.tokens
                .where('subjectIds')
                .anyOf(batch)
                .distinct()
                .filter(
                    (record) =>
                        record.profile === profile &&
                        record.track === track &&
                        record.source === DictionaryTokenSource.WANIKANI
                )
                .toArray();
            const newSubjectIdsByToken = new Map<string, Set<number>>();
            const subjectsToTokenize: { subjectId: number; characters: string }[] = [];
            for (const subjectId of batch) {
                const subject = subjectById.get(subjectId);
                const characters = subject?.data.characters?.trim();
                if (subject?.data.hidden_at || !characters || !HAS_LETTER_REGEX.test(characters)) continue;

                subjectsToTokenize.push({ subjectId, characters });
            }

            if (subjectsToTokenize.length) {
                await ts.yomitan.tokenizeBulk(subjectsToTokenize.map((subject) => subject.characters));
            }
            for (const { subjectId, characters } of subjectsToTokenize) {
                const tokens = new Set<string>();
                for (const tokenParts of await ts.yomitan.tokenize(characters)) {
                    const token = tokenParts
                        .map((part) => part.text)
                        .join('')
                        .trim();
                    if (!token || !HAS_LETTER_REGEX.test(token)) continue;
                    tokens.add(token);
                }

                for (const token of tokens) {
                    const subjectIds = newSubjectIdsByToken.get(token);
                    if (subjectIds) subjectIds.add(subjectId);
                    else newSubjectIdsByToken.set(token, new Set([subjectId]));
                }
            }

            const affectedTokens = new Set([
                ...existingRecords.map((record) => record.token),
                ...newSubjectIdsByToken.keys(),
            ]);
            const existingRecordByToken = await _getFromSourceBulk(
                db,
                profile,
                track,
                DictionaryTokenSource.WANIKANI,
                Array.from(affectedTokens)
            );
            const records: _DictionaryTokenRecord[] = [];
            for (const token of affectedTokens) {
                const existingRecord = existingRecordByToken.get(token);
                const subjectIds = new Set(
                    existingRecord?.subjectIds.filter((subjectId) => !batchSubjectIds.has(subjectId)) ?? []
                );
                for (const subjectId of newSubjectIdsByToken.get(token) ?? []) subjectIds.add(subjectId);
                if (!subjectIds.size) {
                    importedTokens.delete(token);
                    continue;
                }

                const lemmas =
                    (await ts.yomitan.lemmatize(token))?.filter((lemma) => HAS_LETTER_REGEX.test(lemma)) ?? [];
                if (!lemmas.length) {
                    importedTokens.delete(token);
                    continue;
                }

                importedTokens.add(token);
                records.push({
                    profile,
                    track,
                    source: DictionaryTokenSource.WANIKANI,
                    token,
                    status: null,
                    lemmas,
                    states: existingRecord?.states ?? [],
                    cardIds: [],
                    subjectIds: Array.from(subjectIds).sort((lhs, rhs) => lhs - rhs),
                });
            }

            const batchModifiedTokens = new Set<string>();
            if (existingRecords.length || records.length) {
                await _saveWaniKaniTokenBatchForDB(
                    db,
                    profile,
                    track,
                    existingRecords,
                    records,
                    buildId,
                    activeTracks,
                    batchModifiedTokens
                );
                for (const token of batchModifiedTokens) modifiedTokens.add(token);
            }

            progress.current += batch.length;
            await _updateBuildWaniKaniCacheProgress(
                db,
                buildId,
                activeTracks,
                track,
                progress,
                Array.from(batchModifiedTokens),
                statusUpdates
            );
            ts.yomitan.resetCache();
        },
        { batchSize: 100 }
    );

    return importedTokens;
}

/**
 * There are five scenarios where WaniKani tokens need to be deleted:
 * 1. The WaniKani-dependent settings changed (handled by clearTokens)
 * 2. A confirmed WaniKani reset was detected (handled by clearTokens/clearResources)
 * 3. An assignment was hidden or moved to a token-ineligible state (handled by affectedSubjectIds)
 * 4. A subject was hidden or its characters no longer tokenize the same way (handled by affectedSubjectIds)
 * 5. Based on track settings such as no WaniKani token (handled by tracksClearedWithoutBuild)
 */
async function _saveWaniKaniTokenBatchForDB(
    db: _DictionaryDatabase,
    profile: string,
    track: number,
    existingRecords: _DictionaryTokenRecord[],
    records: _DictionaryTokenRecord[],
    buildId: string,
    activeTracks: DictionaryMetaKey[],
    modifiedTokens: Set<string>
): Promise<void> {
    for (const record of existingRecords) {
        modifiedTokens.add(record.token);
        for (const lemma of record.lemmas) modifiedTokens.add(lemma);
    }
    for (const record of records) {
        modifiedTokens.add(record.token);
        for (const lemma of record.lemmas) modifiedTokens.add(lemma);
    }

    await db.transaction('rw', db.tokens, db.meta, async () => {
        await _buildIdHealthCheck(db, buildId, 'waniKani', activeTracks);
        if (existingRecords.length) {
            await db.tokens.bulkDelete(
                existingRecords.map((record) => [record.token, record.source, record.track, record.profile])
            );
        }
        await _saveRecordBulk(db, records);
        await _gatherModifiedTokensForTrack(db, profile, track, modifiedTokens);
    });
}

async function _saveWaniKaniTrackMetadataForDB(
    db: _DictionaryDatabase,
    profile: string,
    buildId: string,
    activeTracks: DictionaryMetaKey[],
    trackStates: WaniKaniTrackStatesForDB
): Promise<void> {
    await db.transaction('rw', db.meta, async () => {
        await _buildIdHealthCheck(db, buildId, 'waniKani', activeTracks);
        for (const [track, ts] of trackStates.entries()) {
            const key: DictionaryMetaKey = [profile, track];
            const trackMeta = await db.meta.get(key);
            if (!trackMeta) continue;
            await db.meta.update(key, {
                waniKaniMeta: {
                    ...trackMeta.waniKaniMeta,
                    settings: ts.settings,
                    dataUpdatedAt: ts.dataUpdatedAt,
                },
            });
        }
    });
}

async function _updateBuildWaniKaniCacheProgress(
    db: _DictionaryDatabase,
    buildId: string,
    activeTracks: DictionaryMetaKey[],
    track: number,
    progress: Progress,
    modifiedTokens: string[],
    statusUpdates: (state: DictionaryBuildWaniKaniCacheState) => void
): Promise<void> {
    const rate = progress.current / (Date.now() - progress.startedAt);
    const eta = rate ? Math.ceil((progress.total - progress.current) / rate) : 0;
    await db.transaction('rw', db.meta, async () => {
        await _buildIdHealthCheck(db, buildId, 'waniKani', activeTracks);
        const lastBuildExpiresAt = Date.now() + Math.max(eta, BUILD_MIN_EXPIRATION_MS);
        for (const key of activeTracks) {
            const trackMeta = await db.meta.get(key);
            if (!trackMeta) continue;
            await db.meta.update(key, {
                waniKaniMeta: {
                    ...trackMeta.waniKaniMeta,
                    lastBuildExpiresAt,
                },
            });
        }
    });
    statusUpdates({
        type: DictionaryBuildWaniKaniCacheStateType.progress,
        body: {
            track,
            current: progress.current,
            total: progress.total,
            buildTimestamp: progress.startedAt,
            modifiedTokens,
        } as DictionaryBuildWaniKaniCacheProgress,
    });
}
