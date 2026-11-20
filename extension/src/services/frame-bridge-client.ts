import { asbError } from '@project/common/util/log';
import type {
    HttpPostMessage,
    Message,
    MessageWithId,
    TabToExtensionCommand,
    VideoToExtensionCommand,
} from '@project/common';

export interface FetchOptions {
    videoSrc?: string;
    allowedFetchUrl?: string;
}

export interface AnkiFrameClientMessage {
    sender: 'asbplayer-anki-frame-client';
    frameId: string;
    message: any;
}

export default class FrameBridgeClient {
    private readonly frame: HTMLIFrameElement;
    private readonly fetchOptions?: FetchOptions;
    private readonly expectedOrigin?: string;
    private readonly useRuntimeMessages: boolean;

    private frameId?: string;
    private windowMessageListener?: (event: MessageEvent) => void;
    private bindPromise?: Promise<void>;
    private serverMessageListener?: (message: any) => Promise<void>;

    constructor(
        frame: HTMLIFrameElement,
        fetchOptions?: FetchOptions,
        expectedOrigin?: string,
        useRuntimeMessages = false
    ) {
        this.frame = frame;
        this.fetchOptions = fetchOptions;
        this.expectedOrigin = expectedOrigin;
        this.useRuntimeMessages = useRuntimeMessages;
        this.bindPromise = undefined;
    }

    async bind() {
        this.bindPromise = this.bindPromise || this._bindClient();

        return this.bindPromise;
    }

    updateState(state: any) {
        const message = { command: 'updateState', state };
        this.sendMessage(message);
    }

    sendMessage(message: any) {
        if (!this.frameId) {
            throw new Error('Attempted to send message when frame is not ready');
        }

        if (this.useRuntimeMessages) {
            const request: AnkiFrameClientMessage = {
                sender: 'asbplayer-anki-frame-client',
                frameId: this.frameId,
                message,
            };
            void browser.runtime.sendMessage(request).catch((error) => asbError('bridge', error));
            return;
        }

        this.frame.contentWindow?.postMessage(
            {
                sender: 'asbplayer-video',
                message: {
                    command: 'sendClientMessage',
                    message: message,
                    frameId: this.frameId,
                },
            },
            this.expectedOrigin ?? '*'
        );
    }

    onMessage(listener: (message: Message) => void) {
        this.serverMessageListener = async (message) => listener(message);
    }

    unbind() {
        if (this.windowMessageListener) {
            window.removeEventListener('message', this.windowMessageListener);
            this.windowMessageListener = undefined;
        }

        this.serverMessageListener = undefined;
    }

    _bindClient(): Promise<void> {
        return new Promise((resolve, reject) => {
            let ready = false;

            this.windowMessageListener = (event) => {
                if (
                    event.source !== this.frame.contentWindow ||
                    (this.useRuntimeMessages && !event.isTrusted) ||
                    (this.expectedOrigin !== undefined && event.origin !== this.expectedOrigin) ||
                    event.data?.sender !== 'asbplayer-frame'
                ) {
                    return;
                }

                const message = event.data.message;

                switch (message.command) {
                    case 'ready':
                        this.frameId = event.data.message.frameId;
                        ready = true;
                        resolve();
                        break;
                    case 'onServerMessage':
                        if (message.message.command === 'http-post') {
                            this._resolveHttpPost(message.message as HttpPostMessage);
                        } else {
                            if (this.serverMessageListener) {
                                void this.serverMessageListener(message.message).catch((error) =>
                                    asbError('bridge', error)
                                );
                            }
                        }
                        break;
                }
            };

            setTimeout(() => {
                if (!ready) {
                    reject(new Error('Timed out waiting for frame to be ready'));

                    if (this.windowMessageListener) {
                        window.removeEventListener('message', this.windowMessageListener);
                        this.windowMessageListener = undefined;
                    }
                }
            }, 10000);
            window.addEventListener('message', this.windowMessageListener);
        });
    }

    _resolveHttpPost(message: HttpPostMessage) {
        if (this.fetchOptions === undefined) {
            return;
        }

        if (this.fetchOptions.allowedFetchUrl === undefined || message.url !== this.fetchOptions.allowedFetchUrl) {
            return;
        }

        const httpPostMessage: HttpPostMessage = {
            command: 'http-post',
            url: message.url,
            body: message.body,
            messageId: message.messageId,
        };
        this._relayToExtension(httpPostMessage);
    }

    private _relayToExtension(message: MessageWithId) {
        const command: VideoToExtensionCommand<MessageWithId> | TabToExtensionCommand<MessageWithId> =
            this.fetchOptions?.videoSrc === undefined
                ? { sender: 'asbplayer-video-tab', message }
                : { sender: 'asbplayer-video', message, src: this.fetchOptions.videoSrc };

        browser.runtime.sendMessage(command, (extensionResponse) => {
            const response = extensionResponse
                ? { ...extensionResponse, messageId: message.messageId }
                : { error: browser.runtime.lastError?.message, messageId: message.messageId };
            if (this.frameId) this.sendMessage(response);
        });
    }
}
