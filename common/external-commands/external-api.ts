import type { PostMineAction } from '@project/common/src/model';
import type {
    BoundMedia,
    Card,
    ExternalCommand,
    GetBoundMediaResponseBody,
    GetMiningHistoryCommand,
    GetMiningHistoryResponseBody,
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
    base64: z.string().describe('Base64-encoded file contents.'),
    name: z.string().describe('Name of the file, including its extension.'),
});

export const subtitleTrackSchema = z.object({
    trackNumber: z.number().describe('Track number.'),
    fileName: z.string().describe('File name of the subtitle track.'),
});

export const subtitleCueSchema = z.object({
    text: z.string().describe('Subtitle text.'),
    start: z.number().describe('Start time in milliseconds.'),
    end: z.number().describe('End time in milliseconds.'),
    track: z.number().describe('Loaded track number.'),
});

export const boundMediaSchema = z.object({
    // Derived from a hash of `streaming:<tabId>:<src>` or `local:<asbplayerId>`.
    id: z.string().describe('Identifier for the media.'),
    type: z.enum(['streaming', 'local']).describe('Type of media: `streaming` or `local`.'),
    title: z.string().optional().describe('Display title for the media, if available.'),
    faviconUrl: z.string().optional().describe('Favicon of the tab containing the media, if available.'),
    loadedSubtitles: z
        .array(subtitleTrackSchema)
        .describe('Subtitle tracks currently loaded for this media. Empty if none are loaded.'),
    active: z.boolean().describe("Whether the media's tab is the active tab of its window."),
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

export const postMineActionSchema = z
    .union(postMineActionLiterals)
    .describe(
        'What asbplayer should do after mining: 0 = none, 1 = show Anki dialog, 2 = update last card, ' +
            '3 = export card, 4 = show update card dialog.'
    );

export const mineSubtitleParamsSchema = z.object({
    fields: z.record(z.string(), z.string()).describe('Key-value pairs corresponding to an Anki note type.'),
    postMineAction: postMineActionSchema,
    mediaId: z.string().optional().describe('Optional media id from `get-bound-media`. Defaults to the active tab.'),
    noteId: z.number().optional().describe('Optional Anki note id to update when `postMineAction` is 2'),
    asbplayerCardId: z
        .uuidv4()
        .optional()
        .describe("Optional UUID for card that is saved into asbplayer's mining history."),
});

export const mineSubtitleResultSchema = z.object({
    published: z.boolean().describe('Whether the command was successfully published to an asbplayer client.'),
});

export const loadSubtitlesParamsSchema = z.object({
    files: z
        .array(subtitleFileSchema)
        .optional()
        .describe('Files to load. Each file has a name (including its extension) and base64-encoded contents.'),
    mediaId: z.string().optional().describe('Optional media id from `get-bound-media`. Omit to target the active tab.'),
});

export const loadSubtitlesResultSchema = z.object({});

export const seekTimestampParamsSchema = z.object({
    timestamp: z.number().describe('The timestamp to seek to, in seconds.'),
    mediaId: z.string().optional().describe('Optional media id from `get-bound-media`. Omit to target the active tab.'),
});

export const seekTimestampResultSchema = z.object({});

export const getBoundMediaParamsSchema = z.object({});

export const getBoundMediaResultSchema = z.object({
    media: z.array(boundMediaSchema).describe('The media asbplayer is currently tracking.'),
});

export const getSubtitlesParamsSchema = z.object({
    mediaId: z
        .string()
        .optional()
        .describe('Optional media id from `get-bound-media`. Defaults to the active tab when omitted.'),
    trackNumbers: z
        .array(z.number())
        .optional()
        .describe('Optional track numbers from `get-bound-media`. Returns all loaded tracks when omitted.'),
});

export const getSubtitlesResultSchema = z.object({
    subtitles: z.array(subtitleCueSchema).describe('Subtitles currently loaded for the media.'),
});

export const getMiningHistoryParamsSchema = z.object({
    filter: z
        .object({
            cardIds: z.array(z.string()).optional().describe('Optional target card IDs to fetch.'),
        })
        .optional()
        .describe('Filter to apply to mining history query.'),
    limit: z.int().positive().describe('Required positive limit on card count to fetch.'),
});

export const cardSchema = z.object({
    id: z.string().describe("ID of card in asbplayer's mining history."),
    subtitle: subtitleCueSchema,
    text: z.string().optional().describe('Card text'),
    word: z.string().optional().describe('Card word'),
    definition: z.string().optional().describe('Card definition'),
    customFieldValues: z.record(z.string(), z.string()).optional().describe('Map of custom field names to values'),
    url: z
        .string()
        .optional()
        .describe('Card URL - generally autofilled with the URL of the site where the card was mined'),
    audio: z
        .object({
            base64: z.string().describe('Base64-encoded audio'),
            extension: z.enum(['webm', 'mp3']).describe('Audio file extension'),
            paddingStart: z.number().describe('Audio padding start'),
            paddingEnd: z.number().describe('Audio padding end'),
            start: z.number().optional().describe('Start timestamp'),
            end: z.number().optional().describe('End timestamp'),
            playbackRate: z.number().optional().describe('Audio playback rate'),
            error: z
                .union([z.literal(1), z.literal(2), z.literal(3)])
                .optional()
                .describe('Capture error code, if present. 1 = drmProtected, 2 = fileLinkLost, 3 = captureFailed'),
        })
        .optional(),
    image: z
        .object({
            base64: z.string().describe('Base64-encoded image'),
            extension: z.enum(['jpeg', 'webm', 'webp']),
            error: z
                .union([z.literal(1), z.literal(2)])
                .optional()
                .describe('Capture error code, if present. 1 = captureFailed, 2 = fileLinkLost'),
            animated: z.boolean().optional().describe('Whether the image is animated.'),
        })
        .optional(),
});

export const getMiningHistoryResultSchema = z.object({
    cards: z.array(cardSchema).describe('Fetched cards'),
});

export const initializeParamsSchema = z.object({
    // Self-reported, untrusted; shown next to the (trusted) extension ID in the approval UI.
    name: z.string().optional().describe('Self-reported display name.'),
    version: z.string().optional().describe('Self-reported version string.'),
});

export const approvalStateSchema = z
    .enum(['approved', 'pending', 'denied'])
    .describe("External extension's user approval state.");

export const initializeResultSchema = z.object({
    state: approvalStateSchema,
});

export const approvalStateParamsSchema = z.object({});

export const approvalStateResultSchema = z.object({
    state: approvalStateSchema,
});

export const clientInfoParamsSchema = z.object({});

export const clientInfoResultSchema = z.object({
    protocols: z.array(z.literal(jsonRpcProtocol)).describe('Protocols supported by the client.'),
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
    resultSchema: z.ZodType;
    resultDescription?: string;
}

export const externalApiMethods = {
    'mine-subtitle': {
        name: 'mine-subtitle',
        summary: 'Mine the current subtitle line into Anki.',
        description:
            'Mines from the active tab by default. Set `mediaId` to an ID returned by `get-bound-media` to ' +
            'target specific media. If the media is not found or has no subtitles, `published` is `false`.\n\n' +
            'When `postMineAction` is `2`, `noteId` selects the Anki note to update. If omitted, the last-added ' +
            'note is updated. `noteId` applies to streaming media only and is ignored for local media.\n\n' +
            'The response means the flow was accepted (dispatched), not that a card was completed. Invoked as a ' +
            'notification (no id), it is published fire-and-forget and never answered, even on error.\n\n' +
            '`mediaId` and `noteId` require extension v1.20.0 or later.',
        tags: [],
        paramsSchema: mineSubtitleParamsSchema,
        resultSchema: mineSubtitleResultSchema,
        resultDescription: 'Whether the command was successfully published to an asbplayer client.',
    },
    'load-subtitles': {
        name: 'load-subtitles',
        summary: 'Load subtitle files into a player.',
        description:
            "Loads the files into the active tab's media by default, showing the video selector when the tab " +
            'has more than one video. Set `mediaId` to an ID returned by `get-bound-media` to load the files ' +
            'directly into that media.\n\n' +
            '`mediaId` requires extension v1.23.0 or later. Earlier versions load the files into every tab with ' +
            'a bound video.',
        tags: [],
        paramsSchema: loadSubtitlesParamsSchema,
        resultSchema: loadSubtitlesResultSchema,
        resultDescription: 'Empty object on success.',
    },
    'seek-timestamp': {
        name: 'seek-timestamp',
        summary: 'Seek the target media to a timestamp.',
        description:
            "Seeks the active tab's media by default. Set `mediaId` to an ID returned by `get-bound-media` to " +
            'target specific media.\n\n' +
            '`mediaId` requires extension v1.20.0+. Seeking local media requires extension v1.23.0+.',
        tags: [],
        paramsSchema: seekTimestampParamsSchema,
        resultSchema: seekTimestampResultSchema,
        resultDescription: 'Empty object on success.',
    },
    'get-bound-media': {
        name: 'get-bound-media',
        summary: 'List media currently bound to asbplayer.',
        description:
            'Returns the media asbplayer is currently tracking, including both streaming and local media.\n\n' +
            'Requires extension v1.20.0+.',
        tags: [],
        paramsSchema: getBoundMediaParamsSchema,
        resultSchema: getBoundMediaResultSchema,
        resultDescription: 'The tracked media.',
    },
    'get-subtitles': {
        name: 'get-subtitles',
        summary: 'List the subtitle cues loaded into a player.',
        description:
            'Returns the subtitles currently loaded for a piece of media. By default it targets the active ' +
            "tab's media; pass a `mediaId` from `get-bound-media` to target specific media. Returns an empty " +
            'list when no matching media is found or no subtitles are loaded.\n\n' +
            'Requires extension v1.20.0+.',
        tags: [],
        paramsSchema: getSubtitlesParamsSchema,
        resultSchema: getSubtitlesResultSchema,
        resultDescription: 'The loaded subtitle cues.',
    },
    'get-mining-history': {
        name: 'get-mining-history',
        summary: "List cards stored in asbplayer's mining history",
        description:
            "Returns cards stored in asbplayer's mining history, subject to optional filtering.\n\n" +
            'Requires extension v1.23.0+',
        tags: [],
        paramsSchema: getMiningHistoryParamsSchema,
        resultSchema: getMiningHistoryResultSchema,
        resultDescription: 'The fetched cards',
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
            'Returns asbplayer client info, such as supported protocols. The latest versions of asbplayer ' +
            'support JSON-RPC. WebSocket servers send it after connecting; a `jsonrpc-2.0` response switches ' +
            'the connection to JSON-RPC.',
        tags: [],
        paramsSchema: clientInfoParamsSchema,
        resultSchema: clientInfoResultSchema,
        resultDescription: 'The protocols supported by the client.',
    },
    'rpc.discover': {
        name: 'rpc.discover',
        summary: 'Discover the API surface.',
        description:
            'Returns the OpenRPC document for the running build. Use it to discover the current method names, ' +
            'params, results, and transport tags instead of hard-coding them.',
        tags: [],
        paramsSchema: z.object({}),
        resultSchema: z.looseObject({}),
        resultDescription: 'The OpenRPC document describing the supported JSON-RPC methods.',
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
    getMiningHistoryParams: ExpectTrue<
        MatchesSchema<typeof getMiningHistoryParamsSchema, GetMiningHistoryCommand['body']>
    >;
    getMiningHistoryResult: ExpectTrue<
        MatchesSchema<typeof getMiningHistoryResultSchema, GetMiningHistoryResponseBody>
    >;
    seekTimestampParams: ExpectTrue<MatchesSchema<typeof seekTimestampParamsSchema, SeekTimestampCommand['body']>>;
    getSubtitlesParams: ExpectTrue<MatchesSchema<typeof getSubtitlesParamsSchema, GetSubtitlesCommand['body']>>;
    mineSubtitleResult: ExpectTrue<MatchesSchema<typeof mineSubtitleResultSchema, MineSubtitleResponseBody>>;
    getBoundMediaResult: ExpectTrue<MatchesSchema<typeof getBoundMediaResultSchema, GetBoundMediaResponseBody>>;
    getSubtitlesResult: ExpectTrue<MatchesSchema<typeof getSubtitlesResultSchema, GetSubtitlesResponseBody>>;
    boundMedia: ExpectTrue<MatchesSchema<typeof boundMediaSchema, BoundMedia>>;
    subtitleFile: ExpectTrue<MatchesSchema<typeof subtitleFileSchema, SubtitleFile>>;
    subtitleTrack: ExpectTrue<MatchesSchema<typeof subtitleTrackSchema, SubtitleTrack>>;
    subtitleCue: ExpectTrue<MatchesSchema<typeof subtitleCueSchema, SubtitleCue>>;
    card: ExpectTrue<MatchesSchema<typeof cardSchema, Card>>;
}
