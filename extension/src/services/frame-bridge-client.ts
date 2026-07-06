import { HttpPostMessage, Message, TabToExtensionCommand, VideoToExtensionCommand } from '@project/common';

export interface FetchOptions {
    videoSrc?: string;
    allowedFetchUrl?: string;
}

export default class FrameBridgeClient {
    private readonly frame: HTMLIFrameElement;
    private readonly fetchOptions?: FetchOptions;

    private frameId?: string;
    private windowMessageListener?: (event: MessageEvent) => void;
    private bindPromise?: Promise<void>;
    private serverMessageListener?: (message: any) => void | Promise<void>;

    constructor(frame: HTMLIFrameElement, fetchOptions?: FetchOptions) {
        this.frame = frame;
        this.fetchOptions = fetchOptions;
        this.bindPromise = undefined;
    }

    async bind() {
        this.bindPromise = this.bindPromise || this._bindClient();

        return this.bindPromise;
    }

    updateState(state: any) {
        if (!this.frameId) {
            throw new Error('Attempted to update state when frame is not ready');
        }

        this.frame.contentWindow?.postMessage(
            {
                sender: 'asbplayer-video',
                message: {
                    command: 'sendClientMessage',
                    message: {
                        command: 'updateState',
                        state: state,
                    },
                    frameId: this.frameId,
                },
            },
            '*'
        );
    }

    sendMessage(message: any) {
        if (!this.frameId) {
            throw new Error('Attempted to send message when frame is not ready');
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
            '*'
        );
    }

    onMessage(listener: (message: Message) => void) {
        this.serverMessageListener = listener;
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
                if (event.source !== this.frame.contentWindow || event.data.sender !== 'asbplayer-frame') {
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
                                const result = this.serverMessageListener(message.message);

                                if (result instanceof Promise) {
                                    result.catch(console.error);
                                }
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

        let httpPostCommand: VideoToExtensionCommand<HttpPostMessage> | TabToExtensionCommand<HttpPostMessage>;
        const httpPostMessage: HttpPostMessage = {
            command: 'http-post',
            url: message.url,
            body: message.body,
            messageId: message.messageId,
        };

        if (this.fetchOptions.videoSrc === undefined) {
            httpPostCommand = {
                sender: 'asbplayer-video-tab',
                message: httpPostMessage,
            };
        } else {
            httpPostCommand = {
                sender: 'asbplayer-video',
                message: httpPostMessage,
                src: this.fetchOptions.videoSrc,
            };
        }

        browser.runtime.sendMessage(httpPostCommand, (postResponse) => {
            const response = postResponse
                ? { ...postResponse, messageId: message.messageId }
                : { error: browser.runtime.lastError?.message, messageId: message.messageId };
            this.frame.contentWindow?.postMessage(
                {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'sendClientMessage',
                        message: response,
                        frameId: this.frameId,
                    },
                },
                '*'
            );
        });
    }
}
