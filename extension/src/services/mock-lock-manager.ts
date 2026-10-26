/**
 * In-memory stand-in for `navigator.locks` that honors `ifAvailable` and records
 * requested lock names. Locks are granted synchronously, which keeps tests deterministic.
 */
export class MockLockManager implements LockManager {
    private readonly _held = new Set<string>();
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

        this._held.add(name);
        try {
            return await grantedCallback({ name, mode: 'exclusive' });
        } finally {
            this._held.delete(name);
        }
    }

    hold(name: string) {
        this._held.add(name);
    }

    query(): Promise<{ held: LockInfo[]; waiting: LockInfo[] }> {
        return Promise.resolve({ held: [...this._held].map((name) => ({ name, mode: 'exclusive' })), waiting: [] });
    }
}
