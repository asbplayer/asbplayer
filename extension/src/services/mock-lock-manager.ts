interface WaitingRequest {
    callback: (lock: Lock | null) => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: unknown) => void;
}

/**
 * In-memory stand-in for `navigator.locks` that honors `ifAvailable`, queues blocking
 * requests in order, and records requested lock names. Locks are granted synchronously,
 * which keeps tests deterministic.
 */
export class MockLockManager implements LockManager {
    private readonly _held = new Set<string>();
    private readonly _waiting = new Map<string, WaitingRequest[]>();
    readonly requestedNames: string[] = [];

    async request(
        name: string,
        optionsOrCallback: LockOptions | ((lock: Lock | null) => Promise<any>),
        callback?: (lock: Lock | null) => Promise<any>
    ): Promise<any> {
        const grantedCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback!;
        this.requestedNames.push(name);

        if (typeof optionsOrCallback !== 'function' && optionsOrCallback.ifAvailable && this._held.has(name)) {
            return grantedCallback(null);
        }

        if (!this._held.has(name)) {
            return this._run(name, grantedCallback);
        }

        return new Promise((resolve, reject) => {
            const waiting = this._waiting.get(name) ?? [];
            waiting.push({ callback: grantedCallback, resolve, reject });
            this._waiting.set(name, waiting);
        });
    }

    hold(name: string) {
        this._held.add(name);
    }

    releaseHeld(name: string) {
        this._release(name);
    }

    query(): Promise<{ held: LockInfo[]; waiting: LockInfo[] }> {
        return Promise.resolve({
            held: [...this._held].map((name) => ({ name, mode: 'exclusive' })),
            waiting: [...this._waiting.entries()].flatMap(([name, requests]) =>
                requests.map(() => ({ name, mode: 'exclusive' }))
            ),
        });
    }

    private async _run(name: string, callback: (lock: Lock | null) => Promise<any>): Promise<any> {
        this._held.add(name);

        try {
            return await callback({ name, mode: 'exclusive' });
        } finally {
            this._release(name);
        }
    }

    private _release(name: string) {
        this._held.delete(name);

        const waiting = this._waiting.get(name);
        const next = waiting?.shift();

        if (waiting !== undefined && waiting.length === 0) {
            this._waiting.delete(name);
        }

        if (next !== undefined) {
            void this._run(name, next.callback).then(next.resolve, next.reject);
        }
    }
}
