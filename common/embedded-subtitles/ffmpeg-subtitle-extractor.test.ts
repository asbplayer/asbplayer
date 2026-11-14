/** @jest-environment node */
import { expect, it } from '@jest/globals';
import { createFfmpegSession } from '@project/ffmpeg/session';
import type { FfmpegWorker } from '@project/ffmpeg/session';
import { ffmpegSubtitleFormats } from '@project/ffmpeg/protocol';
import type { WorkerRequest, WorkerReply } from '@project/ffmpeg/protocol';
import { ffmpegMetadata } from '@project/ffmpeg/metadata';
import { extractSubtitleTracks } from '@project/common/embedded-subtitles/ffmpeg-subtitle-extractor';

// Fake only the native worker boundary; exercise real sessions, cancellation and Blob assembly.
class SubtitleWorker extends EventTarget implements FfmpegWorker {
    active = true;
    input?: Blob;
    pending?: WorkerRequest;

    constructor(private readonly host: Host) {
        super();
    }

    postMessage(request: WorkerRequest) {
        this.pending = request;
        if (request.operation === 'initialize' && !this.host.autoInitialize) return;
        if (request.operation === 'extractSubtitles') {
            this.input = request.input;
            if (!this.host.autoComplete) return;
        }
        queueMicrotask(() => this.complete());
    }

    complete() {
        const request = this.pending!;
        const diagnostics = { messages: [], omittedMessages: 0 };
        let reply: WorkerReply;
        if (request.operation === 'extractSubtitles') {
            this.chunk(2, [1, 2]);
            this.chunk(9, [4, 5]);
            this.chunk(2, [3]);
            reply = this.host.error
                ? { ...request, ok: false, error: { code: 'native', message: this.host.error }, diagnostics }
                : {
                      ...request,
                      ok: true,
                      diagnostics,
                      result: request.trackIndexes.map((trackIndex) => ({
                          trackIndex,
                          extension:
                              this.host.bitmap && trackIndex === 9 ? ffmpegSubtitleFormats.image.extension : 'srt',
                          mimeType:
                              this.host.bitmap && trackIndex === 9
                                  ? ffmpegSubtitleFormats.image.mimeType
                                  : 'application/x-subrip',
                      })),
                  };
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
                    operations: ['inspect', 'extractSubtitles'],
                },
            };
        }
        this.dispatchEvent(new MessageEvent('message', { data: reply }));
    }

    chunk(trackIndex: number, bytes: number[]) {
        this.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    sessionId: this.pending!.sessionId,
                    requestId: this.pending!.requestId,
                    type: 'chunk',
                    trackIndex,
                    chunk: new Uint8Array(bytes).buffer,
                },
            })
        );
    }

    terminate() {
        this.active = false;
    }
}

class Host {
    bitmap = false;
    autoInitialize = true;
    autoComplete = true;
    error?: string;
    workers: SubtitleWorker[] = [];
    createSession = ({ signal }: { signal: AbortSignal }) =>
        createFfmpegSession({
            signal,
            onDiagnostics: () => {},
            workerFactory: () => {
                const worker = new SubtitleWorker(this);
                this.workers.push(worker);
                return worker;
            },
            prepareAssets: async () => ({
                workerURL: 'blob:worker',
                coreURL: 'blob:core',
                wasmURL: 'blob:wasm',
                dispose: () => {},
            }),
        });
}

const file = new File(['media'], 'episode.mkv');

it('forwards subtitle bytes while extraction is still running', async () => {
    const host = new Host();
    host.autoComplete = false;
    const chunks: number[][] = [];
    const pending = run(host, new AbortController().signal, [2, 9, 5], (index, chunk) =>
        chunks.push([index, ...new Uint8Array(chunk)])
    );
    await new Promise(setImmediate);
    host.workers[0].chunk(2, [9, 8]);
    expect(chunks).toEqual([[2, 9, 8]]);
    expect(host.workers[0].active).toBe(true);
    host.workers[0].complete();
    const files = await pending;
    expect([...new Uint8Array(await files[0].blob.arrayBuffer())]).toEqual([9, 8, 1, 2, 3]);
});

const run = (
    host: Host,
    signal = new AbortController().signal,
    trackIndexes = [2, 9, 5],
    onChunk: (index: number, chunk: ArrayBuffer) => void = () => {}
) => extractSubtitleTracks({ file, fileId: 'video', trackIndexes, signal, onChunk, createSession: host.createSession });

it('assembles interleaved text outputs, including empty tracks, then releases the worker', async () => {
    const host = new Host();
    const files = await run(host);
    expect(host.workers[0].input).toBe(file);
    expect(files.map(({ trackIndex, format, blob }) => [trackIndex, format, blob.type])).toEqual([
        [2, 'srt', 'application/x-subrip'],
        [9, 'srt', 'application/x-subrip'],
        [5, 'srt', 'application/x-subrip'],
    ]);
    expect(await Promise.all(files.map(async ({ blob }) => [...new Uint8Array(await blob.arrayBuffer())]))).toEqual([
        [1, 2, 3],
        [4, 5],
        [],
    ]);
    expect(host.workers[0].active).toBe(false);
});

it('assembles mixed bitmap and text output with their actual formats', async () => {
    const host = new Host();
    host.bitmap = true;
    const files = await run(host);
    expect(files.map(({ trackIndex, format, blob }) => [trackIndex, format, blob.type])).toEqual([
        [2, 'srt', 'application/x-subrip'],
        [9, ffmpegSubtitleFormats.image.extension, ffmpegSubtitleFormats.image.mimeType],
        [5, 'srt', 'application/x-subrip'],
    ]);
    expect([...new Uint8Array(await files[1].blob.arrayBuffer())]).toEqual([4, 5]);
});

it.each(['initializing', 'extracting'])('terminates %s work on cancellation and allows retry', async (stage) => {
    const host = new Host();
    host.autoInitialize = stage !== 'initializing';
    host.autoComplete = false;
    const controller = new AbortController();
    const pending = run(host, controller.signal);
    await new Promise(setImmediate);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'aborted' });
    expect(host.workers[0].active).toBe(false);
    host.autoInitialize = true;
    host.autoComplete = true;
    expect(await run(host)).toHaveLength(3);
    expect(host.workers).toHaveLength(2);
    expect(host.workers.every((worker) => !worker.active)).toBe(true);
});

it('releases failed extraction without returning partial data and retries with a fresh worker', async () => {
    const host = new Host();
    host.error = 'Extraction failed';
    await expect(run(host)).rejects.toThrow('Extraction failed');
    expect(host.workers[0].active).toBe(false);
    host.error = undefined;
    expect(await run(host)).toHaveLength(3);
    expect(host.workers.every((worker) => !worker.active)).toBe(true);
});

it('does not create a session for empty or already cancelled requests', async () => {
    const host = new Host();
    expect(await run(host, undefined, [])).toEqual([]);
    const controller = new AbortController();
    controller.abort();
    await expect(run(host, controller.signal)).rejects.toThrow();
    expect(host.workers).toHaveLength(0);
});
