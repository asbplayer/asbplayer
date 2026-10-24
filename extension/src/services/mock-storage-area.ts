import type { StorageArea } from '@project/extension/src/services/extension-settings-storage';

type OnChangedListener = (
    changes: { [key: string]: Browser.storage.StorageChange },
    areaName: Browser.storage.AreaName
) => void;

export class MockStorageArea implements StorageArea {
    private _values: { [key: string]: any } = {};
    private readonly _onChangedListeners: OnChangedListener[] = [];

    readonly onChanged: Browser.events.Event<OnChangedListener> = {
        addListener: (listener) => this._onChangedListeners.push(listener),
        removeListener: (listener) => {
            const index = this._onChangedListeners.indexOf(listener);

            if (index >= 0) {
                this._onChangedListeners.splice(index, 1);
            }
        },
        hasListener: (listener) => this._onChangedListeners.indexOf(listener) >= 0,
        hasListeners: () => this._onChangedListeners.length > 0,
        getRules: (
            ruleIdentifiersOrCallback: string[] | ((rules: Browser.events.Rule[]) => void),
            callback?: (rules: Browser.events.Rule[]) => void
        ) => {
            const cb = typeof ruleIdentifiersOrCallback === 'function' ? ruleIdentifiersOrCallback : callback!;
            cb([]);
        },
        addRules: () => {},
        removeRules: () => {},
    };

    async set(items: { [key: string]: any }): Promise<void> {
        const changes: { [key: string]: Browser.storage.StorageChange } = {};

        for (const [key, value] of Object.entries(items)) {
            const oldValue = this._values[key];

            if (oldValue !== value) {
                changes[key] = { oldValue, newValue: value };
                this._values[key] = value;
            }
        }

        this._notify(changes);
    }

    async remove(keys: string | string[]): Promise<void> {
        const changes: { [key: string]: Browser.storage.StorageChange } = {};

        if (typeof keys === 'string') {
            const oldValue = this._values[keys];

            if (oldValue !== undefined) {
                changes[keys] = { oldValue };
                delete this._values[keys];
            }
        } else {
            for (const key of keys) {
                const oldValue = this._values[key];

                if (oldValue !== undefined) {
                    changes[key] = { oldValue };
                    delete this._values[key];
                }
            }
        }

        this._notify(changes);
    }

    async get(keys?: string | string[] | { [key: string]: any } | null): Promise<{ [key: string]: any }> {
        if (keys === undefined || keys === null) {
            return this._values;
        }

        if (typeof keys === 'string') {
            return { [keys]: this._values[keys] };
        }

        const values: { [key: string]: any } = {};

        if (Array.isArray(keys)) {
            for (const key of keys) {
                if (this._values[key] !== undefined) {
                    values[key] = this._values[key];
                }
            }
        } else {
            for (const [key, value] of Object.entries(keys)) {
                values[key] = this._values[key] ?? value;
            }
        }

        return values;
    }

    async clear() {
        const changes: { [key: string]: Browser.storage.StorageChange } = {};

        for (const [key, value] of Object.entries(this._values)) {
            changes[key] = { oldValue: value };
        }

        this._values = {};
        this._notify(changes);
    }

    private _notify(changes: { [key: string]: Browser.storage.StorageChange }) {
        if (Object.keys(changes).length === 0) {
            return;
        }

        for (const listener of [...this._onChangedListeners]) {
            listener(changes, 'local');
        }
    }
}
