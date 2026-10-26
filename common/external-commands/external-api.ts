import type { PostMineAction } from '@project/common/src/model';
import type {
    BoundMedia,
    ExternalCommand,
    GetBoundMediaResponseBody,
    GetSubtitlesCommand,
    GetSubtitlesResponseBody,
    LoadSubtitlesCommand,
    MineSubtitleCommand,
    MineSubtitleResponseBody,
    SeekTimestampCommand,
    SubtitleCue,
    SubtitleFile,
    SubtitleTrack,
} from '@project/common/external-commands/commands';
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

export const jsonRpcProtocol = 'jsonrpc-2.0';

// The external extension port must use this name so a future protocol can be distinguished.
export const externalExtensionPortName = 'asbplayer-external-v1';

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
    // Null when the id is unknown (parse and invalid-request errors).
    id: jsonRpcIdSchema.nullable(),
    error: jsonRpcErrorObjectSchema,
});

export const jsonRpcResponseSchema = z.union([jsonRpcResultResponseSchema, jsonRpcErrorResponseSchema]);

export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;
export type JsonRpcNotification = z.infer<typeof jsonRpcNotificationSchema>;
export type JsonRpcIncomingMessage = z.infer<typeof jsonRpcIncomingMessageSchema>;
export type JsonRpcSuccessResponse = z.infer<typeof jsonRpcResultResponseSchema>;
export type JsonRpcErrorResponse = z.infer<typeof jsonRpcErrorResponseSchema>;
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;

export function jsonRpcSuccess(id: string, result: unknown): JsonRpcSuccessResponse {
    return { jsonrpc: '2.0', id, result };
}

export function jsonRpcError(id: string | null, code: number, message: string, data?: unknown): JsonRpcErrorResponse {
    return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

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

// A JSON-RPC request frame that failed envelope validation, so callers can answer -32600.
// Responses are never answered.
export function isInvalidJsonRpcRequest(message: unknown): boolean {
    if (typeof message !== 'object' || message === null) {
        return false;
    }

    const frame = message as Record<string, unknown>;

    if (frame.jsonrpc !== '2.0' || 'result' in frame || 'error' in frame) {
        return false;
    }

    if (typeof frame.method === 'string') {
        // A valid request has a string id; a valid notification has no id at all.
        return 'id' in frame && typeof frame.id !== 'string';
    }

    // No method and no result/error: a request-like frame with an unusable envelope.
    return true;
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

export const initializeParamsSchema = z.object({
    // Self-reported, untrusted; shown next to the (trusted) extension ID in the approval UI.
    name: z.string().optional(),
    version: z.string().optional(),
});

// Returns immediately. On first contact, the connection is registered as pending and the
// approval prompt is shown (at most once per pending state); the client polls `approval-state`.
// `denied` while a denial cooldown is active.
export const initializeResultSchema = z.object({
    state: z.enum(['approved', 'pending', 'denied']),
});

export const approvalStateParamsSchema = z.object({});

// Pure read; never triggers approval prompts. `denied` is returned at most once before the
// connection is closed.
export const approvalStateResultSchema = z.object({
    state: z.enum(['approved', 'pending', 'denied']),
});

export const clientInfoParamsSchema = z.object({});

export const clientInfoResultSchema = z.object({
    protocols: z.array(z.literal(jsonRpcProtocol)),
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
    paramsSchema: z.ZodType;
    paramDescriptions?: Record<string, string>;
    resultSchema: z.ZodType;
    resultDescription?: string;
}

export const externalApiMethods = {
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
    initialize: {
        name: 'initialize',
        summary: 'Register and request approval (external extension API).',
        description:
            'Handshake sent by an external extension right after connecting. Returns the current approval state ' +
            "immediately: `{state: 'approved'}` when the extension is already approved, otherwise the connection " +
            'is registered as pending, the approval prompt is shown (at most once per pending state), and the ' +
            "response is `{state: 'pending'}`. Returns `{state: 'denied'}` while a denial cooldown is active, " +
            'after which the connection is closed. Idempotent.',
        tags: [externalExtensionOnlyTag],
        paramsSchema: initializeParamsSchema,
        paramDescriptions: {
            name: 'Self-reported display name.',
            version: 'Self-reported version string.',
        },
        resultSchema: initializeResultSchema,
        resultDescription: "The current approval state: `'approved'`, `'pending'`, or `'denied'`.",
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
    'client-info': {
        name: 'client-info',
        summary: 'Report the client protocol capabilities.',
        description:
            'Server-initiated probe sent after the client connects. Returns the protocols the client supports; ' +
            'servers use a `jsonrpc-2.0` result to switch the connection from legacy framing to JSON-RPC.',
        tags: [],
        paramsSchema: clientInfoParamsSchema,
        resultSchema: clientInfoResultSchema,
        resultDescription: 'The protocols supported by the client.',
    },
    'rpc.discover': {
        name: 'rpc.discover',
        summary: 'Discover the API surface.',
        description: 'Returns the OpenRPC document describing this API.',
        tags: [],
        paramsSchema: z.object({}),
        resultSchema: z.looseObject({}),
        resultDescription: 'An OpenRPC document.',
    },
} satisfies Record<string, ExternalApiMethod>;

export type ExternalApiMethodName = keyof typeof externalApiMethods;

// Registry methods that are not ExternalCommand handlers.
type ExternalApiSpecialMethodName = 'initialize' | 'approval-state' | 'client-info' | 'rpc.discover';
type ExternalApiDispatchedMethodName = ExternalCommand['command'];

type ExpectTrue<T extends true> = T;

// Every registry method must be an ExternalCommand name or listed as special above, and vice versa.
export type ExternalApiMethodCoverage = ExpectTrue<
    Exclude<ExternalApiMethodName, ExternalApiDispatchedMethodName | ExternalApiSpecialMethodName> extends never
        ? Exclude<ExternalApiDispatchedMethodName | ExternalApiSpecialMethodName, ExternalApiMethodName> extends never
            ? true
            : false
        : false
>;

// Own properties only, so prototype names never resolve as methods.
export function externalApiMethod(name: string): ExternalApiMethod | undefined {
    return Object.hasOwn(externalApiMethods, name) ? externalApiMethods[name as ExternalApiMethodName] : undefined;
}

// ---------------------------------------------------------------------------
// Schema/wire-type drift guards
// ---------------------------------------------------------------------------

// Keys and optionality must match in both directions; values are checked separately because the
// schemas narrow some fields (e.g. postMineAction).
type SameShape<A, B> = [keyof A, keyof B] extends [keyof B, keyof A]
    ? {
          [K in keyof A & keyof B]-?: undefined extends A[K]
              ? undefined extends B[K]
                  ? true
                  : false
              : undefined extends B[K]
                ? false
                : true;
      }[keyof A & keyof B] extends true
        ? true
        : false
    : false;

type MatchesSchema<S extends z.ZodType, Wire> =
    SameShape<z.infer<S>, Wire> extends true ? (z.infer<S> extends Wire ? true : false) : false;

// Each schema must match its wire type in ./commands.ts.
export interface ExternalApiSchemaChecks {
    mineSubtitleParams: ExpectTrue<MatchesSchema<typeof mineSubtitleParamsSchema, MineSubtitleCommand['body']>>;
    loadSubtitlesParams: ExpectTrue<MatchesSchema<typeof loadSubtitlesParamsSchema, LoadSubtitlesCommand['body']>>;
    seekTimestampParams: ExpectTrue<MatchesSchema<typeof seekTimestampParamsSchema, SeekTimestampCommand['body']>>;
    getSubtitlesParams: ExpectTrue<MatchesSchema<typeof getSubtitlesParamsSchema, GetSubtitlesCommand['body']>>;
    mineSubtitleResult: ExpectTrue<MatchesSchema<typeof mineSubtitleResultSchema, MineSubtitleResponseBody>>;
    getBoundMediaResult: ExpectTrue<MatchesSchema<typeof getBoundMediaResultSchema, GetBoundMediaResponseBody>>;
    getSubtitlesResult: ExpectTrue<MatchesSchema<typeof getSubtitlesResultSchema, GetSubtitlesResponseBody>>;
    boundMedia: ExpectTrue<MatchesSchema<typeof boundMediaSchema, BoundMedia>>;
    subtitleFile: ExpectTrue<MatchesSchema<typeof subtitleFileSchema, SubtitleFile>>;
    subtitleTrack: ExpectTrue<MatchesSchema<typeof subtitleTrackSchema, SubtitleTrack>>;
    subtitleCue: ExpectTrue<MatchesSchema<typeof subtitleCueSchema, SubtitleCue>>;
}
