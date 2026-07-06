export class CachedLocalStorage {
    private _cache: { [key: string]: string | null } = {};

    get(key: string): string | null {
        const cached = this._cache[key];

        if (cached === undefined) {
            const fromStorage = localStorage.getItem(key);
            this._cache[key] = fromStorage;
            return fromStorage;
        }

        return cached;
    }

    set(key: string, value: string) {
        localStorage.setItem(key, value);
        this._cache[key] = value;
    }

    delete(key: string) {
        delete this._cache[key];
        localStorage.removeItem(key);
    }

    bustCache() {
        this._cache = {};
    }
}
