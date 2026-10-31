import { createFfmpegSession } from '@project/ffmpeg/session';
import type { FfmpegWorker } from '@project/ffmpeg/session';
import { ffmpegMetadata } from '@project/ffmpeg/metadata';
import type { WorkerReply, WorkerRequest } from '@project/ffmpeg/protocol';
import type { AudioTranscodeHost } from '@project/common/audio-transcode/audio-transcoder';

export const webmHeader = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x80, 0x18, 0x53, 0x80, 0x67, 0xff, 0x15, 0x49, 0xa9, 0x66, 0x92, 0x2a, 0xd7, 0xb1, 0x83,
    0x0f, 0x42, 0x40, 0x44, 0x89, 0x88, 0x40, 0x69, 0x00, 0, 0, 0, 0, 0,
]);

// A worker is the native execution boundary. Sessions and feature orchestration remain real.
export class TestWorker implements FfmpegWorker {
    readonly target = new EventTarget();
    active = true;
    private outputStarted = false;
    input?: Blob;
    pending?: WorkerRequest;
    readonly started: Promise<void>;
    private start!: () => void;

    constructor(private readonly host: TestHost) {
        this.started = new Promise((resolve) => {
            this.start = resolve;
        });
    }

    postMessage(request: WorkerRequest) {
        this.pending = request;
        if (request.operation === 'transcodeAudio') {
            this.input = request.input;
            this.start();
            if (!this.host.autoComplete) return;
        }
        if (request.operation === 'initialize' && !this.host.autoInitialize) {
            this.start();
            return;
        }
        queueMicrotask(() => this.complete());
    }

    complete() {
        const request = this.pending!;
        const diagnostics = { messages: [], omittedMessages: 0 };
        let reply: WorkerReply;
        if (request.operation === 'transcodeAudio') {
            const error = this.host.error;
            if (!error) this.chunk(new Uint8Array([1, 2, 3]).buffer);
            reply = error
                ? { ...request, ok: false, error: { code: 'native', message: error }, diagnostics }
                : { ...request, ok: true, result: 5, diagnostics };
        } else {
            reply = {
                ...request,
                ok: true,
                diagnostics,
                result: {
                    ...ffmpegMetadata,
                    ffmpegConfiguration: '',
                    ffmpegLicense: '',
                    libraries: [],
                    linkedLibraries: [],
                    operations: ['inspect', 'transcodeAudio'],
                },
            };
        }
        this.target.dispatchEvent(new MessageEvent('message', { data: reply }));
    }

    chunk(chunk: ArrayBuffer) {
        const request = this.pending!;
        const send = (chunk: ArrayBuffer) =>
            this.target.dispatchEvent(
                new MessageEvent('message', {
                    data: { sessionId: request.sessionId, requestId: request.requestId, type: 'chunk', chunk },
                })
            );
        if (!this.outputStarted) {
            this.outputStarted = true;
            send(webmHeader.slice().buffer);
        }
        send(chunk);
    }

    terminate() {
        this.active = false;
    }
    addEventListener(type: 'message' | 'error' | 'messageerror', listener: EventListener) {
        this.target.addEventListener(type, listener);
    }
    removeEventListener(type: 'message' | 'error' | 'messageerror', listener: EventListener) {
        this.target.removeEventListener(type, listener);
    }
}

export class TestHost implements AudioTranscodeHost {
    supportsAudioPlayback = () => true;
    autoInitialize = true;
    autoComplete = true;
    error?: string;
    prepareError?: Error;
    readonly workers: TestWorker[] = [];
    createSession: AudioTranscodeHost['createSession'] = ({ signal }) =>
        createFfmpegSession({
            signal,
            onDiagnostics: () => {},
            workerFactory: () => {
                const worker = new TestWorker(this);
                this.workers.push(worker);
                return worker;
            },
            prepareAssets: async () => {
                if (this.prepareError) throw this.prepareError;
                return {
                    workerURL: 'blob:worker',
                    coreURL: 'blob:core',
                    wasmURL: 'blob:wasm',
                    dispose() {},
                };
            },
        });
}
