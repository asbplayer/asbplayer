import { WebSocketCommandDispatcher } from '@project/common/web-socket-client/web-socket-command-dispatcher';
import { WebSocketTransport } from '@project/common/web-socket-client/web-socket-transport';
import type { WebSocketCommand, WebSocketCommandHandlers } from '@project/common/web-socket-client/web-socket-commands';

export interface WebSocketClientOptions {
    // Commands outside this list are ignored, leaving them to another connected client.
    commands?: readonly WebSocketCommand['command'][];
}

export class WebSocketClient {
    private readonly _transport = new WebSocketTransport();
    private readonly _dispatcher: WebSocketCommandDispatcher;

    constructor(dispatcher = new WebSocketCommandDispatcher(), { commands }: WebSocketClientOptions = {}) {
        this._dispatcher = dispatcher;
        this._transport.onMessage = (data: string) => this._dispatcher.dispatch(data, commands);
    }

    get socket() {
        return this._transport.socket;
    }

    setHandlers(handlers: Partial<WebSocketCommandHandlers>) {
        return this._dispatcher.setHandlers(handlers);
    }

    async bind(url: string) {
        await this._transport.bind(url);
    }

    async ping() {
        return this._transport.ping();
    }

    unbind() {
        this._transport.unbind();
    }
}
