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
    onTimeUpdate(timestampMs: number): void;
    onError(): void;
}

export interface TimingDriver {
    bind(): void;
    readonly bound: boolean;
    unbind(): void;
    setCallbacks(callbacks: TimingDriverCallbacks): void;
    expectInternalSeek(): void;
    waitForSeeked(): Promise<void>;
    cancelExpectedInternalSeek(): void;
    currentTimeMs(): number;
    durationMs(): number;
    paused(): boolean;
}

type TimingUpdate = {
    readonly timestampMs: number;
    readonly options: { lookaheadTimestampMs?: number };
};

/** Serializes timing updates while coalescing queued samples to the latest media timestamp. */
export default class TimingUpdateQueue {
    private readonly callbacks: TimingDriverCallbacks;
    private readonly active: () => boolean;
    private processing = false;
    private queuedUpdate?: TimingUpdate;
    private queuedDiscontinuity?: number;
    private generation = 0;

    constructor(callbacks: TimingDriverCallbacks, active: () => boolean) {
        this.callbacks = callbacks;
        this.active = active;
    }

    clear(options: { preserveExpectedDiscontinuity: boolean }): void {
        this.generation++;
        this.queuedUpdate = undefined;
        this.queuedDiscontinuity = undefined;
        this.callbacks.onCancel(options);
    }

    enqueueDiscontinuity(timestampMs: number): void {
        this.queuedUpdate = undefined;
        this.queuedDiscontinuity = timestampMs;
        this.process();
    }

    enqueue(timestampMs: number, options: { lookaheadTimestampMs?: number }): void {
        if (!this.active()) return;
        this.queuedUpdate = { timestampMs, options };
        if (this.processing) return;
        this.process();
    }

    private process(): void {
        if (this.processing) return;

        this.processing = true;
        void (async () => {
            try {
                while (this.queuedDiscontinuity !== undefined || (this.active() && this.queuedUpdate !== undefined)) {
                    if (this.queuedDiscontinuity !== undefined) {
                        const timestampMs = this.queuedDiscontinuity;
                        this.queuedDiscontinuity = undefined;
                        this.callbacks.onDiscontinuity(timestampMs);
                        continue;
                    }

                    const update = this.queuedUpdate;
                    this.queuedUpdate = undefined;
                    const generation = this.generation;
                    await this.callbacks.onTime(update!.timestampMs, update!.options);
                    if (generation !== this.generation) continue;
                }
            } catch (error) {
                this.callbacks.onError(error);
            } finally {
                this.processing = false;
                if (this.queuedDiscontinuity !== undefined || (this.active() && this.queuedUpdate !== undefined)) {
                    this.process();
                }
            }
        })();
    }
}
