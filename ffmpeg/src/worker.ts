import { NativeBridge } from '@project/ffmpeg/native';
import type { NativeModule } from '@project/ffmpeg/native';
import { createInputReader } from '@project/ffmpeg/input-reader';
import type { FfmpegDiagnostics, WorkerReply, WorkerReplyBody, WorkerRequest } from '@project/ffmpeg/protocol';

// The package also compiles its main-thread API with DOM types, without WebWorker globals.
declare const FileReaderSync: { new (): { readAsArrayBuffer(blob: Blob): ArrayBuffer } };

type WorkerScope = {
    postMessage(message: WorkerReply, transfer?: Transferable[]): void;
    onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

const scope = self as unknown as WorkerScope;
let bridge: NativeBridge | undefined;
let sessionId: string | undefined;

const reply = (request: WorkerRequest, value: WorkerReplyBody, transfer?: Transferable[]) =>
    scope.postMessage({ sessionId: request.sessionId, requestId: request.requestId, ...value }, transfer);

const handleInitialize = async (request: Extract<WorkerRequest, { operation: 'initialize' }>) => {
    if (bridge !== undefined || sessionId !== undefined) throw new Error('The worker is already initialized');
    sessionId = request.sessionId;
    const imported = (await import(request.coreURL)) as {
        default: (options: { locateFile: (path: string) => string }) => Promise<NativeModule>;
    };
    const module = await imported.default({
        locateFile: (path) => (path.endsWith('.wasm') ? request.wasmURL : new URL(path, request.coreURL).href),
    });
    bridge = NativeBridge.create(module);
    return bridge.inspect();
};

const handleTranscodeAudio = (
    request: Extract<WorkerRequest, { operation: 'transcodeAudio' }>,
    bridge: NativeBridge,
    onDiagnostics: (diagnostics: FfmpegDiagnostics) => void
) => {
    if (!(request.input instanceof Blob) || !Number.isInteger(request.trackIndex) || request.trackIndex < 0) {
        throw new Error('Invalid FFmpeg audio transcode request');
    }
    return bridge.transcodeAudio(
        createInputReader(request.input, (slice) => new FileReaderSync().readAsArrayBuffer(slice)),
        request.trackIndex,
        (chunk) => {
            reply(request, { type: 'chunk', chunk }, [chunk]);
        },
        onDiagnostics
    );
};

const handleRequest = async (request: WorkerRequest) => {
    if (
        typeof request !== 'object' ||
        request === null ||
        typeof request.sessionId !== 'string' ||
        !Number.isSafeInteger(request.requestId)
    ) {
        return;
    }
    let diagnostics: FfmpegDiagnostics = { messages: [], omittedMessages: 0 };
    try {
        if (request.operation === 'initialize') {
            const result = await handleInitialize(request);
            reply(request, { ok: true, result, diagnostics });
            return;
        }
        if (request.sessionId !== sessionId || bridge === undefined) {
            throw new Error('Worker session identity mismatch');
        }
        switch (request.operation) {
            case 'inspect':
                reply(request, { ok: true, result: bridge.inspect(), diagnostics });
                break;
            case 'transcodeAudio': {
                const result = handleTranscodeAudio(request, bridge, (value) => {
                    diagnostics = value;
                });
                reply(request, { ok: true, result, diagnostics });
                break;
            }
            default:
                reply(request, {
                    ok: false,
                    error: { code: 'unsupported', message: 'Unsupported FFmpeg operation' },
                    diagnostics,
                });
        }
    } catch (error) {
        reply(request, {
            ok: false,
            error: {
                code: request.operation === 'initialize' ? 'initialization' : 'native',
                message: error instanceof Error ? error.message : 'Unknown native error',
            },
            diagnostics,
        });
    }
};

scope.onmessage = ({ data }) => void handleRequest(data);
