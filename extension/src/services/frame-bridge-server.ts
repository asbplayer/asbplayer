import { v4 as uuidv4 } from 'uuid';
import Bridge from '../ui/bridge';
import { Message } from '@project/common';

export default class FrameBridgeServer {
    private readonly _bridge: Bridge;
    private _frameId?: string;
    private _windowMessageListener?: (event: MessageEvent) => void;
    private _unbindServerMessageListener?: () => void;
    private _unbindServerReadyListener?: () => void;

    constructor(bridge: Bridge) {
        this._bridge = bridge;
    }

    bind() {
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
        window.addEventListener('message', this._windowMessageListener);
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

        this._unbindServerMessageListener?.();
        this._unbindServerReadyListener?.();
    }
}
