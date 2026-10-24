import type { GlobalState, GlobalStateProvider } from '@project/common/global-state';
import { initialGlobalState } from '@project/common/global-state';
import type { StorageArea } from '@project/extension/src/services/extension-settings-storage';

export class ExtensionGlobalStateProvider implements GlobalStateProvider {
    private readonly _storage;
    private readonly _listeners: ((state: Partial<GlobalState>) => void)[] = [];

    constructor(storage?: StorageArea) {
        this._storage = storage ?? browser.storage.local;
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
