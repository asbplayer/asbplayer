import type { SubtitleTrack } from '../src/model';

export type { SubtitleTrack };

export interface MineSubtitleCommand {
    command: 'mine-subtitle';
    messageId: string;
    body: {
        fields: { [key: string]: string };
        postMineAction: number;
    };
}

interface Response<T> {
    command: 'response';
    messageId: string;
    body: T;
}

interface MineSubtitleResponseBody {
    published: boolean;
}

interface LoadSubtitlesResponseBody {}

export interface SubtitleFile {
    base64: string;
    name: string;
}

export interface LoadSubtitlesCommand {
    command: 'load-subtitles';
    messageId: string;
    body: {
        files?: SubtitleFile[];
    };
}

export interface SeekTimestampCommand {
    command: 'seek-timestamp';
    messageId: string;
    body: {
        timestamp: number;
    };
}

export interface GetBoundMediaCommand {
    command: 'get-bound-media';
    messageId: string;
    body: {};
}

export interface BoundMedia {
    id: string; // Derived from a hash of `streaming:<tabId>:<src>` or `local:<asbplayerId>`.
    type: 'streaming' | 'local';
    title?: string;
    faviconUrl?: string;
    loadedSubtitles: SubtitleTrack[];
    active: boolean;
}

interface GetBoundMediaResponseBody {
    media: BoundMedia[];
}

export interface GetSubtitlesCommand {
    command: 'get-subtitles';
    messageId: string;
    body: {
        mediaId?: string;
        trackNumbers?: number[];
    };
}

export interface SubtitleCue {
    text: string;
    start: number;
    end: number;
    track: number;
}

interface GetSubtitlesResponseBody {
    subtitles: SubtitleCue[];
}

export class WebSocketClient {
    private _socket?: WebSocket;
    private _pingInterval?: NodeJS.Timeout;
    private _lastPingTimestampMs?: number;
    private _pongReceived: boolean = false;
    private _pingPromises: { resolve: (value: unknown) => void; reject: (error: any) => void }[] = [];
    private _connectPromise?: { resolve: (value: unknown) => void; reject: (error: any) => void };
    onMineSubtitle?: (command: MineSubtitleCommand) => Promise<boolean>;
    onLoadSubtitles?: (command: LoadSubtitlesCommand) => Promise<void>;
    onSeekTimestamp?: (command: SeekTimestampCommand) => Promise<void>;
    onGetBoundMedia?: () => Promise<BoundMedia[]>;
    onGetSubtitles?: (mediaId: string | undefined, trackNumbers: number[] | undefined) => Promise<SubtitleCue[]>;

    get socket() {
        return this._socket;
    }

    async bind(url: string) {
        if (this._pingInterval) {
            clearInterval(this._pingInterval);
        }

        this._pingInterval = setInterval(() => {
            if (
                (this._lastPingTimestampMs !== undefined && !this._pongReceived) ||
                (this._socket && this._socket.readyState !== this._socket?.OPEN)
            ) {
                console.log('Did not receive pong - reconnecting');

                for (const r of this._pingPromises) {
                    r.reject('Timed out');
                }

                this._pingPromises = [];
                this._connect(url);
            } else {
                this.ping().catch(console.info);
            }
        }, 10000);

        await this._connect(url);
    }

    private async _connect(url: string) {
        this._disconnect();

        if (!url) {
            throw new Error('Invalid URL');
        }

        return new Promise((resolve, reject) => {
            this._connectPromise = { resolve, reject };
            const socket = new WebSocket(url);
            socket.onmessage = async (event) => {
                if (event.data === 'PONG') {
                    this._pongReceived = true;

                    for (const p of this._pingPromises) {
                        p.resolve(undefined);
                    }

                    this._pingPromises = [];
                } else {
                    const payload = JSON.parse(event.data);

                    if (payload.command === 'mine-subtitle') {
                        const messageId = payload.messageId;
                        const published = (await this.onMineSubtitle?.(payload)) ?? false;
                        const response: Response<MineSubtitleResponseBody> = {
                            command: 'response',
                            messageId,
                            body: { published },
                        };
                        this._socket?.send(JSON.stringify(response));
                    } else if (payload.command === 'load-subtitles') {
                        const messageId = payload.messageId;
                        await this.onLoadSubtitles?.(payload);
                        const response: Response<LoadSubtitlesResponseBody> = {
                            command: 'response',
                            messageId,
                            body: {},
                        };
                        this._socket?.send(JSON.stringify(response));
                    } else if (payload.command === 'seek-timestamp') {
                        const messageId = payload.messageId;
                        await this.onSeekTimestamp?.(payload);
                        const response: Response<{}> = {
                            command: 'response',
                            messageId,
                            body: {},
                        };
                        this._socket?.send(JSON.stringify(response));
                    } else if (payload.command === 'get-bound-media') {
                        if (this.onGetBoundMedia !== undefined) {
                            const messageId = payload.messageId;
                            const media = await this.onGetBoundMedia();
                            const response: Response<GetBoundMediaResponseBody> = {
                                command: 'response',
                                messageId,
                                body: { media },
                            };
                            this._socket?.send(JSON.stringify(response));
                        }
                    } else if (payload.command === 'get-subtitles') {
                        if (this.onGetSubtitles !== undefined) {
                            const messageId = payload.messageId;
                            const subtitles = await this.onGetSubtitles(
                                payload.body?.mediaId,
                                payload.body?.trackNumbers
                            );
                            const response: Response<GetSubtitlesResponseBody> = {
                                command: 'response',
                                messageId,
                                body: { subtitles },
                            };
                            this._socket?.send(JSON.stringify(response));
                        }
                    }
                }
            };
            socket.onclose = (event) => {
                console.log(`Socket closed - reason: ${event.reason}`);
                this._connectPromise?.reject('Socket closed');
                this._connectPromise = undefined;
            };
            socket.onerror = () => {
                console.log('Socket error');
                this._connectPromise?.reject('Socket error');
                this._connectPromise = undefined;
            };
            socket.onopen = () => {
                this.ping().catch(console.error);
                this._connectPromise?.resolve(undefined);
                this._connectPromise = undefined;
            };

            this._socket = socket;
        });
    }

    async ping() {
        return new Promise((resolve, reject) => {
            if (!this._socket || this._socket.readyState !== this._socket.OPEN) {
                reject('Not connected');
                return;
            }

            this._socket.send('PING');
            this._lastPingTimestampMs = Date.now();
            this._pongReceived = false;
            this._pingPromises.push({ resolve, reject });
        });
    }

    private _disconnect() {
        if (!this._socket) {
            return;
        }

        if (this._socket.readyState !== this._socket.CLOSED && this._socket.readyState !== this._socket.CLOSING) {
            this._socket.close();
        }

        this._socket = undefined;
    }

    unbind() {
        this._disconnect();

        if (this._pingInterval !== undefined) {
            clearInterval(this._pingInterval);
            this._pingInterval = undefined;
        }

        for (const p of this._pingPromises) {
            p.reject('Disconnecting');
        }

        this._pingPromises = [];
        this._lastPingTimestampMs = undefined;
        this._pongReceived = false;
        this._connectPromise?.reject('Disconnecting');
        this._connectPromise = undefined;
        this.onMineSubtitle = undefined;
        this.onSeekTimestamp = undefined;
        this.onLoadSubtitles = undefined;
        this.onGetBoundMedia = undefined;
        this.onGetSubtitles = undefined;
    }
}
