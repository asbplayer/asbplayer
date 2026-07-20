import { emptyTimingDriverCallbacks, makeTimeline } from '@project/common/playback/playback-engine-test-utils';
import { buildPlaybackPlan } from '@project/common/playback/playback-plan';
import PlaybackPlanExecutor from '@project/common/playback/playback-plan-executor';
import PlaybackTimelineCursor from '@project/common/playback/playback-timeline-cursor';
import VideoFrameTimingDriver, {
    type VideoFrameTimingSource,
} from '@project/common/playback/video-frame-timing-driver';
import { describe, expect, it } from '@jest/globals';
import { AutoPausePreference, type IndexedSubtitleModel, PlayMode } from '@project/common';
import type { TimingDriverCallbacks, TimingDriverEventCallbacks } from '@project/common/playback/timing-driver';

class FakeVideo extends EventTarget {
    currentTime = 0;
    playbackRate = 1;
    paused = true;
    private nextHandle = 1;
    private callbacks = new Map<number, VideoFrameRequestCallback>();

    requestVideoFrameCallback(callback: VideoFrameRequestCallback): number {
        const handle = this.nextHandle++;
        this.callbacks.set(handle, callback);
        return handle;
    }

    cancelVideoFrameCallback(handle: number): void {
        this.callbacks.delete(handle);
    }

    play(): void {
        this.paused = false;
        this.dispatchEvent(new Event('play'));
    }

    pause(): void {
        this.paused = true;
        this.dispatchEvent(new Event('pause'));
    }

    seek(timestampMs: number): void {
        this.dispatchEvent(new Event('seeking'));
        this.currentTime = timestampMs;
        this.dispatchEvent(new Event('seeked'));
    }

    present(timestampMs: number, mediaTimeSeconds = timestampMs / 1000, expectedDisplayTimeMs = timestampMs): void {
        this.currentTime = timestampMs / 1000;
        const callbacks = [...this.callbacks.values()];
        this.callbacks.clear();
        for (const callback of callbacks) {
            callback(0, {
                presentationTime: 0,
                expectedDisplayTime: expectedDisplayTimeMs,
                width: 0,
                height: 0,
                mediaTime: mediaTimeSeconds,
                presentedFrames: 1,
                processingDuration: 0,
            });
        }
    }

    get pendingFrameCallbacks(): number {
        return this.callbacks.size;
    }
}

const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

const flushAll = async () => {
    for (let i = 0; i < 10; ++i) await Promise.resolve();
};

const videoSource = (video: FakeVideo, currentTimeMs = () => video.currentTime * 1000): VideoFrameTimingSource => ({
    paused: () => video.paused,
    playbackRate: () => video.playbackRate,
    durationMs: () => 120_000,
    currentTimeMs,
    frameTimestampMs: () => undefined,
    requestVideoFrameCallback: (callback) => video.requestVideoFrameCallback(callback),
    cancelVideoFrameCallback: (handle) => video.cancelVideoFrameCallback(handle),
    addEventListener: (type, listener) => video.addEventListener(type, listener),
    removeEventListener: (type, listener) => video.removeEventListener(type, listener),
});

const timingDriver = (
    source: VideoFrameTimingSource,
    callbacks: Partial<TimingDriverCallbacks>
): VideoFrameTimingDriver => {
    const eventCallbacks: TimingDriverEventCallbacks = {
        onPlay: () => {},
        onPause: () => {},
        onSeeked: () => {},
        onPlaybackRateChanged: () => {},
        onDurationChanged: () => {},
        onTimeUpdate: () => {},
        onError: () => {},
    };
    const driver = new VideoFrameTimingDriver(source, eventCallbacks);
    driver.setCallbacks({ ...emptyTimingDriverCallbacks, ...callbacks });
    return driver;
};

describe('VideoFrameTimingDriver', () => {
    it('forwards media events through callbacks and detaches them on unbind', () => {
        const video = new FakeVideo();
        const events: string[] = [];
        const driver = new VideoFrameTimingDriver(videoSource(video), {
            onPlay: () => events.push('play'),
            onPause: () => events.push('pause'),
            onSeeked: (timestampMs) => events.push(`seeked:${timestampMs}`),
            onPlaybackRateChanged: (rate) => events.push(`rate:${rate}`),
            onDurationChanged: () => events.push('duration'),
            onTimeUpdate: (timestampMs) => events.push(`time:${timestampMs}`),
            onError: () => events.push('error'),
        });
        driver.bind();

        video.play();
        video.playbackRate = 1.5;
        video.dispatchEvent(new Event('ratechange'));
        video.dispatchEvent(new Event('durationchange'));
        video.currentTime = 2;
        video.dispatchEvent(new Event('timeupdate'));
        video.seek(3);
        video.pause();
        video.dispatchEvent(new Event('error'));

        expect(events).toEqual(['play', 'rate:1.5', 'duration', 'seeked:3000', 'pause', 'error']);
        driver.unbind();

        video.play();
        video.pause();
        expect(events).toEqual(['play', 'rate:1.5', 'duration', 'seeked:3000', 'pause', 'error']);
    });

    it('registers one frame callback at a time and stops while paused', async () => {
        const video = new FakeVideo();
        const updates: number[] = [];
        const driver = timingDriver(videoSource(video), {
            onTime: async (timestampMs) => {
                updates.push(timestampMs);
            },
            onDiscontinuity: () => {},
        });
        driver.bind();

        expect(video.pendingFrameCallbacks).toBe(0);
        video.play();
        expect(video.pendingFrameCallbacks).toBe(1);
        video.present(100);
        await flush();
        expect(updates).toEqual([100]);
        expect(video.pendingFrameCallbacks).toBe(1);

        video.pause();
        expect(video.pendingFrameCallbacks).toBe(0);
        driver.unbind();
    });

    it('discards a queued frame when playback pauses during an update', async () => {
        const video = new FakeVideo();
        const updates: number[] = [];
        let finishFirstUpdate!: () => void;
        const firstUpdate = new Promise<void>((resolve) => {
            finishFirstUpdate = resolve;
        });
        const driver = timingDriver(videoSource(video), {
            onTime: async (timestampMs) => {
                updates.push(timestampMs);
                if (updates.length === 1) await firstUpdate;
            },
            onDiscontinuity: () => {},
        });
        driver.bind();
        video.play();

        video.present(100);
        video.present(200);
        video.pause();
        finishFirstUpdate();
        await flush();

        expect(updates).toEqual([100]);
        driver.unbind();
    });

    it('serializes a seek discontinuity after the active frame update', async () => {
        const video = new FakeVideo();
        const events: string[] = [];
        let finishFirstUpdate!: () => void;
        const firstUpdate = new Promise<void>((resolve) => {
            finishFirstUpdate = resolve;
        });
        const driver = timingDriver(videoSource(video), {
            onTime: async (timestampMs) => {
                events.push(`start:${timestampMs}`);
                if (timestampMs === 100) {
                    await firstUpdate;
                    events.push('finish:100');
                }
            },
            onDiscontinuity: (timestampMs) => events.push(`discontinuity:${timestampMs}`),
        });
        driver.bind();
        video.play();

        video.present(100);
        video.seek(0.5);
        video.present(600);

        expect(events).toEqual(['discontinuity:0', 'start:100']);
        finishFirstUpdate();
        await flush();

        expect(events).toEqual(['discontinuity:0', 'start:100', 'finish:100', 'discontinuity:500', 'start:600']);
        driver.unbind();
    });

    it('forwards the presented frame media time instead of sampling currentTime', async () => {
        const video = new FakeVideo();
        const updates: number[] = [];
        const driver = timingDriver(videoSource(video), {
            onTime: async (timestampMs) => {
                updates.push(timestampMs);
            },
            onDiscontinuity: () => {},
        });
        driver.bind();
        video.play();

        video.present(9000, 0.25);
        await flush();

        expect(video.currentTime).toBe(9);
        expect(updates).toEqual([250]);
        driver.unbind();
    });

    it('uses an adapter-provided frame timestamp when frame metadata is not content time', async () => {
        const video = new FakeVideo();
        let contentTimeMs = 4321;
        const updates: number[] = [];
        const driver = timingDriver(
            {
                ...videoSource(video, () => contentTimeMs),
                frameTimestampMs: () => contentTimeMs,
            },
            {
                onTime: async (timestampMs) => {
                    updates.push(timestampMs);
                },
                onDiscontinuity: () => {},
            }
        );
        driver.bind();
        video.play();

        video.present(9000, 0.25);
        await flush();

        expect(driver.currentTimeMs()).toBe(4321);
        expect(updates).toEqual([4321]);
        contentTimeMs = 4500;
        expect(driver.currentTimeMs()).toBe(4500);
        driver.unbind();
    });

    it('estimates the next frame media time from display cadence and playback rate', async () => {
        const video = new FakeVideo();
        video.playbackRate = 1.5;
        const updates: [number, number | undefined][] = [];
        const driver = timingDriver(videoSource(video), {
            onTime: async (timestampMs, lookaheadTimestampSeconds) => {
                updates.push([timestampMs, lookaheadTimestampSeconds]);
            },
            onDiscontinuity: () => {},
        });
        driver.bind();
        video.play();

        video.present(1000, 1, 1000);
        video.present(1016.667, 1.016667, 1016.667);
        await flush();

        expect(updates[0]).toEqual([1000, undefined]);
        expect(updates[1][0]).toBeCloseTo(1016.667);
        expect(updates[1][1]).toBeCloseTo(1041.667);
        driver.unbind();
    });

    it('detects timeline boundaries even when high-rate playback skips several frames', async () => {
        const video = new FakeVideo();
        const timeline = makeTimeline(
            [
                { text: 'one', start: 1000, end: 2000, originalStart: 1000, originalEnd: 2000, track: 0 },
                { text: 'two', start: 3000, end: 4000, originalStart: 3000, originalEnd: 4000, track: 0 },
            ],
            {
                durationMs: 5000,
                playbackModeStartOffset: 0,
                playbackModeEndOffset: 0,
                playbackModesStartGap: 0,
                playbackModesEndGap: 0,
            }
        );
        const cursor = new PlaybackTimelineCursor(timeline, 500);
        const crossed: number[] = [];
        const driver = timingDriver(videoSource(video), {
            onTime: async (timestampMs) => {
                crossed.push(...cursor.advance(timestampMs).map((group) => group.timestampMs));
            },
            onDiscontinuity: (timestampMs) => cursor.reset(timestampMs),
        });
        video.currentTime = 0.5;
        driver.bind();
        video.play();

        video.present(4500);
        await flush();

        expect(crossed).toEqual([999, 1000, 1999, 2000, 2999, 3000, 3999, 4000]);
        driver.unbind();
    });

    it('resets on a seek instead of replaying crossed boundaries', async () => {
        const video = new FakeVideo();
        const updates: number[] = [];
        const discontinuities: number[] = [];
        const driver = timingDriver(videoSource(video), {
            onTime: async (timestampMs) => {
                updates.push(timestampMs);
            },
            onDiscontinuity: (timestampMs) => discontinuities.push(timestampMs),
        });
        driver.bind();
        video.play();
        video.dispatchEvent(new Event('seeking'));
        video.currentTime = 5;
        video.dispatchEvent(new Event('seeked'));
        await flush();

        expect(updates).toEqual([]);
        expect(discontinuities).toEqual([0, 5000]);
        expect(video.pendingFrameCallbacks).toBe(1);
        driver.unbind();
    });

    it('publishes a paused seek discontinuity without waiting for a frame callback', async () => {
        const video = new FakeVideo();
        const discontinuities: number[] = [];
        const driver = timingDriver(videoSource(video), {
            onTime: async () => {},
            onDiscontinuity: (timestampMs) => discontinuities.push(timestampMs),
        });
        driver.bind();

        video.seek(5);
        await flush();

        expect(discontinuities).toEqual([0, 5000]);
        expect(video.pendingFrameCallbacks).toBe(0);
        driver.unbind();
    });

    it('preserves a bounded repeat count when end auto-pause resumes into a repeat seek', async () => {
        const video = new FakeVideo();
        const subtitle: IndexedSubtitleModel = {
            text: 'one',
            start: 1000,
            end: 2000,
            originalStart: 1000,
            originalEnd: 2000,
            track: 0,
            index: 0,
        };
        const plan = buildPlaybackPlan({
            subtitles: [subtitle],
            durationMs: 3000,
            playModes: new Set([PlayMode.autoPause, PlayMode.repeat]),
            autoPausePreference: AutoPausePreference.atEnd,
            playbackModeStartOffset: 0,
            playbackModeEndOffset: 0,
            playbackModesStartGap: 0,
            playbackModesEndGap: 0,
            repeatCountPreference: 1,
            condensedPlaybackMinimumSkipIntervalMs: 500,
            playbackRate: 1,
            fastForwardModePlaybackRate: 2.5,
            fastForwardPlaybackMinimumSkipIntervalMs: 500,
        });
        const repeatSeeks: number[] = [];
        const executor = new PlaybackPlanExecutor(plan, video.currentTime * 1000, {
            paused: () => video.paused,
            pause: () => video.pause(),
            seek: async (timestampMs) => {
                repeatSeeks.push(timestampMs);
                video.seek(timestampMs / 1000);
            },
            setPlaybackRate: () => {},
            correctTimestamp: async (timestampMs) => {
                video.seek(timestampMs / 1000);
            },
            showingSubtitlesChanged: () => {},
            afterCondensedSeek: async () => {},
        });
        const driver = timingDriver(videoSource(video), {
            onTime: (timestampMs) => executor.update(timestampMs),
            onDiscontinuity: (timestampMs) => {
                const discontinuity = executor.consumeDiscontinuity(timestampMs);
                executor.reset(timestampMs, discontinuity.includeAtTimestamp, discontinuity.cause);
            },
            onCancel: () => executor.cancelPendingOperations(true),
            onPlaybackStarted: () => executor.playbackStarted(),
        });
        driver.bind();

        video.play();
        video.present(2100);
        await flush();
        video.play();
        await flush();
        video.present(2100);
        await flush();
        video.play();
        await flush();

        expect(repeatSeeks).toEqual([1000]);

        driver.unbind();
    });

    it('preserves a bounded repeat count for repeat-only native seeks', async () => {
        const video = new FakeVideo();
        const subtitle: IndexedSubtitleModel = {
            text: 'one',
            start: 1000,
            end: 2000,
            originalStart: 1000,
            originalEnd: 2000,
            track: 0,
            index: 0,
        };
        const plan = buildPlaybackPlan({
            subtitles: [subtitle],
            durationMs: 3000,
            playModes: new Set([PlayMode.repeat]),
            autoPausePreference: AutoPausePreference.atEnd,
            playbackModeStartOffset: 0,
            playbackModeEndOffset: 0,
            playbackModesStartGap: 0,
            playbackModesEndGap: 0,
            repeatCountPreference: 1,
            condensedPlaybackMinimumSkipIntervalMs: 500,
            playbackRate: 1,
            fastForwardModePlaybackRate: 2.5,
            fastForwardPlaybackMinimumSkipIntervalMs: 500,
        });
        const repeatSeeks: number[] = [];
        const executor = new PlaybackPlanExecutor(plan, video.currentTime * 1000, {
            paused: () => video.paused,
            pause: () => video.pause(),
            seek: async (timestampMs) => {
                repeatSeeks.push(timestampMs);
                video.seek(timestampMs / 1000);
            },
            setPlaybackRate: () => {},
            correctTimestamp: async (timestampMs) => {
                video.seek(timestampMs / 1000);
            },
            showingSubtitlesChanged: () => {},
            afterCondensedSeek: async () => {},
        });
        const driver = timingDriver(videoSource(video), {
            onTime: (timestampMs) => executor.update(timestampMs),
            onDiscontinuity: (timestampMs) => {
                const discontinuity = executor.consumeDiscontinuity(timestampMs);
                executor.reset(timestampMs, discontinuity.includeAtTimestamp, discontinuity.cause);
            },
            onCancel: () => executor.cancelPendingOperations(true),
            onPlaybackStarted: () => executor.playbackStarted(),
        });
        driver.bind();

        video.play();
        video.present(2100);
        await flushAll();
        video.present(2100);
        await flushAll();

        expect(repeatSeeks).toEqual([1000]);

        driver.unbind();
    });

    it('does not skip the bounded repeat before condensed playback resumes', async () => {
        const video = new FakeVideo();
        const subtitles: IndexedSubtitleModel[] = [
            {
                text: 'one',
                start: 1000,
                end: 2000,
                originalStart: 1000,
                originalEnd: 2000,
                track: 0,
                index: 0,
            },
            {
                text: 'two',
                start: 4000,
                end: 5000,
                originalStart: 4000,
                originalEnd: 5000,
                track: 0,
                index: 1,
            },
        ];
        const plan = buildPlaybackPlan({
            subtitles,
            durationMs: 6000,
            playModes: new Set([PlayMode.condensed, PlayMode.repeat]),
            autoPausePreference: AutoPausePreference.atEnd,
            playbackModeStartOffset: 0,
            playbackModeEndOffset: 0,
            playbackModesStartGap: 0,
            playbackModesEndGap: 0,
            repeatCountPreference: 1,
            condensedPlaybackMinimumSkipIntervalMs: 500,
            playbackRate: 1,
            fastForwardModePlaybackRate: 2.5,
            fastForwardPlaybackMinimumSkipIntervalMs: 500,
        });
        const seeks: number[] = [];
        const executor = new PlaybackPlanExecutor(plan, video.currentTime * 1000, {
            paused: () => video.paused,
            pause: () => video.pause(),
            seek: async (timestampMs) => {
                seeks.push(timestampMs);
                video.seek(timestampMs / 1000);
            },
            setPlaybackRate: () => {},
            correctTimestamp: async (timestampMs) => {
                video.seek(timestampMs / 1000);
            },
            showingSubtitlesChanged: () => {},
            afterCondensedSeek: async () => {},
        });
        const driver = timingDriver(videoSource(video), {
            onTime: (timestampMs) => executor.update(timestampMs),
            onDiscontinuity: (timestampMs) => {
                const discontinuity = executor.consumeDiscontinuity(timestampMs);
                executor.reset(timestampMs, discontinuity.includeAtTimestamp, discontinuity.cause);
            },
            onCancel: () => executor.cancelPendingOperations(true),
            onPlaybackStarted: () => executor.playbackStarted(),
        });
        driver.bind();

        video.play();
        video.present(2100);
        await flushAll();
        video.present(2100);
        await flushAll();

        expect(seeks).toEqual([1000, 3999]);

        driver.unbind();
    });

    it('does not use timeupdate as a timing source', async () => {
        const video = new FakeVideo();
        const updates: number[] = [];
        const driver = timingDriver(videoSource(video), {
            onTime: async (timestampMs) => {
                updates.push(timestampMs);
            },
            onDiscontinuity: () => {},
        });
        driver.bind();
        video.play();
        video.currentTime = 0.25;
        video.dispatchEvent(new Event('timeupdate'));
        await flush();

        expect(updates).toEqual([]);
        video.present(250);
        await flush();

        expect(updates).toEqual([250]);
        driver.unbind();
    });

    it('binds timing from the current timestamp', async () => {
        const video = new FakeVideo();
        const discontinuities: number[] = [];
        const currentTimeMs = 2345;
        const driver = timingDriver(
            videoSource(video, () => currentTimeMs),
            {
                onTime: async () => {},
                onDiscontinuity: (timestampMs) => discontinuities.push(timestampMs),
            }
        );
        driver.bind();
        video.play();

        expect(discontinuities).toEqual([2345]);
        expect(video.pendingFrameCallbacks).toBe(1);

        driver.unbind();
    });
});
