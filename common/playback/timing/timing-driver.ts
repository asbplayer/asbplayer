export interface TimingDriverCallbacks {
    onTime(timestampMs: number, options: { lookaheadTimestampMs?: number }): Promise<void>;
    onPlaybackStarted(): Promise<void>;
    onPlaybackPaused(): void;
    onDiscontinuity(timestampMs: number): void;
    onCancel(options: { preserveExpectedDiscontinuity: boolean }): void;
    onError(error: unknown): void;
}

export interface TimingDriverEventCallbacks {
    onPlay(): void;
    onPause(): void;
    onSeeked(timestampMs: number): void;
    onPlaybackRateChanged(playbackRate: number): void;
    onDurationChanged(durationMs: number): void;
    onError(): void;
}

export type InternalSeekCompletion = 'completed' | 'cancelled';

export interface TimingDriver {
    bind(): void;
    readonly bound: boolean;
    /** True when a non-native owner supplies seeking lifecycle events. */
    readonly externalSeekEvents?: boolean;
    unbind(): void;
    setCallbacks(callbacks: TimingDriverCallbacks): void;
    beginInternalSeek(): Promise<InternalSeekCompletion>;
    cancelExpectedInternalSeek(): void;
    externalSeekStarted?(): void;
    externalSeeked?(timestampMs: number): void;
    externalSeekCanceled?(): void;
    currentTimeMs(): number;
    frameTimeMs: () => number;
    playbackRate: () => number;
    durationMs(): number;
    paused(): boolean;
}

type TimingUpdate = {
    readonly timestampMs: number;
    readonly options: { lookaheadTimestampMs?: number };
};

type TimingUpdateCallbacks = Pick<
    TimingDriverCallbacks,
    'onTime' | 'onPlaybackStarted' | 'onDiscontinuity' | 'onCancel' | 'onError'
>;

interface TimingUpdateQueueOptions {
    active: () => boolean;
}

/** Serializes timing updates while coalescing queued samples to the latest media timestamp. */
export default class TimingUpdateQueue {
    private readonly callbacks: TimingUpdateCallbacks;
    private readonly active: () => boolean;
    private processing = false;
    private queuedUpdate?: TimingUpdate;
    private queuedDiscontinuity?: number;
    private queuedPlaybackStarted = false;
    private invalidTimestampReported = false;

    constructor({ active }: TimingUpdateQueueOptions, callbacks: TimingUpdateCallbacks) {
        this.active = active;
        this.callbacks = callbacks;
    }

    clear(options: { preserveExpectedDiscontinuity: boolean }): void {
        this.queuedUpdate = undefined;
        this.queuedDiscontinuity = undefined;
        this.queuedPlaybackStarted = false;
        this.callbacks.onCancel(options);
    }

    /**
     * Need to enqueue as starting playback can trigger async updates such as auto-pause/repeat actions.
     */
    enqueuePlaybackStarted(): void {
        this.queuedPlaybackStarted = true;
        this.process();
    }

    /**
     * Need to enqueue as discontinuities can occur asynchronously and must be processed in order.
     */
    enqueueDiscontinuity(timestampMs: number): void {
        if (!this.acceptTimestamp(timestampMs)) return;
        this.queuedUpdate = undefined;
        this.queuedDiscontinuity = timestampMs;
        this.process();
    }

    /**
     * Need to enqueue timing updates as they can occur asynchronously and must be processed in order.
     */
    enqueue(timestampMs: number, options: { lookaheadTimestampMs?: number }): void {
        if (!this.active()) return;
        if (!this.acceptTimestamp(timestampMs)) return;
        this.queuedUpdate = { timestampMs, options };
        this.process();
    }

    private shouldProcess(): boolean {
        return (
            this.queuedDiscontinuity !== undefined ||
            this.queuedPlaybackStarted ||
            (this.active() && this.queuedUpdate !== undefined)
        );
    }

    private process(): void {
        if (this.processing) return;

        this.processing = true;
        void (async () => {
            try {
                while (this.shouldProcess()) {
                    if (this.queuedDiscontinuity !== undefined) {
                        const timestampMs = this.queuedDiscontinuity;
                        this.queuedDiscontinuity = undefined;
                        this.callbacks.onDiscontinuity(timestampMs);
                        continue;
                    }
                    if (this.queuedPlaybackStarted) {
                        this.queuedPlaybackStarted = false;
                        await this.callbacks.onPlaybackStarted();
                        continue;
                    }
                    const update = this.queuedUpdate!;
                    this.queuedUpdate = undefined;
                    await this.callbacks.onTime(update.timestampMs, update.options);
                }
            } catch (error) {
                this.reportError(error);
            } finally {
                this.processing = false;
                if (this.shouldProcess()) this.process();
            }
        })();
    }

    private acceptTimestamp(timestampMs: number): boolean {
        if (Number.isFinite(timestampMs)) {
            this.invalidTimestampReported = false;
            return true;
        }
        if (!this.invalidTimestampReported) {
            this.invalidTimestampReported = true;
            this.reportError(new Error(`Invalid playback timestamp: ${String(timestampMs)}`));
        }
        return false;
    }

    private reportError(error: unknown): void {
        try {
            this.callbacks.onError(error);
        } catch (callbackError) {
            console.error('[asbplayer/playback] Timing update error handler failed', { error, callbackError });
        }
    }
}
