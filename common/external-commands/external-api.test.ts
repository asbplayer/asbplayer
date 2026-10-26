import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';
import {
    externalApiMethods,
    externalExtensionPortName,
    isInvalidJsonRpcRequest,
    jsonRpcErrorResponseSchema,
    jsonRpcNotificationSchema,
    jsonRpcRequestSchema,
    jsonRpcResultResponseSchema,
    mineSubtitleParamsSchema,
    parseJsonRpcIncomingMessage,
} from '@project/common/external-commands/external-api';
import {
    generateOpenRpcDocument,
    serializeOpenRpcDocument,
    toJsonSchema,
} from '@project/common/external-commands/openrpc';
import openRpcDocument from '@project/common/external-commands/openrpc-document.json';

const validRequest = {
    jsonrpc: '2.0',
    method: 'seek-timestamp',
    id: 'f4dcb16a-2b47-4b06-9f4b-9d5387fa2f61',
    params: { timestamp: 42, mediaId: 'streaming:1:src' },
};

describe('external API schemas', () => {
    describe('JSON-RPC envelope', () => {
        it('accepts a well-formed request', () => {
            expect(jsonRpcRequestSchema.safeParse(validRequest).success).toBe(true);
        });

        it('rejects a request missing the jsonrpc version', () => {
            const { jsonrpc, ...invalid } = validRequest;

            void jsonrpc;
            expect(jsonRpcRequestSchema.safeParse(invalid).success).toBe(false);
        });

        it('rejects a non-string id', () => {
            expect(jsonRpcRequestSchema.safeParse({ ...validRequest, id: 1 }).success).toBe(false);
        });

        it('accepts a notification without an id', () => {
            const { id, ...notification } = validRequest;

            void id;
            expect(jsonRpcNotificationSchema.safeParse(notification).success).toBe(true);
            expect(jsonRpcRequestSchema.safeParse(notification).success).toBe(false);
        });

        it('accepts result and error responses', () => {
            expect(
                jsonRpcResultResponseSchema.safeParse({
                    jsonrpc: '2.0',
                    id: 'f4dcb16a-2b47-4b06-9f4b-9d5387fa2f61',
                    result: {},
                }).success
            ).toBe(true);
            expect(
                jsonRpcErrorResponseSchema.safeParse({
                    jsonrpc: '2.0',
                    id: 'f4dcb16a-2b47-4b06-9f4b-9d5387fa2f61',
                    error: { code: -32601, message: 'Method not found' },
                }).success
            ).toBe(true);
        });

        it('accepts error responses with a null id', () => {
            expect(
                jsonRpcErrorResponseSchema.safeParse({
                    jsonrpc: '2.0',
                    id: null,
                    error: { code: -32600, message: 'Invalid request' },
                }).success
            ).toBe(true);
        });

        it('rejects an error response with a non-integer code', () => {
            expect(
                jsonRpcErrorResponseSchema.safeParse({
                    jsonrpc: '2.0',
                    id: 'f4dcb16a-2b47-4b06-9f4b-9d5387fa2f61',
                    error: { code: 'oops', message: 'Method not found' },
                }).success
            ).toBe(false);
        });

        it('sniffs requests and notifications from incoming frames', () => {
            expect(parseJsonRpcIncomingMessage(validRequest)).toEqual(validRequest);
            expect(parseJsonRpcIncomingMessage({ jsonrpc: '2.0', method: 'get-bound-media' })).toEqual({
                jsonrpc: '2.0',
                method: 'get-bound-media',
            });
        });

        it('rejects frames that violate the envelope rules', () => {
            const { id, ...notification } = validRequest;

            void id;
            expect(parseJsonRpcIncomingMessage({ ...validRequest, id: 1 })).toBeUndefined();
            expect(parseJsonRpcIncomingMessage({ ...notification, jsonrpc: '1.0' })).toBeUndefined();
            expect(parseJsonRpcIncomingMessage({ ...notification, method: 1 })).toBeUndefined();
            expect(parseJsonRpcIncomingMessage(null)).toBeUndefined();
            expect(parseJsonRpcIncomingMessage('not an object')).toBeUndefined();
        });

        it('identifies invalid requests that should be answered with -32600', () => {
            expect(isInvalidJsonRpcRequest({ ...validRequest, id: 1 })).toBe(true);
            expect(isInvalidJsonRpcRequest({ jsonrpc: '2.0', id: 'm1' })).toBe(true);
            expect(isInvalidJsonRpcRequest({ jsonrpc: '2.0', method: 1, id: 'm1' })).toBe(true);
            expect(isInvalidJsonRpcRequest(validRequest)).toBe(false);
            expect(isInvalidJsonRpcRequest({ jsonrpc: '2.0', id: 'm1', result: {} })).toBe(false);
            expect(isInvalidJsonRpcRequest({ jsonrpc: '2.0', id: 'm1', error: {} })).toBe(false);
            expect(isInvalidJsonRpcRequest({ command: 'response', messageId: 'm1' })).toBe(false);
            expect(isInvalidJsonRpcRequest('not an object')).toBe(false);
        });
    });

    describe('method params', () => {
        it('accepts valid mine-subtitle params', () => {
            expect(
                mineSubtitleParamsSchema.safeParse({
                    fields: { Front: 'hello' },
                    postMineAction: 2,
                    noteId: 17,
                }).success
            ).toBe(true);
        });

        it('rejects out-of-range postMineAction values', () => {
            expect(mineSubtitleParamsSchema.safeParse({ fields: {}, postMineAction: 5 }).success).toBe(false);
            expect(mineSubtitleParamsSchema.safeParse({ fields: {}, postMineAction: 'showAnkiDialog' }).success).toBe(
                false
            );
        });

        it('rejects invalid media ids in get-subtitles params', () => {
            expect(externalApiMethods['get-subtitles'].paramsSchema.safeParse({ mediaId: 42 }).success).toBe(false);
        });
    });

    describe('OpenRPC document', () => {
        const document = generateOpenRpcDocument({ methods: externalApiMethods, externalExtensionPortName }) as any;

        it('matches the runtime copy', () => {
            expect(document).toEqual(openRpcDocument);
        });

        it('covers the whole method registry with one result descriptor each', () => {
            const names = document.methods.map((method: any) => method.name);

            expect(names).toEqual(Object.keys(externalApiMethods));

            for (const method of document.methods) {
                expect(method.result).toEqual(expect.objectContaining({ name: 'result', schema: expect.any(Object) }));
                expect(method.paramStructure).toBe('by-name');
            }
        });

        it('describes params by name with correct required flags', () => {
            const mineSubtitle = document.methods.find((method: any) => method.name === 'mine-subtitle');

            expect(mineSubtitle.params.map((param: any) => [param.name, param.required])).toEqual([
                ['fields', true],
                ['postMineAction', true],
                ['mediaId', false],
                ['noteId', false],
            ]);
            expect(mineSubtitle.params[1].schema.anyOf.map((literal: any) => literal.const)).toEqual([0, 1, 2, 3, 4]);
        });

        it('declares no params for parameter-less methods', () => {
            for (const name of ['get-bound-media', 'approval-state', 'client-info', 'rpc.discover']) {
                expect(document.methods.find((method: any) => method.name === name).params).toEqual([]);
            }
        });

        it('documents every initialize outcome, including denied', () => {
            const initialize = document.methods.find((method: any) => method.name === 'initialize');

            expect(initialize.result.schema.properties.state.enum).toEqual(['approved', 'pending', 'denied']);
        });

        it('tags external-extension-only methods', () => {
            for (const method of document.methods) {
                const tags = method.tags.map((tag: any) => tag.name);
                const externalExtensionOnly = method.name === 'initialize' || method.name === 'approval-state';

                expect(tags.includes('external-extension-only')).toBe(externalExtensionOnly);
            }
        });

        it('declares the Unlicense and embeds no dialect headers', () => {
            expect(document.openrpc).toBe('1.0.0');
            expect(document.info.license).toEqual({ name: 'Unlicense' });
            expect(serializeOpenRpcDocument(document)).not.toContain('draft-07/schema');
        });

        it('generates draft-07 JSON Schemas without embedded dialect headers', () => {
            const schema = toJsonSchema(mineSubtitleParamsSchema, 'input') as {
                $schema?: string;
                properties?: Record<string, any>;
            };

            expect(schema.$schema).toBeUndefined();
            expect(
                schema.properties?.['postMineAction'].anyOf.map((literal: { const: number }) => literal.const)
            ).toEqual([0, 1, 2, 3, 4]);
            expect(schema.properties?.['fields']).toEqual({
                type: 'object',
                propertyNames: { type: 'string' },
                additionalProperties: { type: 'string' },
            });
        });

        it('renders params as inputs and results as outputs', () => {
            const schema = z.object({ value: z.string().default('default') });

            expect(toJsonSchema(schema, 'input')).toEqual({
                type: 'object',
                properties: { value: { type: 'string', default: 'default' } },
            });
            expect(toJsonSchema(schema, 'output')).toEqual({
                type: 'object',
                properties: { value: { type: 'string', default: 'default' } },
                required: ['value'],
                additionalProperties: false,
            });
        });
    });
});
