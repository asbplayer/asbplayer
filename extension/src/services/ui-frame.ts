import { isFirefoxBuild } from './build-flags';
import FrameBridgeClient, { FetchOptions } from './frame-bridge-client';
import { frameColorScheme } from './frame-color-scheme';

export const uiFrameForHtml = (html: (lang: string) => Promise<string>) => {
    return new UiFrame(async (frame: HTMLIFrameElement, lang: string) => {
        if (isFirefoxBuild) {
            // Firefox does not allow document.write() into the about:blank iframe.
            // CSP headers are modified using the webRequest API to allow extension scripts to
            // be loaded.
            frame.srcdoc = await html(lang);
        } else {
            // On Chromium, use document.write() since it allows the loading of extension scripts
            // into the iframe without additional work.
            const doc = frame.contentDocument!;
            doc.open();
            doc.write(await html(lang));
            doc.close();
        }
    });
};

export const uiFrameForSrc = (src: string) => {
    return new UiFrame(async (frame: HTMLIFrameElement, _: string) => {
        frame.src = src;
    });
};

type FrameInitializer = (frame: HTMLIFrameElement, lang: string) => Promise<void>;

export default class UiFrame {
    private readonly _frameInitializer: FrameInitializer;
    private _fetchOptions: FetchOptions | undefined;
    private _client: FrameBridgeClient | undefined;
    private _frame: HTMLIFrameElement | undefined;
    private _language: string = 'en';
    private _dirty = true;
    private _bound = false;

    constructor(frameInitializer: FrameInitializer) {
        this._frameInitializer = frameInitializer;
    }

    set fetchOptions(fetchOptions: FetchOptions) {
        this._dirty =
            this._dirty ||
            this._fetchOptions?.allowedFetchUrl !== fetchOptions.allowedFetchUrl ||
            this._fetchOptions?.videoSrc !== fetchOptions.videoSrc;
        this._fetchOptions = fetchOptions;
    }

    set language(language: string) {
        this._dirty = this._dirty || this._language !== language;
        this._language = language;
    }

    get hidden() {
        return this._frame === undefined || this._frame.classList.contains('asbplayer-hide');
    }

    get bound() {
        return this._bound;
    }

    get frame() {
        return this._frame;
    }

    get clientIfLoaded() {
        return this._client;
    }

    async bind(): Promise<boolean> {
        return await this._init();
    }

    async client() {
        await this._init();
        return this._client!;
    }

    private async _init() {
        if (!this._dirty) {
            return false;
        }

        this._dirty = false;
        this._bound = true;
        this._client?.unbind();
        this._frame?.remove();

        this._frame = document.createElement('iframe');
        this._frame.className = 'asbplayer-ui-frame';

        this._frame.style.colorScheme = frameColorScheme();
        this._frame.setAttribute('allowtransparency', 'true');

        this._client = new FrameBridgeClient(this._frame, this._fetchOptions);
        document.body.appendChild(this._frame);

        await this._frameInitializer(this._frame, this._language);
        await this._client!.bind();
        return true;
    }

    show() {
        this._frame?.classList.remove('asbplayer-hide');
    }

    hide() {
        this._frame?.classList.add('asbplayer-hide');
        this._frame?.blur();
    }

    unbind() {
        this._dirty = true;
        this._client?.unbind();
        this._frame?.remove();
    }
}
