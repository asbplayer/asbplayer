import { describe, expect, it, jest } from '@jest/globals';
import type { SubtitleModel } from '@project/common';
import { makeSubtitle, makeTimeline as compileTimeline } from '@project/common/playback/playback-engine-test-utils';
import PlaybackTimelineRunner from '@project/common/playback/playback-timeline-runner';

const makeTimeline = () =>
    compileTimeline([makeSubtitle(1000, 2000, 0), makeSubtitle(3000, 4000, 1)], { durationMs: 5000 });

describe('PlaybackTimelineRunner', () => {
    it('corrects to the earliest auto-pause boundary crossed by a large jump and preserves later events', async () => {
        const starts: number[] = [];
        const ends: number[] = [];
        const corrections: number[] = [];
        const timeline = makeTimeline();
        const runner = new PlaybackTimelineRunner(timeline, 500, {
            onStart: (event) => {
                starts.push(event.timestampMs);
                return true;
            },
            onEnd: (event) => {
                ends.push(event.timestampMs);
                return { autoPaused: true, seeked: false };
            },
            correctAutoPause: async (timestampMs) => {
                corrections.push(timestampMs);
            },
            onState: async () => {},
            onAfterState: () => false,
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
        const start = jest.fn(() => true);
        const end = jest.fn(() => ({ autoPaused: true, seeked: false }));
        const correct = jest.fn((timestampMs: number) => void timestampMs);
        const runner = new PlaybackTimelineRunner(timeline, 1000, {
            onStart: start,
            onEnd: end,
            correctAutoPause: async (timestampMs) => {
                correct(timestampMs);
            },
            onState: async () => {},
            onAfterState: () => false,
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
            onStart: (event) => {
                starts.push(event.timestampMs);
                return false;
            },
            onEnd: () => ({ autoPaused: false, seeked: true }),
            correctAutoPause: async () => {},
            onState: async () => {},
            onAfterState: () => false,
        });

        await runner.update(4500);

        expect(starts).toEqual([1000]);
    });

    it('reconciles persistent state but does not run edge actions when crossing backward', async () => {
        const timeline = makeTimeline();
        const states: (readonly SubtitleModel[])[] = [];
        const starts = jest.fn(() => false);
        const ends = jest.fn(() => ({ autoPaused: false, seeked: false }));
        const runner = new PlaybackTimelineRunner(timeline, 1500, {
            onStart: starts,
            onEnd: ends,
            correctAutoPause: async () => {},
            onState: async (_state, segment) => {
                states.push(segment.showingSubtitles);
            },
            onAfterState: () => false,
        });

        await runner.update(1600);
        states.length = 0;
        await runner.update(500);

        expect(states).toEqual([[]]);
        expect(starts).not.toHaveBeenCalled();
        expect(ends).not.toHaveBeenCalled();
    });
});
