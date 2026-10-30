import { ExternalCommandDispatcher } from '@project/common/external-commands/dispatcher';
import { WebSocketTransport } from '@project/common/external-commands/web-socket/web-socket-transport';
import type { ExternalCommand, ExternalCommandHandlers } from '@project/common/external-commands/commands';

export interface WebSocketClientOptions {
    // Commands outside this list are ignored, leaving them to another connected client.
    commands?: readonly ExternalCommand['command'][];
}

export class WebSocketClient {
    private readonly _transport = new WebSocketTransport();
    private readonly _dispatcher: ExternalCommandDispatcher;

    constructor(dispatcher = new ExternalCommandDispatcher(), { commands }: WebSocketClientOptions = {}) {
        this._dispatcher = dispatcher;
        this._transport.onMessage = (data: string) => this._dispatcher.dispatch(data, commands);
    }

    get socket() {
        return this._transport.socket;
    }

    setHandlers(handlers: Partial<ExternalCommandHandlers>) {
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
