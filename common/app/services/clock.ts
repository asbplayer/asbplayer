export type ClockEvent = 'stop' | 'start' | 'settime';

export default class Clock {
    private _accumulated: number;
    private _started: boolean;
    private _startTime?: number;
    private _rate = 1;
    private _callbacks: { [event in ClockEvent]: (() => void)[] } = { stop: [], start: [], settime: [] };

    constructor() {
        this._accumulated = 0;
        this._started = false;
    }

    get running() {
        return this._started;
    }

    get rate() {
        return this._rate;
    }

    set rate(rate: number) {
        if (this._started) {
            this._accumulated += this._elapsed();
            this._startTime = Date.now();
        }

        this._rate = rate;
    }

    time(max: number) {
        if (this._started) {
            return Math.min(max, this._accumulated + this._elapsed());
        }

        return Math.min(max, this._accumulated);
    }

    stop() {
        if (!this._started) {
            this._fireEvent('stop');
            return;
        }

        this._started = false;
        this._accumulated += this._elapsed();
        this._fireEvent('stop');
    }

    private _elapsed() {
        return (Date.now() - this._startTime!) * this._rate;
    }

    start() {
        this._startTime = Date.now();
        this._started = true;
        this._fireEvent('start');
    }

    setTime(time: number) {
        if (this._started) {
            this._startTime = Date.now();
            this._accumulated = time;
        } else {
            this._accumulated = time;
        }
        this._fireEvent('settime');
    }

    progress(max: number) {
        return max === 0 ? 0 : Math.min(1, this.time(max) / max);
    }

    onEvent(eventName: ClockEvent, callback: () => void) {
        this._callbacks[eventName].push(callback);
        return () => this._remove(callback, this._callbacks[eventName]);
    }

    private _fireEvent(eventName: ClockEvent) {
        for (const callback of this._callbacks[eventName]) {
            callback();
        }
    }

    _remove(callback: () => void, callbacks: (() => void)[]) {
        for (let i = callbacks.length - 1; i >= 0; --i) {
            if (callback === callbacks[i]) {
                callbacks.splice(i, 1);
                break;
            }
        }
    }
}
