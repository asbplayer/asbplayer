/**
 * External readers such as JPDB Reader parse and modify cached subtitles before they are displayed.
 * Preserve unchanged nodes and external edits. Cached ruby must remain readable through innerText:
 * content-visibility: hidden makes those readings empty in Chrome.
 */
export default class OffscreenDomCache {
    private offscreenElement?: HTMLElement;
    private readonly _cachedContentElements = new Map<string, HTMLElement>();

    public get empty() {
        return this._cachedContentElements.size === 0;
    }

    clear() {
        this.offscreenElement?.remove();
        this.offscreenElement = undefined;
        this._cachedContentElements.clear();
    }

    has(key: string) {
        return this._cachedContentElements.has(key);
    }

    keys() {
        return [...this._cachedContentElements.keys()];
    }

    add(key: string, html: string) {
        let cached = this._cachedContentElements.get(key);
        if (!cached) {
            cached = document.createElement('div');
            this._cachedContentElements.set(key, cached);
            this._offscreenElement().appendChild(cached);
        }
        cached.innerHTML = `${html}\n`;
    }

    delete(key: string) {
        const cached = this._cachedContentElements.get(key);
        if (cached) {
            cached.remove();
            this._cachedContentElements.delete(key);
            if (this.empty) this.clear();
        }
    }

    return(element: HTMLElement) {
        this._offscreenElement().appendChild(element);
    }

    get(key: string, html?: () => string) {
        let cached = this._cachedContentElements.get(key);

        if (!cached) {
            if (html === undefined) {
                throw new Error(`Cached html not found for key ${key}`);
            }

            cached = document.createElement('div');
            cached.innerHTML = html();
            this._cachedContentElements.set(key, cached);
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
