import { describe, expect, it } from '@jest/globals';
import {
    externalApiMethods,
    generateOpenRpcDocument,
    jsonRpcErrorResponseSchema,
    jsonRpcNotificationSchema,
    jsonRpcRequestSchema,
    jsonRpcResultResponseSchema,
    mineSubtitleParamsSchema,
    parseJsonRpcIncomingMessage,
    serializeOpenRpcDocument,
    toJsonSchema,
} from '@project/common/external-commands/external-api';

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
            expect(externalApiMethods['get-subtitles'].paramsSchema!.safeParse({ mediaId: 42 }).success).toBe(false);
        });
    });

    describe('OpenRPC document', () => {
        const document = generateOpenRpcDocument() as any;

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
            for (const name of ['get-bound-media', 'approval-state', 'rpc.discover']) {
                expect(document.methods.find((method: any) => method.name === name).params).toEqual([]);
            }
        });

        it('tags external-extension-only methods', () => {
            for (const method of document.methods) {
                const expected = method.name === 'hello' || method.name === 'approval-state';

                expect(method.tags.map((tag: any) => tag.name).includes('external-extension-only')).toBe(expected);
            }
        });

        it('declares the Unlicense and embeds no dialect headers', () => {
            expect(document.openrpc).toBe('1.0.0');
            expect(document.info.license).toEqual({ name: 'Unlicense' });
            expect(serializeOpenRpcDocument(document)).not.toContain('draft-07/schema');
        });

        it('generates draft-07 JSON Schemas without embedded dialect headers', () => {
            const schema = toJsonSchema(mineSubtitleParamsSchema) as {
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
    });
});
