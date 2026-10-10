import 'core-js/stable/structured-clone';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DictionaryBuildAnkiCacheStateErrorCode, DictionaryBuildAnkiCacheStateType } from '@project/common';
import type { DictionaryBuildAnkiCacheState } from '@project/common';
import type { AsbplayerSettings } from '@project/common/settings';
import { DictionaryTokenSource, TokenStatus } from '@project/common/settings';

const mockAnkiInstances: any[] = [];
const mockAnkiOverrides: any[] = [];
const mockYomitanInstances: any[] = [];
const mockYomitanOverrides: any[] = [];

let mockBuildIdCount = 0;
jest.mock('uuid', () => ({ v4: () => `test-build-id-${++mockBuildIdCount}` }));
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

import { DictionaryDB } from '@project/common/dictionary-db/dictionary-db';
import {
    makeAnkiCardRecord,
    makeDictionaryTrack,
    makeMetaRecord,
    makeNoteInfo,
    makeSettings,
    makeTokenRecord,
    otherProfile,
    otherTrack,
    privateDb,
    profile,
    track,
} from '@project/common/dictionary-db/dictionary-db-test-utils';

describe('DictionaryDB Anki cache', () => {
    let dictionaryDB: DictionaryDB;
    let settings: AsbplayerSettings;

    const useSettings = (dictionaryTracks = [makeDictionaryTrack()]) => {
        settings = makeSettings(dictionaryTracks);
        return settings;
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

    const stageAnkiNotes = (
        notes: ReturnType<typeof makeNoteInfo>[],
        options: {
            cardMods?: Record<number, number>;
            cardDecks?: Record<number, string>;
            suspendedCards?: number[];
            findCards?: (query: string) => number[];
            trackCount?: number;
        } = {}
    ) => {
        const cardIds = notes.flatMap((note) => note.cards);
        mockAnkiOverrides.push({
            findNotes: jest.fn<() => Promise<number[]>>().mockResolvedValue(notes.map((note) => note.noteId)),
            notesInfo: jest.fn<() => Promise<ReturnType<typeof makeNoteInfo>[]>>().mockResolvedValue(notes),
            cardsModTime: jest
                .fn<() => Promise<{ cardId: number; mod: number }[]>>()
                .mockResolvedValue(cardIds.map((cardId) => ({ cardId, mod: options.cardMods?.[cardId] ?? 100 }))),
            cardsInfo: jest
                .fn<() => Promise<{ cardId: number; deckName: string; modelName: string; due: number }[]>>()
                .mockResolvedValue(
                    cardIds.map((cardId) => ({
                        cardId,
                        deckName: options.cardDecks?.[cardId] ?? 'Japanese',
                        modelName: 'Model',
                        due: 0,
                    }))
                ),
            areSuspended: jest
                .fn<() => Promise<boolean[]>>()
                .mockResolvedValue(cardIds.map((cardId) => options.suspendedCards?.includes(cardId) ?? false)),
            findCards: jest.fn<(query: string) => Promise<number[]>>(
                async (query) => options.findCards?.(query) ?? (query.startsWith('is:new ') ? cardIds : [])
            ),
        });
        for (let i = 0; i < (options.trackCount ?? 1); i++) {
            mockYomitanOverrides.push({
                tokenize: jest.fn<(text: string) => Promise<{ text: string }[][]>>(async (text) => [[{ text }]]),
                lemmatize: jest.fn<(token: string) => Promise<string[]>>(async (token) => [token]),
            });
        }
    };

    /**
     * Mimics Anki's search for `is:new` card queries: a card matches when its deck satisfies the query's deck clause
     * (if any) and it has at least one of the queried fields.
     */
    const newCardsMatching =
        (cards: { cardId: number; deck: string; fields: string[] }[]) =>
        (query: string): number[] => {
            if (!query.startsWith('is:new ')) return [];
            const queryDecks = Array.from(query.matchAll(/"deck:([^"]+)"/g), (match) => match[1]);
            const queryFields = Array.from(query.matchAll(/"([^":]+):_\*"/g), (match) => match[1]);
            return cards
                .filter(
                    ({ deck, fields }) =>
                        (!queryDecks.length || queryDecks.some((d) => deck === d || deck.startsWith(`${d}::`))) &&
                        fields.some((field) => queryFields.includes(field))
                )
                .map(({ cardId }) => cardId);
        };

    const buildUntilComplete = async (statusUpdates = jest.fn<(state: DictionaryBuildAnkiCacheState) => void>()) => {
        let finish!: () => void;
        const finished = new Promise<void>((resolve) => {
            finish = resolve;
        });
        await dictionaryDB.buildAnkiCache(profile, (state) => {
            statusUpdates(state);
            if (
                state.type === DictionaryBuildAnkiCacheStateType.error ||
                (state.type === DictionaryBuildAnkiCacheStateType.stats &&
                    state.body !== undefined &&
                    'orphanedCards' in state.body)
            )
                finish();
        });
        await finished;
        return statusUpdates;
    };

    it('builds only matching deck and field cards through the public cache boundary', async () => {
        useSettings([
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAnkiDecks: ['Japanese', 'Mining'],
                dictionaryAnkiWordFields: ['Word'],
                dictionaryAnkiSentenceFields: ['Sentence'],
            }),
        ]);
        stageAnkiNotes(
            [
                makeNoteInfo({ noteId: 10, cards: [1], fields: { Word: { value: ' alpha ', order: 0 } } }),
                makeNoteInfo({ noteId: 20, cards: [2], fields: { Sentence: { value: ' sentence ', order: 0 } } }),
                makeNoteInfo({ noteId: 30, cards: [3], fields: { Word: { value: 'other', order: 0 } } }),
                makeNoteInfo({ noteId: 40, cards: [4], fields: { Unrelated: { value: 'ignored', order: 0 } } }),
            ],
            { cardDecks: { 2: 'Japanese::Anime', 3: 'Other', 4: 'Mining' }, suspendedCards: [2] }
        );

        await buildUntilComplete();

        const records = await dictionaryDB.getRecords(profile, track);
        expect(Object.keys(records.ankiCardRecords[track] ?? {})).toEqual(['1', '2']);
        expect(records.ankiCardRecords[track][1]).toMatchObject({ status: TokenStatus.UNKNOWN, suspended: false });
        expect(records.ankiCardRecords[track][2]).toMatchObject({ status: TokenStatus.UNKNOWN, suspended: true });
        expect(records.tokenRecords.filter((record) => record.source !== DictionaryTokenSource.LOCAL)).toEqual([
            expect.objectContaining({ token: 'alpha', source: DictionaryTokenSource.ANKI_WORD, cardIds: [1] }),
            expect.objectContaining({ token: 'sentence', source: DictionaryTokenSource.ANKI_SENTENCE, cardIds: [2] }),
        ]);
        expect(mockYomitanInstances[0].tokenize.mock.calls.map(([text]: [string]) => text)).toEqual([
            'alpha',
            'sentence',
        ]);
    });

    it('replaces changed card tokens while retaining references from unchanged cards', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        stageAnkiNotes([
            makeNoteInfo({ noteId: 10, cards: [1], fields: { Word: { value: 'old', order: 0 } } }),
            makeNoteInfo({ noteId: 20, cards: [2], fields: { Word: { value: 'old', order: 0 } } }),
        ]);
        await buildUntilComplete();

        stageAnkiNotes(
            [
                makeNoteInfo({ noteId: 10, cards: [1], mod: 150, fields: { Word: { value: 'new', order: 0 } } }),
                makeNoteInfo({ noteId: 20, cards: [2], fields: { Word: { value: 'old', order: 0 } } }),
            ],
            { cardMods: { 1: 150 } }
        );
        await buildUntilComplete();

        const records = await dictionaryDB.getRecords(profile, track);
        expect(records.tokenRecords).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ token: 'old', cardIds: [2] }),
                expect.objectContaining({ token: 'new', cardIds: [1] }),
            ])
        );
        expect(records.ankiCardRecords[track][1].modifiedAt).toBe(150);
        expect(records.ankiCardRecords[track][2].modifiedAt).toBe(100);
    });

    it('updates a reviewed card while leaving an unchanged note cached', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        const note = makeNoteInfo({ noteId: 10, cards: [1] });
        stageAnkiNotes([note]);
        await buildUntilComplete();

        stageAnkiNotes([note], {
            cardMods: { 1: 150 },
            suspendedCards: [1],
            findCards: (query) => (query.startsWith('is:learn ') ? [1] : []),
        });
        await buildUntilComplete();

        const records = await dictionaryDB.getRecords(profile, track);
        expect(records.ankiCardRecords[track][1]).toMatchObject({
            modifiedAt: 150,
            status: TokenStatus.LEARNING,
            suspended: true,
        });
        expect(records.tokenRecords).toEqual([expect.objectContaining({ token: 'alpha', cardIds: [1] })]);
    });

    it('reports an unclassifiable card through the public error callback', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        stageAnkiNotes([makeNoteInfo()], { findCards: () => [] });
        const statusUpdates = await buildUntilComplete();

        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: expect.objectContaining({
                code: DictionaryBuildAnkiCacheStateErrorCode.failedToSyncTrackStates,
                msg: 'Anki changed during status build, some cards statuses could not be determined.',
            }),
        });
        expect((await dictionaryDB.getRecords(profile, track)).ankiCardRecords[track]).toBeUndefined();
    });

    it('classifies cards through interval fallback when FSRS data is unavailable', async () => {
        useSettings([
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAnkiWordFields: ['Word'],
                dictionaryAnkiMatureCutoff: 20,
            }),
        ]);
        stageAnkiNotes(
            [1, 2, 3].map((cardId) =>
                makeNoteInfo({
                    noteId: cardId * 10,
                    cards: [cardId],
                    fields: { Word: { value: `word${cardId}`, order: 0 } },
                })
            ),
            {
                cardDecks: { 1: 'Deck A', 2: 'Deck B', 3: 'Deck C' },
                findCards: (query) => {
                    if (query.includes('prop:ivl<10')) return [1];
                    if (query.includes('prop:ivl>=10 prop:ivl<20')) return [2];
                    if (query.includes('prop:ivl>=20')) return [3];
                    return [];
                },
            }
        );

        await buildUntilComplete();

        const cards = (await dictionaryDB.getRecords(profile, track)).ankiCardRecords[track];
        expect([cards[1].status, cards[2].status, cards[3].status]).toEqual([
            TokenStatus.GRADUATED,
            TokenStatus.YOUNG,
            TokenStatus.MATURE,
        ]);
    });

    it('classifies cards through FSRS stability queries', async () => {
        useSettings([
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAnkiWordFields: ['Word'],
                dictionaryAnkiMatureCutoff: 20,
            }),
        ]);
        stageAnkiNotes(
            [1, 2, 3].map((cardId) =>
                makeNoteInfo({
                    noteId: cardId * 10,
                    cards: [cardId],
                    fields: { Word: { value: `word${cardId}`, order: 0 } },
                })
            ),
            {
                findCards: (query) => {
                    if (query.startsWith('prop:s>=0 ')) return [1, 2, 3];
                    if (query.includes('prop:s<10')) return [1];
                    if (query.includes('prop:s>=10 prop:s<20')) return [2];
                    if (query.includes('prop:s>=20')) return [3];
                    return [];
                },
            }
        );

        await buildUntilComplete();

        const cards = (await dictionaryDB.getRecords(profile, track)).ankiCardRecords[track];
        expect([cards[1].status, cards[2].status, cards[3].status]).toEqual([
            TokenStatus.GRADUATED,
            TokenStatus.YOUNG,
            TokenStatus.MATURE,
        ]);
    });

    it('removes orphaned cards and their tokens after Anki returns no notes', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        stageAnkiNotes([makeNoteInfo()]);
        await buildUntilComplete();
        expect((await dictionaryDB.getRecords(profile, track)).ankiCardRecords[track][1]).toBeDefined();

        stageAnkiNotes([]);
        const statusUpdates = await buildUntilComplete();

        const records = await dictionaryDB.getRecords(profile, track);
        expect(records.ankiCardRecords[track]).toBeUndefined();
        expect(records.tokenRecords).toEqual([]);
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ modifiedCards: 1, modifiedTokens: expect.arrayContaining(['alpha']) }),
        });
    });

    it('builds 101 cards across batches without dropping progress or records', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        stageAnkiNotes(
            Array.from({ length: 101 }, (_, index) => {
                const cardId = index + 1;
                return makeNoteInfo({
                    noteId: cardId * 10,
                    cards: [cardId],
                    fields: { Word: { value: `word${cardId}`, order: 0 } },
                });
            })
        );
        const statusUpdates = await buildUntilComplete();

        const records = await dictionaryDB.getRecords(profile, track);
        expect(records.tokenRecords).toHaveLength(101);
        expect(Object.keys(records.ankiCardRecords[track])).toHaveLength(101);
        expect(mockYomitanInstances[0].tokenizeBulk.mock.calls.map(([texts]: [string[]]) => texts.length)).toEqual([
            100, 1,
        ]);
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.progress,
            body: expect.objectContaining({ current: 100, total: 101 }),
        });
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.progress,
            body: expect.objectContaining({ current: 101, total: 101 }),
        });
    });

    it('skips card details and tokenization when a subsequent build has no changes', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        const note = makeNoteInfo();
        stageAnkiNotes([note]);
        await buildUntilComplete();

        stageAnkiNotes([note]);
        const statusUpdates = await buildUntilComplete();

        expect(mockAnkiInstances[1].cardsInfo).not.toHaveBeenCalled();
        expect(mockYomitanInstances[1].tokenize).not.toHaveBeenCalled();
        expect((await dictionaryDB.getRecords(profile, track)).tokenRecords).toEqual([
            expect.objectContaining({ token: 'alpha', cardIds: [1] }),
        ]);
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ modifiedCards: 0, orphanedCards: 0 }),
        });
    });

    it('reports incomplete card modification data through the public error callback', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        stageAnkiNotes([makeNoteInfo()]);
        mockAnkiOverrides[0].cardsModTime = jest.fn<() => Promise<[]>>().mockResolvedValue([]);

        const statusUpdates = await buildUntilComplete();

        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: expect.objectContaining({
                code: DictionaryBuildAnkiCacheStateErrorCode.failedToSyncTrackStates,
                msg: 'Anki changed during cards record build, some cards mod time could not be retrieved.',
            }),
        });
        expect((await dictionaryDB.getRecords(profile, track)).ankiCardRecords[track]).toBeUndefined();
    });

    it('reports tokenization failure and leaves no partial cache output', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        stageAnkiNotes([makeNoteInfo()]);
        mockYomitanOverrides[0].tokenizeBulk = jest
            .fn<() => Promise<void>>()
            .mockRejectedValue(new Error('tokenize failed'));

        const statusUpdates = await buildUntilComplete();

        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: expect.objectContaining({
                code: DictionaryBuildAnkiCacheStateErrorCode.failedToBuild,
                msg: 'tokenize failed',
            }),
        });
        const records = await dictionaryDB.getRecords(profile, track);
        expect(records.tokenRecords).toEqual([]);
        expect(records.ankiCardRecords[track]).toBeUndefined();
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

    it('reports unavailable Yomitan and allows a subsequent build', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockYomitanOverrides.push({
            version: jest.fn<() => Promise<string>>().mockRejectedValue(new Error('offline')),
        });
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        const statusUpdates = jest.fn();

        await dictionaryDB.buildAnkiCache(profile, statusUpdates);

        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: expect.objectContaining({
                code: DictionaryBuildAnkiCacheStateErrorCode.noYomitan,
                msg: 'offline',
                data: { track },
            }),
        });
        stageAnkiNotes([]);
        const retry = await buildUntilComplete();
        expect(retry).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ tracksToBuild: [track] }),
        });
    });

    it('reports a concurrent build and allows work after its expiration', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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
        const statusUpdates = jest.fn();

        await dictionaryDB.buildAnkiCache(profile, statusUpdates);

        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: expect.objectContaining({
                code: DictionaryBuildAnkiCacheStateErrorCode.concurrentBuild,
                data: { expiration: 2000 },
            }),
        });
        expect(mockYomitanInstances).toHaveLength(0);

        dateNow.mockReturnValue(3000);
        stageAnkiNotes([]);
        const afterExpiration = await buildUntilComplete();
        expect(afterExpiration).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ tracksToBuild: [track] }),
        });
    });

    it('reports missing note details and allows a subsequent build', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockAnkiOverrides.push({
            findNotes: jest.fn<(query: string) => Promise<number[]>>().mockResolvedValue([10]),
            notesInfo: jest.fn<(noteIds: number[]) => Promise<any[]>>().mockResolvedValue([]),
        });
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        const statusUpdates = jest.fn();

        await dictionaryDB.buildAnkiCache(profile, statusUpdates);

        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: expect.objectContaining({
                code: DictionaryBuildAnkiCacheStateErrorCode.failedToSyncTrackStates,
                msg: 'Anki changed during cards record build, some notes info could not be retrieved.',
            }),
        });
        stageAnkiNotes([]);
        const retry = await buildUntilComplete();
        expect(retry).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ tracksToBuild: [track] }),
        });
    });

    it('publishes cached cards, tokens, and related lemma modifications', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        stageAnkiNotes([makeNoteInfo()]);
        await seedTokens(
            makeTokenRecord({ token: 'related', lemmas: ['alpha', 'related-lemma'] }),
            makeTokenRecord({ token: 'other-profile-related', profile: otherProfile, lemmas: ['alpha'] })
        );

        const statusUpdates = await buildUntilComplete();

        const records = await dictionaryDB.getRecords(profile, track);
        expect(records.ankiCardRecords[track][1]).toMatchObject({
            cardId: 1,
            status: TokenStatus.UNKNOWN,
            data: { deckName: 'Japanese' },
        });
        expect(records.tokenRecords).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    token: 'alpha',
                    source: DictionaryTokenSource.ANKI_WORD,
                    cardIds: [1],
                    lemmas: ['alpha'],
                }),
            ])
        );
        expect(statusUpdates).toHaveBeenCalledWith(
            expect.objectContaining({ type: DictionaryBuildAnkiCacheStateType.start })
        );
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.progress,
            body: expect.objectContaining({
                modifiedTokens: expect.arrayContaining(['alpha', 'related', 'related-lemma']),
            }),
        });
        const publishedTokens = statusUpdates.mock.calls.flatMap(([state]) => state.body?.modifiedTokens ?? []);
        expect(publishedTokens).not.toContain('other-profile-related');
    });

    it('retains cached records when a track is disabled', async () => {
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
        const statusUpdates = jest.fn();

        await dictionaryDB.buildAnkiCache(profile, statusUpdates);

        const records = await dictionaryDB.getRecords(profile, track);
        expect(records.tokenRecords).toEqual([expect.objectContaining({ token: 'cached', cardIds: [1] })]);
        expect(records.ankiCardRecords[track][1]).toBeDefined();
        expect(statusUpdates).toHaveBeenLastCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ modifiedTokens: [] }),
        });
    });

    it('clears cached records when an enabled track has no Anki fields', async () => {
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
        const statusUpdates = jest.fn();

        await dictionaryDB.buildAnkiCache(profile, statusUpdates);

        const records = await dictionaryDB.getRecords(profile, track);
        expect(records.tokenRecords).toEqual([]);
        expect(records.ankiCardRecords[track]).toBeUndefined();
        expect(statusUpdates).toHaveBeenLastCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ tracksToClear: [track], orphanedCards: 1 }),
        });
    });

    it('clears the old cache after Anki field settings change', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        stageAnkiNotes([makeNoteInfo()]);
        await buildUntilComplete();
        expect((await dictionaryDB.getRecords(profile, track)).tokenRecords).toHaveLength(1);

        useSettings([
            makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiSentenceFields: ['Sentence'] }),
        ]);
        stageAnkiNotes([]);
        const statusUpdates = await buildUntilComplete();

        const records = await dictionaryDB.getRecords(profile, track);
        expect(records.tokenRecords).toEqual([]);
        expect(records.ankiCardRecords[track]).toBeUndefined();
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ tracksToClear: [track], orphanedCards: 1 }),
        });
    });

    it('restricts Anki searches to configured decks unless a track searches all decks', async () => {
        useSettings([
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAnkiWordFields: ['Word'],
                dictionaryAnkiDecks: ['Mining'],
            }),
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAnkiWordFields: ['Word'],
                dictionaryAnkiDecks: ['Japanese'],
            }),
        ]);
        stageAnkiNotes([makeNoteInfo()], { cardDecks: { 1: 'Mining' }, trackCount: 2 });
        await buildUntilComplete();

        expect(mockAnkiInstances[0].findNotes).toHaveBeenCalledWith('("deck:Mining" OR "deck:Japanese") ("Word:_*")');
        expect(mockAnkiInstances[0].findCards).toHaveBeenCalledWith('is:new (("deck:Mining") ("Word:_*"))');

        useSettings([
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAnkiWordFields: ['Word'],
                dictionaryAnkiDecks: ['Mining'],
            }),
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAnkiWordFields: ['Word'],
                dictionaryAnkiDecks: [],
            }),
        ]);
        stageAnkiNotes([makeNoteInfo()], { cardDecks: { 1: 'Mining' }, trackCount: 2 });
        await buildUntilComplete();

        expect(mockAnkiInstances[1].findNotes).toHaveBeenCalledWith('"Word:_*"');
    });

    it('requests card details only for notes that contain configured fields', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        stageAnkiNotes([
            makeNoteInfo({ noteId: 10, cards: [1] }),
            makeNoteInfo({ noteId: 40, cards: [4], fields: { Unrelated: { value: 'ignored', order: 0 } } }),
        ]);

        await buildUntilComplete();

        expect(mockAnkiInstances[0].cardsInfo).toHaveBeenCalledWith([1], expect.any(Function));
        expect(Object.keys((await dictionaryDB.getRecords(profile, track)).ankiCardRecords[track])).toEqual(['1']);
    });

    it('prefers FSRS stability over the interval fallback when a card matches both', async () => {
        useSettings([
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAnkiWordFields: ['Word'],
                dictionaryAnkiMatureCutoff: 20,
            }),
        ]);
        stageAnkiNotes(
            [1, 2].map((cardId) =>
                makeNoteInfo({
                    noteId: cardId * 10,
                    cards: [cardId],
                    fields: { Word: { value: `word${cardId}`, order: 0 } },
                })
            ),
            {
                findCards: (query) => {
                    if (query.startsWith('prop:s>=0 ')) return [1];
                    if (query.includes('prop:s<10')) return [1];
                    if (query.includes('prop:ivl>=20')) return [1, 2];
                    return [];
                },
            }
        );

        await buildUntilComplete();

        const cards = (await dictionaryDB.getRecords(profile, track)).ankiCardRecords[track];
        expect([cards[1].status, cards[2].status]).toEqual([TokenStatus.GRADUATED, TokenStatus.MATURE]);
    });

    it('moves a token to the card that now contains it when both cards change in one build', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        stageAnkiNotes([
            makeNoteInfo({ noteId: 10, cards: [1], fields: { Word: { value: 'alpha', order: 0 } } }),
            makeNoteInfo({ noteId: 30, cards: [3], fields: { Word: { value: 'gamma', order: 0 } } }),
        ]);
        await buildUntilComplete();

        stageAnkiNotes(
            [
                makeNoteInfo({ noteId: 10, cards: [1], mod: 150, fields: { Word: { value: 'beta', order: 0 } } }),
                makeNoteInfo({ noteId: 30, cards: [3], mod: 150, fields: { Word: { value: 'alpha', order: 0 } } }),
            ],
            { cardMods: { 1: 150, 3: 150 } }
        );
        await buildUntilComplete();

        const tokens = (await dictionaryDB.getRecords(profile, track)).tokenRecords
            .map(({ token, cardIds }) => ({ token, cardIds }))
            .sort((lhs, rhs) => lhs.token.localeCompare(rhs.token));
        expect(tokens).toEqual([
            { token: 'alpha', cardIds: [3] },
            { token: 'beta', cardIds: [1] },
        ]);
    });

    it('removes a card from a track whose decks no longer include it while keeping it for a matching track', async () => {
        useSettings([
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAnkiWordFields: ['Word'],
                dictionaryAnkiDecks: ['Mining'],
            }),
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAnkiWordFields: ['Word'],
                dictionaryAnkiDecks: ['Other'],
            }),
        ]);
        stageAnkiNotes([makeNoteInfo()], {
            cardDecks: { 1: 'Mining' },
            trackCount: 2,
            findCards: newCardsMatching([{ cardId: 1, deck: 'Mining', fields: ['Word'] }]),
        });
        await buildUntilComplete();
        expect((await dictionaryDB.getRecords(profile, track)).ankiCardRecords[track][1]).toBeDefined();

        stageAnkiNotes([makeNoteInfo()], {
            cardMods: { 1: 150 },
            cardDecks: { 1: 'Other' },
            trackCount: 2,
            findCards: newCardsMatching([{ cardId: 1, deck: 'Other', fields: ['Word'] }]),
        });
        await buildUntilComplete();

        const moved = await dictionaryDB.getRecords(profile, track);
        expect(moved.ankiCardRecords[track]).toBeUndefined();
        expect(moved.tokenRecords).toEqual([]);
        const destination = await dictionaryDB.getRecords(profile, otherTrack);
        expect(destination.ankiCardRecords[otherTrack][1]).toMatchObject({ data: { deckName: 'Other' } });
        expect(destination.tokenRecords).toEqual([expect.objectContaining({ token: 'alpha', cardIds: [1] })]);
    });

    it('removes a card from a track whose fields were removed from the note while keeping it for another track', async () => {
        useSettings([
            makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] }),
            makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Expression'] }),
        ]);
        stageAnkiNotes(
            [
                makeNoteInfo({
                    fields: { Word: { value: 'alpha', order: 0 }, Expression: { value: 'beta', order: 1 } },
                }),
            ],
            {
                trackCount: 2,
                findCards: newCardsMatching([{ cardId: 1, deck: 'Japanese', fields: ['Word', 'Expression'] }]),
            }
        );
        await buildUntilComplete();
        expect((await dictionaryDB.getRecords(profile, track)).ankiCardRecords[track][1]).toBeDefined();

        stageAnkiNotes([makeNoteInfo({ mod: 150, fields: { Expression: { value: 'beta', order: 1 } } })], {
            trackCount: 2,
            findCards: newCardsMatching([{ cardId: 1, deck: 'Japanese', fields: ['Expression'] }]),
        });
        await buildUntilComplete();

        const removed = await dictionaryDB.getRecords(profile, track);
        expect(removed.ankiCardRecords[track]).toBeUndefined();
        expect(removed.tokenRecords).toEqual([]);
        const kept = await dictionaryDB.getRecords(profile, otherTrack);
        expect(kept.ankiCardRecords[otherTrack][1]).toBeDefined();
        expect(kept.tokenRecords).toEqual([expect.objectContaining({ token: 'beta', cardIds: [1] })]);
    });

    it('leaves another profile with the same card IDs untouched when cards change or are removed', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        const otherProfileToken = makeTokenRecord({
            profile: otherProfile,
            track,
            source: DictionaryTokenSource.ANKI_WORD,
            status: null,
            cardIds: [1],
        });
        await seedTokens(otherProfileToken);
        await seedAnkiCards(makeAnkiCardRecord({ profile: otherProfile }));
        const expectOtherProfileUnchanged = async () => {
            const records = await dictionaryDB.getRecords(otherProfile, track);
            expect(records.tokenRecords).toEqual([expect.objectContaining({ token: 'alpha', cardIds: [1] })]);
            expect(records.ankiCardRecords[track][1]).toBeDefined();
        };
        stageAnkiNotes([makeNoteInfo()]);
        await buildUntilComplete();

        stageAnkiNotes([makeNoteInfo({ mod: 150, fields: { Word: { value: 'beta', order: 0 } } })], {
            cardMods: { 1: 150 },
        });
        await buildUntilComplete();
        await expectOtherProfileUnchanged();

        stageAnkiNotes([]);
        await buildUntilComplete();
        await expectOtherProfileUnchanged();
        expect((await dictionaryDB.getRecords(profile, track)).tokenRecords).toEqual([]);
    });

    it('drops a card whose configured fields became blank without failing the build', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        // Anki's `"Word:_*"` search matches whitespace-only values, so the card is still returned by status queries
        const findCards = newCardsMatching([{ cardId: 1, deck: 'Japanese', fields: ['Word'] }]);
        stageAnkiNotes([makeNoteInfo()], { findCards });
        await buildUntilComplete();
        expect((await dictionaryDB.getRecords(profile, track)).ankiCardRecords[track][1]).toBeDefined();

        const blankNote = makeNoteInfo({ mod: 150, fields: { Word: { value: '   ', order: 0 } } });
        stageAnkiNotes([blankNote], { findCards });
        const statusUpdates = await buildUntilComplete();

        expect(statusUpdates).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: DictionaryBuildAnkiCacheStateType.error })
        );
        const records = await dictionaryDB.getRecords(profile, track);
        expect(records.ankiCardRecords[track]).toBeUndefined();
        expect(records.tokenRecords).toEqual([]);

        stageAnkiNotes([blankNote], { findCards });
        const nextBuild = await buildUntilComplete();
        expect(mockAnkiInstances[2].cardsInfo).not.toHaveBeenCalled();
        expect(nextBuild).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ modifiedCards: 0, orphanedCards: 0 }),
        });
    });

    it('classifies other cards when a modified card has only blank configured fields', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        stageAnkiNotes(
            [
                makeNoteInfo({ noteId: 10, cards: [1], fields: { Word: { value: ' ', order: 0 } } }),
                makeNoteInfo({ noteId: 20, cards: [2], fields: { Word: { value: 'beta', order: 0 } } }),
            ],
            {
                findCards: newCardsMatching([
                    { cardId: 1, deck: 'Japanese', fields: ['Word'] },
                    { cardId: 2, deck: 'Japanese', fields: ['Word'] },
                ]),
            }
        );

        const statusUpdates = await buildUntilComplete();

        expect(statusUpdates).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: DictionaryBuildAnkiCacheStateType.error })
        );
        const records = await dictionaryDB.getRecords(profile, track);
        expect(Object.keys(records.ankiCardRecords[track])).toEqual(['2']);
        expect(records.tokenRecords).toEqual([expect.objectContaining({ token: 'beta', cardIds: [2] })]);
    });

    it('does not reprocess an uncached blank-field card on later builds', async () => {
        useSettings([makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'] })]);
        const notes = [
            makeNoteInfo({ noteId: 10, cards: [1], fields: { Word: { value: ' ', order: 0 } } }),
            makeNoteInfo({ noteId: 20, cards: [2], fields: { Word: { value: 'beta', order: 0 } } }),
        ];
        const findCards = newCardsMatching([
            { cardId: 1, deck: 'Japanese', fields: ['Word'] },
            { cardId: 2, deck: 'Japanese', fields: ['Word'] },
        ]);
        stageAnkiNotes(notes, { findCards });
        await buildUntilComplete();
        expect(mockAnkiInstances[0].cardsInfo).toHaveBeenCalledWith([2], expect.any(Function));

        stageAnkiNotes(notes, { findCards });
        const statusUpdates = await buildUntilComplete();

        expect(mockAnkiInstances[1].cardsInfo).not.toHaveBeenCalled();
        expect(statusUpdates).toHaveBeenCalledWith({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: expect.objectContaining({ modifiedCards: 0, orphanedCards: 0 }),
        });
    });
});
