import type { Response, ExternalCommand, ExternalCommandHandlers } from '@project/common/external-commands/commands';
import {
    externalApiMethod,
    isInvalidJsonRpcRequest,
    jsonRpcError,
    jsonRpcErrorCodes,
    jsonRpcProtocol,
    jsonRpcSuccess,
    parseJsonRpcIncomingMessage,
} from '@project/common/external-commands/external-api';
import type { JsonRpcIncomingMessage, JsonRpcResponse } from '@project/common/external-commands/external-api';

export class ExternalCommandDispatcher {
    private _handlers: Partial<ExternalCommandHandlers> = {};
    private readonly _tagsDenyList: string[];

    constructor({ tagsDenyList }: { tagsDenyList?: string[] } = {}) {
        this._tagsDenyList = tagsDenyList ?? [];
    }

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
        let frame: unknown;

        try {
            frame = JSON.parse(data);
        } catch {
            return jsonRpcError(null, jsonRpcErrorCodes.parseError, 'Parse error');
        }

        const request = parseJsonRpcIncomingMessage(frame);

        if (request !== undefined) {
            return this.dispatchJsonRpc(request, commands);
        }

        if (typeof frame !== 'object' || frame === null || Array.isArray(frame)) {
            return jsonRpcError(null, jsonRpcErrorCodes.invalidRequest, 'Invalid request');
        }

        if (isInvalidJsonRpcRequest(frame)) {
            return jsonRpcError(null, jsonRpcErrorCodes.invalidRequest, 'Invalid request');
        }

        return this.dispatchCommand(frame as ExternalCommand, commands);
    }

    async dispatchJsonRpc(
        request: JsonRpcIncomingMessage,
        commands?: readonly ExternalCommand['command'][]
    ): Promise<JsonRpcResponse | undefined> {
        const id = request.id;

        if (request.method === 'client-info') {
            return id === undefined ? undefined : jsonRpcSuccess(id, { protocols: [jsonRpcProtocol] });
        }

        if (request.method === 'rpc.discover') {
            if (id === undefined) {
                return undefined;
            }

            const { default: openRpcDocument } = await import(
                '@project/common/external-commands/openrpc-document.json'
            );
            return jsonRpcSuccess(id, openRpcDocument);
        }

        const method = externalApiMethod(request.method);

        if (method === undefined || this._tagsDenyList.some((t) => method.tags.includes(t))) {
            return id === undefined
                ? undefined
                : jsonRpcError(id, jsonRpcErrorCodes.methodNotFound, 'Method not found');
        }

        if (commands !== undefined && !commands.includes(request.method as ExternalCommand['command'])) {
            // Leave the command to another connected client that handles it.
            return undefined;
        }

        const params = method.paramsSchema.safeParse(request.params ?? {});

        if (!params.success) {
            return id === undefined
                ? undefined
                : jsonRpcError(id, jsonRpcErrorCodes.invalidParams, 'Invalid params', params.error.issues);
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

            return jsonRpcError(
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
            return jsonRpcError(id, jsonRpcErrorCodes.methodNotFound, 'Method not found');
        }

        const result = method.resultSchema.safeParse(body);

        if (!result.success) {
            return jsonRpcError(id, jsonRpcErrorCodes.internalError, 'Internal error', result.error.issues);
        }

        return jsonRpcSuccess(id, body);
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
            default: {
                // Every ExternalCommand member must have a case above.
                const unhandled: never = command;

                void unhandled;
                return undefined;
            }
        }
    }
}
