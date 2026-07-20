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
    requestVideoFrameCallback(callback: VideoFrameRequestCallback): number;
    cancelVideoFrameCallback(handle: number): void;
    addEventListener(
        type: 'play' | 'pause' | 'seeking' | 'seeked' | 'ratechange' | 'durationchange' | 'error',
        listener: EventListener
    ): void;
    removeEventListener(
        type: 'play' | 'pause' | 'seeking' | 'seeked' | 'ratechange' | 'durationchange' | 'error',
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
    private frameHandle?: number;
    private previousFrame?: {
        readonly expectedDisplayTimeMs: number;
        readonly callbackTimeMs: number;
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
                onTime: async (timestampMs, lookaheadTimestampMs) => {
                    await this.callbacks.onTime(timestampMs, lookaheadTimestampMs);
                },
                onPlaybackStarted: async () => {
                    await this.callbacks.onPlaybackStarted();
                },
                onDiscontinuity: (timestampMs) => this.callbacks.onDiscontinuity(timestampMs),
                onCancel: () => this.callbacks.onCancel(),
                onError: (error) => this.callbacks.onError(error),
            },
            () => this._bound && !this.seeking && !this.video.paused()
        );
    }

    setCallbacks(callbacks: TimingDriverCallbacks): void {
        this.callbacks = callbacks;
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
        this.video.addEventListener('seeking', this.onSeeking);
        this.video.addEventListener('seeked', this.onSeeked);
        this.video.addEventListener('ratechange', this.onRateChange);
        this.video.addEventListener('durationchange', this.onDurationChange);
        this.video.addEventListener('error', this.onError);
        this.reset();
        this.schedule();
    }

    get bound(): boolean {
        return this._bound;
    }

    unbind(): void {
        if (!this._bound) return;
        this._bound = false;
        this.video.removeEventListener('play', this.onPlay);
        this.video.removeEventListener('pause', this.onPause);
        this.video.removeEventListener('seeking', this.onSeeking);
        this.video.removeEventListener('seeked', this.onSeeked);
        this.video.removeEventListener('ratechange', this.onRateChange);
        this.video.removeEventListener('durationchange', this.onDurationChange);
        this.video.removeEventListener('error', this.onError);
        this.cancelScheduledUpdate();
        this.updates.clear();
        this.previousFrame = undefined;
    }

    private reset(): void {
        this.updates.enqueueDiscontinuity(this.currentTimeMs());
    }

    private readonly onPlay = () => {
        void this.callbacks.onPlaybackStarted().catch((error) => this.callbacks.onError(error));
        this.schedule();
        this.eventCallbacks.onPlay();
    };

    private readonly onPause = () => {
        this.cancelScheduledUpdate();
        this.updates.clear();
        this.previousFrame = undefined;
        this.eventCallbacks.onPause();
    };

    private readonly onSeeking = () => {
        this.seeking = true;
        this.cancelScheduledUpdate();
        this.updates.clear();
        this.previousFrame = undefined;
    };

    private readonly onSeeked = () => {
        this.seeking = false;
        this.previousFrame = undefined;
        const timestampMs = this.currentTimeMs();
        this.updates.enqueueDiscontinuity(timestampMs); // rVFC may not run during pause
        this.schedule();
        this.eventCallbacks.onSeeked(timestampMs);
    };

    private readonly onRateChange = () => {
        this.eventCallbacks.onPlaybackRateChanged(this.video.playbackRate());
    };

    private readonly onDurationChange = () => {
        this.eventCallbacks.onDurationChanged(this.video.durationMs());
    };

    private readonly onTimeUpdate = (timestampMs: number) => {
        this.eventCallbacks.onTimeUpdate(timestampMs);
    };

    private readonly onError = () => {
        this.eventCallbacks.onError();
    };

    private schedule(): void {
        if (!this._bound) return;
        if (this.seeking || this.video.paused()) return;
        if (this.frameHandle !== undefined) return;

        this.frameHandle = this.video.requestVideoFrameCallback((now, metadata) => {
            this.frameHandle = undefined;
            const timestampMs = this.video.frameTimestampMs(now, metadata) ?? metadata.mediaTime * 1000;
            const lookaheadTimestampMs = this.nextFrameTimestampMs(timestampMs, metadata.expectedDisplayTime, now);
            this.previousFrame = {
                expectedDisplayTimeMs: metadata.expectedDisplayTime,
                callbackTimeMs: now,
            };
            this.updates.enqueue(timestampMs, lookaheadTimestampMs);
            this.schedule();
            this.onTimeUpdate(timestampMs);
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
}
