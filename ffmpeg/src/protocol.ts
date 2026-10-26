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

type RequestBase = { sessionId: string; requestId: number };

export type WorkerRequest = RequestBase &
    ({ operation: 'initialize'; coreURL: string; wasmURL: string } | { operation: 'inspect' });

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
} & ({ ok: true; result: unknown } | { ok: false; error: { code: FfmpegErrorCode; message: string } });

export type WorkerReplyBody = WorkerReply extends infer Reply
    ? Reply extends { sessionId: string; requestId: number }
        ? Omit<Reply, 'sessionId' | 'requestId'>
        : never
    : never;

export const isWorkerReply = (value: unknown): value is WorkerReply => {
    if (typeof value !== 'object' || value === null) return false;
    const reply = value as Partial<WorkerReply>;
    if (typeof reply.sessionId !== 'string' || !Number.isSafeInteger(reply.requestId)) return false;
    if (reply.ok === true) return 'result' in reply;
    if (reply.ok !== false || typeof reply.error !== 'object' || reply.error === null) return false;
    const error = reply.error as Record<string, unknown>;
    return errorCodes.has(error.code as FfmpegErrorCode) && typeof error.message === 'string';
};
