export type FfmpegLibraryInfo = {
    name: string;
    version: number;
    configuration: string;
    license: string;
};

export type FfmpegRuntimeInfo = {
    runtimeVersion: string;
    ffmpegVersion: string;
    ffmpegConfiguration: string;
    ffmpegLicense: string;
    linkedLibraries: string[];
    libraries: FfmpegLibraryInfo[];
    operations: string[];
};

export type FfmpegDiagnostic = {
    source: 'ffmpeg' | 'runtime';
    level: 'trace' | 'warning' | 'error';
    message: string;
    occurrences: number;
};

export type FfmpegDiagnostics = {
    messages: FfmpegDiagnostic[];
    omittedMessages: number;
};

export const diagnosticMessageLimit = 32;
export const diagnosticTextLimit = 1024;

const isDiagnostics = (value: unknown): value is FfmpegDiagnostics => {
    if (typeof value !== 'object' || value === null) return false;
    const diagnostics = value as Record<string, unknown>;
    return (
        Number.isSafeInteger(diagnostics.omittedMessages) &&
        (diagnostics.omittedMessages as number) >= 0 &&
        Array.isArray(diagnostics.messages) &&
        diagnostics.messages.length <= diagnosticMessageLimit &&
        diagnostics.messages.every((value: unknown) => {
            if (typeof value !== 'object' || value === null) return false;
            const message = value as Record<string, unknown>;
            return (
                (message.source === 'ffmpeg' || message.source === 'runtime') &&
                (message.level === 'trace' || message.level === 'warning' || message.level === 'error') &&
                typeof message.message === 'string' &&
                message.message.length <= diagnosticTextLimit &&
                Number.isSafeInteger(message.occurrences) &&
                (message.occurrences as number) > 0
            );
        })
    );
};

type RequestBase = { sessionId: string; requestId: number };

export type WorkerRequest = RequestBase &
    (
        | { operation: 'initialize'; coreURL: string; wasmURL: string }
        | { operation: 'inspect' }
        | {
              operation: 'transcodeAudio';
              input: Blob;
              trackIndex: number;
          }
    );

export type WorkerRequestBody = WorkerRequest extends infer Request
    ? Request extends RequestBase
        ? Omit<Request, keyof RequestBase>
        : never
    : never;

export type FfmpegErrorCode = 'aborted' | 'disposed' | 'initialization' | 'native' | 'protocol' | 'unsupported';

const errorCodes = new Set<FfmpegErrorCode>([
    'aborted',
    'disposed',
    'initialization',
    'native',
    'protocol',
    'unsupported',
]);

export type WorkerReply = {
    sessionId: string;
    requestId: number;
} & (
    | { ok: true; result: unknown; diagnostics: FfmpegDiagnostics }
    | { ok: false; error: { code: FfmpegErrorCode; message: string }; diagnostics: FfmpegDiagnostics }
    | { type: 'chunk'; chunk: ArrayBuffer }
);

export type WorkerReplyBody = WorkerReply extends infer Reply
    ? Reply extends { sessionId: string; requestId: number }
        ? Omit<Reply, 'sessionId' | 'requestId'>
        : never
    : never;

export const isWorkerReply = (value: unknown): value is WorkerReply => {
    if (typeof value !== 'object' || value === null) return false;
    const reply = value as Record<string, unknown>;
    if (typeof reply.sessionId !== 'string' || !Number.isSafeInteger(reply.requestId)) return false;
    if ('type' in reply) {
        return (
            reply.type === 'chunk' &&
            !('ok' in reply) &&
            reply.chunk instanceof ArrayBuffer &&
            reply.chunk.byteLength > 0
        );
    }
    if (!isDiagnostics(reply.diagnostics)) return false;
    if (reply.ok === true) return 'result' in reply;
    if (reply.ok !== false || typeof reply.error !== 'object' || reply.error === null) return false;
    const error = reply.error as Record<string, unknown>;
    return errorCodes.has(error.code as FfmpegErrorCode) && typeof error.message === 'string';
};
