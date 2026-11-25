import type { Command, CopyToClipboardMessage, Message, WriteClipboardMessage } from '@project/common';
import { clipboardWrite, isClipboardPngDataUrl, isClipboardText } from '@project/common/util/clipboard';
import { asbError, asbTrace } from '@project/common/util/log';
import { isClipboardAppOrigin, isClipboardExtensionOrigin, originOf } from '@/services/clipboard';

export interface CopyToClipboardHandlerOptions {
    readonly allowDevOrigin: boolean;
}

export default class CopyToClipboardHandler {
    private readonly allowDevOrigin: boolean;

    constructor({ allowDevOrigin }: CopyToClipboardHandlerOptions) {
        this.allowDevOrigin = allowDevOrigin;
    }

    get sender() {
        return ['asbplayer-clipboard-content-script', 'asbplayerv2'];
    }

    get command() {
        return 'clipboard-write';
    }

    private _isAuthorizedSender(
        commandSender: string,
        sender: Browser.runtime.MessageSender,
        origin: string | undefined,
        fromExtensionPage: boolean
    ): boolean {
        if (commandSender !== 'asbplayerv2' && commandSender !== 'asbplayer-clipboard-content-script') return false;
        if (fromExtensionPage) return true;
        if (sender.tab?.id === undefined) return false;
        if (commandSender !== 'asbplayerv2') return true;
        return (
            sender.frameId === 0 &&
            origin !== undefined &&
            isClipboardAppOrigin(origin, { allowDevOrigin: this.allowDevOrigin }) &&
            originOf(sender.tab.url) === origin
        );
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (written: boolean) => void) {
        const tabId = sender.tab?.id;
        const { data } = command.message as Partial<WriteClipboardMessage>;
        const fromApp = command.sender === 'asbplayerv2';
        const origin = sender.origin ?? originOf(sender.url);
        const fromExtensionPage = origin !== undefined && isClipboardExtensionOrigin(origin);
        const authorizedSender = this._isAuthorizedSender(command.sender, sender, origin, fromExtensionPage);

        // Reject requests whose security cannot be guaranteed:
        // - Other extensions (sender.id !== browser.runtime.id)
        // - Web-app requests from non-app, non-HTTPS, non-dev, or opaque/sandboxed ('null') origins, missing tabs,
        //   subframes (sender.frameId !== 0), or the web app framed inside a third-party site
        // - Non-extension-page requests without a tab, and payloads outside bounded plain text
        // - Injected about:blank UI iframes and MAIN-world page scripts share the host page's origin and are never
        //   wired into this background write path because host scripts could spoof their messages.
        if (sender.id !== browser.runtime.id || !authorizedSender || !isClipboardText(data)) {
            asbTrace('background/clipboard', 'Rejected unauthorized or invalid clipboard write request');
            sendResponse(false);
            return false;
        }

        void (async () => {
            try {
                await clipboardWrite(data);
            } catch (error) {
                if (fromApp || fromExtensionPage || tabId === undefined) throw error;

                const relay: Command<WriteClipboardMessage> = {
                    sender: 'asbplayer-background-clipboard',
                    message: { command: 'clipboard-write', data },
                };
                if ((await browser.tabs.sendMessage(tabId, relay, { frameId: 0 })) !== true) {
                    throw new Error('Video tab could not write to the clipboard', { cause: error });
                }
            }
            sendResponse(true);
        })().catch((error) => {
            asbTrace('background/clipboard', 'Could not write to the clipboard', error);
            sendResponse(false);
        });
        return true;
    }
}

export class CopyImageToClipboardHandler {
    get sender() {
        return ['asbplayer-video', 'asbplayer-video-tab'];
    }

    get command() {
        return 'copy-to-clipboard';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const tabId = sender.tab?.id;

        const { dataUrl } = command.message as Partial<CopyToClipboardMessage>;
        // Reject other extensions, missing tabs, external URLs, and non-PNG or oversized payloads.
        if (sender.id !== browser.runtime.id || tabId === undefined || !isClipboardPngDataUrl(dataUrl)) {
            asbTrace('background/clipboard', 'Rejected unauthorized or invalid clipboard image request');
            return false;
        }

        // Injected about:blank UI iframes (such as Anki UI) share the host site's origin, so host page scripts could
        // spoof bridge messages. Never grant them a background clipboard write. Relay only to the top frame where
        // focus and user activation are enforced.
        const relay: Command<CopyToClipboardMessage> = {
            sender: 'asbplayer-background-clipboard',
            message: { command: 'copy-to-clipboard', dataUrl },
        };
        void browser.tabs
            .sendMessage(tabId, relay, { frameId: 0 })
            .catch((error) => asbError('background/clipboard', 'Could not relay clipboard image', error));
        return false;
    }
}
