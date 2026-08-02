import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DictionaryProvider } from '@project/common/dictionary-db';
import {
    defaultSettings,
    DictionaryTokenSource,
    DictionaryTrack,
    SettingsProvider,
    TokenFrequencyAnnotation,
    TokenReadingAnnotation,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import { MockSettingsStorage } from '@project/common/settings/mock-settings-storage';
import {
    averageDisplay,
    clampPercent,
    countPercentOccurrencesDisplay,
    defaultDictionaryStatisticsSentenceSortDirection,
    defaultDictionaryStatisticsSentenceSortState,
    DictionaryStatistics,
    DictionaryStatisticsSentence,
    DictionaryStatisticsSentenceBucketEntry,
    DictionaryStatisticsSentenceBuckets,
    DictionaryStatisticsSnapshot,
    dictionaryStatisticsComprehensionBandForPercent,
    nextDictionaryStatisticsSentenceSortCategory,
    nextDictionaryStatisticsSentenceSortDirection,
    percent,
    percentDisplay,
    processDictionaryStatisticsAnkiTrackSnapshot,
    processDictionaryStatisticsSnapshot,
    processDictionaryStatisticsWaniKaniTrackSnapshot,
    processSimplifiedDictionaryStatistics,
    selectedRewatchSnapshotForTrack,
    sentenceComprehensionPointLabel,
    sentenceComprehensionXAxisLabels,
    sentenceDialogBucketData,
    statusSentenceBucketLabel,
    sortDictionaryStatisticsSentenceBucketEntries,
} from '@project/common/dictionary-statistics';

const makeDictionaryTrack = (overrides: Partial<DictionaryTrack> = {}): DictionaryTrack => ({
    ...defaultSettings.dictionaryTracks[0],
    dictionaryAnkiDecks: [...defaultSettings.dictionaryTracks[0].dictionaryAnkiDecks],
    dictionaryAnkiWordFields: [...defaultSettings.dictionaryTracks[0].dictionaryAnkiWordFields],
    dictionaryAnkiSentenceFields: [...defaultSettings.dictionaryTracks[0].dictionaryAnkiSentenceFields],
    dictionaryTokenStatusColors: [...defaultSettings.dictionaryTracks[0].dictionaryTokenStatusColors],
    dictionaryTokenStatusConfig: defaultSettings.dictionaryTracks[0].dictionaryTokenStatusConfig.map((config) => ({
        ...config,
    })),
    ...overrides,
});

const makeDisabledDictionaryTrack = (overrides: Partial<DictionaryTrack> = {}): DictionaryTrack =>
    makeDictionaryTrack({
        dictionaryColorizeSubtitles: false,
        dictionaryAutoGenerateStatistics: false,
        dictionaryTokenReadingAnnotation: TokenReadingAnnotation.NEVER,
        dictionaryDisplayIgnoredTokenReadings: false,
        dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.NEVER,
        ...overrides,
    });

const makeSettings = (dictionaryTracks: DictionaryTrack[]) => ({
    ...defaultSettings,
    dictionaryTracks,
});

const makeToken = (overrides: Record<string, unknown> = {}) => ({
    pos: [0, 5] as [number, number],
    states: [] as TokenState[],
    readings: [],
    status: TokenStatus.UNKNOWN,
    groupingKey: 'token:word',
    frequency: 1,
    ...overrides,
});

const makeSentence = (overrides: Partial<DictionaryStatisticsSentence> = {}): DictionaryStatisticsSentence => ({
    text: 'word',
    start: 0,
    end: 1000,
    track: 0,
    index: 0,
    tokenization: { tokens: [] },
    ...overrides,
});

const makeStorage = () => ({
    getAllTokens: jest.fn(async () => ({})),
    publishStatisticsSnapshot: jest.fn(async () => undefined),
});

const makeStatistics = (settings = makeSettings([makeDisabledDictionaryTrack()])) => {
    const storage = makeStorage();
    const provider = new DictionaryProvider(storage as any);
    const settingsStorage = new MockSettingsStorage();
    settingsStorage.setData(settings);
    const settingsProvider = new SettingsProvider(settingsStorage);
    const statistics = new DictionaryStatistics(settingsProvider, provider, 'media-id');

    return { statistics, settingsProvider, storage };
};

const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
};

const lastPublishedSnapshot = (storage: ReturnType<typeof makeStorage>) => {
    const calls = storage.publishStatisticsSnapshot.mock.calls as any[][];
    return calls[calls.length - 1]?.[1] as DictionaryStatisticsSnapshot | undefined;
};

const frequencyBucketCount = (trackSnapshot: { frequencyBuckets: { label: string; count: number }[] }, label: string) =>
    trackSnapshot.frequencyBuckets.find((bucket) => bucket.label === label)?.count;

const makeProcessingSnapshot = (): DictionaryStatisticsSnapshot => ({
    mediaId: 'media-id',
    settings: makeSettings([
        makeDictionaryTrack({
            dictionaryAutoGenerateStatistics: true,
            dictionaryAnkiTreatSuspended: TokenStatus.UNKNOWN,
        }),
    ]),
    anki: {
        cardsInfo: {},
        dueCards: {},
    },
    snapshots: [
        {
            track: 0,
            progress: { current: 2, total: 2, startedAt: 1 },
            statusColors: {
                [TokenStatus.UNCOLLECTED]: '#000000FF',
                [TokenStatus.UNKNOWN]: '#111111FF',
                [TokenStatus.LEARNING]: '#222222FF',
                [TokenStatus.GRADUATED]: '#333333FF',
                [TokenStatus.YOUNG]: '#444444FF',
                [TokenStatus.MATURE]: '#555555FF',
            },
            stats: {
                dictionary: {
                    tokens: {
                        alpha: {
                            source: DictionaryTokenSource.LOCAL,
                            statuses: [{ status: TokenStatus.LEARNING, suspended: false }],
                            states: [],
                        },
                        beta: {
                            source: DictionaryTokenSource.LOCAL,
                            statuses: [],
                            states: [],
                        },
                        gamma: {
                            source: DictionaryTokenSource.LOCAL,
                            statuses: [],
                            states: [],
                        },
                        ignored: {
                            source: DictionaryTokenSource.LOCAL,
                            statuses: [{ status: TokenStatus.MATURE, suspended: false }],
                            states: [TokenState.IGNORED],
                        },
                    },
                },
                sentences: {
                    1: makeSentence({
                        index: 1,
                        text: 'beta gamma ignored skip 123',
                        tokenization: {
                            tokens: [
                                makeToken({
                                    pos: [0, 4],
                                    groupingKey: 'token:beta',
                                    status: TokenStatus.UNCOLLECTED,
                                    frequency: 3000,
                                }),
                                makeToken({
                                    pos: [5, 10],
                                    groupingKey: 'token:gamma',
                                    status: TokenStatus.UNCOLLECTED,
                                    frequency: 25001,
                                }),
                                makeToken({
                                    pos: [11, 18],
                                    groupingKey: 'token:ignored',
                                    status: TokenStatus.UNKNOWN,
                                    states: [TokenState.IGNORED],
                                    frequency: 400,
                                }),
                                makeToken({ pos: [19, 23], groupingKey: undefined, frequency: 900 }),
                                makeToken({
                                    pos: [24, 27],
                                    groupingKey: 'token:number',
                                    status: TokenStatus.MATURE,
                                    frequency: 2,
                                }),
                            ],
                        },
                    }),
                    0: makeSentence({
                        index: 0,
                        text: 'alpha beta alpha',
                        tokenization: {
                            tokens: [
                                makeToken({
                                    pos: [0, 5],
                                    groupingKey: 'token:alpha',
                                    status: TokenStatus.LEARNING,
                                    frequency: 100,
                                }),
                                makeToken({
                                    pos: [6, 10],
                                    groupingKey: 'token:beta',
                                    status: TokenStatus.UNCOLLECTED,
                                    frequency: 3000,
                                }),
                                makeToken({
                                    pos: [11, 16],
                                    groupingKey: 'token:alpha',
                                    status: TokenStatus.UNKNOWN,
                                    frequency: 50,
                                }),
                            ],
                        },
                    }),
                },
            },
        },
    ],
});

const makeAnkiSnapshot = (): DictionaryStatisticsSnapshot => ({
    mediaId: 'media-id',
    settings: makeSettings([
        makeDictionaryTrack({
            dictionaryAutoGenerateStatistics: true,
            dictionaryAnkiTreatSuspended: TokenStatus.UNKNOWN,
        }),
    ]),
    anki: {
        available: true,
        progress: { current: 1, total: 2, startedAt: 10 },
        dueCards: {
            0: [10],
            1: [11],
            7: [11, 12],
        },
        cardsInfo: {
            10: { cardId: 10, deckName: 'Deck B', modelName: 'Model Y' } as any,
            11: { cardId: 11, deckName: 'Deck A', modelName: 'Model X' } as any,
            12: { cardId: 12, deckName: 'Deck A', modelName: 'Model Y' } as any,
        },
    },
    snapshots: [
        {
            track: 0,
            progress: { current: 2, total: 2, startedAt: 1 },
            statusColors: {
                [TokenStatus.UNCOLLECTED]: '#000000FF',
                [TokenStatus.UNKNOWN]: '#111111FF',
                [TokenStatus.LEARNING]: '#222222FF',
                [TokenStatus.GRADUATED]: '#333333FF',
                [TokenStatus.YOUNG]: '#444444FF',
                [TokenStatus.MATURE]: '#555555FF',
            },
            stats: {
                dictionary: {
                    tokens: {
                        alpha: {
                            source: DictionaryTokenSource.LOCAL,
                            statuses: [
                                { cardId: 10, status: TokenStatus.LEARNING, suspended: false },
                                { cardId: 11, status: TokenStatus.GRADUATED, suspended: true },
                            ],
                            states: [],
                        },
                        beta: {
                            source: DictionaryTokenSource.LOCAL,
                            statuses: [{ cardId: 12, status: TokenStatus.MATURE, suspended: false }],
                            states: [],
                        },
                        gamma: {
                            source: DictionaryTokenSource.LOCAL,
                            statuses: [{ cardId: 13, status: TokenStatus.LEARNING, suspended: false }],
                            states: [TokenState.IGNORED],
                        },
                    },
                },
                sentences: {
                    0: makeSentence({
                        text: 'alpha beta',
                        tokenization: {
                            tokens: [
                                makeToken({ pos: [0, 5], groupingKey: 'token:alpha', frequency: 100 }),
                                makeToken({ pos: [6, 10], groupingKey: 'beta', frequency: 6000 }),
                            ],
                        },
                    }),
                    1: makeSentence({
                        index: 1,
                        text: 'alpha gamma',
                        tokenization: {
                            tokens: [
                                makeToken({ pos: [0, 5], groupingKey: 'token:alpha', frequency: 100 }),
                                makeToken({ pos: [6, 11], groupingKey: 'token:gamma', frequency: 50 }),
                            ],
                        },
                    }),
                },
            },
        },
    ],
});

const makeUnknownFrequencySnapshot = (): DictionaryStatisticsSnapshot => ({
    mediaId: 'media-id',
    settings: makeSettings([makeDictionaryTrack({ dictionaryAutoGenerateStatistics: true })]),
    anki: {
        cardsInfo: {},
        dueCards: {},
    },
    snapshots: [
        {
            track: 0,
            progress: { current: 1, total: 1, startedAt: 1 },
            statusColors: {
                [TokenStatus.UNCOLLECTED]: '#000000FF',
                [TokenStatus.UNKNOWN]: '#111111FF',
                [TokenStatus.LEARNING]: '#222222FF',
                [TokenStatus.GRADUATED]: '#333333FF',
                [TokenStatus.YOUNG]: '#444444FF',
                [TokenStatus.MATURE]: '#555555FF',
            },
            stats: {
                dictionary: {
                    tokens: {
                        delta: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] },
                        epsilon: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] },
                    },
                },
                sentences: {
                    0: makeSentence({
                        text: 'delta epsilon',
                        tokenization: {
                            tokens: [
                                makeToken({
                                    pos: [0, 5],
                                    groupingKey: 'token:delta',
                                    status: TokenStatus.UNKNOWN,
                                    frequency: null,
                                }),
                                makeToken({
                                    pos: [6, 13],
                                    groupingKey: 'token:epsilon',
                                    status: TokenStatus.UNCOLLECTED,
                                    frequency: 1500,
                                }),
                            ],
                        },
                    }),
                },
            },
        },
    ],
});

const makeEntry = (
    index: number,
    overrides: Partial<DictionaryStatisticsSentenceBucketEntry> = {}
): DictionaryStatisticsSentenceBucketEntry => ({
    sentence: makeSentence({ index, text: `sentence-${index}` }),
    numConsideredTokens: 2,
    numKnownTokens: 1,
    numUnknownTokens: 0,
    numUncollectedTokens: 1,
    lowestFrequency: 100,
    highestOccurrences: 1,
    comprehensionPercent: 50,
    comprehensionBandIndex: 0,
    ...overrides,
});

beforeEach(() => {
    let now = 1;
    jest.spyOn(Date, 'now').mockImplementation(() => now++);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('DictionaryStatistics', () => {
    it('publishes undefined before initialization, sorts snapshots, and resets state', () => {
        const { statistics, storage } = makeStatistics();

        expect(statistics.hasStatistics()).toBe(false);
        statistics.publishSnapshot();
        expect(storage.publishStatisticsSnapshot).toHaveBeenLastCalledWith('media-id', undefined);

        statistics.init(2, 2);
        statistics.init(0, 1);
        statistics.ingest(makeSentence({ track: 2, index: 3, text: 'track-two' }));
        statistics.ingest(makeSentence({ track: 0, index: 1, text: 'track-zero' }));
        statistics.updateProgress(2, 1);
        statistics.replaceAnkiSnapshot({
            available: true,
            cardsInfo: { 9: { cardId: 9 } as any },
            dueCards: { 0: [9] },
        });
        statistics.publishSnapshot();

        const snapshot = lastPublishedSnapshot(storage)!;
        expect(statistics.hasStatistics()).toBe(true);
        expect(snapshot.mediaId).toBe('media-id');
        expect(snapshot.snapshots.map((trackSnapshot) => trackSnapshot.track)).toEqual([0, 2]);
        expect(snapshot.snapshots[0].progress.total).toBe(1);
        expect(snapshot.snapshots[1].progress.current).toBe(1);
        expect(snapshot.snapshots[0].stats.sentences[1].text).toBe('track-zero');
        expect(snapshot.snapshots[1].stats.sentences[3].text).toBe('track-two');
        expect(snapshot.anki).toEqual({ available: true, cardsInfo: { 9: { cardId: 9 } }, dueCards: { 0: [9] } });

        statistics.reset();
        expect(statistics.hasStatistics()).toBe(false);
        expect(storage.publishStatisticsSnapshot).toHaveBeenLastCalledWith('media-id', undefined);
    });

    it('throws for uninitialized track updates and ingestion', async () => {
        const enabledTrack = makeDictionaryTrack({ dictionaryAutoGenerateStatistics: true });
        const { statistics } = makeStatistics(makeSettings([enabledTrack]));

        expect(() => statistics.updateProgress(0, 1)).toThrow('Track 0 not initialized');
        expect(() => statistics.ingest(makeSentence({ track: 0 }))).toThrow('Track 0 not initialized');
        await expect(statistics.refreshDictionaryTokens('profile')).rejects.toThrow('Track 0 not initialized');
    });

    it('stores replaced Anki snapshots and avoids publishing before stats exist', () => {
        const { statistics, storage } = makeStatistics();

        statistics.replaceAnkiSnapshot({
            available: true,
            progress: { current: 0, total: 2, startedAt: 77 },
            cardsInfo: { 1: { cardId: 1 } as any },
            dueCards: {},
        });
        expect(storage.publishStatisticsSnapshot).not.toHaveBeenCalled();

        statistics.init(0, 2);
        statistics.replaceAnkiSnapshot({
            progress: { current: 1, total: 2, startedAt: 999 },
            cardsInfo: { 2: { cardId: 2 } as any },
            dueCards: {},
        });

        expect(lastPublishedSnapshot(storage)?.anki).toEqual({
            progress: { current: 1, total: 2, startedAt: 999 },
            cardsInfo: { 2: { cardId: 2 } },
            dueCards: {},
        });
    });

    it('stores replaced anki snapshots before initialization and publishes availability-only updates afterward', () => {
        const { statistics, storage } = makeStatistics();

        statistics.replaceAnkiSnapshot({ available: false, cardsInfo: {}, dueCards: {} });
        expect(storage.publishStatisticsSnapshot).not.toHaveBeenCalled();

        statistics.init(0, 1);
        statistics.replaceAnkiSnapshot({ available: false, cardsInfo: {}, dueCards: {} });

        expect(lastPublishedSnapshot(storage)?.anki).toEqual({ available: false, cardsInfo: {}, dueCards: {} });
    });

    it('stores WaniKani snapshots before initialization and publishes a top-level copy afterward', () => {
        const { statistics, storage } = makeStatistics();
        const initial = {
            0: { available: true, assignments: [{ id: 1 }], subjects: { 1: { id: 1 } } },
        } as any;

        statistics.replaceWaniKaniSnapshots(initial);
        expect(storage.publishStatisticsSnapshot).not.toHaveBeenCalled();

        initial[1] = { available: false, assignments: [], subjects: {} };
        statistics.init(0, 1);
        statistics.publishSnapshot();
        expect(lastPublishedSnapshot(storage)?.waniKani).toEqual({
            0: { available: true, assignments: [{ id: 1 }], subjects: { 1: { id: 1 } } },
        });

        statistics.replaceWaniKaniSnapshots({
            1: { available: false, assignments: [], subjects: {} },
        });
        expect(lastPublishedSnapshot(storage)?.waniKani).toEqual({
            1: { available: false, assignments: [], subjects: {} },
        });
    });

    it('refreshes dictionary tokens for enabled tracks, skips disabled tracks, and normalizes status colors', async () => {
        const enabledWithPartialConfig = makeDictionaryTrack({
            dictionaryAutoGenerateStatistics: true,
            dictionaryTokenStatusColors: [
                '#111111',
                '#222222',
                ...defaultSettings.dictionaryTracks[0].dictionaryTokenStatusColors.slice(2),
            ],
            dictionaryTokenStatusConfig: [
                { color: '#111111', alpha: 'AA', display: true },
                { color: '#222222', alpha: 'BB', display: true },
            ],
        });
        const disabledTrack = makeDisabledDictionaryTrack();
        const enabledWithDefaults = makeDictionaryTrack({ dictionaryAutoGenerateStatistics: true });
        const settings = makeSettings([enabledWithPartialConfig, disabledTrack, enabledWithDefaults]);
        const { statistics, settingsProvider, storage } = makeStatistics(settings);

        statistics.init(0, 1);
        statistics.init(2, 2);

        storage.getAllTokens
            .mockResolvedValueOnce({ alpha: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] } })
            .mockResolvedValueOnce({ beta: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] } });

        await statistics.refreshDictionaryTokens('profile');

        expect((storage.getAllTokens.mock.calls as any[][]).map((call) => call[1])).toEqual([0, 2]);

        const snapshot = lastPublishedSnapshot(storage)!;
        expect(snapshot.settings).toEqual({
            dictionaryTracks: await settingsProvider.getSingle('dictionaryTracks'),
        });
        expect(snapshot.snapshots[0].stats.dictionary.tokens).toEqual({
            alpha: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] },
        });
        expect(snapshot.snapshots[1].stats.dictionary.tokens).toEqual({
            beta: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] },
        });
        expect(snapshot.snapshots[0].statusColors[0]).toBe('#111111AA');
        expect(snapshot.snapshots[0].statusColors[1]).toBe('#222222BB');
        expect(snapshot.snapshots[0].statusColors[2]).toBe(
            `${defaultSettings.dictionaryTracks[0].dictionaryTokenStatusConfig[2].color}${defaultSettings.dictionaryTracks[0].dictionaryTokenStatusConfig[2].alpha}`
        );
        expect(snapshot.snapshots[1].statusColors[0]).toBe(
            `${enabledWithDefaults.dictionaryTokenStatusConfig[0].color}${enabledWithDefaults.dictionaryTokenStatusConfig[0].alpha}`
        );
    });

    it('blocks stale publishes that started before reset', async () => {
        const settings = makeSettings([makeDictionaryTrack({ dictionaryAutoGenerateStatistics: true })]);
        const { statistics, storage } = makeStatistics(settings);
        const pendingTokens =
            deferred<Record<string, { source: DictionaryTokenSource; statuses: never[]; states: never[] }>>();

        statistics.init(0, 1);
        const tokenRequestStarted = deferred<void>();
        storage.getAllTokens.mockImplementationOnce(() => {
            tokenRequestStarted.resolve();
            return pendingTokens.promise;
        });

        const refreshPromise = statistics.refreshDictionaryTokens('profile');
        await tokenRequestStarted.promise;

        statistics.reset();
        pendingTokens.resolve({ alpha: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] } });
        await refreshPromise;

        expect(storage.publishStatisticsSnapshot).toHaveBeenCalledTimes(1);
        expect(storage.publishStatisticsSnapshot).toHaveBeenCalledWith('media-id', undefined);
    });

    it('rejects refresh failures after publishing completed track snapshots', async () => {
        const settings = makeSettings([
            makeDictionaryTrack({ dictionaryAutoGenerateStatistics: true }),
            makeDictionaryTrack({ dictionaryAutoGenerateStatistics: true }),
        ]);
        const { statistics, storage } = makeStatistics(settings);
        const firstTrackTokens =
            deferred<Record<string, { source: DictionaryTokenSource; statuses: never[]; states: never[] }>>();
        const secondTrackTokens =
            deferred<Record<string, { source: DictionaryTokenSource; statuses: never[]; states: never[] }>>();
        const firstTrackRequestStarted = deferred<void>();
        const secondTrackRequestStarted = deferred<void>();
        const firstTrackPublished = deferred<void>();

        statistics.init(0, 1);
        statistics.init(1, 1);
        storage.getAllTokens
            .mockImplementationOnce(() => {
                firstTrackRequestStarted.resolve();
                return firstTrackTokens.promise;
            })
            .mockImplementationOnce(() => {
                secondTrackRequestStarted.resolve();
                return secondTrackTokens.promise;
            });
        storage.publishStatisticsSnapshot.mockImplementationOnce(async () => {
            firstTrackPublished.resolve();
        });

        const refreshPromise = statistics.refreshDictionaryTokens('profile');
        await Promise.all([firstTrackRequestStarted.promise, secondTrackRequestStarted.promise]);
        firstTrackTokens.resolve({ alpha: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] } });
        await firstTrackPublished.promise;

        expect(lastPublishedSnapshot(storage)?.snapshots[0].stats.dictionary.tokens).toEqual({
            alpha: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] },
        });

        secondTrackTokens.reject(new Error('track failed'));
        await expect(refreshPromise).rejects.toThrow('track failed');
    });
});

describe('dictionary-statistics view helpers', () => {
    it('handles clamp, percent, and display helpers at key boundaries', () => {
        expect(clampPercent(-10)).toBe(0);
        expect(clampPercent(75)).toBe(75);
        expect(clampPercent(120)).toBe(100);

        expect(percent(0, 0)).toBe(0);
        expect(percent(1, 2)).toBe(50);
        expect(percentDisplay(100)).toBe('100%');
        expect(percentDisplay(99.9994)).toBe('99.999%');
        expect(percentDisplay(9.94)).toBe('9.9%');
        expect(averageDisplay(1)).toBe('1.0');
        expect(countPercentOccurrencesDisplay(1, 2, 3)).toBe('1 · 50.0% (3)');
    });

    it('maps comprehension bands and x-axis labels for 0, 1, 2, and many points', () => {
        expect(dictionaryStatisticsComprehensionBandForPercent(-1).label).toBe('<60');
        expect(dictionaryStatisticsComprehensionBandForPercent(60).label).toBe('60+');
        expect(dictionaryStatisticsComprehensionBandForPercent(95).label).toBe('95+');
        expect(dictionaryStatisticsComprehensionBandForPercent(120).label).toBe('95+');
        expect(
            sentenceComprehensionPointLabel({
                sentence: makeSentence({ index: 1 }),
                comprehensionPercent: 75,
                comprehensionBandIndex: 1,
            })
        ).toBe('#2 · 75.0%');

        expect(sentenceComprehensionXAxisLabels([])).toEqual([{ value: 1, position: 0 }]);
        expect(
            sentenceComprehensionXAxisLabels([
                { sentence: makeSentence(), comprehensionPercent: 50, comprehensionBandIndex: 0 },
            ])
        ).toEqual([{ value: 1, position: 0 }]);
        expect(
            sentenceComprehensionXAxisLabels([
                { sentence: makeSentence({ index: 0 }), comprehensionPercent: 50, comprehensionBandIndex: 0 },
                { sentence: makeSentence({ index: 1 }), comprehensionPercent: 75, comprehensionBandIndex: 1 },
            ])
        ).toEqual([{ value: 1, position: 0 }]);

        const manyLabels = sentenceComprehensionXAxisLabels(
            Array.from({ length: 120 }, (_, index) => ({
                sentence: makeSentence({ index }),
                comprehensionPercent: 50,
                comprehensionBandIndex: 0,
            }))
        );
        expect(manyLabels.map((label) => label.value)).toEqual([1, 50, 100]);
        expect(manyLabels[1].position).toBeCloseTo((49 / 119) * 100, 6);
        expect(manyLabels[2].position).toBeCloseTo((99 / 119) * 100, 6);
    });

    it('cycles default sort helpers and toggles direction', () => {
        expect(defaultDictionaryStatisticsSentenceSortDirection('index')).toBe('asc');
        expect(defaultDictionaryStatisticsSentenceSortDirection('occurrences')).toBe('desc');
        expect(defaultDictionaryStatisticsSentenceSortState()).toEqual({ sort: 'index', direction: 'asc' });
        expect(defaultDictionaryStatisticsSentenceSortState('frequency')).toEqual({
            sort: 'frequency',
            direction: 'asc',
        });

        expect(nextDictionaryStatisticsSentenceSortCategory({ sort: 'index', direction: 'asc' })).toEqual({
            sort: 'frequency',
            direction: 'asc',
        });
        expect(nextDictionaryStatisticsSentenceSortCategory({ sort: 'comprehension', direction: 'desc' })).toEqual({
            sort: 'index',
            direction: 'desc',
        });
        expect(nextDictionaryStatisticsSentenceSortDirection({ sort: 'index', direction: 'asc' })).toEqual({
            sort: 'index',
            direction: 'desc',
        });
        expect(nextDictionaryStatisticsSentenceSortDirection({ sort: 'index', direction: 'desc' })).toEqual({
            sort: 'index',
            direction: 'asc',
        });
    });

    it('returns sentence dialog data for all-known, uncollected, and unknown buckets', () => {
        const sentenceBuckets: DictionaryStatisticsSentenceBuckets = {
            allKnown: { count: 1, entries: [makeEntry(0)] },
            uncollected: [
                { tokenCount: 1, count: 1, entries: [makeEntry(1)] },
                { tokenCount: 2, count: 1, entries: [makeEntry(2)] },
            ],
            unknown: [
                { tokenCount: 1, count: 1, entries: [makeEntry(3)] },
                { tokenCount: 2, count: 1, entries: [makeEntry(4)] },
            ],
        };

        expect(
            sentenceDialogBucketData({ kind: 'allKnown' }, sentenceBuckets, {
                knownSentencesLabel: 'Known',
                uncollectedLabel: 'Uncollected',
                unknownLabel: 'Unknown',
            })
        ).toEqual({ label: 'Known', entries: [sentenceBuckets.allKnown.entries[0]] });

        expect(
            sentenceDialogBucketData({ kind: 'uncollected', groupIndex: 1 }, sentenceBuckets, {
                knownSentencesLabel: 'Known',
                uncollectedLabel: 'Uncollected',
                unknownLabel: 'Unknown',
            })
        ).toEqual({ label: '2+ Uncollected', entries: [sentenceBuckets.uncollected[1].entries[0]] });
        expect(statusSentenceBucketLabel(sentenceBuckets.uncollected[0], 'Uncollected')).toBe('1 Uncollected');
        expect(
            sentenceDialogBucketData({ kind: 'unknown', groupIndex: 0 }, sentenceBuckets, {
                knownSentencesLabel: 'Known',
                uncollectedLabel: 'Uncollected',
                unknownLabel: 'Unknown',
            })
        ).toEqual({ label: '1 Unknown', entries: [sentenceBuckets.unknown[0].entries[0]] });
        expect(
            sentenceDialogBucketData({ kind: 'unknown', groupIndex: 1 }, sentenceBuckets, {
                knownSentencesLabel: 'Known',
                uncollectedLabel: 'Uncollected',
                unknownLabel: 'Unknown',
            })
        ).toEqual({ label: '2+ Unknown', entries: [sentenceBuckets.unknown[1].entries[0]] });
        expect(statusSentenceBucketLabel(sentenceBuckets.unknown[0], 'Unknown')).toBe('1 Unknown');

        expect(
            sentenceDialogBucketData({ kind: 'uncollected', groupIndex: 9 }, sentenceBuckets, {
                knownSentencesLabel: 'Known',
                uncollectedLabel: 'Uncollected',
                unknownLabel: 'Unknown',
            })
        ).toBeUndefined();
        expect(
            sentenceDialogBucketData({ kind: 'unknown', groupIndex: 9 }, sentenceBuckets, {
                knownSentencesLabel: 'Known',
                uncollectedLabel: 'Uncollected',
                unknownLabel: 'Unknown',
            })
        ).toBeUndefined();
    });

    it('selects and clamps rewatch snapshots by track', () => {
        const trackSnapshot = processDictionaryStatisticsSnapshot(makeProcessingSnapshot())[0];

        expect(selectedRewatchSnapshotForTrack({ ...trackSnapshot, rewatchSnapshots: [] }, {})).toBeUndefined();
        expect(selectedRewatchSnapshotForTrack(trackSnapshot, {})?.rewatch).toBe(0);
        expect(selectedRewatchSnapshotForTrack(trackSnapshot, { 0: 99 })?.rewatch).toBe(2);
    });

    it('sorts sentence bucket entries deterministically across categories and directions', () => {
        const entries = [
            makeEntry(2, { lowestFrequency: 100, highestOccurrences: 1, comprehensionPercent: 80 }),
            makeEntry(0, { lowestFrequency: 50, highestOccurrences: 2, comprehensionPercent: 80 }),
            makeEntry(1, { lowestFrequency: 50, highestOccurrences: 1, comprehensionPercent: 60 }),
        ];

        expect(
            sortDictionaryStatisticsSentenceBucketEntries(entries, { sort: 'comprehension', direction: 'desc' }).map(
                (entry) => entry.sentence.index
            )
        ).toEqual([0, 2, 1]);

        expect(
            sortDictionaryStatisticsSentenceBucketEntries(entries, { sort: 'frequency', direction: 'asc' }).map(
                (entry) => entry.sentence.index
            )
        ).toEqual([0, 1, 2]);

        expect(
            sortDictionaryStatisticsSentenceBucketEntries(entries, { sort: 'occurrences', direction: 'desc' }).map(
                (entry) => entry.sentence.index
            )
        ).toEqual([0, 2, 1]);

        expect(
            sortDictionaryStatisticsSentenceBucketEntries(entries, { sort: 'index', direction: 'desc' }).map(
                (entry) => entry.sentence.index
            )
        ).toEqual([2, 1, 0]);
    });

    it('covers sort tie-break fallbacks for occurrences and index ordering', () => {
        const sameOccurrenceEntries = [
            makeEntry(2, { highestOccurrences: 1, lowestFrequency: 100, comprehensionPercent: 50 }),
            makeEntry(1, { highestOccurrences: 1, lowestFrequency: 100, comprehensionPercent: 50 }),
        ];
        expect(
            sortDictionaryStatisticsSentenceBucketEntries(sameOccurrenceEntries, {
                sort: 'occurrences',
                direction: 'asc',
            }).map((entry) => entry.sentence.index)
        ).toEqual([1, 2]);

        const sameOccurrenceDifferentFrequency = [
            makeEntry(2, { highestOccurrences: 1, comprehensionPercent: 50, lowestFrequency: 300 }),
            makeEntry(1, { highestOccurrences: 1, comprehensionPercent: 50, lowestFrequency: 100 }),
        ];
        expect(
            sortDictionaryStatisticsSentenceBucketEntries(sameOccurrenceDifferentFrequency, {
                sort: 'occurrences',
                direction: 'asc',
            }).map((entry) => entry.lowestFrequency)
        ).toEqual([300, 100]);

        const sameIndexDifferentFrequency = [
            makeEntry(0, { lowestFrequency: 200, highestOccurrences: 1, comprehensionPercent: 40 }),
            makeEntry(0, { lowestFrequency: 100, highestOccurrences: 1, comprehensionPercent: 40 }),
        ];
        expect(
            sortDictionaryStatisticsSentenceBucketEntries(sameIndexDifferentFrequency, {
                sort: 'index',
                direction: 'asc',
            }).map((entry) => entry.lowestFrequency)
        ).toEqual([100, 200]);

        const sameIndexDifferentOccurrences = [
            makeEntry(0, { lowestFrequency: 100, highestOccurrences: 1, comprehensionPercent: 40 }),
            makeEntry(0, { lowestFrequency: 100, highestOccurrences: 3, comprehensionPercent: 40 }),
        ];
        expect(
            sortDictionaryStatisticsSentenceBucketEntries(sameIndexDifferentOccurrences, {
                sort: 'index',
                direction: 'asc',
            }).map((entry) => entry.highestOccurrences)
        ).toEqual([3, 1]);

        const sameIndexDifferentComprehension = [
            makeEntry(0, { lowestFrequency: 100, highestOccurrences: 1, comprehensionPercent: 40 }),
            makeEntry(0, { lowestFrequency: 100, highestOccurrences: 1, comprehensionPercent: 70 }),
        ];
        expect(
            sortDictionaryStatisticsSentenceBucketEntries(sameIndexDifferentComprehension, {
                sort: 'index',
                direction: 'asc',
            }).map((entry) => entry.comprehensionPercent)
        ).toEqual([70, 40]);

        const identicalEntries = [
            makeEntry(0, { lowestFrequency: 100, highestOccurrences: 1, comprehensionPercent: 40 }),
            makeEntry(0, { lowestFrequency: 100, highestOccurrences: 1, comprehensionPercent: 40 }),
        ];
        expect(
            sortDictionaryStatisticsSentenceBucketEntries(identicalEntries, {
                sort: 'index',
                direction: 'asc',
            })
        ).toEqual(identicalEntries);
    });

    it('covers sort tie-break fallbacks for comprehension and frequency ordering', () => {
        const sameComprehensionDifferentOccurrences = [
            makeEntry(2, { comprehensionPercent: 80, lowestFrequency: 100, highestOccurrences: 1 }),
            makeEntry(1, { comprehensionPercent: 80, lowestFrequency: 100, highestOccurrences: 3 }),
        ];
        expect(
            sortDictionaryStatisticsSentenceBucketEntries(sameComprehensionDifferentOccurrences, {
                sort: 'comprehension',
                direction: 'desc',
            }).map((entry) => entry.highestOccurrences)
        ).toEqual([3, 1]);

        const sameComprehensionFullyTied = [
            makeEntry(2, { comprehensionPercent: 80, lowestFrequency: 100, highestOccurrences: 1 }),
            makeEntry(1, { comprehensionPercent: 80, lowestFrequency: 100, highestOccurrences: 1 }),
        ];
        expect(
            sortDictionaryStatisticsSentenceBucketEntries(sameComprehensionFullyTied, {
                sort: 'comprehension',
                direction: 'desc',
            }).map((entry) => entry.sentence.index)
        ).toEqual([1, 2]);

        const sameFrequencyDifferentOccurrences = [
            makeEntry(2, { lowestFrequency: 100, comprehensionPercent: 80, highestOccurrences: 1 }),
            makeEntry(1, { lowestFrequency: 100, comprehensionPercent: 80, highestOccurrences: 3 }),
        ];
        expect(
            sortDictionaryStatisticsSentenceBucketEntries(sameFrequencyDifferentOccurrences, {
                sort: 'frequency',
                direction: 'asc',
            }).map((entry) => entry.highestOccurrences)
        ).toEqual([3, 1]);

        const sameFrequencyFullyTied = [
            makeEntry(2, { lowestFrequency: 100, comprehensionPercent: 80, highestOccurrences: 1 }),
            makeEntry(1, { lowestFrequency: 100, comprehensionPercent: 80, highestOccurrences: 1 }),
        ];
        expect(
            sortDictionaryStatisticsSentenceBucketEntries(sameFrequencyFullyTied, {
                sort: 'frequency',
                direction: 'asc',
            }).map((entry) => entry.sentence.index)
        ).toEqual([1, 2]);
    });

    it('processes simplified and full track snapshots with merged tokens, buckets, and rewatch projections', () => {
        const snapshot = makeProcessingSnapshot();

        const fullTrackSnapshot = processDictionaryStatisticsSnapshot(snapshot)[0];
        expect(processDictionaryStatisticsSnapshot(undefined)).toEqual([]);
        expect(fullTrackSnapshot.progressPercent).toBe(100);
        expect(fullTrackSnapshot.numDictionaryKnownTokens).toBe(1);
        expect(fullTrackSnapshot.numDictionaryIgnoredTokens).toBe(1);
        expect(fullTrackSnapshot.numUniqueTokens).toBe(4);
        expect(fullTrackSnapshot.consideredTokens).toBe(3);
        expect(fullTrackSnapshot.numIgnoredTokens).toBe(1);
        expect(fullTrackSnapshot.numIgnoredOccurrences).toBe(1);
        expect(fullTrackSnapshot.numKnownTokens).toBe(1);
        expect(fullTrackSnapshot.knownPercent).toBeCloseTo(100 / 3, 6);
        expect(fullTrackSnapshot.comprehensionPercent).toBeCloseTo(10, 6);
        expect(fullTrackSnapshot.averageWordsPerSentence).toBe(2);
        expect(fullTrackSnapshot.averageKnownWordsPerSentence).toBe(0.5);
        expect(fullTrackSnapshot.sentenceTotals.processedSentenceCount).toBe(2);
        expect(fullTrackSnapshot.sentenceTotals.totalWords).toBe(4);
        expect(fullTrackSnapshot.sentenceTotals.totalKnownWords).toBe(1);
        expect(fullTrackSnapshot.sentenceComprehensionPoints.map((point) => point.sentence.index)).toEqual([0, 1]);
        expect(fullTrackSnapshot.allSentenceEntries.map((entry) => entry.numUncollectedTokens)).toEqual([1, 2]);
        expect(fullTrackSnapshot.sentenceBuckets.allKnown.count).toBe(0);
        expect(fullTrackSnapshot.sentenceBuckets.uncollected[0].count).toBe(1);
        expect(fullTrackSnapshot.sentenceBuckets.uncollected[1].count).toBe(1);
        expect(frequencyBucketCount(fullTrackSnapshot, '1-1000')).toBe(1);
        expect(frequencyBucketCount(fullTrackSnapshot, '2001-5000')).toBe(1);
        expect(frequencyBucketCount(fullTrackSnapshot, '20000+')).toBe(1);
        expect(frequencyBucketCount(fullTrackSnapshot, 'Unknown')).toBe(0);
        expect(fullTrackSnapshot.rewatchSnapshots).toHaveLength(3);
        expect(fullTrackSnapshot.rewatchSnapshots[0].rewatch).toBe(0);
        expect(fullTrackSnapshot.rewatchSnapshots[1].rewatch).toBe(1);
        expect(fullTrackSnapshot.rewatchSnapshots[1].numKnownTokens).toBe(2);
        expect(fullTrackSnapshot.rewatchSnapshots[1].numDictionaryKnownTokens).toBe(2);
        expect(fullTrackSnapshot.rewatchSnapshots[1].sentenceBuckets.allKnown.count).toBe(1);
        expect(fullTrackSnapshot.rewatchSnapshots[2].rewatch).toBe(2);
        expect(fullTrackSnapshot.rewatchSnapshots[2].numKnownTokens).toBe(3);
        expect(fullTrackSnapshot.rewatchSnapshots[2].sentenceBuckets.allKnown.count).toBe(2);

        const simplifiedTrackSnapshot = processSimplifiedDictionaryStatistics(snapshot)[0];
        expect(processSimplifiedDictionaryStatistics(undefined)).toEqual([]);
        expect(simplifiedTrackSnapshot.progress).toEqual(snapshot.snapshots[0].progress);
        expect(simplifiedTrackSnapshot.comprehensionPercent).toBeCloseTo(10, 6);
        expect(simplifiedTrackSnapshot.sentenceBuckets.uncollected[0].count).toBe(1);
        expect(simplifiedTrackSnapshot.sentenceBuckets.uncollected[1].count).toBe(1);
    });

    it('processes anki track snapshots with due counts, deck grouping, suspended cards, and fallback grouping keys', () => {
        const snapshot = makeAnkiSnapshot();
        snapshot.anki.cardsInfo[20] = { cardId: 20, deckName: 'Deck C' } as any;
        snapshot.anki.cardsInfo[21] = { cardId: 21, modelName: 'Model Z' } as any;
        snapshot.snapshots[0].stats.dictionary.tokens.theta = {
            source: DictionaryTokenSource.LOCAL,
            statuses: [{ cardId: 20, status: TokenStatus.LEARNING, suspended: false }],
            states: [],
        };
        snapshot.snapshots[0].stats.dictionary.tokens.nocard = {
            source: DictionaryTokenSource.LOCAL,
            statuses: [{ status: TokenStatus.LEARNING, suspended: false }],
            states: [],
        };
        snapshot.snapshots[0].stats.dictionary.tokens.nodeck = {
            source: DictionaryTokenSource.LOCAL,
            statuses: [{ cardId: 21, status: TokenStatus.LEARNING, suspended: false }],
            states: [],
        };
        snapshot.snapshots[0].stats.dictionary.tokens.skipped = {
            source: DictionaryTokenSource.LOCAL,
            statuses: [{ cardId: 22, status: TokenStatus.LEARNING, suspended: false }],
            states: [],
        };
        snapshot.snapshots[0].stats.sentences[2] = makeSentence({
            index: 2,
            text: 'orphan theta nocard nodeck skipped',
            tokenization: {
                tokens: [
                    makeToken({ pos: [0, 6], groupingKey: 'lemma:orphan', frequency: 10 }),
                    makeToken({ pos: [7, 12], groupingKey: 'token:theta', frequency: 10 }),
                    makeToken({ pos: [13, 19], groupingKey: 'token:nocard', frequency: 10 }),
                    makeToken({ pos: [20, 26], groupingKey: 'token:nodeck', frequency: 10 }),
                    makeToken({
                        pos: [27, 34],
                        groupingKey: 'token:skipped',
                        frequency: 10,
                        states: [TokenState.IGNORED],
                    }),
                ],
            },
        });

        const empty = processDictionaryStatisticsAnkiTrackSnapshot(undefined, 0);
        expect(empty).toEqual({
            available: undefined,
            progress: undefined,
            progressPercent: 0,
            dueCounts: { today: 0, tomorrow: 0, week: 0 },
            deckSnapshots: [],
        });

        const trackSnapshot = processDictionaryStatisticsAnkiTrackSnapshot(snapshot, 0);
        expect(trackSnapshot.available).toBe(true);
        expect(trackSnapshot.progressPercent).toBe(50);
        expect(trackSnapshot.dueCounts).toEqual({ today: 1, tomorrow: 1, week: 2 });
        expect(trackSnapshot.deckSnapshots.map((deck) => deck.deckName)).toEqual(['Deck A', 'Deck B']);

        expect(trackSnapshot.deckSnapshots[0]).toEqual(
            expect.objectContaining({
                deckName: 'Deck A',
                dueCounts: { today: 0, tomorrow: 1, week: 2 },
                suspendedCards: 1,
            })
        );
        expect(trackSnapshot.deckSnapshots[0].modelSnapshots.map((model) => model.modelName)).toEqual([
            'Model X',
            'Model Y',
        ]);
        expect(trackSnapshot.deckSnapshots[0].modelSnapshots[0].uniqueWords).toBe(1);
        expect(trackSnapshot.deckSnapshots[0].modelSnapshots[0].frequencyBuckets[0].count).toBe(1);
        expect(trackSnapshot.deckSnapshots[0].modelSnapshots[1].frequencyBuckets[3].count).toBe(1);

        expect(trackSnapshot.deckSnapshots[1]).toEqual(
            expect.objectContaining({
                deckName: 'Deck B',
                dueCounts: { today: 1, tomorrow: 0, week: 0 },
                suspendedCards: 0,
            })
        );
        expect(trackSnapshot.deckSnapshots[1].modelSnapshots[0].modelName).toBe('Model Y');
        expect(trackSnapshot.deckSnapshots[1].modelSnapshots[0].uniqueWords).toBe(1);

        expect(processDictionaryStatisticsAnkiTrackSnapshot(snapshot, 99).deckSnapshots).toEqual([]);
    });

    it('projects unknown Anki cards by deck into rewatch and deck stats', () => {
        const snapshot = makeUnknownFrequencySnapshot();
        snapshot.anki = {
            cardsStatus: {
                10: TokenStatus.UNKNOWN,
                20: TokenStatus.UNKNOWN,
            },
            cardsInfo: {
                10: { cardId: 10, deckName: 'Deck A', due: 0 } as any,
                20: { cardId: 20, deckName: 'Deck B', due: 1 } as any,
            },
            dueCards: {},
        };
        snapshot.snapshots[0].stats.dictionary.tokens.delta.statuses = [
            { cardId: 10, status: TokenStatus.UNKNOWN, suspended: false },
        ];
        snapshot.snapshots[0].stats.dictionary.tokens.epsilon.statuses = [
            { cardId: 20, status: TokenStatus.UNKNOWN, suspended: false },
        ];

        const currentTrackSnapshot = processDictionaryStatisticsSnapshot(snapshot)[0];
        expect(currentTrackSnapshot.numKnownTokens).toBe(0);
        expect(currentTrackSnapshot.ankiDeckStats).toEqual([
            { deckName: 'Deck A', knownWords: 0, totalWords: 1 },
            { deckName: 'Deck B', knownWords: 0, totalWords: 1 },
        ]);

        const projectedTrackSnapshot = processDictionaryStatisticsSnapshot(snapshot, {
            0: { ankiUnknownCardsByDeck: { 'Deck A': 1 } },
        })[0];

        expect(projectedTrackSnapshot.totalUnknownAnkiCards).toBe(2);
        expect(projectedTrackSnapshot.unknownAnkiCardsByDeck).toEqual([
            { deckName: 'Deck A', totalUnknownCards: 1 },
            { deckName: 'Deck B', totalUnknownCards: 1 },
        ]);
        expect(projectedTrackSnapshot.rewatchSnapshots[0].numKnownTokens).toBe(1);
        expect(projectedTrackSnapshot.rewatchSnapshots[0].sentenceTotals.totalKnownWords).toBe(1);
        expect(projectedTrackSnapshot.rewatchSnapshots[0].ankiDeckStats).toEqual([
            { deckName: 'Deck A', knownWords: 1, totalWords: 1 },
            { deckName: 'Deck B', knownWords: 0, totalWords: 1 },
        ]);
    });

    it('defaults missing anki metadata when a raw track snapshot exists', () => {
        const snapshot = makeAnkiSnapshot();
        snapshot.settings = makeSettings([]);
        snapshot.anki = { available: true } as any;

        const trackSnapshot = processDictionaryStatisticsAnkiTrackSnapshot(snapshot, 0);
        expect(trackSnapshot.available).toBe(true);
        expect(trackSnapshot.progress).toBeUndefined();
        expect(trackSnapshot.progressPercent).toBe(0);
        expect(trackSnapshot.dueCounts).toEqual({ today: 0, tomorrow: 0, week: 0 });
        expect(trackSnapshot.deckSnapshots).toEqual([]);
    });

    it('processes WaniKani track snapshots with due counts, frequency buckets, and level projections', () => {
        const now = new Date();
        const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const availableToday = new Date(todayStart + 12 * 60 * 60 * 1000).toISOString();
        const availableTomorrow = new Date(todayStart + 36 * 60 * 60 * 1000).toISOString();
        const snapshot: DictionaryStatisticsSnapshot = {
            mediaId: 'media-id',
            settings: makeSettings([makeDictionaryTrack({ dictionaryAutoGenerateStatistics: true })]),
            anki: {
                cardsInfo: {},
                dueCards: {},
            },
            waniKani: {
                0: {
                    available: true,
                    assignments: [
                        {
                            profile: 'Profile',
                            track: 0,
                            assignmentId: 1,
                            subjectId: 1,
                            status: TokenStatus.UNKNOWN,
                            data: { srs_stage: 1, hidden: false, available_at: availableToday },
                        },
                        {
                            profile: 'Profile',
                            track: 0,
                            assignmentId: 2,
                            subjectId: 2,
                            status: TokenStatus.UNKNOWN,
                            data: { srs_stage: 1, hidden: false, available_at: availableTomorrow },
                        },
                    ],
                    subjects: {
                        1: {
                            profile: 'Profile',
                            track: 0,
                            subjectId: 1,
                            data: {
                                characters: 'alpha',
                                hidden_at: null,
                                level: 2,
                                spaced_repetition_system_id: 1,
                            },
                        },
                        2: {
                            profile: 'Profile',
                            track: 0,
                            subjectId: 2,
                            data: {
                                characters: 'beta',
                                hidden_at: null,
                                level: 10,
                                spaced_repetition_system_id: 1,
                            },
                        },
                        3: {
                            profile: 'Profile',
                            track: 0,
                            subjectId: 3,
                            data: {
                                characters: 'gamma',
                                hidden_at: null,
                                level: 3,
                                spaced_repetition_system_id: 1,
                            },
                        },
                    },
                },
            },
            snapshots: [
                {
                    track: 0,
                    progress: { current: 1, total: 1, startedAt: 1 },
                    statusColors: makeProcessingSnapshot().snapshots[0].statusColors,
                    stats: {
                        dictionary: {
                            tokens: {
                                alpha: {
                                    source: DictionaryTokenSource.WANIKANI,
                                    statuses: [
                                        {
                                            status: TokenStatus.UNKNOWN,
                                            suspended: false,
                                            waniKani: {
                                                subjectId: 1,
                                                subjectLevel: 2,
                                                assignmentId: 1,
                                                availableAt: availableToday,
                                            },
                                        },
                                    ],
                                    states: [],
                                },
                                beta: {
                                    source: DictionaryTokenSource.WANIKANI,
                                    statuses: [
                                        {
                                            status: TokenStatus.UNKNOWN,
                                            suspended: false,
                                            waniKani: {
                                                subjectId: 2,
                                                subjectLevel: 10,
                                                assignmentId: 2,
                                                availableAt: availableTomorrow,
                                            },
                                        },
                                    ],
                                    states: [],
                                },
                                gamma: {
                                    source: DictionaryTokenSource.WANIKANI,
                                    statuses: [
                                        {
                                            status: TokenStatus.LEARNING,
                                            suspended: false,
                                            waniKani: {
                                                subjectId: 3,
                                                subjectLevel: 3,
                                                assignmentId: undefined,
                                                availableAt: undefined,
                                            },
                                        },
                                    ],
                                    states: [],
                                },
                                ignored: {
                                    source: DictionaryTokenSource.WANIKANI,
                                    statuses: [
                                        {
                                            status: TokenStatus.MATURE,
                                            suspended: false,
                                            waniKani: {
                                                subjectId: 4,
                                                subjectLevel: 1,
                                                assignmentId: 4,
                                                availableAt: availableToday,
                                            },
                                        },
                                    ],
                                    states: [TokenState.IGNORED],
                                },
                            },
                        },
                        sentences: {
                            0: makeSentence({
                                text: 'alpha beta gamma ignored',
                                tokenization: {
                                    tokens: [
                                        makeToken({
                                            pos: [0, 5],
                                            groupingKey: 'token:alpha',
                                            status: TokenStatus.UNKNOWN,
                                            frequency: 100,
                                        }),
                                        makeToken({
                                            pos: [6, 10],
                                            groupingKey: 'token:beta',
                                            status: TokenStatus.UNKNOWN,
                                            frequency: 3000,
                                        }),
                                        makeToken({
                                            pos: [11, 16],
                                            groupingKey: 'token:gamma',
                                            status: TokenStatus.LEARNING,
                                            frequency: null,
                                        }),
                                        makeToken({
                                            pos: [17, 24],
                                            groupingKey: 'token:ignored',
                                            status: TokenStatus.MATURE,
                                            states: [TokenState.IGNORED],
                                        }),
                                    ],
                                },
                            }),
                        },
                    },
                },
            ],
        };

        const empty = processDictionaryStatisticsWaniKaniTrackSnapshot(undefined, 0);
        expect(empty).toEqual({
            available: undefined,
            dueCounts: { today: 0, tomorrow: 0, week: 0 },
            uniqueWords: 0,
            frequencyBuckets: [],
        });

        const waniKaniTrackSnapshot = processDictionaryStatisticsWaniKaniTrackSnapshot(snapshot, 0);
        expect(waniKaniTrackSnapshot.available).toBe(true);
        expect(waniKaniTrackSnapshot.dueCounts).toEqual({ today: 1, tomorrow: 2, week: 2 });
        expect(waniKaniTrackSnapshot.uniqueWords).toBe(3);
        expect(frequencyBucketCount(waniKaniTrackSnapshot, '1-1000')).toBe(1);
        expect(frequencyBucketCount(waniKaniTrackSnapshot, '2001-5000')).toBe(1);
        expect(frequencyBucketCount(waniKaniTrackSnapshot, 'Unknown')).toBe(1);

        const projectedTrackSnapshot = processDictionaryStatisticsSnapshot(snapshot, { 0: { waniKaniLevel: 3 } })[0];
        expect(projectedTrackSnapshot.waniKaniStats).toEqual({ knownWords: 1, totalWords: 3 });
        expect(projectedTrackSnapshot.rewatchSnapshots[0].waniKaniStats).toEqual({
            level: 3,
            knownWords: 2,
            totalWords: 3,
        });
    });

    it('counts unknown non-ignored tokens and unknown-frequency buckets', () => {
        const trackSnapshot = processDictionaryStatisticsSnapshot(makeUnknownFrequencySnapshot())[0];

        expect(trackSnapshot.allSentenceEntries[0].numUnknownTokens).toBe(1);
        expect(trackSnapshot.allSentenceEntries[0].numUncollectedTokens).toBe(1);
        expect(frequencyBucketCount(trackSnapshot, 'Unknown')).toBe(1);
        expect(frequencyBucketCount(trackSnapshot, '1001-2000')).toBe(1);
    });

    it('assigns token frequencies at exact bucket boundaries', () => {
        const snapshot = makeUnknownFrequencySnapshot();
        const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa'];
        const frequencies = [1000, 1001, 2000, 2001, 5000, 5001, 10000, 10001, 20000, 20001];
        const text = words.join(' ');
        let pos = 0;
        snapshot.snapshots[0].stats.sentences = {
            0: makeSentence({
                text,
                tokenization: {
                    tokens: words.map((word, index) => {
                        const start = pos;
                        pos += word.length + 1;
                        return makeToken({
                            pos: [start, start + word.length],
                            groupingKey: `token:${word}`,
                            frequency: frequencies[index],
                        });
                    }),
                },
            }),
        };

        const trackSnapshot = processDictionaryStatisticsSnapshot(snapshot)[0];

        expect(frequencyBucketCount(trackSnapshot, '1-1000')).toBe(1);
        expect(frequencyBucketCount(trackSnapshot, '1001-2000')).toBe(2);
        expect(frequencyBucketCount(trackSnapshot, '2001-5000')).toBe(2);
        expect(frequencyBucketCount(trackSnapshot, '5001-10000')).toBe(2);
        expect(frequencyBucketCount(trackSnapshot, '10001-20000')).toBe(2);
        expect(frequencyBucketCount(trackSnapshot, '20000+')).toBe(1);
    });

    it('groups one and multiple unknown-token sentences into unknown sentence buckets', () => {
        const snapshot = makeUnknownFrequencySnapshot();
        snapshot.snapshots[0].stats.dictionary.tokens = {
            alpha: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] },
            beta: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] },
            delta: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] },
            epsilon: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] },
            gamma: { source: DictionaryTokenSource.LOCAL, statuses: [], states: [] },
        };
        snapshot.snapshots[0].stats.sentences = {
            0: makeSentence({
                text: 'alpha',
                tokenization: {
                    tokens: [
                        makeToken({
                            pos: [0, 5],
                            groupingKey: 'token:alpha',
                            status: TokenStatus.UNKNOWN,
                        }),
                    ],
                },
            }),
            1: makeSentence({
                index: 1,
                text: 'beta gamma',
                tokenization: {
                    tokens: [
                        makeToken({
                            pos: [0, 4],
                            groupingKey: 'token:beta',
                            status: TokenStatus.UNKNOWN,
                        }),
                        makeToken({
                            pos: [5, 10],
                            groupingKey: 'token:gamma',
                            status: TokenStatus.UNKNOWN,
                        }),
                    ],
                },
            }),
            2: makeSentence({
                index: 2,
                text: 'delta epsilon',
                tokenization: {
                    tokens: [
                        makeToken({
                            pos: [0, 5],
                            groupingKey: 'token:delta',
                            status: TokenStatus.UNKNOWN,
                        }),
                        makeToken({
                            pos: [6, 13],
                            groupingKey: 'token:epsilon',
                            status: TokenStatus.UNCOLLECTED,
                        }),
                    ],
                },
            }),
        };

        const trackSnapshot = processDictionaryStatisticsSnapshot(snapshot)[0];

        expect(trackSnapshot.sentenceBuckets.unknown[0].count).toBe(1);
        expect(trackSnapshot.sentenceBuckets.unknown[0].entries[0].sentence.index).toBe(0);
        expect(trackSnapshot.sentenceBuckets.unknown[0].entries[0].numUnknownTokens).toBe(1);
        expect(trackSnapshot.sentenceBuckets.unknown[1].count).toBe(1);
        expect(trackSnapshot.sentenceBuckets.unknown[1].entries[0].sentence.index).toBe(1);
        expect(trackSnapshot.sentenceBuckets.unknown[1].entries[0].numUnknownTokens).toBe(2);
        expect(trackSnapshot.sentenceBuckets.uncollected[0].entries[0].sentence.index).toBe(2);
        expect(trackSnapshot.sentenceBuckets.uncollected[0].entries[0].numUncollectedTokens).toBe(1);
    });
});
