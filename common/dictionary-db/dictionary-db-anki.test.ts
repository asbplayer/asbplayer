import 'core-js/stable/structured-clone';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DictionaryBuildAnkiCacheStateErrorCode, DictionaryBuildAnkiCacheStateType } from '@project/common';
import {
    AsbplayerSettings,
    defaultSettings,
    DictionaryTokenSource,
    TokenState,
    TokenStatus,
} from '@project/common/settings';

const mockAnkiInstances: any[] = [];
const mockAnkiOverrides: any[] = [];
const mockYomitanInstances: any[] = [];
const mockYomitanOverrides: any[] = [];

jest.mock('uuid', () => ({ v4: () => 'test-build-id' }));
jest.mock('@project/common/anki', () => ({
    Anki: jest.fn().mockImplementation((settings) => {
        const instance = {
            settings,
            requestPermission: jest.fn<() => Promise<{ permission: string }>>().mockResolvedValue({
                permission: 'granted',
            }),
            findNotes: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([]),
            notesInfo: jest.fn<(noteIds: number[]) => Promise<any[]>>().mockResolvedValue([]),
            cardsModTime: jest
                .fn<(cardIds: number[]) => Promise<{ cardId: number; mod: number }[]>>()
                .mockResolvedValue([]),
            cardsInfo: jest
                .fn<(cardIds: number[], progress?: (progress: any) => Promise<void>) => Promise<any[]>>()
                .mockResolvedValue([]),
            areSuspended: jest.fn<(cardIds: number[]) => Promise<boolean[]>>().mockResolvedValue([]),
            findCards: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([]),
        };
        Object.assign(instance, mockAnkiOverrides.shift());
        mockAnkiInstances.push(instance);
        return instance;
    }),
    escapeAnkiDeckQuery: (query: string) => query.replace(/"/g, '\\"'),
    escapeAnkiQuery: (query: string) => query.replace(/"/g, '\\"'),
}));
jest.mock('@project/common/yomitan', () => ({
    Yomitan: jest.fn().mockImplementation((dt) => {
        const instance = {
            dt,
            version: jest.fn<() => Promise<string>>().mockResolvedValue('26.4.6'),
            tokenizeBulk: jest.fn<(texts: string[]) => Promise<unknown>>().mockResolvedValue(undefined),
            tokenize: jest.fn<(text: string) => Promise<{ text: string }[][]>>().mockResolvedValue([]),
            verifyTokenizeResult: jest.fn(),
            lemmatize: jest.fn<(token: string) => Promise<string[] | undefined>>().mockResolvedValue([]),
            resetCache: jest.fn(),
        };
        Object.assign(instance, mockYomitanOverrides.shift());
        mockYomitanInstances.push(instance);
        return instance;
    }),
}));
jest.mock('@project/common/yomitan/yomitan', () => ({
    Yomitan: jest.fn().mockImplementation((dt) => {
        const instance = {
            dt,
            version: jest.fn<() => Promise<string>>().mockResolvedValue('26.4.6'),
            tokenizeBulk: jest.fn<(texts: string[]) => Promise<unknown>>().mockResolvedValue(undefined),
            tokenize: jest.fn<(text: string) => Promise<{ text: string }[][]>>().mockResolvedValue([]),
            verifyTokenizeResult: jest.fn(),
            lemmatize: jest.fn<(token: string) => Promise<string[] | undefined>>().mockResolvedValue([]),
            resetCache: jest.fn(),
        };
        Object.assign(instance, mockYomitanOverrides.shift());
        mockYomitanInstances.push(instance);
        return instance;
    }),
}));

import {
    DictionaryDB,
    _buildIdHealthCheck,
    _clearBuildIds,
    _ensureBuildId,
    _gatherModifiedTokens,
} from './dictionary-db';
import {
    _buildAnkiCardStatuses,
    _buildTokensForTracks,
    _deleteCardBulk,
    _getAnkiCardKeys,
    _getAnkiCardsByNoteIdBulk,
    _orphanAllCardIds,
    _processAnkiCardStatuses,
    _processTracks,
    _saveTokensForDB,
    _syncTrackStatesWithAnki,
    _updateBuildAnkiCacheProgress,
} from './dictionary-db-anki';
import {
    makeAnkiCardRecord,
    makeDictionaryTrack,
    makeMetaRecord,
    makeModifiedCard,
    makeNoteInfo,
    makeSettings,
    makeTokenRecord,
    otherProfile,
    otherTrack,
    privateDb,
    profile,
    tokenKey,
    track,
} from './dictionary-db-test-utils';

describe('DictionaryDB Anki cache', () => {
    let dictionaryDB: DictionaryDB;
    let settings: AsbplayerSettings;

    const useSettings = (dictionaryTracks = [makeDictionaryTrack()]) => {
        settings = makeSettings(dictionaryTracks);
        return settings;
    };

    const installHelperAdapters = () => {
        const db = privateDb(dictionaryDB);
        Object.assign(dictionaryDB as any, {
            _buildAnkiCardStatuses,
            _buildIdHealthCheck: (buildId: string, activeTracks: [string, number][]) =>
                _buildIdHealthCheck(db, buildId, 'anki', activeTracks),
            _buildTokensForTracks: (
                ...args: Parameters<typeof _buildTokensForTracks> extends [any, ...infer Rest] ? Rest : never
            ) => _buildTokensForTracks(db, ...args),
            _clearBuildId: (key: [string, number], buildId: string) => _clearBuildIds(db, [key], buildId, 'anki'),
            _clearBuildIds: (activeTracks: [string, number][], buildId: string) =>
                _clearBuildIds(db, activeTracks, buildId, 'anki'),
            _deleteCardBulk: (
                profile: string,
                orphanedTrackCardIds: Map<number, number[]>,
                modifiedTokens: Set<string>
            ) => _deleteCardBulk(db, profile, orphanedTrackCardIds, modifiedTokens),
            _ensureBuildId: (key: [string, number], buildId: string, options: { buildTs: number }) =>
                _ensureBuildId(db, key, buildId, 'anki', { mode: 'claim', buildTs: options.buildTs }),
            _gatherModifiedTokens: (profile: string, modifiedTokens: Set<string>) =>
                _gatherModifiedTokens(db, profile, modifiedTokens),
            _getAnkiCardKeys: (profile: string) => _getAnkiCardKeys(db, profile),
            _getAnkiCardsByNoteIdBulk: (profile: string, noteIds: number[]) =>
                _getAnkiCardsByNoteIdBulk(db, profile, noteIds),
            _orphanAllCardIds: (profile: string, tracks: number[]) => _orphanAllCardIds(db, profile, tracks),
            _processAnkiCardStatuses,
            _processTracks: (...args: Parameters<typeof _processTracks> extends [any, ...infer Rest] ? Rest : never) =>
                _processTracks(db, ...args),
            _saveTokensForDB: (
                ...args: Parameters<typeof _saveTokensForDB> extends [any, ...infer Rest] ? Rest : never
            ) => _saveTokensForDB(db, ...args),
            _syncTrackStatesWithAnki: (
                ...args: Parameters<typeof _syncTrackStatesWithAnki> extends [any, ...infer Rest] ? Rest : never
            ) => _syncTrackStatesWithAnki(db, ...args),
            _updateBuildAnkiCacheProgress: (
                ...args: Parameters<typeof _updateBuildAnkiCacheProgress> extends [any, ...infer Rest] ? Rest : never
            ) => _updateBuildAnkiCacheProgress(db, ...args),
        });
    };

    beforeEach(async () => {
        mockAnkiInstances.length = 0;
        mockAnkiOverrides.length = 0;
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

    const waitForAnkiBuildToFinish = async (key: [string, number] = [profile, track]) => {
        for (let i = 0; i < 20; i++) {
            const meta = await privateDb(dictionaryDB).meta.get(key);
            if (meta?.ankiMeta.buildId === null) return;
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        throw new Error('Timed out waiting for Anki build to finish');
    };

    it('uses exact deck, child deck, and field matches when building Anki card statuses', async () => {
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryAnkiDecks: ['Japanese', 'Mining'],
            dictionaryAnkiWordFields: ['Word'],
            dictionaryAnkiSentenceFields: ['Sentence'],
            dictionaryAnkiMatureCutoff: 20,
        });
        const modifiedCards = new Map<number, any>([
            [
                1,
                makeModifiedCard({
                    noteId: 1,
                    deckName: 'Japanese',
                    fields: new Map([['Word', 'alpha']]),
                    modifiedAt: 100,
                    statuses: new Map(),
                    suspended: false,
                }),
            ],
            [
                2,
                makeModifiedCard({
                    noteId: 2,
                    deckName: 'Japanese::Anime',
                    fields: new Map([['Sentence', 'sentence']]),
                    modifiedAt: 100,
                    statuses: new Map(),
                    suspended: false,
                }),
            ],
            [
                3,
                makeModifiedCard({
                    noteId: 3,
                    deckName: 'Other',
                    fields: new Map([['Word', 'beta']]),
                    modifiedAt: 100,
                    statuses: new Map(),
                    suspended: false,
                }),
            ],
            [
                4,
                makeModifiedCard({
                    noteId: 4,
                    deckName: 'Mining',
                    fields: new Map([['Unrelated', 'gamma']]),
                    modifiedAt: 100,
                    statuses: new Map(),
                    suspended: false,
                }),
            ],
        ]);
        const anki = { findCards: jest.fn<(query: string) => Promise<number[]>>() };
        anki.findCards.mockResolvedValueOnce([1, 2, 3, 4]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        await (dictionaryDB as any)._buildAnkiCardStatuses(track, { dt: dictionaryTrack }, modifiedCards, anki);

        expect(anki.findCards).toHaveBeenCalledTimes(1);
        expect(anki.findCards.mock.calls[0][0]).toBe(
            'is:new (("deck:Japanese" OR "deck:Mining") ("Word:_*" OR "Sentence:_*"))'
        );
        expect(modifiedCards.get(1).statuses.get(track)).toBe(TokenStatus.UNKNOWN);
        expect(modifiedCards.get(2).statuses.get(track)).toBe(TokenStatus.UNKNOWN);
        expect(modifiedCards.get(3).statuses.has(track)).toBe(false);
        expect(modifiedCards.get(4).statuses.has(track)).toBe(false);
    });

    it('treats an empty deck list as all decks when building Anki card statuses', async () => {
        const dictionaryTrack = makeDictionaryTrack({ dictionaryAnkiDecks: [], dictionaryAnkiWordFields: ['Word'] });
        const modifiedCards = new Map<number, any>([
            [
                1,
                makeModifiedCard({
                    noteId: 1,
                    deckName: 'Any Deck',
                    fields: new Map([['Word', 'alpha']]),
                    modifiedAt: 100,
                    statuses: new Map(),
                    suspended: false,
                }),
            ],
        ]);
        const anki = { findCards: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValueOnce([1]) };

        await (dictionaryDB as any)._buildAnkiCardStatuses(track, { dt: dictionaryTrack }, modifiedCards, anki);

        expect(anki.findCards).toHaveBeenCalledWith('is:new ("Word:_*")');
        expect(modifiedCards.get(1).statuses.get(track)).toBe(TokenStatus.UNKNOWN);
    });

    it('fetches Anki card keys and groups cards by note ID within a profile', async () => {
        const firstCard = makeAnkiCardRecord({ cardId: 1, noteId: 10 });
        const secondCard = makeAnkiCardRecord({ cardId: 2, noteId: 10 });
        const otherProfileCard = makeAnkiCardRecord({ cardId: 3, noteId: 20, profile: otherProfile });

        await seedAnkiCards(firstCard, secondCard, otherProfileCard);

        await expect((dictionaryDB as any)._getAnkiCardKeys(profile)).resolves.toEqual([
            [1, track, profile],
            [2, track, profile],
        ]);
        await expect((dictionaryDB as any)._getAnkiCardsByNoteIdBulk(profile, [])).resolves.toEqual(new Map());
        await expect((dictionaryDB as any)._getAnkiCardsByNoteIdBulk(profile, [10, 20])).resolves.toEqual(
            new Map([[10, [firstCard, secondCard]]])
        );
    });

    it('orphans and deletes Anki cards while updating related token modifications', async () => {
        const modifiedTokens = new Set<string>();
        await seedTokens(
            makeTokenRecord({
                token: 'alpha',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['lemma-alpha'],
                cardIds: [1, 2],
            }),
            makeTokenRecord({
                token: 'beta',
                track,
                source: DictionaryTokenSource.ANKI_SENTENCE,
                status: null,
                lemmas: ['lemma-beta'],
                cardIds: [1],
            }),
            makeTokenRecord({
                token: 'other-track',
                track: otherTrack,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['other-track'],
                cardIds: [3],
            })
        );
        await seedAnkiCards(
            makeAnkiCardRecord({ cardId: 1 }),
            makeAnkiCardRecord({ cardId: 2 }),
            makeAnkiCardRecord({ cardId: 3, track: otherTrack })
        );

        await (dictionaryDB as any)._deleteCardBulk(profile, new Map([[track, []]]), modifiedTokens);
        await expect(privateDb(dictionaryDB).ankiCards.count()).resolves.toBe(3);

        await (dictionaryDB as any)._deleteCardBulk(profile, new Map([[track, [1]]]), modifiedTokens);
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('alpha', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toMatchObject({
            status: null,
            states: [],
            cardIds: [2],
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('beta', DictionaryTokenSource.ANKI_SENTENCE, track))
        ).resolves.toBeUndefined();
        await expect(privateDb(dictionaryDB).ankiCards.get([1, track, profile])).resolves.toBeUndefined();
        expect(modifiedTokens).toEqual(new Set(['alpha', 'lemma-alpha', 'beta', 'lemma-beta']));

        await expect((dictionaryDB as any)._orphanAllCardIds(profile, [])).resolves.toEqual(new Map());
        await expect((dictionaryDB as any)._orphanAllCardIds(profile, [track, otherTrack])).resolves.toEqual(
            new Map([
                [track, [2]],
                [otherTrack, [3]],
            ])
        );
    });

    it('manages build IDs, health checks, clearing, and progress expiration', async () => {
        const key = [profile, track];
        const statusUpdates = jest.fn();
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const dateNow = jest.spyOn(Date, 'now').mockReturnValue(2000);

        await expect((dictionaryDB as any)._ensureBuildId(key, 'build-1', { buildTs: 1000 })).resolves.toBe(true);
        await expect((dictionaryDB as any)._ensureBuildId(key, 'build-2', { buildTs: 2000 })).resolves.toBe(false);
        await expect((dictionaryDB as any)._buildIdHealthCheck('build-1', [key])).resolves.toBeUndefined();
        await expect((dictionaryDB as any)._buildIdHealthCheck('build-2', [key])).rejects.toThrow(
            'buildId was corrupted for track 1'
        );
        await expect((dictionaryDB as any)._ensureBuildId(key, 'build-2', { buildTs: 302000 })).resolves.toBe(true);
        expect(consoleWarn).toHaveBeenCalledTimes(1);

        await (dictionaryDB as any)._updateBuildAnkiCacheProgress(
            'build-2',
            [key],
            { current: 1, total: 3, startedAt: 1000 },
            ['alpha'],
            statusUpdates,
            true
        );
        await expect(privateDb(dictionaryDB).meta.get(key)).resolves.toMatchObject({
            ankiMeta: {
                buildId: 'build-2',
                lastBuildExpiresAt: 302000,
            },
        });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.progress,
            body: { current: 1, total: 3, buildTimestamp: 1000, modifiedTokens: ['alpha'], forAnkiSync: true },
        });

        await (dictionaryDB as any)._clearBuildId(key, 'wrong-build');
        await expect(privateDb(dictionaryDB).meta.get(key)).resolves.toMatchObject({
            ankiMeta: { buildId: 'build-2' },
        });
        await (dictionaryDB as any)._clearBuildIds([key], 'build-2');
        await expect(privateDb(dictionaryDB).meta.get(key)).resolves.toMatchObject({ ankiMeta: { buildId: null } });
        dateNow.mockRestore();
    });

    it('processes Anki card status assignments once per card and skips irrelevant cards', () => {
        const modifiedCards = new Map<number, any>([
            [1, makeModifiedCard({ statuses: new Map() })],
            [2, makeModifiedCard({ statuses: new Map([[track, TokenStatus.UNKNOWN]]) })],
            [3, makeModifiedCard({ statuses: new Map() })],
        ]);

        expect(
            (dictionaryDB as any)._processAnkiCardStatuses(
                track,
                [99, 1, 1, 2, 3],
                modifiedCards,
                TokenStatus.MATURE,
                2
            )
        ).toBe(0);
        expect(modifiedCards.get(1).statuses.get(track)).toBe(TokenStatus.MATURE);
        expect(modifiedCards.get(2).statuses.get(track)).toBe(TokenStatus.UNKNOWN);
        expect(modifiedCards.get(3).statuses.get(track)).toBe(TokenStatus.MATURE);
    });

    it('builds Anki statuses through learn, FSRS, and interval fallback queries', async () => {
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryAnkiWordFields: ['Word'],
            dictionaryAnkiMatureCutoff: 20,
        });
        const modifiedCards = new Map<number, any>([
            [1, makeModifiedCard({ cardId: 1, statuses: new Map() })],
            [2, makeModifiedCard({ cardId: 2, statuses: new Map() })],
            [3, makeModifiedCard({ cardId: 3, statuses: new Map() })],
        ]);
        const anki = { findCards: jest.fn<(query: string) => Promise<number[]>>() };
        anki.findCards
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([1])
            .mockResolvedValueOnce([2])
            .mockResolvedValueOnce([3]);

        await (dictionaryDB as any)._buildAnkiCardStatuses(track, { dt: dictionaryTrack }, modifiedCards, anki);

        expect(anki.findCards.mock.calls.map((call) => call[0])).toEqual([
            'is:new ("Word:_*")',
            'is:learn ("Word:_*")',
            'prop:s>=0 ("Word:_*")',
            '-is:new -is:learn prop:ivl<10 ("Word:_*")',
            '-is:new -is:learn prop:ivl>=10 prop:ivl<20 ("Word:_*")',
            '-is:new -is:learn prop:ivl>=20 ("Word:_*")',
        ]);
        expect(modifiedCards.get(1).statuses.get(track)).toBe(TokenStatus.GRADUATED);
        expect(modifiedCards.get(2).statuses.get(track)).toBe(TokenStatus.YOUNG);
        expect(modifiedCards.get(3).statuses.get(track)).toBe(TokenStatus.MATURE);
    });

    it('throws when Anki status queries cannot classify all relevant cards', async () => {
        const dictionaryTrack = makeDictionaryTrack({ dictionaryAnkiWordFields: ['Word'] });
        const modifiedCards = new Map<number, any>([[1, makeModifiedCard({ statuses: new Map() })]]);
        const anki = { findCards: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([]) };

        await expect(
            (dictionaryDB as any)._buildAnkiCardStatuses(track, { dt: dictionaryTrack }, modifiedCards, anki)
        ).rejects.toThrow('Anki changed during status build, some cards statuses could not be determined.');
    });

    it('does not query Anki card statuses when there are no modified cards or configured Anki fields', async () => {
        const anki = { findCards: jest.fn<(query: string) => Promise<number[]>>() };

        await (dictionaryDB as any)._buildAnkiCardStatuses(
            track,
            { dt: makeDictionaryTrack({ dictionaryAnkiWordFields: ['Word'] }) },
            new Map(),
            anki
        );
        await (dictionaryDB as any)._buildAnkiCardStatuses(
            track,
            { dt: makeDictionaryTrack({ dictionaryAnkiWordFields: [], dictionaryAnkiSentenceFields: [] }) },
            new Map([[1, makeModifiedCard({ statuses: new Map() })]]),
            anki
        );

        expect(anki.findCards).not.toHaveBeenCalled();
    });

    it('syncs track states with Anki, trims fields, detects suspended cards, and records orphaned card IDs', async () => {
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryAnkiDecks: ['Japanese'],
            dictionaryAnkiWordFields: ['Word'],
        });
        const trackStates = new Map([[track, { dt: dictionaryTrack, yomitan: {} }]]);
        const modifiedCards = new Map<number, any>();
        const orphanedTrackCardIds = new Map<number, number[]>();
        const anki = {
            findNotes: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([10]),
            notesInfo: jest.fn<(noteIds: number[]) => Promise<any[]>>().mockResolvedValue([
                makeNoteInfo({
                    noteId: 10,
                    fields: { Word: { value: ' alpha ', order: 0 }, Empty: { value: '   ', order: 1 } },
                    cards: [1, 2],
                    mod: 100,
                }),
            ]),
            cardsModTime: jest
                .fn<(cardIds: number[]) => Promise<{ cardId: number; mod: number }[]>>()
                .mockResolvedValue([
                    { cardId: 1, mod: 110 },
                    { cardId: 2, mod: 110 },
                ]),
            cardsInfo: jest
                .fn<(cardIds: number[], progress?: (progress: any) => Promise<void>) => Promise<any[]>>()
                .mockResolvedValue([
                    { cardId: 1, deckName: 'Japanese' },
                    { cardId: 2, deckName: 'Other' },
                ]),
            areSuspended: jest.fn<(cardIds: number[]) => Promise<boolean[]>>().mockResolvedValue([false, true]),
        };
        await seedAnkiCards(
            makeAnkiCardRecord({ cardId: 2, noteId: 10, modifiedAt: 50 }),
            makeAnkiCardRecord({ cardId: 3, noteId: 11, modifiedAt: 50 })
        );

        await expect(
            (dictionaryDB as any)._syncTrackStatesWithAnki(
                profile,
                trackStates,
                modifiedCards,
                orphanedTrackCardIds,
                anki,
                'build',
                [[profile, track]],
                jest.fn()
            )
        ).resolves.toBe(3);

        expect(anki.findNotes).toHaveBeenCalledWith('("deck:Japanese") ("Word:_*")');
        expect(modifiedCards.get(1)).toMatchObject({
            noteId: 10,
            modifiedAt: 110,
            suspended: false,
            data: { deckName: 'Japanese' },
        });
        expect(modifiedCards.get(1).fields).toEqual(new Map([['Word', 'alpha']]));
        expect(modifiedCards.get(2)).toMatchObject({
            noteId: 10,
            modifiedAt: 110,
            suspended: true,
            data: { deckName: 'Other' },
        });
        expect(orphanedTrackCardIds).toEqual(new Map([[track, [2, 3]]]));
    });

    it('does not sync unchanged notes/cards and does not call expensive card details APIs', async () => {
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryAnkiDecks: ['Japanese'],
            dictionaryAnkiWordFields: ['Word'],
        });
        const trackStates = new Map([[track, { dt: dictionaryTrack, yomitan: {} }]]);
        const modifiedCards = new Map<number, any>();
        const orphanedTrackCardIds = new Map<number, number[]>();
        const anki = {
            findNotes: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([10]),
            notesInfo: jest
                .fn<(noteIds: number[]) => Promise<any[]>>()
                .mockResolvedValue([makeNoteInfo({ noteId: 10, cards: [1], mod: 100 })]),
            cardsModTime: jest
                .fn<(cardIds: number[]) => Promise<{ cardId: number; mod: number }[]>>()
                .mockResolvedValue([{ cardId: 1, mod: 100 }]),
            cardsInfo: jest.fn<(cardIds: number[], progress?: (progress: any) => Promise<void>) => Promise<any[]>>(),
            areSuspended: jest.fn<(cardIds: number[]) => Promise<boolean[]>>(),
        };
        await seedAnkiCards(makeAnkiCardRecord({ cardId: 1, noteId: 10, modifiedAt: 100 }));

        await expect(
            (dictionaryDB as any)._syncTrackStatesWithAnki(
                profile,
                trackStates,
                modifiedCards,
                orphanedTrackCardIds,
                anki,
                'build',
                [[profile, track]],
                jest.fn()
            )
        ).resolves.toBe(0);

        expect(modifiedCards.size).toBe(0);
        expect(orphanedTrackCardIds).toEqual(new Map([[track, []]]));
        expect(anki.cardsInfo).not.toHaveBeenCalled();
        expect(anki.areSuspended).not.toHaveBeenCalled();
    });

    it('syncs card-only review/suspension changes even when note fields are unchanged', async () => {
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryAnkiDecks: ['Japanese'],
            dictionaryAnkiWordFields: ['Word'],
        });
        const trackStates = new Map([[track, { dt: dictionaryTrack, yomitan: {} }]]);
        const modifiedCards = new Map<number, any>();
        const orphanedTrackCardIds = new Map<number, number[]>();
        const anki = {
            findNotes: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([10]),
            notesInfo: jest
                .fn<(noteIds: number[]) => Promise<any[]>>()
                .mockResolvedValue([makeNoteInfo({ noteId: 10, cards: [1], mod: 100 })]),
            cardsModTime: jest
                .fn<(cardIds: number[]) => Promise<{ cardId: number; mod: number }[]>>()
                .mockResolvedValue([{ cardId: 1, mod: 150 }]),
            cardsInfo: jest
                .fn<(cardIds: number[], progress?: (progress: any) => Promise<void>) => Promise<any[]>>()
                .mockResolvedValue([{ cardId: 1, deckName: 'Japanese' }]),
            areSuspended: jest.fn<(cardIds: number[]) => Promise<boolean[]>>().mockResolvedValue([true]),
        };
        await seedAnkiCards(makeAnkiCardRecord({ cardId: 1, noteId: 10, modifiedAt: 100, suspended: false }));

        await expect(
            (dictionaryDB as any)._syncTrackStatesWithAnki(
                profile,
                trackStates,
                modifiedCards,
                orphanedTrackCardIds,
                anki,
                'build',
                [[profile, track]],
                jest.fn()
            )
        ).resolves.toBe(1);

        expect(modifiedCards.get(1)).toMatchObject({
            modifiedAt: 150,
            suspended: true,
            data: { deckName: 'Japanese' },
        });
        expect(orphanedTrackCardIds).toEqual(new Map([[track, []]]));
    });

    it('ignores notes that do not contain configured fields when syncing track states', async () => {
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryAnkiDecks: ['Japanese'],
            dictionaryAnkiWordFields: ['Word'],
        });
        const trackStates = new Map([[track, { dt: dictionaryTrack, yomitan: {} }]]);
        const modifiedCards = new Map<number, any>();
        const orphanedTrackCardIds = new Map<number, number[]>();
        const anki = {
            findNotes: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([10]),
            notesInfo: jest.fn<(noteIds: number[]) => Promise<any[]>>().mockResolvedValue([
                makeNoteInfo({
                    noteId: 10,
                    fields: { Sentence: { value: 'alpha', order: 0 } },
                    cards: [1],
                    mod: 150,
                }),
            ]),
            cardsModTime: jest
                .fn<(cardIds: number[]) => Promise<{ cardId: number; mod: number }[]>>()
                .mockResolvedValue([{ cardId: 1, mod: 150 }]),
            cardsInfo: jest.fn<(cardIds: number[], progress?: (progress: any) => Promise<void>) => Promise<any[]>>(),
            areSuspended: jest.fn<(cardIds: number[]) => Promise<boolean[]>>(),
        };
        await seedAnkiCards(makeAnkiCardRecord({ cardId: 1, noteId: 10, modifiedAt: 100 }));

        await expect(
            (dictionaryDB as any)._syncTrackStatesWithAnki(
                profile,
                trackStates,
                modifiedCards,
                orphanedTrackCardIds,
                anki,
                'build',
                [[profile, track]],
                jest.fn()
            )
        ).resolves.toBe(0);

        expect(modifiedCards.size).toBe(0);
        expect(orphanedTrackCardIds).toEqual(new Map([[track, []]]));
        expect(anki.cardsInfo).not.toHaveBeenCalled();
        expect(anki.areSuspended).not.toHaveBeenCalled();
    });

    it('throws when Anki note or card modification responses are incomplete during sync', async () => {
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryAnkiDecks: ['Japanese'],
            dictionaryAnkiWordFields: ['Word'],
        });
        const trackStates = new Map([[track, { dt: dictionaryTrack, yomitan: {} }]]);
        const makeAnki = (overrides: Record<string, unknown> = {}) => ({
            findNotes: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([10]),
            notesInfo: jest
                .fn<(noteIds: number[]) => Promise<any[]>>()
                .mockResolvedValue([makeNoteInfo({ cards: [1, 2] })]),
            cardsModTime: jest
                .fn<(cardIds: number[]) => Promise<{ cardId: number; mod: number }[]>>()
                .mockResolvedValue([{ cardId: 1, mod: 100 }]),
            cardsInfo: jest.fn<(cardIds: number[], progress?: (progress: any) => Promise<void>) => Promise<any[]>>(),
            areSuspended: jest.fn<(cardIds: number[]) => Promise<boolean[]>>(),
            ...overrides,
        });

        await expect(
            (dictionaryDB as any)._syncTrackStatesWithAnki(
                profile,
                trackStates,
                new Map(),
                new Map(),
                makeAnki({ notesInfo: jest.fn<(noteIds: number[]) => Promise<any[]>>().mockResolvedValue([]) }),
                'build',
                [[profile, track]],
                jest.fn()
            )
        ).rejects.toThrow('Anki changed during cards record build, some notes info could not be retrieved.');

        await expect(
            (dictionaryDB as any)._syncTrackStatesWithAnki(
                profile,
                trackStates,
                new Map(),
                new Map(),
                makeAnki(),
                'build',
                [[profile, track]],
                jest.fn()
            )
        ).rejects.toThrow('Anki changed during cards record build, some cards mod time could not be retrieved.');
    });

    it('orphans all existing cards for active tracks when Anki returns no notes', async () => {
        const dictionaryTrack = makeDictionaryTrack({ dictionaryAnkiWordFields: ['Word'] });
        const trackStates = new Map([[track, { dt: dictionaryTrack, yomitan: {} }]]);
        const orphanedTrackCardIds = new Map<number, number[]>();
        const anki = { findNotes: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([]) };
        await seedAnkiCards(makeAnkiCardRecord({ cardId: 1 }), makeAnkiCardRecord({ cardId: 2, track: otherTrack }));

        await expect(
            (dictionaryDB as any)._syncTrackStatesWithAnki(
                profile,
                trackStates,
                new Map(),
                orphanedTrackCardIds,
                anki,
                'build',
                [[profile, track]],
                jest.fn()
            )
        ).resolves.toBe(1);
        expect(orphanedTrackCardIds).toEqual(new Map([[track, [1]]]));
    });

    it('saves new Anki tokens and removes stale token card references from the DB', async () => {
        const modifiedTokens = new Set<string>();
        const currentRecord = makeTokenRecord({
            token: 'current',
            track,
            source: DictionaryTokenSource.ANKI_WORD,
            status: null,
            lemmas: ['current-lemma'],
            cardIds: [1],
        });
        const ankiCard = makeAnkiCardRecord({ cardId: 1, status: TokenStatus.LEARNING });
        const partialTokenRecordsByTrack = new Map([
            [
                track,
                new Map([
                    [
                        DictionaryTokenSource.ANKI_WORD,
                        new Map([['current', { lemmas: ['current-lemma'], cardIds: new Set([1]) }]]),
                    ],
                    [DictionaryTokenSource.ANKI_SENTENCE, new Map()],
                ]),
            ],
        ]);
        await seedTokens(
            makeTokenRecord({
                token: 'stale-delete',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['stale-delete-lemma'],
                cardIds: [1],
            }),
            makeTokenRecord({
                token: 'stale-retain',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['stale-retain-lemma'],
                cardIds: [1, 2],
            })
        );

        await (dictionaryDB as any)._saveTokensForDB(
            profile,
            new Map([[track, { dt: makeDictionaryTrack(), yomitan: {} }]]),
            [currentRecord],
            [ankiCard],
            new Map([[1, makeModifiedCard()]]),
            partialTokenRecordsByTrack,
            modifiedTokens
        );

        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('current', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toEqual(currentRecord);
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('stale-delete', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toBeUndefined();
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('stale-retain', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toMatchObject({
            cardIds: [2],
        });
        await expect(privateDb(dictionaryDB).ankiCards.get([1, track, profile])).resolves.toEqual(ankiCard);
        expect(modifiedTokens).toEqual(
            new Set([
                'current',
                'current-lemma',
                'stale-delete',
                'stale-delete-lemma',
                'stale-retain',
                'stale-retain-lemma',
            ])
        );
    });

    it('gathers modified tokens through lemma relationships within the same profile', async () => {
        const modifiedTokens = new Set(['alpha']);
        await seedTokens(
            makeTokenRecord({ token: 'related', lemmas: ['alpha', 'related-lemma'] }),
            makeTokenRecord({ token: 'other-profile-related', profile: otherProfile, lemmas: ['alpha'] })
        );

        await (dictionaryDB as any)._gatherModifiedTokens(profile, modifiedTokens);

        expect(modifiedTokens).toEqual(new Set(['alpha', 'related', 'related-lemma']));
    });

    it('returns without tokenization or progress when there are no modified cards to build', async () => {
        const yomitan = {
            tokenizeBulk: jest.fn(),
            tokenize: jest.fn(),
            verifyTokenizeResult: jest.fn(),
            lemmatize: jest.fn(),
            resetCache: jest.fn(),
        };
        const statusUpdates = jest.fn();

        await (dictionaryDB as any)._buildTokensForTracks(
            profile,
            new Map([[track, { dt: makeDictionaryTrack({ dictionaryAnkiWordFields: ['Word'] }), yomitan }]]),
            new Map(),
            'build',
            [[profile, track]],
            { current: 0, total: 0, startedAt: 1000 },
            statusUpdates
        );

        expect(yomitan.tokenizeBulk).not.toHaveBeenCalled();
        expect(yomitan.tokenize).not.toHaveBeenCalled();
        expect(yomitan.resetCache).not.toHaveBeenCalled();
        expect(statusUpdates).not.toHaveBeenCalled();
    });

    it('builds modified cards in 100-card batches without losing progress or records', async () => {
        const dictionaryTrack = makeDictionaryTrack({ dictionaryAnkiWordFields: ['Word'] });
        const tokenize = jest.fn<(text: string) => Promise<{ text: string }[][]>>((text) =>
            Promise.resolve([[{ text }]])
        );
        const lemmatize = jest.fn<(token: string) => Promise<string[]>>((token) => Promise.resolve([token]));
        const yomitan = {
            tokenizeBulk: jest.fn(),
            tokenize,
            verifyTokenizeResult: jest.fn(),
            lemmatize,
            resetCache: jest.fn(),
        };
        const modifiedCards = new Map(
            Array.from({ length: 101 }, (_, index) => {
                const cardId = index + 1;
                return [
                    cardId,
                    makeModifiedCard({
                        noteId: cardId * 10,
                        fields: new Map([['Word', `word${cardId}`]]),
                        statuses: new Map([[track, TokenStatus.UNKNOWN]]),
                    }),
                ] as const;
            })
        );
        const statusUpdates = jest.fn();
        const key = [profile, track];
        await (dictionaryDB as any)._ensureBuildId(key, 'build', { buildTs: 1000 });

        await (dictionaryDB as any)._buildTokensForTracks(
            profile,
            new Map([[track, { dt: dictionaryTrack, yomitan }]]),
            modifiedCards,
            'build',
            [key],
            { current: 0, total: 101, startedAt: 1000 },
            statusUpdates
        );

        expect(yomitan.tokenizeBulk.mock.calls.map(([texts]) => (texts as string[]).length)).toEqual([100, 1]);
        expect(tokenize).toHaveBeenCalledTimes(101);
        expect(lemmatize).toHaveBeenCalledTimes(101);
        await expect(privateDb(dictionaryDB).tokens.count()).resolves.toBe(101);
        await expect(privateDb(dictionaryDB).ankiCards.count()).resolves.toBe(101);
        expect(statusUpdates.mock.calls.map(([state]) => (state as any).body.current)).toEqual([100, 101]);
    });

    it('builds tokens for tracks, preserving surviving card IDs while clearing local-only Anki fields and reporting progress', async () => {
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryAnkiDecks: ['Japanese'],
            dictionaryAnkiWordFields: ['Word'],
            dictionaryAnkiSentenceFields: ['Sentence'],
        });
        const tokenize = jest.fn<(text: string) => Promise<{ text: string }[][]>>((text) => {
            if (text === 'alpha 123 beta')
                return Promise.resolve([[{ text: 'alpha' }], [{ text: '123' }], [{ text: 'beta' }]]);
            if (text === 'sentence') return Promise.resolve([[{ text: 'sentence' }]]);
            return Promise.resolve([]);
        });
        const lemmatize = jest.fn<(token: string) => Promise<string[]>>((token) => {
            if (token === 'alpha') return Promise.resolve(['lemma-alpha']);
            if (token === 'sentence') return Promise.resolve(['lemma-sentence']);
            return Promise.resolve([]);
        });
        const yomitan = {
            tokenizeBulk: jest.fn(),
            tokenize,
            verifyTokenizeResult: jest.fn(),
            lemmatize,
            resetCache: jest.fn(),
        };
        const statusUpdates = jest.fn();
        const key = [profile, track];
        await (dictionaryDB as any)._ensureBuildId(key, 'build', { buildTs: 1000 });
        await seedTokens(
            makeTokenRecord({
                token: 'alpha',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['old-alpha'],
                states: [TokenState.IGNORED],
                cardIds: [2],
            })
        );

        await (dictionaryDB as any)._buildTokensForTracks(
            profile,
            new Map([[track, { dt: dictionaryTrack, yomitan }]]),
            new Map([
                [
                    10,
                    makeModifiedCard({
                        fields: new Map([
                            ['Word', 'alpha 123 beta'],
                            ['Sentence', 'sentence'],
                        ]),
                    }),
                ],
            ]),
            'build',
            [key],
            { current: 0, total: 1, startedAt: 1000 },
            statusUpdates
        );

        expect(yomitan.tokenizeBulk).toHaveBeenCalledWith(['alpha 123 beta', 'sentence']);
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('alpha', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toMatchObject({
            status: null,
            lemmas: ['lemma-alpha'],
            states: [],
            cardIds: [2, 10],
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('sentence', DictionaryTokenSource.ANKI_SENTENCE, track))
        ).resolves.toMatchObject({
            status: null,
            states: [],
            lemmas: ['lemma-sentence'],
            cardIds: [10],
        });
        await expect(privateDb(dictionaryDB).ankiCards.get([10, track, profile])).resolves.toMatchObject({
            cardId: 10,
            status: TokenStatus.UNKNOWN,
        });
        expect(statusUpdates).toHaveBeenCalledWith(
            expect.objectContaining({
                type: DictionaryBuildAnkiCacheStateType.progress,
                body: expect.objectContaining({ current: 1, total: 1 }),
            })
        );
    });

    it('drops generated Anki tokens without card IDs when saving build output', async () => {
        const modifiedTokens = new Set<string>();

        await (dictionaryDB as any)._saveTokensForDB(
            profile,
            new Map([[track, { dt: makeDictionaryTrack(), yomitan: {} }]]),
            [
                makeTokenRecord({
                    token: 'no-card-ids',
                    track,
                    source: DictionaryTokenSource.ANKI_WORD,
                    status: TokenStatus.UNKNOWN,
                    lemmas: ['lemma-no-card-ids'],
                    states: [TokenState.IGNORED],
                    cardIds: [],
                }),
            ],
            [],
            new Map(),
            new Map([
                [
                    track,
                    new Map([
                        [DictionaryTokenSource.ANKI_WORD, new Map()],
                        [DictionaryTokenSource.ANKI_SENTENCE, new Map()],
                    ]),
                ],
            ]),
            modifiedTokens
        );

        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('no-card-ids', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toBeUndefined();
        expect(modifiedTokens).toEqual(new Set(['no-card-ids', 'lemma-no-card-ids']));
    });

    it('replaces stale tokens when a modified card produces different tokens', async () => {
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryAnkiDecks: ['Japanese'],
            dictionaryAnkiWordFields: ['Word'],
        });
        const yomitan = {
            tokenizeBulk: jest.fn(),
            tokenize: jest
                .fn<(text: string) => Promise<{ text: string }[][]>>()
                .mockResolvedValue([[{ text: 'new-token' }]]),
            verifyTokenizeResult: jest.fn(),
            lemmatize: jest.fn<(token: string) => Promise<string[]>>().mockResolvedValue(['new-lemma']),
            resetCache: jest.fn(),
        };
        const statusUpdates = jest.fn();
        const key = [profile, track];
        await (dictionaryDB as any)._ensureBuildId(key, 'build', { buildTs: 1000 });
        await seedTokens(
            makeTokenRecord({
                token: 'old-delete',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['old-delete-lemma'],
                cardIds: [1],
            }),
            makeTokenRecord({
                token: 'old-retain',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['old-retain-lemma'],
                cardIds: [1, 2],
            }),
            makeTokenRecord({
                token: 'other-profile-retain',
                profile: otherProfile,
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['other-profile-retain-lemma'],
                cardIds: [1],
            }),
            makeTokenRecord({
                token: 'other-track-retain',
                track: otherTrack,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['other-track-retain-lemma'],
                cardIds: [1],
            }),
            makeTokenRecord({
                token: 'local-retain',
                track,
                source: DictionaryTokenSource.LOCAL,
                status: TokenStatus.UNKNOWN,
                lemmas: ['local-retain-lemma'],
                cardIds: [1],
            })
        );

        await (dictionaryDB as any)._buildTokensForTracks(
            profile,
            new Map([[track, { dt: dictionaryTrack, yomitan }]]),
            new Map([[1, makeModifiedCard({ fields: new Map([['Word', 'new-token']]) })]]),
            'build',
            [key],
            { current: 0, total: 1, startedAt: 1000 },
            statusUpdates
        );

        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('new-token', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toMatchObject({
            lemmas: ['new-lemma'],
            cardIds: [1],
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('old-delete', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toBeUndefined();
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('old-retain', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toMatchObject({
            cardIds: [2],
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(
                tokenKey('other-profile-retain', DictionaryTokenSource.ANKI_WORD, track, otherProfile)
            )
        ).resolves.toMatchObject({
            cardIds: [1],
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(
                tokenKey('other-track-retain', DictionaryTokenSource.ANKI_WORD, otherTrack)
            )
        ).resolves.toMatchObject({
            cardIds: [1],
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('local-retain', DictionaryTokenSource.LOCAL, track))
        ).resolves.toMatchObject({
            cardIds: [1],
        });
        expect(statusUpdates).toHaveBeenCalledWith(
            expect.objectContaining({
                type: DictionaryBuildAnkiCacheStateType.progress,
                body: expect.objectContaining({
                    modifiedTokens: expect.arrayContaining([
                        'new-token',
                        'new-lemma',
                        'old-delete',
                        'old-delete-lemma',
                        'old-retain',
                        'old-retain-lemma',
                    ]),
                }),
            })
        );
    });

    it('processes tracks by deleting orphaned cards, clearing build IDs, gathering related tokens, and publishing stats', async () => {
        const statusUpdates = jest.fn();
        const key = [profile, track];
        await (dictionaryDB as any)._ensureBuildId(key, 'build', { buildTs: 1000 });
        await seedTokens(makeTokenRecord({ token: 'related', lemmas: ['alpha'] }));

        await (dictionaryDB as any)._processTracks(
            profile,
            'build',
            new Map([[track, { dt: makeDictionaryTrack(), yomitan: {} }]]),
            new Map(),
            new Map([[track, []]]),
            [],
            0,
            new Set(['alpha']),
            [key],
            1,
            123,
            statusUpdates
        );

        await expect(privateDb(dictionaryDB).meta.get(key)).resolves.toMatchObject({ ankiMeta: { buildId: null } });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: {
                buildTimestamp: 123,
                tracksToBuild: [track],
                modifiedCards: 1,
                orphanedCards: 0,
                tracksToClear: [],
                modifiedTokens: expect.arrayContaining(['alpha', 'related']),
            },
        });
    });

    it('reports build failures from processTracks and still clears build IDs', async () => {
        const statusUpdates = jest.fn();
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const key = [profile, track];
        await (dictionaryDB as any)._ensureBuildId(key, 'build', { buildTs: 1000 });
        const yomitan = {
            tokenizeBulk: jest
                .fn<(texts: string[]) => Promise<unknown>>()
                .mockRejectedValue(new Error('tokenize failed')),
            tokenize: jest.fn(),
            verifyTokenizeResult: jest.fn(),
            lemmatize: jest.fn(),
            resetCache: jest.fn(),
        };

        await (dictionaryDB as any)._processTracks(
            profile,
            'build',
            new Map([[track, { dt: makeDictionaryTrack({ dictionaryAnkiWordFields: ['Word'] }), yomitan }]]),
            new Map([[1, makeModifiedCard()]]),
            new Map([[track, []]]),
            [],
            0,
            new Set<string>(),
            [key],
            1,
            123,
            statusUpdates
        );

        expect(consoleError).toHaveBeenCalled();
        await expect(privateDb(dictionaryDB).meta.get(key)).resolves.toMatchObject({ ankiMeta: { buildId: null } });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: expect.objectContaining({
                code: DictionaryBuildAnkiCacheStateErrorCode.failedToBuild,
                msg: 'tokenize failed',
            }),
        });
    });

    it('reports noAnki when buildAnkiCache cannot obtain Anki permission', async () => {
        const statusUpdates = jest.fn();
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockAnkiOverrides.push({
            requestPermission: jest
                .fn<() => Promise<{ permission: string }>>()
                .mockResolvedValue({ permission: 'denied' }),
        });

        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true })]);
        await dictionaryDB.buildAnkiCache(profile, statusUpdates);

        expect(consoleError).toHaveBeenCalled();
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: {
                code: DictionaryBuildAnkiCacheStateErrorCode.noAnki,
                msg: 'permission denied',
                modifiedTokens: [],
            },
        });
    });

    it('reports noYomitan and clears build IDs when Yomitan is unavailable', async () => {
        const statusUpdates = jest.fn();
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockYomitanOverrides.push({
            version: jest.fn<() => Promise<string>>().mockRejectedValue(new Error('offline')),
        });

        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        await dictionaryDB.buildAnkiCache(profile, statusUpdates);

        expect(consoleError).toHaveBeenCalled();
        await expect(privateDb(dictionaryDB).meta.get([profile, track])).resolves.toMatchObject({
            ankiMeta: { buildId: null },
        });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: expect.objectContaining({
                code: DictionaryBuildAnkiCacheStateErrorCode.noYomitan,
                msg: 'offline',
                data: { track },
            }),
        });
    });

    it('reports concurrentBuild without syncing when an unexpired build is already active', async () => {
        const statusUpdates = jest.fn();
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const dateNow = jest.spyOn(Date, 'now').mockReturnValue(1000);
        await privateDb(dictionaryDB).meta.put(
            makeMetaRecord({
                ankiMeta: {
                    lastBuildStartedAt: 500,
                    lastBuildExpiresAt: 2000,
                    buildId: 'other-build',
                    settings: null,
                },
            })
        );

        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        await dictionaryDB.buildAnkiCache(profile, statusUpdates);

        expect(consoleError).toHaveBeenCalled();
        expect(mockYomitanInstances).toHaveLength(0);
        await expect(privateDb(dictionaryDB).meta.get([profile, track])).resolves.toMatchObject({
            ankiMeta: { buildId: 'other-build' },
        });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: expect.objectContaining({
                code: DictionaryBuildAnkiCacheStateErrorCode.concurrentBuild,
                data: { expiration: 2000 },
            }),
        });
        dateNow.mockRestore();
    });

    it('reports sync failures from buildAnkiCache and clears active build IDs', async () => {
        const statusUpdates = jest.fn();
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockAnkiOverrides.push({
            findNotes: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([10]),
            notesInfo: jest.fn<(noteIds: number[]) => Promise<any[]>>().mockResolvedValue([]),
        });

        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        await dictionaryDB.buildAnkiCache(profile, statusUpdates);

        expect(consoleError).toHaveBeenCalled();
        await expect(privateDb(dictionaryDB).meta.get([profile, track])).resolves.toMatchObject({
            ankiMeta: { buildId: null },
        });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: expect.objectContaining({
                code: DictionaryBuildAnkiCacheStateErrorCode.failedToSyncTrackStates,
                msg: 'Anki changed during cards record build, some notes info could not be retrieved.',
            }),
        });
    });

    it('orchestrates the build Anki cache pipeline for enabled tracks', async () => {
        const statusUpdates = jest.fn();
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryAnkiWordFields: ['Word'],
        });
        mockAnkiOverrides.push({
            findNotes: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([10]),
            notesInfo: jest
                .fn<(noteIds: number[]) => Promise<any[]>>()
                .mockResolvedValue([makeNoteInfo({ noteId: 10, cards: [1], mod: 100 })]),
            cardsModTime: jest
                .fn<(cardIds: number[]) => Promise<{ cardId: number; mod: number }[]>>()
                .mockResolvedValue([{ cardId: 1, mod: 100 }]),
            cardsInfo: jest
                .fn<(cardIds: number[], progress?: (progress: any) => Promise<void>) => Promise<any[]>>()
                .mockResolvedValue([{ cardId: 1, deckName: 'Japanese', modelName: 'Model', due: 0 }]),
            areSuspended: jest.fn<(cardIds: number[]) => Promise<boolean[]>>().mockResolvedValue([false]),
            findCards: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValueOnce([1]),
        });
        mockYomitanOverrides.push({
            tokenize: jest
                .fn<(text: string) => Promise<{ text: string }[][]>>()
                .mockResolvedValue([[{ text: 'alpha' }]]),
            lemmatize: jest.fn<(token: string) => Promise<string[]>>().mockResolvedValue(['alpha']),
        });

        useSettings([dictionaryTrack]);
        await dictionaryDB.buildAnkiCache(profile, statusUpdates);
        await waitForAnkiBuildToFinish();

        expect(mockAnkiInstances).toHaveLength(1);
        expect(mockYomitanInstances).toHaveLength(1);
        expect(mockYomitanInstances[0].version).toHaveBeenCalled();
        expect(mockAnkiInstances[0].findNotes).toHaveBeenCalledWith('"Word:_*"');
        expect(mockAnkiInstances[0].findCards).toHaveBeenCalledWith('is:new ("Word:_*")');
        await expect(privateDb(dictionaryDB).ankiCards.get([1, track, profile])).resolves.toMatchObject({
            cardId: 1,
            status: TokenStatus.UNKNOWN,
            data: { deckName: 'Japanese' },
        });
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('alpha', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toMatchObject({ cardIds: [1], lemmas: ['alpha'] });
        expect(statusUpdates).toHaveBeenCalledWith(
            expect.objectContaining({ type: DictionaryBuildAnkiCacheStateType.start })
        );
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ tracksToBuild: [track], modifiedCards: 1, modifiedTokens: [] }),
        });
    });

    it('does not sync disabled tracks and keeps existing cache records', async () => {
        const statusUpdates = jest.fn();
        const syncSpy = jest.spyOn(dictionaryDB as any, '_syncTrackStatesWithAnki');
        await seedTokens(
            makeTokenRecord({
                token: 'cached',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['cached'],
                cardIds: [1],
            })
        );
        await seedAnkiCards(makeAnkiCardRecord({ cardId: 1 }));

        useSettings([makeDictionaryTrack()]);
        await dictionaryDB.buildAnkiCache(profile, statusUpdates);

        expect(mockYomitanInstances).toHaveLength(0);
        expect(syncSpy).not.toHaveBeenCalled();
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('cached', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toBeDefined();
        await expect(privateDb(dictionaryDB).ankiCards.get([1, track, profile])).resolves.toBeDefined();
        expect(statusUpdates).toHaveBeenLastCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ modifiedTokens: [] }),
        });
    });

    it('clears Anki cache without syncing when an enabled track has no Anki fields', async () => {
        const statusUpdates = jest.fn();
        const syncSpy = jest.spyOn(dictionaryDB as any, '_syncTrackStatesWithAnki');
        await seedTokens(
            makeTokenRecord({
                token: 'cached',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['cached-lemma'],
                cardIds: [1],
            })
        );
        await seedAnkiCards(makeAnkiCardRecord({ cardId: 1 }));

        useSettings([
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAnkiWordFields: [],
                dictionaryAnkiSentenceFields: [],
            }),
        ]);
        await dictionaryDB.buildAnkiCache(profile, statusUpdates);

        expect(mockYomitanInstances).toHaveLength(0);
        expect(syncSpy).not.toHaveBeenCalled();
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('cached', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toBeUndefined();
        await expect(privateDb(dictionaryDB).ankiCards.get([1, track, profile])).resolves.toBeUndefined();
        expect(statusUpdates).toHaveBeenLastCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ tracksToClear: [track], orphanedCards: 1 }),
        });
    });

    it('clears existing Anki cache when Anki cache settings change before syncing', async () => {
        const statusUpdates = jest.fn();
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryAnkiWordFields: ['Word'],
        });
        await seedTokens(
            makeTokenRecord({
                token: 'cached',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['cached-lemma'],
                cardIds: [1],
            })
        );
        await seedAnkiCards(makeAnkiCardRecord({ cardId: 1 }));
        await privateDb(dictionaryDB).meta.put(
            makeMetaRecord({
                ankiMeta: {
                    lastBuildStartedAt: 1,
                    lastBuildExpiresAt: 2,
                    buildId: null,
                    settings: JSON.stringify({ stale: true }),
                },
            })
        );

        useSettings([dictionaryTrack]);
        await dictionaryDB.buildAnkiCache(profile, statusUpdates);
        await waitForAnkiBuildToFinish();

        expect(mockYomitanInstances).toHaveLength(1);
        expect(mockAnkiInstances[0].findNotes).toHaveBeenCalled();
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('cached', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toBeUndefined();
        await expect(privateDb(dictionaryDB).ankiCards.get([1, track, profile])).resolves.toBeUndefined();
        await expect(privateDb(dictionaryDB).meta.get([profile, track])).resolves.toMatchObject({
            ankiMeta: { settings: expect.stringContaining('dictionaryAnkiWordFields') },
        });
    });

    it('does not clear existing Anki cache when cache settings are unchanged', async () => {
        const statusUpdates = jest.fn();
        const dictionaryTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryAnkiWordFields: ['Word'],
        });
        const currentSettings = {
            ankiConnectUrl: defaultSettings.ankiConnectUrl,
            dictionaryYomitanUrl: dictionaryTrack.dictionaryYomitanUrl,
            dictionaryYomitanParser: dictionaryTrack.dictionaryYomitanParser,
            dictionaryYomitanScanLength: dictionaryTrack.dictionaryYomitanScanLength,
            dictionaryAnkiDecks: dictionaryTrack.dictionaryAnkiDecks,
            dictionaryAnkiWordFields: dictionaryTrack.dictionaryAnkiWordFields,
            dictionaryAnkiSentenceFields: dictionaryTrack.dictionaryAnkiSentenceFields,
            dictionaryAnkiMatureCutoff: dictionaryTrack.dictionaryAnkiMatureCutoff,
        };
        mockAnkiOverrides.push({
            findNotes: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([10]),
            notesInfo: jest
                .fn<(noteIds: number[]) => Promise<any[]>>()
                .mockResolvedValue([makeNoteInfo({ noteId: 10, cards: [1], mod: 100 })]),
            cardsModTime: jest
                .fn<(cardIds: number[]) => Promise<{ cardId: number; mod: number }[]>>()
                .mockResolvedValue([{ cardId: 1, mod: 100 }]),
        });
        await seedTokens(
            makeTokenRecord({
                token: 'cached',
                track,
                source: DictionaryTokenSource.ANKI_WORD,
                status: null,
                lemmas: ['cached-lemma'],
                cardIds: [1],
            })
        );
        await seedAnkiCards(makeAnkiCardRecord({ cardId: 1 }));
        await privateDb(dictionaryDB).meta.put(
            makeMetaRecord({
                ankiMeta: {
                    lastBuildStartedAt: 1,
                    lastBuildExpiresAt: 2,
                    buildId: null,
                    settings: JSON.stringify(currentSettings),
                },
            })
        );

        useSettings([dictionaryTrack]);
        await dictionaryDB.buildAnkiCache(profile, statusUpdates);
        await waitForAnkiBuildToFinish();

        expect(mockYomitanInstances).toHaveLength(1);
        expect(mockAnkiInstances[0].cardsInfo).not.toHaveBeenCalled();
        await expect(
            privateDb(dictionaryDB).tokens.get(tokenKey('cached', DictionaryTokenSource.ANKI_WORD, track))
        ).resolves.toBeDefined();
        await expect(privateDb(dictionaryDB).ankiCards.get([1, track, profile])).resolves.toBeDefined();
    });
});
