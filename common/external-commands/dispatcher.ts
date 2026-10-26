import type { Response, ExternalCommand, ExternalCommandHandlers } from '@project/common/external-commands/commands';
import {
    externalApiMethods,
    externalExtensionOnlyTag,
    jsonRpcErrorCodes,
    parseJsonRpcIncomingMessage,
} from '@project/common/external-commands/external-api';
import type {
    JsonRpcErrorResponse,
    JsonRpcIncomingMessage,
    JsonRpcResponse,
    JsonRpcSuccessResponse,
} from '@project/common/external-commands/external-api';

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

    async dispatch(
        data: string,
        commands?: readonly ExternalCommand['command'][]
    ): Promise<Response<object> | JsonRpcResponse | undefined> {
        const frame = JSON.parse(data);
        const request = parseJsonRpcIncomingMessage(frame);

        if (request !== undefined) {
            return this.dispatchJsonRpc(request, commands);
        }

        return this.dispatchCommand(frame, commands);
    }

    async dispatchJsonRpc(
        request: JsonRpcIncomingMessage,
        commands?: readonly ExternalCommand['command'][]
    ): Promise<JsonRpcResponse | undefined> {
        const id = request.id;

        if (commands !== undefined && !commands.includes(request.method as ExternalCommand['command'])) {
            // Leave the command to another connected client that handles it.
            return undefined;
        }

        const method = externalApiMethods[request.method];
        const paramsSchema = method?.paramsSchema;

        if (method === undefined || paramsSchema === undefined || method.tags.includes(externalExtensionOnlyTag)) {
            return id === undefined
                ? undefined
                : this._jsonRpcError(id, jsonRpcErrorCodes.methodNotFound, 'Method not found');
        }

        const params = paramsSchema.safeParse(request.params ?? {});

        if (!params.success) {
            return id === undefined
                ? undefined
                : this._jsonRpcError(id, jsonRpcErrorCodes.invalidParams, 'Invalid params', params.error.issues);
        }

        const command = {
            command: request.method as ExternalCommand['command'],
            messageId: id ?? '',
            body: params.data as object,
        } as ExternalCommand;

        let body: object | undefined;

        try {
            body = await this._body(command);
        } catch (thrown) {
            if (id === undefined) {
                return undefined;
            }

            return this._jsonRpcError(
                id,
                jsonRpcErrorCodes.internalError,
                'Internal error',
                thrown instanceof Error ? thrown.message : String(thrown)
            );
        }

        if (id === undefined) {
            return undefined;
        }

        if (body === undefined) {
            return this._jsonRpcError(id, jsonRpcErrorCodes.methodNotFound, 'Method not found');
        }

        return this._jsonRpcSuccess(id, body);
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

    private _jsonRpcSuccess(id: string, result: object): JsonRpcSuccessResponse {
        return { jsonrpc: '2.0', id, result };
    }

    private _jsonRpcError(id: string, code: number, message: string, data?: unknown): JsonRpcErrorResponse {
        return {
            jsonrpc: '2.0',
            id,
            error: { code, message, ...(data !== undefined ? { data } : {}) },
        };
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
