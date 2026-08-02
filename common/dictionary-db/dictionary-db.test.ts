import 'core-js/stable/structured-clone';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
    ApplyStrategy,
    AsbplayerSettings,
    DictionaryTokenSource,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import {
    DictionaryDB,
    DictionaryTokenRecord,
    LOCAL_TOKEN_TRACK,
    _gatherModifiedTokens,
    _getFromSourceBulk,
    _saveRecordBulk,
} from './dictionary-db';
import {
    makeAnkiCardRecord,
    makeDictionaryTrack,
    makeMetaRecord,
    makeSettings,
    makeTokenRecord,
    otherProfile,
    otherTrack,
    privateDb,
    profile,
    tokenKey,
    track,
} from './dictionary-db-test-utils';

describe('DictionaryDB', () => {
    let dictionaryDB: DictionaryDB;
    let settings: AsbplayerSettings;

    beforeEach(async () => {
        await Dexie.delete('DictionaryDatabase');
        settings = makeSettings([makeDictionaryTrack()]);
        dictionaryDB = new DictionaryDB({
            getAll: jest.fn(async () => settings),
            getSingle: jest.fn(async (key: keyof AsbplayerSettings) => settings[key]),
        } as any);
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

    const allTokenRecords = async () => privateDb(dictionaryDB).tokens.toArray() as Promise<DictionaryTokenRecord[]>;

    it('normalizes undefined profiles to Default and keeps explicit profile values unchanged', () => {
        expect((dictionaryDB as any)._getProfile(undefined)).toBe('Default');
        expect((dictionaryDB as any)._getProfile(profile)).toBe(profile);
        expect((dictionaryDB as any)._getProfile('')).toBe('');
    });

    it('maps card statuses by unique card ID while respecting profile and track boundaries', async () => {
        await seedAnkiCards(
            makeAnkiCardRecord({ cardId: 1, status: TokenStatus.UNKNOWN }),
            makeAnkiCardRecord({ cardId: 2, status: TokenStatus.MATURE, suspended: true }),
            makeAnkiCardRecord({ cardId: 3, track: otherTrack, status: TokenStatus.GRADUATED }),
            makeAnkiCardRecord({ cardId: 4, profile: otherProfile, status: TokenStatus.YOUNG })
        );

        await expect((dictionaryDB as any)._cardStatusMap(profile, track, [])).resolves.toEqual(new Map());
        await expect((dictionaryDB as any)._cardStatusMap(profile, track, [1, 1, 2, 3, 4])).resolves.toEqual(
            new Map([
                [1, { cardId: 1, status: TokenStatus.UNKNOWN, suspended: false }],
                [2, { cardId: 2, status: TokenStatus.MATURE, suspended: true }],
            ])
        );
    });

    it('maps statuses only from the record source', () => {
        const ankiStatus = { cardId: 1, status: TokenStatus.MATURE, suspended: false };
        const waniKaniStatus = {
            waniKani: { subjectId: 1, subjectLevel: 2 },
            status: TokenStatus.YOUNG,
            suspended: false,
        };
        const cardStatusMap = new Map([[1, ankiStatus]]);
        const waniKaniSubjectStatusMap = new Map([[1, waniKaniStatus]]);

        expect(
            (dictionaryDB as any)._statusesFromRecord(
                makeTokenRecord({ source: DictionaryTokenSource.ANKI_WORD, cardIds: [1] }),
                cardStatusMap,
                waniKaniSubjectStatusMap
            )
        ).toEqual([ankiStatus]);
        expect(
            (dictionaryDB as any)._statusesFromRecord(
                makeTokenRecord({ source: DictionaryTokenSource.WANIKANI, cardIds: [1] }),
                cardStatusMap,
                waniKaniSubjectStatusMap
            )
        ).toEqual([waniKaniStatus]);
        expect(
            (dictionaryDB as any)._statusesFromRecord(
                makeTokenRecord({ source: DictionaryTokenSource.LOCAL, cardIds: [1] }),
                cardStatusMap,
                waniKaniSubjectStatusMap
            )
        ).toEqual([]);
    });

    it('converts token records to prioritized token results with ordered card statuses', async () => {
        await seedAnkiCards(
            makeAnkiCardRecord({ cardId: 1, status: TokenStatus.UNKNOWN }),
            makeAnkiCardRecord({ cardId: 2, status: TokenStatus.MATURE, suspended: true }),
            makeAnkiCardRecord({ cardId: 3, status: TokenStatus.GRADUATED })
        );

        await expect((dictionaryDB as any)._tokenResultsFromRecords(profile, track, [], settings)).resolves.toEqual({});
        const results = await (dictionaryDB as any)._tokenResultsFromRecords(
            profile,
            track,
            [
                makeTokenRecord({ token: 'local', status: TokenStatus.LEARNING, states: [TokenState.IGNORED] }),
                makeTokenRecord({
                    token: 'local',
                    track,
                    source: DictionaryTokenSource.ANKI_WORD,
                    status: null,
                    cardIds: [1],
                }),
                makeTokenRecord({
                    token: 'word',
                    track,
                    source: DictionaryTokenSource.ANKI_SENTENCE,
                    status: null,
                    lemmas: ['word'],
                    cardIds: [3],
                }),
                makeTokenRecord({
                    token: 'word',
                    track,
                    source: DictionaryTokenSource.ANKI_WORD,
                    status: null,
                    lemmas: ['word'],
                    cardIds: [2, 1],
                }),
                makeTokenRecord({
                    token: 'sentence',
                    track,
                    source: DictionaryTokenSource.ANKI_SENTENCE,
                    status: null,
                    lemmas: ['sentence'],
                    cardIds: [],
                }),
            ],
            settings
        );
        expect(results).toMatchObject({
            local: {
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.LEARNING, suspended: false }],
                states: [TokenState.IGNORED],
            },
            word: {
                source: DictionaryTokenSource.ANKI_WORD,
                statuses: [
                    { cardId: 2, status: TokenStatus.MATURE, suspended: true },
                    { cardId: 1, status: TokenStatus.UNKNOWN, suspended: false },
                ],
                states: [],
            },
            sentence: {
                source: DictionaryTokenSource.ANKI_SENTENCE,
                statuses: [],
                states: [],
            },
        });
        expect(results.local.externalCandidateStatuses).toEqual([
            { cardId: 1, status: TokenStatus.UNKNOWN, suspended: false },
        ]);
        expect(results.word.externalCandidateStatuses).toEqual([
            { cardId: 3, status: TokenStatus.GRADUATED, suspended: false },
            { cardId: 2, status: TokenStatus.MATURE, suspended: true },
            { cardId: 1, status: TokenStatus.UNKNOWN, suspended: false },
        ]);
    });

    it('returns empty results for empty bulk operations', async () => {
        const profiles = [profile];

        await expect(dictionaryDB.getBulk(profile, track, [])).resolves.toEqual({});
        await expect(dictionaryDB.getByLemmaBulk(profile, track, [])).resolves.toEqual({});
        await expect(dictionaryDB.saveRecordLocalBulk(profile, [], ApplyStrategy.ADD)).resolves.toEqual({
            savedTokens: [],
            deletedTokens: [],
        });
        await expect(dictionaryDB.deleteRecordLocalBulk(profile, [])).resolves.toEqual({ deletedTokens: [] });
        await expect(dictionaryDB.importRecordLocalBulk([], profiles)).resolves.toEqual({ importedTokens: [] });
        await expect(dictionaryDB.updateRecords(profile, [], ApplyStrategy.ADD)).resolves.toEqual({
            savedTokens: [],
            deletedTokens: [],
        });
        await expect(dictionaryDB.deleteRecords(profile, [])).resolves.toEqual({ deletedTokens: [] });
        await expect(dictionaryDB.getRecords(profile, track)).resolves.toEqual({
            tokenRecords: [],
            ankiCardRecords: {},
            waniKaniSubjectRecords: {},
            waniKaniAssignmentRecords: {},
        });
        expect(profiles).toEqual([profile]);
    });

    it('saves one and two local token inputs while filtering invalid data', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        const singleResult = await dictionaryDB.saveRecordLocalBulk(
            undefined,
            [{ token: 'alpha', status: TokenStatus.LEARNING, lemmas: ['alpha', '123'], states: [] }],
            ApplyStrategy.ADD
        );
        expect(singleResult).toEqual({
            savedTokens: [tokenKey('alpha', DictionaryTokenSource.LOCAL, LOCAL_TOKEN_TRACK, 'Default')],
            deletedTokens: [],
        });

        const twoItemResult = await dictionaryDB.saveRecordLocalBulk(
            profile,
            [
                { token: 'beta', status: TokenStatus.UNKNOWN, lemmas: ['beta'], states: [] },
                { token: '123', status: TokenStatus.UNKNOWN, lemmas: ['123'], states: [] },
            ],
            ApplyStrategy.ADD
        );
        expect(twoItemResult).toEqual({ savedTokens: [tokenKey('beta')], deletedTokens: [] });
        expect(consoleError).toHaveBeenCalledTimes(1);

        await expect(dictionaryDB.getBulk(undefined, track, ['alpha'])).resolves.toMatchObject({
            alpha: {
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.LEARNING, suspended: false }],
                states: [],
            },
        });
        await expect(dictionaryDB.getBulk(profile, track, ['beta'])).resolves.toMatchObject({
            beta: {
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.UNKNOWN, suspended: false }],
                states: [],
            },
        });
        expect((await allTokenRecords()).find((record) => record.token === 'alpha')?.lemmas).toEqual(['alpha']);
    });

    it('applies state strategies and deletes local tokens that become uncollected with no states', async () => {
        const ignored = TokenState.IGNORED;
        const customState = 2 as TokenState;
        const anotherState = 1 as TokenState;

        await seedTokens(
            makeTokenRecord({ token: 'alpha', states: [customState, ignored], status: TokenStatus.UNKNOWN }),
            makeTokenRecord({ token: 'beta', states: [ignored], status: TokenStatus.UNKNOWN }),
            makeTokenRecord({ token: 'gamma', states: [ignored], status: TokenStatus.UNKNOWN }),
            makeTokenRecord({ token: 'delta', states: [ignored], status: TokenStatus.UNKNOWN })
        );

        await dictionaryDB.saveRecordLocalBulk(
            profile,
            [{ token: 'alpha', status: null, lemmas: ['alpha'], states: [anotherState, customState] }],
            ApplyStrategy.ADD
        );
        await dictionaryDB.saveRecordLocalBulk(
            profile,
            [{ token: 'beta', status: TokenStatus.UNKNOWN, lemmas: ['beta'], states: [ignored] }],
            ApplyStrategy.REMOVE
        );
        await dictionaryDB.saveRecordLocalBulk(
            profile,
            [{ token: 'gamma', status: TokenStatus.UNKNOWN, lemmas: ['gamma'], states: [customState, anotherState] }],
            ApplyStrategy.REPLACE
        );
        await dictionaryDB.saveRecordLocalBulk(
            profile,
            [{ token: 'delta', status: TokenStatus.UNKNOWN, lemmas: ['delta'], states: [ignored, customState] }],
            ApplyStrategy.TOGGLE
        );

        await expect(dictionaryDB.getBulk(profile, track, ['alpha', 'beta', 'gamma', 'delta'])).resolves.toMatchObject({
            alpha: {
                statuses: [{ status: TokenStatus.UNKNOWN, suspended: false }],
                states: [ignored, anotherState, customState],
            },
            beta: { states: [] },
            gamma: { states: [anotherState, customState] },
            delta: { states: [customState] },
        });

        await expect(
            dictionaryDB.saveRecordLocalBulk(
                profile,
                [{ token: 'beta', status: TokenStatus.UNCOLLECTED, lemmas: ['beta'], states: [] }],
                ApplyStrategy.REPLACE
            )
        ).resolves.toEqual({ savedTokens: [], deletedTokens: [tokenKey('beta')] });
        await expect(dictionaryDB.getBulk(profile, track, ['beta'])).resolves.toEqual({});
    });

    it('rejects unsupported apply strategies without modifying records', async () => {
        await seedTokens(makeTokenRecord({ token: 'alpha', states: [TokenState.IGNORED] }));

        await expect(
            dictionaryDB.updateRecords(
                profile,
                [{ tokenKey: tokenKey('alpha'), status: TokenStatus.MATURE, states: [] }],
                'UNKNOWN' as ApplyStrategy
            )
        ).rejects.toThrow('Unsupported applyStates value: "UNKNOWN"');
        await expect(dictionaryDB.getBulk(profile, track, ['alpha'])).resolves.toMatchObject({
            alpha: { statuses: [{ status: TokenStatus.UNKNOWN, suspended: false }], states: [TokenState.IGNORED] },
        });
    });

    it('does not persist local records that violate token, lemma, or uncollected state invariants', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(
            dictionaryDB.saveRecordLocalBulk(
                profile,
                [
                    { token: '123', status: TokenStatus.UNKNOWN, lemmas: ['alpha'], states: [] },
                    { token: 'alpha', status: TokenStatus.UNKNOWN, lemmas: ['123'], states: [] },
                    { token: 'beta', status: TokenStatus.UNCOLLECTED, lemmas: ['beta'], states: [] },
                ],
                ApplyStrategy.ADD
            )
        ).resolves.toEqual({ savedTokens: [], deletedTokens: [] });
        expect(consoleError).toHaveBeenCalledTimes(3);
        await expect(allTokenRecords()).resolves.toEqual([]);
    });

    it('keeps persisted local records trackless with no card IDs and sorted states', async () => {
        const customState = 2 as TokenState;
        const anotherState = 1 as TokenState;

        await dictionaryDB.saveRecordLocalBulk(
            profile,
            [{ token: 'alpha', status: TokenStatus.UNKNOWN, lemmas: ['alpha'], states: [customState, anotherState] }],
            ApplyStrategy.REPLACE
        );

        await expect(allTokenRecords()).resolves.toEqual([
            makeTokenRecord({
                token: 'alpha',
                track: LOCAL_TOKEN_TRACK,
                source: DictionaryTokenSource.LOCAL,
                cardIds: [],
                states: [anotherState, customState],
            }),
        ]);
    });

    it('fetches and saves token records through source helpers', async () => {
        const localRecord = makeTokenRecord({ token: 'alpha' });
        const ankiRecord = makeTokenRecord({
            token: 'alpha',
            track,
            source: DictionaryTokenSource.ANKI_WORD,
            status: null,
            cardIds: [1],
        });
        const secondRecord = makeTokenRecord({ token: 'beta' });

        await expect(_saveRecordBulk(privateDb(dictionaryDB), [])).resolves.toEqual([]);
        await expect(
            _getFromSourceBulk(privateDb(dictionaryDB), profile, LOCAL_TOKEN_TRACK, DictionaryTokenSource.LOCAL, [])
        ).resolves.toEqual(new Map());
        await expect(
            _saveRecordBulk(privateDb(dictionaryDB), [localRecord, ankiRecord, secondRecord])
        ).resolves.toEqual([
            tokenKey('alpha'),
            tokenKey('alpha', DictionaryTokenSource.ANKI_WORD, track),
            tokenKey('beta'),
        ]);
        await expect(
            _getFromSourceBulk(privateDb(dictionaryDB), profile, LOCAL_TOKEN_TRACK, DictionaryTokenSource.LOCAL, [
                'alpha',
                'beta',
            ])
        ).resolves.toEqual(
            new Map([
                ['alpha', localRecord],
                ['beta', secondRecord],
            ])
        );
    });

    it('gathers modified tokens through lemma relationships within the same profile', async () => {
        const modifiedTokens = new Set(['alpha']);
        await seedTokens(
            makeTokenRecord({ token: 'related', lemmas: ['alpha', 'related-lemma'] }),
            makeTokenRecord({ token: 'other-profile-related', profile: otherProfile, lemmas: ['alpha'] })
        );

        await _gatherModifiedTokens(privateDb(dictionaryDB), profile, modifiedTokens);

        expect(modifiedTokens).toEqual(new Set(['alpha', 'related', 'related-lemma']));
    });

    it('prioritizes local, Anki word, then Anki sentence records for token lookups', async () => {
        await seedTokens(
            makeTokenRecord({ token: 'alpha', status: TokenStatus.LEARNING, states: [TokenState.IGNORED] }),
            makeTokenRecord({
                token: 'alpha',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                cardIds: [1],
            }),
            makeTokenRecord({
                token: 'beta',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['beta'],
                cardIds: [1, 2],
            }),
            makeTokenRecord({
                token: 'beta',
                track,
                source: DictionaryTokenSource.ANKI_SENTENCE,
                status: null,
                lemmas: ['beta'],
                cardIds: [3],
            }),
            makeTokenRecord({
                token: 'gamma',
                track,
                source: DictionaryTokenSource.ANKI_SENTENCE,
                status: null,
                lemmas: ['gamma'],
                cardIds: [3],
            }),
            makeTokenRecord({ token: 'wrong-track', track: otherTrack, source: DictionaryTokenSource.ANKI_WORD }),
            makeTokenRecord({ token: 'wrong-profile', profile: otherProfile })
        );
        await seedAnkiCards(
            makeAnkiCardRecord({ cardId: 1, status: TokenStatus.UNKNOWN }),
            makeAnkiCardRecord({ cardId: 2, status: TokenStatus.MATURE, suspended: true }),
            makeAnkiCardRecord({ cardId: 3, status: TokenStatus.GRADUATED })
        );

        await expect(
            dictionaryDB.getBulk(profile, track, ['alpha', 'beta', 'gamma', 'wrong-track', 'wrong-profile'])
        ).resolves.toMatchObject({
            alpha: {
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.LEARNING, suspended: false }],
                states: [TokenState.IGNORED],
            },
            beta: {
                source: DictionaryTokenSource.ANKI_WORD,
                statuses: [
                    { cardId: 1, status: TokenStatus.UNKNOWN, suspended: false },
                    { cardId: 2, status: TokenStatus.MATURE, suspended: true },
                ],
                states: [],
            },
            gamma: {
                source: DictionaryTokenSource.ANKI_SENTENCE,
                statuses: [{ cardId: 3, status: TokenStatus.GRADUATED, suspended: false }],
                states: [],
            },
        });
    });

    it('looks up tokens and lemmas case-insensitively while returning records under their stored keys', async () => {
        await seedTokens(
            makeTokenRecord({ token: 'Alpha', status: TokenStatus.LEARNING, lemmas: ['AlphaLemma'] }),
            makeTokenRecord({
                token: 'Beta',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['BetaLemma'],
                cardIds: [1],
            })
        );
        await seedAnkiCards(makeAnkiCardRecord({ cardId: 1, status: TokenStatus.MATURE }));

        await expect(dictionaryDB.getBulk(profile, track, ['alpha', 'beta'])).resolves.toMatchObject({
            Alpha: {
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.LEARNING, suspended: false }],
                states: [],
            },
            Beta: {
                source: DictionaryTokenSource.ANKI_WORD,
                statuses: [{ cardId: 1, status: TokenStatus.MATURE, suspended: false }],
                states: [],
            },
        });

        await expect(dictionaryDB.getByLemmaBulk(profile, track, ['alphalemma', 'betalemma'])).resolves.toMatchObject({
            AlphaLemma: [
                expect.objectContaining({
                    token: 'Alpha',
                    source: DictionaryTokenSource.LOCAL,
                    statuses: [{ status: TokenStatus.LEARNING, suspended: false }],
                }),
            ],
            BetaLemma: [
                expect.objectContaining({
                    token: 'Beta',
                    source: DictionaryTokenSource.ANKI_WORD,
                    statuses: [{ cardId: 1, status: TokenStatus.MATURE, suspended: false }],
                }),
            ],
        });
    });

    it('returns all tokens for a profile and track with local tokens included across tracks', async () => {
        await seedTokens(
            makeTokenRecord({ token: 'local', status: TokenStatus.UNKNOWN }),
            makeTokenRecord({
                token: 'anki',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['anki'],
                cardIds: [1],
            }),
            makeTokenRecord({
                token: 'other-track',
                track: otherTrack,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['other-track'],
                cardIds: [2],
            })
        );
        await seedAnkiCards(makeAnkiCardRecord({ cardId: 1, status: TokenStatus.YOUNG }));

        await expect(dictionaryDB.getAllTokens(profile, track)).resolves.toMatchObject({
            local: {
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.UNKNOWN, suspended: false }],
                states: [],
            },
            anki: {
                source: DictionaryTokenSource.ANKI_WORD,
                statuses: [{ cardId: 1, status: TokenStatus.YOUNG, suspended: false }],
                states: [],
            },
        });
    });

    it('prioritizes sources and handles multiple results for lemma lookups', async () => {
        await seedTokens(
            makeTokenRecord({ token: 'local-token', status: TokenStatus.LEARNING, lemmas: ['shared'] }),
            makeTokenRecord({
                token: 'word-token',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['word-lemma', 'multi'],
                cardIds: [1],
            }),
            makeTokenRecord({
                token: 'word-token-2',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['multi'],
                cardIds: [2],
            }),
            makeTokenRecord({
                token: 'sentence-token',
                track,
                source: DictionaryTokenSource.ANKI_SENTENCE,
                status: null,
                lemmas: ['sentence-lemma', 'word-lemma'],
                cardIds: [3],
            }),
            makeTokenRecord({
                token: 'wrong-track',
                track: otherTrack,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['word-lemma'],
                cardIds: [4],
            })
        );
        await seedAnkiCards(
            makeAnkiCardRecord({ cardId: 1, status: TokenStatus.UNKNOWN }),
            makeAnkiCardRecord({ cardId: 2, status: TokenStatus.MATURE }),
            makeAnkiCardRecord({ cardId: 3, status: TokenStatus.GRADUATED })
        );

        const results = await dictionaryDB.getByLemmaBulk(profile, track, [
            'shared',
            'word-lemma',
            'sentence-lemma',
            'multi',
        ]);
        expect(results.shared).toEqual([
            expect.objectContaining({
                token: 'local-token',
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.LEARNING, suspended: false }],
                states: [],
            }),
        ]);
        expect(results['word-lemma']).toEqual([
            expect.objectContaining({
                token: 'word-token',
                source: DictionaryTokenSource.ANKI_WORD,
                statuses: [{ cardId: 1, status: TokenStatus.UNKNOWN, suspended: false }],
                states: [],
            }),
        ]);
        expect(results['sentence-lemma']).toEqual([
            expect.objectContaining({
                token: 'sentence-token',
                source: DictionaryTokenSource.ANKI_SENTENCE,
                statuses: [{ cardId: 3, status: TokenStatus.GRADUATED, suspended: false }],
                states: [],
            }),
        ]);
        expect(results.multi).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    token: 'word-token',
                    source: DictionaryTokenSource.ANKI_WORD,
                    statuses: [{ cardId: 1, status: TokenStatus.UNKNOWN, suspended: false }],
                    states: [],
                }),
                expect.objectContaining({
                    token: 'word-token-2',
                    source: DictionaryTokenSource.ANKI_WORD,
                    statuses: [{ cardId: 2, status: TokenStatus.MATURE, suspended: false }],
                    states: [],
                }),
            ])
        );
        expect(results.multi).toHaveLength(2);
    });

    it('imports local records with profile, status, lemma, and existing-record invariants', async () => {
        const customState = 2 as TokenState;

        await seedTokens(
            makeTokenRecord({
                token: 'existing',
                status: TokenStatus.GRADUATED,
                lemmas: ['existing-lemma'],
                states: [TokenState.IGNORED],
            })
        );

        const result = await dictionaryDB.importRecordLocalBulk(
            [
                { profile, token: 'alpha', status: TokenStatus.UNKNOWN, lemmas: ['alpha', '123'], states: [] },
                { profile: 'Default', token: 'beta', status: TokenStatus.MATURE + 1, lemmas: ['beta'], states: [] },
                {
                    profile,
                    token: 'state-only',
                    status: TokenStatus.UNCOLLECTED,
                    lemmas: ['state-only'],
                    states: [TokenState.IGNORED],
                },
                {
                    profile,
                    token: 'multi-state',
                    status: TokenStatus.UNCOLLECTED,
                    lemmas: ['multi-state'],
                    states: [customState, TokenState.IGNORED],
                },
                { profile, token: 'existing', status: TokenStatus.UNKNOWN, lemmas: [], states: [] },
                { profile, token: 'no-state', status: TokenStatus.UNCOLLECTED, lemmas: ['no-state'], states: [] },
                {
                    profile: otherProfile,
                    token: 'wrong-profile',
                    status: TokenStatus.UNKNOWN,
                    lemmas: ['wrong-profile'],
                },
                { profile, token: '123', status: TokenStatus.UNKNOWN, lemmas: ['alpha'] },
            ],
            [profile]
        );

        expect(result.importedTokens).toEqual([
            tokenKey('alpha'),
            tokenKey('beta', DictionaryTokenSource.LOCAL, LOCAL_TOKEN_TRACK, 'Default'),
            tokenKey('state-only'),
            tokenKey('multi-state'),
            tokenKey('existing'),
        ]);
        await expect(
            dictionaryDB.getBulk(profile, track, ['alpha', 'state-only', 'multi-state', 'existing', 'no-state'])
        ).resolves.toMatchObject({
            alpha: {
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.UNKNOWN, suspended: false }],
                states: [],
            },
            'state-only': {
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.UNCOLLECTED, suspended: false }],
                states: [TokenState.IGNORED],
            },
            'multi-state': {
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.UNCOLLECTED, suspended: false }],
                states: [TokenState.IGNORED, customState],
            },
            existing: {
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.GRADUATED, suspended: false }],
                states: [TokenState.IGNORED],
            },
        });
        await expect(dictionaryDB.getBulk(undefined, track, ['beta'])).resolves.toMatchObject({
            beta: {
                source: DictionaryTokenSource.LOCAL,
                statuses: [{ status: TokenStatus.MATURE, suspended: false }],
                states: [],
            },
        });
        expect((await allTokenRecords()).find((record) => record.token === 'alpha')?.lemmas).toEqual(['alpha']);
    });

    it('exports only local records and omits empty optional arrays', async () => {
        await seedTokens(
            makeTokenRecord({ token: 'alpha', states: [TokenState.IGNORED] }),
            makeTokenRecord({ token: 'beta', lemmas: [], states: [] }),
            makeTokenRecord({
                token: 'anki',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['anki'],
                cardIds: [1],
            })
        );

        await expect(dictionaryDB.exportRecordLocalBulk()).resolves.toEqual({
            exportedRecords: [
                {
                    profile,
                    token: 'alpha',
                    status: TokenStatus.UNKNOWN,
                    lemmas: ['alpha'],
                    states: [TokenState.IGNORED],
                },
                { profile, token: 'beta', status: TokenStatus.UNKNOWN, lemmas: undefined, states: undefined },
            ],
        });
    });

    it('updates and deletes only matching local records', async () => {
        const customState = 2 as TokenState;
        await seedTokens(
            makeTokenRecord({ token: 'alpha', states: [TokenState.IGNORED] }),
            makeTokenRecord({ token: 'beta', states: [] }),
            makeTokenRecord({ token: 'other-profile', profile: otherProfile }),
            makeTokenRecord({
                token: 'anki',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['anki'],
                cardIds: [1],
            })
        );

        await expect(
            dictionaryDB.updateRecords(
                profile,
                [
                    { tokenKey: tokenKey('alpha'), status: TokenStatus.MATURE, states: [customState] },
                    { tokenKey: tokenKey('beta'), status: TokenStatus.UNCOLLECTED, states: [] },
                    {
                        tokenKey: tokenKey(
                            'other-profile',
                            DictionaryTokenSource.LOCAL,
                            LOCAL_TOKEN_TRACK,
                            otherProfile
                        ),
                        status: TokenStatus.MATURE,
                        states: [],
                    },
                    {
                        tokenKey: tokenKey('anki', DictionaryTokenSource.ANKI_WORD, track),
                        status: TokenStatus.MATURE,
                        states: [],
                    },
                    { tokenKey: tokenKey('missing'), status: TokenStatus.MATURE, states: [] },
                ],
                ApplyStrategy.ADD
            )
        ).resolves.toEqual({ savedTokens: [tokenKey('alpha')], deletedTokens: [tokenKey('beta')] });

        await expect(
            dictionaryDB.getBulk(profile, track, ['alpha', 'beta', 'other-profile', 'anki'])
        ).resolves.toMatchObject({
            alpha: {
                statuses: [{ status: TokenStatus.MATURE, suspended: false }],
                states: [TokenState.IGNORED, customState],
            },
            anki: { source: DictionaryTokenSource.ANKI_WORD },
        });

        await expect(
            dictionaryDB.deleteRecords(profile, [
                tokenKey('alpha'),
                tokenKey('anki', DictionaryTokenSource.ANKI_WORD, track),
            ])
        ).resolves.toEqual({
            deletedTokens: [tokenKey('alpha')],
        });
        await expect(dictionaryDB.deleteRecordLocalBulk(profile, ['missing', 'other-profile'])).resolves.toEqual({
            deletedTokens: [],
        });
        await expect(dictionaryDB.getBulk(profile, track, ['alpha'])).resolves.toEqual({});
        await expect(dictionaryDB.getBulk(otherProfile, track, ['other-profile'])).resolves.toHaveProperty(
            'other-profile'
        );
    });

    it('returns raw records with unique Anki cards for the requested profile and track', async () => {
        const localRecord = makeTokenRecord({ token: 'local' });
        const ankiRecord = makeTokenRecord({
            token: 'anki',
            track,
            source: DictionaryTokenSource.ANKI_WORD,
            status: null,
            lemmas: ['anki'],
            cardIds: [1, 2, 1],
        });
        await seedTokens(
            localRecord,
            ankiRecord,
            makeTokenRecord({
                token: 'other-track',
                track: otherTrack,
                source: DictionaryTokenSource.ANKI_WORD,
                cardIds: [3],
            })
        );
        const firstCard = makeAnkiCardRecord({ cardId: 1, status: TokenStatus.UNKNOWN });
        const secondCard = makeAnkiCardRecord({ cardId: 2, status: TokenStatus.MATURE });
        await seedAnkiCards(firstCard, secondCard, makeAnkiCardRecord({ cardId: 3, track: otherTrack }));

        const records = await dictionaryDB.getRecords(profile, track);
        expect(records.tokenRecords).toEqual(expect.arrayContaining([localRecord, ankiRecord]));
        expect(records.tokenRecords).toHaveLength(2);
        expect(records.ankiCardRecords).toEqual({
            [track]: {
                [firstCard.cardId]: firstCard,
                [secondCard.cardId]: secondCard,
            },
        });
    });

    it('returns raw records for all tracks when no track is requested', async () => {
        const localRecord = makeTokenRecord({ token: 'local' });
        const trackRecord = makeTokenRecord({
            token: 'track-zero',
            track,
            source: DictionaryTokenSource.ANKI_WORD,
            status: null,
            lemmas: ['track-zero'],
            cardIds: [1],
        });
        const otherTrackRecord = makeTokenRecord({
            token: 'track-one',
            track: otherTrack,
            source: DictionaryTokenSource.ANKI_SENTENCE,
            status: null,
            lemmas: ['track-one'],
            cardIds: [2],
        });
        await seedTokens(
            localRecord,
            trackRecord,
            otherTrackRecord,
            makeTokenRecord({ token: 'other-profile', profile: otherProfile })
        );
        const firstCard = makeAnkiCardRecord({ cardId: 1, status: TokenStatus.UNKNOWN });
        const secondCard = makeAnkiCardRecord({ cardId: 2, track: otherTrack, status: TokenStatus.MATURE });
        await seedAnkiCards(firstCard, secondCard, makeAnkiCardRecord({ cardId: 3, profile: otherProfile }));

        const records = await dictionaryDB.getRecords(profile, undefined);

        expect(records.tokenRecords).toEqual(expect.arrayContaining([localRecord, trackRecord, otherTrackRecord]));
        expect(records.tokenRecords).toHaveLength(3);
        expect(records.ankiCardRecords).toEqual({
            [track]: { [firstCard.cardId]: firstCard },
            [otherTrack]: { [secondCard.cardId]: secondCard },
        });
    });

    it('deletes all dictionary data for one profile only', async () => {
        await seedTokens(
            makeTokenRecord({ token: 'alpha' }),
            makeTokenRecord({ token: 'other-profile', profile: otherProfile })
        );
        await seedAnkiCards(
            makeAnkiCardRecord({ cardId: 1 }),
            makeAnkiCardRecord({ cardId: 2, profile: otherProfile })
        );
        await privateDb(dictionaryDB).meta.bulkPut([
            makeMetaRecord({
                ankiMeta: {
                    lastBuildStartedAt: 1,
                    lastBuildExpiresAt: 2,
                    buildId: 'build',
                    settings: 'settings',
                },
            }),
            makeMetaRecord({
                profile: otherProfile,
                ankiMeta: {
                    lastBuildStartedAt: 1,
                    lastBuildExpiresAt: 2,
                    buildId: 'build',
                    settings: 'settings',
                },
            }),
        ]);

        await expect(dictionaryDB.deleteProfile(profile)).resolves.toEqual({
            deletedMetas: [[profile, track]],
            deletedTokens: [tokenKey('alpha')],
            deletedAnkiCards: [[1, track, profile]],
            deletedWaniKaniSubjects: [],
            deletedWaniKaniAssignments: [],
        });
        await expect(dictionaryDB.getBulk(profile, track, ['alpha'])).resolves.toEqual({});
        await expect(privateDb(dictionaryDB).ankiCards.get([1, track, profile])).resolves.toBeUndefined();
        await expect(dictionaryDB.getBulk(otherProfile, track, ['other-profile'])).resolves.toHaveProperty(
            'other-profile'
        );
        await expect(privateDb(dictionaryDB).ankiCards.count()).resolves.toBe(1);
        await expect(privateDb(dictionaryDB).ankiCards.where('profile').equals(otherProfile).count()).resolves.toBe(1);
    });
});
