export interface TimingDriverCallbacks {
    onTime(timestampMs: number, options: { lookaheadTimestampMs?: number }): Promise<void>;
    onPlaybackStarted(): Promise<void>;
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

export interface TimingDriver {
    bind(): void;
    readonly bound: boolean;
    /** True when a non-native owner supplies seeking lifecycle events. */
    readonly externalSeekEvents?: boolean;
    unbind(): void;
    setCallbacks(callbacks: TimingDriverCallbacks): void;
    beginInternalSeek(): Promise<void>;
    cancelExpectedInternalSeek(): void;
    externalSeekStarted?(): void;
    externalSeeked?(timestampMs: number): void;
    externalSeekCanceled?(): void;
    currentTimeMs(): number;
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

/** Serializes timing updates while coalescing queued samples to the latest media timestamp. */
export default class TimingUpdateQueue {
    private readonly callbacks: TimingUpdateCallbacks;
    private readonly active: () => boolean;
    private processing = false;
    private queuedUpdate?: TimingUpdate;
    private queuedDiscontinuity?: number;
    private queuedPlaybackStarted = false;
    private invalidTimestampReported = false;

    constructor(callbacks: TimingUpdateCallbacks, active: () => boolean) {
        this.callbacks = callbacks;
        this.active = active;
    }

    clear(options: { preserveExpectedDiscontinuity: boolean }): void {
        this.queuedUpdate = undefined;
        this.queuedDiscontinuity = undefined;
        this.queuedPlaybackStarted = false;
        this.callbacks.onCancel(options);
    }

    enqueuePlaybackStarted(): void {
        if (this.processing) {
            this.queuedPlaybackStarted = true;
            return;
        }
        void this.callbacks.onPlaybackStarted().catch((error) => this.callbacks.onError(error));
    }

    enqueueDiscontinuity(timestampMs: number): void {
        if (!this.acceptTimestamp(timestampMs)) return;
        this.queuedUpdate = undefined;
        this.queuedDiscontinuity = timestampMs;
        this.process();
    }

    enqueue(timestampMs: number, options: { lookaheadTimestampMs?: number }): void {
        if (!this.active()) return;
        if (!this.acceptTimestamp(timestampMs)) return;
        this.queuedUpdate = { timestampMs, options };
        if (this.processing) return;
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
                this.callbacks.onError(error);
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
            this.callbacks.onError(new Error(`Invalid playback timestamp: ${String(timestampMs)}`));
        }
        return false;
    }
}
