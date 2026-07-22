import { describe, expect, it } from '@jest/globals';
import { type IndexedSubtitleModel } from '@project/common';
import AnimationFrameTimingDriver, {
    type AnimationFrameTimingSource,
} from '@project/common/playback/animation-frame-timing-driver';
import Clock from '@project/common/playback/clock';
import { emptyTimingDriverCallbacks, makeTimeline } from '@project/common/playback/playback-engine-test-utils';
import PlaybackPlanExecutor from '@project/common/playback/playback-plan-executor';
import { type PlaybackPlan } from '@project/common/playback/playback-plan';
import PlaybackTimelineCursor from '@project/common/playback/playback-timeline-cursor';
import type { TimingDriverCallbacks } from '@project/common/playback/timing-driver';

class FakeAnimationFrames {
    private nextHandle = 1;
    private callbacks = new Map<number, FrameRequestCallback>();

    requestAnimationFrameCallback(callback: FrameRequestCallback): number {
        const handle = this.nextHandle++;
        this.callbacks.set(handle, callback);
        return handle;
    }

    cancelAnimationFrameCallback(handle: number): void {
        this.callbacks.delete(handle);
    }

    present(): void {
        const callbacks = [...this.callbacks.values()];
        this.callbacks.clear();
        for (const callback of callbacks) callback(0);
    }
}

const flush = async () => {
    for (let i = 0; i < 10; ++i) await Promise.resolve();
};

const timingDriver = (
    clock: Clock,
    callbacks: Partial<TimingDriverCallbacks>,
    animationFrames: FakeAnimationFrames
): AnimationFrameTimingDriver => {
    const source: AnimationFrameTimingSource = {
        paused: () => !clock.running,
        durationMs: () => 6000,
        currentTimeMs: () => clock.time(Number.POSITIVE_INFINITY),
        requestAnimationFrameCallback: (callback) => animationFrames.requestAnimationFrameCallback(callback),
        cancelAnimationFrameCallback: (handle) => animationFrames.cancelAnimationFrameCallback(handle),
        addEventListener: (type, listener) => {
            if (type === 'play') clock.onEvent('start', listener);
            if (type === 'pause') clock.onEvent('stop', listener);
            if (type === 'seeked') clock.onEvent('settime', listener);
        },
        removeEventListener: (type, listener) => {
            if (type === 'play') clock.removeEvent('start', listener);
            if (type === 'pause') clock.removeEvent('stop', listener);
            if (type === 'seeked') clock.removeEvent('settime', listener);
        },
    };
    const driver = new AnimationFrameTimingDriver(source);
    driver.setCallbacks({ ...emptyTimingDriverCallbacks, ...callbacks });
    return driver;
};

describe('AnimationFrameTimingDriver', () => {
    it('samples the millisecond clock while running and stops after the clock stops', async () => {
        let nowMs = 0;
        const clock = new Clock(() => nowMs);
        const animationFrames = new FakeAnimationFrames();
        const updates: number[] = [];
        const driver = timingDriver(
            clock,
            {
                onTime: async (timestampMs) => {
                    updates.push(timestampMs);
                },
                onDiscontinuity: () => {},
            },
            animationFrames
        );
        driver.bind();

        clock.start();

        nowMs = 250;
        animationFrames.present();
        await flush();

        expect(updates).toEqual([250]);

        clock.stop();
        nowMs = 500;
        animationFrames.present();
        await flush();
        expect(updates).toEqual([250]);
        driver.unbind();
    });

    it('discards a queued frame when the clock stops during an update', async () => {
        let nowMs = 0;
        const clock = new Clock(() => nowMs);
        const animationFrames = new FakeAnimationFrames();
        const updates: number[] = [];
        let finishFirstUpdate!: () => void;
        const firstUpdate = new Promise<void>((resolve) => {
            finishFirstUpdate = resolve;
        });
        const driver = timingDriver(
            clock,
            {
                onTime: async (timestampMs) => {
                    updates.push(timestampMs);
                    if (updates.length === 1) await firstUpdate;
                },
                onDiscontinuity: () => {},
            },
            animationFrames
        );
        driver.bind();
        clock.start();

        nowMs = 100;
        animationFrames.present();
        nowMs = 200;
        animationFrames.present();
        clock.stop();
        finishFirstUpdate();
        await flush();

        expect(updates).toEqual([100]);
        driver.unbind();
    });

    it('binds timing from the current clock timestamp', () => {
        const clock = new Clock(() => 0);
        const animationFrames = new FakeAnimationFrames();
        const discontinuities: number[] = [];
        const driver = timingDriver(
            clock,
            {
                onTime: async () => {},
                onDiscontinuity: (timestampMs) => discontinuities.push(timestampMs),
            },
            animationFrames
        );
        clock.setTime(2000);
        clock.start();
        driver.bind();

        expect(discontinuities).toEqual([2000]);
        driver.unbind();
    });

    it('processes every crossed boundary after dropped animation frames', async () => {
        let nowMs = 500;
        const clock = new Clock(() => nowMs);
        clock.setTime(nowMs);
        const animationFrames = new FakeAnimationFrames();
        const timeline = makeTimeline(
            [
                { text: 'one', start: 1000, end: 2000, originalStart: 1000, originalEnd: 2000, track: 0 },
                { text: 'two', start: 3000, end: 4000, originalStart: 3000, originalEnd: 4000, track: 0 },
            ],
            {
                durationMs: 5000,
                subtitleTriggerStartOffset: 0,
                subtitleTriggerEndOffset: 0,
                subtitleTriggerGapEndOffset: 0,
                subtitleTriggerGapStartOffset: 0,
            }
        );
        const cursor = new PlaybackTimelineCursor(timeline, clock.time(Number.POSITIVE_INFINITY));
        const crossed: number[] = [];
        const driver = timingDriver(
            clock,
            {
                onTime: async (timestampMs) => {
                    crossed.push(...cursor.advance(timestampMs).map((group) => group.timestampMs));
                },
                onDiscontinuity: (timestampMs) => cursor.reset(timestampMs, { includeAtTimestamp: true }),
            },
            animationFrames
        );
        driver.bind();
        clock.start();

        nowMs = 4500;
        animationFrames.present();
        await flush();

        expect(crossed).toEqual([999, 1000, 1999, 2000, 2999, 3000, 3999, 4000]);
        driver.unbind();
    });

    it('reports a seek as a discontinuity without advancing across the skipped interval', async () => {
        const nowMs = 0;
        const clock = new Clock(() => nowMs);
        const animationFrames = new FakeAnimationFrames();
        const updates: number[] = [];
        const discontinuities: number[] = [];
        const driver = timingDriver(
            clock,
            {
                onTime: async (timestampMs) => {
                    updates.push(timestampMs);
                },
                onDiscontinuity: (timestampMs) => discontinuities.push(timestampMs),
            },
            animationFrames
        );
        driver.bind();
        clock.start();
        clock.setTime(5000);
        animationFrames.present();
        await flush();

        expect(updates).toEqual([]);
        expect(discontinuities).toEqual([0, 0, 5000]);
        driver.unbind();
    });

    it('processes a seek while paused and remains idle afterward', () => {
        const clock = new Clock(() => 0);
        const animationFrames = new FakeAnimationFrames();
        const discontinuities: number[] = [];
        const driver = timingDriver(
            clock,
            {
                onTime: async () => {},
                onDiscontinuity: (timestampMs) => discontinuities.push(timestampMs),
            },
            animationFrames
        );
        driver.bind();

        clock.setTime(3000);
        animationFrames.present();

        expect(discontinuities).toEqual([0, 3000]);
        driver.unbind();
    });

    it('drives subtitle visibility without executing playback-mode actions', async () => {
        let nowMs = 0;
        const clock = new Clock(() => nowMs);
        clock.setTime(500);
        const animationFrames = new FakeAnimationFrames();
        const subtitle: IndexedSubtitleModel = {
            text: 'one',
            start: 1000,
            end: 2000,
            originalStart: 1000,
            originalEnd: 2000,
            track: 0,
            index: 0,
        };
        const plan: PlaybackPlan<IndexedSubtitleModel> = {
            timeline: {
                durationMs: 3000,
                blocks: [],
                displaySubtitles: [subtitle],
            },
            playbackRate: 1,
        };
        const showingSubtitles: string[][] = [];
        const playbackActions: string[] = [];
        const executor = new PlaybackPlanExecutor(plan, clock.time(Number.POSITIVE_INFINITY), {
            play: async () => {},
            paused: () => !clock.running,
            pause: () => playbackActions.push('pause'),
            seek: async () => {
                playbackActions.push('seek');
            },
            setPlaybackRate: () => playbackActions.push('playback-rate'),
            correctTimestamp: async () => {
                playbackActions.push('correct-timestamp');
                return true;
            },
            showingSubtitlesChanged: (showing) => showingSubtitles.push(showing.map(({ text }) => text)),
        });
        playbackActions.length = 0;
        const driver = timingDriver(
            clock,
            {
                onTime: (timestampMs) => executor.update(timestampMs, { lookaheadTimestampMs: undefined }),
                onDiscontinuity: (timestampMs) => {
                    executor.reset(timestampMs, { includeAtTimestamp: false, cause: 'user-seek' });
                },
            },
            animationFrames
        );
        driver.bind();
        clock.start();

        nowMs = 1000;
        animationFrames.present();
        await flush();

        nowMs = 2000;
        animationFrames.present();
        await flush();

        expect(showingSubtitles).toEqual([['one'], []]);
        expect(playbackActions).toEqual([]);
        driver.unbind();
    });
});
