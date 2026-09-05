import { isFirefoxBuild } from '@project/extension/src/services/build-flags';
import type { FetchOptions } from '@project/extension/src/services/frame-bridge-client';
import FrameBridgeClient from '@project/extension/src/services/frame-bridge-client';
import { frameColorScheme, frameColorSchemeClass } from '@project/extension/src/services/frame-color-scheme';

export type UiFrameOptions = {
    wrapInDialogElement: boolean;
    onDialogCancel: () => void;
};

export type UiFrameControllerOptions = Pick<UiFrameOptions, 'wrapInDialogElement'>;

export const uiFrameForHtml = (html: (lang: string) => Promise<string>, options?: UiFrameOptions) => {
    return new UiFrame(async (frame: HTMLIFrameElement, lang: string) => {
        if (isFirefoxBuild) {
            // Firefox does not allow document.write() into the about:blank iframe.
            frame.srcdoc = await html(lang);
        } else {
            // On Chromium, use document.write() since it allows the loading of extension scripts
            // into the iframe without additional work.
            const doc = frame.contentDocument!;
            doc.open();
            doc.write(await html(lang));
            doc.close();
        }
    }, options);
};

export const uiFrameForSrc = (src: string, options?: UiFrameOptions) => {
    return new UiFrame(async (frame: HTMLIFrameElement) => {
        const colorScheme = frameColorScheme();
        frame.src = `${src}?colorScheme=${encodeURIComponent(colorScheme)}`;
    }, options);
};

type FrameInitializer = (frame: HTMLIFrameElement, lang: string) => Promise<void>;

export default class UiFrame {
    private readonly _frameInitializer: FrameInitializer;
    private _fetchOptions: FetchOptions | undefined;
    private _client: FrameBridgeClient | undefined;
    private _frame: HTMLIFrameElement | undefined;
    private _dialog: HTMLDialogElement | undefined;
    private _language: string = 'en';
    private _options?: UiFrameOptions;
    private _dirty = true;
    private _bound = false;

    constructor(frameInitializer: FrameInitializer, options?: UiFrameOptions) {
        this._frameInitializer = frameInitializer;
        this._options = options;
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
        return this._init();
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
        this._frame.classList.add('asbplayer-ui-frame');
        this._frame.classList.add(frameColorSchemeClass());
        this._frame.setAttribute('allowtransparency', 'true');

        this._client = new FrameBridgeClient(this._frame, this._fetchOptions);

        let element: HTMLElement;

        if (this._options?.wrapInDialogElement) {
            this._dialog = document.createElement('dialog');
            this._dialog.appendChild(this._frame);
            this._dialog.addEventListener('cancel', this._options.onDialogCancel);
            element = this._dialog;
        } else {
            element = this._frame;
        }

        document.body.appendChild(element);

        await this._frameInitializer(this._frame, this._language);
        await this._client.bind();
        return true;
    }

    show() {
        this._frame?.classList.remove('asbplayer-hide');
        if (this._dialog && !this._dialog.open) {
            this._dialog.showModal();
        }
    }

    hide() {
        this._frame?.classList.add('asbplayer-hide');
        this._frame?.blur();
        this._dialog?.close();
    }

    unbind() {
        this._dirty = true;
        this._client?.unbind();
        this._frame?.remove();
        if (this._dialog) {
            this._dialog.remove();
            this._dialog.removeEventListener('cancel', this._options!.onDialogCancel);
        }
    }
}
