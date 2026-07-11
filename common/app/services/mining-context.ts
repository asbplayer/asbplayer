type MiningEvent = 'started-mining' | 'stopped-mining';
type Callback = () => void;

export class MiningContext {
    private readonly _callbacks: { [event in MiningEvent]: Callback[] } = {
        'started-mining': [],
        'stopped-mining': [],
    };
    private _mining = false;

    get mining() {
        return this._mining;
    }

    onEvent(event: MiningEvent, callback: Callback) {
        this._callbacks[event].push(callback);
        return () => this._remove(callback, this._callbacks[event]);
    }

    started() {
        this._mining = true;
        this._callbacks['started-mining'].forEach((c) => c());
    }

    stopped() {
        this._mining = false;
        this._callbacks['stopped-mining'].forEach((c) => c());
    }

    private _remove(callback: Callback, callbacks: Callback[]) {
        for (let i = callbacks.length - 1; i >= 0; --i) {
            if (callback === callbacks[i]) {
                callbacks.splice(i, 1);
                break;
            }
        }
    }
}
