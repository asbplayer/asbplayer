export type ClockEvent = 'stop' | 'start' | 'settime' | 'timeupdate';

const TIMEUPDATE_INTERVAL_MS = 100;

/** A monotonic millisecond-based media clock for playback without a media element. */
export default class Clock {
    private accumulatedMs = 0;
    private started = false;
    private startedAtMs = 0;
    private playbackRate = 1;
    private readonly now: () => number;
    private timeUpdateHandle: ReturnType<typeof setInterval> | undefined;
    private readonly callbacks: { [event in ClockEvent]: (() => void)[] } = {
        stop: [],
        start: [],
        settime: [],
        timeupdate: [],
    };

    constructor(now: () => number) {
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
    }

    time(maxMs: number): number {
        const currentTimeMs = this.started ? this.accumulatedMs + this.elapsedMs() : this.accumulatedMs;
        return Math.min(maxMs, currentTimeMs);
    }

    stop(): void {
        if (!this.started) return;
        this.accumulatedMs += this.elapsedMs();
        this.started = false;
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
        return durationMs ? Math.min(1, this.time(durationMs) / durationMs) : 0;
    }

    onEvent(eventName: ClockEvent, callback: () => void): () => void {
        this.callbacks[eventName].push(callback);
        if (eventName === 'timeupdate' && this.timeUpdateHandle === undefined) {
            this.timeUpdateHandle = setInterval(() => this.fireEvent('timeupdate'), TIMEUPDATE_INTERVAL_MS);
        }
        return () => this.removeEvent(eventName, callback);
    }

    removeEvent(eventName: ClockEvent, callback: () => void): void {
        const callbacks = this.callbacks[eventName];
        this.remove(callback, callbacks);
        if (eventName === 'timeupdate' && callbacks.length === 0 && this.timeUpdateHandle !== undefined) {
            clearInterval(this.timeUpdateHandle);
            this.timeUpdateHandle = undefined;
        }
    }

    private elapsedMs(): number {
        return (this.now() - this.startedAtMs) * this.playbackRate;
    }

    private fireEvent(eventName: ClockEvent): void {
        for (const callback of [...this.callbacks[eventName]]) callback();
    }

    private remove(callback: () => void, callbacks: (() => void)[]): void {
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
    }
}
