import { Message, MessageWithId } from '@project/common';

export default class Bridge {
    private readonly _resolves: { [key: string]: (response: any) => void } = {};
    private _clientMessageListeners: ((message: any) => void)[] = [];
    private _serverMessageListeners: ((message: any) => void)[] = [];
    private _serverReadyListeners: (() => void)[] = [];

    sendMessageFromClient(message: Message) {
        if ('messageId' in message) {
            const messageWithId = message as MessageWithId;
            const messageId = messageWithId.messageId;

            if (messageId in this._resolves) {
                this._resolves[messageId]?.(message);
                delete this._resolves[messageId];
            }
        }

        for (const l of this._clientMessageListeners) {
            l(message);
        }
    }

    addClientMessageListener(listener: (message: Message) => void) {
        this._clientMessageListeners.push(listener);
        return () => {
            this._clientMessageListeners = this._clientMessageListeners.filter((l) => l !== listener);
        };
    }

    serverIsReady() {
        for (const l of this._serverReadyListeners) {
            l();
        }
    }

    addServerMessageListener(listener: (message: Message) => void) {
        this._serverMessageListeners.push(listener);
        return () => {
            this._serverMessageListeners = this._serverMessageListeners.filter((l) => l !== listener);
        };
    }

    addServerReadyListener(listener: () => void) {
        this._serverReadyListeners.push(listener);
        return () => {
            this._serverReadyListeners = this._serverReadyListeners.filter((l) => l !== listener);
        };
    }

    sendMessageFromServer(message: Message) {
        for (const l of this._serverMessageListeners) {
            l(message);
        }
    }

    sendMessageFromServerAndExpectResponse(message: MessageWithId, timeoutOverride?: number): Promise<any> {
        for (const l of this._serverMessageListeners) {
            l(message);
        }

        return new Promise((resolve, reject) => {
            this._resolves[message.messageId] = resolve;
            setTimeout(() => {
                if (message.messageId in this._resolves) {
                    reject('Request timed out');
                    delete this._resolves[message.messageId];
                }
            }, timeoutOverride ?? 5000);
        });
    }

    unbind() {
        this._clientMessageListeners = [];
        this._serverMessageListeners = [];
        this._serverReadyListeners = [];
    }
}
