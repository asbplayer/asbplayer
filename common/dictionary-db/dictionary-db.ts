import { DictionaryBuildAnkiCacheState, DictionaryBuildWaniKaniCacheState } from '@project/common';
import {
    ApplyStrategy,
    AsbplayerSettings,
    DictionaryTokenSource,
    DictionaryTrack,
    getFullyKnownTokenStatus,
    SettingsProvider,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import { getTokenStatus, HAS_LETTER_REGEX } from '@project/common/util';
import { WaniKaniAssignment, WaniKaniSpacedRepetitionSystem, WaniKaniSubject } from '@project/common/wanikani';
import { Yomitan } from '@project/common/yomitan/yomitan';
import Dexie from 'dexie';
import { buildAnkiCachePipeline } from '@project/common/dictionary-db';
import { buildWaniKaniCachePipeline } from '@project/common/dictionary-db';

/**
 * This file only contains the public interface functions and types.
 * Functions/types with a leading underscore are considered private to the db and its pipelines/helper functions, even if exported.
 */

export const BUILD_MIN_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * This gives a better user experience so they are free to switch between tracks long term
 * without any headaches. If in the future per track local tokens are desired as a new option,
 * then -1 would simply become the fallback and represent trackless tokens.
 */
export const LOCAL_TOKEN_TRACK = -1; // null cannot be used in Dexie indexes

export interface WaniKaniDataUpdatedAt {
    assignments?: string;
    subjects?: string;
    resets?: string;
    spacedRepetitionSystems?: string;
}

export interface AnkiMeta {
    lastBuildStartedAt: number;
    lastBuildExpiresAt: number;
    buildId: string | null;
    settings: string | null;
}

export interface WaniKaniMeta {
    lastBuildStartedAt: number;
    lastBuildExpiresAt: number;
    buildId: string | null;
    settings: string | null;
    dataUpdatedAt: WaniKaniDataUpdatedAt;
    spacedRepetitionSystems: WaniKaniSpacedRepetitionSystem[];
}

type AnkiMetaBuildChanges = Partial<AnkiMeta>;
export type WaniKaniMetaBuildChanges = Partial<WaniKaniMeta>;

export type DictionaryMetaKey = [string, number];
export type DictionaryBuildIdSlot = 'anki' | 'waniKani';
export interface DictionaryMetaRecord {
    profile: string;
    track: number;
    ankiMeta: AnkiMeta;
    waniKaniMeta: WaniKaniMeta;
}

export type DictionaryTokenKey = [string, DictionaryTokenSource, number, string];
export interface DictionaryTokenRecord {
    profile: string;
    track: number;
    source: DictionaryTokenSource;
    token: string;
    status: TokenStatus | null;
    lemmas: string[];
    states: TokenState[];
    cardIds: number[];
    subjectIds?: number[]; // Guaranteed to exist by db, only here to enforce type safety for the App communicating with an outdated extension
}
export interface _DictionaryTokenRecord extends DictionaryTokenRecord {
    subjectIds: number[]; // Match DB invariant with type system, only for use within DictionaryDB and its pipelines
}
export interface DictionaryLocalTokenInput {
    token: string;
    status: TokenStatus | null;
    lemmas: string[];
    states: TokenState[];
}

export type DictionaryAnkiCardKey = [number, number, string];
export interface DictionaryAnkiCardRecord {
    profile: string;
    track: number;
    cardId: number;
    noteId: number;
    modifiedAt: number;
    status: TokenStatus;
    suspended: boolean;
}

export type WaniKaniAssignmentDataForDB = Pick<WaniKaniAssignment['data'], 'srs_stage' | 'hidden'>;

export type WaniKaniSubjectDataForDB = Pick<
    WaniKaniSubject['data'],
    'characters' | 'hidden_at' | 'spaced_repetition_system_id'
>;

export type DictionaryWaniKaniSubjectKey = [number, number, string];
export interface DictionaryWaniKaniSubjectRecord {
    profile: string;
    track: number;
    subjectId: number;
    data: WaniKaniSubjectDataForDB;
}

export type DictionaryWaniKaniAssignmentKey = [number, number, string];
export interface DictionaryWaniKaniAssignmentRecord {
    profile: string;
    track: number;
    assignmentId: number;
    subjectId: number;
    data: WaniKaniAssignmentDataForDB;
}

export type _DictionaryDatabase = DictionaryDatabase;
class DictionaryDatabase extends Dexie {
    meta!: Dexie.Table<DictionaryMetaRecord, DictionaryMetaKey>;
    tokens!: Dexie.Table<_DictionaryTokenRecord, DictionaryTokenKey>;
    ankiCards!: Dexie.Table<DictionaryAnkiCardRecord, DictionaryAnkiCardKey>;
    waniKaniSubjects!: Dexie.Table<DictionaryWaniKaniSubjectRecord, DictionaryWaniKaniSubjectKey>;
    waniKaniAssignments!: Dexie.Table<DictionaryWaniKaniAssignmentRecord, DictionaryWaniKaniAssignmentKey>;

    constructor() {
        super('DictionaryDatabase');
        this.version(1).stores({
            meta: '[profile+track]',
            tokens: '[token+source+track+profile],[profile+token],*lemmas,*cardIds',
            ankiCards: '[cardId+track+profile],[profile+noteId]',
        });
        this.version(2)
            .stores({
                tokens: '[token+source+track+profile],[profile+token],*lemmas,*cardIds,*subjectIds',
                waniKaniSubjects: '[subjectId+track+profile],[profile+track]',
                waniKaniAssignments: '[assignmentId+track+profile],[subjectId+track+profile],[profile+track]',
            })
            .upgrade((tx) => {
                return Promise.all([
                    tx
                        .table('tokens')
                        .toCollection()
                        .modify((token) => {
                            if (!Array.isArray(token.subjectIds)) token.subjectIds = [];
                        }),
                    tx
                        .table('meta')
                        .toCollection()
                        .modify((meta) => {
                            meta.ankiMeta = {
                                lastBuildStartedAt: meta.lastBuildStartedAt ?? 0,
                                lastBuildExpiresAt: meta.lastBuildExpiresAt ?? 0,
                                buildId: meta.buildId ?? null,
                                settings: meta.settings ?? null,
                            };
                            meta.waniKaniMeta = {
                                lastBuildStartedAt: 0,
                                lastBuildExpiresAt: 0,
                                buildId: null,
                                settings: null,
                                dataUpdatedAt: {},
                                spacedRepetitionSystems: [],
                            };
                            delete meta.lastBuildStartedAt;
                            delete meta.lastBuildExpiresAt;
                            delete meta.buildId;
                            delete meta.settings;
                        }),
                ]);
            });
    }
}

export interface TrackStateForDB {
    dt: DictionaryTrack;
    yomitan: Yomitan;
}

export interface TokenStatusInfo {
    cardId?: number;
    subjectId?: number;
    assignmentId?: number;
    status: TokenStatus;
    suspended: boolean;
}

export interface TokenResults {
    [token: string]: {
        source: DictionaryTokenSource;
        statuses: TokenStatusInfo[];
        externalCandidateStatuses?: TokenStatusInfo[]; // Necessary to allow all ids for stats lookup since pick the best external word source
        states: TokenState[];
    };
}

export interface LemmaResults {
    [lemma: string]: {
        token: string;
        source: DictionaryTokenSource;
        statuses: TokenStatusInfo[];
        externalCandidateStatuses?: TokenStatusInfo[]; // Necessary to allow all ids for stats lookup since pick the best external word source
        states: TokenState[];
    }[];
}

export interface DictionarySaveRecordLocalResult {
    savedTokens: DictionaryTokenKey[];
    deletedTokens: DictionaryTokenKey[];
}

export interface DictionaryImportRecordLocalResult {
    importedTokens: DictionaryTokenKey[];
}

export interface DictionaryExportRecordLocalResult {
    exportedRecords: Partial<DictionaryTokenRecord>[];
}

export interface DictionaryDeleteRecordLocalResult {
    deletedTokens: DictionaryTokenKey[];
}

export interface DictionaryDeleteProfileResult {
    deletedMetas: DictionaryMetaKey[];
    deletedTokens: DictionaryTokenKey[];
    deletedAnkiCards: DictionaryAnkiCardKey[];
    deletedWaniKaniSubjects: DictionaryWaniKaniSubjectKey[];
    deletedWaniKaniAssignments: DictionaryWaniKaniAssignmentKey[];
}

export type DictionaryAnkiCardRecordsByTrack = Record<number, Record<number, DictionaryAnkiCardRecord>>;
export type DictionaryWaniKaniSubjectRecordsByTrack = Record<number, Record<number, DictionaryWaniKaniSubjectRecord>>;
export interface DictionaryWaniKaniAssignmentRecordWithStatus extends DictionaryWaniKaniAssignmentRecord {
    status: TokenStatus;
}
export type DictionaryWaniKaniAssignmentRecordsByTrack = Record<
    number,
    Record<number, DictionaryWaniKaniAssignmentRecordWithStatus>
>;

export interface DictionaryRecordsResult {
    tokenRecords: DictionaryTokenRecord[];
    ankiCardRecords: DictionaryAnkiCardRecordsByTrack;
    waniKaniSubjectRecords?: DictionaryWaniKaniSubjectRecordsByTrack;
    waniKaniAssignmentRecords?: DictionaryWaniKaniAssignmentRecordsByTrack;
}

export interface DictionaryRecordUpdateInput {
    tokenKey: DictionaryTokenKey;
    status: TokenStatus;
    states: TokenState[];
}

export interface DictionaryRecordUpdateResult {
    savedTokens: DictionaryTokenKey[];
    deletedTokens: DictionaryTokenKey[];
}

export interface DictionaryRecordDeleteResult {
    deletedTokens: DictionaryTokenKey[];
}

export class DictionaryDB {
    private readonly db: DictionaryDatabase;
    private readonly settingsProvider: SettingsProvider;

    constructor(settingsProvider: SettingsProvider) {
        this.db = new DictionaryDatabase();
        this.settingsProvider = settingsProvider;
    }

    async buildAnkiCache(
        inputProfile: string | undefined,
        statusUpdates: (state: DictionaryBuildAnkiCacheState) => void
    ): Promise<void> {
        const settings = await this.settingsProvider.getAll();
        return buildAnkiCachePipeline(this.db, this._getProfile(inputProfile), settings, statusUpdates);
    }

    async buildWaniKaniCache(
        inputProfile: string | undefined,
        statusUpdates: (state: DictionaryBuildWaniKaniCacheState) => void
    ): Promise<void> {
        const settings = await this.settingsProvider.getAll();
        return buildWaniKaniCachePipeline(this.db, this._getProfile(inputProfile), settings, statusUpdates);
    }

    private _getProfile(inputProfile: string | undefined): string {
        return inputProfile ?? 'Default';
    }

    private async _cardStatusMap(
        profile: string,
        track: number,
        cardIds: Iterable<number>
    ): Promise<Map<number, TokenStatusInfo>> {
        const uniqueCardIds = Array.from(new Set(cardIds));
        if (!uniqueCardIds.length) return new Map();

        return this.db.ankiCards
            .where('[cardId+track+profile]')
            .anyOf(uniqueCardIds.map((cardId) => [cardId, track, profile]))
            .toArray()
            .then((ankiCards) => {
                const cardStatusMap = new Map<number, TokenStatusInfo>();
                for (const ankiCard of ankiCards) {
                    cardStatusMap.set(ankiCard.cardId, {
                        cardId: ankiCard.cardId,
                        status: ankiCard.status,
                        suspended: ankiCard.suspended,
                    });
                }
                return cardStatusMap;
            });
    }

    private async _waniKaniSubjectStatusMap(
        profile: string,
        track: number,
        subjectIds: Iterable<number>
    ): Promise<Map<number, TokenStatusInfo>> {
        const uniqueSubjectIds = Array.from(new Set(subjectIds));
        if (!uniqueSubjectIds.length) return new Map();

        return Promise.all([
            this.db.waniKaniAssignments
                .where('[subjectId+track+profile]')
                .anyOf(uniqueSubjectIds.map((subjectId) => [subjectId, track, profile]))
                .toArray(),
            this.db.waniKaniSubjects
                .where('[subjectId+track+profile]')
                .anyOf(uniqueSubjectIds.map((subjectId) => [subjectId, track, profile]))
                .toArray(),
            this.db.meta.get([profile, track]),
        ]).then(([assignments, subjects, trackMeta]) => {
            const subjectById = new Map(subjects.map((subject) => [subject.subjectId, subject]));
            const spacedRepetitionSystemById = new Map(
                trackMeta?.waniKaniMeta.spacedRepetitionSystems.map((system) => [system.id, system]) ?? []
            );
            const assignmentBySubjectId = new Map<number, DictionaryWaniKaniAssignmentRecord>();
            for (const assignment of assignments) {
                if (!assignment.data.hidden) assignmentBySubjectId.set(assignment.subjectId, assignment);
            }

            const subjectStatusMap = new Map<number, TokenStatusInfo>();
            for (const subject of subjectById.values()) {
                if (subject.data.hidden_at) continue;
                const assignment = assignmentBySubjectId.get(subject.subjectId);
                const spacedRepetitionSystem =
                    assignment === undefined
                        ? undefined
                        : spacedRepetitionSystemById.get(subject.data.spaced_repetition_system_id);
                subjectStatusMap.set(subject.subjectId, {
                    ...(assignment === undefined ? {} : { assignmentId: assignment.assignmentId }),
                    subjectId: subject.subjectId,
                    status:
                        assignment === undefined || spacedRepetitionSystem === undefined
                            ? TokenStatus.UNKNOWN
                            : _waniKaniStatusFromSrsStage(assignment.data.srs_stage, spacedRepetitionSystem),
                    suspended: false,
                });
            }
            return subjectStatusMap;
        });
    }

    private _statusesFromRecord(
        record: _DictionaryTokenRecord,
        cardStatusMap: Map<number, TokenStatusInfo>,
        waniKaniSubjectStatusMap: Map<number, TokenStatusInfo>
    ): TokenStatusInfo[] {
        if (record.source === DictionaryTokenSource.WANIKANI) {
            return record.subjectIds.flatMap((subjectId) => {
                const status = waniKaniSubjectStatusMap.get(subjectId);
                return status ? [status] : [];
            });
        }
        return record.cardIds.flatMap((cardId) => {
            const status = cardStatusMap.get(cardId);
            return status ? [status] : [];
        });
    }

    private _externalStatusesFromRecords(
        records: _DictionaryTokenRecord[],
        cardStatusMap: Map<number, TokenStatusInfo>,
        waniKaniSubjectStatusMap: Map<number, TokenStatusInfo>
    ): TokenStatusInfo[] {
        return records.flatMap((record) => {
            if (record.source === DictionaryTokenSource.LOCAL) return [];
            return this._statusesFromRecord(record, cardStatusMap, waniKaniSubjectStatusMap);
        });
    }

    private _getBestKnownExternalWordToken(
        records: _DictionaryTokenRecord[],
        cardStatusMap: Map<number, TokenStatusInfo>,
        waniKaniSubjectStatusMap: Map<number, TokenStatusInfo>,
        dictionaryAnkiTreatSuspended: TokenStatus | 'NORMAL'
    ): { record: _DictionaryTokenRecord; statuses: TokenStatusInfo[]; status: TokenStatus } | undefined {
        let bestCandidate:
            | { record: _DictionaryTokenRecord; statuses: TokenStatusInfo[]; status: TokenStatus }
            | undefined;
        for (const record of records) {
            if (record.source === DictionaryTokenSource.LOCAL) continue;
            if (record.source === DictionaryTokenSource.ANKI_SENTENCE) continue;
            const statuses = this._statusesFromRecord(record, cardStatusMap, waniKaniSubjectStatusMap);
            const status = getTokenStatus(statuses, dictionaryAnkiTreatSuspended);
            if (
                bestCandidate === undefined ||
                status > bestCandidate.status ||
                (status === bestCandidate.status &&
                    _externalWordSourcePriority(record.source) >
                        _externalWordSourcePriority(bestCandidate.record.source))
            ) {
                bestCandidate = { record, statuses, status };
            }
        }
        return bestCandidate;
    }

    private async _tokenResultsFromRecords(
        profile: string,
        track: number,
        records: _DictionaryTokenRecord[],
        settings: AsbplayerSettings
    ): Promise<TokenResults> {
        if (!records.length) return {};

        const tokenRecordMap = new Map<string, _DictionaryTokenRecord[]>();
        for (const record of records) {
            const val = tokenRecordMap.get(record.token);
            if (val) val.push(record);
            else tokenRecordMap.set(record.token, [record]);
        }

        const [cardStatusMap, waniKaniSubjectStatusMap] = await Promise.all([
            this._cardStatusMap(
                profile,
                track,
                Array.from(tokenRecordMap.values()).flatMap((tokenRecords) =>
                    tokenRecords.flatMap((record) => record.cardIds)
                )
            ),
            this._waniKaniSubjectStatusMap(
                profile,
                track,
                Array.from(tokenRecordMap.values()).flatMap((tokenRecords) =>
                    tokenRecords.flatMap((record) => record.subjectIds)
                )
            ),
        ]);

        const externalCandidateStatusesByToken = new Map<string, TokenStatusInfo[]>();
        for (const [token, tokenRecords] of tokenRecordMap.entries()) {
            externalCandidateStatusesByToken.set(
                token,
                this._externalStatusesFromRecords(tokenRecords, cardStatusMap, waniKaniSubjectStatusMap)
            );
        }

        const tokenResults: TokenResults = {};

        // Prioritize local tokens
        for (const [token, tokenRecords] of tokenRecordMap.entries()) {
            for (const record of tokenRecords) {
                if (record.source !== DictionaryTokenSource.LOCAL) continue;
                tokenResults[token] = {
                    source: record.source,
                    statuses: [{ status: record.status!, suspended: false }],
                    externalCandidateStatuses: externalCandidateStatusesByToken.get(token),
                    states: record.states,
                };
                tokenRecordMap.delete(token);
                break;
            }
        }
        if (!tokenRecordMap.size) return tokenResults;

        const dictionaryAnkiTreatSuspended = settings.dictionaryTracks[track]?.dictionaryAnkiTreatSuspended ?? 'NORMAL';
        for (const [token, tokenRecords] of tokenRecordMap.entries()) {
            const candidate = this._getBestKnownExternalWordToken(
                tokenRecords,
                cardStatusMap,
                waniKaniSubjectStatusMap,
                dictionaryAnkiTreatSuspended
            );
            if (!candidate) continue;
            tokenResults[token] = {
                source: candidate.record.source,
                statuses: candidate.statuses,
                externalCandidateStatuses: externalCandidateStatusesByToken.get(token),
                states: candidate.record.states,
            };
            tokenRecordMap.delete(token);
        }
        if (!tokenRecordMap.size) return tokenResults;

        // Finally use sentence cards if needed
        for (const [token, tokenRecords] of tokenRecordMap.entries()) {
            for (const record of tokenRecords) {
                if (record.source !== DictionaryTokenSource.ANKI_SENTENCE) continue;
                const statuses = this._statusesFromRecord(record, cardStatusMap, waniKaniSubjectStatusMap);
                tokenResults[token] = {
                    source: record.source,
                    statuses,
                    externalCandidateStatuses: externalCandidateStatusesByToken.get(token),
                    states: record.states,
                };
                break;
            }
        }

        return tokenResults;
    }

    /**
     * Get the token status for a profile and track respecting the source priority.
     * External word sources are prioritized by highest status as a user may have abandoned a source.
     */
    async getBulk(inputProfile: string | undefined, track: number, tokens: string[]): Promise<TokenResults> {
        const settings = await this.settingsProvider.getAll();
        if (!tokens.length) return {};
        const profile = this._getProfile(inputProfile);

        return this.db.transaction(
            'r',
            [this.db.tokens, this.db.ankiCards, this.db.waniKaniAssignments, this.db.waniKaniSubjects, this.db.meta],
            async () => {
                const records = await this.db.tokens
                    .where('[profile+token]')
                    .anyOf(tokens.map((token) => [profile, token]))
                    .filter((r) => r.track === track || r.track === LOCAL_TOKEN_TRACK)
                    .toArray();
                return this._tokenResultsFromRecords(profile, track, records, settings);
            }
        );
    }

    /**
     * Get all tokens for a profile and track respecting the source priority.
     * External word sources are prioritized by highest status as a user may have abandoned a source.
     */
    async getAllTokens(inputProfile: string | undefined, track: number): Promise<TokenResults> {
        const settings = await this.settingsProvider.getAll();
        const profile = this._getProfile(inputProfile);

        return this.db.transaction(
            'r',
            [this.db.tokens, this.db.ankiCards, this.db.waniKaniAssignments, this.db.waniKaniSubjects, this.db.meta],
            async () => {
                const records = await this.db.tokens
                    .where('profile')
                    .equals(profile)
                    .filter((r) => r.track === track || r.track === LOCAL_TOKEN_TRACK)
                    .toArray();
                return this._tokenResultsFromRecords(profile, track, records, settings);
            }
        );
    }

    /**
     * Get the token status for a list of lemmas for a profile and track respecting the source priority.
     * External word sources are prioritized by highest status per lemma as a user may have abandoned a source.
     */
    async getByLemmaBulk(inputProfile: string | undefined, track: number, lemmas: string[]): Promise<LemmaResults> {
        const settings = await this.settingsProvider.getAll();
        if (!lemmas.length) return {};
        const lemmasSet = new Set(lemmas);
        const profile = this._getProfile(inputProfile);

        return this.db.transaction(
            'r',
            [this.db.tokens, this.db.ankiCards, this.db.waniKaniAssignments, this.db.waniKaniSubjects, this.db.meta],
            async () => {
                return this.db.tokens
                    .where('lemmas')
                    .anyOf(lemmas)
                    .distinct()
                    .filter((r) => (r.track === track || r.track === LOCAL_TOKEN_TRACK) && r.profile === profile)
                    .toArray()
                    .then(async (records) => {
                        if (!records.length) return {};
                        const lemmaRecordMap = new Map<string, _DictionaryTokenRecord[]>();
                        for (const record of records) {
                            for (const lemma of record.lemmas) {
                                if (!lemmasSet.has(lemma)) continue;
                                const val = lemmaRecordMap.get(lemma);
                                if (val) val.push(record);
                                else lemmaRecordMap.set(lemma, [record]);
                            }
                        }

                        const [cardStatusMap, waniKaniSubjectStatusMap] = await Promise.all([
                            this._cardStatusMap(
                                profile,
                                track,
                                Array.from(lemmaRecordMap.values()).flatMap((records) =>
                                    records.flatMap((record) => record.cardIds)
                                )
                            ),
                            this._waniKaniSubjectStatusMap(
                                profile,
                                track,
                                Array.from(lemmaRecordMap.values()).flatMap((records) =>
                                    records.flatMap((record) => record.subjectIds)
                                )
                            ),
                        ]);

                        const externalCandidateStatusesByLemma = new Map<string, TokenStatusInfo[]>();
                        for (const [lemma, tokenRecords] of lemmaRecordMap.entries()) {
                            externalCandidateStatusesByLemma.set(
                                lemma,
                                this._externalStatusesFromRecords(tokenRecords, cardStatusMap, waniKaniSubjectStatusMap)
                            );
                        }

                        const lemmaResults: LemmaResults = {};

                        // Prioritize local tokens
                        for (const [lemma, records] of lemmaRecordMap.entries()) {
                            for (const record of records) {
                                if (record.source !== DictionaryTokenSource.LOCAL) continue;
                                let arr = lemmaResults[lemma];
                                if (!arr) {
                                    arr = [];
                                    lemmaResults[lemma] = arr;
                                }
                                arr.push({
                                    token: record.token,
                                    source: record.source,
                                    statuses: [{ status: record.status!, suspended: false }],
                                    externalCandidateStatuses: externalCandidateStatusesByLemma.get(lemma),
                                    states: record.states,
                                });
                                lemmaRecordMap.delete(lemma);
                            }
                        }
                        if (!lemmaRecordMap.size) return lemmaResults;

                        const dictionaryAnkiTreatSuspended =
                            settings.dictionaryTracks[track]?.dictionaryAnkiTreatSuspended ?? 'NORMAL';
                        for (const [lemma, records] of lemmaRecordMap.entries()) {
                            const ankiWordRecords = records.filter(
                                (record) => record.source === DictionaryTokenSource.ANKI_WORD
                            );
                            const waniKaniRecords = records.filter(
                                (record) => record.source === DictionaryTokenSource.WANIKANI
                            );
                            const bestAnkiWordStatus = this._getBestKnownExternalWordToken(
                                ankiWordRecords,
                                cardStatusMap,
                                waniKaniSubjectStatusMap,
                                dictionaryAnkiTreatSuspended
                            )?.status;
                            const bestWaniKaniStatus = this._getBestKnownExternalWordToken(
                                waniKaniRecords,
                                cardStatusMap,
                                waniKaniSubjectStatusMap,
                                dictionaryAnkiTreatSuspended
                            )?.status;
                            const source =
                                bestAnkiWordStatus !== undefined && bestWaniKaniStatus !== undefined
                                    ? bestAnkiWordStatus >= bestWaniKaniStatus
                                        ? DictionaryTokenSource.ANKI_WORD
                                        : DictionaryTokenSource.WANIKANI
                                    : bestAnkiWordStatus !== undefined
                                      ? DictionaryTokenSource.ANKI_WORD
                                      : bestWaniKaniStatus !== undefined
                                        ? DictionaryTokenSource.WANIKANI
                                        : undefined;
                            if (source === undefined) continue;
                            const relevantRecords =
                                source === DictionaryTokenSource.ANKI_WORD ? ankiWordRecords : waniKaniRecords;
                            for (const record of relevantRecords) {
                                let arr = lemmaResults[lemma];
                                if (!arr) {
                                    arr = [];
                                    lemmaResults[lemma] = arr;
                                }
                                const statuses = this._statusesFromRecord(
                                    record,
                                    cardStatusMap,
                                    waniKaniSubjectStatusMap
                                );
                                arr.push({
                                    token: record.token,
                                    source: record.source,
                                    statuses,
                                    externalCandidateStatuses: externalCandidateStatusesByLemma.get(lemma),
                                    states: record.states,
                                });
                                lemmaRecordMap.delete(lemma);
                            }
                        }
                        if (!lemmaRecordMap.size) return lemmaResults;

                        // Finally use sentence cards if needed
                        for (const [lemma, records] of lemmaRecordMap.entries()) {
                            for (const record of records) {
                                if (record.source !== DictionaryTokenSource.ANKI_SENTENCE) continue;
                                const statuses = this._statusesFromRecord(
                                    record,
                                    cardStatusMap,
                                    waniKaniSubjectStatusMap
                                );
                                const arr = lemmaResults[lemma];
                                if (arr) {
                                    arr.push({
                                        token: record.token,
                                        source: record.source,
                                        statuses,
                                        externalCandidateStatuses: externalCandidateStatusesByLemma.get(lemma),
                                        states: record.states,
                                    });
                                } else {
                                    lemmaResults[lemma] = [
                                        {
                                            token: record.token,
                                            source: record.source,
                                            statuses,
                                            externalCandidateStatuses: externalCandidateStatusesByLemma.get(lemma),
                                            states: record.states,
                                        },
                                    ];
                                }
                            }
                        }
                        return lemmaResults;
                    });
            }
        );
    }

    async saveRecordLocalBulk(
        inputProfile: string | undefined,
        localTokenInputs: DictionaryLocalTokenInput[],
        applyStates: ApplyStrategy
    ): Promise<DictionarySaveRecordLocalResult> {
        if (!localTokenInputs.length) return { savedTokens: [], deletedTokens: [] };
        const profile = this._getProfile(inputProfile);
        return this.db.transaction('rw', this.db.tokens, async () => {
            const tokenRecordMap = await _getFromSourceBulk(
                this.db,
                profile,
                LOCAL_TOKEN_TRACK,
                DictionaryTokenSource.LOCAL,
                localTokenInputs.map((l) => l.token)
            );

            const recordsToAdd: _DictionaryTokenRecord[] = [];
            const tokensToDelete: string[] = [];
            for (const localTokenInput of localTokenInputs) {
                if (!HAS_LETTER_REGEX.test(localTokenInput.token)) {
                    console.error(`Cannot save local token with invalid token: ${JSON.stringify(localTokenInput)}`);
                    continue;
                }
                const existingRecord = tokenRecordMap.get(localTokenInput.token); // Ignore existing lemmas as they should be re-calculated
                if (existingRecord) {
                    if (localTokenInput.status == null) localTokenInput.status = existingRecord.status;
                    localTokenInput.states = _applyStrategyToStates(
                        existingRecord.states,
                        localTokenInput.states,
                        applyStates
                    );
                } else if (localTokenInput.status == null) {
                    localTokenInput.status = TokenStatus.UNCOLLECTED;
                }
                localTokenInput.lemmas = localTokenInput.lemmas.filter((lemma) => HAS_LETTER_REGEX.test(lemma));
                if (!localTokenInput.lemmas.length) {
                    console.error(`Cannot save local token with no lemmas: ${JSON.stringify(localTokenInput)}`);
                    continue;
                }
                if (localTokenInput.status === TokenStatus.UNCOLLECTED && !localTokenInput.states.length) {
                    if (existingRecord) {
                        tokensToDelete.push(localTokenInput.token);
                        continue;
                    } else {
                        console.error(
                            `Cannot save local token with uncollected status and no states: ${JSON.stringify(localTokenInput)}`
                        );
                        continue;
                    }
                }
                recordsToAdd.push({
                    profile,
                    track: LOCAL_TOKEN_TRACK,
                    source: DictionaryTokenSource.LOCAL,
                    token: localTokenInput.token,
                    status: localTokenInput.status,
                    lemmas: localTokenInput.lemmas,
                    states: localTokenInput.states,
                    cardIds: [],
                    subjectIds: [],
                });
            }
            const res = await Promise.all([
                _saveRecordBulk(this.db, recordsToAdd),
                this.deleteRecordLocalBulk(inputProfile, tokensToDelete),
            ]);
            return { savedTokens: res[0], deletedTokens: res[1].deletedTokens };
        });
    }

    async deleteRecordLocalBulk(
        inputProfile: string | undefined,
        tokens: string[]
    ): Promise<DictionaryDeleteRecordLocalResult> {
        if (!tokens.length) return { deletedTokens: [] };
        const profile = this._getProfile(inputProfile);
        return this.db.transaction('rw', this.db.tokens, async () => {
            const deletedTokens = await this.db.tokens
                .where('[token+source+track+profile]')
                .anyOf(tokens.map((token) => [token, DictionaryTokenSource.LOCAL, LOCAL_TOKEN_TRACK, profile]))
                .primaryKeys();
            await this.db.tokens.bulkDelete(deletedTokens);
            return { deletedTokens };
        });
    }

    /**
     * The only export we need is local tokens, Anki can be rebuilt as needed.
     * Since our needs are simple, we can avoid using the dexie-export-import package.
     */
    async exportRecordLocalBulk(): Promise<DictionaryExportRecordLocalResult> {
        return this.db.tokens
            .filter((record) => record.source === DictionaryTokenSource.LOCAL)
            .toArray()
            .then((records) => ({
                exportedRecords: records.map((r) => ({
                    profile: r.profile,
                    token: r.token,
                    status: r.status,
                    lemmas: r.lemmas.length ? r.lemmas : undefined,
                    states: r.states.length ? r.states : undefined,
                })),
            }));
    }

    async importRecordLocalBulk(
        items: Partial<DictionaryTokenRecord>[],
        profiles: string[]
    ): Promise<DictionaryImportRecordLocalResult> {
        const defaultProfile = this._getProfile(undefined);
        if (!profiles.includes(defaultProfile)) profiles.unshift(defaultProfile);
        const fullyKnownStatus = getFullyKnownTokenStatus();

        return this.db.transaction('rw', this.db.tokens, async () => {
            const existingProfileTokens = new Map<string, Map<string, DictionaryLocalTokenInput>>();
            await this.db.tokens
                .filter((record) => record.source === DictionaryTokenSource.LOCAL)
                .each((record) => {
                    let existingTokens = existingProfileTokens.get(record.profile);
                    if (!existingTokens) {
                        existingTokens = new Map();
                        existingProfileTokens.set(record.profile, existingTokens);
                    }
                    existingTokens.set(record.token, {
                        token: record.token,
                        status: record.status,
                        lemmas: record.lemmas,
                        states: record.states,
                    });
                });

            const records: _DictionaryTokenRecord[] = [];
            for (const item of items) {
                if (!item.token || !HAS_LETTER_REGEX.test(item.token)) continue;
                if (!item.profile || !profiles.includes(item.profile)) continue;
                if (!item.lemmas) item.lemmas = [];
                if (!item.states) item.states = [];
                const existingToken = existingProfileTokens.get(item.profile)?.get(item.token);
                if (existingToken) {
                    item.status = Math.max(item.status ?? TokenStatus.UNCOLLECTED, existingToken.status!); // Keep the highest for imports
                    if (!item.lemmas.length) item.lemmas = existingToken.lemmas; // Use existing lemmas only if it wasn't re-calculated
                    item.states = existingToken.states; // Treat the existing states as authoritative, TODO: expose ApplyStrategy for imports?
                }
                item.lemmas = item.lemmas.filter((lemma) => HAS_LETTER_REGEX.test(lemma));
                if (!item.lemmas.length) continue; // Cannot import tokens with no lemmas, require a different method where a tokenizer is available
                let status = item.status;
                if (item.status == null || item.status < TokenStatus.UNKNOWN) {
                    if (!item.states.length) continue; // Status cannot be uncollected unless there is a state
                    status = TokenStatus.UNCOLLECTED;
                } else if (item.status > fullyKnownStatus) {
                    status = fullyKnownStatus;
                }
                records.push({
                    profile: item.profile,
                    track: LOCAL_TOKEN_TRACK,
                    source: DictionaryTokenSource.LOCAL,
                    token: item.token,
                    status: status!,
                    lemmas: item.lemmas,
                    states: item.states,
                    cardIds: [],
                    subjectIds: [],
                });
            }
            return { importedTokens: await _saveRecordBulk(this.db, records) };
        });
    }

    async deleteProfile(profile: string): Promise<DictionaryDeleteProfileResult> {
        return this.db.transaction(
            'rw',
            [this.db.meta, this.db.tokens, this.db.ankiCards, this.db.waniKaniSubjects, this.db.waniKaniAssignments],
            async () => {
                const deletedMetas = await this.db.meta.where('profile').equals(profile).primaryKeys();
                const deletedTokens = await this.db.tokens.where('profile').equals(profile).primaryKeys();
                const deletedAnkiCards = await this.db.ankiCards.where('profile').equals(profile).primaryKeys();
                const deletedWaniKaniSubjects = await this.db.waniKaniSubjects
                    .where('profile')
                    .equals(profile)
                    .primaryKeys();
                const deletedWaniKaniAssignments = await this.db.waniKaniAssignments
                    .where('profile')
                    .equals(profile)
                    .primaryKeys();
                await Promise.all([
                    this.db.meta.bulkDelete(deletedMetas),
                    this.db.tokens.bulkDelete(deletedTokens),
                    this.db.ankiCards.bulkDelete(deletedAnkiCards),
                    this.db.waniKaniSubjects.bulkDelete(deletedWaniKaniSubjects),
                    this.db.waniKaniAssignments.bulkDelete(deletedWaniKaniAssignments),
                ]);
                return {
                    deletedMetas,
                    deletedTokens,
                    deletedAnkiCards,
                    deletedWaniKaniSubjects,
                    deletedWaniKaniAssignments,
                };
            }
        );
    }

    async getRecords(inputProfile: string | undefined, track: number | undefined): Promise<DictionaryRecordsResult> {
        const profile = this._getProfile(inputProfile);

        return this.db.transaction(
            'r',
            [this.db.tokens, this.db.ankiCards, this.db.waniKaniAssignments, this.db.waniKaniSubjects, this.db.meta],
            async () => {
                const tokenRecords =
                    track === undefined
                        ? await this.db.tokens.where('profile').equals(profile).toArray()
                        : await this.db.tokens
                              .where('profile')
                              .equals(profile)
                              .filter((r) => r.track === track || r.track === LOCAL_TOKEN_TRACK)
                              .toArray();
                if (!tokenRecords.length) {
                    return {
                        tokenRecords: [],
                        ankiCardRecords: {},
                        waniKaniSubjectRecords: {},
                        waniKaniAssignmentRecords: {},
                    };
                }

                const ankiCardKeys = Array.from(
                    new Map(
                        tokenRecords.flatMap((record) =>
                            record.cardIds.map((cardId) => [
                                `${cardId}:${record.track}`,
                                [cardId, record.track, profile] as const,
                            ])
                        )
                    ).values()
                );
                const ankiCardRecords = ankiCardKeys.length
                    ? await this.db.ankiCards
                          .where('[cardId+track+profile]')
                          .anyOf(ankiCardKeys)
                          .toArray()
                          .then((records) => {
                              const recordsByTrack: DictionaryAnkiCardRecordsByTrack = {};
                              for (const record of records) {
                                  const trackRecords = recordsByTrack[record.track];
                                  if (trackRecords) {
                                      trackRecords[record.cardId] = record;
                                  } else {
                                      recordsByTrack[record.track] = { [record.cardId]: record };
                                  }
                              }
                              return recordsByTrack;
                          })
                    : {};

                const waniKaniSubjectIdsByTrack = new Map<number, number[]>();
                for (const record of tokenRecords) {
                    if (record.source !== DictionaryTokenSource.WANIKANI || !record.subjectIds.length) continue;
                    const subjectIds = waniKaniSubjectIdsByTrack.get(record.track);
                    if (subjectIds) subjectIds.push(...record.subjectIds);
                    else waniKaniSubjectIdsByTrack.set(record.track, [...record.subjectIds]);
                }
                const waniKaniSubjectRecords: DictionaryWaniKaniSubjectRecordsByTrack = {};
                const waniKaniAssignmentRecords: DictionaryWaniKaniAssignmentRecordsByTrack = {};
                await Promise.all(
                    Array.from(waniKaniSubjectIdsByTrack.entries()).map(async ([recordTrack, subjectIds]) => {
                        const uniqueSubjectIds = Array.from(new Set(subjectIds));
                        const subjectKeys = uniqueSubjectIds.map(
                            (subjectId) => [subjectId, recordTrack, profile] as const
                        );
                        const [subjects, assignments, trackMeta] = await Promise.all([
                            this.db.waniKaniSubjects.where('[subjectId+track+profile]').anyOf(subjectKeys).toArray(),
                            this.db.waniKaniAssignments.where('[subjectId+track+profile]').anyOf(subjectKeys).toArray(),
                            this.db.meta.get([profile, recordTrack]),
                        ]);
                        const trackSubjectRecords: Record<number, DictionaryWaniKaniSubjectRecord> = {};
                        for (const subject of subjects) {
                            trackSubjectRecords[subject.subjectId] = subject;
                        }

                        const spacedRepetitionSystemById = new Map<number, WaniKaniSpacedRepetitionSystem>(
                            trackMeta?.waniKaniMeta.spacedRepetitionSystems.map((system) => [system.id, system]) ?? []
                        );
                        const trackAssignmentRecords: Record<number, DictionaryWaniKaniAssignmentRecordWithStatus> = {};
                        for (const assignment of assignments) {
                            const subject = trackSubjectRecords[assignment.subjectId];
                            const spacedRepetitionSystem =
                                subject === undefined
                                    ? undefined
                                    : spacedRepetitionSystemById.get(subject.data.spaced_repetition_system_id);
                            trackAssignmentRecords[assignment.assignmentId] = {
                                ...assignment,
                                status:
                                    spacedRepetitionSystem === undefined
                                        ? TokenStatus.UNKNOWN
                                        : _waniKaniStatusFromSrsStage(
                                              assignment.data.srs_stage,
                                              spacedRepetitionSystem
                                          ),
                            };
                        }
                        waniKaniSubjectRecords[recordTrack] = trackSubjectRecords;
                        waniKaniAssignmentRecords[recordTrack] = trackAssignmentRecords;
                    })
                );

                const normalizedTokenRecords = tokenRecords.map((record) =>
                    record.source === DictionaryTokenSource.LOCAL ? record : { ...record, status: null }
                );

                return {
                    tokenRecords: normalizedTokenRecords,
                    ankiCardRecords,
                    waniKaniSubjectRecords,
                    waniKaniAssignmentRecords,
                };
            }
        );
    }

    async updateRecords(
        inputProfile: string | undefined,
        updates: DictionaryRecordUpdateInput[],
        applyStates: ApplyStrategy
    ): Promise<DictionaryRecordUpdateResult> {
        if (!updates.length) return { savedTokens: [], deletedTokens: [] };
        const profile = this._getProfile(inputProfile);

        return this.db.transaction('rw', this.db.tokens, async () => {
            const existingRecords = await this.db.tokens.bulkGet(updates.map((update) => update.tokenKey));
            const recordsToPut: _DictionaryTokenRecord[] = [];
            const tokenKeysToDelete: DictionaryTokenKey[] = [];
            for (const [index, update] of updates.entries()) {
                const existingRecord = existingRecords[index];
                if (
                    !existingRecord ||
                    existingRecord.profile !== profile ||
                    existingRecord.source !== DictionaryTokenSource.LOCAL
                ) {
                    continue;
                }
                const nextStates = _applyStrategyToStates(existingRecord.states, update.states, applyStates);
                if (update.status === TokenStatus.UNCOLLECTED && !nextStates.length) {
                    tokenKeysToDelete.push(update.tokenKey);
                    continue;
                }
                recordsToPut.push({
                    ...existingRecord,
                    status: update.status,
                    states: nextStates,
                });
            }
            const res = await Promise.all([
                _saveRecordBulk(this.db, recordsToPut),
                this.db.tokens.bulkDelete(tokenKeysToDelete),
            ]);
            return { savedTokens: res[0], deletedTokens: tokenKeysToDelete };
        });
    }

    async deleteRecords(
        inputProfile: string | undefined,
        tokenKeys: DictionaryTokenKey[]
    ): Promise<DictionaryRecordDeleteResult> {
        if (!tokenKeys.length) return { deletedTokens: [] };
        const profile = this._getProfile(inputProfile);

        return this.db.transaction('rw', this.db.tokens, async () => {
            const existingRecords = await this.db.tokens.bulkGet(tokenKeys);
            const deletedTokens = tokenKeys.filter(
                (_, index) =>
                    existingRecords[index]?.profile === profile &&
                    existingRecords[index]?.source === DictionaryTokenSource.LOCAL
            );
            if (deletedTokens.length) await this.db.tokens.bulkDelete(deletedTokens);
            return { deletedTokens };
        });
    }
}

export async function _getFromSourceBulk(
    db: DictionaryDatabase,
    profile: string,
    track: number,
    source: DictionaryTokenSource,
    tokens: string[]
): Promise<Map<string, _DictionaryTokenRecord>> {
    if (!tokens.length) return new Map();
    return db.tokens
        .where('[token+source+track+profile]')
        .anyOf(tokens.map((token) => [token, source, track, profile]))
        .toArray()
        .then((records) => {
            if (!records.length) return new Map();
            const tokenRecordMap = new Map<string, _DictionaryTokenRecord>();
            for (const record of records) tokenRecordMap.set(record.token, record);
            return tokenRecordMap;
        });
}

export async function _saveRecordBulk(
    db: DictionaryDatabase,
    records: _DictionaryTokenRecord[]
): Promise<DictionaryTokenKey[]> {
    if (!records.length) return [];
    return db.tokens.bulkPut(records, { allKeys: true });
}

function newAnkiMeta(changes: AnkiMetaBuildChanges = {}): AnkiMeta {
    return {
        lastBuildStartedAt: 0,
        lastBuildExpiresAt: 0,
        buildId: null,
        settings: null,
        ...changes,
    };
}

export function _newWaniKaniMeta(changes: WaniKaniMetaBuildChanges = {}): WaniKaniMeta {
    return {
        lastBuildStartedAt: 0,
        lastBuildExpiresAt: 0,
        buildId: null,
        settings: null,
        dataUpdatedAt: {},
        spacedRepetitionSystems: [],
        ...changes,
    };
}

function buildMeta(trackMeta: DictionaryMetaRecord, buildIdSlot: DictionaryBuildIdSlot): AnkiMeta | WaniKaniMeta {
    return buildIdSlot === 'waniKani' ? trackMeta.waniKaniMeta : trackMeta.ankiMeta;
}

function buildId(trackMeta: DictionaryMetaRecord, buildIdSlot: DictionaryBuildIdSlot): string | null | undefined {
    return buildMeta(trackMeta, buildIdSlot).buildId;
}

export function _buildIdExpiration(trackMeta: DictionaryMetaRecord, buildIdSlot: DictionaryBuildIdSlot): number {
    return buildMeta(trackMeta, buildIdSlot).lastBuildExpiresAt;
}

function buildIdLabel(buildIdSlot: DictionaryBuildIdSlot): string {
    return buildIdSlot === 'waniKani' ? 'WaniKani buildId' : 'Anki buildId';
}

function setBuildIdChanges(
    trackMeta: DictionaryMetaRecord,
    buildIdSlot: DictionaryBuildIdSlot,
    nextBuildId: string,
    buildTs: number,
    initialExpiration: number
): Partial<DictionaryMetaRecord> {
    const meta = buildMeta(trackMeta, buildIdSlot);
    if (buildIdSlot === 'waniKani') {
        return {
            waniKaniMeta: {
                ...meta,
                lastBuildStartedAt: buildTs,
                lastBuildExpiresAt: initialExpiration,
                buildId: nextBuildId,
            } as WaniKaniMeta,
        };
    }
    return {
        ankiMeta: {
            ...meta,
            lastBuildStartedAt: buildTs,
            lastBuildExpiresAt: initialExpiration,
            buildId: nextBuildId,
        },
    };
}

function newBuildMetaRecord(
    key: DictionaryMetaKey,
    buildIdSlot: DictionaryBuildIdSlot,
    nextBuildId: string,
    buildTs: number,
    initialExpiration: number
): DictionaryMetaRecord {
    return {
        profile: key[0],
        track: key[1],
        ankiMeta: newAnkiMeta(
            buildIdSlot === 'anki'
                ? {
                      lastBuildStartedAt: buildTs,
                      lastBuildExpiresAt: initialExpiration,
                      buildId: nextBuildId,
                  }
                : undefined
        ),
        waniKaniMeta: _newWaniKaniMeta(
            buildIdSlot === 'waniKani'
                ? {
                      lastBuildStartedAt: buildTs,
                      lastBuildExpiresAt: initialExpiration,
                      buildId: nextBuildId,
                  }
                : undefined
        ),
    };
}

export async function _ensureBuildId(
    db: DictionaryDatabase,
    key: DictionaryMetaKey,
    nextBuildId: string,
    buildIdSlot: DictionaryBuildIdSlot,
    options: { mode: 'claim'; buildTs: number } | { mode: 'verify' }
): Promise<boolean> {
    return db.transaction('rw', db.meta, async () => {
        const trackMeta = await db.meta.where('[profile+track]').equals(key).first();
        if (options.mode === 'verify') return (trackMeta && buildId(trackMeta, buildIdSlot)) === nextBuildId;
        const { buildTs } = options;
        const initialExpiration = buildTs + BUILD_MIN_EXPIRATION_MS;

        if (!trackMeta) {
            await db.meta.add(newBuildMetaRecord(key, buildIdSlot, nextBuildId, buildTs, initialExpiration));
            return true;
        }

        const existingBuildId = buildId(trackMeta, buildIdSlot);
        if (existingBuildId && existingBuildId !== nextBuildId) {
            const existingBuildExpiration = _buildIdExpiration(trackMeta, buildIdSlot);
            if (buildTs < existingBuildExpiration) return false;
            console.warn(
                `Stale ${buildIdLabel(buildIdSlot)} ${existingBuildId} which expired at ${new Date(existingBuildExpiration).toISOString()} detected for track ${key[1] + 1}, ignoring.`
            );
        }

        await db.meta.update(key, setBuildIdChanges(trackMeta, buildIdSlot, nextBuildId, buildTs, initialExpiration));
        return true;
    });
}

export async function _buildIdHealthCheck(
    db: DictionaryDatabase,
    nextBuildId: string,
    buildIdSlot: DictionaryBuildIdSlot,
    activeTracks: DictionaryMetaKey[]
): Promise<void> {
    for (const metaKey of activeTracks) {
        if (await _ensureBuildId(db, metaKey, nextBuildId, buildIdSlot, { mode: 'verify' })) continue;
        throw new Error(`${buildIdLabel(buildIdSlot)} was corrupted for track ${metaKey[1] + 1}`);
    }
}

async function clearBuildId(
    db: DictionaryDatabase,
    key: DictionaryMetaKey,
    nextBuildId: string,
    buildIdSlot: DictionaryBuildIdSlot
): Promise<void> {
    return db.transaction('rw', db.meta, async () => {
        const trackMeta = await db.meta.where('[profile+track]').equals(key).first();
        if (!trackMeta || buildId(trackMeta, buildIdSlot) !== nextBuildId) return;
        if (buildIdSlot === 'waniKani') {
            await db.meta.update(key, {
                waniKaniMeta: {
                    ...trackMeta.waniKaniMeta,
                    buildId: null,
                },
            });
        } else {
            await db.meta.update(key, {
                ankiMeta: {
                    ...trackMeta.ankiMeta,
                    buildId: null,
                },
            });
        }
    });
}

export async function _clearBuildIds(
    db: DictionaryDatabase,
    activeTracks: DictionaryMetaKey[],
    nextBuildId: string,
    buildIdSlot: DictionaryBuildIdSlot
): Promise<void> {
    for (const key of activeTracks) {
        try {
            await clearBuildId(db, key, nextBuildId, buildIdSlot);
        } catch (e) {
            console.error(`Error clearing ${buildIdLabel(buildIdSlot)} for track ${key[1] + 1}: ${e}`);
        }
    }
}

export async function _gatherModifiedTokens(
    db: DictionaryDatabase,
    profile: string,
    modifiedTokens: Set<string>
): Promise<void> {
    if (!modifiedTokens.size) return;
    return db.tokens
        .where('lemmas')
        .anyOf(Array.from(modifiedTokens))
        .distinct()
        .filter((r) => r.profile === profile)
        .toArray()
        .then((records) => {
            for (const record of records) {
                modifiedTokens.add(record.token);
                for (const lemma of record.lemmas) modifiedTokens.add(lemma);
            }
        });
}

export async function _gatherModifiedTokensForTrack(
    db: DictionaryDatabase,
    profile: string,
    track: number,
    modifiedTokens: Set<string>
): Promise<void> {
    if (!modifiedTokens.size) return;
    return db.tokens
        .where('lemmas')
        .anyOf(Array.from(modifiedTokens))
        .distinct()
        .filter((r) => r.profile === profile && r.track === track)
        .toArray()
        .then((records) => {
            for (const record of records) {
                modifiedTokens.add(record.token);
                for (const lemma of record.lemmas) modifiedTokens.add(lemma);
            }
        });
}

function _applyStrategyToStates(currentStates: TokenState[], nextStates: TokenState[], applyStates: ApplyStrategy) {
    const currentStateSet = new Set(currentStates);
    switch (applyStates) {
        case ApplyStrategy.ADD:
            return Array.from(new Set([...currentStates, ...nextStates])).sort((lhs, rhs) => lhs - rhs);
        case ApplyStrategy.REMOVE:
            return currentStates.filter((state) => !nextStates.includes(state));
        case ApplyStrategy.REPLACE:
            return [...nextStates].sort((lhs, rhs) => lhs - rhs);
        case ApplyStrategy.TOGGLE:
            for (const state of nextStates) {
                if (currentStateSet.has(state)) {
                    currentStateSet.delete(state);
                } else {
                    currentStateSet.add(state);
                }
            }
            return Array.from(currentStateSet).sort((lhs, rhs) => lhs - rhs);
        default:
            throw new Error(`Unsupported applyStates value: "${applyStates}"`);
    }
}

function _externalWordSourcePriority(source: DictionaryTokenSource): number {
    switch (source) {
        case DictionaryTokenSource.ANKI_WORD:
            return 2;
        case DictionaryTokenSource.WANIKANI:
            return 1;
        default:
            return 0;
    }
}

function _waniKaniStatusFromSrsStage(
    srsStage: number,
    spacedRepetitionSystem: WaniKaniSpacedRepetitionSystem
): TokenStatus {
    const stagePositions = spacedRepetitionSystem.data;
    const youngStagePosition =
        stagePositions.passing_stage_position +
        Math.ceil((stagePositions.burning_stage_position - stagePositions.passing_stage_position) / 2);

    if (srsStage >= stagePositions.burning_stage_position) return TokenStatus.MATURE;
    if (srsStage >= youngStagePosition) return TokenStatus.YOUNG;
    if (srsStage >= stagePositions.passing_stage_position) return TokenStatus.GRADUATED;
    if (srsStage >= stagePositions.starting_stage_position) return TokenStatus.LEARNING;
    return TokenStatus.UNKNOWN;
}
