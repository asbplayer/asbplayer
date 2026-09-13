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

        switch (command.command) {
            case 'mine-subtitle':
                return { published: (await onMineSubtitle?.(command)) ?? false };
            case 'load-subtitles':
                await onLoadSubtitles?.(command);
                return {};
            case 'seek-timestamp':
                await onSeekTimestamp?.(command);
                return {};
            // The read commands stay silent when unhandled instead of answering with an empty result.
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
