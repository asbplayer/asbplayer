export type ClockEvent = 'stop' | 'start' | 'settime' | 'rate';

export type ClockNow = () => number;

/** A monotonic, millisecond-based media clock for playback without a media element. */
export default class Clock {
    private accumulatedMs = 0;
    private started = false;
    private startedAtMs?: number;
    private playbackRate = 1;
    private readonly now: ClockNow;
    private readonly callbacks: { [event in ClockEvent]: (() => void)[] } = {
        stop: [],
        start: [],
        settime: [],
        rate: [],
    };

    constructor(now: ClockNow = () => performance.now()) {
        this.now = now;
    }

    get running(): boolean {
        return this.started;
    }

    get rate(): number {
        return this.playbackRate;
    }

    set rate(rate: number) {
        if (rate === this.playbackRate) return;
        if (this.started) {
            this.accumulatedMs += this.elapsedMs();
            this.startedAtMs = this.now();
        }
        this.playbackRate = rate;
        this.fireEvent('rate');
    }

    time(maxMs = Number.POSITIVE_INFINITY): number {
        const currentTimeMs = this.started ? this.accumulatedMs + this.elapsedMs() : this.accumulatedMs;
        return Math.min(maxMs, currentTimeMs);
    }

    stop(): void {
        if (!this.started) return;
        this.accumulatedMs += this.elapsedMs();
        this.started = false;
        this.startedAtMs = undefined;
        this.fireEvent('stop');
    }

    start(): void {
        if (this.started) return;
        this.startedAtMs = this.now();
        this.started = true;
        this.fireEvent('start');
    }

    setTime(timeMs: number): void {
        this.accumulatedMs = timeMs;
        if (this.started) this.startedAtMs = this.now();
        this.fireEvent('settime');
    }

    progress(durationMs: number): number {
        return durationMs === 0 ? 0 : Math.min(1, this.time(durationMs) / durationMs);
    }

    onEvent(eventName: ClockEvent, callback: () => void): () => void {
        this.callbacks[eventName].push(callback);
        return () => this.remove(callback, this.callbacks[eventName]);
    }

    removeEvent(eventName: ClockEvent, callback: () => void): void {
        this.remove(callback, this.callbacks[eventName]);
    }

    private elapsedMs(): number {
        return (this.now() - this.startedAtMs!) * this.playbackRate;
    }

    private fireEvent(eventName: ClockEvent): void {
        for (const callback of [...this.callbacks[eventName]]) callback();
    }

    private remove(callback: () => void, callbacks: (() => void)[]): void {
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
    }
}
