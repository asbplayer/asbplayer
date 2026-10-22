import type { Response, ExternalCommand, ExternalCommandHandlers } from '@project/common/external-commands/commands';

export class ExternalCommandDispatcher {
    private _handlers: Partial<ExternalCommandHandlers> = {};

    setHandlers(handlers: Partial<ExternalCommandHandlers>) {
        this._handlers = { ...this._handlers, ...handlers };

        return () => {
            const remaining = { ...this._handlers };

            for (const key of Object.keys(handlers) as (keyof ExternalCommandHandlers)[]) {
                if (remaining[key] === handlers[key]) {
                    delete remaining[key];
                }
            }

            this._handlers = remaining;
        };
    }

    async dispatch(data: string, commands?: readonly ExternalCommand['command'][]) {
        return this.dispatchCommand(JSON.parse(data), commands);
    }

    async dispatchCommand(
        command: ExternalCommand,
        commands?: readonly ExternalCommand['command'][]
    ): Promise<Response<object> | undefined> {
        if (commands !== undefined && !commands.includes(command.command)) {
            return undefined;
        }

        const body = await this._body(command);

        if (body === undefined) {
            return undefined;
        }

        return { command: 'response', messageId: command.messageId, body };
    }

    private async _body(command: ExternalCommand): Promise<object | undefined> {
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
