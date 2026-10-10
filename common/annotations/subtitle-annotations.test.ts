import 'core-js/stable/structured-clone';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
    DictionaryBuildAnkiCacheStateErrorCode,
    DictionaryBuildAnkiCacheStateType,
    DictionaryBuildWaniKaniCacheStateErrorCode,
    DictionaryBuildWaniKaniCacheStateType,
} from '@project/common';
import type { Fetcher, TokenizedSubtitleModel } from '@project/common';
import {
    ApplyStrategy,
    DictionaryTokenSource,
    TokenStyling,
    TokenMatchStrategy,
    TokenState,
    TokenStatus,
    TokenReadingAnnotation,
    areDictionaryTracksRenderOnly,
    dictionaryStatusCollectionEnabled,
    SettingsProvider,
} from '@project/common/settings';
import { DictionaryProvider } from '@project/common/dictionary-db';
import { DictionaryDB } from '@project/common/dictionary-db/dictionary-db';
import { makeAnkiCardRecord, makeTokenRecord, privateDb } from '@project/common/dictionary-db/dictionary-db-test-utils';
import { MockSettingsStorage } from '@project/common/settings/mock-settings-storage';
import { Anki } from '@project/common/anki';
import { Yomitan } from '@project/common/yomitan';
import { renderRichTextOntoSubtitles } from '@project/common/annotations/render-annotations';
import { REVIEW_DUES } from '@project/common/dictionary-statistics';
import { needsReset, TrackState, SubtitleAnnotations } from '@project/common/annotations/subtitle-annotations';
import {
    makeDictionaryTrack,
    makeDictionaryTracks,
    makeSettings,
    makeSubtitle,
    makeSubtitleAnnotations,
    makeToken,
    makeStorage,
} from '@project/common/annotations/annotations-test-utils';

const waitForAnnotationPublication = async (
    updated: ReturnType<typeof makeSubtitleAnnotations>['subtitleAnnotationsUpdated'],
    action: () => void | Promise<void>
) => {
    const published = new Promise<void>((resolve) => updated.mockImplementationOnce(() => resolve()));
    await action();
    await published;
};

const privateAnnotations = (subtitleAnnotations: SubtitleAnnotations) => subtitleAnnotations as any;

const makeYomitan = (overrides: Record<string, unknown> = {}) => ({
    resetCache: jest.fn(),
    tokenizeBulk: jest.fn(async (texts: string[]) => texts.map((text) => [{ text }])),
    tokenize: jest.fn(async (text: string) => [[{ text }]]),
    verifyTokenizeResult: jest.fn(),
    lemmatize: jest.fn(async (text: string) => [text]),
    frequency: jest.fn(async () => 42),
    gloss: jest.fn(async () => 'definition'),
    pitchAccent: jest.fn(async () => undefined),
    termEntriesBulk: jest.fn(async () => undefined),
    getSupportsBulkFrequency: jest.fn(() => true),
    getSupportsBulkGloss: jest.fn(() => true),
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
    describe('ignored tokens', () => {
        beforeEach(() => {
            // Keep annotation building real; Yomitan is the external parser boundary.
            jest.spyOn(Yomitan.prototype, 'version').mockResolvedValue('26.4.6');
            jest.spyOn(Yomitan.prototype, 'tokenizeBulk').mockImplementation(async (texts) =>
                texts.map((text) => [{ text, reading: '' }])
            );
            jest.spyOn(Yomitan.prototype, 'tokenize').mockImplementation(async (text) => [[{ text, reading: '' }]]);
            jest.spyOn(Yomitan.prototype, 'lemmatize').mockImplementation(async (text) => [text]);
            jest.spyOn(Yomitan.prototype, 'frequency').mockResolvedValue(null);
            jest.spyOn(Yomitan.prototype, 'gloss').mockResolvedValue(null);
            jest.spyOn(Yomitan.prototype, 'pitchAccent').mockResolvedValue(null);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it.each([
            [DictionaryTokenSource.LOCAL, TokenStatus.UNCOLLECTED],
            [DictionaryTokenSource.ANKI_WORD, TokenStatus.UNKNOWN],
        ])('keeps ignored tokens fully known when source %s reports status %s', async (source, status) => {
            const { subtitleAnnotations, storage, subtitleAnnotationsUpdated } = makeSubtitleAnnotations(
                makeSettings(
                    makeDictionaryTracks(
                        makeDictionaryTrack({
                            dictionaryColorizeSubtitles: true,
                            dictionaryTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                        })
                    )
                )
            );
            storage.getBulk.mockResolvedValue({
                word: { source, statuses: [{ status, suspended: false }], states: [TokenState.IGNORED] },
            });
            try {
                subtitleAnnotations.bind();
                await waitForAnnotationPublication(subtitleAnnotationsUpdated, () =>
                    subtitleAnnotations.setSubtitles([makeSubtitle()])
                );
                expect(subtitleAnnotations.subtitles[0].tokenization?.tokens[0]).toMatchObject({
                    status: TokenStatus.MATURE,
                    states: [TokenState.IGNORED],
                });

                storage.getBulk.mockResolvedValue({
                    word: {
                        source: DictionaryTokenSource.ANKI_WORD,
                        statuses: [{ status: TokenStatus.LEARNING, suspended: false }],
                        states: [],
                    },
                });
                await waitForAnnotationPublication(subtitleAnnotationsUpdated, () =>
                    subtitleAnnotations.tokensWereModified(['word'])
                );
                expect(subtitleAnnotations.subtitles[0].tokenization?.tokens[0]).toMatchObject({
                    status: TokenStatus.LEARNING,
                    states: [],
                });
            } finally {
                subtitleAnnotations.unbind();
            }
        });
    });

    describe('saveTokenLocal', () => {
        const lemma = 'うわ';
        const inflection = 'うわー';
        const sibling = 'うわーっ';
        let dictionaryDB: DictionaryDB;
        let settingsProvider: SettingsProvider;

        beforeEach(async () => {
            await Dexie.delete('DictionaryDatabase');
            const settingsStorage = new MockSettingsStorage();
            settingsStorage.setData(
                makeSettings(
                    makeDictionaryTracks(
                        makeDictionaryTrack({
                            dictionaryColorizeSubtitles: true,
                            dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
                            dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                        })
                    )
                )
            );
            settingsProvider = new SettingsProvider(settingsStorage);
            dictionaryDB = new DictionaryDB(settingsProvider);
        });

        afterEach(async () => {
            privateDb(dictionaryDB).close();
            await Dexie.delete('DictionaryDatabase');
        });

        it.each([false, true])(
            'persists local saves and refreshes sibling forms with an external match: %s',
            async (hasExternalMatch) => {
                if (hasExternalMatch) {
                    await privateDb(dictionaryDB).tokens.put(
                        makeTokenRecord({
                            profile: 'Default',
                            track: 0,
                            token: sibling,
                            lemmas: [lemma],
                            source: DictionaryTokenSource.ANKI_WORD,
                            status: null,
                            cardIds: [1],
                        })
                    );
                    await privateDb(dictionaryDB).ankiCards.put(
                        makeAnkiCardRecord({ profile: 'Default', status: TokenStatus.MATURE })
                    );
                }
                const fetcher: Fetcher = {
                    fetch: jest.fn(async (url: string, request: { text?: string | string[] }) => {
                        if (url.endsWith('/yomitanVersion')) return { version: '26.4.6' };
                        if (url.endsWith('/tokenize')) {
                            const texts = Array.isArray(request.text) ? request.text : [request.text];
                            return texts.map((text, index) => {
                                const headword = {
                                    term: lemma,
                                    reading: lemma,
                                    sources: [
                                        {
                                            originalText: text,
                                            deinflectedText: lemma,
                                            isPrimary: true,
                                            matchType: 'exact',
                                        },
                                    ],
                                };
                                return {
                                    id: 'id',
                                    source: 'source',
                                    dictionary: 'dictionary',
                                    index,
                                    content: [[{ text, reading: '', headwords: [[headword]] }]],
                                };
                            });
                        }
                        if (url.endsWith('/termEntries')) return { dictionaryEntries: [] };
                        throw new Error(`unexpected request: ${url}`);
                    }),
                };
                const provider = new DictionaryProvider({
                    ...makeStorage(),
                    getBulk: dictionaryDB.getBulk.bind(dictionaryDB),
                    getByLemmaBulk: dictionaryDB.getByLemmaBulk.bind(dictionaryDB),
                    getAllTokens: dictionaryDB.getAllTokens.bind(dictionaryDB),
                    saveRecordLocalBulk: dictionaryDB.saveRecordLocalBulk.bind(dictionaryDB),
                } as any);
                const updated = jest.fn<ConstructorParameters<typeof SubtitleAnnotations>[4]>();
                const annotations = new SubtitleAnnotations(
                    provider,
                    settingsProvider,
                    { showingCheckRadiusMs: 150 },
                    'media-id',
                    updated,
                    undefined,
                    fetcher
                );
                const subtitles = [
                    makeSubtitle({ text: inflection, originalText: inflection }),
                    makeSubtitle({ index: 1, text: sibling, originalText: sibling }),
                ];
                const expectedStatus = hasExternalMatch ? TokenStatus.MATURE : TokenStatus.UNCOLLECTED;
                const expectTokens = (status: TokenStatus, ignored = true) => {
                    expect(annotations.subtitles.map((s) => s.tokenization?.tokens[0])).toMatchObject([
                        { status: ignored ? TokenStatus.MATURE : status, states: ignored ? [TokenState.IGNORED] : [] },
                        { status, states: [] },
                    ]);
                };
                try {
                    annotations.bind();
                    await waitForAnnotationPublication(updated, () => annotations.setSubtitles(subtitles));
                    expectTokens(expectedStatus, false);

                    await waitForAnnotationPublication(updated, () =>
                        annotations.saveTokenLocal(0, inflection, null, [TokenState.IGNORED], ApplyStrategy.TOGGLE)
                    );
                    expectTokens(expectedStatus);
                    expect((await dictionaryDB.getRecords(undefined, undefined)).tokenRecords).toContainEqual(
                        expect.objectContaining({
                            token: inflection,
                            lemmas: [lemma],
                            source: DictionaryTokenSource.LOCAL,
                            status: TokenStatus.UNCOLLECTED,
                            states: [TokenState.IGNORED],
                        })
                    );

                    await waitForAnnotationPublication(updated, () =>
                        annotations.saveTokenLocal(0, inflection, TokenStatus.UNKNOWN, [], ApplyStrategy.ADD)
                    );
                    expectTokens(TokenStatus.UNKNOWN);

                    await waitForAnnotationPublication(updated, () =>
                        annotations.saveTokenLocal(0, inflection, TokenStatus.UNCOLLECTED, [], ApplyStrategy.ADD)
                    );
                    expectTokens(expectedStatus);

                    await waitForAnnotationPublication(updated, () =>
                        annotations.saveTokenLocal(0, inflection, null, [TokenState.IGNORED], ApplyStrategy.TOGGLE)
                    );
                    expectTokens(expectedStatus, false);
                    expect(
                        (await dictionaryDB.getRecords(undefined, undefined)).tokenRecords.some(
                            (record) => record.source === DictionaryTokenSource.LOCAL
                        )
                    ).toBe(false);
                } finally {
                    annotations.unbind();
                }
            },
            15000
        );
    });

    it('only needs a reset when subtitle source content or original tokenization changes', () => {
        const previous = [makeSubtitle({ text: 'annotated', originalText: 'word' })];

        expect(needsReset([makeSubtitle({ text: 'updated', originalText: 'word' })], previous)).toBe(false);
        expect(needsReset([makeSubtitle({ text: 'other', originalText: 'other' })], previous)).toBe(true);
        expect(
            needsReset(
                [
                    makeSubtitle({
                        text: 'word',
                        originalText: 'word',
                        tokenization: { tokens: [makeToken({ pos: [0, 2] })] },
                    }),
                ],
                previous
            )
        ).toBe(true);
        expect(needsReset([], previous)).toBe(true);
    });

    it('does not reset annotations on repeated settings updates when Anki is unavailable', () => {
        const settings = makeSettings();
        const { subtitleAnnotations } = makeSubtitleAnnotations(settings);
        const runtime = privateAnnotations(subtitleAnnotations);
        const buildAnnotations = jest.spyOn(runtime, '_buildAnnotations').mockResolvedValue(true);

        subtitleAnnotations.setSubtitles([makeSubtitle()]);
        runtime.trackStates = settings.dictionaryTracks.map((dt, track) => new TrackState(track, dt));

        // Establish the last observed Anki settings. The first update may reset while the cache is initializing.
        subtitleAnnotations.settingsUpdated(settings, { force: false });
        buildAnnotations.mockClear();
        runtime.trackStates = settings.dictionaryTracks.map((dt, track) => new TrackState(track, dt));

        const tokenization = { tokens: [makeToken()] };
        const subtitle = subtitleAnnotations.subtitles[0] as any;
        subtitle.text = 'annotated';
        subtitle.tokenization = tokenization;

        subtitleAnnotations.settingsUpdated(settings, { force: false });

        expect(buildAnnotations).not.toHaveBeenCalled();
        expect(subtitleAnnotations.subtitles[0].text).toBe('annotated');
        expect(subtitleAnnotations.subtitles[0].tokenization).toBe(tokenization);

        buildAnnotations.mockClear();
        subtitleAnnotations.settingsUpdated(
            { ...settings, ankiConnectUrl: 'http://different-anki:8765' },
            { force: false }
        );

        expect(buildAnnotations).toHaveBeenCalled();
        expect(subtitleAnnotations.subtitles[0].text).toBe('word');
        expect(subtitleAnnotations.subtitles[0].tokenization?.tokens[0]).not.toHaveProperty('status');
    });

    it('forces an annotation rebuild when the profile changes', async () => {
        const settings = makeSettings();
        const { subtitleAnnotations } = makeSubtitleAnnotations(settings);
        const runtime = privateAnnotations(subtitleAnnotations);
        const buildAnnotations = jest.spyOn(runtime, '_buildAnnotations').mockResolvedValue(true);

        subtitleAnnotations.setSubtitles([
            makeSubtitle({ text: 'annotated', tokenization: { tokens: [makeToken()] } }),
        ]);
        runtime.trackStates = settings.dictionaryTracks.map((dt, index) => new TrackState(index, dt));
        runtime.lastAnkiSettings = {
            url: settings.ankiConnectUrl,
            apiKey: settings.ankiConnectApiKey,
        };
        buildAnnotations.mockClear();

        subtitleAnnotations.profileChanged();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(buildAnnotations).toHaveBeenCalled();
        expect(subtitleAnnotations.subtitles[0].tokenization?.tokens[0]).not.toHaveProperty('status');
    });

    it('updates render-only settings without rebuilding annotation data', async () => {
        jest.useFakeTimers();
        const initialTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: false });
        initialTrack.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.UNKNOWN].reading = true;
        const settings = makeSettings(makeDictionaryTracks(initialTrack));
        const { subtitleAnnotations, subtitleAnnotationsUpdated } = makeSubtitleAnnotations(settings);
        const runtime = privateAnnotations(subtitleAnnotations);
        const buildAnnotations = jest.spyOn(runtime, '_buildAnnotations').mockResolvedValue(true);
        const tokenization = { tokens: [makeToken()] };

        subtitleAnnotations.setSubtitles([makeSubtitle({ text: 'annotated', tokenization })]);
        runtime.trackStates = settings.dictionaryTracks.map((dt, index) => new TrackState(index, dt));
        runtime.lastAnkiSettings = {
            url: settings.ankiConnectUrl,
            apiKey: settings.ankiConnectApiKey,
        };
        buildAnnotations.mockClear();
        subtitleAnnotationsUpdated.mockClear();

        const renderOnlyTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryTokenStyling: TokenStyling.BACKGROUND,
        });
        renderOnlyTrack.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.UNKNOWN].reading = true;
        renderOnlyTrack.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.MATURE].reading = true;
        const renderOnlySettings = makeSettings(makeDictionaryTracks(renderOnlyTrack));

        subtitleAnnotations.settingsUpdated(renderOnlySettings, { force: false });
        await jest.advanceTimersByTimeAsync(0);

        expect(buildAnnotations).not.toHaveBeenCalled();
        expect(subtitleAnnotations.subtitles[0].tokenization).toBe(tokenization);
        expect(runtime.trackStates[0].dt.dictionaryTokenStyling).toBe(TokenStyling.BACKGROUND);
        expect(subtitleAnnotationsUpdated).toHaveBeenCalledWith(
            [expect.objectContaining({ tokenization })],
            renderOnlySettings.dictionaryTracks
        );
    });

    it('rebuilds when a setting changes whether status data must be collected', () => {
        const initialTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: false,
        });
        initialTrack.dictionaryTokenAnnotationConfig.onStates[0].reading = true;
        const settings = makeSettings(makeDictionaryTracks(initialTrack));
        const { subtitleAnnotations } = makeSubtitleAnnotations(settings);
        const runtime = privateAnnotations(subtitleAnnotations);
        const buildAnnotations = jest.spyOn(runtime, '_buildAnnotations').mockResolvedValue(true);

        subtitleAnnotations.setSubtitles([makeSubtitle({ tokenization: { tokens: [makeToken()] } })]);
        runtime.trackStates = settings.dictionaryTracks.map((dt, index) => new TrackState(index, dt));
        runtime.lastAnkiSettings = {
            url: settings.ankiConnectUrl,
            apiKey: settings.ankiConnectApiKey,
        };
        buildAnnotations.mockClear();

        const dataTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: false,
        });
        dataTrack.dictionaryTokenAnnotationConfig.onStates[0].reading = true;
        dataTrack.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.UNKNOWN].reading = true;

        expect(dictionaryStatusCollectionEnabled(initialTrack, { includeStates: false })).toBe(false);
        expect(dictionaryStatusCollectionEnabled(dataTrack, { includeStates: false })).toBe(true);
        expect(areDictionaryTracksRenderOnly(initialTrack, dataTrack)).toBe(false);

        subtitleAnnotations.settingsUpdated(makeSettings(makeDictionaryTracks(dataTrack)), { force: false });

        expect(buildAnnotations).toHaveBeenCalled();
    });

    it('rebuilds annotation data when gloss triggers change', () => {
        const initialTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const settings = makeSettings(makeDictionaryTracks(initialTrack));
        const { subtitleAnnotations } = makeSubtitleAnnotations(settings);
        const runtime = privateAnnotations(subtitleAnnotations);
        const buildAnnotations = jest.spyOn(runtime, '_buildAnnotations').mockResolvedValue(true);

        subtitleAnnotations.setSubtitles([makeSubtitle({ tokenization: { tokens: [makeToken()] } })]);
        runtime.trackStates = settings.dictionaryTracks.map((dt, index) => new TrackState(index, dt));
        runtime.lastAnkiSettings = {
            url: settings.ankiConnectUrl,
            apiKey: settings.ankiConnectApiKey,
        };
        buildAnnotations.mockClear();

        const dataTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        dataTrack.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.UNKNOWN].gloss = true;

        subtitleAnnotations.settingsUpdated(makeSettings(makeDictionaryTracks(dataTrack)), { force: false });

        expect(buildAnnotations).toHaveBeenCalled();
    });

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

    it('restores raw text and clears transient token state when an enabled track is disabled', async () => {
        jest.useFakeTimers();
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

        subtitleAnnotations.settingsUpdated(makeSettings(makeDictionaryTracks(disabledTrack)), { force: false });
        await jest.advanceTimersByTimeAsync(0);

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
        expect(consoleError).toHaveBeenCalledWith(
            expect.stringContaining('[asbplayer][annotations/anki]'),
            'Error checking Anki recently modified cards:',
            expect.any(Error)
        );

        await runtime._checkAnkiRecentlyModifiedCards('Profile', ['Word'], []);
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(runtime.ankiConnectionError).toBe(true);

        runtime.anki = { findRecentlyEditedOrReviewedCards: jest.fn(async () => []) };
        await runtime._checkAnkiRecentlyModifiedCards('Profile', ['Word'], []);
        expect(runtime.ankiConnectionError).toBe(false);
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
        const settings = makeSettings();
        const { subtitleAnnotations, storage } = makeSubtitleAnnotations(settings);
        const runtime = privateAnnotations(subtitleAnnotations);
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const permission = jest
            .spyOn(Anki.prototype, 'requestPermission')
            .mockResolvedValueOnce({ permission: 'denied' })
            .mockResolvedValueOnce({ permission: 'denied' })
            .mockResolvedValueOnce({ permission: 'granted' });
        runtime.profile = 'Profile';
        runtime.trackStates = [new TrackState(0, track)];
        const checkRecentlyModified = jest
            .spyOn(runtime, '_checkAnkiRecentlyModifiedCards')
            .mockResolvedValue(undefined);
        jest.spyOn(runtime, '_refreshAnkiStatistics').mockResolvedValue(undefined);

        await runtime._refreshAnki();

        expect(permission).toHaveBeenCalledTimes(1);
        expect(runtime.anki).toBeUndefined();
        expect(runtime.lastAnkiSettings).toEqual({
            url: settings.ankiConnectUrl,
            apiKey: settings.ankiConnectApiKey,
        });
        expect(storage.buildAnkiCache).not.toHaveBeenCalled();
        expect(checkRecentlyModified).toHaveBeenCalledWith('Profile', ['Word'], []);
        expect(runtime.ankiState.refreshing).toBe(false);
        expect(consoleWarn).toHaveBeenCalledWith(
            expect.stringContaining('[asbplayer][annotations/anki]'),
            'Anki permission request failed:',
            expect.any(Error)
        );

        await runtime._refreshAnki();
        expect(consoleWarn).toHaveBeenCalledTimes(1);
        expect(runtime.ankiConnectionError).toBe(true);

        await runtime._refreshAnki();
        expect(runtime.ankiConnectionError).toBe(false);
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
        expect(consoleWarn).toHaveBeenCalledWith(
            expect.stringContaining('[asbplayer][annotations/anki]'),
            'Anki refresh failed:',
            expect.any(Error)
        );
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
        expect(consoleError).toHaveBeenCalledWith(
            expect.stringContaining('[asbplayer][annotations/anki]'),
            'Error refreshing Anki for statistics:',
            expect.any(Error)
        );

        await runtime._refreshAnkiStatistics('Profile', ['Word'], []);
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(runtime.ankiConnectionError).toBe(true);
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
        expect(consoleWarn).toHaveBeenCalledWith(
            expect.stringContaining('[asbplayer][annotations/wanikani]'),
            'WaniKani refresh failed:',
            expect.any(Error)
        );
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
            expect.stringContaining('[asbplayer][annotations/wanikani]'),
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

    it('coalesces settings rebuilds requested while another build is active', () => {
        jest.useFakeTimers();
        const settings = makeSettings();
        const { subtitleAnnotations } = makeSubtitleAnnotations(settings);
        const runtime = privateAnnotations(subtitleAnnotations);
        const initialBuild = jest.spyOn(runtime, '_buildAnnotations').mockResolvedValue(true);
        subtitleAnnotations.setSubtitles([makeSubtitle()]);
        initialBuild.mockRestore();

        runtime.annotationsBuilding = true;
        subtitleAnnotations.settingsUpdated(
            { ...settings, ankiConnectUrl: 'http://first-anki:8765' },
            { force: false }
        );
        subtitleAnnotations.settingsUpdated(
            { ...settings, ankiConnectUrl: 'http://latest-anki:8765' },
            { force: false }
        );

        expect(runtime.shouldCancelBuild).toBe(true);
        expect(runtime.pendingBuild).toEqual({ annotationsStartIndex: 0, annotationsEndIndex: 1, init: true });

        runtime.annotationsBuilding = false;
        const buildAnnotations = jest.spyOn(runtime, '_buildAnnotations').mockResolvedValue(true);
        subtitleAnnotations.bind();
        jest.advanceTimersByTime(100);

        expect(buildAnnotations).toHaveBeenCalledTimes(1);
        expect(buildAnnotations).toHaveBeenCalledWith(0, 1, true);
        expect(runtime.pendingBuild).toBeUndefined();

        subtitleAnnotations.unbind();
    });

    it('keeps imported ASCII and numeric readings visible when reused on a later subtitle', async () => {
        // Yomitan is an external service; keep annotation building and rendering real.
        jest.spyOn(Yomitan.prototype, 'version').mockResolvedValue('26.4.6');
        jest.spyOn(Yomitan.prototype, 'tokenizeBulk').mockImplementation(async (texts) =>
            texts.map(() => [
                { text: 'MIU', reading: '' },
                { text: '007', reading: '' },
            ])
        );
        jest.spyOn(Yomitan.prototype, 'tokenize').mockResolvedValue([
            [{ text: 'MIU', reading: 'dictionary reading' }],
            [{ text: '007', reading: 'dictionary reading' }],
        ]);
        jest.spyOn(Yomitan.prototype, 'lemmatize').mockImplementation(async (text) => [text]);
        const track = makeDictionaryTrack({ dictionaryTokenReadingAnnotation: TokenReadingAnnotation.ALWAYS });
        const settings = makeSettings(makeDictionaryTracks(track));
        const { subtitleAnnotations, subtitleAnnotationsUpdated } = makeSubtitleAnnotations(settings);
        const completed = new Promise<void>((resolve) => {
            subtitleAnnotationsUpdated.mockImplementation((subtitles) => {
                if (subtitles.some((subtitle) => subtitle.index === 1)) resolve();
            });
        });

        subtitleAnnotations.setSubtitles([
            makeSubtitle({
                text: 'MIU007',
                originalText: 'MIU007',
                tokenization: {
                    tokens: [
                        makeToken({ pos: [0, 3], readings: [{ pos: [0, 3], reading: 'ミウ' }] }),
                        makeToken({ pos: [3, 6], readings: [{ pos: [0, 3], reading: 'ゼロゼロセブン' }] }),
                    ],
                },
            }),
            makeSubtitle({ index: 1, text: 'MIU007', originalText: 'MIU007' }),
        ]);
        await completed;

        const rendered = renderRichTextOntoSubtitles(subtitleAnnotations.subtitles, 'video', settings.dictionaryTracks);
        for (const index of [0, 1]) {
            const sink = document.createElement('div');
            sink.innerHTML = rendered.get(index)?.richText ?? '';
            expect(Array.from(sink.querySelectorAll('ruby'), (ruby) => ruby.firstChild?.textContent)).toEqual([
                'MIU',
                '007',
            ]);
            expect(Array.from(sink.querySelectorAll('rt'), (reading) => reading.textContent)).toEqual([
                'ミウ',
                'ゼロゼロセブン',
            ]);
        }
    });

    it('executes the annotation pipeline and publishes a tokenized subtitle', async () => {
        const track = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        track.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.MATURE].gloss = true;
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
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(yomitan.tokenizeBulk).toHaveBeenCalledWith(['word']);
        expect(yomitan.termEntriesBulk).not.toHaveBeenCalled();
        expect(yomitan.tokenize).toHaveBeenCalledWith('word');
        expect(yomitan.verifyTokenizeResult).toHaveBeenCalled();
        expect(yomitan.frequency).toHaveBeenCalledWith('word');
        expect(yomitan.gloss).toHaveBeenCalledWith('word');
        expect(yomitan.inferFrequencyModesFromTokenOccurrences).toHaveBeenCalled();
        expect(subtitleAnnotations.subtitles[0].tokenization?.tokens[0]).toEqual(
            expect.objectContaining({
                pos: [0, 4],
                status: TokenStatus.MATURE,
                frequency: 42,
                gloss: 'definition',
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
        runtime.shouldCancelBuild = false;

        await expect(runtime._buildAnnotations(0, 1, true)).resolves.toBe(true);

        expect(yomitan.resetCache).toHaveBeenCalledTimes(1);
        expect(trackState.yt).toBeUndefined();
        expect(subtitleAnnotations.subtitles[0].tokenization).toEqual({ tokens: [], error: true });
        expect(runtime.initialized).toBe(false);
        expect(runtime.annotationsBuilding).toBe(false);
        expect(runtime.tokenRequestFailedForTracks).toEqual(new Set());
        expect(consoleError).toHaveBeenCalledWith(
            expect.stringContaining('[asbplayer][annotations/tokenization]'),
            'Error annotating subtitle text for Track1:',
            expect.any(Error)
        );
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

    describe('publication queue', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            // Yomitan is the external boundary; building and publication stay real.
            jest.spyOn(Yomitan.prototype, 'version').mockResolvedValue('26.4.6');
            jest.spyOn(Yomitan.prototype, 'tokenizeBulk').mockImplementation(async (texts) =>
                texts.map((text) => [{ text, reading: '' }])
            );
            jest.spyOn(Yomitan.prototype, 'tokenize').mockImplementation(async (text) => [[{ text, reading: '' }]]);
            jest.spyOn(Yomitan.prototype, 'lemmatize').mockImplementation(async (text) => [text]);
            jest.spyOn(Yomitan.prototype, 'frequency').mockResolvedValue(null);
            jest.spyOn(Yomitan.prototype, 'gloss').mockResolvedValue(null);
            jest.spyOn(Yomitan.prototype, 'pitchAccent').mockResolvedValue(null);
        });

        afterEach(() => {
            jest.restoreAllMocks();
            jest.useRealTimers();
        });

        const makeQueue = (
            track = makeDictionaryTrack({ dictionaryColorizeSubtitles: true }),
            getMediaTimeMs?: () => number
        ) => {
            const storage = makeStorage();
            const settings = makeSettings(makeDictionaryTracks(track));
            const settingsStorage = new MockSettingsStorage();
            settingsStorage.setData(settings);
            const updated = jest.fn<ConstructorParameters<typeof SubtitleAnnotations>[4]>();
            const annotations = new SubtitleAnnotations(
                new DictionaryProvider(storage as any),
                new SettingsProvider(settingsStorage),
                { showingCheckRadiusMs: 150 },
                'media-id',
                updated,
                getMediaTimeMs
            );
            // setSubtitles/settingsUpdated start builds without returning their promises.
            // Observe those promises so assertions can run before publication timers fire.
            const runtime = annotations as any;
            const build = runtime._buildAnnotations.bind(annotations);
            let latestBuild: Promise<boolean> = Promise.resolve(true);
            jest.spyOn(runtime, '_buildAnnotations').mockImplementation((...args: unknown[]) => {
                latestBuild = build(...args);
                return latestBuild;
            });
            annotations.settingsUpdated(settings, { force: false });
            return { annotations, updated, settings, settingsStorage, storage, built: () => latestBuild };
        };

        const source = (count: number): TokenizedSubtitleModel[] =>
            Array.from({ length: count }, (_, index) =>
                makeSubtitle({ index, start: index * 2000, end: index * 2000 + 1000 })
            );

        const makeBuilt = async (count: number, track?: ReturnType<typeof makeDictionaryTrack>) => {
            const result = makeQueue(track);
            result.annotations.setSubtitles(source(count));
            await result.built();
            return result;
        };

        it('paces all build publications without blocking annotation building', async () => {
            const { annotations, updated } = await makeBuilt(201);
            expect(annotations.subtitles.every((subtitle) => (subtitle as any).__tokenized)).toBe(true);
            expect(updated).not.toHaveBeenCalled();
            await jest.advanceTimersByTimeAsync(0);
            expect(updated.mock.calls.map(([batch]) => batch.length)).toEqual([100]);
            await jest.advanceTimersByTimeAsync(999);
            expect(updated).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1);
            await jest.advanceTimersByTimeAsync(1000);
            expect(updated.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 1]);
            expect(updated.mock.calls.flatMap(([batch]) => batch.map((subtitle) => subtitle.index))).toEqual(
                Array.from({ length: 201 }, (_, index) => index)
            );
        });

        it.each(['render-only', 'disabled'] as const)(
            'prioritizes the current annotation window at each drain after %s settings changes',
            async (change) => {
                let currentIndex = 0;
                const { annotations, updated, settings, built } = makeQueue(undefined, () => currentIndex * 2000);
                annotations.setSubtitles(source(301));
                await built();
                // The older pipeline has no public buildInitial method. Complete each window
                // through its existing build entry point, as the polling interval does.
                const runtime = annotations as any;
                for (currentIndex = 11; currentIndex < 301; currentIndex += 11) {
                    const { annotationsStartIndex, annotationsEndIndex } = runtime._getAnnotationsIndexes(true);
                    await runtime._buildAnnotations(annotationsStartIndex, annotationsEndIndex, true);
                }
                currentIndex = 200;
                const updatedSettings = {
                    ...settings,
                    dictionaryTracks:
                        change === 'disabled'
                            ? makeDictionaryTracks()
                            : settings.dictionaryTracks.map((dt) => ({
                                  ...dt,
                                  dictionaryTokenStyling: TokenStyling.BACKGROUND,
                              })),
                };
                annotations.settingsUpdated(updatedSettings, { force: false });
                await built();
                await jest.advanceTimersByTimeAsync(0);
                expect(updated.mock.calls[0][0].slice(0, 11).map((subtitle) => subtitle.index)).toEqual(
                    Array.from({ length: 11 }, (_, index) => 200 + index)
                );
                currentIndex = 290;
                await jest.advanceTimersByTimeAsync(999);
                expect(updated).toHaveBeenCalledTimes(1);
                await jest.advanceTimersByTimeAsync(1);
                expect(updated.mock.calls[1][0].slice(0, 11).map((subtitle) => subtitle.index)).toEqual(
                    Array.from({ length: 11 }, (_, index) => 290 + index)
                );
                await jest.advanceTimersByTimeAsync(2000);
                expect(updated.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 100, 1]);
                const published = updated.mock.calls.flatMap(([batch]) => batch);
                expect(published.map((subtitle) => subtitle.index).sort((a, b) => a - b)).toEqual(
                    Array.from({ length: 301 }, (_, index) => index)
                );
                for (const [, tracks] of updated.mock.calls) expect(tracks).toEqual(updatedSettings.dictionaryTracks);
                if (change === 'disabled')
                    expect(published.every((subtitle) => subtitle.tokenization === undefined)).toBe(true);
            }
        );

        it.each([false, true])(
            'waits for the build to finish before publishing its updates (reset: %s)',
            async (reset) => {
                let release!: () => void;
                let started!: () => void;
                const secondResponse = new Promise<void>((resolve) => {
                    release = resolve;
                });
                const secondStarted = new Promise<void>((resolve) => {
                    started = resolve;
                });
                jest.spyOn(Yomitan.prototype, 'tokenize').mockImplementation(async (text) => {
                    if (text === 'second') {
                        started();
                        await secondResponse;
                    }
                    return [[{ text, reading: '' }]];
                });
                const { annotations, updated, built } = makeQueue();
                annotations.setSubtitles([
                    makeSubtitle(),
                    makeSubtitle({ index: 1, text: 'second', originalText: 'second' }),
                ]);
                const building = built();
                await secondStarted;
                expect((annotations.subtitles[0] as any).__tokenized).toBe(true);
                await jest.advanceTimersByTimeAsync(1000);
                expect(updated).not.toHaveBeenCalled();
                if (reset) annotations.reset();
                release();
                await expect(building).resolves.toBe(!reset);
                await jest.advanceTimersByTimeAsync(1000);
                if (reset) expect(updated).not.toHaveBeenCalled();
                else expect(updated).toHaveBeenCalledWith(annotations.subtitles, expect.any(Array));
            }
        );

        it('coalesces indexes and publishes the latest statuses, rendering settings, and timing', async () => {
            const { annotations, settings, storage, updated } = await makeBuilt(
                201,
                makeDictionaryTrack({
                    dictionaryColorizeSubtitles: true,
                    dictionaryTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                })
            );
            await jest.advanceTimersByTimeAsync(0);
            updated.mockClear();
            storage.getBulk.mockResolvedValue({
                word: {
                    states: [],
                    statuses: [{ status: TokenStatus.MATURE, suspended: false }],
                    source: DictionaryTokenSource.LOCAL,
                },
            });
            annotations.tokensWereModified(['word']);
            await (annotations as any)._buildAnnotations(0, 201, true);
            expect(annotations.subtitles[100].tokenization?.tokens[0].status).toBe(TokenStatus.MATURE);
            const renderSettings = {
                ...settings,
                dictionaryTracks: settings.dictionaryTracks.map((dt) => ({
                    ...dt,
                    dictionaryTokenStyling: TokenStyling.BACKGROUND,
                })),
            };
            annotations.settingsUpdated(renderSettings, { force: false });
            annotations.settingsUpdated(settings, { force: false });
            annotations.setSubtitles(
                annotations.subtitles.map((subtitle) => ({ ...subtitle, start: subtitle.start + 500 }))
            );
            const current = annotations.subtitles;
            await jest.advanceTimersByTimeAsync(3000);
            const published = updated.mock.calls.flatMap(([batch]) => batch);
            expect(published).toHaveLength(201);
            expect(new Set(published.map((subtitle) => subtitle.index)).size).toBe(201);
            for (const subtitle of published) {
                expect(subtitle).toBe(current[subtitle.index]);
                expect(subtitle.start).toBe(subtitle.index * 2000 + 500);
                expect(subtitle.tokenization?.tokens[0].status).toBe(TokenStatus.MATURE);
            }
            for (const [, tracks] of updated.mock.calls) expect(tracks).toEqual(settings.dictionaryTracks);
        });

        it('discards pending render updates when settings rebuild an enabled track', async () => {
            let currentIndex = 0;
            const { annotations, settings, updated, built } = makeQueue(undefined, () => currentIndex * 2000);
            annotations.setSubtitles(source(201));
            await built();
            const runtime = annotations as any;
            for (currentIndex = 11; currentIndex < 201; currentIndex += 11) {
                const { annotationsStartIndex, annotationsEndIndex } = runtime._getAnnotationsIndexes(true);
                await runtime._buildAnnotations(annotationsStartIndex, annotationsEndIndex, true);
            }
            currentIndex = 0;
            await jest.advanceTimersByTimeAsync(3000);
            annotations.settingsUpdated(
                {
                    ...settings,
                    dictionaryTracks: settings.dictionaryTracks.map((dt) => ({
                        ...dt,
                        dictionaryTokenStyling: TokenStyling.BACKGROUND,
                    })),
                },
                { force: false }
            );
            await jest.advanceTimersByTimeAsync(0);
            updated.mockClear();
            const rebuildSettings = {
                ...settings,
                dictionaryTracks: settings.dictionaryTracks.map((dt) => ({
                    ...dt,
                    dictionaryYomitanScanLength: dt.dictionaryYomitanScanLength + 1,
                })),
            };
            annotations.settingsUpdated(rebuildSettings, { force: false });
            await built();
            await jest.advanceTimersByTimeAsync(3000);
            const published = updated.mock.calls.flatMap(([batch]) => batch);
            expect(published.map((subtitle) => subtitle.index)).toEqual(
                Array.from({ length: 11 }, (_, index) => index)
            );
            expect(published.every((subtitle) => subtitle.tokenization !== undefined)).toBe(true);
            for (const [, tracks] of updated.mock.calls) expect(tracks).toEqual(rebuildSettings.dictionaryTracks);
        });

        it.each([false, true])('clears disabled tracks through the queue across resets (reset: %s)', async (reset) => {
            const { annotations, settings, updated, built } = await makeBuilt(201);
            await jest.advanceTimersByTimeAsync(0);
            updated.mockClear();
            const disabledSettings = { ...settings, dictionaryTracks: makeDictionaryTracks() };
            annotations.settingsUpdated(disabledSettings, { force: false });
            await built();
            await jest.advanceTimersByTimeAsync(0);
            if (reset) {
                annotations.settingsUpdated(disabledSettings, { force: true });
                await built();
                await jest.advanceTimersByTimeAsync(0);
            }
            expect(annotations.subtitles.every((subtitle) => subtitle.tokenization === undefined)).toBe(true);
            await jest.advanceTimersByTimeAsync(3000);
            const published = updated.mock.calls.flatMap(([batch]) => batch);
            expect(published).toHaveLength(201);
            expect(new Set(published.map((subtitle) => subtitle.index)).size).toBe(201);
            expect(published.every((subtitle) => subtitle.tokenization === undefined)).toBe(true);
            for (const [, tracks] of updated.mock.calls) expect(tracks).toEqual(disabledSettings.dictionaryTracks);
        });

        it('discards queued publications when a replacement source reuses subtitle indexes', async () => {
            const { annotations, updated, built } = await makeBuilt(201);
            await jest.advanceTimersByTimeAsync(0);
            updated.mockClear();
            annotations.setSubtitles([makeSubtitle({ text: 'replacement', originalText: 'replacement', start: 5000 })]);
            await built();
            await jest.advanceTimersByTimeAsync(3000);
            expect(updated).toHaveBeenCalledTimes(1);
            expect(updated).toHaveBeenCalledWith(annotations.subtitles, expect.any(Array));
        });

        it('cancels publication when the subtitle source is cleared', async () => {
            const { annotations, updated } = await makeBuilt(201);
            await jest.advanceTimersByTimeAsync(0);
            annotations.reset();
            updated.mockClear();
            await jest.advanceTimersByTimeAsync(3000);
            expect(updated).not.toHaveBeenCalled();
        });

        it('preserves updates queued by a publication callback', async () => {
            const { annotations, settings, updated } = await makeBuilt(1);
            const renderSettings = {
                ...settings,
                dictionaryTracks: settings.dictionaryTracks.map((dt) => ({
                    ...dt,
                    dictionaryTokenStyling: TokenStyling.BACKGROUND,
                })),
            };
            updated.mockImplementationOnce(() => annotations.settingsUpdated(renderSettings, { force: false }));
            await jest.advanceTimersByTimeAsync(0);
            expect(updated).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(3000);
            expect(updated).toHaveBeenCalledTimes(2);
            expect(updated).toHaveBeenLastCalledWith(
                [expect.objectContaining({ index: 0 })],
                renderSettings.dictionaryTracks
            );
        });

        it('applies statistics settings immediately while publication is queued', async () => {
            const track = makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryAutoGenerateStatistics: true,
            });
            const { annotations, settings, settingsStorage, storage, built } = await makeBuilt(201, track);
            await jest.advanceTimersByTimeAsync(0);
            const disabledSettings = {
                ...settings,
                dictionaryTracks: makeDictionaryTracks(
                    makeDictionaryTrack({ ...track, dictionaryAutoGenerateStatistics: false })
                ),
            };
            settingsStorage.setData(disabledSettings);
            annotations.settingsUpdated(disabledSettings, { force: false });
            await built();
            annotations.setSubtitles([makeSubtitle()]);
            await built();
            storage.publishStatisticsSnapshot.mockClear();
            annotations.bind();
            await jest.advanceTimersByTimeAsync(1000);
            annotations.unbind();
            expect(storage.publishStatisticsSnapshot.mock.calls.filter((call) => call[1] !== undefined)).toEqual([]);
        });
    });
});
