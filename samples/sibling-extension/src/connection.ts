import type { ExternalAuthenticationMessage, ExternalCommand, Response } from './protocol';

/**
 * Request/response correlation over an external connection port, by `messageId` -- the same
 * scheme the WebSocket server integration uses. Frames that receive no response (unapproved
 * extensions, unhandled commands) reject after a timeout, like the WebSocket server's
 * RequestTimeout.
 */
export class ExternalConnection {
    private readonly _port: chrome.runtime.Port;
    private readonly _requests = new Map<string, (response: Response<unknown> | undefined) => void>();
    private readonly _messageListeners: ((message: unknown) => void)[] = [];
    private readonly _disconnectListeners: (() => void)[] = [];
    private _disconnected = false;

    constructor(port: chrome.runtime.Port, private readonly _timeoutMs = 5000) {
        this._port = port;
        port.onMessage.addListener((message) => this._onMessage(message));
        port.onDisconnect.addListener(() => this._onDisconnect());
    }

    get id() {
        return this._port.sender?.id;
    }

    onMessage(listener: (message: unknown) => void) {
        this._messageListeners.push(listener);
    }

    onDisconnect(listener: () => void) {
        this._disconnectListeners.push(listener);
    }

    get disconnected() {
        return this._disconnected;
    }

    disconnect() {
        this._port.disconnect();
        this._onDisconnect();
    }

    /** Posts a raw frame without expecting a response. */
    post(message: unknown) {
        this._port.postMessage(message);
    }

    /**
     * Posts a command and correlates the response by message ID. Rejects on timeout or
     * disconnect while a response is pending.
     */
    async request<T>(command: ExternalCommand): Promise<Response<T> | undefined> {
        return new Promise<Response<T> | undefined>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._requests.delete(command.messageId);
                resolve(undefined);
            }, this._timeoutMs);

            this._requests.set(command.messageId, (response) => {
                clearTimeout(timeout);
                resolve(response as Response<T> | undefined);
            });

            try {
                this._port.postMessage(command);
            } catch (error) {
                clearTimeout(timeout);
                this._requests.delete(command.messageId);
                reject(error);
            }
        });
    }

    private _onMessage(message: unknown) {
        const response = message as Response<unknown> | undefined;

        if (response?.command === 'response' && this._requests.has(response.messageId)) {
            const resolve = this._requests.get(response.messageId)!;
            this._requests.delete(response.messageId);
            resolve(response);
            return;
        }

        for (const listener of this._messageListeners) {
            listener(message);
        }
    }

    private _onDisconnect() {
        if (this._disconnected) {
            return;
        }

        this._disconnected = true;

        for (const resolve of this._requests.values()) {
            resolve(undefined);
        }

        this._requests.clear();

        for (const listener of this._disconnectListeners) {
            listener();
        }
    }
}

export class ExternalAuthentication {
    private _approved = false;

    constructor(private readonly _onChanged: (approved: boolean) => void) {}

    get approved() {
        return this._approved;
    }

    update(message: ExternalAuthenticationMessage) {
        const approved = message.approved === true;

        if (approved !== this._approved) {
            this._approved = approved;
            this._onChanged(approved);
        }
    }
}
