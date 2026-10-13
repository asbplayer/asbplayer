import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DictionaryBuildAnkiCacheStateErrorCode, DictionaryBuildAnkiCacheStateType } from '@project/common';
import type { Fetcher } from '@project/common';
import { AnkiAnnotations } from '@project/common/annotations/anki-annotations';
import { makeDictionaryTrack, makeSettings, makeStorage } from '@project/common/annotations/annotations-test-utils';
import { DictionaryProvider } from '@project/common/dictionary-db';
import type { DictionaryStatisticsAnkiSnapshot } from '@project/common/dictionary-statistics';
import { SettingsProvider, TokenStatus } from '@project/common/settings';
import type { DictionaryTrack } from '@project/common/settings';
import { MockSettingsStorage } from '@project/common/settings/mock-settings-storage';

interface AnkiRequest {
    action: string;
    params?: { query?: string; cards?: number[] };
}

type AnkiHandler = (request: AnkiRequest) => unknown;

const RECENT_QUERY_PREFIX = '(edited:1 OR rated:1) ';

const isRecentCardsQuery = (request: AnkiRequest) =>
    request.action === 'findCards' && request.params?.query?.startsWith(RECENT_QUERY_PREFIX) === true;

const isDueCardsQuery = (request: AnkiRequest) =>
    request.action === 'findCards' && request.params?.query?.startsWith('prop:due<=') === true;

/**
 * In-memory AnkiConnect endpoint: a handler returns a result or throws to produce an AnkiConnect error response.
 */
const makeAnkiConnect = (handler: AnkiHandler) => {
    const requests: AnkiRequest[] = [];
    const fetcher: Fetcher = {
        fetch: async (_url: string, request: AnkiRequest) => {
            requests.push(request);
            try {
                return { result: handler(request) ?? null, error: null };
            } catch (e) {
                return { result: null, error: (e as Error).message };
            }
        },
    };
    const requestsFor = (action: string) => requests.filter((request) => request.action === action);
    return { fetcher, requests, requestsFor };
};

const defaultHandler: AnkiHandler = (request) => {
    if (request.action === 'requestPermission') return { permission: 'granted' };
    if (request.action === 'findCards') return [];
    throw new Error(`unexpected Anki action: ${request.action}`);
};

const enabledTrack = (overrides: Partial<DictionaryTrack> = {}) =>
    makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryAnkiWordFields: ['Word'], ...overrides });

const makeSource = ({
    handler = defaultHandler,
    dictionaryTracks = [enabledTrack()],
    generateStatistics = false,
    profile = 'Profile',
}: {
    profile?: string | null;
    handler?: AnkiHandler;
    dictionaryTracks?: DictionaryTrack[];
    generateStatistics?: boolean;
} = {}) => {
    const storage = makeStorage();
    const settingsStorage = new MockSettingsStorage();
    settingsStorage.setData(makeSettings());
    const ankiConnect = makeAnkiConnect(handler);
    const snapshots: DictionaryStatisticsAnkiSnapshot[] = [];
    const tokensWereModified = jest.fn();
    const tracks = dictionaryTracks.map((dt, track) => ({ track, dt }));
    const source = new AnkiAnnotations({
        dictionaryProvider: new DictionaryProvider(storage as any),
        settingsProvider: new SettingsProvider(settingsStorage),
        fetcher: ankiConnect.fetcher,
        getProfile: () => profile,
        getTracks: () => tracks,
        generateStatistics: () => generateStatistics,
        tokensWereModified,
        replaceStatisticsSnapshot: (snapshot) => snapshots.push(snapshot),
    });
    return { source, storage, snapshots, tokensWereModified, ...ankiConnect };
};

const errorState = (code: DictionaryBuildAnkiCacheStateErrorCode) => ({
    type: DictionaryBuildAnkiCacheStateType.error,
    body: { code, msg: 'error', modifiedTokens: [] },
});

beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('AnkiAnnotations', () => {
    it('refreshes statistics after a cache stats event and reports modified tokens', async () => {
        const { source, snapshots, storage, tokensWereModified } = makeSource({ generateStatistics: true });

        await source.refresh();
        await source.refresh();
        expect(snapshots).toHaveLength(1);

        source.cacheStateChanged({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: { modifiedTokens: ['word'] },
        });
        await source.refresh();

        expect(tokensWereModified).toHaveBeenCalledWith(['word']);
        expect(snapshots).toHaveLength(2);
        expect(snapshots[1]).toEqual(expect.objectContaining({ available: true, dueCards: { 0: [], 1: [], 7: [] } }));
        expect(storage.buildAnkiCache).toHaveBeenCalledTimes(1);
    });

    it('does nothing before the profile is resolved or when there are no tracks', async () => {
        const unresolved = makeSource({ profile: null });
        const noTracks = makeSource({ dictionaryTracks: [] });

        await unresolved.source.refresh();
        await noTracks.source.refresh();

        expect(unresolved.requests).toEqual([]);
        expect(noTracks.requests).toEqual([]);
    });

    it('builds the cache once when AnkiConnect grants permission', async () => {
        const { source, storage } = makeSource();

        await source.refresh();
        await source.refresh();

        expect(storage.buildAnkiCache).toHaveBeenCalledTimes(1);
        expect(storage.buildAnkiCache).toHaveBeenCalledWith('Profile', expect.any(Object));
    });

    it('does not build the cache when permission is denied and asks again on the next refresh', async () => {
        const permissions = ['denied', 'granted'];
        const { source, storage, requestsFor } = makeSource({
            handler: (request) => {
                if (request.action === 'requestPermission') return { permission: permissions.shift() };
                return defaultHandler(request);
            },
        });

        await source.refresh();
        expect(storage.buildAnkiCache).not.toHaveBeenCalled();
        expect(requestsFor('findCards')).toEqual([]);

        await source.refresh();
        expect(requestsFor('requestPermission')).toHaveLength(2);
        expect(storage.buildAnkiCache).toHaveBeenCalledTimes(1);
    });

    it('runs only one refresh at a time', async () => {
        const { source, storage } = makeSource();
        let finishBuild!: () => void;
        storage.buildAnkiCache.mockImplementationOnce(
            () => new Promise<undefined>((r) => (finishBuild = () => r(undefined)))
        );

        const first = source.refresh();
        await source.refresh();
        await new Promise((resolve) => setTimeout(resolve, 0));
        finishBuild();
        await first;

        expect(storage.buildAnkiCache).toHaveBeenCalledTimes(1);
    });

    it('retries the cache build on the next refresh after it rejects', async () => {
        const { source, storage } = makeSource();
        storage.buildAnkiCache.mockRejectedValueOnce(new Error('build failed'));

        await source.refresh();
        await source.refresh();
        await source.refresh();

        expect(storage.buildAnkiCache).toHaveBeenCalledTimes(2);
    });

    describe('recently modified card polling', () => {
        it('queries merged fields across enabled tracks, restricted to their decks', async () => {
            const { source, requests } = makeSource({
                dictionaryTracks: [
                    enabledTrack({
                        dictionaryAnkiWordFields: ['Word', 'Shared'],
                        dictionaryAnkiSentenceFields: ['Sentence'],
                        dictionaryAnkiDecks: ['Mining'],
                    }),
                    enabledTrack({
                        dictionaryAnkiWordFields: ['Shared', 'Expression'],
                        dictionaryAnkiSentenceFields: [],
                        dictionaryAnkiDecks: ['Other'],
                    }),
                    makeDictionaryTrack({ dictionaryAnkiWordFields: ['Disabled'], dictionaryAnkiDecks: [] }),
                ],
            });

            await source.refresh();

            expect(requests.find(isRecentCardsQuery)?.params?.query).toBe(
                RECENT_QUERY_PREFIX +
                    '(("deck:Mining" OR "deck:Other") ("Word:_*" OR "Shared:_*" OR "Sentence:_*" OR "Expression:_*"))'
            );
        });

        it('queries all decks when any enabled track has an empty deck list', async () => {
            const { source, requests } = makeSource({
                dictionaryTracks: [
                    enabledTrack({ dictionaryAnkiDecks: ['Mining'] }),
                    enabledTrack({ dictionaryAnkiWordFields: ['Expression'], dictionaryAnkiDecks: [] }),
                ],
            });

            await source.refresh();

            expect(requests.find(isRecentCardsQuery)?.params?.query).toBe(
                RECENT_QUERY_PREFIX + '("Word:_*" OR "Expression:_*")'
            );
        });

        it('rebuilds the cache only when the set of recently modified cards changes after the baseline', async () => {
            const recentCards = [
                [1, 2],
                [2, 1],
                [2, 3],
            ];
            const { source, storage } = makeSource({
                handler: (request) => (isRecentCardsQuery(request) ? recentCards.shift() : defaultHandler(request)),
            });

            await source.refresh();
            await source.refresh();
            expect(storage.buildAnkiCache).toHaveBeenCalledTimes(1);

            await source.refresh();
            expect(storage.buildAnkiCache).toHaveBeenCalledTimes(2);
        });

        it('keeps the polling baseline after a concurrent build error', async () => {
            const { source, storage } = makeSource({
                handler: (request) => (isRecentCardsQuery(request) ? [1] : defaultHandler(request)),
            });
            await source.refresh();

            source.cacheStateChanged(errorState(DictionaryBuildAnkiCacheStateErrorCode.concurrentBuild));
            await source.refresh();

            expect(storage.buildAnkiCache).toHaveBeenCalledTimes(1);
        });

        it('rebuilds the cache after a terminal build error even if the modified cards are unchanged', async () => {
            const { source, storage } = makeSource({
                handler: (request) => (isRecentCardsQuery(request) ? [1] : defaultHandler(request)),
            });
            await source.refresh();

            source.cacheStateChanged(errorState(DictionaryBuildAnkiCacheStateErrorCode.failedToBuild));
            await source.refresh();

            expect(storage.buildAnkiCache).toHaveBeenCalledTimes(2);
        });

        it('reconnects and treats the next poll as a change after a polling failure', async () => {
            const recentCards: (number[] | Error)[] = [new Error('offline'), [1]];
            const { source, storage, requestsFor } = makeSource({
                handler: (request) => {
                    if (!isRecentCardsQuery(request)) return defaultHandler(request);
                    const next = recentCards.shift();
                    if (next instanceof Error) throw next;
                    return next;
                },
            });

            await source.refresh();
            await source.refresh();

            expect(requestsFor('requestPermission')).toHaveLength(2);
            expect(storage.buildAnkiCache).toHaveBeenCalledTimes(2);
        });
    });

    describe('statistics', () => {
        const cardRecord = {
            cardId: 7,
            status: TokenStatus.LEARNING,
            data: { deckName: 'Mining', modelName: 'Sentence', due: 3 },
        };

        it('does not publish statistics unless generation is enabled', async () => {
            const { source, snapshots } = makeSource({ generateStatistics: false });

            await source.refresh();

            expect(snapshots).toEqual([]);
        });

        it('publishes cached card details with due cards for each review window', async () => {
            const { source, snapshots, storage } = makeSource({
                generateStatistics: true,
                dictionaryTracks: [enabledTrack({ dictionaryAnkiDecks: ['Mining'] })],
                handler: (request) => {
                    if (isDueCardsQuery(request)) {
                        const due = Number(/prop:due<=(\d+)/.exec(request.params!.query!)![1]);
                        return [100 + due];
                    }
                    return defaultHandler(request);
                },
            });
            storage.getRecords.mockResolvedValue({
                tokenRecords: [],
                ankiCardRecords: { 0: { 7: cardRecord } },
                waniKaniSubjectRecords: {},
            });

            await source.refresh();

            expect(snapshots).toEqual([
                {
                    available: true,
                    progress: { current: 1, total: 1, startedAt: expect.any(Number) },
                    cardsInfo: { 7: cardRecord.data },
                    cardsStatus: { 7: TokenStatus.LEARNING },
                    dueCards: { 0: [100], 1: [101], 7: [107] },
                },
            ]);
        });

        it('requests card details from Anki when cached records lack them', async () => {
            const { source, snapshots, storage, requestsFor } = makeSource({
                generateStatistics: true,
                handler: (request) => {
                    if (request.action === 'cardsInfo') {
                        return [{ cardId: 7, deckName: 'Mining', modelName: 'Sentence', due: 5 }];
                    }
                    return defaultHandler(request);
                },
            });
            storage.getRecords.mockResolvedValue({
                tokenRecords: [],
                ankiCardRecords: { 0: { 7: { ...cardRecord, status: TokenStatus.GRADUATED, data: undefined } } },
                waniKaniSubjectRecords: {},
            });

            await source.refresh();

            expect(requestsFor('cardsInfo')[0].params?.cards).toEqual([7]);
            expect(snapshots[0]).toEqual(
                expect.objectContaining({
                    cardsInfo: { 7: { deckName: 'Mining', modelName: 'Sentence', due: 5 } },
                    cardsStatus: { 7: TokenStatus.GRADUATED },
                })
            );
        });

        it('publishes unavailable statistics on failure, then reconnects and retries', async () => {
            let offline = true;
            const { source, snapshots, requestsFor } = makeSource({
                generateStatistics: true,
                handler: (request) => {
                    if (isDueCardsQuery(request) && offline) throw new Error('offline');
                    return defaultHandler(request);
                },
            });

            await source.refresh();
            expect(snapshots).toEqual([{ available: false, cardsInfo: {}, cardsStatus: {}, dueCards: {} }]);

            offline = false;
            await source.refresh();
            expect(requestsFor('requestPermission')).toHaveLength(2);
            expect(snapshots[1]).toEqual(expect.objectContaining({ available: true }));
        });
    });

    describe('scheduling', () => {
        it('refreshes when a card is modified or the polling interval elapses', async () => {
            let now = 1_000_000;
            jest.spyOn(Date, 'now').mockImplementation(() => now);
            const { source, requestsFor } = makeSource();
            const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

            source.refreshIfDue();
            await flush();
            expect(requestsFor('requestPermission')).toHaveLength(0);

            source.cardWasModified();
            source.refreshIfDue();
            await flush();
            expect(requestsFor('requestPermission')).toHaveLength(1);

            source.refreshIfDue();
            await flush();
            expect(requestsFor('findCards')).toHaveLength(1);

            now += 10_000;
            source.refreshIfDue();
            await flush();
            expect(requestsFor('findCards')).toHaveLength(2);
        });
    });

    describe('settings', () => {
        it('reports a change only when the AnkiConnect URL or API key changes', () => {
            const { source } = makeSource();
            const settings = makeSettings();

            expect(source.updateSettings(settings)).toBe(true);
            expect(source.updateSettings({ ...settings, dictionaryTracks: [] })).toBe(false);
            expect(source.updateSettings({ ...settings, ankiConnectUrl: 'http://other:8765' })).toBe(true);
            expect(
                source.updateSettings({ ...settings, ankiConnectUrl: 'http://other:8765', ankiConnectApiKey: 'k' })
            ).toBe(true);
        });
    });
});
