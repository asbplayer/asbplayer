import TimingUpdateQueue, {
    type InternalSeekCompletion,
    type TimingDriver,
    type TimingDriverCallbacks,
    type TimingDriverEventCallbacks,
} from '@project/common/playback/timing/timing-driver';

const defaultFrameTimeMs = 1000 / 60;
const timeUpdateIntervalMs = 50;
const videoFrameCallbackHealthCheckIntervalMs = 1000;
type VideoFrameTimingEvent =
    | 'play'
    | 'pause'
    | 'seeking'
    | 'seeked'
    | 'timeupdate'
    | 'ratechange'
    | 'durationchange'
    | 'loadedmetadata'
    | 'resize'
    | 'emptied'
    | 'error';

export interface VideoFrameTimingSource {
    readonly paused: () => boolean;
    readonly playbackRate: () => number;
    readonly durationMs: () => number;
    readonly currentTimeMs: () => number;
    /** Whether the loaded media resource has a video track (e.g., an audio-only element). */
    readonly hasVideoTrack: () => boolean;
    /** Overrides requestVideoFrameCallback metadata when the media element does not expose content time. */
    readonly frameTimestampMs: (now: number, metadata: VideoFrameCallbackMetadata) => number | undefined;
    /** Uses owner-supplied seek lifecycle events instead of native seeking/seeked events. */
    readonly externalSeekEvents: boolean;
    /** ~0.05ms for the hot path (no state changes/actions) and <1ms otherwise per frame */
    requestVideoFrameCallback(callback: VideoFrameRequestCallback): number;
    cancelVideoFrameCallback(handle: number): void;
    addEventListener(type: VideoFrameTimingEvent, listener: EventListener): void;
    removeEventListener(type: VideoFrameTimingEvent, listener: EventListener): void;
}

/**
 * Feeds presented media timestamps to playback-mode timing. Only one native video-frame callback is registered at a time.
 */
export default class VideoFrameTimingDriver implements TimingDriver {
    private readonly video: VideoFrameTimingSource;
    private callbacks: TimingDriverCallbacks;
    private _bound = false;
    private seeking = false;
    private expectedInternalSeek = false;
    private timeUpdatesBound = false;
    private videoFrameCallbacksEligible = false;
    private frameHandle?: number;
    private timeUpdateHandle?: ReturnType<typeof setInterval>;
    private videoFrameCallbackHealthCheckHandle?: ReturnType<typeof setInterval>;
    private lastRequestVideoFrameCallbackTime?: number;
    private lastCheckedRequestVideoFrameCallbackTime?: number;
    private previousFrame?: {
        readonly expectedDisplayTimeMs: number;
        readonly callbackTimeMs: number;
        readonly presentedFrames: number;
    };
    private lastFrameTimeMs?: number;
    private pendingSeekCompletion?: {
        readonly promise: Promise<InternalSeekCompletion>;
        readonly resolve: (completion: InternalSeekCompletion) => void;
        readonly reject: (error: Error) => void;
    };
    private readonly updates: TimingUpdateQueue;
    private readonly eventCallbacks: TimingDriverEventCallbacks;

    constructor(video: VideoFrameTimingSource, eventCallbacks: TimingDriverEventCallbacks) {
        this.video = video;
        this.eventCallbacks = eventCallbacks;
        this.callbacks = {
            onTime: async () => {},
            onPlaybackStarted: async () => {},
            onPlaybackPaused: () => {},
            onDiscontinuity: () => {},
            onCancel: () => {},
            onError: () => {},
        };
        this.updates = new TimingUpdateQueue(
            { active: () => this._bound && !this.seeking && !this.video.paused() },
            {
                onTime: async (timestampMs, options) => {
                    await this.callbacks.onTime(timestampMs, options);
                },
                onPlaybackStarted: async () => {
                    try {
                        await this.callbacks.onPlaybackStarted();
                    } finally {
                        this.schedule();
                    }
                },
                onDiscontinuity: (timestampMs) => this.callbacks.onDiscontinuity(timestampMs),
                onCancel: (options) => this.callbacks.onCancel(options),
                onError: (error) => this.callbacks.onError(error),
            }
        );
    }

    setCallbacks(callbacks: TimingDriverCallbacks): void {
        this.callbacks = callbacks;
    }

    beginInternalSeek(): Promise<InternalSeekCompletion> {
        this.completePendingSeek('cancelled');
        this.expectedInternalSeek = true;
        let resolve!: (completion: InternalSeekCompletion) => void;
        let reject!: (error: Error) => void;
        const promise = new Promise<InternalSeekCompletion>((completion, failure) => {
            resolve = completion;
            reject = failure;
        });
        this.pendingSeekCompletion = { promise, resolve, reject };
        return promise;
    }

    cancelExpectedInternalSeek(): void {
        this.expectedInternalSeek = false;
        this.completePendingSeek('cancelled');
    }

    get externalSeekEvents(): boolean {
        return this.video.externalSeekEvents;
    }

    externalSeekStarted(): void {
        if (!this._bound || !this.externalSeekEvents) return;
        this.onSeeking();
    }

    externalSeeked(timestampMs: number): void {
        if (!this._bound || !this.externalSeekEvents) return;
        this.handleSeeked(timestampMs);
    }

    externalSeekCanceled(): void {
        if (!this._bound || !this.externalSeekEvents) return;
        this.seeking = false;
        this.expectedInternalSeek = false;
        this.cancelScheduledUpdate();
        this.updates.clear({ preserveExpectedDiscontinuity: false });
        this.previousFrame = undefined;
        this.completePendingSeek('cancelled');
        this.schedule();
    }

    currentTimeMs(): number {
        return this.video.currentTimeMs();
    }

    playbackRate(): number {
        return this.video.playbackRate();
    }

    frameTimeMs(): number {
        return this.lastFrameTimeMs ?? defaultFrameTimeMs;
    }

    durationMs(): number {
        return this.video.durationMs();
    }

    paused(): boolean {
        return this.video.paused();
    }

    bind(): void {
        if (this._bound) return;
        this._bound = true;
        this.video.addEventListener('play', this.onPlay);
        this.video.addEventListener('pause', this.onPause);
        if (!this.externalSeekEvents) {
            this.video.addEventListener('seeking', this.onSeeking);
            this.video.addEventListener('seeked', this.onSeeked);
        }
        this.video.addEventListener('ratechange', this.onRateChange);
        this.video.addEventListener('durationchange', this.onDurationChange);
        this.video.addEventListener('loadedmetadata', this.onMetadataChange);
        this.video.addEventListener('resize', this.onMetadataChange);
        this.video.addEventListener('emptied', this.onMetadataChange);
        this.video.addEventListener('error', this.onError);
        document.addEventListener('visibilitychange', this.onMetadataChange);
        this.lastRequestVideoFrameCallbackTime = undefined;
        this.lastCheckedRequestVideoFrameCallbackTime = undefined;
        this.startVideoFrameCallbackHealthCheck();
        this.reset();
        this.onMetadataChange();
    }

    get bound(): boolean {
        return this._bound;
    }

    unbind(): void {
        if (!this._bound) return;
        this._bound = false;
        this.video.removeEventListener('play', this.onPlay);
        this.video.removeEventListener('pause', this.onPause);
        if (!this.externalSeekEvents) {
            this.video.removeEventListener('seeking', this.onSeeking);
            this.video.removeEventListener('seeked', this.onSeeked);
        }
        this.video.removeEventListener('ratechange', this.onRateChange);
        this.video.removeEventListener('durationchange', this.onDurationChange);
        this.video.removeEventListener('loadedmetadata', this.onMetadataChange);
        this.video.removeEventListener('resize', this.onMetadataChange);
        this.video.removeEventListener('emptied', this.onMetadataChange);
        this.video.removeEventListener('error', this.onError);
        this.stopTimeUpdateFallback();
        this.stopVideoFrameCallbackHealthCheck();
        this.videoFrameCallbacksEligible = false;
        this.lastRequestVideoFrameCallbackTime = undefined;
        this.lastCheckedRequestVideoFrameCallbackTime = undefined;
        document.removeEventListener('visibilitychange', this.onMetadataChange);
        this.cancelScheduledUpdate();
        this.updates.clear({ preserveExpectedDiscontinuity: false });
        this.previousFrame = undefined;
        this.seeking = false;
        this.expectedInternalSeek = false;
        this.completePendingSeek('cancelled');
    }

    private reset(): void {
        this.updates.enqueueDiscontinuity(this.currentTimeMs());
    }

    private readonly onPlay = () => {
        this.startTimeUpdatePolling();
        this.updates.enqueuePlaybackStarted();
        if (this.pendingSeekCompletion === undefined) this.schedule();
        this.eventCallbacks.onPlay();
    };

    private readonly onPause = () => {
        this.stopTimeUpdatePolling();
        this.cancelScheduledUpdate();
        this.updates.clear({ preserveExpectedDiscontinuity: this.pendingSeekCompletion !== undefined });
        this.previousFrame = undefined;
        this.callbacks.onPlaybackPaused();
        this.eventCallbacks.onPause();
    };

    private readonly onSeeking = () => {
        this.seeking = true;
        const preserveExpectedDiscontinuity = this.expectedInternalSeek || this.pendingSeekCompletion !== undefined;
        this.expectedInternalSeek = false;
        this.cancelScheduledUpdate();
        this.updates.clear({ preserveExpectedDiscontinuity });
        this.previousFrame = undefined;
    };

    private readonly onSeeked = () => {
        this.handleSeeked(this.currentTimeMs());
    };

    private readonly onTimeUpdate = () => {
        if (!this.shouldProcess()) return;
        this.updates.enqueue(this.currentTimeMs(), { lookaheadTimestampMs: undefined });
    };

    private readonly onTimeUpdateInterval = () => {
        if (this.video.paused()) {
            this.stopTimeUpdatePolling();
            return;
        }
        this.onTimeUpdate();
    };

    /**
     * Browsers will no longer fire rVFC events when the document is hidden but continue playing audio.
     * Audio-only media also has no video frames, even though rVFC is defined on the element.
     * To work around both cases, listen for 'timeupdate' events whenever there is no usable video frame source.
     */
    private readonly onMetadataChange = () => {
        this.videoFrameCallbacksEligible = !document.hidden && this.video.hasVideoTrack();
        if (!this.videoFrameCallbacksEligible) {
            this.cancelScheduledUpdate();
            this.previousFrame = undefined;
            this.startTimeUpdateFallback();
            return;
        }
        this.schedule(); // Keep fallback timing active until a frame callback proves that the frame source is responsive.
    };

    private readonly handleSeeked = (timestampMs: number) => {
        this.seeking = false;
        this.previousFrame = undefined;
        this.completePendingSeek('completed');
        this.updates.enqueueDiscontinuity(timestampMs); // rVFC may not run during pause
        this.schedule();
        this.eventCallbacks.onSeeked(timestampMs);
    };

    private readonly onRateChange = () => {
        const playbackRate = this.video.playbackRate();
        if (!playbackRate && this.seeking) return; // Some videos may report a playback rate of 0 during seeking
        this.eventCallbacks.onPlaybackRateChanged(playbackRate);
    };

    readonly onDurationChange = () => {
        this.eventCallbacks.onDurationChanged(this.video.durationMs());
    };

    private readonly onError = () => {
        this.failPendingSeek(new Error('Media seek failed'));
        this.eventCallbacks.onError();
    };

    private shouldProcess(): boolean {
        if (!this._bound) return false;
        if (this.seeking || this.video.paused()) return false;
        return true;
    }

    private schedule(): void {
        if (!this.shouldProcess()) return;
        if (!this.videoFrameCallbacksEligible) return;
        if (this.frameHandle !== undefined) return;

        this.frameHandle = this.video.requestVideoFrameCallback((now, metadata) => {
            this.frameHandle = undefined;
            this.lastRequestVideoFrameCallbackTime = now;
            this.stopTimeUpdateFallback();
            const timestampMs = this.video.frameTimestampMs(now, metadata) ?? metadata.mediaTime * 1000;
            const lookaheadTimestampMs = this.nextFrameTimestampMs(
                timestampMs,
                metadata.expectedDisplayTime,
                now,
                metadata.presentedFrames
            );
            this.previousFrame = {
                expectedDisplayTimeMs: metadata.expectedDisplayTime,
                callbackTimeMs: now,
                presentedFrames: metadata.presentedFrames,
            };
            this.updates.enqueue(timestampMs, { lookaheadTimestampMs });
            this.schedule();
        });
    }

    private nextFrameTimestampMs(
        mediaTimeMs: number,
        expectedDisplayTimeMs: number,
        callbackTimeMs: number,
        presentedFrames: number
    ): number | undefined {
        const previousFrame = this.previousFrame;
        if (previousFrame === undefined) return;

        const expectedDisplayIntervalMs = expectedDisplayTimeMs - previousFrame.expectedDisplayTimeMs;
        const callbackIntervalMs = callbackTimeMs - previousFrame.callbackTimeMs;
        const frameIntervalMs = expectedDisplayIntervalMs > 0 ? expectedDisplayIntervalMs : callbackIntervalMs;
        const playbackRate = this.video.playbackRate();
        if (frameIntervalMs <= 0 || !Number.isFinite(playbackRate)) return;

        const presentedFrameInterval = presentedFrames - previousFrame.presentedFrames;
        const frameCount = presentedFrameInterval > 0 ? presentedFrameInterval : 1;
        this.lastFrameTimeMs = (frameIntervalMs * playbackRate) / frameCount;
        return mediaTimeMs + frameIntervalMs * playbackRate;
    }

    private startTimeUpdatePolling(): void {
        if (!this.timeUpdatesBound || this.video.paused() || this.timeUpdateHandle !== undefined) return;
        this.timeUpdateHandle = setInterval(this.onTimeUpdateInterval, timeUpdateIntervalMs);
    }

    private stopTimeUpdatePolling(): void {
        if (this.timeUpdateHandle !== undefined) clearInterval(this.timeUpdateHandle);
        this.timeUpdateHandle = undefined;
    }

    private startTimeUpdateFallback(): void {
        if (!this.timeUpdatesBound) {
            this.video.addEventListener('timeupdate', this.onTimeUpdate);
            this.timeUpdatesBound = true;
        }
        this.startTimeUpdatePolling();
    }

    private stopTimeUpdateFallback(): void {
        if (!this.timeUpdatesBound) return;
        this.video.removeEventListener('timeupdate', this.onTimeUpdate);
        this.timeUpdatesBound = false;
        this.stopTimeUpdatePolling();
    }

    private startVideoFrameCallbackHealthCheck(): void {
        if (this.videoFrameCallbackHealthCheckHandle !== undefined) return;
        this.videoFrameCallbackHealthCheckHandle = setInterval(
            this.checkVideoFrameCallbackHealth,
            videoFrameCallbackHealthCheckIntervalMs
        );
    }

    private stopVideoFrameCallbackHealthCheck(): void {
        if (this.videoFrameCallbackHealthCheckHandle !== undefined) {
            clearInterval(this.videoFrameCallbackHealthCheckHandle);
        }
        this.videoFrameCallbackHealthCheckHandle = undefined;
    }

    private readonly checkVideoFrameCallbackHealth = () => {
        if (!this.shouldProcess() || !this.videoFrameCallbacksEligible) return;
        if (this.lastRequestVideoFrameCallbackTime === this.lastCheckedRequestVideoFrameCallbackTime) {
            this.startTimeUpdateFallback();
            return;
        }
        this.lastCheckedRequestVideoFrameCallbackTime = this.lastRequestVideoFrameCallbackTime;
        this.stopTimeUpdateFallback();
    };

    private cancelScheduledUpdate(): void {
        if (this.frameHandle === undefined) return;
        this.video.cancelVideoFrameCallback(this.frameHandle);
        this.frameHandle = undefined;
    }

    private completePendingSeek(completion: InternalSeekCompletion): void {
        this.pendingSeekCompletion?.resolve(completion);
        this.pendingSeekCompletion = undefined;
    }

    private failPendingSeek(error: Error): void {
        this.pendingSeekCompletion?.reject(error);
        this.pendingSeekCompletion = undefined;
        this.expectedInternalSeek = false;
        this.seeking = false;
        this.cancelScheduledUpdate();
        this.updates.clear({ preserveExpectedDiscontinuity: false });
        this.previousFrame = undefined;
        this.schedule();
    }
}
