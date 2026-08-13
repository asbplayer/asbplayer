import { StorageArea } from '@project/extension/src/services/extension-settings-storage';

export class MockStorageArea implements StorageArea {
    private _values: { [key: string]: any } = {};

    async set(items: { [key: string]: any }): Promise<void> {
        for (const [key, value] of Object.entries(items)) {
            this._values[key] = value;
        }
    }

    async remove(keys: string | string[]): Promise<void> {
        if (typeof keys === 'string') {
            delete this._values[keys];
        } else {
            for (const key of keys) {
                delete this._values[key];
            }
        }
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
        this._values = {};
    }
}
