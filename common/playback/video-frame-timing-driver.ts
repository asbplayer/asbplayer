import TimingUpdateQueue, {
    type TimingDriver,
    type TimingDriverCallbacks,
    type TimingDriverEventCallbacks,
} from '@project/common/playback/timing-driver';

export interface VideoFrameTimingSource {
    readonly paused: () => boolean;
    readonly playbackRate: () => number;
    readonly durationMs: () => number;
    readonly currentTimeMs: () => number;
    /** Overrides requestVideoFrameCallback metadata when the media element does not expose content time. */
    readonly frameTimestampMs: (now: number, metadata: VideoFrameCallbackMetadata) => number | undefined;
    /** Uses owner-supplied seek lifecycle events instead of native seeking/seeked events. */
    readonly externalSeekEvents: boolean;
    /** ~0.05ms for the hot path (no state changes/actions) and <1ms otherwise per frame */
    requestVideoFrameCallback(callback: VideoFrameRequestCallback): number;
    cancelVideoFrameCallback(handle: number): void;
    addEventListener(
        type: 'play' | 'pause' | 'seeking' | 'seeked' | 'timeupdate' | 'ratechange' | 'durationchange' | 'error',
        listener: EventListener
    ): void;
    removeEventListener(
        type: 'play' | 'pause' | 'seeking' | 'seeked' | 'timeupdate' | 'ratechange' | 'durationchange' | 'error',
        listener: EventListener
    ): void;
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
    private frameHandle?: number;
    private previousFrame?: {
        readonly expectedDisplayTimeMs: number;
        readonly callbackTimeMs: number;
    };
    private pendingSeekCompletion?: {
        readonly promise: Promise<void>;
        readonly resolve: () => void;
        readonly reject: (error: unknown) => void;
    };
    private readonly updates: TimingUpdateQueue;
    private readonly eventCallbacks: TimingDriverEventCallbacks;

    constructor(video: VideoFrameTimingSource, eventCallbacks: TimingDriverEventCallbacks) {
        this.video = video;
        this.eventCallbacks = eventCallbacks;
        this.callbacks = {
            onTime: async () => {},
            onPlaybackStarted: async () => {},
            onDiscontinuity: () => {},
            onCancel: () => {},
            onError: () => {},
        };
        this.updates = new TimingUpdateQueue(
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
            },
            () => this._bound && !this.seeking && !this.video.paused()
        );
    }

    setCallbacks(callbacks: TimingDriverCallbacks): void {
        this.callbacks = callbacks;
    }

    beginInternalSeek(): Promise<void> {
        this.completePendingSeek();
        this.expectedInternalSeek = true;
        let resolve!: () => void;
        let reject!: (error: unknown) => void;
        const promise = new Promise<void>((completion, failure) => {
            resolve = completion;
            reject = failure;
        });
        this.pendingSeekCompletion = { promise, resolve, reject };
        return promise;
    }

    cancelExpectedInternalSeek(): void {
        this.expectedInternalSeek = false;
        this.completePendingSeek();
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
        this.completePendingSeek();
        this.schedule();
    }

    currentTimeMs(): number {
        return this.video.currentTimeMs();
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
        this.video.addEventListener('error', this.onError);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        this.reset();
        this.onVisibilityChange();
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
        this.video.removeEventListener('error', this.onError);
        this.video.removeEventListener('timeupdate', this.onTimeUpdate);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        this.cancelScheduledUpdate();
        this.updates.clear({ preserveExpectedDiscontinuity: false });
        this.previousFrame = undefined;
        this.seeking = false;
        this.expectedInternalSeek = false;
        this.completePendingSeek();
    }

    private reset(): void {
        this.updates.enqueueDiscontinuity(this.currentTimeMs());
    }

    private readonly onPlay = () => {
        this.updates.enqueuePlaybackStarted();
        if (this.pendingSeekCompletion === undefined) this.schedule();
        this.eventCallbacks.onPlay();
    };

    private readonly onPause = () => {
        this.cancelScheduledUpdate();
        this.updates.clear({ preserveExpectedDiscontinuity: this.pendingSeekCompletion !== undefined });
        this.previousFrame = undefined;
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

    /**
     * Browsers will no longer fire rVFC events when the document is hidden but continue playing audio.
     * To work around this, we listen for 'timeupdate' events while the document is hidden to keep the timing driver updated.
     */
    private readonly onVisibilityChange = () => {
        if (document.hidden) {
            this.cancelScheduledUpdate();
            this.previousFrame = undefined;
            this.video.addEventListener('timeupdate', this.onTimeUpdate);
            return;
        }
        this.video.removeEventListener('timeupdate', this.onTimeUpdate);
        this.schedule();
    };

    private readonly handleSeeked = (timestampMs: number) => {
        this.seeking = false;
        this.previousFrame = undefined;
        this.completePendingSeek();
        this.updates.enqueueDiscontinuity(timestampMs); // rVFC may not run during pause
        this.schedule();
        this.eventCallbacks.onSeeked(timestampMs);
    };

    private readonly onRateChange = () => {
        const playbackRate = this.video.playbackRate();
        if (!playbackRate && this.seeking) return; // Some videos may report a playback rate of 0 during seeking
        this.eventCallbacks.onPlaybackRateChanged(playbackRate);
    };

    private readonly onDurationChange = () => {
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
        if (document.hidden) return; // Browser will not fire rVFC events when hidden, see onVisibilityChange
        if (this.frameHandle !== undefined) return;

        this.frameHandle = this.video.requestVideoFrameCallback((now, metadata) => {
            this.frameHandle = undefined;
            const timestampMs = this.video.frameTimestampMs(now, metadata) ?? metadata.mediaTime * 1000;
            const lookaheadTimestampMs = this.nextFrameTimestampMs(timestampMs, metadata.expectedDisplayTime, now);
            this.previousFrame = {
                expectedDisplayTimeMs: metadata.expectedDisplayTime,
                callbackTimeMs: now,
            };
            this.updates.enqueue(timestampMs, { lookaheadTimestampMs });
            this.schedule();
        });
    }

    private nextFrameTimestampMs(
        mediaTimeMs: number,
        expectedDisplayTimeMs: number,
        callbackTimeMs: number
    ): number | undefined {
        const previousFrame = this.previousFrame;
        if (previousFrame === undefined) return;

        const expectedDisplayIntervalMs = expectedDisplayTimeMs - previousFrame.expectedDisplayTimeMs;
        const callbackIntervalMs = callbackTimeMs - previousFrame.callbackTimeMs;
        const frameIntervalMs = expectedDisplayIntervalMs > 0 ? expectedDisplayIntervalMs : callbackIntervalMs;
        const playbackRate = this.video.playbackRate();
        if (!Number.isFinite(frameIntervalMs) || frameIntervalMs <= 0 || !Number.isFinite(playbackRate)) return;

        return mediaTimeMs + frameIntervalMs * playbackRate;
    }

    private cancelScheduledUpdate(): void {
        if (this.frameHandle === undefined) return;
        this.video.cancelVideoFrameCallback(this.frameHandle);
        this.frameHandle = undefined;
    }

    private completePendingSeek(): void {
        this.pendingSeekCompletion?.resolve();
        this.pendingSeekCompletion = undefined;
    }

    private failPendingSeek(error: unknown): void {
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
