import 'core-js/stable/structured-clone';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DictionaryBuildAnkiCacheStateType, DictionaryBuildWaniKaniCacheStateType } from '@project/common';
import type { Fetcher } from '@project/common';
import { DictionaryProvider } from '@project/common/dictionary-db';
import { DictionaryDB } from '@project/common/dictionary-db/dictionary-db';
import { makeAnkiCardRecord, makeTokenRecord, privateDb } from '@project/common/dictionary-db/dictionary-db-test-utils';
import { BuildAnnotations } from '@project/common/annotations/build-annotations';
import type { BuildAnnotationsOptions, InternalSubtitleModel } from '@project/common/annotations/build-annotations';
import {
    makeDictionaryTrack,
    makeDictionaryTracks,
    makeSettings,
    makeStorage,
    makeSubtitle,
    makeToken,
} from '@project/common/annotations/annotations-test-utils';
import { MockSettingsStorage } from '@project/common/settings/mock-settings-storage';
import { Yomitan } from '@project/common/yomitan';
import {
    ApplyStrategy,
    DictionaryTokenSource,
    SettingsProvider,
    TokenMatchStrategy,
    TokenState,
    TokenStatus,
    TokenStyling,
} from '@project/common/settings';

afterEach(() => {
    jest.useRealTimers();
});

const makeFetcher = (): Fetcher => ({
    fetch: jest.fn(async (url: string) => {
        if (url.endsWith('/yomitanVersion')) return { version: '0.0.0.0' };
        if (url.endsWith('/tokenize')) {
            return [
                {
                    id: 'id',
                    source: 'source',
                    dictionary: 'dictionary',
                    index: 0,
                    content: [[{ text: 'word', reading: '', frequency: 7 }]],
                },
            ];
        }
        if (url.endsWith('/termEntries')) return { dictionaryEntries: [] };
        throw new Error(`unexpected request: ${url}`);
    }),
});

const waitForAsyncBuild = () => new Promise((resolve) => setTimeout(resolve, 1001));
const waitForPublication = () => new Promise((resolve) => setTimeout(resolve, 0));

const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

const makeBuild = (
    dictionaryTracks = makeDictionaryTracks(),
    fetcher = makeFetcher(),
    playback: Partial<Pick<BuildAnnotationsOptions, 'subtitlesAt' | 'getMediaTimeMs'>> = {}
) => {
    const storage = makeStorage();
    const provider = new DictionaryProvider(storage as any);
    const settings = makeSettings(dictionaryTracks);
    const settingsStorage = new MockSettingsStorage();
    settingsStorage.setData(settings);
    const settingsProvider = new SettingsProvider(settingsStorage);
    const subtitles: InternalSubtitleModel[] = [];
    const updated = jest.fn<BuildAnnotationsOptions['subtitleAnnotationsUpdated']>();
    const build = new BuildAnnotations({
        dictionaryProvider: provider,
        settingsProvider,
        mediaId: 'media-id',
        subtitlesAt: () => ({ showing: [] }),
        subtitleAnnotationsUpdated: updated,
        fetcher,
        ...playback,
    });

    return { build, settings, settingsStorage, storage, subtitles, updated };
};

const makeBuiltSubtitles = async (
    count: number,
    track = makeDictionaryTrack({ dictionaryColorizeSubtitles: true })
) => {
    const result = makeBuild(makeDictionaryTracks(track));
    const { build, settings, subtitles } = result;
    build.updateSettings(settings);
    subtitles.push(...Array.from({ length: count }, (_, index) => makeSubtitle({ index })));
    build.setSubtitles(subtitles, true);
    await build.buildInitial();
    return result;
};

describe('BuildAnnotations public boundary', () => {
    it.each([
        [DictionaryTokenSource.LOCAL, TokenStatus.UNCOLLECTED],
        [DictionaryTokenSource.ANKI_WORD, TokenStatus.UNKNOWN],
    ])('keeps ignored tokens fully known when source %s reports status %s', async (source, status) => {
        const { build, settings, storage, subtitles } = makeBuild(
            makeDictionaryTracks(
                makeDictionaryTrack({
                    dictionaryColorizeSubtitles: true,
                    dictionaryTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                })
            )
        );
        storage.getBulk.mockResolvedValue({
            word: { source, statuses: [{ status, suspended: false }], states: [TokenState.IGNORED] },
        });
        build.updateSettings(settings);
        subtitles.push(makeSubtitle());
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        expect(subtitles[0].tokenization?.tokens[0]).toMatchObject({
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
        build.tokensWereModified(['word']);
        await build.buildInitial();
        expect(subtitles[0].tokenization?.tokens[0]).toMatchObject({ status: TokenStatus.LEARNING, states: [] });
    });

    describe('publication queue', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        it('paces all build publications without blocking annotation building', async () => {
            const { subtitles, updated } = await makeBuiltSubtitles(201);

            expect(subtitles.every((subtitle) => subtitle.__tokenized)).toBe(true);
            expect(updated).not.toHaveBeenCalled();
            await jest.advanceTimersByTimeAsync(0);
            expect(updated.mock.calls.map(([batch]) => batch.length)).toEqual([100]);
            await jest.advanceTimersByTimeAsync(999);
            expect(updated).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1);
            expect(updated.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100]);
            await jest.advanceTimersByTimeAsync(1000);

            expect(updated.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 1]);
            expect(
                updated.mock.calls.flatMap(([batch]) => batch.map((subtitle: InternalSubtitleModel) => subtitle.index))
            ).toEqual(Array.from({ length: 201 }, (_, index) => index));
        });

        it.each(['render-only', 'disabled'] as const)(
            'prioritizes the current annotation window at each drain after %s settings changes',
            async (change) => {
                let currentIndex = 0;
                const { build, settings, subtitles, updated } = makeBuild(
                    makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true })),
                    undefined,
                    {
                        getMediaTimeMs: () => currentIndex * 2000,
                        subtitlesAt: () => ({ showing: subtitles[currentIndex] ? [subtitles[currentIndex]] : [] }),
                    }
                );
                build.updateSettings(settings);
                subtitles.push(...Array.from({ length: 301 }, (_, index) => makeSubtitle({ index })));
                build.setSubtitles(subtitles, true);
                for (currentIndex = 0; currentIndex < subtitles.length; currentIndex += 11) {
                    await build.buildInitial();
                }
                currentIndex = 200;
                const updatedSettings = {
                    ...settings,
                    dictionaryTracks:
                        change === 'disabled'
                            ? makeDictionaryTracks()
                            : build.dictionaryTracks.map((dt) => ({
                                  ...dt,
                                  dictionaryTokenStyling: TokenStyling.BACKGROUND,
                              })),
                };
                build.updateSettings(updatedSettings);
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
                if (change === 'disabled') {
                    expect(published.every((subtitle) => subtitle.tokenization === undefined)).toBe(true);
                }
            }
        );

        it.each([false, true])(
            'waits for the build batch to finish before publishing its updates (reset: %s)',
            async (reset) => {
                const secondStarted = deferred<void>();
                const secondResult = deferred<void>();
                const version = jest.spyOn(Yomitan.prototype, 'version').mockResolvedValue('26.4.6');
                const tokenizeBulk = jest
                    .spyOn(Yomitan.prototype, 'tokenizeBulk')
                    .mockImplementation(async (texts) => texts.map((text) => [{ text, reading: '' }]));
                const tokenize = jest.spyOn(Yomitan.prototype, 'tokenize').mockImplementation(async (text) => {
                    if (text === 'second') {
                        secondStarted.resolve();
                        await secondResult.promise;
                    }
                    return [[{ text, reading: '' }]];
                });
                const lemmatize = jest.spyOn(Yomitan.prototype, 'lemmatize').mockImplementation(async (text) => [text]);
                try {
                    const { build, subtitles, updated } = makeBuild(
                        makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true }))
                    );
                    subtitles.push(makeSubtitle(), makeSubtitle({ index: 1, text: 'second', originalText: 'second' }));
                    build.setSubtitles(subtitles, true);
                    const building = build.buildInitial();
                    await secondStarted.promise;
                    expect(subtitles[0].__tokenized).toBe(true);
                    await jest.advanceTimersByTimeAsync(1000);
                    expect(updated).not.toHaveBeenCalled();
                    if (reset) build.setSubtitles([makeSubtitle({ start: 5000 })], true);
                    secondResult.resolve();
                    await expect(building).resolves.toBe(!reset);
                    await jest.advanceTimersByTimeAsync(1000);

                    if (reset) {
                        expect(updated).not.toHaveBeenCalled();
                    } else {
                        expect(updated).toHaveBeenCalledTimes(1);
                        expect(updated).toHaveBeenCalledWith(subtitles, expect.any(Array));
                    }
                } finally {
                    version.mockRestore();
                    tokenizeBulk.mockRestore();
                    tokenize.mockRestore();
                    lemmatize.mockRestore();
                }
            }
        );

        it('coalesces queued indexes and publishes the latest built statuses and rendering settings', async () => {
            const { build, settings, storage, subtitles, updated } = await makeBuiltSubtitles(
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
            build.tokensWereModified(['word']);
            await expect(build.buildInitial()).resolves.toBe(true);
            expect(subtitles[100].tokenization?.tokens[0].status).toBe(TokenStatus.MATURE);
            const renderTrack = makeDictionaryTrack({
                ...settings.dictionaryTracks[0],
                dictionaryColorizeSubtitles: true,
                dictionaryTokenStyling: TokenStyling.BACKGROUND,
            });
            build.updateSettings({ ...settings, dictionaryTracks: makeDictionaryTracks(renderTrack) });
            build.updateSettings(settings);
            expect(build.dictionaryTracks).toEqual(settings.dictionaryTracks);
            expect(updated).not.toHaveBeenCalled();
            const current = subtitles.map((subtitle) => ({ ...subtitle, start: subtitle.start + 500 }));
            build.setSubtitles(current, false);
            await jest.advanceTimersByTimeAsync(3000);

            const published = updated.mock.calls.flatMap(([batch]) => batch as InternalSubtitleModel[]);
            expect(published).toHaveLength(201);
            expect(new Set(published.map((subtitle) => subtitle.index)).size).toBe(201);
            for (const subtitle of published) {
                expect(subtitle).toBe(current[subtitle.index]);
                expect(subtitle.start).toBe(500);
                expect(subtitle.tokenization?.tokens[0].status).toBe(TokenStatus.MATURE);
            }
            for (const [, tracks] of updated.mock.calls) expect(tracks).toEqual(settings.dictionaryTracks);
        });

        it('discards pending render updates when settings rebuild an enabled track', async () => {
            let currentIndex = 0;
            const { build, settings, subtitles, updated } = makeBuild(
                makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true })),
                undefined,
                {
                    getMediaTimeMs: () => currentIndex * 2000,
                    subtitlesAt: () => ({ showing: subtitles[currentIndex] ? [subtitles[currentIndex]] : [] }),
                }
            );
            build.updateSettings(settings);
            subtitles.push(...Array.from({ length: 201 }, (_, index) => makeSubtitle({ index })));
            build.setSubtitles(subtitles, true);
            for (currentIndex = 0; currentIndex < subtitles.length; currentIndex += 11) await build.buildInitial();
            currentIndex = 0;
            await jest.advanceTimersByTimeAsync(3000);

            build.updateSettings({
                ...settings,
                dictionaryTracks: settings.dictionaryTracks.map((dt) => ({
                    ...dt,
                    dictionaryTokenStyling: TokenStyling.BACKGROUND,
                })),
            });
            await jest.advanceTimersByTimeAsync(0);
            updated.mockClear();
            const rebuildSettings = {
                ...settings,
                dictionaryTracks: settings.dictionaryTracks.map((dt) => ({
                    ...dt,
                    dictionaryYomitanScanLength: dt.dictionaryYomitanScanLength + 1,
                })),
            };
            build.updateSettings(rebuildSettings);
            await jest.advanceTimersByTimeAsync(3000);

            const published = updated.mock.calls.flatMap(([batch]) => batch);
            expect(published.map((subtitle) => subtitle.index)).toEqual(
                Array.from({ length: 11 }, (_, index) => index)
            );
            expect(published.every((subtitle) => subtitle.tokenization !== undefined)).toBe(true);
            for (const [, tracks] of updated.mock.calls) expect(tracks).toEqual(rebuildSettings.dictionaryTracks);
        });

        it.each([false, true])('clears disabled tracks through the queue across resets (reset: %s)', async (reset) => {
            const { build, settings, subtitles, updated } = await makeBuiltSubtitles(201);
            await jest.advanceTimersByTimeAsync(0);
            updated.mockClear();
            const disabledSettings = { ...settings, dictionaryTracks: makeDictionaryTracks() };
            build.updateSettings(disabledSettings);
            await jest.advanceTimersByTimeAsync(0);
            if (reset) {
                build.updateSettings(disabledSettings, { force: true });
                await jest.advanceTimersByTimeAsync(0);
            }
            await expect(build.buildInitial()).resolves.toBe(true);
            expect(build.dictionaryTracks).toEqual(disabledSettings.dictionaryTracks);
            expect(subtitles.every((subtitle) => subtitle.tokenization === undefined)).toBe(true);
            await jest.advanceTimersByTimeAsync(3000);

            const published = updated.mock.calls.flatMap(([batch]) => batch as InternalSubtitleModel[]);
            expect(published).toHaveLength(201);
            expect(new Set(published.map((subtitle) => subtitle.index)).size).toBe(201);
            expect(published.every((subtitle) => subtitle.tokenization === undefined)).toBe(true);
            for (const [, tracks] of updated.mock.calls) expect(tracks).toEqual(disabledSettings.dictionaryTracks);
        });

        it('discards queued publications when a replacement source reuses subtitle indexes', async () => {
            const { build, updated } = await makeBuiltSubtitles(201);
            await jest.advanceTimersByTimeAsync(0);
            updated.mockClear();
            const replacement: InternalSubtitleModel[] = [makeSubtitle({ start: 5000 })];
            build.setSubtitles(replacement, true);
            await expect(build.buildInitial()).resolves.toBe(true);
            await jest.advanceTimersByTimeAsync(3000);

            expect(updated).toHaveBeenCalledTimes(1);
            expect(updated).toHaveBeenCalledWith(replacement, expect.any(Array));
        });

        it('cancels publication when the subtitle source is cleared', async () => {
            const { build, updated } = await makeBuiltSubtitles(201);
            await jest.advanceTimersByTimeAsync(0);
            build.setSubtitles([], true);
            updated.mockClear();
            await jest.advanceTimersByTimeAsync(3000);

            expect(updated).not.toHaveBeenCalled();
        });

        it('preserves updates queued by a publication callback', async () => {
            const { build, settings, updated } = await makeBuiltSubtitles(1);
            const renderSettings = {
                ...settings,
                dictionaryTracks: makeDictionaryTracks(
                    makeDictionaryTrack({
                        dictionaryColorizeSubtitles: true,
                        dictionaryTokenStyling: TokenStyling.BACKGROUND,
                    })
                ),
            };
            updated.mockImplementationOnce(() => build.updateSettings(renderSettings));
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
            const { build, settings, settingsStorage, storage } = await makeBuiltSubtitles(201, track);
            await jest.advanceTimersByTimeAsync(0);
            const disabledSettings = {
                ...settings,
                dictionaryTracks: makeDictionaryTracks(
                    makeDictionaryTrack({ ...track, dictionaryAutoGenerateStatistics: false })
                ),
            };
            settingsStorage.setData(disabledSettings);
            build.updateSettings(disabledSettings);
            build.setSubtitles([makeSubtitle()], true);
            await build.buildInitial();
            storage.publishStatisticsSnapshot.mockClear();
            await jest.advanceTimersByTimeAsync(1);
            await build.refresh();
            await jest.advanceTimersByTimeAsync(1000);

            expect(build.dictionaryTracks).toEqual(disabledSettings.dictionaryTracks);
            expect(storage.publishStatisticsSnapshot.mock.calls.filter((call) => call[1] !== undefined)).toEqual([]);
        });
    });

    it('does no work for an empty subtitle collection', async () => {
        const { build, updated } = makeBuild();

        await expect(build.buildInitial()).resolves.toBe(true);
        await waitForPublication();

        expect(updated).not.toHaveBeenCalled();
    });

    it('turns subtitle input into tokenized output and reports the changed subtitle', async () => {
        const enabledTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const { build, subtitles, updated } = makeBuild(makeDictionaryTracks(enabledTrack));
        subtitles.push(makeSubtitle({ text: 'word' }));

        build.setSubtitles(subtitles, true);
        await expect(build.buildInitial()).resolves.toBe(true);
        await waitForPublication();

        expect(subtitles[0].tokenization?.tokens[0]).toEqual(
            expect.objectContaining({ pos: [0, 4], status: expect.any(Number), frequency: null })
        );
        expect(subtitles[0].__tokenized).toBe(true);
        expect(updated).toHaveBeenCalledWith(
            [expect.objectContaining({ index: 0 })],
            [enabledTrack, ...makeDictionaryTracks().slice(1)]
        );
    });

    it('preserves supplied readings while rebuilding generated annotation fields', async () => {
        const enabledTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const { build, subtitles } = makeBuild(makeDictionaryTracks(enabledTrack));
        subtitles.push(
            makeSubtitle({
                text: 'word',
                tokenization: { tokens: [makeToken({ readings: [{ pos: [0, 4], reading: 'よみ' }] })] },
            })
        );

        build.setSubtitles(subtitles, true);
        await expect(build.buildInitial()).resolves.toBe(true);
        await waitForPublication();

        expect(subtitles[0].tokenization?.tokens[0]).toEqual(
            expect.objectContaining({ readings: [{ pos: [0, 4], reading: 'よみ' }] })
        );
    });

    it('updates render-only settings without rebuilding tokenization', async () => {
        const enabledTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const { build, settings, subtitles, updated } = makeBuild(makeDictionaryTracks(enabledTrack));
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        await waitForPublication();
        build.updateSettings(settings);
        await waitForAsyncBuild();
        updated.mockClear();

        const renderTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryTokenStyling: TokenStyling.BACKGROUND,
        });
        build.updateSettings({ ...settings, dictionaryTracks: makeDictionaryTracks(renderTrack) });
        await waitForAsyncBuild();

        expect(subtitles[0].tokenization).toBeDefined();
        expect(updated).toHaveBeenCalledWith([expect.objectContaining({ index: 0 })], expect.any(Array));
    });

    it('rebuilds annotations when the active profile changes even with unchanged settings', async () => {
        const enabledTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const { build, settings, subtitles, updated } = makeBuild(makeDictionaryTracks(enabledTrack));
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        await waitForPublication();
        updated.mockClear();

        build.profileChanged(settings);
        await waitForAsyncBuild();

        expect(updated).toHaveBeenCalledWith([expect.objectContaining({ index: 0 })], expect.any(Array));
    });

    it('rebuilds annotation data when gloss collection is enabled', async () => {
        const initialTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const { build, settings, subtitles, updated } = makeBuild(makeDictionaryTracks(initialTrack));
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        await waitForPublication();
        updated.mockClear();

        const glossTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        glossTrack.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.UNCOLLECTED].gloss = true;
        build.updateSettings({ ...settings, dictionaryTracks: makeDictionaryTracks(glossTrack) });
        await waitForAsyncBuild();

        expect(subtitles[0].tokenization).toBeDefined();
        expect(updated).toHaveBeenCalledWith([expect.objectContaining({ index: 0 })], expect.any(Array));
    });

    it('rebuilds annotation data when status collection becomes enabled', async () => {
        const initialTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: false });
        initialTrack.dictionaryTokenAnnotationConfig.onStates[0].reading = true;
        const { build, settings, subtitles, updated } = makeBuild(makeDictionaryTracks(initialTrack));
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        await waitForPublication();
        updated.mockClear();

        const dataTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: false });
        dataTrack.dictionaryTokenAnnotationConfig.onStates[0].reading = true;
        dataTrack.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.UNKNOWN].reading = true;
        build.updateSettings({ ...settings, dictionaryTracks: makeDictionaryTracks(dataTrack) });
        await waitForAsyncBuild();

        expect(subtitles[0].tokenization).toBeDefined();
        expect(updated).toHaveBeenCalledWith([expect.objectContaining({ index: 0 })], expect.any(Array));
    });

    it('rebuilds annotations after dictionary cache events modify tokens', async () => {
        const enabledTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const { build, subtitles, updated } = makeBuild(makeDictionaryTracks(enabledTrack));
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        await waitForPublication();
        updated.mockClear();

        build.buildAnkiCacheStateChange({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: { modifiedTokens: ['word'] },
        });
        build.buildWaniKaniCacheStateChange({
            type: DictionaryBuildWaniKaniCacheStateType.stats,
            body: { track: 0, modifiedTokens: ['word'] },
        });
        await build.refresh();
        await waitForAsyncBuild();

        expect(updated).toHaveBeenCalledWith([expect.objectContaining({ index: 0 })], expect.any(Array));
    });

    it('prefetches and exposes glosses after the bulk term-entry capability is available', async () => {
        const glossTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        glossTrack.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.UNCOLLECTED].gloss = true;
        const entry = {
            headwords: [
                {
                    index: 0,
                    headwordIndex: 0,
                    term: 'word',
                    reading: 'word',
                    sources: [
                        {
                            originalText: 'word',
                            transformedText: 'word',
                            deinflectedText: 'word',
                            matchType: 'exact' as const,
                            matchSource: 'term' as const,
                            isPrimary: true,
                        },
                    ],
                },
            ],
            frequencies: [],
            pronunciations: [],
            definitions: [
                {
                    index: 0,
                    headwordIndices: [0],
                    dictionary: 'dictionary',
                    dictionaryIndex: 0,
                    dictionaryAlias: 'dictionary',
                    id: 0,
                    score: 0,
                    frequencyOrder: 0,
                    sequences: [],
                    isPrimary: true,
                    tags: [],
                    entries: ['meaning'],
                },
            ],
        };
        const fetcher: Fetcher = {
            fetch: jest.fn(async (url: string, request: { term?: string | string[] }) => {
                if (url.endsWith('/yomitanVersion')) return { version: '26.4.6' };
                if (url.endsWith('/tokenize'))
                    return [
                        {
                            id: 'id',
                            source: 'source',
                            dictionary: 'dictionary',
                            index: 0,
                            content: [[{ text: 'word', reading: '' }]],
                        },
                    ];
                if (url.endsWith('/termEntries')) {
                    if (Array.isArray(request.term))
                        return [{ index: 0, originalTextLength: 4, dictionaryEntries: [entry] }];
                    return { dictionaryEntries: [entry] };
                }
                throw new Error(`unexpected request: ${url}`);
            }),
        };
        const { build, subtitles } = makeBuild(makeDictionaryTracks(glossTrack), fetcher);
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);

        await build.buildInitial();
        await waitForPublication();
        const initialToken = subtitles[0].tokenization?.tokens[0];
        expect(initialToken).toBeDefined();
        expect(initialToken).not.toHaveProperty('gloss');

        await build.refresh();
        await waitForAsyncBuild();
        expect(subtitles[0].tokenization?.tokens[0]).toEqual(expect.objectContaining({ gloss: 'meaning' }));
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
                        if (url.endsWith('/yomitanVersion')) return { version: '0.0.0.0' };
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
                const build = new BuildAnnotations({
                    dictionaryProvider: provider,
                    settingsProvider,
                    mediaId: 'media-id',
                    subtitlesAt: () => ({ showing: [] }),
                    subtitleAnnotationsUpdated: jest.fn(),
                    fetcher,
                });
                const subtitles = [
                    makeSubtitle({ text: inflection, originalText: inflection }),
                    makeSubtitle({ index: 1, text: sibling, originalText: sibling }),
                ];
                const expectedStatus = hasExternalMatch ? TokenStatus.MATURE : TokenStatus.UNCOLLECTED;
                const expectTokens = (status: TokenStatus, ignored = true) => {
                    expect(subtitles.map((s) => s.tokenization?.tokens[0])).toMatchObject([
                        { status: ignored ? TokenStatus.MATURE : status, states: ignored ? [TokenState.IGNORED] : [] },
                        { status, states: [] },
                    ]);
                };
                try {
                    build.setSubtitles(subtitles, true);
                    await build.buildInitial();
                    expectTokens(expectedStatus, false);

                    await build.saveTokenLocal(0, inflection, null, [TokenState.IGNORED], ApplyStrategy.TOGGLE);
                    await build.buildInitial();
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

                    await build.saveTokenLocal(0, inflection, TokenStatus.UNKNOWN, [], ApplyStrategy.ADD);
                    await build.buildInitial();
                    expectTokens(TokenStatus.UNKNOWN);

                    await build.saveTokenLocal(0, inflection, TokenStatus.UNCOLLECTED, [], ApplyStrategy.ADD);
                    await build.buildInitial();
                    expectTokens(expectedStatus);

                    await build.saveTokenLocal(0, inflection, null, [TokenState.IGNORED], ApplyStrategy.TOGGLE);
                    await build.buildInitial();
                    expectTokens(expectedStatus, false);
                    expect(
                        (await dictionaryDB.getRecords(undefined, undefined)).tokenRecords.some(
                            (record) => record.source === DictionaryTokenSource.LOCAL
                        )
                    ).toBe(false);
                } finally {
                    build.setSubtitles([], true);
                }
            }
        );
    });

    it('cancels an overlapping build and can recover with a later build', async () => {
        const version = deferred<{ version: string }>();
        const versionStarted = deferred<void>();
        const fetcher: Fetcher = {
            fetch: jest.fn(async (url: string) => {
                if (url.endsWith('/yomitanVersion')) {
                    versionStarted.resolve();
                    return version.promise;
                }
                if (url.endsWith('/tokenize'))
                    return [
                        {
                            id: 'id',
                            source: 'source',
                            dictionary: 'dictionary',
                            index: 0,
                            content: [[{ text: 'word', reading: '' }]],
                        },
                    ];
                if (url.endsWith('/termEntries')) return { dictionaryEntries: [] };
                throw new Error(`unexpected request: ${url}`);
            }),
        };
        const { build, subtitles, updated } = makeBuild(
            makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true })),
            fetcher
        );
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);

        const firstBuild = build.buildInitial();
        await versionStarted.promise;
        await expect(build.buildInitial()).resolves.toBe(false);

        build.setSubtitles(subtitles, true);
        version.resolve({ version: '0.0.0.0' });
        await expect(firstBuild).resolves.toBe(false);
        expect(updated).not.toHaveBeenCalled();

        await expect(build.buildInitial()).resolves.toBe(true);
        await waitForPublication();
        expect(subtitles[0].__tokenized).toBe(true);
    });

    it('queues a settings rebuild requested during an active build and runs it on the next refresh', async () => {
        const version = deferred<{ version: string }>();
        const versionStarted = deferred<void>();
        const defaultFetcher = makeFetcher();
        const fetcher: Fetcher = {
            fetch: jest.fn(async (url: string, body: unknown) => {
                if (url.endsWith('/yomitanVersion')) {
                    versionStarted.resolve();
                    return version.promise;
                }
                return defaultFetcher.fetch(url, body);
            }),
        };
        const { build, settings, subtitles, updated } = makeBuild(
            makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true })),
            fetcher
        );
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);

        const firstBuild = build.buildInitial();
        await versionStarted.promise;
        build.updateSettings(settings, { force: true });
        version.resolve({ version: '0.0.0.0' });
        await expect(firstBuild).resolves.toBe(false);
        expect(subtitles[0].__tokenized).toBeUndefined();

        await build.refresh();

        await waitForPublication();
        expect(subtitles[0].__tokenized).toBe(true);
        expect(updated).toHaveBeenCalledWith([expect.objectContaining({ index: 0 })], expect.any(Array));
    });

    it('does not publish partial annotations when reset cancels asynchronous tokenization', async () => {
        const tokenization = deferred<
            {
                id: string;
                source: string;
                dictionary: string;
                index: number;
                content: { text: string; reading: string }[][];
            }[]
        >();
        const tokenizeStarted = deferred<void>();
        const fetcher: Fetcher = {
            fetch: jest.fn(async (url: string) => {
                if (url.endsWith('/yomitanVersion')) return { version: '0.0.0.0' };
                if (url.endsWith('/tokenize')) {
                    tokenizeStarted.resolve();
                    return tokenization.promise;
                }
                if (url.endsWith('/termEntries')) return { dictionaryEntries: [] };
                throw new Error(`unexpected request: ${url}`);
            }),
        };
        const { build, subtitles, updated } = makeBuild(
            makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true })),
            fetcher
        );
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);

        const initialBuild = build.buildInitial();
        await tokenizeStarted.promise;
        build.setSubtitles(subtitles, true);
        tokenization.resolve([
            {
                id: 'id',
                source: 'source',
                dictionary: 'dictionary',
                index: 0,
                content: [[{ text: 'word', reading: '' }]],
            },
        ]);

        await expect(initialBuild).resolves.toBe(false);
        expect(updated).not.toHaveBeenCalled();
    });

    it('retries a failed tokenization after the retry interval', async () => {
        let now = 100_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        let failTokenize = true;
        const fetcher: Fetcher = {
            fetch: jest.fn(async (url: string) => {
                if (url.endsWith('/yomitanVersion')) return { version: '0.0.0.0' };
                if (url.endsWith('/tokenize')) {
                    if (failTokenize) throw new Error('tokenize failed');
                    return [
                        {
                            id: 'id',
                            source: 'source',
                            dictionary: 'dictionary',
                            index: 0,
                            content: [[{ text: 'word', reading: '' }]],
                        },
                    ];
                }
                if (url.endsWith('/termEntries')) return { dictionaryEntries: [] };
                throw new Error(`unexpected request: ${url}`);
            }),
        };
        const { build, subtitles, updated } = makeBuild(
            makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true })),
            fetcher
        );
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);

        await expect(build.buildInitial()).resolves.toBe(true);
        await waitForPublication();
        expect(subtitles[0].tokenization).toEqual(expect.objectContaining({ error: true }));
        expect(updated).toHaveBeenCalledWith([expect.objectContaining({ index: 0 })], expect.any(Array));

        failTokenize = false;
        now += 10_001;
        await expect(build.buildInitial()).resolves.toBe(true);
        await waitForPublication();
        expect(subtitles[0].__tokenized).toBe(true);
    });

    it('rebuilds subtitles invalidated by a modified token', async () => {
        const { build, subtitles, updated } = makeBuild(
            makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true }))
        );
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        await waitForPublication();
        updated.mockClear();

        build.tokensWereModified(['word']);
        await build.refresh();
        await waitForAsyncBuild();

        expect(updated).toHaveBeenCalledWith([expect.objectContaining({ index: 0 })], expect.any(Array));
    });

    it('only builds enabled dictionary tracks', async () => {
        const enabledTrack = makeDictionaryTrack({ dictionaryColorizeSubtitles: true });
        const disabledTrack = makeDictionaryTrack({ dictionaryYomitanUrl: '' });
        const dictionaryTracks = makeDictionaryTracks(enabledTrack).map((track, index) =>
            index === 1 ? disabledTrack : track
        );
        const { build, subtitles, updated } = makeBuild(dictionaryTracks);
        subtitles.push(makeSubtitle({ index: 0, track: 0, text: 'word' }));
        subtitles.push(makeSubtitle({ index: 1, track: 1, text: 'word' }));
        build.setSubtitles(subtitles, true);

        await build.buildInitial();
        await waitForPublication();

        expect(subtitles[0].__tokenized).toBe(true);
        expect(subtitles[1].__tokenized).toBeUndefined();
        expect(updated).toHaveBeenCalledTimes(1);
        expect(updated).toHaveBeenCalledWith([expect.objectContaining({ index: 0 })], dictionaryTracks);
    });

    it('merges generated tokens around externally supplied readings', async () => {
        const fetcher: Fetcher = {
            fetch: jest.fn(async (url: string, request: { text?: string | string[] }) => {
                if (url.endsWith('/yomitanVersion')) return { version: '0.0.0.0' };
                if (url.endsWith('/tokenize')) {
                    const text = Array.isArray(request.text) ? request.text[0] : request.text;
                    return [
                        {
                            id: 'id',
                            source: 'source',
                            dictionary: 'dictionary',
                            index: 0,
                            content: [[{ text: text ?? '', reading: '' }]],
                        },
                    ];
                }
                if (url.endsWith('/termEntries')) return { dictionaryEntries: [] };
                throw new Error(`unexpected request: ${url}`);
            }),
        };
        const { build, subtitles } = makeBuild(
            makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true })),
            fetcher
        );
        subtitles.push(
            makeSubtitle({
                text: 'first word last',
                originalText: 'first word last',
                tokenization: { tokens: [makeToken({ pos: [6, 10], readings: [{ pos: [6, 10], reading: 'よみ' }] })] },
            })
        );
        build.setSubtitles(subtitles, true);

        await build.buildInitial();
        await waitForPublication();

        expect(subtitles[0].text).toBe('first word last');
        expect(subtitles[0].tokenization?.tokens).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ pos: [6, 10], readings: [{ pos: [6, 10], reading: 'よみ' }] }),
            ])
        );
    });

    it('generates statistics in a batch and publishes complete progress', async () => {
        let now = Date.now();
        jest.spyOn(Date, 'now').mockImplementation(() => ++now);
        const track = makeDictionaryTrack({
            dictionaryAutoGenerateStatistics: true,
            dictionaryColorizeSubtitles: true,
        });
        const { build, storage, subtitles } = makeBuild(makeDictionaryTracks(track));
        subtitles.push(makeSubtitle({ index: 0, text: 'word' }), makeSubtitle({ index: 1, text: 'word' }));
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        await waitForPublication();

        build.requestStatisticsGeneration();
        await build.refresh();
        await waitForAsyncBuild();

        await build.refresh();
        await waitForAsyncBuild();
        const snapshot = storage.publishStatisticsSnapshot.mock.calls.findLast(
            (call) => call[1] !== undefined
        )?.[1] as {
            snapshots: {
                progress: { current: number; total: number };
                stats: { sentences: Record<number, unknown> };
            }[];
        };
        expect(snapshot.snapshots[0].progress).toEqual(expect.objectContaining({ current: 2, total: 2 }));
        expect(Object.keys(snapshot.snapshots[0].stats.sentences)).toEqual(['0', '1']);
    });

    it('publishes Anki statistics through the refresh boundary', async () => {
        const track = makeDictionaryTrack({
            dictionaryAutoGenerateStatistics: true,
            dictionaryColorizeSubtitles: true,
            dictionaryAnkiWordFields: ['Word'],
        });
        const fetcher: Fetcher = {
            fetch: jest.fn(async (url: string, request: { action?: string }) => {
                if (request.action === 'requestPermission') return { result: { permission: 'granted' } };
                if (request.action === 'findCards') return { result: [] };
                if (url.endsWith('/yomitanVersion')) return { version: '0.0.0.0' };
                if (url.endsWith('/tokenize'))
                    return [
                        {
                            id: 'id',
                            source: 'source',
                            dictionary: 'dictionary',
                            index: 0,
                            content: [[{ text: 'word', reading: '' }]],
                        },
                    ];
                if (url.endsWith('/termEntries')) return { dictionaryEntries: [] };
                throw new Error(`unexpected request: ${url}`);
            }),
        };
        const { build, storage, subtitles } = makeBuild(makeDictionaryTracks(track), fetcher);
        storage.getRecords.mockResolvedValue({
            tokenRecords: [],
            ankiCardRecords: {
                0: {
                    7: {
                        cardId: 7,
                        status: TokenStatus.LEARNING,
                        data: { deckName: 'Mining', modelName: 'Sentence', due: 3 },
                    },
                },
            },
            waniKaniSubjectRecords: {},
        });
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        await waitForPublication();

        build.requestStatisticsGeneration();
        await build.refresh();
        await waitForAsyncBuild();
        await build.refresh();
        await waitForAsyncBuild();

        const snapshots = storage.publishStatisticsSnapshot.mock.calls
            .map((call) => call[1])
            .filter((snapshot): snapshot is { anki?: unknown } => snapshot !== undefined);
        const snapshot = snapshots.find((published) => (published.anki as { available?: boolean })?.available);
        expect(snapshot?.anki).toEqual(
            expect.objectContaining({
                cardsInfo: { 7: { deckName: 'Mining', modelName: 'Sentence', due: 3 } },
                cardsStatus: { 7: TokenStatus.LEARNING },
                dueCards: { 0: [], 1: [], 7: [] },
            })
        );
    });

    it('defers frequency and pitch enrichment until the next refresh on older Yomitan', async () => {
        const fetcher: Fetcher = {
            fetch: jest.fn(async (url: string) => {
                if (url.endsWith('/yomitanVersion')) return { version: '26.4.5' };
                if (url.endsWith('/tokenize'))
                    return [
                        {
                            id: 'id',
                            source: 'source',
                            dictionary: 'dictionary',
                            index: 0,
                            content: [[{ text: 'word', reading: 'word' }]],
                        },
                    ];
                if (url.endsWith('/termEntries'))
                    return {
                        dictionaryEntries: [
                            {
                                headwords: [
                                    {
                                        index: 0,
                                        headwordIndex: 0,
                                        term: 'word',
                                        reading: 'word',
                                        sources: [
                                            {
                                                originalText: 'word',
                                                transformedText: 'word',
                                                deinflectedText: 'word',
                                                matchType: 'exact',
                                                matchSource: 'term',
                                                isPrimary: true,
                                            },
                                        ],
                                    },
                                ],
                                frequencies: [
                                    {
                                        index: 0,
                                        headwordIndex: 0,
                                        dictionary: 'frequency',
                                        dictionaryIndex: 0,
                                        dictionaryAlias: 'frequency',
                                        hasReading: true,
                                        frequencyMode: 'rank-based',
                                        frequency: 7,
                                        displayValue: '7',
                                        displayValueParsed: true,
                                    },
                                ],
                                definitions: [],
                                pronunciations: [
                                    {
                                        index: 0,
                                        headwordIndex: 0,
                                        dictionary: 'pitch',
                                        dictionaryIndex: 0,
                                        dictionaryAlias: 'pitch',
                                        pronunciations: [
                                            {
                                                type: 'pitch-accent',
                                                positions: 'HL',
                                                nasalPositions: [],
                                                devoicePositions: [],
                                                tags: [],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    };
                throw new Error(`unexpected request: ${url}`);
            }),
        };
        const { build, subtitles } = makeBuild(
            makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true })),
            fetcher
        );
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);

        await build.buildInitial();
        await waitForPublication();
        expect(subtitles[0].tokenization?.tokens[0]).toEqual(
            expect.not.objectContaining({ frequency: 7, pitchAccent: 'HL' })
        );

        await build.refresh();
        await waitForAsyncBuild();
        expect(subtitles[0].tokenization?.tokens[0]).toEqual(
            expect.objectContaining({ frequency: 7, pitchAccent: 'HL' })
        );
    });

    it('refreshes Anki once per observed card change through the public refresh boundary', async () => {
        const recentCards = [[1], [2]];
        const fetcher: Fetcher = {
            fetch: jest.fn(async (url: string, request: { action?: string }) => {
                if (url.endsWith('/yomitanVersion')) return { version: '0.0.0.0' };
                if (url.endsWith('/tokenize'))
                    return [
                        {
                            id: 'id',
                            source: 'source',
                            dictionary: 'dictionary',
                            index: 0,
                            content: [[{ text: 'word', reading: '' }]],
                        },
                    ];
                if (url.endsWith('/termEntries')) return { dictionaryEntries: [] };
                if (request.action === 'requestPermission') return { result: { permission: 'granted' } };
                if (request.action === 'findCards') return { result: recentCards.shift() ?? [] };
                throw new Error(`unexpected request: ${url}`);
            }),
        };
        const track = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryAnkiWordFields: ['Word'],
        });
        const { build, storage, subtitles } = makeBuild(makeDictionaryTracks(track), fetcher);
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        await waitForPublication();

        build.ankiCardWasModified();
        await build.refresh();
        await waitForAsyncBuild();
        build.ankiCardWasModified();
        await build.refresh();
        await waitForAsyncBuild();

        expect(storage.buildAnkiCache).toHaveBeenCalledTimes(2);
        expect(fetcher.fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ action: 'requestPermission' })
        );
        expect(fetcher.fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ action: 'findCards' })
        );
    });

    it('builds the WaniKani cache when statistics generation requests an external refresh', async () => {
        const track = makeDictionaryTrack({
            dictionaryAutoGenerateStatistics: true,
            dictionaryColorizeSubtitles: true,
            dictionaryWaniKaniApiToken: 'wani-token',
        });
        const { build, storage, subtitles } = makeBuild(makeDictionaryTracks(track));
        subtitles.push(makeSubtitle({ text: 'word' }));
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        await waitForPublication();

        build.requestStatisticsGeneration();
        await build.refresh();
        await waitForAsyncBuild();
        await build.refresh();
        await waitForAsyncBuild();

        expect(storage.buildWaniKaniCache).toHaveBeenCalledWith(undefined);
    });

    it('publishes available and unavailable WaniKani track results through the refresh boundary', async () => {
        const firstTrack = makeDictionaryTrack({
            dictionaryAutoGenerateStatistics: true,
            dictionaryColorizeSubtitles: true,
            dictionaryWaniKaniApiToken: 'first-token',
        });
        const secondTrack = makeDictionaryTrack({
            dictionaryColorizeSubtitles: true,
            dictionaryWaniKaniApiToken: 'second-token',
        });
        const dictionaryTracks = makeDictionaryTracks(firstTrack).map((track, index) =>
            index === 1 ? secondTrack : track
        );
        const { build, storage, subtitles } = makeBuild(dictionaryTracks);
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        storage.getRecords.mockImplementation(async (_profile?: string, track?: number) => {
            if (track === 1) throw new Error('track offline');
            if (track === 0)
                return {
                    tokenRecords: [],
                    ankiCardRecords: {},
                    waniKaniAssignmentRecords: {
                        0: {
                            21: {
                                profile: 'Profile',
                                track: 0,
                                assignmentId: 21,
                                subjectId: 11,
                                status: TokenStatus.UNKNOWN,
                                data: { srs_stage: 1, hidden: false },
                            },
                        },
                    },
                    waniKaniSubjectRecords: {
                        0: {
                            11: {
                                profile: 'Profile',
                                track: 0,
                                subjectId: 11,
                                data: {
                                    characters: 'word',
                                    hidden_at: null,
                                    level: 2,
                                    spaced_repetition_system_id: 1,
                                },
                            },
                        },
                    },
                };
            return { tokenRecords: [], ankiCardRecords: {}, waniKaniSubjectRecords: {} };
        });
        subtitles.push(makeSubtitle({ text: 'word', track: 0 }));
        build.setSubtitles(subtitles, true);
        await build.buildInitial();
        await waitForPublication();

        build.requestStatisticsGeneration();
        await build.refresh();
        await waitForAsyncBuild();
        await build.refresh();
        await waitForAsyncBuild();

        const snapshots = storage.publishStatisticsSnapshot.mock.calls
            .map((call) => call[1])
            .filter((snapshot): snapshot is { waniKani?: Record<number, unknown> } => snapshot !== undefined);
        const snapshot = snapshots.find((published) => published.waniKani !== undefined);
        expect(snapshot?.waniKani).toEqual(
            expect.objectContaining({
                0: expect.objectContaining({ available: true, assignments: expect.any(Array) }),
                1: { available: false, assignments: [], subjects: {} },
            })
        );
        expect(consoleError).toHaveBeenCalledWith(
            expect.stringContaining('[asbplayer][annotations/wanikani]'),
            'Error refreshing WaniKani for Track2 statistics:',
            expect.any(Error)
        );
        consoleError.mockRestore();
    });
});
