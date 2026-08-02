import 'core-js/stable/structured-clone';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DictionaryBuildWaniKaniCacheStateErrorCode, DictionaryBuildWaniKaniCacheStateType } from '@project/common';
import { AsbplayerSettings, DictionaryTokenSource, TokenState, TokenStatus } from '@project/common/settings';

const mockWaniKaniInstances: any[] = [];
const mockWaniKaniOverrides: any[] = [];
const mockYomitanInstances: any[] = [];
const mockYomitanOverrides: any[] = [];

jest.mock('uuid', () => ({ v4: () => 'test-build-id' }));
jest.mock('@project/common/wanikani', () => {
    class WaniKaniApiError extends Error {
        readonly status: number;
        readonly code?: number;

        constructor(status: number, message: string, code?: number) {
            super(message);
            this.name = 'WaniKaniApiError';
            this.status = status;
            this.code = code;
        }
    }

    return {
        WaniKaniApiError,
        WaniKani: jest.fn().mockImplementation((apiToken) => {
            const instance = {
                apiToken,
                resets: jest.fn(async () => ({ data: [], dataUpdatedAt: null, totalCount: 0 })),
                spacedRepetitionSystems: jest.fn(async () => ({ data: [], dataUpdatedAt: null, totalCount: 0 })),
                assignments: jest.fn(async () => ({ data: [], dataUpdatedAt: null, totalCount: 0 })),
                subjects: jest.fn(async () => ({ data: [], dataUpdatedAt: null, totalCount: 0 })),
            };
            Object.assign(instance, mockWaniKaniOverrides.shift());
            mockWaniKaniInstances.push(instance);
            return instance;
        }),
    };
});
jest.mock('@project/common/yomitan/yomitan', () => ({
    Yomitan: jest.fn().mockImplementation((dt) => {
        const instance = {
            dt,
            version: jest.fn<() => Promise<string>>().mockResolvedValue('26.4.6'),
            tokenizeBulk: jest.fn<(texts: string[]) => Promise<unknown>>().mockResolvedValue(undefined),
            tokenize: jest.fn<(text: string) => Promise<{ text: string }[][]>>((text) => Promise.resolve([[{ text }]])),
            verifyTokenizeResult: jest.fn(),
            lemmatize: jest.fn<(token: string) => Promise<string[] | undefined>>((token) => Promise.resolve([token])),
            resetCache: jest.fn(),
        };
        Object.assign(instance, mockYomitanOverrides.shift());
        mockYomitanInstances.push(instance);
        return instance;
    }),
}));

import { WaniKaniApiError, type WaniKaniAssignment, type WaniKaniSubject } from '@project/common/wanikani';
import {
    DictionaryDB,
    _buildIdHealthCheck,
    _clearBuildIds,
    _ensureBuildId,
    _gatherModifiedTokensForTrack,
    _getFromSourceBulk,
    _saveRecordBulk,
} from './dictionary-db';
import {
    _buildWaniKaniTokensForTrack,
    _deleteWaniKaniResourcesForTracks,
    _deleteWaniKaniTokensForTracks,
    _mergeWaniKaniSpaceRepetitionSystems,
    _processWaniKaniTracks,
    _saveWaniKaniTokenBatchForDB,
    _updateBuildWaniKaniCacheProgress,
    _waniKaniAssignmentRecord,
    _waniKaniSubjectRecord,
} from './dictionary-db-wanikani';
import {
    makeAnkiCardRecord,
    makeDictionaryTrack,
    makeMetaRecord,
    makeSettings,
    makeTokenRecord,
    makeWaniKaniAssignmentRecord,
    makeWaniKaniSpacedRepetitionSystem,
    makeWaniKaniSubjectRecord,
    otherProfile,
    otherTrack,
    privateDb,
    profile,
    tokenKey,
    track,
} from './dictionary-db-test-utils';

const collection = <T>(data: T[], dataUpdatedAt = '2024-01-01T00:00:00.000000Z') => ({
    data,
    dataUpdatedAt,
    totalCount: data.length,
});

const emptyCollection = <T>(dataUpdatedAt: string | null = null) => ({
    data: [] as T[],
    dataUpdatedAt,
    totalCount: 0,
});

const waniKaniSettingsString = (dt: ReturnType<typeof makeDictionaryTrack>) =>
    JSON.stringify({
        dictionaryYomitanUrl: dt.dictionaryYomitanUrl,
        dictionaryYomitanParser: dt.dictionaryYomitanParser,
        dictionaryYomitanScanLength: dt.dictionaryYomitanScanLength,
        dictionaryWaniKaniApiToken: dt.dictionaryWaniKaniApiToken.trim(),
    });

const makeWaniKaniAssignment = (overrides: Partial<WaniKaniAssignment> = {}): WaniKaniAssignment => ({
    id: 1,
    object: 'assignment',
    url: 'https://api.wanikani.com/v2/assignments/1',
    data_updated_at: '2024-01-01T00:00:00.000000Z',
    data: {
        subject_id: 1,
        subject_type: 'vocabulary',
        srs_stage: 5,
        hidden: false,
        available_at: '2024-02-01T00:00:00.000000Z',
    },
    ...overrides,
});

const makeWaniKaniSubject = (overrides: Partial<WaniKaniSubject> = {}): WaniKaniSubject => ({
    id: 1,
    object: 'vocabulary',
    url: 'https://api.wanikani.com/v2/subjects/1',
    data_updated_at: '2024-01-01T00:00:00.000000Z',
    data: {
        characters: '単語',
        level: 3,
        hidden_at: null,
        spaced_repetition_system_id: 1,
    },
    ...overrides,
});

describe('DictionaryDB WaniKani cache', () => {
    let dictionaryDB: DictionaryDB;
    let settings: AsbplayerSettings;

    const useSettings = (dictionaryTracks = [makeDictionaryTrack()]) => {
        settings = makeSettings(dictionaryTracks);
        return settings;
    };

    const installHelperAdapters = () => {
        const db = privateDb(dictionaryDB);
        Object.assign(dictionaryDB as any, {
            _buildIdHealthCheck: (buildId: string, activeTracks: [string, number][]) =>
                _buildIdHealthCheck(db, buildId, 'waniKani', activeTracks),
            _buildWaniKaniTokensForTrack: (
                ...args: Parameters<typeof _buildWaniKaniTokensForTrack> extends [any, ...infer Rest] ? Rest : never
            ) => _buildWaniKaniTokensForTrack(db, ...args),
            _clearBuildId: (key: [string, number], buildId: string) => _clearBuildIds(db, [key], buildId, 'waniKani'),
            _clearBuildIds: (activeTracks: [string, number][], buildId: string) =>
                _clearBuildIds(db, activeTracks, buildId, 'waniKani'),
            _deleteWaniKaniResourcesForTracks: (profile: string, tracks: Iterable<number>) =>
                _deleteWaniKaniResourcesForTracks(db, profile, tracks),
            _deleteWaniKaniTokensForTracks: (
                profile: string,
                tracks: Iterable<number>,
                modifiedTokensByTrack: Map<number, Set<string>>
            ) => _deleteWaniKaniTokensForTracks(db, profile, tracks, modifiedTokensByTrack),
            _ensureBuildId: (key: [string, number], buildId: string, options: { buildTs: number }) =>
                _ensureBuildId(db, key, buildId, 'waniKani', { mode: 'claim', buildTs: options.buildTs }),
            _gatherModifiedTokensForTrack: (profile: string, track: number, modifiedTokens: Set<string>) =>
                _gatherModifiedTokensForTrack(db, profile, track, modifiedTokens),
            _getFromSourceBulk: (profile: string, track: number, source: DictionaryTokenSource, tokens: string[]) =>
                _getFromSourceBulk(db, profile, track, source, tokens),
            _processWaniKaniTracks: (
                ...args: Parameters<typeof _processWaniKaniTracks> extends [any, ...infer Rest] ? Rest : never
            ) => _processWaniKaniTracks(db, ...args),
            _saveRecordBulk: (records: ReturnType<typeof makeTokenRecord>[]) => _saveRecordBulk(db, records),
            _saveWaniKaniTokenBatchForDB: (
                ...args: Parameters<typeof _saveWaniKaniTokenBatchForDB> extends [any, ...infer Rest] ? Rest : never
            ) => _saveWaniKaniTokenBatchForDB(db, ...args),
            _updateBuildWaniKaniCacheProgress: (
                ...args: Parameters<typeof _updateBuildWaniKaniCacheProgress> extends [any, ...infer Rest]
                    ? Rest
                    : never
            ) => _updateBuildWaniKaniCacheProgress(db, ...args),
        });
    };

    beforeEach(async () => {
        mockWaniKaniInstances.length = 0;
        mockWaniKaniOverrides.length = 0;
        mockYomitanInstances.length = 0;
        mockYomitanOverrides.length = 0;
        await Dexie.delete('DictionaryDatabase');
        settings = makeSettings([makeDictionaryTrack()]);
        dictionaryDB = new DictionaryDB({
            getAll: jest.fn(async () => settings),
            getSingle: jest.fn(async (key: keyof AsbplayerSettings) => settings[key]),
        } as any);
        installHelperAdapters();
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        privateDb(dictionaryDB).close();
        await Dexie.delete('DictionaryDatabase');
    });

    const seedTokens = async (...records: ReturnType<typeof makeTokenRecord>[]) => {
        await privateDb(dictionaryDB).tokens.bulkPut(records);
    };

    const seedAnkiCards = async (...records: ReturnType<typeof makeAnkiCardRecord>[]) => {
        await privateDb(dictionaryDB).ankiCards.bulkPut(records);
    };

    const seedWaniKaniSubjects = async (...records: ReturnType<typeof makeWaniKaniSubjectRecord>[]) => {
        await privateDb(dictionaryDB).waniKaniSubjects.bulkPut(records);
    };

    const seedWaniKaniAssignments = async (...records: ReturnType<typeof makeWaniKaniAssignmentRecord>[]) => {
        await privateDb(dictionaryDB).waniKaniAssignments.bulkPut(records);
    };

    const waitForWaniKaniBuildToFinish = async (key: [string, number] = [profile, track]) => {
        for (let i = 0; i < 20; i++) {
            const meta = await privateDb(dictionaryDB).meta.get(key);
            if (meta?.waniKaniMeta.buildId === null) return;
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        throw new Error('Timed out waiting for WaniKani build to finish');
    };

    const makeYomitan = (overrides: Record<string, unknown> = {}) => ({
        tokenizeBulk: jest.fn<(texts: string[]) => Promise<unknown>>().mockResolvedValue(undefined),
        tokenize: jest.fn<(text: string) => Promise<{ text: string }[][]>>((text) => Promise.resolve([[{ text }]])),
        verifyTokenizeResult: jest.fn(),
        lemmatize: jest.fn<(token: string) => Promise<string[] | undefined>>((token) =>
            Promise.resolve([`${token}-lemma`])
        ),
        resetCache: jest.fn(),
        ...overrides,
    });

    const makeWaniKaniTrackState = (overrides: Record<string, unknown> = {}) => ({
        dt: makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryWaniKaniApiToken: 'wk-token' }),
        yomitan: makeYomitan(),
        assignmentsToPut: [],
        subjectsToPut: [],
        spacedRepetitionSystems: [],
        numFetchedAssignments: 0,
        numFetchedSubjects: 0,
        affectedSubjectIds: new Set<number>(),
        clearTokens: false,
        clearResources: false,
        settings: 'settings',
        dataUpdatedAt: {},
        ...overrides,
    });

    it('merges WaniKani SRS metadata and maps API records to DB records', () => {
        const srs = (id: number, name: string) => {
            const base = makeWaniKaniSpacedRepetitionSystem({ id });
            return { ...base, data: { ...base.data, name } };
        };

        expect(
            _mergeWaniKaniSpaceRepetitionSystems([srs(2, 'old two'), srs(1, 'one')], [srs(2, 'two'), srs(3, 'three')])
        ).toMatchObject([
            { id: 1, data: { name: 'one' } },
            { id: 2, data: { name: 'two' } },
            { id: 3, data: { name: 'three' } },
        ]);

        expect(
            _waniKaniAssignmentRecord(
                profile,
                track,
                makeWaniKaniAssignment({
                    id: 7,
                    data: {
                        ...makeWaniKaniAssignment().data,
                        subject_id: 9,
                        srs_stage: 8,
                        hidden: true,
                        available_at: null,
                    },
                })
            )
        ).toEqual({
            profile,
            track,
            assignmentId: 7,
            subjectId: 9,
            data: { srs_stage: 8, hidden: true, available_at: null },
        });
        expect(
            _waniKaniSubjectRecord(
                profile,
                track,
                makeWaniKaniSubject({
                    id: 9,
                    data: {
                        characters: '仮名',
                        level: 12,
                        hidden_at: '2024-03-01T00:00:00.000000Z',
                        spaced_repetition_system_id: 2,
                    },
                })
            )
        ).toEqual({
            profile,
            track,
            subjectId: 9,
            data: {
                characters: '仮名',
                hidden_at: '2024-03-01T00:00:00.000000Z',
                level: 12,
                spaced_repetition_system_id: 2,
            },
        });
    });

    it('manages WaniKani build IDs, health checks, clearing, and progress expiration', async () => {
        const key: [string, number] = [profile, track];
        const statusUpdates = jest.fn();
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const dateNow = jest.spyOn(Date, 'now').mockReturnValue(2000);

        await expect((dictionaryDB as any)._ensureBuildId(key, 'build-1', { buildTs: 1000 })).resolves.toBe(true);
        await expect((dictionaryDB as any)._ensureBuildId(key, 'build-2', { buildTs: 2000 })).resolves.toBe(false);
        await expect((dictionaryDB as any)._buildIdHealthCheck('build-1', [key])).resolves.toBeUndefined();
        await expect((dictionaryDB as any)._buildIdHealthCheck('build-2', [key])).rejects.toThrow(
            'WaniKani buildId was corrupted for track 1'
        );
        await expect((dictionaryDB as any)._ensureBuildId(key, 'build-2', { buildTs: 302000 })).resolves.toBe(true);
        expect(consoleWarn).toHaveBeenCalledTimes(1);

        await (dictionaryDB as any)._updateBuildWaniKaniCacheProgress(
            'build-2',
            [key],
            track,
            { current: 1, total: 3, startedAt: 1000 },
            ['alpha'],
            statusUpdates
        );
        await expect(privateDb(dictionaryDB).meta.get(key)).resolves.toMatchObject({
            waniKaniMeta: {
                buildId: 'build-2',
                lastBuildExpiresAt: 302000,
            },
        });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildWaniKaniCacheStateType.progress,
            body: { track, current: 1, total: 3, buildTimestamp: 1000, modifiedTokens: ['alpha'] },
        });

        await (dictionaryDB as any)._clearBuildId(key, 'wrong-build');
        await expect(privateDb(dictionaryDB).meta.get(key)).resolves.toMatchObject({
            waniKaniMeta: { buildId: 'build-2' },
        });
        await (dictionaryDB as any)._clearBuildIds([key], 'build-2');
        await expect(privateDb(dictionaryDB).meta.get(key)).resolves.toMatchObject({
            waniKaniMeta: { buildId: null },
        });
        dateNow.mockRestore();
    });

    it('clears WaniKani tokens and resources by profile and track while recording modified lemmas', async () => {
        const modifiedTokensByTrack = new Map<number, Set<string>>();
        await seedTokens(
            makeTokenRecord({
                token: 'cached',
                track,
                source: DictionaryTokenSource.WANIKANI,
                status: null,
                lemmas: ['cached-lemma'],
                states: [TokenState.IGNORED],
                cardIds: [1],
            }),
            makeTokenRecord({
                token: 'anki',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['anki-lemma'],
                cardIds: [1],
            }),
            makeTokenRecord({
                token: 'other-track',
                track: otherTrack,
                source: DictionaryTokenSource.WANIKANI,
                status: null,
                lemmas: ['other-track-lemma'],
                cardIds: [2],
            }),
            makeTokenRecord({
                token: 'other-profile',
                profile: otherProfile,
                track,
                source: DictionaryTokenSource.WANIKANI,
                status: null,
                lemmas: ['other-profile-lemma'],
                cardIds: [3],
            })
        );
        await seedWaniKaniSubjects(
            makeWaniKaniSubjectRecord({ subjectId: 1 }),
            makeWaniKaniSubjectRecord({ subjectId: 2, track: otherTrack }),
            makeWaniKaniSubjectRecord({ subjectId: 3, profile: otherProfile })
        );
        await seedWaniKaniAssignments(
            makeWaniKaniAssignmentRecord({ assignmentId: 1, subjectId: 1 }),
            makeWaniKaniAssignmentRecord({ assignmentId: 2, subjectId: 2, track: otherTrack }),
            makeWaniKaniAssignmentRecord({ assignmentId: 3, subjectId: 3, profile: otherProfile })
        );

        await (dictionaryDB as any)._deleteWaniKaniTokensForTracks(profile, [track], modifiedTokensByTrack);
        await (dictionaryDB as any)._deleteWaniKaniResourcesForTracks(profile, [track]);

        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('cached', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toBeUndefined();
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('anki', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toBeDefined();
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('other-track', DictionaryTokenSource.WANIKANI, otherTrack))
        ).resolves.toBeDefined();
        await expect(
            privateDb(dictionaryDB).tokens.get(
                tokenKey('other-profile', DictionaryTokenSource.WANIKANI, track, otherProfile)
            )
        ).resolves.toBeDefined();
        await expect(privateDb(dictionaryDB).waniKaniSubjects.get([1, track, profile])).resolves.toBeUndefined();
        await expect(privateDb(dictionaryDB).waniKaniAssignments.get([1, track, profile])).resolves.toBeUndefined();
        await expect(privateDb(dictionaryDB).waniKaniSubjects.get([2, otherTrack, profile])).resolves.toBeDefined();
        await expect(privateDb(dictionaryDB).waniKaniSubjects.get([3, track, otherProfile])).resolves.toBeDefined();
        expect(modifiedTokensByTrack).toEqual(new Map([[track, new Set(['cached', 'cached-lemma'])]]));
    });

    it('saves WaniKani token batches with subject, status, and state invariants', async () => {
        const key: [string, number] = [profile, track];
        const modifiedTokens = new Set<string>();
        const staleRecord = makeTokenRecord({
            token: 'stale',
            track,
            source: DictionaryTokenSource.WANIKANI,
            status: null,
            lemmas: ['stale-lemma'],
            cardIds: [1],
        });
        await (dictionaryDB as any)._ensureBuildId(key, 'build', { buildTs: 1000 });
        await seedTokens(staleRecord);

        await (dictionaryDB as any)._saveWaniKaniTokenBatchForDB(
            profile,
            track,
            [staleRecord],
            [
                makeTokenRecord({
                    token: 'valid',
                    track,
                    source: DictionaryTokenSource.WANIKANI,
                    status: TokenStatus.MATURE,
                    lemmas: ['valid-lemma'],
                    states: [TokenState.IGNORED],
                    cardIds: [2],
                }),
                makeTokenRecord({
                    token: 'empty',
                    track,
                    source: DictionaryTokenSource.WANIKANI,
                    status: TokenStatus.MATURE,
                    lemmas: ['empty-lemma'],
                    states: [TokenState.IGNORED],
                    cardIds: [],
                }),
            ],
            'build',
            [key],
            modifiedTokens
        );

        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('valid', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toMatchObject({
            status: null,
            states: [],
            cardIds: [2],
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('empty', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toBeUndefined();
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('stale', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toBeUndefined();
        expect(modifiedTokens).toEqual(
            new Set(['valid', 'valid-lemma', 'empty', 'empty-lemma', 'stale', 'stale-lemma'])
        );
    });

    it('returns without tokenization or progress when no WaniKani subjects are affected', async () => {
        const yomitan = makeYomitan();
        const statusUpdates = jest.fn();

        await expect(
            (dictionaryDB as any)._buildWaniKaniTokensForTrack(
                profile,
                track,
                makeWaniKaniTrackState({ affectedSubjectIds: new Set<number>(), yomitan }),
                'build',
                [[profile, track]],
                { current: 0, total: 0, startedAt: 1000 },
                new Set<string>(),
                statusUpdates
            )
        ).resolves.toEqual(new Set());

        expect(yomitan.tokenizeBulk).not.toHaveBeenCalled();
        expect(yomitan.tokenize).not.toHaveBeenCalled();
        expect(yomitan.resetCache).not.toHaveBeenCalled();
        expect(statusUpdates).not.toHaveBeenCalled();
    });

    it('builds WaniKani tokens in batches while preserving surviving subject IDs and deleting stale links', async () => {
        const key: [string, number] = [profile, track];
        const subjectIds = Array.from({ length: 101 }, (_, index) => index + 1);
        const lemmatize = jest.fn<(token: string) => Promise<string[]>>((token) =>
            Promise.resolve(token === 'word3' ? [] : [`${token}-lemma`])
        );
        const yomitan = makeYomitan({ lemmatize });
        const statusUpdates = jest.fn();
        const modifiedTokens = new Set<string>();

        await (dictionaryDB as any)._ensureBuildId(key, 'build', { buildTs: 1000 });
        await seedWaniKaniSubjects(
            ...subjectIds.map((subjectId) =>
                makeWaniKaniSubjectRecord({
                    subjectId,
                    data: {
                        characters: `word${subjectId}`,
                        hidden_at: subjectId === 4 ? '2024-03-01T00:00:00.000000Z' : null,
                        level: 1,
                        spaced_repetition_system_id: 1,
                    },
                })
            )
        );
        await seedTokens(
            makeTokenRecord({
                token: 'word1',
                track,
                source: DictionaryTokenSource.WANIKANI,
                status: TokenStatus.MATURE,
                lemmas: ['old-word1'],
                states: [TokenState.IGNORED],
                cardIds: [1, 200],
            }),
            makeTokenRecord({
                token: 'stale',
                track,
                source: DictionaryTokenSource.WANIKANI,
                status: null,
                lemmas: ['stale-lemma'],
                cardIds: [2],
            }),
            makeTokenRecord({
                token: 'other-profile-retain',
                profile: otherProfile,
                track,
                source: DictionaryTokenSource.WANIKANI,
                status: null,
                lemmas: ['other-profile-retain-lemma'],
                cardIds: [2],
            }),
            makeTokenRecord({
                token: 'other-track-retain',
                track: otherTrack,
                source: DictionaryTokenSource.WANIKANI,
                status: null,
                lemmas: ['other-track-retain-lemma'],
                cardIds: [2],
            }),
            makeTokenRecord({
                token: 'local-retain',
                track,
                source: DictionaryTokenSource.LOCAL,
                status: TokenStatus.UNKNOWN,
                lemmas: ['local-retain-lemma'],
                cardIds: [2],
            })
        );

        const importedTokens = await (dictionaryDB as any)._buildWaniKaniTokensForTrack(
            profile,
            track,
            makeWaniKaniTrackState({ affectedSubjectIds: new Set(subjectIds), yomitan }),
            'build',
            [key],
            { current: 0, total: subjectIds.length, startedAt: 1000 },
            modifiedTokens,
            statusUpdates
        );

        expect(yomitan.tokenizeBulk.mock.calls.map(([texts]) => texts.length)).toEqual([99, 1]);
        expect(yomitan.tokenize).toHaveBeenCalledTimes(100);
        expect(lemmatize).toHaveBeenCalledWith('word3');
        expect(yomitan.resetCache).toHaveBeenCalledTimes(2);
        expect(importedTokens.size).toBe(99);
        expect(importedTokens.has('word1')).toBe(true);
        expect(importedTokens.has('word3')).toBe(false);
        expect(importedTokens.has('word4')).toBe(false);
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('word1', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toMatchObject({
            status: null,
            states: [],
            lemmas: ['word1-lemma'],
            cardIds: [1, 200],
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('stale', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toBeUndefined();
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('word3', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toBeUndefined();
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('word4', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toBeUndefined();
        await expect(
            privateDb(dictionaryDB).tokens.get(
                tokenKey('other-profile-retain', DictionaryTokenSource.WANIKANI, track, otherProfile)
            )
        ).resolves.toMatchObject({
            cardIds: [2],
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(
                tokenKey('other-track-retain', DictionaryTokenSource.WANIKANI, otherTrack)
            )
        ).resolves.toMatchObject({
            cardIds: [2],
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('local-retain', DictionaryTokenSource.LOCAL, track))
        ).resolves.toMatchObject({
            cardIds: [2],
        });
        expect(statusUpdates.mock.calls.map(([state]) => (state as any).body.current)).toEqual([100, 101]);
        expect(Array.from(modifiedTokens)).toEqual(
            expect.arrayContaining(['word1', 'old-word1', 'word1-lemma', 'stale', 'stale-lemma'])
        );
    });

    it('processes WaniKani tracks, saves metadata, clears build IDs, and publishes final stats', async () => {
        const key: [string, number] = [profile, track];
        const statusUpdates = jest.fn();
        await (dictionaryDB as any)._ensureBuildId(key, 'build', { buildTs: 1000 });
        await seedWaniKaniSubjects(
            makeWaniKaniSubjectRecord({ data: { ...makeWaniKaniSubjectRecord().data, characters: 'alpha' } })
        );

        await (dictionaryDB as any)._processWaniKaniTracks(
            profile,
            'build',
            new Map([
                [
                    track,
                    makeWaniKaniTrackState({
                        affectedSubjectIds: new Set([1]),
                        settings: 'settings-v2',
                        dataUpdatedAt: { subjects: 'new-subjects' },
                        numFetchedSubjects: 1,
                    }),
                ],
            ]),
            [{ track, numFetchedSubjects: 1 }],
            new Map(),
            [key],
            1000,
            statusUpdates
        );

        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('alpha', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toMatchObject({
            lemmas: ['alpha-lemma'],
            cardIds: [1],
        });
        await expect(privateDb(dictionaryDB).meta.get(key)).resolves.toMatchObject({
            waniKaniMeta: {
                buildId: null,
                settings: 'settings-v2',
                dataUpdatedAt: { subjects: 'new-subjects' },
            },
        });
        expect(statusUpdates).toHaveBeenLastCalledWith({
            type: DictionaryBuildWaniKaniCacheStateType.stats,
            body: expect.objectContaining({
                track,
                numFetchedSubjects: 1,
                numImportedTokens: 1,
                modifiedTokens: expect.arrayContaining(['alpha', 'alpha-lemma']),
            }),
        });
    });

    it('builds WaniKani tokens and resolves statuses from subjects and assignments', async () => {
        const statusUpdates = jest.fn();
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryWaniKaniApiToken: 'wk-token',
        });
        mockWaniKaniOverrides.push({
            spacedRepetitionSystems: jest.fn(async () => collection([makeWaniKaniSpacedRepetitionSystem()])),
            assignments: jest.fn(async () => collection([makeWaniKaniAssignment()])),
            subjects: jest.fn(async () => collection([makeWaniKaniSubject()])),
        });

        useSettings([dictionaryTrack]);
        await dictionaryDB.buildWaniKaniCache(profile, statusUpdates);
        await waitForWaniKaniBuildToFinish();

        expect(mockWaniKaniInstances).toHaveLength(1);
        expect(mockWaniKaniInstances[0].apiToken).toBe('wk-token');
        expect(mockYomitanInstances[0].tokenizeBulk).toHaveBeenCalledWith(['単語']);
        await expect(dictionaryDB.getBulk(profile, track, ['単語'])).resolves.toMatchObject({
            単語: {
                source: DictionaryTokenSource.WANIKANI,
                statuses: [
                    {
                        status: TokenStatus.GRADUATED,
                        suspended: false,
                        waniKani: {
                            subjectId: 1,
                            subjectLevel: 3,
                            assignmentId: 1,
                            availableAt: '2024-02-01T00:00:00.000000Z',
                        },
                    },
                ],
                states: [],
            },
        });
        await expect(dictionaryDB.getRecords(profile, track)).resolves.toMatchObject({
            waniKaniSubjectRecords: { [track]: { 1: expect.objectContaining({ subjectId: 1 }) } },
            waniKaniAssignmentRecords: {
                [track]: { 1: expect.objectContaining({ assignmentId: 1, status: TokenStatus.GRADUATED }) },
            },
        });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildWaniKaniCacheStateType.stats,
            body: expect.objectContaining({
                track,
                numFetchedAssignments: 1,
                numFetchedSubjects: 1,
                numImportedTokens: 1,
                modifiedTokens: ['単語'],
            }),
        });
    });

    it('clears WaniKani cache records when an enabled track has no API token', async () => {
        const statusUpdates = jest.fn();
        await seedTokens(
            makeTokenRecord({
                token: 'cached',
                track,
                source: DictionaryTokenSource.WANIKANI,
                status: null,
                lemmas: ['cached-lemma'],
                cardIds: [1],
            })
        );
        await seedWaniKaniSubjects(makeWaniKaniSubjectRecord());
        await seedWaniKaniAssignments(makeWaniKaniAssignmentRecord());
        await privateDb(dictionaryDB).meta.put(
            makeMetaRecord({
                waniKaniMeta: {
                    lastBuildStartedAt: 1,
                    lastBuildExpiresAt: 2,
                    buildId: null,
                    settings: 'settings',
                    dataUpdatedAt: { assignments: 'old' },
                    spacedRepetitionSystems: [makeWaniKaniSpacedRepetitionSystem()],
                },
            })
        );

        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryWaniKaniApiToken: '' })]);
        await dictionaryDB.buildWaniKaniCache(profile, statusUpdates);

        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('cached', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toBeUndefined();
        await expect(privateDb(dictionaryDB).waniKaniSubjects.count()).resolves.toBe(0);
        await expect(privateDb(dictionaryDB).waniKaniAssignments.count()).resolves.toBe(0);
        await expect(privateDb(dictionaryDB).meta.get([profile, track])).resolves.toMatchObject({
            waniKaniMeta: { buildId: null, settings: null, dataUpdatedAt: {}, spacedRepetitionSystems: [] },
        });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildWaniKaniCacheStateType.stats,
            body: expect.objectContaining({
                track,
                isTokensCleared: true,
                modifiedTokens: expect.arrayContaining(['cached', 'cached-lemma']),
            }),
        });
    });

    it('uses incremental timestamps and removes stale WaniKani token links for hidden subjects', async () => {
        const statusUpdates = jest.fn();
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryWaniKaniApiToken: ' wk-token ',
        });
        await seedTokens(
            makeTokenRecord({
                token: 'stale',
                track,
                source: DictionaryTokenSource.WANIKANI,
                status: null,
                lemmas: ['stale-lemma'],
                cardIds: [1],
            })
        );
        await seedWaniKaniSubjects(makeWaniKaniSubjectRecord());
        await seedWaniKaniAssignments(makeWaniKaniAssignmentRecord());
        await privateDb(dictionaryDB).meta.put(
            makeMetaRecord({
                waniKaniMeta: {
                    lastBuildStartedAt: 0,
                    lastBuildExpiresAt: 0,
                    buildId: null,
                    settings: waniKaniSettingsString(dictionaryTrack),
                    dataUpdatedAt: {
                        resets: 'old-resets',
                        assignments: 'old-assignments',
                        subjects: 'old-subjects',
                        spacedRepetitionSystems: 'old-srs',
                    },
                    spacedRepetitionSystems: [makeWaniKaniSpacedRepetitionSystem()],
                },
            })
        );
        mockWaniKaniOverrides.push({
            resets: jest.fn(async () => emptyCollection('new-resets')),
            spacedRepetitionSystems: jest.fn(async () => emptyCollection('new-srs')),
            assignments: jest.fn(async () => emptyCollection('new-assignments')),
            subjects: jest.fn(async () =>
                collection([
                    makeWaniKaniSubject({
                        data: {
                            characters: 'stale',
                            level: 3,
                            hidden_at: '2024-02-01T00:00:00.000000Z',
                            spaced_repetition_system_id: 1,
                        },
                    }),
                ])
            ),
        });

        useSettings([dictionaryTrack]);
        await dictionaryDB.buildWaniKaniCache(profile, statusUpdates);
        await waitForWaniKaniBuildToFinish();

        expect(mockWaniKaniInstances[0].apiToken).toBe('wk-token');
        expect(mockWaniKaniInstances[0].resets).toHaveBeenCalledWith({ updatedAfter: 'old-resets' });
        expect(mockWaniKaniInstances[0].spacedRepetitionSystems).toHaveBeenCalledWith({ updatedAfter: 'old-srs' });
        expect(mockWaniKaniInstances[0].assignments).toHaveBeenCalledWith({
            subjectTypes: ['vocabulary', 'kana_vocabulary'],
            updatedAfter: 'old-assignments',
        });
        expect(mockWaniKaniInstances[0].subjects).toHaveBeenCalledWith({
            types: ['vocabulary', 'kana_vocabulary'],
            updatedAfter: 'old-subjects',
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('stale', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toBeUndefined();
        await expect(privateDb(dictionaryDB).meta.get([profile, track])).resolves.toMatchObject({
            waniKaniMeta: {
                settings: waniKaniSettingsString(dictionaryTrack),
                dataUpdatedAt: {
                    resets: 'new-resets',
                    assignments: 'new-assignments',
                    subjects: '2024-01-01T00:00:00.000000Z',
                    spacedRepetitionSystems: 'new-srs',
                },
            },
        });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildWaniKaniCacheStateType.stats,
            body: expect.objectContaining({
                track,
                numImportedTokens: 0,
                modifiedTokens: expect.arrayContaining(['stale', 'stale-lemma']),
            }),
        });
    });

    it('forces a full WaniKani resource rebuild after account resets', async () => {
        const statusUpdates = jest.fn();
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryWaniKaniApiToken: 'wk-token',
        });
        await seedTokens(
            makeTokenRecord({
                token: 'cached',
                track,
                source: DictionaryTokenSource.WANIKANI,
                status: null,
                lemmas: ['cached-lemma'],
                cardIds: [1],
            })
        );
        await seedWaniKaniSubjects(makeWaniKaniSubjectRecord());
        await seedWaniKaniAssignments(makeWaniKaniAssignmentRecord());
        await privateDb(dictionaryDB).meta.put(
            makeMetaRecord({
                waniKaniMeta: {
                    lastBuildStartedAt: 0,
                    lastBuildExpiresAt: 0,
                    buildId: null,
                    settings: waniKaniSettingsString(dictionaryTrack),
                    dataUpdatedAt: {
                        resets: 'old-resets',
                        assignments: 'old-assignments',
                        subjects: 'old-subjects',
                        spacedRepetitionSystems: 'old-srs',
                    },
                    spacedRepetitionSystems: [makeWaniKaniSpacedRepetitionSystem()],
                },
            })
        );
        mockWaniKaniOverrides.push({
            resets: jest.fn(async () => ({
                data: [
                    {
                        id: 1,
                        object: 'reset',
                        url: 'https://api.wanikani.com/v2/resets/1',
                        data_updated_at: '2024-01-02T00:00:00.000000Z',
                        data: {
                            created_at: '2024-01-02T00:00:00.000000Z',
                            confirmed_at: null,
                            original_level: 10,
                            target_level: 1,
                        },
                    },
                ],
                dataUpdatedAt: 'new-resets',
                totalCount: 1,
            })),
            spacedRepetitionSystems: jest.fn(async () => collection([makeWaniKaniSpacedRepetitionSystem()])),
            assignments: jest.fn(async () => emptyCollection('new-assignments')),
            subjects: jest.fn(async () => emptyCollection('new-subjects')),
        });

        useSettings([dictionaryTrack]);
        await dictionaryDB.buildWaniKaniCache(profile, statusUpdates);
        await waitForWaniKaniBuildToFinish();

        expect(mockWaniKaniInstances[0].spacedRepetitionSystems).toHaveBeenCalledWith({ updatedAfter: undefined });
        expect(mockWaniKaniInstances[0].assignments).toHaveBeenCalledWith({
            subjectTypes: ['vocabulary', 'kana_vocabulary'],
            updatedAfter: undefined,
        });
        expect(mockWaniKaniInstances[0].subjects).toHaveBeenCalledWith({
            types: ['vocabulary', 'kana_vocabulary'],
            updatedAfter: undefined,
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('cached', DictionaryTokenSource.WANIKANI, track))
        ).resolves.toBeUndefined();
        await expect(privateDb(dictionaryDB).waniKaniSubjects.count()).resolves.toBe(0);
        await expect(privateDb(dictionaryDB).waniKaniAssignments.count()).resolves.toBe(0);
        await expect(privateDb(dictionaryDB).meta.get([profile, track])).resolves.toMatchObject({
            waniKaniMeta: {
                dataUpdatedAt: {
                    resets: 'new-resets',
                    assignments: 'new-assignments',
                    subjects: 'new-subjects',
                    spacedRepetitionSystems: '2024-01-01T00:00:00.000000Z',
                },
            },
        });
    });

    it('reports invalid WaniKani tokens and clears active build IDs', async () => {
        const statusUpdates = jest.fn();
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockWaniKaniOverrides.push({
            resets: jest.fn(async () => {
                throw new WaniKaniApiError(401, 'Unauthorized');
            }),
        });

        useSettings([
            makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryWaniKaniApiToken: 'bad-token' }),
        ]);
        await dictionaryDB.buildWaniKaniCache(profile, statusUpdates);

        expect(consoleError).toHaveBeenCalled();
        await expect(privateDb(dictionaryDB).meta.get([profile, track])).resolves.toMatchObject({
            waniKaniMeta: { buildId: null },
        });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildWaniKaniCacheStateType.error,
            body: expect.objectContaining({
                code: DictionaryBuildWaniKaniCacheStateErrorCode.invalidWaniKaniToken,
                msg: 'Unauthorized',
                track,
            }),
        });
    });

    it('prefers better-known WaniKani word records over lower-status Anki word records', async () => {
        await seedTokens(
            makeTokenRecord({
                token: 'shared',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['shared'],
                cardIds: [10],
            }),
            makeTokenRecord({
                token: 'shared',
                track,
                source: DictionaryTokenSource.WANIKANI,
                status: null,
                lemmas: ['shared'],
                cardIds: [1],
            }),
            makeTokenRecord({
                token: 'other-profile',
                profile: otherProfile,
                track,
                source: DictionaryTokenSource.WANIKANI,
                status: null,
                lemmas: ['other-profile'],
                cardIds: [2],
            })
        );
        await seedAnkiCards(makeAnkiCardRecord({ cardId: 10, status: TokenStatus.UNKNOWN }));
        await seedWaniKaniSubjects(makeWaniKaniSubjectRecord());
        await seedWaniKaniAssignments(
            makeWaniKaniAssignmentRecord({ data: { srs_stage: 9, hidden: false, available_at: null } })
        );
        await privateDb(dictionaryDB).meta.put(
            makeMetaRecord({
                waniKaniMeta: {
                    lastBuildStartedAt: 0,
                    lastBuildExpiresAt: 0,
                    buildId: null,
                    settings: null,
                    dataUpdatedAt: {},
                    spacedRepetitionSystems: [makeWaniKaniSpacedRepetitionSystem()],
                },
            })
        );

        await expect(dictionaryDB.getBulk(profile, track, ['shared', 'other-profile'])).resolves.toMatchObject({
            shared: {
                source: DictionaryTokenSource.WANIKANI,
                statuses: [
                    {
                        status: TokenStatus.MATURE,
                        suspended: false,
                        waniKani: expect.objectContaining({ subjectId: 1, assignmentId: 1 }),
                    },
                ],
                externalCandidateStatuses: expect.arrayContaining([
                    { cardId: 10, status: TokenStatus.UNKNOWN, suspended: false },
                    expect.objectContaining({ status: TokenStatus.MATURE }),
                ]),
                states: [],
            },
        });
    });
});
