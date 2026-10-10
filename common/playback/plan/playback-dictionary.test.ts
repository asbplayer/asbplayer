import { describe, expect, it } from '@jest/globals';
import { AutoPausePreference, PlayMode } from '@project/common';
import type { IndexedSubtitleModel, Token } from '@project/common';
import type { DictionaryPlaybackConfig } from '@project/common/settings';
import {
    defaultSettings,
    dictionaryStatusCollectionEnabled,
    dictionaryPlaybackFeatures,
    dictionaryTrackEnabled,
    SubtitleVisibility,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import { subtitleWordVisibility, matchingPlaybackTokens } from '@project/common/playback/plan/playback-dictionary';
import { sentenceComprehensionPercent } from '@project/common/dictionary-statistics/dictionary-statistics-view';
import { buildPlaybackPlan } from '@project/common/playback/plan/playback-plan';
import { makePlaybackPlanInput, makeSubtitle } from '@project/common/playback/playback-test-utils';
import PlaybackTimeline from '@project/common/playback/timeline/playback-timeline';
import PlaybackPlanExecutor from '@project/common/playback/plan/playback-plan-executor';

const config = (): DictionaryPlaybackConfig =>
    JSON.parse(JSON.stringify(defaultSettings.dictionaryTracks[0].dictionaryPlaybackConfig));
const token = (start: number, end: number, status: TokenStatus, overrides?: Partial<Token>): Token => ({
    pos: [start, end],
    states: [],
    status,
    readings: [],
    ...overrides,
});
const subtitle = (
    text: string,
    tokens: Token[],
    options?: { readonly index?: number; readonly start?: number }
): IndexedSubtitleModel => {
    const start = options?.start ?? 1000;
    return makeSubtitle({
        text,
        tokenization: { tokens },
        index: options?.index ?? 0,
        start,
        end: start + 1000,
        originalStart: start,
        originalEnd: start + 1000,
    });
};
const tracksWith = (playback: DictionaryPlaybackConfig) => [
    { ...defaultSettings.dictionaryTracks[0], dictionaryPlaybackConfig: playback },
    ...defaultSettings.dictionaryTracks.slice(1),
];

describe('dictionary playback rules', () => {
    it.each([0, 1, 2])('matches %i words without a word-count limit for status and state triggers', (count) => {
        const playback = config();
        const tokens = [token(0, 3, TokenStatus.UNKNOWN), token(4, 8, TokenStatus.UNKNOWN)].slice(0, count);
        const sentence = subtitle('red blue', tokens);
        playback.autoPause.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        expect(matchingPlaybackTokens(sentence, playback, 'autoPause')).toEqual(tokens);

        playback.autoPause.onStatuses[TokenStatus.UNKNOWN].enabled = false;
        playback.autoPause.onStates[TokenState.IGNORED].enabled = true;
        for (const word of tokens) {
            word.status = undefined;
            word.states = [TokenState.IGNORED];
        }
        expect(matchingPlaybackTokens(sentence, playback, 'autoPause')).toEqual(tokens);
    });

    it('does not match tokens when only another feature has selected triggers', () => {
        const playback = config();
        playback.autoPause.rules.minWords = 1;
        playback.autoPause.rules.minFrequency = 1;
        playback.repeat.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        playback.repeat.onStates[TokenState.IGNORED].enabled = true;
        const sentence = subtitle('red', [token(0, 3, TokenStatus.UNKNOWN, { states: [TokenState.IGNORED] })]);
        expect(matchingPlaybackTokens(sentence, playback, 'autoPause')).toEqual([]);
    });

    it('applies status counts separately and treats missing frequency as one', () => {
        const playback = config();
        playback.autoPause.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        playback.autoPause.rules.maxWords = 1;
        playback.autoPause.rules.maxFrequency = 1;
        const twoUnknown = subtitle('red blue', [token(0, 3, TokenStatus.UNKNOWN), token(4, 8, TokenStatus.UNKNOWN)]);
        expect(matchingPlaybackTokens(twoUnknown, playback, 'autoPause')).toEqual([]);

        const oneUnknown = subtitle('red blue', [
            token(0, 3, TokenStatus.UNKNOWN, { frequency: null }),
            token(4, 8, TokenStatus.MATURE),
        ]);
        expect(matchingPlaybackTokens(oneUnknown, playback, 'autoPause')).toEqual([oneUnknown.tokenization!.tokens[0]]);
        oneUnknown.tokenization!.tokens[0].frequency = 2;
        expect(matchingPlaybackTokens(oneUnknown, playback, 'autoPause')).toEqual([]);
        playback.autoPause.rules.maxFrequency = 0;
        expect(matchingPlaybackTokens(oneUnknown, playback, 'autoPause')).toEqual([oneUnknown.tokenization!.tokens[0]]);
    });

    it('checks selected states independently of statuses', () => {
        const playback = config();
        playback.repeat.onStates[TokenState.IGNORED].enabled = true;
        playback.repeat.rules.maxWords = 1;
        const selected = token(0, 3, TokenStatus.MATURE, { states: [TokenState.IGNORED] });
        const other = token(4, 8, TokenStatus.UNKNOWN);
        expect(matchingPlaybackTokens(subtitle('red blue', [selected, other]), playback, 'repeat')).toEqual([selected]);
        other.states = [TokenState.IGNORED];
        expect(matchingPlaybackTokens(subtitle('red blue', [selected, other]), playback, 'repeat')).toEqual([]);
        other.states = [];
        selected.status = undefined;
        expect(matchingPlaybackTokens(subtitle('red blue', [selected, other]), playback, 'repeat')).toEqual([selected]);
    });

    it.each([
        { minWords: 2, maxWords: 0, matches: [false, true, true] },
        { minWords: 2, maxWords: 2, matches: [false, true, false] },
    ])('applies count bounds $minWords–$maxWords to each status or state', ({ minWords, maxWords, matches }) => {
        const playback = config();
        playback.repeat.rules.minWords = minWords;
        playback.repeat.rules.maxWords = maxWords;
        for (const trigger of ['status', 'state']) {
            playback.repeat.onStatuses[TokenStatus.UNKNOWN].enabled = trigger === 'status';
            playback.repeat.onStatuses[TokenStatus.MATURE].enabled = trigger === 'status';
            playback.repeat.onStates[TokenState.IGNORED].enabled = trigger === 'state';
            for (const count of [1, 2, 3]) {
                const selected = [
                    token(0, 3, TokenStatus.UNKNOWN, { states: [TokenState.IGNORED, TokenState.IGNORED] }),
                    token(4, 8, TokenStatus.UNKNOWN, { states: [TokenState.IGNORED] }),
                    token(9, 14, TokenStatus.UNKNOWN, { states: [TokenState.IGNORED] }),
                ].slice(0, count);
                const other = token(15, 19, TokenStatus.MATURE);
                const sentence = subtitle('red blue green gold', [...selected, other]);
                expect(matchingPlaybackTokens(sentence, playback, 'repeat')).toEqual(
                    matches[count - 1] ? selected : []
                );
            }
        }
    });

    it('combines count and frequency bounds, including missing frequency and disabled endpoints', () => {
        const playback = config();
        playback.autoPause.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        Object.assign(playback.autoPause.rules, { minWords: 6, maxWords: 6, minFrequency: 2, maxFrequency: 3 });
        const tokens = [undefined, null, 1, 2, 3, 4].map((frequency, index) =>
            token(index * 4, index * 4 + 3, TokenStatus.UNKNOWN, { frequency })
        );
        const sentence = subtitle('red red red red red red', tokens);
        expect(matchingPlaybackTokens(sentence, playback, 'autoPause')).toEqual(tokens.slice(3, 5));
        playback.autoPause.rules.maxFrequency = 0;
        expect(matchingPlaybackTokens(sentence, playback, 'autoPause')).toEqual(tokens.slice(3));
        playback.autoPause.rules.minFrequency = 0;
        expect(matchingPlaybackTokens(sentence, playback, 'autoPause')).toEqual(tokens);
        playback.autoPause.rules.maxFrequency = 1;
        expect(matchingPlaybackTokens(sentence, playback, 'autoPause')).toEqual(tokens.slice(0, 3));
    });

    it('uses minimum bounds for word visibility and the whole-subtitle hiding threshold', () => {
        const playback = config();
        playback.wordVisibility.onStatuses[TokenStatus.MATURE].enabled = true;
        Object.assign(playback.wordVisibility.rules, {
            minWords: 2,
            minFrequency: 2,
        });
        playback.wordVisibility.wholeSubtitleMatchThreshold = 0.5;
        const tokens = [
            token(0, 3, TokenStatus.MATURE, { frequency: 1 }),
            token(4, 8, TokenStatus.MATURE, { frequency: 2 }),
            token(9, 14, TokenStatus.MATURE, { frequency: 3 }),
        ];
        const sentence = subtitle('red blue green', tokens);
        expect(subtitleWordVisibility(sentence, playback)).toEqual({
            hiddenTokens: new Set([tokens[0]]),
            hideWholeSubtitle: false,
        });
        playback.wordVisibility.rules.minWords = 4;
        expect(subtitleWordVisibility(sentence, playback)).toEqual({
            hiddenTokens: new Set(tokens),
            hideWholeSubtitle: true,
        });
    });

    it('counts nonmatching words toward the whole-subtitle threshold and keeps untokenized text visible', () => {
        const playback = config();
        const allHidden = subtitle('red, blue!', [token(0, 3, TokenStatus.UNKNOWN), token(5, 9, TokenStatus.UNKNOWN)]);
        expect(subtitleWordVisibility(allHidden, playback)).toEqual({
            hiddenTokens: new Set(),
            hideWholeSubtitle: false,
        });

        playback.wordVisibility.onStatuses[TokenStatus.MATURE].enabled = true;
        const partial = subtitle('red, blue!', [token(0, 3, TokenStatus.MATURE), token(5, 9, TokenStatus.UNKNOWN)]);
        const untokenizedWord = subtitle('red blue', [token(0, 3, TokenStatus.UNKNOWN)]);
        expect(subtitleWordVisibility(allHidden, playback)).toEqual({
            hiddenTokens: new Set(allHidden.tokenization!.tokens),
            hideWholeSubtitle: true,
        });
        expect(subtitleWordVisibility(partial, playback)).toEqual({
            hiddenTokens: new Set([partial.tokenization!.tokens[1]]),
            hideWholeSubtitle: false,
        });
        expect(playback.wordVisibility.wholeSubtitleMatchThreshold).toBe(1);
        expect(subtitleWordVisibility(untokenizedWord, playback).hideWholeSubtitle).toBe(false);
        playback.wordVisibility.wholeSubtitleMatchThreshold = 0.5;
        expect(subtitleWordVisibility(partial, playback).hideWholeSubtitle).toBe(true);
        expect(subtitleWordVisibility(untokenizedWord, playback).hideWholeSubtitle).toBe(true);
        playback.wordVisibility.wholeSubtitleMatchThreshold = 0.51;
        expect(subtitleWordVisibility(partial, playback).hideWholeSubtitle).toBe(false);
    });

    it('uses the statistics status weights and excludes ignored or nonletter tokens', () => {
        const scored = subtitle('red red blue !', [
            token(0, 3, TokenStatus.UNKNOWN, { groupingKey: 'red', lemmasGroupingKey: 'red' }),
            token(4, 7, TokenStatus.MATURE, { groupingKey: 'red', lemmasGroupingKey: 'red' }),
            token(8, 12, TokenStatus.GRADUATED, { groupingKey: 'blue' }),
            token(13, 14, TokenStatus.UNKNOWN, { groupingKey: 'punctuation' }),
        ]);
        expect(sentenceComprehensionPercent(scored)).toBeCloseTo((2.5 / 3) * 100);
        const zeroScore = subtitle('red blue', [
            token(0, 3, TokenStatus.UNCOLLECTED, { groupingKey: 'red' }),
            token(4, 8, TokenStatus.UNKNOWN, { groupingKey: 'blue' }),
        ]);
        expect(sentenceComprehensionPercent(zeroScore)).toBe(0);
        const ignored = subtitle('red', [
            token(0, 3, TokenStatus.UNKNOWN, { groupingKey: 'red', states: [TokenState.IGNORED] }),
        ]);
        expect(sentenceComprehensionPercent(ignored)).toBe(100);
        expect(
            sentenceComprehensionPercent(
                subtitle('!', [token(0, 1, TokenStatus.UNKNOWN, { groupingKey: 'punctuation' })])
            )
        ).toBe(100);
    });

    it('enables annotation collection for playback rules, including comprehension', () => {
        const playback = config();
        const track = tracksWith(playback)[0];
        expect(dictionaryTrackEnabled(track)).toBe(false);
        playback.autoPause.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        expect(dictionaryTrackEnabled(track)).toBe(true);
        expect(dictionaryStatusCollectionEnabled(track, { includeStates: false })).toBe(true);
        playback.autoPause.onStatuses[TokenStatus.UNKNOWN].enabled = false;
        playback.fastForward.rateByComprehension.enabled = true;
        expect(dictionaryStatusCollectionEnabled(track, { includeStates: false })).toBe(true);
    });
});

describe('compiled dictionary playback', () => {
    it.each([
        { mode: PlayMode.autoPause, timestampMs: 1500, pauses: [1999], seeks: [] },
        { mode: PlayMode.repeat, timestampMs: 1500, pauses: [], seeks: [1000] },
        { mode: PlayMode.condensed, timestampMs: 0, pauses: [], seeks: [999] },
        { mode: PlayMode.fastForward, timestampMs: 1500, pauses: [], seeks: [] },
    ])('ignores filters on excluded tracks in $mode mode', async ({ mode, timestampMs, pauses, seeks }) => {
        const playback = config();
        for (const feature of dictionaryPlaybackFeatures) {
            playback[feature].onStatuses[TokenStatus.UNKNOWN].enabled = true;
        }
        const eligible = subtitle('unknown', [token(0, 7, TokenStatus.UNKNOWN)]);
        const excluded = {
            ...subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 1, start: 3000 }),
            track: 1,
        };
        const dictionaryTracks = [
            defaultSettings.dictionaryTracks[0],
            { ...defaultSettings.dictionaryTracks[1], dictionaryPlaybackConfig: playback },
            defaultSettings.dictionaryTracks[2],
        ];
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([eligible], {
                displaySubtitles: [eligible, excluded],
                playModes: new Set([mode]),
                dictionaryTracks,
            })
        );
        const actualPauses: number[] = [];
        const actualSeeks: number[] = [];
        const executor = new PlaybackPlanExecutor(plan, timestampMs, {
            play: async () => {},
            paused: () => false,
            pause: ({ timestampMs }) => actualPauses.push(timestampMs),
            seek: async (timestampMs) => {
                actualSeeks.push(timestampMs);
            },
            setPlaybackRate: () => {},
            correctAutoPause: async () => ({ seekIssued: false }),
        });
        executor.initializePlaybackRate(timestampMs);
        await executor.update(mode === PlayMode.autoPause || mode === PlayMode.repeat ? 1999 : timestampMs, {});

        expect(actualPauses).toEqual(pauses);
        expect(actualSeeks).toEqual(seeks);
        expect(executor.playbackRate).toBe(1.25);
        expect(plan.timelineSubtitles.hiddenSubtitleIndexes).toEqual([excluded.index]);
    });

    it('limits auto-pause and repeat to matching subtitles and selects the first matching token', () => {
        const playback = config();
        playback.autoPause.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        playback.repeat.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        const matching = subtitle('one two', [token(0, 3, TokenStatus.MATURE), token(4, 7, TokenStatus.UNKNOWN)], {
            index: 0,
        });
        const other = subtitle('three', [token(0, 5, TokenStatus.MATURE)], { index: 1, start: 3000 });
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([matching, other], {
                playModes: new Set([PlayMode.autoPause, PlayMode.repeat]),
                autoPausePreference: AutoPausePreference.atStartAndEnd,
                dictionaryTracks: tracksWith(playback),
            })
        );
        expect(plan.timelineSubtitles.blocks.every((block) => block.startAction === undefined)).toBe(true);
        expect(plan.timelineSubtitles.blocks.every((block) => block.endAction === undefined)).toBe(true);
        expect(plan.timelineSubtitles.actionBlocks).toEqual([
            expect.objectContaining({
                id: 'autoPause:[0]',
                startAction: true,
                autoPauseToken: { subtitleIndex: 0, tokenStart: 4 },
                endAction: { pause: true },
            }),
            expect.objectContaining({
                id: 'repeat:[0]',
                endAction: { pause: false, repeat: { count: 0, repeatsBeforeShowingSubtitles: 0 } },
            }),
        ]);
    });

    it('runs adaptive auto-pause and repeat at the matching subtitle edges inside an overlap', async () => {
        const playback = config();
        playback.autoPause.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        playback.repeat.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        const outer = {
            ...subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 0 }),
            end: 5000,
            originalEnd: 5000,
        };
        const inner = subtitle('unknown', [token(0, 7, TokenStatus.UNKNOWN)], { index: 1, start: 2000 });
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([outer, inner], {
                playModes: new Set([PlayMode.autoPause, PlayMode.repeat]),
                autoPausePreference: AutoPausePreference.atStartAndEnd,
                repeatCountPreference: 1,
                repeatsBeforeShowingSubtitles: 1,
                dictionaryTracks: tracksWith(playback),
            })
        );
        expect(plan.timelineSubtitles.blocks).toHaveLength(1);
        expect(plan.timelineSubtitles.blocks[0].subtitleIndexes).toEqual([0, 1]);
        expect(plan.timelineSubtitles.blocks[0].startAction).toBeUndefined();
        expect(plan.timelineSubtitles.blocks[0].endAction).toBeUndefined();
        expect(
            plan.timelineSubtitles.actionBlocks.map((block) => [
                block.id,
                block.playbackModeStartMs,
                block.playbackModeEndMs,
            ])
        ).toEqual([
            ['autoPause:[1]', 2000, 2999],
            ['repeat:[1]', 2000, 2999],
        ]);

        const pauses: { timestampMs: number; subtitleIndex?: number }[] = [];
        const seeks: number[] = [];
        const executor = new PlaybackPlanExecutor(plan, 1500, {
            play: async () => {},
            paused: () => false,
            pause: ({ timestampMs, autoPauseToken, playbackModeSubtitlesAtPause }) => {
                expect(playbackModeSubtitlesAtPause).toEqual([inner]);
                pauses.push({ timestampMs, subtitleIndex: autoPauseToken?.subtitleIndex });
            },
            seek: async (timestampMs) => {
                seeks.push(timestampMs);
            },
            setPlaybackRate: () => {},
            correctAutoPause: async () => ({ seekIssued: false }),
        });
        expect(executor.hideSubtitlesForRepeatAt(1500)).toBe(false);
        expect(executor.hideSubtitlesForRepeatAt(2500)).toBe(true);
        expect(executor.hideSubtitlesForRepeatAt(3500)).toBe(false);
        await executor.update(1999, {});
        expect(pauses).toEqual([]);
        await executor.update(2000, {});
        expect(pauses).toEqual([{ timestampMs: 2000, subtitleIndex: 1 }]);
        await executor.update(2999, {});
        expect(pauses).toEqual([
            { timestampMs: 2000, subtitleIndex: 1 },
            { timestampMs: 2999, subtitleIndex: 1 },
        ]);
        await executor.playbackStarted();
        expect(seeks).toEqual([2000]);
        expect(executor.handleDiscontinuity(2000).cause).toBe('internal-seek');
        await executor.update(2000, {});
        expect(pauses).toHaveLength(2);
    });

    it.each([3000, 5000])(
        'merges overlapping matching subtitles into one pause/repeat segment (inner end: %i)',
        async (innerEnd) => {
            const playback = config();
            playback.autoPause.onStatuses[TokenStatus.UNKNOWN].enabled = true;
            playback.repeat.onStatuses[TokenStatus.UNKNOWN].enabled = true;
            const outer = {
                ...subtitle('first', [token(0, 5, TokenStatus.UNKNOWN)], { index: 0 }),
                end: 4000,
                originalEnd: 4000,
            };
            const inner = {
                ...subtitle('second', [token(0, 6, TokenStatus.UNKNOWN)], { index: 1, start: 2000 }),
                end: innerEnd,
                originalEnd: innerEnd,
            };
            const endMs = Math.max(outer.end, inner.end) - 1;
            const plan = buildPlaybackPlan(
                makePlaybackPlanInput([outer, inner], {
                    playModes: new Set([PlayMode.autoPause, PlayMode.repeat]),
                    autoPausePreference: AutoPausePreference.atStartAndEnd,
                    repeatCountPreference: 1,
                    repeatsBeforeShowingSubtitles: 1,
                    dictionaryTracks: tracksWith(playback),
                })
            );
            expect(
                plan.timelineSubtitles.actionBlocks.map((block) => [
                    block.id,
                    block.subtitleIndexes,
                    block.playbackModeStartMs,
                    block.playbackModeEndMs,
                ])
            ).toEqual([
                ['autoPause:[0,1]', [0, 1], 1000, endMs],
                ['repeat:[0,1]', [0, 1], 1000, endMs],
            ]);

            const pauses: number[] = [];
            const seeks: number[] = [];
            const executor = new PlaybackPlanExecutor(plan, 500, {
                play: async () => {},
                paused: () => false,
                pause: ({ timestampMs }) => {
                    pauses.push(timestampMs);
                },
                seek: async (timestampMs) => {
                    seeks.push(timestampMs);
                },
                setPlaybackRate: () => {},
                correctAutoPause: async () => ({ seekIssued: false }),
            });
            await executor.update(1000, {});
            await executor.update(2000, {});
            await executor.update(Math.min(outer.end, inner.end) - 1, {});
            expect(pauses).toEqual([1000]);
            expect(executor.hideSubtitlesForRepeatAt(1500)).toBe(true);
            await executor.update(endMs, {});
            expect(pauses).toEqual([1000, endMs]);
            await executor.playbackStarted();
            expect(seeks).toEqual([1000]);
        }
    );

    it('skips subtitles without selected words in condensed mode', () => {
        const playback = config();
        playback.condensed.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        const skipped = subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 0 });
        const retained = subtitle('unknown', [token(0, 7, TokenStatus.UNKNOWN)], { index: 1, start: 4000 });
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([skipped, retained], {
                durationMs: 6000,
                playModes: new Set([PlayMode.condensed]),
                dictionaryTracks: tracksWith(playback),
            })
        );
        const timeline = PlaybackTimeline.fromSubtitles(plan.timelineSubtitles);
        expect(timeline.lookupAt(100).segment.condensedTarget).toBe(3999);
        expect(timeline.lookupAt(4500).segment.condensedTarget).toBeUndefined();
    });

    it.each([0, 1, 2])('does not skip past %i subtitles with pending tokenization', async (pendingCount) => {
        const playback = config();
        playback.condensed.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        const skipped = subtitle('known', [token(0, 5, TokenStatus.MATURE)]);
        const pending = Array.from({ length: pendingCount }, (_, index) =>
            makeSubtitle(4000 + index * 2000, 5000 + index * 2000, index + 1)
        );
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([skipped, ...pending], {
                durationMs: 8000,
                playModes: new Set([PlayMode.condensed]),
                dictionaryTracks: tracksWith(playback),
            })
        );
        const seeks: number[] = [];
        const executor = new PlaybackPlanExecutor(plan, 0, {
            paused: () => false,
            pause: () => {},
            play: async () => {},
            seek: async (timestampMs) => {
                seeks.push(timestampMs);
            },
            setPlaybackRate: () => {},
            correctAutoPause: async () => ({ seekIssued: false }),
        });

        await executor.update(0, {});
        expect(seeks).toEqual([pendingCount ? 3999 : 8000]);
    });

    it.each([
        { tokens: [], error: true },
        { tokens: [token(0, 5, TokenStatus.UNKNOWN, { status: undefined })] },
        { tokens: [token(0, 5, TokenStatus.UNKNOWN, { status: null })] },
    ])('retains unresolved annotations in condensed mode and reevaluates them when ready: %j', async (tokenization) => {
        const playback = config();
        playback.condensed.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        const input = makePlaybackPlanInput([makeSubtitle({ text: 'known', tokenization })], {
            playModes: new Set([PlayMode.condensed]),
            dictionaryTracks: tracksWith(playback),
        });
        const seeks: number[] = [];
        const executor = new PlaybackPlanExecutor(buildPlaybackPlan(input), 1500, {
            paused: () => false,
            pause: () => {},
            play: async () => {},
            seek: async (timestampMs) => {
                seeks.push(timestampMs);
            },
            setPlaybackRate: () => {},
            correctAutoPause: async () => ({ seekIssued: false }),
        });

        await executor.update(1500, {});
        expect(seeks).toEqual([]);
        executor.replacePlan(
            buildPlaybackPlan({
                ...input,
                subtitles: [subtitle('known', [token(0, 5, TokenStatus.MATURE)])],
            }),
            1500,
            {}
        );
        await executor.update(1500, {});
        expect(seeks).toEqual([6000]);
    });

    it.each([6000, NaN])(
        'respects adaptive condensed gap offsets with explicit or inferred duration %s',
        (durationMs) => {
            const playback = config();
            playback.condensed.onStatuses[TokenStatus.UNKNOWN].enabled = true;
            const retained = subtitle('unknown', [token(0, 7, TokenStatus.UNKNOWN)], { index: 0 });
            const skipped = subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 1, start: 5000 });
            const plan = buildPlaybackPlan(
                makePlaybackPlanInput([retained, skipped], {
                    durationMs,
                    playModes: new Set([PlayMode.condensed]),
                    dictionaryTracks: tracksWith(playback),
                    subtitleTriggerGapStartOffset: 1500,
                })
            );
            const timeline = PlaybackTimeline.fromSubtitles(plan.timelineSubtitles);
            expect(timeline.lookupAt(2500).segment.condensedTarget).toBeUndefined();
            expect(timeline.lookupAt(3500).segment.condensedTarget).toBe(6000);
        }
    );

    it.each([
        { startOffset: 1500, endOffset: 0, gapStart: 3500, gapEnd: 4999 },
        { startOffset: 0, endOffset: -1500, gapStart: 2000, gapEnd: 3499 },
        { startOffset: 1500, endOffset: -1000, gapStart: 3500, gapEnd: 3999 },
    ])(
        'respects adaptive condensed gap boundaries with offsets $startOffset and $endOffset',
        async ({ startOffset, endOffset, gapStart, gapEnd }) => {
            const playback = config();
            playback.condensed.onStatuses[TokenStatus.UNKNOWN].enabled = true;
            const plan = buildPlaybackPlan(
                makePlaybackPlanInput(
                    [
                        subtitle('unknown', [token(0, 7, TokenStatus.UNKNOWN)], { index: 0 }),
                        subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 1, start: 3000 }),
                        subtitle('unknown', [token(0, 7, TokenStatus.UNKNOWN)], { index: 2, start: 5000 }),
                    ],
                    {
                        durationMs: 8000,
                        playModes: new Set([PlayMode.condensed]),
                        dictionaryTracks: tracksWith(playback),
                        subtitleTriggerGapStartOffset: startOffset,
                        subtitleTriggerGapEndOffset: endOffset,
                    }
                )
            );
            const timeline = PlaybackTimeline.fromSubtitles(plan.timelineSubtitles);
            expect(timeline.lookupAt(gapStart - 1).segment.condensedTarget).toBeUndefined();
            expect(timeline.lookupAt(gapStart).segment.condensedTarget).toBe(gapEnd);
            expect(timeline.lookupAt(gapEnd - 1).segment.condensedTarget).toBe(gapEnd);
            expect(timeline.lookupAt(gapEnd).segment.condensedTarget).toBeUndefined();

            const seeks: number[] = [];
            const pauses: number[] = [];
            const executor = new PlaybackPlanExecutor(plan, gapStart - 1, {
                play: async () => {},
                paused: () => false,
                pause: ({ timestampMs }) => pauses.push(timestampMs),
                seek: async (timestampMs) => {
                    seeks.push(timestampMs);
                },
                setPlaybackRate: () => {},
                correctAutoPause: async () => ({ seekIssued: false }),
            });
            await executor.update(gapStart - 1, {});
            expect(seeks).toEqual([]);
            await executor.update(gapStart, {});
            expect(seeks).toEqual([gapEnd]);
            expect(pauses).toEqual([]);
        }
    );

    it('hides a whole subtitle when 80 percent of words do not match', () => {
        const playback = config();
        playback.wordVisibility.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        playback.wordVisibility.wholeSubtitleMatchThreshold = 0.8;
        const belowThreshold = subtitle('a b c d e', [
            token(0, 1, TokenStatus.MATURE),
            token(2, 3, TokenStatus.MATURE),
            token(4, 5, TokenStatus.MATURE),
            token(6, 7, TokenStatus.UNKNOWN),
            token(8, 9, TokenStatus.UNKNOWN),
        ]);
        const atThreshold = subtitle(
            'a b c d e',
            [
                token(0, 1, TokenStatus.MATURE),
                token(2, 3, TokenStatus.MATURE),
                token(4, 5, TokenStatus.MATURE),
                token(6, 7, TokenStatus.MATURE),
                token(8, 9, TokenStatus.UNKNOWN),
            ],
            { index: 1 }
        );
        const input = makePlaybackPlanInput([belowThreshold, atThreshold], {
            dictionaryTracks: tracksWith(playback),
        });
        expect(buildPlaybackPlan(input).timelineSubtitles.hiddenSubtitleIndexes).toEqual([1]);
    });

    it('skips adaptive whole-subtitle hiding when subtitles are shown only while paused', () => {
        const playback = config();
        playback.wordVisibility.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        const hidden = subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 0 });
        const input = makePlaybackPlanInput([hidden], { dictionaryTracks: tracksWith(playback) });
        expect(buildPlaybackPlan(input).timelineSubtitles.hiddenSubtitleIndexes).toEqual([0]);
        expect(
            buildPlaybackPlan({ ...input, subtitleVisibility: SubtitleVisibility.whilePaused }).timelineSubtitles
                .hiddenSubtitleIndexes
        ).toEqual([]);
    });

    it('does not skip a repeat action while jumping over an ineligible condensed subtitle', async () => {
        const playback = config();
        playback.condensed.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        playback.repeat.onStatuses[TokenStatus.MATURE].enabled = true;
        const repeated = subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 0 });
        const retained = subtitle('unknown', [token(0, 7, TokenStatus.UNKNOWN)], { index: 1, start: 4000 });
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([repeated, retained], {
                durationMs: 6000,
                playModes: new Set([PlayMode.condensed, PlayMode.repeat]),
                dictionaryTracks: tracksWith(playback),
            })
        );
        const seeks: number[] = [];
        const executor = new PlaybackPlanExecutor(plan, 0, {
            play: async () => {},
            paused: () => false,
            pause: () => {},
            seek: async (timestampMs) => {
                seeks.push(timestampMs);
            },
            setPlaybackRate: () => {},
            correctAutoPause: async () => ({ seekIssued: false }),
        });
        await executor.update(0, {});
        expect(seeks).toEqual([1999]);
    });

    it('fast-forwards through subtitles without selected words', () => {
        const playback = config();
        playback.fastForward.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        const normal = subtitle('unknown', [token(0, 7, TokenStatus.UNKNOWN)], { index: 0 });
        const accelerated = subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 1, start: 3000 });
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([normal, accelerated], {
                playModes: new Set([PlayMode.fastForward]),
                dictionaryTracks: tracksWith(playback),
            })
        );
        expect(plan.timelineSubtitles.blocks.map((block) => block.adaptiveRate?.playbackRate)).toEqual([1.25, 2.5]);
    });

    it.each([
        undefined,
        { tokens: [] },
        { tokens: [], error: true },
        { tokens: [token(0, 5, TokenStatus.MATURE, { groupingKey: 'known' })], error: true },
        { tokens: [token(0, 5, TokenStatus.MATURE)] },
        { tokens: [token(0, 5, TokenStatus.MATURE, { status: null, groupingKey: 'known' })] },
        { tokens: [token(0, 5, TokenStatus.MATURE, { status: undefined, groupingKey: 'known' })] },
        {
            tokens: [
                token(0, 1, TokenStatus.MATURE, { groupingKey: 'k' }),
                token(1, 2, TokenStatus.MATURE, { groupingKey: 'n' }),
                token(2, 5, TokenStatus.MATURE, { status: undefined, groupingKey: 'own' }),
            ],
        },
    ])('uses normal speed until comprehension annotations resolve: %j', (tokenization) => {
        const playback = config();
        playback.fastForward.rateByComprehension.enabled = true;
        const input = makePlaybackPlanInput([makeSubtitle({ text: 'known', tokenization })], {
            playModes: new Set([PlayMode.fastForward]),
            dictionaryTracks: tracksWith(playback),
        });
        const executor = new PlaybackPlanExecutor(buildPlaybackPlan(input), 1500, {
            play: async () => {},
            paused: () => false,
            pause: () => {},
            seek: async () => {},
            setPlaybackRate: () => {},
            correctAutoPause: async () => ({ seekIssued: false }),
        });
        executor.initializePlaybackRate(1500);
        expect(executor.playbackRate).toBe(1.25);

        executor.replacePlan(
            buildPlaybackPlan({
                ...input,
                subtitles: [subtitle('known', [token(0, 5, TokenStatus.MATURE, { groupingKey: 'known' })])],
            }),
            1500,
            {}
        );
        expect(executor.playbackRate).toBe(2.5);
    });

    it('interpolates the compiled rate between 60 and 100 percent comprehension', () => {
        const playback = config();
        playback.fastForward.rateByComprehension.enabled = true;
        const make = (known: number, { index, start }: { readonly index: number; readonly start: number }) =>
            subtitle(
                'a b c d e',
                Array.from({ length: 5 }, (_, i) =>
                    token(i * 2, i * 2 + 1, i < known ? TokenStatus.MATURE : TokenStatus.UNKNOWN, {
                        groupingKey: `word-${i}`,
                    })
                ),
                { index, start }
            );
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput(
                [
                    make(3, { index: 0, start: 1000 }),
                    make(4, { index: 1, start: 3000 }),
                    make(5, { index: 2, start: 5000 }),
                ],
                {
                    durationMs: 7000,
                    playModes: new Set([PlayMode.fastForward]),
                    dictionaryTracks: tracksWith(playback),
                }
            )
        );
        expect(plan.timelineSubtitles.blocks.map((block) => block.adaptiveRate?.playbackRate)).toEqual([
            1.25, 1.875, 2.5,
        ]);
        const rates: number[] = [];
        const executor = new PlaybackPlanExecutor(plan, 1500, {
            play: async () => {},
            paused: () => false,
            pause: () => {},
            seek: async () => {},
            setPlaybackRate: (rate) => {
                rates.push(rate);
            },
            correctAutoPause: async () => ({ seekIssued: false }),
        });
        executor.reconcileAt(3500, { forcePlaybackRate: false });
        executor.reconcileAt(5500, { forcePlaybackRate: false });
        expect(rates).toEqual([1.875, 2.5]);
    });
});

describe('per-track dictionary playback rules', () => {
    const onTrack = (value: IndexedSubtitleModel, track: number): IndexedSubtitleModel => ({ ...value, track });

    it('keeps normal auto-pause, repeat, and condensed behavior on playback tracks without rules', () => {
        const playback = config();
        playback.autoPause.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        playback.repeat.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        playback.condensed.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        const known = onTrack(subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 0 }), 0);
        const unruled = onTrack(subtitle('other', [token(0, 5, TokenStatus.MATURE)], { index: 1, start: 3000 }), 1);
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([known, unruled], {
                playModes: new Set([PlayMode.autoPause, PlayMode.repeat, PlayMode.condensed]),
                dictionaryTracks: tracksWith(playback),
            })
        );

        expect(plan.timelineSubtitles.blocks.every((block) => block.endAction === undefined)).toBe(true);
        expect(
            plan.timelineSubtitles.actionBlocks.map((block) => [block.id, block.subtitleIndexes, block.endAction])
        ).toEqual([
            ['autoPause:[1]', [1], { pause: true }],
            ['repeat:[1]', [1], { pause: false, repeat: { count: 0, repeatsBeforeShowingSubtitles: 0 } }],
        ]);
        expect(plan.timelineSubtitles.condensedBlocks?.map((block) => block.subtitleIndexes)).toEqual([[1]]);
    });

    it('applies normal fast-forward rules to tracks without rules, including in blocks shared with ruled tracks', () => {
        const playback = config();
        playback.fastForward.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        const known = onTrack(subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 0 }), 0);
        const unruled = onTrack(subtitle('other', [token(0, 5, TokenStatus.MATURE)], { index: 1, start: 2500 }), 1);
        const sharedKnown = onTrack(subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 2, start: 4000 }), 0);
        const sharedUnruled = onTrack(
            subtitle('other', [token(0, 5, TokenStatus.MATURE)], { index: 3, start: 4200 }),
            1
        );
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([known, unruled, sharedKnown, sharedUnruled], {
                durationMs: 8000,
                playModes: new Set([PlayMode.fastForward]),
                dictionaryTracks: tracksWith(playback),
            })
        );

        expect(
            plan.timelineSubtitles.blocks.map((block) => [
                block.subtitleIndexes,
                block.adaptiveRate?.playbackRate,
                block.adaptiveRate?.fraction,
            ])
        ).toEqual([
            [[0], 2.5, 1],
            [[1], undefined, undefined],
            [[2, 3], 1.25, 0],
        ]);
    });

    it('ignores rules on tracks excluded from playback', () => {
        const playback = config();
        playback.autoPause.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        const seekable = onTrack(subtitle('other', [token(0, 5, TokenStatus.MATURE)], { index: 1 }), 1);
        const excluded = onTrack(subtitle('known', [token(0, 5, TokenStatus.MATURE)], { index: 0 }), 0);
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([seekable], {
                displaySubtitles: [excluded, seekable],
                playModes: new Set([PlayMode.autoPause]),
                dictionaryTracks: tracksWith(playback),
            })
        );
        expect(plan.timelineSubtitles.actionBlocks).toEqual([]);
        expect(plan.timelineSubtitles.blocks[0].endAction).toEqual({ pause: true });
    });
});
