import TimingUpdateQueue, {
    type TimingDriver,
    type TimingDriverCallbacks,
} from '@project/common/playback/timing-driver';

export interface AnimationFrameTimingSource {
    readonly paused: () => boolean;
    readonly durationMs: () => number;
    readonly currentTimeMs: () => number;
    requestAnimationFrameCallback(callback: FrameRequestCallback): number;
    cancelAnimationFrameCallback(handle: number): void;
    addEventListener(type: 'play' | 'pause' | 'seeked' | 'timeupdate', listener: () => void): void;
    removeEventListener(type: 'play' | 'pause' | 'seeked' | 'timeupdate', listener: () => void): void;
}

/** Feeds synthetic media timestamps to a playback timeline on animation frames. */
export default class AnimationFrameTimingDriver implements TimingDriver {
    private readonly clock: AnimationFrameTimingSource;
    private callbacks: TimingDriverCallbacks;
    private _bound = false;
    private frameHandle?: number;
    private discontinuityPending = false;
    private expectedInternalSeek = false;
    private timeUpdatesBound = false;
    private readonly updates: TimingUpdateQueue;

    constructor(clock: AnimationFrameTimingSource) {
        this.clock = clock;
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
            () => this._bound && !this.clock.paused()
        );
    }

    setCallbacks(callbacks: TimingDriverCallbacks): void {
        this.callbacks = callbacks;
    }

    beginInternalSeek(): Promise<void> {
        this.expectedInternalSeek = true;
        return Promise.resolve();
    }

    cancelExpectedInternalSeek(): void {
        this.expectedInternalSeek = false;
    }

    currentTimeMs(): number {
        return this.clock.currentTimeMs();
    }

    durationMs(): number {
        return this.clock.durationMs();
    }

    paused(): boolean {
        return this.clock.paused();
    }

    bind(): void {
        if (this._bound) return;
        this._bound = true;
        this.clock.addEventListener('play', this.onStart);
        this.clock.addEventListener('pause', this.onStop);
        this.clock.addEventListener('seeked', this.onSetTime);
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
        this.clock.removeEventListener('play', this.onStart);
        this.clock.removeEventListener('pause', this.onStop);
        this.clock.removeEventListener('seeked', this.onSetTime);
        if (this.timeUpdatesBound) this.clock.removeEventListener('timeupdate', this.onTimeUpdate);
        this.timeUpdatesBound = false;
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        this.cancelScheduledUpdate();
        this.updates.clear({ preserveExpectedDiscontinuity: false });
        this.discontinuityPending = false;
        this.expectedInternalSeek = false;
    }

    private reset(): void {
        this.discontinuityPending = false;
        this.updates.enqueueDiscontinuity(this.clock.currentTimeMs());
    }

    private readonly onStart = () => {
        this.updates.enqueuePlaybackStarted();
        this.reset();
        this.schedule();
    };

    private readonly onStop = () => {
        this.updates.clear({ preserveExpectedDiscontinuity: false });
        if (!this.discontinuityPending) this.cancelScheduledUpdate();
    };

    private readonly onSetTime = () => {
        const preserveExpectedDiscontinuity = this.expectedInternalSeek;
        this.expectedInternalSeek = false;
        this.updates.clear({ preserveExpectedDiscontinuity });
        this.discontinuityPending = true;
        this.schedule();
    };

    private readonly onTimeUpdate = () => {
        if (!this._bound) return;
        if (this.discontinuityPending) {
            this.reset();
            return;
        }
        if (this.clock.paused()) return;
        this.updates.enqueue(this.clock.currentTimeMs(), { lookaheadTimestampMs: undefined });
    };

    /**
     * Browsers will no longer fire rAF events when the document is hidden but continue playing audio.
     * To work around this, we listen for 'timeupdate' events while the document is hidden to keep the timing driver updated.
     */
    private readonly onVisibilityChange = () => {
        if (document.hidden) {
            this.cancelScheduledUpdate();
            if (this.timeUpdatesBound) return;
            this.clock.addEventListener('timeupdate', this.onTimeUpdate);
            this.timeUpdatesBound = true;
            return;
        }
        if (this.timeUpdatesBound) {
            this.clock.removeEventListener('timeupdate', this.onTimeUpdate);
            this.timeUpdatesBound = false;
        }
        this.schedule();
    };

    private schedule(): void {
        if (!this._bound) return;
        if (document.hidden) return; // Browser will not fire rAF events when hidden, see onVisibilityChange
        if (this.clock.paused() && !this.discontinuityPending) return;
        if (this.frameHandle !== undefined) return;

        this.frameHandle = this.clock.requestAnimationFrameCallback(() => {
            this.frameHandle = undefined;
            if (this.discontinuityPending) {
                this.reset();
            } else if (!this.clock.paused()) {
                this.updates.enqueue(this.clock.currentTimeMs(), { lookaheadTimestampMs: undefined });
            }
            this.schedule();
        });
    }

    private cancelScheduledUpdate(): void {
        if (this.frameHandle === undefined) return;
        this.clock.cancelAnimationFrameCallback(this.frameHandle);
        this.frameHandle = undefined;
    }
}
