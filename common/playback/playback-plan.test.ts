import { describe, expect, it } from '@jest/globals';
import { AutoPausePreference, PlayMode, type SubtitleModel } from '@project/common';
import { makePlaybackPlanInput, makeSubtitle } from '@project/common/playback/playback-engine-test-utils';
import {
    buildPlaybackPlan,
    playbackPlanIsActive,
    playbackPlansEqual,
    playbackRateForPlanState,
} from '@project/common/playback/playback-plan';
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
        expect(playbackPlanIsActive(plan)).toBe(false);
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
        expect(playbackPlanIsActive(plan)).toBe(true);
    });

    it.each([
        { name: 'start action', preference: AutoPausePreference.atStart },
        { name: 'end action', preference: AutoPausePreference.atEnd },
    ])('keeps a displayless plan active for an auto-pause $name', ({ preference }) => {
        const plan = makePlan([PlayMode.autoPause], {
            displaySubtitles: [],
            autoPausePreference: preference,
        });

        expect(playbackPlanIsActive(plan)).toBe(true);
    });

    it.each([
        { name: 'condensed', mode: PlayMode.condensed },
        { name: 'fast-forward', mode: PlayMode.fastForward },
    ])('keeps a subtitle-free $name plan active', ({ mode }) => {
        const plan = makePlan([mode], { subtitles: [] });

        expect(playbackPlanIsActive(plan)).toBe(true);
    });

    it('swaps crossed playback mode offset roles for auto-pause and repeat', () => {
        const plan = makePlan([PlayMode.autoPause, PlayMode.repeat], {
            autoPausePreference: AutoPausePreference.atStartAndEnd,
            playbackModeStartOffset: 800,
            playbackModeEndOffset: -800,
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
            playbackModeStartOffset: -200,
            playbackModeEndOffset: 300,
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

        expect(plan.condensed).toEqual({ minimumSkipIntervalMs: 500 });
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

        expect(playbackRateForPlanState(plan, timeline.stateAt(2000))).toBe(2.5);
        expect(playbackRateForPlanState(plan, timeline.stateAt(3500))).toBe(2.5);
        expect(playbackRateForPlanState(plan, timeline.stateAt(3998))).toBe(2.5);
        expect(playbackRateForPlanState(plan, timeline.stateAt(3999))).toBe(1.25);
        expect(playbackRateForPlanState(plan, timeline.stateAt(4500))).toBe(1.25);
        expect(playbackRateForPlanState(plan, timeline.stateAt(5000))).toBe(2.5);
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

        expect(playbackRateForPlanState(plan, timeline.stateAt(2000))).toBe(1.25);
        expect(playbackRateForPlanState(plan, timeline.stateAt(2400))).toBe(1.25);
        expect(playbackRateForPlanState(plan, timeline.stateAt(2748))).toBe(1.25);
    });

    it('switches fast-forward at visible subtitle boundaries instead of playback action offsets', () => {
        const plan = makePlan([PlayMode.fastForward], {
            playbackModeStartOffset: 200,
            playbackModeEndOffset: -200,
            fastForwardPlaybackMinimumSkipIntervalMs: 0,
        });
        const timeline = PlaybackTimeline.fromSnapshot(plan.timeline);
        const rateAt = (timestampMs: number) => playbackRateForPlanState(plan, timeline.stateAt(timestampMs));

        expect(rateAt(998)).toBe(2.5);
        expect(rateAt(999)).toBe(1.25);
        expect(rateAt(1000)).toBe(1.25);
        expect(rateAt(1999)).toBe(1.25);
        expect(rateAt(2000)).toBe(2.5);
    });

    it('uses configurable start and end gaps for fast-forward boundaries', () => {
        const plan = makePlan([PlayMode.fastForward], {
            playbackModesStartGap: -200,
            playbackModesEndGap: 300,
            fastForwardPlaybackMinimumSkipIntervalMs: 0,
        });
        const timeline = PlaybackTimeline.fromSnapshot(plan.timeline);
        const rateAt = (timestampMs: number) => playbackRateForPlanState(plan, timeline.stateAt(timestampMs));

        expect(rateAt(798)).toBe(2.5);
        expect(rateAt(799)).toBe(1.25);
        expect(rateAt(2299)).toBe(1.25);
        expect(rateAt(2300)).toBe(2.5);
    });
});

describe('playbackPlansEqual', () => {
    it('compares independently compiled plans by their values', () => {
        const first = makePlan([PlayMode.autoPause, PlayMode.fastForward]);
        const second = makePlan([PlayMode.autoPause, PlayMode.fastForward]);

        expect(playbackPlansEqual(first, second)).toBe(true);
    });

    it('detects changes to compiled timing, actions, mode settings, and displayed subtitles', () => {
        const plan = makePlan([PlayMode.normal]);

        expect(playbackPlansEqual(plan, makePlan([PlayMode.normal], { durationMs: 6000 }))).toBe(false);
        expect(playbackPlansEqual(plan, makePlan([PlayMode.normal], { playbackModeStartOffset: 100 }))).toBe(false);
        expect(playbackPlansEqual(plan, makePlan([PlayMode.autoPause]))).toBe(false);
        expect(playbackPlansEqual(plan, makePlan([PlayMode.normal], { playbackRate: 1.5 }))).toBe(false);
        expect(
            playbackPlansEqual(
                makePlan([PlayMode.condensed]),
                makePlan([PlayMode.condensed], { condensedPlaybackMinimumSkipIntervalMs: 750 })
            )
        ).toBe(false);
        expect(
            playbackPlansEqual(
                makePlan([PlayMode.fastForward]),
                makePlan([PlayMode.fastForward], { fastForwardModePlaybackRate: 3 })
            )
        ).toBe(false);
        expect(
            playbackPlansEqual(
                plan,
                makePlan([PlayMode.normal], { displaySubtitles: [makeSubtitle({ text: 'other' })] })
            )
        ).toBe(false);
    });

    it('deeply compares nested displayed subtitle values', () => {
        const firstSubtitle = makeSubtitle({
            textImage: {
                dataUrl: 'data:image/png;base64,image',
                screen: { width: 100, height: 50 },
                image: { width: 200, height: 100 },
            },
            tokenization: {
                tokens: [
                    {
                        pos: [0, 4],
                        states: [],
                        readings: [],
                        frequency: 1,
                    },
                ],
            },
        });
        const secondSubtitle = makeSubtitle({
            textImage: {
                dataUrl: 'data:image/png;base64,image',
                screen: { width: 100, height: 50 },
                image: { width: 200, height: 100 },
            },
            tokenization: {
                tokens: [
                    {
                        pos: [0, 4],
                        states: [],
                        readings: [],
                        frequency: 1,
                    },
                ],
            },
        });

        expect(
            playbackPlansEqual(
                makePlan([PlayMode.normal], { displaySubtitles: [firstSubtitle] }),
                makePlan([PlayMode.normal], { displaySubtitles: [secondSubtitle] })
            )
        ).toBe(true);
        expect(
            playbackPlansEqual(
                makePlan([PlayMode.normal], { displaySubtitles: [firstSubtitle] }),
                makePlan([PlayMode.normal], {
                    displaySubtitles: [
                        makeSubtitle({
                            ...secondSubtitle,
                            textImage: {
                                ...secondSubtitle.textImage!,
                                image: { ...secondSubtitle.textImage!.image, width: 201 },
                            },
                        }),
                    ],
                })
            )
        ).toBe(false);
        expect(
            playbackPlansEqual(
                makePlan([PlayMode.normal], { displaySubtitles: [firstSubtitle] }),
                makePlan([PlayMode.normal], {
                    displaySubtitles: [
                        makeSubtitle({
                            ...secondSubtitle,
                            tokenization: {
                                tokens: [{ ...secondSubtitle.tokenization!.tokens[0], frequency: 2 }],
                            },
                        }),
                    ],
                })
            )
        ).toBe(false);
    });
});
