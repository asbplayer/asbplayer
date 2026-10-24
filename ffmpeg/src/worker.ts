import { NativeBridge } from '@project/ffmpeg/native';
import type { NativeModule } from '@project/ffmpeg/native';
import type { WorkerReply, WorkerReplyBody, WorkerRequest } from '@project/ffmpeg/protocol';

type WorkerScope = {
    postMessage(message: WorkerReply): void;
    onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

const scope = self as unknown as WorkerScope;
let bridge: NativeBridge | undefined;
let sessionId: string | undefined;

const reply = (request: WorkerRequest, value: WorkerReplyBody) =>
    scope.postMessage({ sessionId: request.sessionId, requestId: request.requestId, ...value });

const handleRequest = async (request: WorkerRequest) => {
    if (
        typeof request !== 'object' ||
        request === null ||
        typeof request.sessionId !== 'string' ||
        !Number.isSafeInteger(request.requestId)
    ) {
        return;
    }
    try {
        if (request.operation === 'initialize') {
            if (bridge !== undefined || sessionId !== undefined) throw new Error('The worker is already initialized');
            sessionId = request.sessionId;
            const imported = (await import(/* @vite-ignore */ request.coreURL)) as {
                default: (options: { locateFile: (path: string) => string }) => Promise<NativeModule>;
            };
            const module = await imported.default({
                locateFile: (path) => (path.endsWith('.wasm') ? request.wasmURL : new URL(path, request.coreURL).href),
            });
            bridge = NativeBridge.create(module);
            reply(request, { ok: true, result: bridge.inspect() });
            return;
        }
        if (request.sessionId !== sessionId || bridge === undefined) {
            throw new Error('Worker session identity mismatch');
        }
        if (request.operation === 'inspect') {
            reply(request, { ok: true, result: bridge.inspect() });
            return;
        }
        reply(request, { ok: false, error: { code: 'unsupported', message: 'Unsupported FFmpeg operation' } });
    } catch (error) {
        reply(request, {
            ok: false,
            error: {
                code: request.operation === 'initialize' ? 'initialization' : 'native',
                message: error instanceof Error ? error.message : 'Unknown native error',
            },
        });
    }
};

scope.onmessage = ({ data }) => void handleRequest(data);
