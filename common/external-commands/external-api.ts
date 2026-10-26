import type { PostMineAction } from '@project/common/src/model';
import { z } from 'zod';

// Zod schemas for asbplayer's external API: the JSON-RPC 2.0 wire protocol spoken by
//
//   * the WebSocket servers (the Go server in scripts/web-socket-server and the Anki addon server
//     in plugins/anki/asbplayer-addon), and
//   * the external extension API (browser.runtime ports named `asbplayer-external-v1`),
//
// as opposed to asbplayer's internal messaging, which is not covered here. Method names are
// identical to the legacy `{command, messageId, body}` command strings in ./commands.ts, whose
// frames remain accepted alongside JSON-RPC frames during the migration. The OpenRPC document
// committed to external-api/openrpc.json is generated from the method registry below.

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 envelope
// ---------------------------------------------------------------------------

// Ids are uuid strings.
export const jsonRpcIdSchema = z.string();

export const jsonRpcVersionSchema = z.literal('2.0');

// `params` is validated per-method by `externalApiMethods`.
export const jsonRpcRequestSchema = z.object({
    jsonrpc: jsonRpcVersionSchema,
    method: z.string(),
    id: jsonRpcIdSchema,
    params: z.unknown().optional(),
});

// Notifications must never be answered.
export const jsonRpcNotificationSchema = z.object({
    jsonrpc: jsonRpcVersionSchema,
    method: z.string(),
    id: z.undefined().optional(),
    params: z.unknown().optional(),
});

export const jsonRpcIncomingMessageSchema = z.union([jsonRpcRequestSchema, jsonRpcNotificationSchema]);

export const jsonRpcErrorCodes = {
    parseError: -32700,
    invalidRequest: -32600,
    methodNotFound: -32601,
    invalidParams: -32602,
    internalError: -32603,
    // Server-defined range (-32000..-32099):
    // No connected asbplayers. Maps to HTTP 503.
    noClients: -32001,
    // Timed out awaiting an asbplayer response. Maps to HTTP 503.
    requestTimeout: -32000,
    // The extension has not been approved yet.
    notApproved: -32002,
} as const;

export type JsonRpcErrorCode = (typeof jsonRpcErrorCodes)[keyof typeof jsonRpcErrorCodes];

export const jsonRpcErrorObjectSchema = z.object({
    code: z.number().int(),
    message: z.string(),
    data: z.unknown().optional(),
});

export const jsonRpcResultResponseSchema = z.object({
    jsonrpc: jsonRpcVersionSchema,
    id: jsonRpcIdSchema,
    result: z.unknown(),
});

export const jsonRpcErrorResponseSchema = z.object({
    jsonrpc: jsonRpcVersionSchema,
    id: jsonRpcIdSchema,
    error: jsonRpcErrorObjectSchema,
});

export const jsonRpcResponseSchema = z.union([jsonRpcResultResponseSchema, jsonRpcErrorResponseSchema]);

export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;
export type JsonRpcNotification = z.infer<typeof jsonRpcNotificationSchema>;
export type JsonRpcIncomingMessage = z.infer<typeof jsonRpcIncomingMessageSchema>;
export type JsonRpcSuccessResponse = z.infer<typeof jsonRpcResultResponseSchema>;
export type JsonRpcErrorResponse = z.infer<typeof jsonRpcErrorResponseSchema>;
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;

// Returns undefined for frames that are not JSON-RPC requests or notifications.
export function parseJsonRpcIncomingMessage(message: unknown): JsonRpcIncomingMessage | undefined {
    if (typeof message !== 'object' || message === null) {
        return undefined;
    }

    const { jsonrpc, method, id, params } = message as Record<string, unknown>;

    if (jsonrpc !== '2.0' || typeof method !== 'string') {
        return undefined;
    }

    const shape = id === undefined ? { jsonrpc, method, params } : { jsonrpc, method, id, params };
    const parsed = jsonRpcIncomingMessageSchema.safeParse(shape);

    return parsed.success ? parsed.data : undefined;
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export const subtitleFileSchema = z.object({
    base64: z.string(),
    name: z.string(),
});

export const subtitleTrackSchema = z.object({
    trackNumber: z.number(),
    fileName: z.string(),
});

export const subtitleCueSchema = z.object({
    text: z.string(),
    start: z.number(),
    end: z.number(),
    track: z.number(),
});

export const boundMediaSchema = z.object({
    // Derived from a hash of `streaming:<tabId>:<src>` or `local:<asbplayerId>`.
    id: z.string(),
    type: z.enum(['streaming', 'local']),
    title: z.string().optional(),
    faviconUrl: z.string().optional(),
    loadedSubtitles: z.array(subtitleTrackSchema),
    active: z.boolean(),
});

// ---------------------------------------------------------------------------
// Method params and results
// ---------------------------------------------------------------------------

// Keep in sync with the PostMineAction enum in @project/common/src/model. Not modeled on the
// enum itself: TS enums cannot be loaded by Node's type-stripping (which runs the OpenRPC
// generator importing this module), and zod's JSON Schema output for numeric enums is
// unrepresentable.
const postMineActionLiterals = [z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)] as const;
type PostMineActionValuesMatch =
    Exclude<PostMineAction, (typeof postMineActionLiterals)[number]['value']> extends never ? true : never;
const _postMineActionValuesMatch: PostMineActionValuesMatch = true;
void _postMineActionValuesMatch;

export const postMineActionSchema = z.union(postMineActionLiterals);

export const mineSubtitleParamsSchema = z.object({
    fields: z.record(z.string(), z.string()),
    postMineAction: postMineActionSchema,
    mediaId: z.string().optional(),
    noteId: z.number().optional(),
});

export const mineSubtitleResultSchema = z.object({
    published: z.boolean(),
});

export const loadSubtitlesParamsSchema = z.object({
    files: z.array(subtitleFileSchema).optional(),
    mediaId: z.string().optional(),
});

export const loadSubtitlesResultSchema = z.object({});

export const seekTimestampParamsSchema = z.object({
    timestamp: z.number(),
    mediaId: z.string().optional(),
});

export const seekTimestampResultSchema = z.object({});

export const getBoundMediaParamsSchema = z.object({});

export const getBoundMediaResultSchema = z.object({
    media: z.array(boundMediaSchema),
});

export const getSubtitlesParamsSchema = z.object({
    mediaId: z.string().optional(),
    trackNumbers: z.array(z.number()).optional(),
});

export const getSubtitlesResultSchema = z.object({
    subtitles: z.array(subtitleCueSchema),
});

export const helloParamsSchema = z.object({
    // Self-reported, untrusted; shown next to the (trusted) extension ID in the approval UI.
    name: z.string().optional(),
    version: z.string().optional(),
});

// Returns immediately. On first contact, the connection is registered as pending and the
// approval prompt is shown (at most once per pending state); the client polls `approval-state`.
export const helloResultSchema = z.object({
    state: z.enum(['approved', 'pending']),
});

export const approvalStateParamsSchema = z.object({});

// Pure read; never triggers approval prompts. `denied` is returned at most once before the
// connection is closed.
export const approvalStateResultSchema = z.object({
    state: z.enum(['approved', 'pending', 'denied']),
});

// ---------------------------------------------------------------------------
// Method registry
// ---------------------------------------------------------------------------

// Methods tagged this exist only on the external extension API; the WebSocket servers answer
// -32601 when one is invoked.
export const externalExtensionOnlyTag = 'external-extension-only';

export interface ExternalApiMethod {
    name: string;
    summary: string;
    description: string;
    tags: string[];
    paramsSchema?: z.ZodType;
    paramDescriptions?: Record<string, string>;
    resultSchema: z.ZodType;
    resultDescription?: string;
}

export const externalApiMethods: Record<string, ExternalApiMethod> = {
    'mine-subtitle': {
        name: 'mine-subtitle',
        summary: 'Dispatch the mining flow for the given Anki fields.',
        description:
            'Runs the mining flow for the given Anki fields. The response means the flow was accepted ' +
            '(dispatched), not that a card was completed - the user may still be interacting with the Anki ' +
            'dialog long after the response. Invoked as a notification (no id), it is published fire-and-forget ' +
            'and never answered, even on error.',
        tags: [],
        paramsSchema: mineSubtitleParamsSchema,
        paramDescriptions: {
            fields: 'Anki field name to value mapping.',
            postMineAction: 'What asbplayer should do after mining (PostMineAction values 0-4).',
            mediaId: 'Target media. Omit to target the active media.',
            noteId: 'Id of an existing note to update.',
        },
        resultSchema: mineSubtitleResultSchema,
        resultDescription: 'Whether the command was accepted and dispatched to the mining flow.',
    },
    'load-subtitles': {
        name: 'load-subtitles',
        summary: 'Load subtitle files into a player.',
        description: 'Loads the given subtitle files into the media identified by `mediaId`.',
        tags: [],
        paramsSchema: loadSubtitlesParamsSchema,
        paramDescriptions: {
            files: 'Subtitle files, base64-encoded, with their file names.',
            mediaId: 'Target media. Omit to target the active media.',
        },
        resultSchema: loadSubtitlesResultSchema,
        resultDescription: 'Empty object on success.',
    },
    'seek-timestamp': {
        name: 'seek-timestamp',
        summary: 'Seek the target media to a timestamp.',
        description: 'Seeks the media identified by `mediaId` to the given timestamp.',
        tags: [],
        paramsSchema: seekTimestampParamsSchema,
        paramDescriptions: {
            timestamp: 'Timestamp to seek to, in seconds.',
            mediaId: 'Target media. Omit to target the active media.',
        },
        resultSchema: seekTimestampResultSchema,
        resultDescription: 'Empty object on success.',
    },
    'get-bound-media': {
        name: 'get-bound-media',
        summary: 'List media currently bound to asbplayer.',
        description: 'Returns every media (streaming video elements and asbplayer instances) currently known.',
        tags: [],
        paramsSchema: getBoundMediaParamsSchema,
        resultSchema: getBoundMediaResultSchema,
        resultDescription: 'The bound media.',
    },
    'get-subtitles': {
        name: 'get-subtitles',
        summary: 'List the subtitle cues loaded into a player.',
        description: 'Returns the subtitle cues currently loaded into the media identified by `mediaId`.',
        tags: [],
        paramsSchema: getSubtitlesParamsSchema,
        paramDescriptions: {
            mediaId: 'Target media. Omit to target the active media.',
            trackNumbers: 'Restrict the result to these subtitle tracks. Omit to return all tracks.',
        },
        resultSchema: getSubtitlesResultSchema,
        resultDescription: 'The loaded subtitle cues.',
    },
    hello: {
        name: 'hello',
        summary: 'Register and request approval (external extension API).',
        description:
            'Handshake sent by an external extension right after connecting. Returns the current approval state ' +
            "immediately: `{state: 'approved'}` when the extension is already approved, otherwise the connection " +
            'is registered as pending, the approval prompt is shown (at most once per pending state), and the ' +
            "response is `{state: 'pending'}`. Idempotent. On denial, `approval-state` returns `{state: 'denied'}` " +
            'once and the connection is closed.',
        tags: [externalExtensionOnlyTag],
        paramsSchema: helloParamsSchema,
        paramDescriptions: {
            name: 'Self-reported display name.',
            version: 'Self-reported version string.',
        },
        resultSchema: helloResultSchema,
        resultDescription: "The current approval state: `'approved'` or `'pending'`.",
    },
    'approval-state': {
        name: 'approval-state',
        summary: 'Read the current approval state (external extension API).',
        description:
            "Pure read of the connection's approval state; never triggers approval prompts. Poll this roughly " +
            "every second while pending. `{state: 'denied'}` is returned at most once, after which the " +
            'connection is closed.',
        tags: [externalExtensionOnlyTag],
        paramsSchema: approvalStateParamsSchema,
        resultSchema: approvalStateResultSchema,
        resultDescription: "The current approval state: `'approved'`, `'pending'`, or `'denied'`.",
    },
    'rpc.discover': {
        name: 'rpc.discover',
        summary: 'Discover the API surface.',
        description: 'Returns the OpenRPC document describing this API.',
        tags: [],
        resultSchema: z.looseObject({}),
        resultDescription: 'An OpenRPC document.',
    },
};

// ---------------------------------------------------------------------------
// OpenRPC document
// ---------------------------------------------------------------------------

// scripts/generate-openrpc.ts commits the result to external-api/openrpc.json.

interface JsonSchemaObject {
    properties?: Record<string, object>;
    required?: string[];
    [key: string]: unknown;
}

interface ContentDescriptor {
    name: string;
    required?: boolean;
    schema: object;
    description?: string;
}

interface MethodDefinition {
    name: string;
    summary: string;
    description: string;
    tags: { name: string }[];
    paramStructure: 'by-name';
    params: ContentDescriptor[];
    result: ContentDescriptor;
}

function methodDefinition(method: ExternalApiMethod): MethodDefinition {
    let params: ContentDescriptor[] = [];

    if (method.paramsSchema !== undefined) {
        const schema = toJsonSchema(method.paramsSchema) as JsonSchemaObject;
        const required = schema.required ?? [];
        const propertyNames = Object.keys(schema.properties ?? {});

        if (propertyNames.length > 0) {
            params = propertyNames.map((name) => ({
                name,
                required: required.includes(name),
                schema: schema.properties![name],
                description: method.paramDescriptions?.[name],
            }));
        }
    }

    return {
        name: method.name,
        summary: method.summary,
        description: method.description,
        tags: method.tags.map((name) => ({ name })),
        paramStructure: 'by-name',
        params,
        result: {
            name: 'result',
            schema: toJsonSchema(method.resultSchema),
            description: method.resultDescription,
        },
    };
}

export function generateOpenRpcDocument(): object {
    return {
        openrpc: '1.0.0',
        info: {
            title: 'asbplayer External API',
            version: '1.0.0',
            description:
                'JSON-RPC 2.0 API for external clients of asbplayer: the WebSocket servers (Go server, Anki addon ' +
                'server) and the external extension API (browser.runtime port `asbplayer-external-v1`). See ' +
                'external-api/README.md for transport framings, error codes, and licensing.',
            license: {
                name: 'Unlicense',
            },
        },
        methods: Object.values(externalApiMethods).map(methodDefinition),
    };
}

export function serializeOpenRpcDocument(document: object): string {
    return `${JSON.stringify(document, null, 4)}\n`;
}

// ---------------------------------------------------------------------------
// JSON Schema helper
// ---------------------------------------------------------------------------

// JSON Schema (draft-07) generation. Strips the injected `$schema` header since the schemas are
// embedded inside the OpenRPC document, which declares the dialect itself.
export function toJsonSchema(schema: z.ZodType): object {
    const { $schema, ...jsonSchema } = z.toJSONSchema(schema, { target: 'draft-7', io: 'input' });

    void $schema;

    return jsonSchema;
}
