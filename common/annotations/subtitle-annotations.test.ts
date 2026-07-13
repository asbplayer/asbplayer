import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
    DictionaryBuildAnkiCacheStateErrorCode,
    DictionaryBuildAnkiCacheStateType,
    DictionaryBuildWaniKaniCacheStateErrorCode,
    DictionaryBuildWaniKaniCacheStateType,
} from '@project/common';
import {
    ApplyStrategy,
    DictionaryTokenSource,
    TokenMatchStrategy,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import { Anki } from '@project/common/anki';
import { REVIEW_DUES } from '@project/common/dictionary-statistics';
import { SubtitleAnnotations, TrackState } from './subtitle-annotations';
import {
    makeDictionaryTrack,
    makeDictionaryTracks,
    makeSettings,
    makeSubtitle,
    makeSubtitleAnnotations,
    makeToken,
} from './annotations-test-utils';

const privateAnnotations = (subtitleAnnotations: SubtitleAnnotations) => subtitleAnnotations as any;

const makeYomitan = (overrides: Record<string, unknown> = {}) => ({
    resetCache: jest.fn(),
    tokenizeBulk: jest.fn(async (texts: string[]) => texts.map((text) => [{ text }])),
    tokenize: jest.fn(async (text: string) => [[{ text }]]),
    verifyTokenizeResult: jest.fn(),
    lemmatize: jest.fn(async (text: string) => [text]),
    frequency: jest.fn(async () => 42),
    pitchAccent: jest.fn(async () => undefined),
    getSupportsBulkFrequency: jest.fn(() => true),
    getSupportsBulkPitchAccent: jest.fn(() => true),
    getSupportsTermEntriesBulk: jest.fn(() => false),
    inferFrequencyModesFromTokenOccurrences: jest.fn(),
    ...overrides,
});

beforeEach(() => {
    jest.restoreAllMocks();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('TrackState', () => {
    it('filters lemmas by script according to dictionaryMatchAcrossScripts', async () => {
        const crossScript = new TrackState(0, makeDictionaryTrack({ dictionaryMatchAcrossScripts: true }));
        crossScript.updateYomitan({ lemmatize: jest.fn(async () => ['見る', 'みる']) } as any);

        await expect(crossScript.lemmatizeForScript('みる')).resolves.toEqual(['見る', 'みる']);

        const sameScript = new TrackState(0, makeDictionaryTrack({ dictionaryMatchAcrossScripts: false }));
        sameScript.updateYomitan({ lemmatize: jest.fn(async () => ['見る', 'みる']) } as any);

        await expect(sameScript.lemmatizeForScript('見る', false)).resolves.toEqual(['見る']);
    });

    it('builds stable lemma grouping keys only for strategies that use lemmas', () => {
        const track = makeDictionaryTrack({
            dictionaryMatchAcrossScripts: true,
            dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
            dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
        });
        const trackState = new TrackState(0, track);

        expect(trackState.groupingKeysForToken('みる', ['見る', 'みる', '見る'], undefined)).toEqual({
            groupingKey: 'みる',
            lemmasGroupingKey: JSON.stringify(['みる', '見る']),
        });
        expect(trackState.groupingKeysForToken('みる', ['見る', 'みる'], DictionaryTokenSource.ANKI_SENTENCE)).toEqual({
            groupingKey: 'みる',
        });
    });

    it('resets the active Yomitan cache and detaches the instance', () => {
        jest.spyOn(Date, 'now').mockReturnValue(1234);
        const resetCache = jest.fn();
        const trackState = new TrackState(0, makeDictionaryTrack());
        trackState.updateYomitan({ resetCache } as any);

        trackState.resetYomitan();

        expect(resetCache).toHaveBeenCalledTimes(1);
        expect(trackState.yt).toBeUndefined();
        expect(trackState.ytLastResetAt).toBe(1234);
    });
});

describe('SubtitleAnnotations', () => {
    it('defaults originalText, clones subtitles, preserves cached tokenization, and stores external readings', () => {
        const { subtitleAnnotations } = makeSubtitleAnnotations();
        const buildAnnotations = jest.spyOn(subtitleAnnotations as any, '_buildAnnotations').mockResolvedValue(true);
        const tokenization = {
            tokens: [makeToken({ pos: [0, 2], readings: [{ pos: [0, 2], reading: 'ごがく' }] })],
        };
        const subtitle = makeSubtitle({ text: '語学', originalText: undefined, tokenization });

        subtitleAnnotations.setSubtitles([subtitle]);
        (subtitleAnnotations.subtitles[0] as any).__tokenized = true;
        subtitleAnnotations.subtitles[0].text = 'annotated';
        buildAnnotations.mockClear();

        subtitleAnnotations.setSubtitles([makeSubtitle({ text: '語学', originalText: '語学', tokenization })]);

        expect((subtitle as any).originalText).toBe('語学');
        expect(subtitleAnnotations.subtitles[0]).not.toBe(subtitle);
        expect(subtitleAnnotations.subtitles[0].text).toBe('annotated');
        expect((subtitleAnnotations.subtitles[0] as any).__tokenized).toBe(true);
        expect((subtitleAnnotations as any).externalTokenReadings.get('語学')).toEqual(
            new Map([[0, [{ pos: [0, 2], reading: 'ごがく' }]]])
        );
        expect(buildAnnotations).not.toHaveBeenCalled();
    });

    it('restores raw text and clears transient token state when an enabled track is disabled', () => {
        const enabledTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const disabledTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: false });
        const settings = makeSettings(makeDictionaryTracks(enabledTrack));
        const { subtitleAnnotations, subtitleAnnotationsUpdated } = makeSubtitleAnnotations(settings);
        jest.spyOn(subtitleAnnotations as any, '_buildAnnotations').mockResolvedValue(true);

        subtitleAnnotations.setSubtitles([
            makeSubtitle({
                text: 'annotated',
                originalText: 'raw',
                tokenization: { tokens: [makeToken({ pos: [0, 4], states: [TokenState.IGNORED] })] },
            }),
        ]);
        (subtitleAnnotations as any).trackStates = [new TrackState(0, enabledTrack)];
        subtitleAnnotationsUpdated.mockClear();

        subtitleAnnotations.settingsUpdated(makeSettings(makeDictionaryTracks(disabledTrack)));

        expect(subtitleAnnotations.subtitles[0].text).toBe('raw');
        expect(subtitleAnnotations.subtitles[0].tokenization).toEqual({
            tokens: [{ pos: [0, 4], readings: [], states: [] }],
        });
        expect(subtitleAnnotationsUpdated).toHaveBeenCalledWith(
            [expect.objectContaining({ text: 'raw', track: 0 })],
            expect.any(Array)
        );
    });

    it('saves local token state through the dictionary provider when profile, track, and Yomitan are available', async () => {
        const enabledTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const trackState = new TrackState(0, enabledTrack);
        trackState.updateYomitan({ lemmatize: jest.fn(async () => ['lemma-a', 'lemma-b']) } as any);
        (subtitleAnnotations as any).profile = 'Profile';
        (subtitleAnnotations as any).trackStates = [trackState];

        await subtitleAnnotations.saveTokenLocal(
            0,
            'word',
            TokenStatus.UNKNOWN,
            [TokenState.IGNORED],
            ApplyStrategy.ADD
        );

        expect(storage.saveRecordLocalBulk).toHaveBeenCalledWith(
            'Profile',
            [
                {
                    token: 'word',
                    status: TokenStatus.UNKNOWN,
                    lemmas: ['lemma-a', 'lemma-b'],
                    states: [TokenState.IGNORED],
                },
            ],
            ApplyStrategy.ADD
        );
        expect((subtitleAnnotations as any).tokensForRefresh).toEqual(new Set(['word', 'lemma-a', 'lemma-b']));
    });

    it('updates refresh state from Anki cache events and card modifications', () => {
        const { subtitleAnnotations } = makeSubtitleAnnotations();
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (subtitleAnnotations as any).ankiState.recentlyModifiedCardIds = new Set([1]);
        (subtitleAnnotations as any).ankiState.recentlyModifiedFirstCheck = true;

        subtitleAnnotations.buildAnkiCacheStateChange({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: {
                code: DictionaryBuildAnkiCacheStateErrorCode.failedToBuild,
                msg: 'failed',
                modifiedTokens: ['alpha'],
            },
        } as any);
        subtitleAnnotations.ankiCardWasModified();

        expect((subtitleAnnotations as any).tokensForRefresh).toEqual(new Set(['alpha']));
        expect((subtitleAnnotations as any).ankiState.recentlyModifiedCardIds).toEqual(new Set());
        expect((subtitleAnnotations as any).ankiState.recentlyModifiedFirstCheck).toBe(false);
        expect((subtitleAnnotations as any).ankiState.triggerRefresh).toBe(true);
        expect(consoleError).toHaveBeenCalled();
    });

    it('preserves the Anki polling baseline for concurrent builds but clears it for terminal build errors', () => {
        const { subtitleAnnotations } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        runtime.ankiState.recentlyModifiedCardIds = new Set([7]);
        runtime.ankiState.recentlyModifiedFirstCheck = true;

        subtitleAnnotations.buildAnkiCacheStateChange({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: {
                code: DictionaryBuildAnkiCacheStateErrorCode.concurrentBuild,
                msg: 'already building',
                modifiedTokens: [],
            },
        } as any);

        expect(runtime.ankiState.recentlyModifiedCardIds).toEqual(new Set([7]));
        expect(runtime.ankiState.recentlyModifiedFirstCheck).toBe(true);

        subtitleAnnotations.buildAnkiCacheStateChange({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: {
                code: DictionaryBuildAnkiCacheStateErrorCode.failedToBuild,
                msg: 'failed',
                modifiedTokens: [],
            },
        } as any);

        expect(runtime.ankiState.recentlyModifiedCardIds).toEqual(new Set());
        expect(runtime.ankiState.recentlyModifiedFirstCheck).toBe(false);
    });

    it('updates refresh state from WaniKani cache events', () => {
        const { subtitleAnnotations } = makeSubtitleAnnotations();
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (subtitleAnnotations as any).waniKaniState.statisticsRefreshed = true;

        subtitleAnnotations.buildWaniKaniCacheStateChange({
            type: DictionaryBuildWaniKaniCacheStateType.error,
            body: {
                code: DictionaryBuildWaniKaniCacheStateErrorCode.invalidWaniKaniToken,
                msg: 'bad token',
                modifiedTokens: ['単語'],
            },
        } as any);

        expect((subtitleAnnotations as any).tokensForRefresh).toEqual(new Set(['単語']));
        expect((subtitleAnnotations as any).waniKaniState.statisticsRefreshed).toBe(false);
        expect(consoleError).toHaveBeenCalled();

        (subtitleAnnotations as any).waniKaniState.statisticsRefreshed = true;
        subtitleAnnotations.buildWaniKaniCacheStateChange({
            type: DictionaryBuildWaniKaniCacheStateType.stats,
            body: {
                modifiedTokens: ['語彙'],
            },
        } as any);

        expect((subtitleAnnotations as any).tokensForRefresh).toEqual(new Set(['単語', '語彙']));
        expect((subtitleAnnotations as any).waniKaniState.statisticsRefreshed).toBe(false);
    });

    it('binds and unbinds dictionary provider callbacks including WaniKani cache events', () => {
        jest.useFakeTimers();
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const removeAnkiBuild = jest.fn();
        const removeWaniKaniBuild = jest.fn();
        const removeAnkiCard = jest.fn();
        const removeSnapshot = jest.fn();
        const removeGeneration = jest.fn();
        storage.onBuildAnkiCacheStateChange.mockReturnValue(removeAnkiBuild);
        storage.onBuildWaniKaniCacheStateChange.mockReturnValue(removeWaniKaniBuild);
        storage.onAnkiCardModified.mockReturnValue(removeAnkiCard);
        storage.onRequestStatisticsSnapshot.mockReturnValue(removeSnapshot);
        storage.onRequestStatisticsGeneration.mockReturnValue(removeGeneration);

        subtitleAnnotations.bind();
        subtitleAnnotations.unbind();

        expect(storage.onBuildAnkiCacheStateChange).toHaveBeenCalledTimes(1);
        expect(storage.onBuildWaniKaniCacheStateChange).toHaveBeenCalledTimes(1);
        expect(removeAnkiBuild).toHaveBeenCalledTimes(1);
        expect(removeWaniKaniBuild).toHaveBeenCalledTimes(1);
        expect(removeAnkiCard).toHaveBeenCalledTimes(1);
        expect(removeSnapshot).toHaveBeenCalledTimes(1);
        expect(removeGeneration).toHaveBeenCalledTimes(1);
    });

    it('computes annotation windows from the whole collection or visible subtitles', () => {
        const { subtitleAnnotations } = makeSubtitleAnnotations();

        subtitleAnnotations.setSubtitles([
            makeSubtitle({ index: 0 }),
            makeSubtitle({ index: 1, text: 'two', originalText: 'two' }),
        ]);

        expect((subtitleAnnotations as any)._getAnnotationsIndexes()).toEqual({
            annotationsStartIndex: 0,
            annotationsEndIndex: 2,
        });

        jest.spyOn(subtitleAnnotations, 'subtitlesAt').mockReturnValue({
            showing: [makeSubtitle({ index: 4 })],
            nextToShow: [],
        });
        (subtitleAnnotations as any).getMediaTimeMs = () => 0;

        expect((subtitleAnnotations as any)._getAnnotationsIndexes(false)).toEqual({
            annotationsStartIndex: 4,
            annotationsEndIndex: 105,
        });
    });

    it('polls Anki changes without rebuilding on the baseline or unchanged card IDs', async () => {
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const findRecentlyModified = jest
            .fn<() => Promise<number[]>>()
            .mockResolvedValueOnce([1, 2])
            .mockResolvedValueOnce([2, 1])
            .mockResolvedValueOnce([2, 3]);
        runtime.anki = { findRecentlyEditedOrReviewedCards: findRecentlyModified };

        await runtime._checkAnkiRecentlyModifiedCards('Profile', ['Word'], ['Mining']);
        expect(runtime.ankiState.recentlyModifiedCardIds).toEqual(new Set([1, 2]));
        expect(runtime.ankiState.recentlyModifiedFirstCheck).toBe(false);
        expect(storage.buildAnkiCache).not.toHaveBeenCalled();

        await runtime._checkAnkiRecentlyModifiedCards('Profile', ['Word'], ['Mining']);
        expect(storage.buildAnkiCache).not.toHaveBeenCalled();

        await runtime._checkAnkiRecentlyModifiedCards('Profile', ['Word'], ['Mining']);
        expect(storage.buildAnkiCache).toHaveBeenCalledWith('Profile', expect.any(Object));
        expect(runtime.ankiState.recentlyModifiedCardIds).toEqual(new Set([2, 3]));
        expect(runtime.ankiState.triggerRefresh).toBe(true);
        expect(runtime.ankiState.statisticsRefreshed).toBe(false);
        expect(findRecentlyModified).toHaveBeenNthCalledWith(1, 1, ['Word'], ['Mining']);
    });

    it('clears the Anki polling client and baseline after a polling failure', async () => {
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        runtime.anki = {
            findRecentlyEditedOrReviewedCards: jest.fn(async () => {
                throw new Error('offline');
            }),
        };
        runtime.ankiState.recentlyModifiedCardIds = new Set([9]);

        await runtime._checkAnkiRecentlyModifiedCards('Profile', ['Word'], []);

        expect(runtime.anki).toBeUndefined();
        expect(runtime.ankiState.recentlyModifiedCardIds).toEqual(new Set());
        expect(runtime.ankiState.recentlyModifiedFirstCheck).toBe(false);
        expect(storage.buildAnkiCache).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith('Error checking Anki recently modified cards:', expect.any(Error));
    });

    it('refreshes Anki once, merges configured fields, and treats an empty deck list as all decks', async () => {
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const track0 = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryAnkiWordFields: ['Word', 'Shared'],
            dictionaryAnkiSentenceFields: ['Sentence'],
            dictionaryAnkiDecks: ['Mining'],
        });
        const track1 = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryAnkiWordFields: ['Shared', 'Expression'],
            dictionaryAnkiSentenceFields: [],
            dictionaryAnkiDecks: [],
        });
        const findRecentlyModified = jest.fn(async () => [7]);
        runtime.profile = 'Profile';
        runtime.trackStates = [new TrackState(0, track0), new TrackState(1, track1)];
        runtime.anki = { findRecentlyEditedOrReviewedCards: findRecentlyModified };
        const refreshStatistics = jest.spyOn(runtime, '_refreshAnkiStatistics').mockResolvedValue(undefined);

        await runtime._refreshAnki();
        await runtime._refreshAnki();

        expect(storage.buildAnkiCache).toHaveBeenCalledTimes(1);
        expect(storage.buildAnkiCache).toHaveBeenCalledWith('Profile', expect.any(Object));
        expect(findRecentlyModified).toHaveBeenCalledTimes(2);
        expect(findRecentlyModified).toHaveBeenCalledWith(1, ['Word', 'Shared', 'Sentence', 'Expression'], []);
        expect(refreshStatistics).toHaveBeenCalledWith('Profile', ['Word', 'Shared', 'Sentence', 'Expression'], []);
        expect(runtime.ankiState.refreshed).toBe(true);
        expect(runtime.ankiState.refreshing).toBe(false);

        runtime.ankiState.refreshing = true;
        await runtime._refreshAnki();
        expect(findRecentlyModified).toHaveBeenCalledTimes(2);
    });

    it('handles denied Anki permission without starting a cache build', async () => {
        const track = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryAnkiWordFields: ['Word'],
        });
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const permission = jest.spyOn(Anki.prototype, 'requestPermission').mockResolvedValue({ permission: 'denied' });
        runtime.profile = 'Profile';
        runtime.trackStates = [new TrackState(0, track)];
        const checkRecentlyModified = jest
            .spyOn(runtime, '_checkAnkiRecentlyModifiedCards')
            .mockResolvedValue(undefined);
        jest.spyOn(runtime, '_refreshAnkiStatistics').mockResolvedValue(undefined);

        await runtime._refreshAnki();

        expect(permission).toHaveBeenCalledTimes(1);
        expect(runtime.anki).toBeUndefined();
        expect(storage.buildAnkiCache).not.toHaveBeenCalled();
        expect(checkRecentlyModified).toHaveBeenCalledWith('Profile', ['Word'], []);
        expect(runtime.ankiState.refreshing).toBe(false);
        expect(consoleWarn).toHaveBeenCalledWith('Anki permission request failed:', expect.any(Error));
    });

    it('resets Anki refresh state when the cache build rejects', async () => {
        const track = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryAnkiWordFields: ['Word'],
        });
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        storage.buildAnkiCache.mockRejectedValue(new Error('build failed'));
        runtime.profile = 'Profile';
        runtime.trackStates = [new TrackState(0, track)];
        runtime.anki = { findRecentlyEditedOrReviewedCards: jest.fn(async () => []) };

        await runtime._refreshAnki();

        expect(runtime.ankiState.refreshed).toBe(false);
        expect(runtime.ankiState.refreshing).toBe(false);
        expect(consoleWarn).toHaveBeenCalledWith('Anki refresh failed:', expect.any(Error));
    });

    it('builds and caches the Anki statistics snapshot, including due-card requests', async () => {
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const cardRecord = {
            cardId: 7,
            status: TokenStatus.LEARNING,
            data: { deckName: 'Mining', modelName: 'Sentence', due: 3 },
        };
        storage.getRecords.mockResolvedValue({
            tokenRecords: [],
            ankiCardRecords: { 0: { 7: cardRecord } },
            waniKaniSubjectRecords: {},
        });
        const findCardsDueBy = jest.fn(async (due: number) => [due + 100]);
        runtime.anki = { findCardsDueBy };
        runtime.generateStatistics = true;
        const replaceSnapshot = jest.spyOn(runtime.dictionaryStatistics, 'replaceAnkiSnapshot');

        await runtime._refreshAnkiStatistics('Profile', ['Word'], ['Mining']);
        await runtime._refreshAnkiStatistics('Profile', ['Word'], ['Mining']);

        expect(findCardsDueBy.mock.calls).toEqual(REVIEW_DUES.map((due) => [due, ['Word'], ['Mining']]));
        expect(replaceSnapshot).toHaveBeenCalledTimes(1);
        expect(replaceSnapshot).toHaveBeenCalledWith({
            available: true,
            progress: { current: 1, total: 1, startedAt: expect.any(Number) },
            cardsInfo: { 7: cardRecord.data },
            cardsStatus: { 7: TokenStatus.LEARNING },
            dueCards: { 0: [100], 1: [101], 7: [107] },
        });
        expect(runtime.ankiState.statisticsRefreshed).toBe(true);
    });

    it('requests missing Anki card details when cache records do not contain statistics metadata', async () => {
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        storage.getRecords.mockResolvedValue({
            tokenRecords: [],
            ankiCardRecords: {
                0: {
                    7: { cardId: 7, status: TokenStatus.GRADUATED, data: undefined },
                },
            },
            waniKaniSubjectRecords: {},
        });
        const cardsInfo = jest.fn(async () => [{ cardId: 7, deckName: 'Mining', modelName: 'Sentence', due: 5 }]);
        runtime.anki = { cardsInfo, findCardsDueBy: jest.fn(async () => []) };
        runtime.generateStatistics = true;
        const replaceSnapshot = jest.spyOn(runtime.dictionaryStatistics, 'replaceAnkiSnapshot');

        await runtime._refreshAnkiStatistics('Profile', ['Word'], []);

        expect(cardsInfo).toHaveBeenCalledWith([7]);
        expect(replaceSnapshot).toHaveBeenCalledWith(
            expect.objectContaining({
                cardsInfo: { 7: { deckName: 'Mining', modelName: 'Sentence', due: 5 } },
                cardsStatus: { 7: TokenStatus.GRADUATED },
            })
        );
    });

    it('publishes unavailable Anki statistics and drops the client after a request failure', async () => {
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        storage.getRecords.mockResolvedValue({
            tokenRecords: [],
            ankiCardRecords: {},
            waniKaniSubjectRecords: {},
        });
        runtime.anki = {
            findCardsDueBy: jest.fn(async () => {
                throw new Error('offline');
            }),
        };
        runtime.generateStatistics = true;
        const replaceSnapshot = jest.spyOn(runtime.dictionaryStatistics, 'replaceAnkiSnapshot');

        await runtime._refreshAnkiStatistics('Profile', ['Word'], []);

        expect(runtime.anki).toBeUndefined();
        expect(runtime.ankiState.statisticsRefreshed).toBe(false);
        expect(replaceSnapshot).toHaveBeenCalledWith({
            available: false,
            cardsInfo: {},
            cardsStatus: {},
            dueCards: {},
        });
        expect(consoleError).toHaveBeenCalledWith('Error refreshing Anki for statistics:', expect.any(Error));
    });

    it('builds the WaniKani cache once and always releases its refresh lock', async () => {
        const track = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryWaniKaniApiToken: ' wk-token ',
        });
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        runtime.profile = 'Profile';
        runtime.trackStates = [new TrackState(0, track)];
        const refreshStatistics = jest.spyOn(runtime, '_refreshWaniKaniStatistics').mockResolvedValue(undefined);

        await runtime._refreshWaniKani();
        await runtime._refreshWaniKani();

        expect(storage.buildWaniKaniCache).toHaveBeenCalledTimes(1);
        expect(storage.buildWaniKaniCache).toHaveBeenCalledWith('Profile');
        expect(refreshStatistics).toHaveBeenCalledTimes(2);
        expect(runtime.waniKaniState.refreshed).toBe(true);
        expect(runtime.waniKaniState.refreshing).toBe(false);

        runtime.waniKaniState.refreshing = true;
        await runtime._refreshWaniKani();
        expect(refreshStatistics).toHaveBeenCalledTimes(2);
    });

    it('skips WaniKani requests without a token and recovers its state from build failures', async () => {
        const noTokenTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryWaniKaniApiToken: '   ',
        });
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        runtime.profile = 'Profile';
        runtime.trackStates = [new TrackState(0, noTokenTrack)];

        await runtime._refreshWaniKani();
        expect(storage.buildWaniKaniCache).not.toHaveBeenCalled();
        expect(runtime.waniKaniState.refreshing).toBe(false);

        runtime.trackStates = [
            new TrackState(
                0,
                makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryWaniKaniApiToken: 'token' })
            ),
        ];
        storage.buildWaniKaniCache.mockRejectedValue(new Error('build failed'));

        await runtime._refreshWaniKani();

        expect(runtime.waniKaniState.refreshed).toBe(false);
        expect(runtime.waniKaniState.refreshing).toBe(false);
        expect(consoleWarn).toHaveBeenCalledWith('WaniKani refresh failed:', expect.any(Error));
    });

    it('builds per-track WaniKani statistics while isolating a failed track', async () => {
        const track0 = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const track1 = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        runtime.trackStates = [new TrackState(0, track0), new TrackState(1, track1)];
        runtime.generateStatistics = true;
        const assignment = { assignmentId: 21, subjectId: 11 };
        const subject = { subjectId: 11 };
        (storage.getRecords as any).mockImplementation(async (_profile: string, track: number) => {
            if (track === 1) throw new Error('track offline');
            return {
                tokenRecords: [],
                ankiCardRecords: {},
                waniKaniAssignmentRecords: { 0: { 21: assignment } },
                waniKaniSubjectRecords: { 0: { 11: subject } },
            };
        });
        const replaceSnapshots = jest.spyOn(runtime.dictionaryStatistics, 'replaceWaniKaniSnapshots');

        await runtime._refreshWaniKaniStatistics('Profile');

        expect(storage.getRecords).toHaveBeenNthCalledWith(1, 'Profile', 0);
        expect(storage.getRecords).toHaveBeenNthCalledWith(2, 'Profile', 1);
        expect(replaceSnapshots).toHaveBeenCalledWith({
            0: { available: true, assignments: [assignment], subjects: { 11: subject } },
            1: { available: false, assignments: [], subjects: {} },
        });
        expect(runtime.waniKaniState.statisticsRefreshed).toBe(true);
        expect(consoleError).toHaveBeenCalledWith(
            'Error refreshing WaniKani for Track2 statistics:',
            expect.any(Error)
        );
    });

    it('runs annotation and external refresh work from the bound polling interval', () => {
        jest.useFakeTimers();
        const { subtitleAnnotations } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const buildAnnotations = jest.spyOn(runtime, '_buildAnnotations').mockResolvedValue(true);
        subtitleAnnotations.setSubtitles([makeSubtitle()]);
        buildAnnotations.mockClear();
        runtime.tokensForRefresh.add('word');
        runtime.ankiState.triggerRefresh = true;
        runtime.waniKaniState.triggerRefresh = true;
        const refreshAnki = jest.spyOn(runtime, '_refreshAnki').mockResolvedValue(undefined);
        const refreshWaniKani = jest.spyOn(runtime, '_refreshWaniKani').mockResolvedValue(undefined);

        subtitleAnnotations.bind();
        jest.advanceTimersByTime(100);

        expect(buildAnnotations).toHaveBeenCalledWith(0, 1);
        expect(refreshAnki).toHaveBeenCalledTimes(1);
        expect(refreshWaniKani).toHaveBeenCalledTimes(1);
        expect(runtime.ankiState.triggerRefresh).toBe(false);
        expect(runtime.waniKaniState.triggerRefresh).toBe(false);

        subtitleAnnotations.unbind();
        jest.advanceTimersByTime(200);
        expect(refreshAnki).toHaveBeenCalledTimes(1);
        expect(refreshWaniKani).toHaveBeenCalledTimes(1);
    });

    it('executes the annotation pipeline and publishes a tokenized subtitle', async () => {
        const track = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const { subtitleAnnotations, storage, subtitleAnnotationsUpdated } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const initialBuild = jest.spyOn(runtime, '_buildAnnotations').mockResolvedValue(true);
        subtitleAnnotations.setSubtitles([makeSubtitle({ text: 'word', originalText: 'word' })]);
        initialBuild.mockRestore();
        const yomitan = makeYomitan();
        const trackState = new TrackState(0, track);
        trackState.updateYomitan(yomitan as any);
        runtime.profile = 'Profile';
        runtime.trackStates = [trackState];
        storage.getByLemmaBulk.mockResolvedValue({
            word: [
                {
                    token: 'word',
                    source: DictionaryTokenSource.LOCAL,
                    statuses: [{ status: TokenStatus.MATURE, suspended: false }],
                    states: [],
                },
            ],
        });

        await expect(runtime._buildAnnotations(0, 1, true)).resolves.toBe(true);

        expect(yomitan.tokenizeBulk).toHaveBeenCalledWith(['word']);
        expect(yomitan.tokenize).toHaveBeenCalledWith('word');
        expect(yomitan.verifyTokenizeResult).toHaveBeenCalled();
        expect(yomitan.frequency).toHaveBeenCalledWith('word');
        expect(yomitan.inferFrequencyModesFromTokenOccurrences).toHaveBeenCalled();
        expect(subtitleAnnotations.subtitles[0].tokenization?.tokens[0]).toEqual(
            expect.objectContaining({
                pos: [0, 4],
                status: TokenStatus.MATURE,
                frequency: 42,
                states: [],
            })
        );
        expect(runtime.initialized).toBe(true);
        expect(runtime.annotationsBuilding).toBe(false);
        expect(subtitleAnnotationsUpdated).toHaveBeenCalledWith(
            [expect.objectContaining({ text: 'word', track: 0 })],
            [track]
        );
    });

    it('rejects overlapping annotation builds and resets Yomitan after a token request failure', async () => {
        const track = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const { subtitleAnnotations } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const initialBuild = jest.spyOn(runtime, '_buildAnnotations').mockResolvedValue(true);
        subtitleAnnotations.setSubtitles([makeSubtitle()]);
        initialBuild.mockRestore();
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const yomitan = makeYomitan({
            tokenize: jest.fn(async () => {
                throw new Error('tokenization failed');
            }),
        });
        const trackState = new TrackState(0, track);
        trackState.updateYomitan(yomitan as any);
        runtime.profile = 'Profile';
        runtime.trackStates = [trackState];

        runtime.annotationsBuilding = true;
        await expect(runtime._buildAnnotations(0, 1, true)).resolves.toBe(false);
        runtime.annotationsBuilding = false;

        await expect(runtime._buildAnnotations(0, 1, true)).resolves.toBe(true);

        expect(yomitan.resetCache).toHaveBeenCalledTimes(1);
        expect(trackState.yt).toBeUndefined();
        expect(subtitleAnnotations.subtitles[0].tokenization).toEqual({ tokens: [], error: true });
        expect(runtime.initialized).toBe(false);
        expect(runtime.annotationsBuilding).toBe(false);
        expect(runtime.tokenRequestFailedForTracks).toEqual(new Set());
        expect(consoleError).toHaveBeenCalledWith('Error annotating subtitle text for Track1:', expect.any(Error));
    });

    it('cancels an in-flight annotation build without publishing partial results', async () => {
        const track = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const { subtitleAnnotations, subtitleAnnotationsUpdated } = makeSubtitleAnnotations();
        const runtime = privateAnnotations(subtitleAnnotations);
        const initialBuild = jest.spyOn(runtime, '_buildAnnotations').mockResolvedValue(true);
        subtitleAnnotations.setSubtitles([makeSubtitle()]);
        initialBuild.mockRestore();
        subtitleAnnotationsUpdated.mockClear();

        let resolveTokenizeBulk!: (value: { text: string }[][]) => void;
        const tokenizeBulkResult = new Promise<{ text: string }[][]>((resolve) => {
            resolveTokenizeBulk = resolve;
        });
        const yomitan = makeYomitan({ tokenizeBulk: jest.fn(() => tokenizeBulkResult) });
        const trackState = new TrackState(0, track);
        trackState.updateYomitan(yomitan as any);
        runtime.profile = 'Profile';
        runtime.trackStates = [trackState];

        const build = runtime._buildAnnotations(0, 1, true);
        expect(yomitan.tokenizeBulk).toHaveBeenCalledWith(['word']);
        runtime.shouldCancelBuild = true;
        resolveTokenizeBulk([[{ text: 'word' }]]);

        await expect(build).resolves.toBe(false);
        expect(subtitleAnnotations.subtitles[0].tokenization).toBeUndefined();
        expect(subtitleAnnotationsUpdated).not.toHaveBeenCalled();
        expect(runtime.shouldCancelBuild).toBe(false);
        expect(runtime.annotationsBuilding).toBe(false);
        expect(runtime.initialized).toBe(false);
    });
});
