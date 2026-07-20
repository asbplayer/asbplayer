import { describe, expect, it } from '@jest/globals';
import { AutoPausePreference, type IndexedSubtitleModel, PlayMode } from '@project/common';
import {
    makeIndexedSubtitle as makeSubtitle,
    makePlaybackPlanInput,
} from '@project/common/playback/playback-engine-test-utils';
import { buildPlaybackPlan } from '@project/common/playback/playback-plan';
import PlaybackPlanExecutor, {
    type PlaybackPlanExecutorCallbacks,
} from '@project/common/playback/playback-plan-executor';

const makePlan = (
    modes: PlayMode[],
    overrides: Partial<Parameters<typeof buildPlaybackPlan<IndexedSubtitleModel>>[0]> = {}
) =>
    buildPlaybackPlan(
        makePlaybackPlanInput([makeSubtitle()], {
            playModes: new Set(modes),
            ...overrides,
        })
    );

function executorHarness(
    modes: PlayMode[],
    timestampMs: number,
    overrides = {},
    callbackOverrides: Partial<PlaybackPlanExecutorCallbacks<IndexedSubtitleModel>> = {}
) {
    const plan = makePlan(modes, overrides);
    const pauses: number[] = [];
    const seeks: number[] = [];
    const corrections: number[] = [];
    const rates: number[] = [];
    const showing: (readonly IndexedSubtitleModel[])[] = [];
    const condensedSeekCompletions: number[] = [];
    let paused = false;
    const executor = new PlaybackPlanExecutor(plan, timestampMs, {
        paused: () => paused,
        pause: () => {
            paused = true;
            pauses.push(pauses.length + 1);
        },
        seek: async (targetTimestampMs) => {
            seeks.push(targetTimestampMs);
        },
        setPlaybackRate: ({ playbackRate }) => rates.push(playbackRate),
        correctTimestamp: async (targetTimestampMs) => {
            corrections.push(targetTimestampMs);
        },
        showingSubtitlesChanged: (subtitles) => showing.push(subtitles),
        afterCondensedSeek: async () => {
            condensedSeekCompletions.push(condensedSeekCompletions.length + 1);
        },
        ...callbackOverrides,
    });
    return {
        executor,
        pauses,
        seeks,
        corrections,
        rates,
        showing,
        condensedSeekCompletions,
        pauseMedia: () => {
            paused = true;
        },
        resume: () => {
            paused = false;
        },
    };
}

interface PlaybackBehaviorCase {
    readonly name: string;
    readonly modes: PlayMode[];
    readonly autoPausePreference: AutoPausePreference;
    readonly corrections: number[];
    readonly seeks: number[];
    readonly fastForward: boolean;
}

const playbackBehaviorCases: PlaybackBehaviorCase[] = [
    {
        name: 'normal',
        modes: [PlayMode.normal],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [],
        seeks: [],
        fastForward: false,
    },
    {
        name: 'repeat',
        modes: [PlayMode.repeat],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [],
        seeks: [1000],
        fastForward: false,
    },
    {
        name: 'condensed',
        modes: [PlayMode.condensed],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [],
        seeks: [3999],
        fastForward: false,
    },
    {
        name: 'condensed + repeat',
        modes: [PlayMode.condensed, PlayMode.repeat],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [],
        seeks: [1000],
        fastForward: false,
    },
    {
        name: 'fast-forward',
        modes: [PlayMode.fastForward],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [],
        seeks: [],
        fastForward: true,
    },
    {
        name: 'fast-forward + repeat',
        modes: [PlayMode.fastForward, PlayMode.repeat],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [],
        seeks: [1000],
        fastForward: true,
    },
    {
        name: 'auto-pause at start',
        modes: [PlayMode.autoPause],
        autoPausePreference: AutoPausePreference.atStart,
        corrections: [1000],
        seeks: [],
        fastForward: false,
    },
    {
        name: 'auto-pause at end',
        modes: [PlayMode.autoPause],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [1999],
        seeks: [],
        fastForward: false,
    },
    {
        name: 'auto-pause at start + repeat',
        modes: [PlayMode.autoPause, PlayMode.repeat],
        autoPausePreference: AutoPausePreference.atStart,
        corrections: [1000],
        seeks: [1000],
        fastForward: false,
    },
    {
        name: 'auto-pause at end + repeat',
        modes: [PlayMode.autoPause, PlayMode.repeat],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [1999],
        seeks: [1000],
        fastForward: false,
    },
    {
        name: 'condensed + auto-pause at start',
        modes: [PlayMode.condensed, PlayMode.autoPause],
        autoPausePreference: AutoPausePreference.atStart,
        corrections: [1000],
        seeks: [3999],
        fastForward: false,
    },
    {
        name: 'condensed + auto-pause at end',
        modes: [PlayMode.condensed, PlayMode.autoPause],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [1999],
        seeks: [3999],
        fastForward: false,
    },
    {
        name: 'condensed + auto-pause at start + repeat',
        modes: [PlayMode.condensed, PlayMode.autoPause, PlayMode.repeat],
        autoPausePreference: AutoPausePreference.atStart,
        corrections: [1000],
        seeks: [1000],
        fastForward: false,
    },
    {
        name: 'condensed + auto-pause at end + repeat',
        modes: [PlayMode.condensed, PlayMode.autoPause, PlayMode.repeat],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [1999],
        seeks: [1000],
        fastForward: false,
    },
    {
        name: 'fast-forward + auto-pause at start',
        modes: [PlayMode.fastForward, PlayMode.autoPause],
        autoPausePreference: AutoPausePreference.atStart,
        corrections: [1000],
        seeks: [],
        fastForward: true,
    },
    {
        name: 'fast-forward + auto-pause at end',
        modes: [PlayMode.fastForward, PlayMode.autoPause],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [1999],
        seeks: [],
        fastForward: true,
    },
    {
        name: 'fast-forward + auto-pause at start + repeat',
        modes: [PlayMode.fastForward, PlayMode.autoPause, PlayMode.repeat],
        autoPausePreference: AutoPausePreference.atStart,
        corrections: [1000],
        seeks: [1000],
        fastForward: true,
    },
    {
        name: 'fast-forward + auto-pause at end + repeat',
        modes: [PlayMode.fastForward, PlayMode.autoPause, PlayMode.repeat],
        autoPausePreference: AutoPausePreference.atEnd,
        corrections: [1999],
        seeks: [1000],
        fastForward: true,
    },
];

describe('PlaybackPlanExecutor', () => {
    it.each(playbackBehaviorCases)(
        'applies $name behavior at subtitle and gap boundaries',
        async ({ modes, autoPausePreference, corrections, seeks, fastForward }) => {
            const subtitles = [
                makeSubtitle(),
                makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 }),
            ];
            const edgeHarness = executorHarness(modes, 0, {
                subtitles,
                autoPausePreference,
                condensedPlaybackMinimumSkipIntervalMs: 1000,
            });

            await edgeHarness.executor.update(1100);
            edgeHarness.resume();
            await edgeHarness.executor.update(2100);
            edgeHarness.resume();
            await edgeHarness.executor.playbackStarted();

            expect(edgeHarness.pauses).toHaveLength(corrections.length);
            expect(edgeHarness.corrections).toEqual(corrections);
            expect(edgeHarness.seeks).toEqual(seeks);

            const gapRateHarness = executorHarness(modes, 3000, { subtitles, autoPausePreference });
            const subtitleRateHarness = executorHarness(modes, 1500, { subtitles, autoPausePreference });

            expect(gapRateHarness.rates).toEqual(fastForward ? [2.5] : []);
            expect(subtitleRateHarness.rates).toEqual(fastForward ? [1.25] : []);
        }
    );

    it('pauses and corrects to each crossed auto-pause edge in chronological order', async () => {
        const harness = executorHarness([PlayMode.autoPause], 0, {
            autoPausePreference: AutoPausePreference.atStartAndEnd,
        });

        await harness.executor.update(2500);
        harness.resume();
        await harness.executor.update(2500);

        expect(harness.pauses).toHaveLength(2);
        expect(harness.corrections).toEqual([1000, 1999]);
    });

    it('keeps the ending subtitle visible when auto-pausing with a zero end offset', async () => {
        const subtitle = makeSubtitle();
        const harness = executorHarness([PlayMode.autoPause], 1500, {
            subtitles: [subtitle],
            displaySubtitles: [subtitle],
            autoPausePreference: AutoPausePreference.atEnd,
            playbackModeEndOffset: 0,
        });

        await harness.executor.update(2000);

        expect(harness.pauses).toHaveLength(1);
        expect(harness.corrections).toEqual([1999]);
        expect(harness.showing.at(-1)).toEqual([subtitle]);
    });

    it('executes an auto-pause action when the next frame is predicted to cross it', async () => {
        const harness = executorHarness([PlayMode.autoPause, PlayMode.repeat], 1500, {
            repeatCountPreference: 1,
        });

        const update = harness.executor.update(1980, 2000);

        expect(harness.pauses).toHaveLength(1);
        await update;
        expect(harness.corrections).toEqual([1999]);
        expect(harness.seeks).toEqual([]);
    });

    it('stops showing overlapping subtitles independently at their different end timestamps', async () => {
        const longer = makeSubtitle({ end: 3000, originalEnd: 3000 });
        const shorter = makeSubtitle({ text: 'shorter', index: 1 });
        const harness = executorHarness([PlayMode.normal], 0, {
            subtitles: [longer, shorter],
            displaySubtitles: [longer, shorter],
        });

        await harness.executor.update(1000);
        await harness.executor.update(2000);
        await harness.executor.update(3000);

        expect(harness.showing).toEqual([[longer, shorter], [longer], []]);
    });

    it.each([
        { name: 'immediately', modes: [PlayMode.repeat], queued: false },
        { name: 'after end auto-pause resumes', modes: [PlayMode.autoPause, PlayMode.repeat], queued: true },
    ])('repeats $name without exposing an empty frame', async ({ modes, queued }) => {
        const subtitle = makeSubtitle();
        const harness = executorHarness(modes, 1500, {
            subtitles: [subtitle],
            displaySubtitles: [subtitle],
            autoPausePreference: AutoPausePreference.atEnd,
            repeatCountPreference: 1,
            playbackModeEndOffset: 0,
        });

        await harness.executor.update(1999);

        expect(harness.seeks).toEqual(queued ? [] : [1000]);
        expect(harness.showing.at(-1)).toEqual([subtitle]);

        if (queued) {
            harness.resume();
            await harness.executor.playbackStarted();
            expect(harness.seeks).toEqual([1000]);
            expect(harness.showing.at(-1)).toEqual([subtitle]);
        }
    });

    it('starts fast-forward on the first millisecond without a visible subtitle', async () => {
        const subtitle = makeSubtitle();
        const harness = executorHarness([PlayMode.fastForward], 1500, {
            subtitles: [subtitle],
            displaySubtitles: [subtitle],
            fastForwardPlaybackMinimumSkipIntervalMs: 0,
            playbackModeEndOffset: 400,
        });

        await harness.executor.update(1999);
        expect(harness.rates).toEqual([1.25]);
        expect(harness.showing.at(-1)).toEqual([subtitle]);

        await harness.executor.update(2000);
        expect(harness.rates).toEqual([1.25, 2.5]);
        expect(harness.showing.at(-1)).toEqual([]);
    });

    it('starts condensed playback on the first millisecond without a visible subtitle', async () => {
        const first = makeSubtitle();
        const second = makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 });
        const harness = executorHarness([PlayMode.condensed], 1500, {
            subtitles: [first, second],
            displaySubtitles: [first, second],
            condensedPlaybackMinimumSkipIntervalMs: 1000,
            playbackModeStartOffset: -250,
            playbackModeEndOffset: 400,
        });

        await harness.executor.update(1999);
        expect(harness.seeks).toEqual([]);
        expect(harness.showing.at(-1)).toEqual([first]);

        await harness.executor.update(2000);
        expect(harness.seeks).toEqual([3999]);
        expect(harness.showing.at(-1)).toEqual([]);
    });

    it('executes a bounded repeat immediately when the end action does not pause', async () => {
        const harness = executorHarness([PlayMode.repeat], 0, {
            repeatCountPreference: 1,
            playbackModeStartOffset: -200,
            playbackModeEndOffset: 300,
        });

        await harness.executor.update(2298);
        expect(harness.seeks).toEqual([]);
        await harness.executor.update(2299);
        harness.executor.reset(800, true, 'internal-seek');
        await harness.executor.update(2299);

        expect(harness.seeks).toEqual([800]);
    });

    it('continues with condensed playback after a bounded repeat completes', async () => {
        const first = makeSubtitle();
        const second = makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 });
        const harness = executorHarness([PlayMode.condensed, PlayMode.repeat], 1500, {
            subtitles: [first, second],
            displaySubtitles: [first, second],
            repeatCountPreference: 1,
            condensedPlaybackMinimumSkipIntervalMs: 1000,
        });

        await harness.executor.update(2000);
        expect(harness.seeks).toEqual([1000]);

        harness.executor.reset(1000, true, 'internal-seek');
        await harness.executor.update(2000);

        expect(harness.seeks).toEqual([1000, 3999]);
    });

    it('auto-pauses at the start after an immediate repeat that did not pause at the end', async () => {
        const harness = executorHarness([PlayMode.autoPause, PlayMode.repeat], 1500, {
            autoPausePreference: AutoPausePreference.atStart,
            repeatCountPreference: 1,
        });

        await harness.executor.update(2100);
        const discontinuity = harness.executor.consumeDiscontinuity(1000);
        harness.executor.reset(1000, discontinuity.includeAtTimestamp, discontinuity.cause);
        await harness.executor.update(1000);

        expect(harness.seeks).toEqual([1000]);
        expect(harness.pauses).toHaveLength(1);
        expect(harness.corrections).toEqual([1000]);
    });

    it('treats a repeat count of zero as unlimited', async () => {
        const harness = executorHarness([PlayMode.repeat], 0, { repeatCountPreference: 0 });

        for (let repeat = 0; repeat < 3; repeat++) {
            await harness.executor.update(2100);
            harness.executor.reset(1000, true, 'internal-seek');
        }

        expect(harness.seeks).toEqual([1000, 1000, 1000]);
    });

    it('starts a fresh bounded repeat count for each subtitle', async () => {
        const second = makeSubtitle({ start: 3000, end: 4000, originalStart: 3000, originalEnd: 4000, index: 1 });
        const harness = executorHarness([PlayMode.repeat], 0, {
            subtitles: [makeSubtitle(), second],
            repeatCountPreference: 1,
        });

        await harness.executor.update(2100);
        harness.executor.reset(1000, true, 'internal-seek');
        await harness.executor.update(2100);
        await harness.executor.update(4100);

        expect(harness.seeks).toEqual([1000, 3000]);
    });

    it('starts a fresh bounded repeat after repeat mode is disabled and re-enabled', async () => {
        const harness = executorHarness([PlayMode.repeat], 0, { repeatCountPreference: 1 });

        await harness.executor.update(2100);
        harness.executor.reset(1000, true, 'internal-seek');
        await harness.executor.update(2100);
        harness.executor.replacePlan(makePlan([PlayMode.normal]), 1500);
        harness.executor.replacePlan(makePlan([PlayMode.repeat], { repeatCountPreference: 1 }), 1500);
        await harness.executor.update(2100);

        expect(harness.seeks).toEqual([1000, 1000]);
    });

    it('preserves an exhausted repeat count across an equivalent replacement plan', async () => {
        const harness = executorHarness([PlayMode.repeat], 0, { repeatCountPreference: 1 });

        await harness.executor.update(2100);
        harness.executor.reset(1000, true, 'internal-seek');
        await harness.executor.update(2100);
        harness.executor.replacePlan(
            makePlan([PlayMode.repeat], { repeatCountPreference: 1, playbackRate: 1.5 }),
            1500
        );
        await harness.executor.update(2100);

        expect(harness.seeks).toEqual([1000]);
    });

    it('defers repeat until resume and suppresses the duplicate start pause', async () => {
        const harness = executorHarness([PlayMode.autoPause, PlayMode.repeat], 1500, {
            autoPausePreference: AutoPausePreference.atStartAndEnd,
        });

        await harness.executor.update(2100);
        expect(harness.seeks).toEqual([]);

        harness.resume();
        await harness.executor.playbackStarted();
        harness.executor.reset(1000, true, 'internal-seek');
        await harness.executor.update(1000);

        expect(harness.seeks).toEqual([1000]);
        expect(harness.pauses).toHaveLength(1);
    });

    it('does not suppress the repeated start pause when the showing subtitles change', async () => {
        const earlier = makeSubtitle({ end: 3000, originalEnd: 3000 });
        const later = makeSubtitle({ start: 2000, end: 4000, originalStart: 2000, originalEnd: 4000, index: 1 });
        const harness = executorHarness([PlayMode.autoPause, PlayMode.repeat], 2500, {
            subtitles: [earlier, later],
            displaySubtitles: [earlier, later],
            autoPausePreference: AutoPausePreference.atStartAndEnd,
            repeatCountPreference: 1,
        });

        await harness.executor.update(4100);
        harness.resume();
        await harness.executor.playbackStarted();
        harness.executor.reset(1000, true, 'internal-seek');
        await harness.executor.update(1000);

        expect(harness.showing).toEqual([[earlier, later], [later], [earlier]]);
        expect(harness.pauses).toHaveLength(2);
        expect(harness.corrections).toEqual([3999, 1000]);
    });

    it('preserves pending repeat start-pause suppression across an equivalent replacement plan', async () => {
        const planOverrides = {
            autoPausePreference: AutoPausePreference.atStartAndEnd,
            repeatCountPreference: 1,
        };
        const harness = executorHarness([PlayMode.autoPause, PlayMode.repeat], 1500, planOverrides);

        await harness.executor.update(2100);
        harness.resume();
        await harness.executor.playbackStarted();
        harness.executor.replacePlan(
            makePlan([PlayMode.autoPause, PlayMode.repeat], { ...planOverrides, playbackRate: 1.5 }),
            900
        );
        await harness.executor.update(1000);

        expect(harness.pauses).toHaveLength(1);
        expect(harness.seeks).toEqual([1000]);
    });

    it('does not preserve repeat start-pause suppression after end auto-pause is disabled', async () => {
        const harness = executorHarness([PlayMode.autoPause, PlayMode.repeat], 1500, {
            autoPausePreference: AutoPausePreference.atStartAndEnd,
            repeatCountPreference: 1,
        });

        await harness.executor.update(2100);
        harness.resume();
        await harness.executor.playbackStarted();
        harness.executor.replacePlan(
            makePlan([PlayMode.autoPause, PlayMode.repeat], {
                autoPausePreference: AutoPausePreference.atStart,
                repeatCountPreference: 1,
            }),
            900
        );
        await harness.executor.update(1000);

        expect(harness.pauses).toHaveLength(2);
        expect(harness.corrections).toEqual([1999, 1000]);
    });

    it('does not install start-pause suppression when a queued repeat did not request it', async () => {
        const harness = executorHarness([PlayMode.autoPause, PlayMode.repeat], 1500, {
            autoPausePreference: AutoPausePreference.atEnd,
            repeatCountPreference: 1,
        });

        await harness.executor.update(2100);
        harness.resume();
        await harness.executor.playbackStarted();
        harness.executor.replacePlan(
            makePlan([PlayMode.autoPause], { autoPausePreference: AutoPausePreference.atStart }),
            900
        );
        harness.resume();
        await harness.executor.update(1000);

        expect(harness.pauses).toHaveLength(2);
        expect(harness.corrections).toEqual([1999, 1000]);
    });

    it('clears a queued repeat when repeat mode is disabled before resume', async () => {
        const harness = executorHarness([PlayMode.autoPause, PlayMode.repeat], 1500, {
            repeatCountPreference: 1,
        });

        await harness.executor.update(2100);
        harness.executor.replacePlan(makePlan([PlayMode.autoPause]), 2100);
        harness.resume();
        await harness.executor.playbackStarted();

        expect(harness.pauses).toHaveLength(1);
        expect(harness.seeks).toEqual([]);
    });

    it('clears repeat start-pause suppression when a resumed repeat seek fails', async () => {
        const harness = executorHarness(
            [PlayMode.autoPause, PlayMode.repeat],
            1500,
            {
                autoPausePreference: AutoPausePreference.atStartAndEnd,
                repeatCountPreference: 1,
            },
            {
                seek: () => {
                    throw new Error('seek failed');
                },
            }
        );

        await harness.executor.update(2100);
        harness.resume();
        await expect(harness.executor.playbackStarted()).rejects.toThrow('seek failed');
        expect(harness.executor.consumeDiscontinuity(1000)).toEqual({
            cause: 'user-seek',
            includeAtTimestamp: false,
        });
        harness.executor.reset(1000, true, 'internal-seek');
        harness.resume();
        await harness.executor.update(1000);

        expect(harness.pauses).toHaveLength(2);
        expect(harness.corrections).toEqual([1999, 1000]);
    });

    it('resets a bounded repeat after a user seek and auto-pauses at the next end', async () => {
        const harness = executorHarness([PlayMode.autoPause, PlayMode.repeat], 0, {
            repeatCountPreference: 1,
        });

        await harness.executor.update(2100);
        harness.resume();
        await harness.executor.playbackStarted();
        harness.executor.reset(1000, true, 'internal-seek');
        await harness.executor.update(2100);

        harness.executor.reset(1500, true, 'user-seek');
        harness.resume();
        await harness.executor.update(2100);
        harness.resume();
        await harness.executor.playbackStarted();

        expect(harness.pauses).toHaveLength(3);
        expect(harness.seeks).toEqual([1000, 1000]);
    });

    it('seeks across a qualifying condensed gap and fast-forwards for an entire qualifying gap', async () => {
        const subtitles = [
            makeSubtitle(),
            makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 }),
        ];
        const condensed = executorHarness([PlayMode.condensed], 2100, { subtitles });
        const fastForward = executorHarness([PlayMode.fastForward], 2100, { subtitles });

        await condensed.executor.update(2100);
        await fastForward.executor.update(3000);
        fastForward.executor.reset(4500);
        await fastForward.executor.update(4500);

        expect(condensed.seeks).toEqual([3999]);
        expect(condensed.condensedSeekCompletions).toHaveLength(1);
        expect(fastForward.rates).toEqual([2.5, 1.25]);
    });

    it('condenses a leading gap at the exact minimum, but not just below it or while paused', async () => {
        const overrides = {
            subtitles: [makeSubtitle()],
            durationMs: 3000,
            condensedPlaybackMinimumSkipIntervalMs: 1000,
        };
        const exact = executorHarness([PlayMode.condensed], 0, overrides);
        const below = executorHarness([PlayMode.condensed], 0.5, overrides);
        const paused = executorHarness([PlayMode.condensed], 0, overrides);
        paused.pauseMedia();

        await exact.executor.update(0);
        await below.executor.update(0.5);
        await paused.executor.update(0);

        expect(exact.seeks).toEqual([999]);
        expect(below.seeks).toEqual([]);
        expect(paused.seeks).toEqual([]);
    });

    it('does not replay a paused condensed boundary when playback resumes', async () => {
        const second = makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 });
        const harness = executorHarness([PlayMode.condensed], 1500, {
            subtitles: [makeSubtitle(), second],
        });

        harness.pauseMedia();
        await harness.executor.update(2000);
        harness.resume();
        await harness.executor.playbackStarted();
        await harness.executor.update(2100);

        expect(harness.seeks).toEqual([]);
    });

    it('queues a condensed target at auto-pause and seeks there once playback resumes', async () => {
        const second = makeSubtitle({ start: 3000, end: 4000, originalStart: 3000, originalEnd: 4000, index: 1 });
        const harness = executorHarness([PlayMode.autoPause, PlayMode.condensed], 1500, {
            subtitles: [makeSubtitle(), second],
            condensedPlaybackMinimumSkipIntervalMs: 1000,
        });

        await harness.executor.update(2100);
        expect(harness.seeks).toEqual([]);
        harness.resume();
        await harness.executor.playbackStarted();
        await harness.executor.playbackStarted();

        expect(harness.pauses).toHaveLength(1);
        expect(harness.seeks).toEqual([2999]);
    });

    it('does not queue a condensed target when auto-paused before a subminimum gap', async () => {
        const second = makeSubtitle({ start: 2998, end: 4000, originalStart: 2998, originalEnd: 4000, index: 1 });
        const harness = executorHarness([PlayMode.autoPause, PlayMode.condensed], 1500, {
            subtitles: [makeSubtitle(), second],
            condensedPlaybackMinimumSkipIntervalMs: 1000,
        });

        await harness.executor.update(2100);
        harness.resume();
        await harness.executor.playbackStarted();

        expect(harness.pauses).toHaveLength(1);
        expect(harness.seeks).toEqual([]);
    });

    it('clears a queued repeat when a user seek supersedes the paused boundary', async () => {
        const harness = executorHarness([PlayMode.autoPause, PlayMode.repeat], 1500, {
            repeatCountPreference: 1,
        });

        await harness.executor.update(2100);
        harness.executor.reset(3000, true, 'user-seek');
        harness.resume();
        await harness.executor.playbackStarted();

        expect(harness.pauses).toHaveLength(1);
        expect(harness.seeks).toEqual([]);
    });

    it('does not start another condensed seek while the active transition is finishing', async () => {
        const subtitles = [
            makeSubtitle(),
            makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 }),
            makeSubtitle({ start: 7000, end: 8000, originalStart: 7000, originalEnd: 8000, index: 2 }),
        ];
        let finishTransition!: () => void;
        let transitionStarted!: () => void;
        const transition = new Promise<void>((resolve) => (finishTransition = resolve));
        const started = new Promise<void>((resolve) => (transitionStarted = resolve));
        const harness = executorHarness(
            [PlayMode.condensed],
            2.1,
            { subtitles, durationMs: 9000 },
            {
                afterCondensedSeek: () => {
                    transitionStarted();
                    return transition;
                },
            }
        );

        const firstUpdate = harness.executor.update(2100);
        await started;
        const concurrentUpdate = harness.executor.update(5100);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(harness.seeks).toEqual([3999]);

        finishTransition();
        await Promise.all([firstUpdate, concurrentUpdate]);
    });

    it('uses configurable gap edges instead of playback mode offsets for condensed playback', async () => {
        const subtitles = [
            makeSubtitle(),
            makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 }),
        ];
        const harness = executorHarness([PlayMode.condensed], 2100, {
            subtitles,
            playbackModeStartOffset: -250,
            playbackModeEndOffset: 400,
            playbackModesStartGap: -250,
            playbackModesEndGap: 400,
        });

        await harness.executor.update(2399);
        expect(harness.seeks).toEqual([]);
        await harness.executor.update(2400);

        expect(harness.seeks).toEqual([3749]);
    });

    it('reconciles visible subtitles on a user seek without firing crossed playback actions', async () => {
        const first = makeSubtitle();
        const second = makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 });
        const harness = executorHarness([PlayMode.autoPause], 0, {
            subtitles: [first, second],
            displaySubtitles: [first, second],
            autoPausePreference: AutoPausePreference.atStartAndEnd,
        });

        harness.executor.reset(4000, true, 'user-seek');
        await harness.executor.update(4100);

        expect(harness.showing.at(-1)).toEqual([second]);
        expect(harness.pauses).toEqual([]);
        expect(harness.corrections).toEqual([]);
    });

    it('does not report a visibility change when an equivalent plan retains the same subtitle indexes', () => {
        const harness = executorHarness([PlayMode.normal], 1500);
        const initiallyShowing = harness.showing[0];

        harness.executor.replacePlan(makePlan([PlayMode.normal], { playbackRate: 1.5 }), 1500);

        expect(harness.showing).toEqual([initiallyShowing]);
    });

    it('reports a changed subtitle when its index is retained by a replacement plan', () => {
        const oldSubtitle = makeSubtitle({ text: 'old text', index: 12 });
        const newSubtitle = makeSubtitle({ text: 'new text', index: 12 });
        const harness = executorHarness([PlayMode.normal], 1500, {
            subtitles: [oldSubtitle],
            displaySubtitles: [oldSubtitle],
        });

        harness.executor.replacePlan(
            makePlan([PlayMode.normal], { subtitles: [newSubtitle], displaySubtitles: [newSubtitle] }),
            1500
        );

        expect(harness.showing.at(-1)).toEqual([newSubtitle]);
    });

    it('applies the fast-forward rate immediately after a user seek into a qualifying gap', () => {
        const second = makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 });
        const harness = executorHarness([PlayMode.fastForward], 1500, {
            subtitles: [makeSubtitle(), second],
        });

        harness.executor.reset(3000, true, 'user-seek');

        expect(harness.rates).toEqual([1.25, 2.5]);
        expect(harness.seeks).toEqual([]);
    });

    it('reports false while the normal playback rate is active', () => {
        const harness = executorHarness([PlayMode.fastForward], 1500);

        expect(harness.executor.fastForwardingAt(1500)).toBe(false);
    });

    it('does not reapply an unchanged fast-forward rate while reconciling a seek', () => {
        const second = makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 });
        const harness = executorHarness([PlayMode.fastForward], 3000, {
            subtitles: [makeSubtitle(), second],
        });

        harness.executor.reset(3100, true, 'user-seek');

        expect(harness.rates).toEqual([2.5]);
    });

    it('restores the normal rate when fast-forward is removed from a replacement plan', () => {
        const second = makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 });
        const planOverrides = { subtitles: [makeSubtitle(), second] };
        const harness = executorHarness([PlayMode.fastForward], 3000, planOverrides);

        harness.executor.replacePlan(makePlan([PlayMode.normal], planOverrides), 3000);

        expect(harness.rates).toEqual([2.5, 1.25]);
    });

    it('applies condensed playback after enabling it inside a qualifying gap', async () => {
        const second = makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 });
        const planOverrides = { subtitles: [makeSubtitle(), second] };
        const harness = executorHarness([PlayMode.normal], 2100, planOverrides);

        harness.executor.replacePlan(makePlan([PlayMode.condensed], planOverrides), 2100);
        await harness.executor.update(2100);

        expect(harness.seeks).toEqual([3999]);
    });

    it('does not resume after a condensed seek is cancelled', async () => {
        let resolveSeek!: () => void;
        const seekFinished = new Promise<void>((resolve) => {
            resolveSeek = resolve;
        });
        const harness = executorHarness(
            [PlayMode.condensed],
            1500,
            {
                subtitles: [
                    makeSubtitle(),
                    makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 }),
                ],
            },
            {
                seek: async () => seekFinished,
            }
        );

        const update = harness.executor.update(2000);
        harness.executor.cancelPendingOperations();
        resolveSeek();
        await update;

        expect(harness.condensedSeekCompletions).toEqual([]);
    });

    it('does not condense the gap selected by a user seek after playback resumes', async () => {
        const subtitles = [
            makeSubtitle(),
            makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 }),
            makeSubtitle({ start: 7000, end: 8000, originalStart: 7000, originalEnd: 8000, index: 2 }),
        ];
        const harness = executorHarness([PlayMode.condensed], 1500, { subtitles, durationMs: 9000 });

        harness.pauseMedia();
        harness.executor.reset(2500, true, 'user-seek');
        harness.resume();
        await harness.executor.playbackStarted();
        await harness.executor.update(2600);

        expect(harness.seeks).toEqual([]);

        await harness.executor.update(4100);
        await harness.executor.update(5100);

        expect(harness.seeks).toEqual([6999]);
    });

    it('shifts pending visibility and playback boundaries in place on an offset change', async () => {
        const subtitle = makeSubtitle();
        const harness = executorHarness([PlayMode.autoPause], 500, {
            subtitles: [subtitle],
            displaySubtitles: [subtitle],
            autoPausePreference: AutoPausePreference.atStart,
        });

        harness.executor.shiftTimeline(1000, 500);

        await harness.executor.update(1500);
        expect(harness.pauses).toEqual([]);

        await harness.executor.update(2100);
        expect(harness.pauses).toHaveLength(1);
        expect(harness.corrections).toEqual([2000]);
        expect(harness.showing.at(-1)).toEqual([subtitle]);
    });
});
