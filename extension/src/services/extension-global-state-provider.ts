import type { GlobalState, GlobalStateProvider } from '@project/common/global-state';
import { initialGlobalState } from '@project/common/global-state';
import type { StorageArea } from '@project/extension/src/services/extension-settings-storage';

export class ExtensionGlobalStateProvider implements GlobalStateProvider {
    private readonly _storage;
    private readonly _locks: LockManager;
    private readonly _listeners: ((state: Partial<GlobalState>) => void)[] = [];

    constructor(storage?: StorageArea, locks?: LockManager) {
        this._storage = storage ?? browser.storage.local;
        this._locks = locks ?? navigator.locks;
    }

    async getAll() {
        return (await this._storage.get(initialGlobalState)) as GlobalState;
    }

    async get<K extends keyof GlobalState>(keys: K[]) {
        const partialInitialGlobalState: Partial<GlobalState> = {};

        for (const key of keys) {
            partialInitialGlobalState[key] = initialGlobalState[key];
        }

        return (await this._storage.get(partialInitialGlobalState)) as Pick<GlobalState, K>;
    }

    async set(state: Partial<GlobalState>) {
        await this._storage.set(state);
    }

    onUpdated(callback: (state: Partial<GlobalState>) => void): () => void {
        const isFirstListener = this._listeners.length === 0;
        this._listeners.push(callback);
        if (isFirstListener) {
            this._storage.onChanged.addListener(this._publishChanges);
        }
        return () => {
            for (let i = this._listeners.length - 1; i >= 0; --i) {
                if (callback === this._listeners[i]) {
                    this._listeners.splice(i, 1);
                    break;
                }
            }
            if (this._listeners.length === 0) {
                this._storage.onChanged.removeListener(this._publishChanges);
            }
        };
    }

    /**
     * Exclusive read-modify-write of a global state key. Throws when the lock is already held
     * (including re-entrant requests from the same context, which fail rather than deadlock).
     *
     * The lock only excludes writers that also go through this method; writes made directly
     * via set() bypass it.
     */
    async updateWithLocking<K extends keyof GlobalState>(
        key: K,
        mutate: (state: GlobalState[K]) => boolean
    ): Promise<void> {
        await this._locks.request(`asbplayer-global-state:${key}`, { ifAvailable: true }, async (lock) => {
            if (lock === null) {
                throw new Error(`Concurrent update when writing key ${key}`);
            }
            // Clone before mutating: get() may return the module-level initial state object
            // by reference, which must never be modified in place.
            const state = JSON.parse(JSON.stringify((await this.get([key]))[key]));
            if (mutate(state)) {
                await this.set({ [key]: state });
            }
        });
    }

    private readonly _publishChanges = (changes: { [key: string]: Browser.storage.StorageChange }) => {
        const state: Partial<GlobalState> = {};

        for (const key of Object.keys(changes)) {
            if (!(key in initialGlobalState)) {
                continue;
            }

            const stateKey = key as keyof GlobalState;
            // A missing newValue means the key was removed; get() would fall back to the default.
            state[stateKey] = (
                changes[key].newValue !== undefined ? changes[key].newValue : initialGlobalState[stateKey]
            ) as any;
        }

        if (Object.keys(state).length === 0) {
            return;
        }

        for (const listener of [...this._listeners]) {
            listener({ ...state });
        }
    };
}
