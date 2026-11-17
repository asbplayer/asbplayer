import type { YomitanFetcher } from '@project/common/yomitan/yomitan-fetcher';
import { v4 as uuidv4 } from 'uuid';

export const YOMITAN_PORT_NAME = 'asbplayer';
const REQUEST_TIMEOUT_MS = 28_000; // Just below service worker lifetime
const RECONNECT_COOLDOWN_MS = 5_000;

interface YomitanPortMessage {
    action: string;
    requestId?: string;
    data: any;
    responseStatusCode: number;
}

interface PendingRequest {
    resolve: (response: YomitanPortMessage) => void;
    reject: (error: Error) => void;
}

export class ExtensionToExtensionYomitanFetcher implements YomitanFetcher {
    private readonly _pending = new Map<string, PendingRequest>();
    private _port?: Browser.runtime.Port;
    private _lastDisconnected?: number;

    constructor(private readonly _yomitanExtensionId: string) {}

    async fetch(action: string, body: object) {
        const port = this._getOrCreatePort();
        const requestId = uuidv4();
        const response = await this._postTo(port, action, JSON.stringify(body), requestId);
        return response.data;
    }

    private _getOrCreatePort(): Browser.runtime.Port {
        if (this._port) {
            return this._port;
        }

        if (this._lastDisconnected !== undefined && Date.now() - this._lastDisconnected < RECONNECT_COOLDOWN_MS) {
            throw new Error('Yomitan disconnected - waiting to reconnect');
        }

        const port = browser.runtime.connect(this._yomitanExtensionId, { name: YOMITAN_PORT_NAME });

        port.onMessage.addListener((message: unknown) => {
            const response = this._asPortMessage(message);
            if (!response?.requestId) return;
            this._take(response.requestId)?.resolve(response);
        });
        port.onDisconnect.addListener(() => {
            this._lastDisconnected = Date.now();
            this._port = undefined;
            const lastError = browser.runtime.lastError;
            this._abortPending(
                lastError
                    ? new Error(`Yomitan port disconnected: ${lastError?.message}`)
                    : new Error('Yomitan port disconnected')
            );
        });

        this._port = port;
        return port;
    }

    private _postTo(
        port: Browser.runtime.Port,
        action: string,
        body: string,
        requestId: string
    ): Promise<YomitanPortMessage> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this._take(requestId)?.reject(new Error('Yomitan request timed out'));
            }, REQUEST_TIMEOUT_MS);
            this._pending.set(requestId, {
                // The timer must be cleared when the request settles by response or error.
                resolve: (response) => {
                    clearTimeout(timeoutId);
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                },
            });
            try {
                port.postMessage({ action, params: {}, body, requestId });
            } catch (e) {
                this._take(requestId)?.reject(e as Error);
            }
        });
    }

    private _take(requestId: string): PendingRequest | undefined {
        const pending = this._pending.get(requestId);
        this._pending.delete(requestId);
        return pending;
    }

    private _asPortMessage(message: unknown): YomitanPortMessage | null {
        if (typeof message !== 'object' || message === null) return null;
        const { action, requestId, data, responseStatusCode } = message as Record<string, unknown>;
        if (typeof action !== 'string' || typeof requestId !== 'string') return null;
        return { action, requestId, data, responseStatusCode: Number(responseStatusCode) };
    }

    private _abortPending(error: Error) {
        for (const requestId of [...this._pending.keys()]) {
            this._take(requestId)?.reject(error);
        }
    }
}
