export default class OffscreenDomCache {
    private offscreenElement?: HTMLElement;
    private _cachedContentElements: { [key: string]: HTMLElement } = {};
    private _empty = true;

    constructor() {}

    public get empty() {
        return this._empty;
    }

    clear() {
        this.offscreenElement?.remove();
        this.offscreenElement = undefined;
        this._cachedContentElements = {};
        this._empty = true;
    }

    has(key: string) {
        return this._cachedContentElements[key] !== undefined;
    }

    keys() {
        return Object.keys(this._cachedContentElements);
    }

    add(key: string, html: string) {
        let cached = this._cachedContentElements[key];
        if (!cached) {
            cached = document.createElement('div');
            this._cachedContentElements[key] = cached;
            this._offscreenElement().appendChild(cached);
        }
        cached.innerHTML = `${html}\n`;
        this._empty = false;
    }

    delete(key: string) {
        const cached = this._cachedContentElements[key];
        if (cached) {
            cached.remove();
            delete this._cachedContentElements[key];
            if (Object.keys(this._cachedContentElements).length === 0) {
                this.clear();
            }
        }
    }

    return(element: HTMLElement) {
        this._offscreenElement().appendChild(element);
    }

    get(key: string, html?: () => string) {
        let cached = this._cachedContentElements[key];

        if (!cached) {
            if (html === undefined) {
                throw new Error(`Cached html not found for key ${key}`);
            }

            cached = document.createElement('div');
            cached.innerHTML = html();
            this._cachedContentElements[key] = cached;
            this._offscreenElement().appendChild(cached);
        }

        return cached;
    }

    private _offscreenElement() {
        if (this.offscreenElement) {
            return this.offscreenElement;
        }

        const element = document.createElement('div');
        element.className = 'asbplayer-offscreen';
        document.body.append(element);
        this.offscreenElement = element;
        return element;
    }
}
