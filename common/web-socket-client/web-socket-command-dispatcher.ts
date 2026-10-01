import type {
    Response,
    WebSocketCommand,
    WebSocketCommandHandlers,
} from '@project/common/web-socket-client/web-socket-commands';

export class WebSocketCommandDispatcher {
    private _handlers: Partial<WebSocketCommandHandlers> = {};

    get handlers(): Partial<WebSocketCommandHandlers> {
        return this._handlers;
    }

    setHandlers(handlers: Partial<WebSocketCommandHandlers>) {
        this._handlers = { ...this._handlers, ...handlers };
    }

    clearHandlers() {
        this._handlers = {};
    }

    async dispatch(data: string): Promise<Response<object> | undefined> {
        const command: WebSocketCommand = JSON.parse(data);
        const body = await this._body(command);

        if (body === undefined) {
            return undefined;
        }

        return { command: 'response', messageId: command.messageId, body };
    }

    private async _body(command: WebSocketCommand): Promise<object | undefined> {
        const { onMineSubtitle, onLoadSubtitles, onSeekTimestamp, onGetBoundMedia, onGetSubtitles } = this._handlers;

        // Unhandled commands stay silent so that another connected client which handles them can answer.
        switch (command.command) {
            case 'mine-subtitle':
                return onMineSubtitle === undefined ? undefined : { published: await onMineSubtitle(command) };
            case 'load-subtitles':
                if (onLoadSubtitles === undefined) {
                    return undefined;
                }

                await onLoadSubtitles(command);
                return {};
            case 'seek-timestamp':
                if (onSeekTimestamp === undefined) {
                    return undefined;
                }

                await onSeekTimestamp(command);
                return {};
            case 'get-bound-media':
                return onGetBoundMedia === undefined ? undefined : { media: await onGetBoundMedia() };
            case 'get-subtitles':
                return onGetSubtitles === undefined
                    ? undefined
                    : { subtitles: await onGetSubtitles(command.body?.mediaId, command.body?.trackNumbers) };
            default:
                return undefined;
        }
    }
}
