import type { GlobalState, GlobalStateProvider } from '@project/common/global-state';
import { initialGlobalState } from '@project/common/global-state';
import type { StorageArea } from '@project/extension/src/services/extension-settings-storage';

export class ExtensionGlobalStateProvider implements GlobalStateProvider {
    private readonly _storage;

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
}
