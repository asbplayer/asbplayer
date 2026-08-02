import { describe, expect, it, jest } from '@jest/globals';
import type { IndexedSubtitleModel } from '@project/common';
import { makeSubtitle, makeTimeline as compileTimeline } from '@project/common/playback/playback-test-utils';
import PlaybackTimeline from '@project/common/playback/timeline/playback-timeline';
import PlaybackTimelineRunner from '@project/common/playback/timeline/playback-timeline-runner';

const makeTimeline = () => {
    const timeline = compileTimeline([makeSubtitle(1000, 2000, 0), makeSubtitle(3000, 4000, 1)], {
        durationMs: 5000,
    });
    return PlaybackTimeline.fromSubtitles({
        durationMs: timeline.durationMs,
        displaySubtitles: [makeSubtitle(1000, 2000, 0), makeSubtitle(3000, 4000, 1)],
        blocks: timeline.blocks.map((block) => ({
            ...block,
            startAction: true as const,
            endAction: { pause: true },
        })),
    });
};

describe('PlaybackTimelineRunner', () => {
    it('corrects to the earliest auto-pause boundary crossed by a large jump and preserves later events', async () => {
        const starts: number[] = [];
        const ends: number[] = [];
        const corrections: number[] = [];
        const timeline = makeTimeline();
        const runner = new PlaybackTimelineRunner(timeline, 500, {
            onStart: async (event) => {
                starts.push(event.timestampMs);
                return { autoPaused: true };
            },
            onEnd: async (event) => {
                ends.push(event.timestampMs);
                return { autoPaused: true, seeked: false };
            },
            correctAutoPause: async (timestampMs) => {
                corrections.push(timestampMs);
            },
            onState: async () => {},
            onAfterState: async () => ({ stateChangedTimestampMs: undefined }),
        });

        await runner.update(4500);
        await runner.update(4500);

        expect(starts).toEqual([1000]);
        expect(ends).toEqual([1999]);
        expect(corrections).toEqual([1000, 1999]);
    });

    it('processes both roles at a shared timestamp but performs one correction', async () => {
        const timeline = compileTimeline([makeSubtitle(1000, 2000, 0)], {
            durationMs: 3000,
            subtitleTriggerStartOffset: 500,
            subtitleTriggerEndOffset: -499,
        });
        const actionTimeline = PlaybackTimeline.fromSubtitles({
            durationMs: timeline.durationMs,
            displaySubtitles: [makeSubtitle(1000, 2000, 0)],
            blocks: timeline.blocks.map((block) => ({
                ...block,
                startAction: true as const,
                endAction: { pause: true },
            })),
        });
        const start = jest.fn(async () => ({ autoPaused: true }));
        const end = jest.fn(async () => ({ autoPaused: true, seeked: false }));
        const correct = jest.fn((timestampMs: number) => void timestampMs);
        const runner = new PlaybackTimelineRunner(actionTimeline, 1000, {
            onStart: start,
            onEnd: end,
            correctAutoPause: async (timestampMs) => {
                correct(timestampMs);
            },
            onState: async () => {},
            onAfterState: async () => ({ stateChangedTimestampMs: undefined }),
        });

        await runner.update(2000);

        expect(start).toHaveBeenCalledTimes(1);
        expect(end).toHaveBeenCalledTimes(1);
        expect(correct).toHaveBeenCalledTimes(1);
        expect(correct).toHaveBeenCalledWith(1500);
    });

    it('stops processing the old range after an internal seek', async () => {
        const timeline = makeTimeline();
        const starts: number[] = [];
        const runner = new PlaybackTimelineRunner(timeline, 500, {
            onStart: async (event) => {
                starts.push(event.timestampMs);
                return { autoPaused: false };
            },
            onEnd: async () => ({ autoPaused: false, seeked: true }),
            correctAutoPause: async () => {},
            onState: async () => {},
            onAfterState: async () => ({ stateChangedTimestampMs: undefined }),
        });

        await runner.update(4500);

        expect(starts).toEqual([1000]);
    });

    it('reconciles persistent state but does not run edge actions when crossing backward', async () => {
        const timeline = makeTimeline();
        const states: (readonly IndexedSubtitleModel[])[] = [];
        const starts = jest.fn(async () => ({ autoPaused: false }));
        const ends = jest.fn(async () => ({ autoPaused: false, seeked: false }));
        const runner = new PlaybackTimelineRunner(timeline, 1500, {
            onStart: starts,
            onEnd: ends,
            correctAutoPause: async () => {},
            onState: async (_state, segment) => {
                states.push(segment.showingSubtitles);
            },
            onAfterState: async () => ({ stateChangedTimestampMs: undefined }),
        });

        await runner.update(1600);
        states.length = 0;
        await runner.update(500);

        expect(states).toEqual([[]]);
        expect(starts).not.toHaveBeenCalled();
        expect(ends).not.toHaveBeenCalled();
    });

    it('resets the cursor to the position returned after state changes playback position', async () => {
        const starts: number[] = [];
        let firstUpdate = true;
        const runner = new PlaybackTimelineRunner(makeTimeline(), 500, {
            onStart: async (event) => {
                starts.push(event.timestampMs);
                return { autoPaused: false };
            },
            onEnd: async () => ({ autoPaused: false, seeked: false }),
            correctAutoPause: async () => {},
            onState: async () => {},
            onAfterState: async () => {
                if (!firstUpdate) return { stateChangedTimestampMs: undefined };
                firstUpdate = false;
                return { stateChangedTimestampMs: 2500 };
            },
        });

        await runner.update(500);
        await runner.update(3500);

        expect(starts).toEqual([3000]);
    });
});
