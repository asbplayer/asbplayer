import { asbError } from '@project/common/util/log';
import type { GlobalState, GlobalStateProvider } from '@project/common/global-state';
import { initialGlobalState } from '@project/common/global-state';
import type { GlobalStateUpdatedMessage } from '@project/common';
import type ChromeExtension from '@project/common/app/services/chrome-extension';

export class AppExtensionGlobalStateProvider implements GlobalStateProvider {
    private readonly _extension: ChromeExtension;
    private readonly _globalStateUpdatedCallbacks: ((state: Partial<GlobalState>) => void)[] = [];
    private _unsubscribeExtension?: () => void;

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
            asbError('app/state', e);
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

    onUpdated(callback: (state: Partial<GlobalState>) => void): () => void {
        if (this._extension.supportsGlobalState) {
            if (this._globalStateUpdatedCallbacks.length === 0) {
                this._unsubscribeExtension = this._extension.subscribe((message) => {
                    if (message.data.command === 'global-state-updated') {
                        const { state } = message.data as GlobalStateUpdatedMessage;
                        for (const c of this._globalStateUpdatedCallbacks) {
                            c(state);
                        }
                    }
                });
            }
            this._globalStateUpdatedCallbacks.push(callback);
            return () => this._unsubscribeCallback(callback);
        }

        // Fallback for extensions without global state support: global state lives
        // in localStorage, so rely on cross-tab 'storage' events.
        const storageListener = (event: StorageEvent) => {
            if (event.storageArea !== localStorage || event.key === null) {
                return;
            }

            const key = event.key as keyof GlobalState;

            if (!(key in initialGlobalState)) {
                return;
            }

            try {
                const value = event.newValue === null ? initialGlobalState[key] : JSON.parse(event.newValue);
                callback({ [key]: value });
            } catch (e) {
                asbError('app/state', e);
            }
        };
        window.addEventListener('storage', storageListener);
        return () => window.removeEventListener('storage', storageListener);
    }

    _unsubscribeCallback(callback: (state: Partial<GlobalState>) => void) {
        for (let i = this._globalStateUpdatedCallbacks.length - 1; i >= 0; --i) {
            if (callback === this._globalStateUpdatedCallbacks[i]) {
                this._globalStateUpdatedCallbacks.splice(i, 1);
                break;
            }
        }

        if (this._globalStateUpdatedCallbacks.length === 0) {
            this._unsubscribeExtension?.();
            this._unsubscribeExtension = undefined;
        }
    }
}
