import { asbError } from '@project/common/util';
import { GlobalState, GlobalStateProvider, initialGlobalState } from '@project/common/global-state';
import ChromeExtension from '@project/common/app/services/chrome-extension';

export class AppExtensionGlobalStateProvider implements GlobalStateProvider {
    private readonly _extension: ChromeExtension;

    constructor(extension: ChromeExtension) {
        this._extension = extension;
    }

    async getAll() {
        if (this._extension.supportsGlobalState) {
            return this._extension.getGlobalState();
        }

        return this._getFromLocalStorage(Object.keys(initialGlobalState) as (keyof GlobalState)[]);
    }

    async get<K extends keyof GlobalState>(keys: K[]) {
        if (this._extension.supportsGlobalState) {
            return this._extension.getSomeGlobalState(keys);
        }

        return this._getFromLocalStorage(keys);
    }

    private _getFromLocalStorage(keys: (keyof GlobalState)[]) {
        try {
            const partialState: any = {};

            for (const key of keys) {
                const val = localStorage.getItem(key);
                partialState[key] = val === null ? initialGlobalState[key] : JSON.parse(val);
            }

            return partialState;
        } catch (e) {
            asbError({ asbLogLabel: 'app/state' }, e);
            return Object.fromEntries(keys.map((k) => [k, initialGlobalState[k]]));
        }
    }

    async set(state: Partial<GlobalState>) {
        if (this._extension.supportsGlobalState) {
            return this._extension.setGlobalState(state);
        }

        for (const key of Object.keys(state)) {
            localStorage.setItem(key, JSON.stringify(state[key as keyof GlobalState]));
        }
    }
}
