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
import type {
    ExternalApiMethod,
    JsonRpcErrorResponse,
    JsonRpcIncomingMessage,
    JsonRpcResponse,
} from '@project/common/external-commands/external-api';
import type { ZodSafeParseSuccess } from 'zod';

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
            const { dispatched, response } = await this._tryDispatchConnLevelJsonRpc(request);
            if (dispatched) {
                return response;
            }
            return this.dispatchAppLevelJsonRpc(request, commands);
        }

        if (typeof frame !== 'object' || frame === null || Array.isArray(frame)) {
            return jsonRpcError(null, jsonRpcErrorCodes.invalidRequest, 'Invalid request');
        }

        if (isInvalidJsonRpcRequest(frame)) {
            return jsonRpcError(null, jsonRpcErrorCodes.invalidRequest, 'Invalid request');
        }

        return this.dispatchCommand(frame as ExternalCommand, commands);
    }

    /**
     * Attempts to handle conn-level requests that are handled the same way by every asbplayer.
     */
    async _tryDispatchConnLevelJsonRpc(
        request: JsonRpcIncomingMessage
    ): Promise<
        { dispatched: true; response: JsonRpcResponse | undefined } | { dispatched: false; response: undefined }
    > {
        const id = request.id;

        if (request.method === 'client-info') {
            return {
                dispatched: true,
                response: id === undefined ? undefined : jsonRpcSuccess(id, { protocols: [jsonRpcProtocol] }),
            };
        }

        if (request.method === 'rpc.discover') {
            if (id === undefined) {
                return { dispatched: true, response: undefined };
            }

            const { default: openRpcDocument } = await import('@project/common/external-commands/openrpc-document');
            return { dispatched: true, response: jsonRpcSuccess(id, openRpcDocument) };
        }

        return { dispatched: false, response: undefined };
    }

    private _determineJsonRpcMethodAndParams(
        request: JsonRpcIncomingMessage,
        commands?: readonly ExternalCommand['command'][]
    ): { method: ExternalApiMethod; params: ZodSafeParseSuccess<unknown> } | JsonRpcErrorResponse | undefined {
        const id = request.id;
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

        return { method, params };
    }

    async dispatchAppLevelJsonRpc(
        request: JsonRpcIncomingMessage,
        commands?: readonly ExternalCommand['command'][]
    ): Promise<JsonRpcResponse | undefined> {
        const id = request.id;
        const methodAndParams = this._determineJsonRpcMethodAndParams(request, commands);

        if (methodAndParams === undefined) {
            return;
        }

        if ('error' in methodAndParams) {
            return methodAndParams;
        }

        const { method, params } = methodAndParams;

        const command = {
            command: request.method as ExternalCommand['command'],
            messageId: id ?? '',
            body: params.data as object,
        } as ExternalCommand;

        try {
            const responseBody = await this._handleCommand(command);
            return this._jsonRpcResponse(id, method, responseBody);
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
    }

    async dispatchCommand(
        command: ExternalCommand,
        commands?: readonly ExternalCommand['command'][]
    ): Promise<Response<object> | undefined> {
        if (commands !== undefined && !commands.includes(command.command)) {
            return undefined;
        }

        const body = await this._handleCommand(command);

        if (body === undefined) {
            return undefined;
        }

        return { command: 'response', messageId: command.messageId, body };
    }

    private async _handleCommand(command: ExternalCommand): Promise<object | undefined> {
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

    private _jsonRpcResponse(id: string | undefined, method: ExternalApiMethod, responseBody: object | undefined) {
        if (id === undefined) {
            return undefined;
        }

        if (responseBody === undefined) {
            return jsonRpcError(id, jsonRpcErrorCodes.methodNotFound, 'Method not found');
        }

        const result = method.resultSchema.safeParse(responseBody);

        if (!result.success) {
            return jsonRpcError(id, jsonRpcErrorCodes.internalError, 'Internal error', result.error.issues);
        }

        return jsonRpcSuccess(id, responseBody);
    }
}
