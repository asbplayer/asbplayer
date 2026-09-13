import { WebSocketCommandDispatcher } from '@project/common/web-socket-client/web-socket-command-dispatcher';
import { WebSocketTransport } from '@project/common/web-socket-client/web-socket-transport';
import type { WebSocketCommandHandlers } from '@project/common/web-socket-client/web-socket-commands';

export class WebSocketClient {
    private readonly _transport = new WebSocketTransport();
    private readonly _dispatcher = new WebSocketCommandDispatcher();

    constructor() {
        this._transport.onMessage = (data: string) => this._dispatcher.dispatch(data);
    }

    get socket() {
        return this._transport.socket;
    }

    setHandlers(handlers: Partial<WebSocketCommandHandlers>) {
        this._dispatcher.setHandlers(handlers);
    }

    get onMineSubtitle() {
        return this._dispatcher.handlers.onMineSubtitle;
    }

    set onMineSubtitle(onMineSubtitle: WebSocketCommandHandlers['onMineSubtitle'] | undefined) {
        this._dispatcher.setHandlers({ onMineSubtitle });
    }

    get onLoadSubtitles() {
        return this._dispatcher.handlers.onLoadSubtitles;
    }

    set onLoadSubtitles(onLoadSubtitles: WebSocketCommandHandlers['onLoadSubtitles'] | undefined) {
        this._dispatcher.setHandlers({ onLoadSubtitles });
    }

    get onSeekTimestamp() {
        return this._dispatcher.handlers.onSeekTimestamp;
    }

    set onSeekTimestamp(onSeekTimestamp: WebSocketCommandHandlers['onSeekTimestamp'] | undefined) {
        this._dispatcher.setHandlers({ onSeekTimestamp });
    }

    get onGetBoundMedia() {
        return this._dispatcher.handlers.onGetBoundMedia;
    }

    set onGetBoundMedia(onGetBoundMedia: WebSocketCommandHandlers['onGetBoundMedia'] | undefined) {
        this._dispatcher.setHandlers({ onGetBoundMedia });
    }

    get onGetSubtitles() {
        return this._dispatcher.handlers.onGetSubtitles;
    }

    set onGetSubtitles(onGetSubtitles: WebSocketCommandHandlers['onGetSubtitles'] | undefined) {
        this._dispatcher.setHandlers({ onGetSubtitles });
    }

    async bind(url: string) {
        await this._transport.bind(url);
    }

    async ping() {
        return this._transport.ping();
    }

    unbind() {
        this._transport.unbind();
        this._dispatcher.clearHandlers();
    }
}
