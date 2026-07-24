import { describe, expect, it } from '@jest/globals';
import { AutoPausePreference, PlayMode, type SubtitleModel } from '@project/common';
import { makePlaybackPlanInput, makeSubtitle } from '@project/common/playback/playback-engine-test-utils';
import { buildPlaybackPlan, fastForwardingForPlanState } from '@project/common/playback/playback-plan';
import PlaybackTimeline from '@project/common/playback/playback-timeline';

const makePlan = (modes: PlayMode[], overrides: Partial<Parameters<typeof buildPlaybackPlan<SubtitleModel>>[0]> = {}) =>
    buildPlaybackPlan(
        makePlaybackPlanInput([makeSubtitle(1000, 2000, 0)], {
            durationMs: 5000,
            playModes: new Set(modes),
            ...overrides,
        })
    );

describe('buildPlaybackPlan', () => {
    it('produces an inactive plan for zero eligible subtitles and normal playback', () => {
        const plan = makePlan([PlayMode.normal], { subtitles: [] });

        expect(plan.timeline.blocks).toEqual([]);
        expect(plan.timeline.displaySubtitles).toEqual([]);
    });

    it('keeps normal playback inert when eligible subtitles are present', () => {
        const plan = makePlan([PlayMode.normal]);

        expect(plan.timeline.blocks[0].startAction).toBeUndefined();
        expect(plan.timeline.blocks[0].endAction).toBeUndefined();
        expect(plan.condensed).toBeUndefined();
        expect(plan.fastForward).toBeUndefined();
    });

    it('keeps display-only subtitles active without creating playback blocks', () => {
        const displaySubtitle = makeSubtitle({ track: 1 });
        const plan = makePlan([PlayMode.normal], { subtitles: [], displaySubtitles: [displaySubtitle] });

        expect(plan.timeline.blocks).toEqual([]);
        expect(plan.timeline.displaySubtitles).toEqual([displaySubtitle]);
    });

    it.each([
        { name: 'start action', preference: AutoPausePreference.atStart },
        { name: 'end action', preference: AutoPausePreference.atEnd },
    ])('encodes an auto-pause $name action even without displayed subtitles', ({ preference }) => {
        const plan = makePlan([PlayMode.autoPause], {
            displaySubtitles: [],
            autoPausePreference: preference,
        });

        expect(plan.timeline.blocks[0].startAction ?? plan.timeline.blocks[0].endAction).toBeDefined();
    });

    it.each([
        { name: 'condensed', mode: PlayMode.condensed },
        { name: 'fast-forward', mode: PlayMode.fastForward },
    ])('encodes subtitle-free $name playback', ({ mode }) => {
        const plan = makePlan([mode], { subtitles: [] });

        expect(mode === PlayMode.condensed ? plan.condensed : plan.fastForward).toBeDefined();
    });

    it('swaps crossed playback mode offset roles for auto-pause and repeat', () => {
        const plan = makePlan([PlayMode.autoPause, PlayMode.repeat], {
            autoPausePreference: AutoPausePreference.atStartAndEnd,
            subtitleTriggerStartOffset: 800,
            subtitleTriggerEndOffset: -800,
            repeatCountPreference: 2,
        });

        expect(plan.timeline.blocks[0]).toEqual(
            expect.objectContaining({
                playbackModeStartMs: 1199,
                playbackModeEndMs: 1800,
                playbackModeEndExclusiveMs: 1801,
                startAction: true,
                endAction: {
                    pause: true,
                    repeat: {
                        count: 2,
                    },
                },
            })
        );
    });

    it.each([
        {
            name: 'start only',
            preference: AutoPausePreference.atStart,
            expectedStartAction: true,
            expectedPauseAtEnd: false,
        },
        {
            name: 'end only',
            preference: AutoPausePreference.atEnd,
            expectedStartAction: undefined,
            expectedPauseAtEnd: true,
        },
        {
            name: 'both edges',
            preference: AutoPausePreference.atStartAndEnd,
            expectedStartAction: true,
            expectedPauseAtEnd: true,
        },
    ])(
        'combines repeat with $name auto-pause without suppressing an unrelated start pause',
        ({ preference, expectedStartAction, expectedPauseAtEnd }) => {
            const plan = makePlan([PlayMode.autoPause, PlayMode.repeat], {
                autoPausePreference: preference,
                repeatCountPreference: 1,
            });

            expect(plan.timeline.blocks[0].startAction).toEqual(expectedStartAction);
            expect(plan.timeline.blocks[0].endAction).toEqual({
                pause: expectedPauseAtEnd,
                repeat: {
                    count: 1,
                },
            });
        }
    );

    it('uses playback mode offsets for repeat triggers without auto-pause', () => {
        const plan = makePlan([PlayMode.repeat], {
            subtitleTriggerStartOffset: -200,
            subtitleTriggerEndOffset: 300,
            repeatCountPreference: 1,
        });

        expect(plan.timeline.blocks[0]).toEqual(
            expect.objectContaining({
                playbackModeStartMs: 800,
                playbackModeEndMs: 2299,
                playbackModeEndExclusiveMs: 2300,
                endAction: {
                    pause: false,
                    repeat: {
                        count: 1,
                    },
                },
            })
        );
    });

    it('encodes repeat as an end action while retaining condensed seeking', () => {
        const plan = makePlan([PlayMode.autoPause, PlayMode.repeat, PlayMode.condensed], {
            autoPausePreference: AutoPausePreference.atStartAndEnd,
            repeatCountPreference: 2.9,
        });

        expect(plan.condensed).toEqual({ minimumSkipIntervalMs: 500, pauseAtStart: true });
        expect(plan.timeline.blocks[0].endAction).toEqual({
            pause: true,
            repeat: {
                count: 2,
            },
        });
    });

    it('normalizes a negative repeat count to unlimited playback', () => {
        const plan = makePlan([PlayMode.repeat], { repeatCountPreference: -1 });

        expect(plan.timeline.blocks[0].endAction?.repeat?.count).toBe(0);
    });

    it('uses the configured playback rate inside subtitles and throughout qualifying gaps', () => {
        const plan = makePlan([PlayMode.fastForward], {
            subtitles: [
                makeSubtitle(),
                makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 }),
            ],
            durationMs: 6000,
            fastForwardPlaybackMinimumSkipIntervalMs: 1000,
        });
        const timeline = PlaybackTimeline.fromSnapshot(plan.timeline);
        const rateAt = (timestampMs: number) =>
            fastForwardingForPlanState(plan, timeline.lookupAt(timestampMs).state)
                ? plan.fastForward!.playbackRate
                : plan.playbackRate;

        expect(rateAt(2000)).toBe(2.5);
        expect(rateAt(3500)).toBe(2.5);
        expect(rateAt(3998)).toBe(2.5);
        expect(rateAt(3999)).toBe(1.25);
        expect(rateAt(4500)).toBe(1.25);
        expect(rateAt(5000)).toBe(2.5);
    });

    it('keeps an entire subminimum subtitle gap at the normal rate', () => {
        const plan = makePlan([PlayMode.fastForward], {
            subtitles: [
                makeSubtitle(),
                makeSubtitle({ start: 2750, end: 3750, originalStart: 2750, originalEnd: 3750, index: 1 }),
            ],
            fastForwardPlaybackMinimumSkipIntervalMs: 1000,
        });
        const timeline = PlaybackTimeline.fromSnapshot(plan.timeline);
        const rateAt = (timestampMs: number) =>
            fastForwardingForPlanState(plan, timeline.lookupAt(timestampMs).state)
                ? plan.fastForward!.playbackRate
                : plan.playbackRate;

        expect(rateAt(2000)).toBe(1.25);
        expect(rateAt(2400)).toBe(1.25);
        expect(rateAt(2748)).toBe(1.25);
    });

    it('switches fast-forward at visible subtitle boundaries instead of playback action offsets', () => {
        const plan = makePlan([PlayMode.fastForward], {
            subtitleTriggerStartOffset: 200,
            subtitleTriggerEndOffset: -200,
            fastForwardPlaybackMinimumSkipIntervalMs: 0,
        });
        const timeline = PlaybackTimeline.fromSnapshot(plan.timeline);
        const rateAt = (timestampMs: number) =>
            fastForwardingForPlanState(plan, timeline.lookupAt(timestampMs).state)
                ? plan.fastForward!.playbackRate
                : plan.playbackRate;

        expect(rateAt(998)).toBe(2.5);
        expect(rateAt(999)).toBe(1.25);
        expect(rateAt(1000)).toBe(1.25);
        expect(rateAt(1999)).toBe(1.25);
        expect(rateAt(2000)).toBe(2.5);
    });

    it('uses configurable start and end gaps for fast-forward boundaries', () => {
        const plan = makePlan([PlayMode.fastForward], {
            subtitleTriggerGapEndOffset: -200,
            subtitleTriggerGapStartOffset: 300,
            fastForwardPlaybackMinimumSkipIntervalMs: 0,
        });
        const timeline = PlaybackTimeline.fromSnapshot(plan.timeline);
        const rateAt = (timestampMs: number) =>
            fastForwardingForPlanState(plan, timeline.lookupAt(timestampMs).state)
                ? plan.fastForward!.playbackRate
                : plan.playbackRate;

        expect(rateAt(798)).toBe(2.5);
        expect(rateAt(799)).toBe(1.25);
        expect(rateAt(2299)).toBe(1.25);
        expect(rateAt(2300)).toBe(2.5);
    });
});
