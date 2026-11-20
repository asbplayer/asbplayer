import { v4 as uuidv4 } from 'uuid';
import type Bridge from '@project/extension/src/ui/bridge';
import type { Message } from '@project/common';
import type { AnkiFrameClientMessage } from '@/services/frame-bridge-client';

export default class FrameBridgeServer {
    private readonly _bridge: Bridge;
    private _frameId?: string;
    private _windowMessageListener?: (event: MessageEvent) => void;
    private _runtimeMessageListener?: (request: AnkiFrameClientMessage, sender: Browser.runtime.MessageSender) => void;
    private _unbindServerMessageListener?: () => void;
    private _unbindServerReadyListener?: () => void;

    constructor(bridge: Bridge) {
        this._bridge = bridge;
    }

    bind({ useRuntimeMessages = false } = {}) {
        this.unbind();
        this._frameId = uuidv4();
        this._windowMessageListener = (event) => {
            if (event.data.sender !== 'asbplayer-video' || event.data.message.frameId !== this._frameId) {
                return;
            }

            if (event.source !== window.parent) {
                return;
            }

            switch (event.data.message.command) {
                case 'sendClientMessage':
                    this._bridge.sendMessageFromClient(event.data.message.message);
                    break;
            }
        };
        this._unbindServerMessageListener = this._bridge.addServerMessageListener((message: Message) => {
            this._postMessage({
                command: 'onServerMessage',
                message: message,
            });
        });
        this._unbindServerReadyListener = this._bridge.addServerReadyListener(() => {
            this._postMessage({
                command: 'ready',
                frameId: this._frameId,
            });
        });
        if (useRuntimeMessages) {
            // The streaming page can post window messages. Only extension code can send runtime messages.
            this._runtimeMessageListener = (request, sender) => {
                if (
                    sender.id === browser.runtime.id &&
                    request.sender === 'asbplayer-anki-frame-client' &&
                    request.frameId === this._frameId
                ) {
                    this._bridge.sendMessageFromClient(request.message);
                }
            };
            browser.runtime.onMessage.addListener(this._runtimeMessageListener);
        } else {
            window.addEventListener('message', this._windowMessageListener);
        }
    }

    _postMessage(message: any) {
        window.parent.postMessage(
            {
                sender: 'asbplayer-frame',
                message: message,
            },
            '*'
        );
    }

    unbind() {
        if (this._windowMessageListener) {
            window.removeEventListener('message', this._windowMessageListener);
        }
        if (this._runtimeMessageListener) {
            browser.runtime.onMessage.removeListener(this._runtimeMessageListener);
        }

        this._unbindServerMessageListener?.();
        this._unbindServerReadyListener?.();
    }
}
