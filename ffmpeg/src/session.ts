import project from '@project/ffmpeg/project';
import type { PreparedFfmpegAssets } from '@project/ffmpeg/assets';
import { ffmpegMetadata } from '@project/ffmpeg/metadata';
import { isWorkerReply } from '@project/ffmpeg/protocol';
import type { FfmpegErrorCode, FfmpegRuntimeInfo, WorkerRequest, WorkerRequestBody } from '@project/ffmpeg/protocol';
import { v4 as uuidv4 } from 'uuid';

export type FfmpegWorker = {
    postMessage(message: WorkerRequest): void;
    terminate(): void;
    addEventListener(type: 'message' | 'error' | 'messageerror', listener: (event: any) => void): void;
    removeEventListener(type: 'message' | 'error' | 'messageerror', listener: (event: any) => void): void;
};

export class FfmpegError extends Error {
    constructor(
        readonly code: FfmpegErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'FfmpegError';
    }
}

export type FfmpegRuntime = {
    /** Aborting inspection cancels only that inspection; use session.dispose() to stop the shared worker. */
    inspect(options?: { signal?: AbortSignal }): Promise<FfmpegRuntimeInfo>;
};

export type CreateFfmpegSessionOptions = {
    workerFactory?: (workerURL: string) => FfmpegWorker;
    /** Aborting the owner's signal disposes the entire session, including downloads and running work. */
    signal?: AbortSignal;
    /** Provide verified executable URLs before starting the worker. The signal ends shared initialization. */
    prepareAssets: (signal: AbortSignal) => Promise<PreparedFfmpegAssets>;
};

export type FfmpegSessionState = 'new' | 'loading' | 'ready' | 'failed' | 'disposed';

export type FfmpegSession = {
    /** Aborting a load call cancels only that caller's wait; use dispose() to stop shared initialization. */
    load(options?: { signal?: AbortSignal }): Promise<FfmpegRuntime>;
    dispose(): void;
    readonly state: FfmpegSessionState;
};

type Pending = { resolve(value: unknown): void; reject(error: unknown): void; cleanup(): void };
const abortError = () => new FfmpegError('aborted', 'The FFmpeg session was aborted');
const defaultWorkerFactory = (url: string): FfmpegWorker =>
    new Worker(url, { type: 'module', name: project.releases.ffmpeg.package });

export const createFfmpegSession = ({
    workerFactory = defaultWorkerFactory,
    signal: lifetimeSignal,
    prepareAssets,
}: CreateFfmpegSessionOptions): FfmpegSession => {
    const sessionId = uuidv4();
    const pending = new Map<number, Pending>();
    const initializationController = new AbortController();
    let state: FfmpegSessionState = 'new';
    let worker: FfmpegWorker | undefined;
    let preparedAssets: PreparedFfmpegAssets | undefined;
    let loadPromise: Promise<FfmpegRuntime> | undefined;
    let requestId = 0;
    const isTerminal = () => state === 'disposed' || state === 'failed';

    const settleAll = (error: unknown) => {
        for (const request of pending.values()) {
            request.cleanup();
            request.reject(error);
        }
        pending.clear();
    };

    const removeListeners = () => {
        worker?.removeEventListener('message', onMessage);
        worker?.removeEventListener('error', onWorkerError);
        worker?.removeEventListener('messageerror', onWorkerError);
    };

    const terminate = (nextState: 'failed' | 'disposed', error: FfmpegError) => {
        if (isTerminal()) return;
        state = nextState;
        lifetimeSignal?.removeEventListener('abort', onLifetimeAbort);
        initializationController.abort(error);
        removeListeners();
        worker?.terminate();
        worker = undefined;
        settleAll(error);
        preparedAssets?.dispose();
        preparedAssets = undefined;
    };

    function onLifetimeAbort() {
        terminate('disposed', abortError());
    }

    function onWorkerError() {
        terminate(
            'failed',
            new FfmpegError(state === 'loading' ? 'initialization' : 'native', 'The FFmpeg worker failed')
        );
    }

    function onMessage(event: MessageEvent<unknown>) {
        if (!isWorkerReply(event.data)) {
            terminate('failed', new FfmpegError('protocol', 'The FFmpeg worker sent a malformed reply'));
            return;
        }
        const reply = event.data;
        if (reply.sessionId !== sessionId || reply.requestId < 1 || reply.requestId > requestId) {
            terminate('failed', new FfmpegError('protocol', 'The FFmpeg worker sent an incompatible or stale reply'));
            return;
        }
        const pendingRequest = pending.get(reply.requestId);
        if (pendingRequest === undefined) return; // Replies to aborted requests can arrive after the request was removed from pending.

        pending.delete(reply.requestId);
        pendingRequest.cleanup();
        if (reply.ok) pendingRequest.resolve(reply.result);
        else pendingRequest.reject(new FfmpegError(reply.error.code, reply.error.message));
    }

    const request = <T>(operation: WorkerRequestBody, signal?: AbortSignal): Promise<T> => {
        if (worker === undefined || isTerminal()) {
            return Promise.reject(new FfmpegError('disposed', 'The FFmpeg session is not available'));
        }
        if (signal?.aborted) return Promise.reject(abortError());
        const id = ++requestId;
        const message: WorkerRequest = { sessionId, requestId: id, ...operation };
        return new Promise<T>((resolve, reject) => {
            const cancel = () => {
                if (!pending.has(id)) return;
                pending.delete(id);
                cleanup();
                reject(abortError());
            };
            const cleanup = () => signal?.removeEventListener('abort', cancel);
            pending.set(id, {
                resolve: (value) => resolve(value as T),
                reject,
                cleanup,
            });
            signal?.addEventListener('abort', cancel, { once: true });
            if (signal?.aborted) cancel();
            if (!pending.has(id)) return;
            try {
                worker!.postMessage(message);
            } catch (error) {
                pending.delete(id);
                cleanup();
                reject(error);
            }
        });
    };

    const withSignal = <T>(
        signal: AbortSignal | undefined,
        operation: () => Promise<T>,
        errorOnAbort: () => unknown = abortError
    ): Promise<T> => {
        if (signal?.aborted) return Promise.reject(errorOnAbort());
        if (signal === undefined) return operation();
        return new Promise<T>((resolve, reject) => {
            const abort = () => {
                cleanup();
                const error = errorOnAbort();
                reject(error);
            };
            const cleanup = () => signal.removeEventListener('abort', abort);
            const settle = (callback: (value: T | PromiseLike<T>) => void, value: T) => {
                cleanup();
                callback(value);
            };
            const fail = (error: unknown) => {
                cleanup();
                reject(error);
            };
            signal.addEventListener('abort', abort, { once: true });
            try {
                operation().then((value) => settle(resolve, value), fail);
            } catch (error) {
                fail(error);
            }
        });
    };

    const runtime: FfmpegRuntime = {
        inspect: ({ signal } = {}) => {
            if (state !== 'ready') {
                return Promise.reject(new FfmpegError('disposed', 'The FFmpeg session is not ready'));
            }
            return request({ operation: 'inspect' }, signal);
        },
    };

    const load = (options: { signal?: AbortSignal } = {}) => {
        if (isTerminal()) {
            return Promise.reject(new FfmpegError('disposed', 'The FFmpeg session is terminal; create a new session'));
        }
        if (loadPromise !== undefined) return withSignal(options.signal, () => loadPromise!);
        if (options.signal?.aborted) return Promise.reject(abortError());

        state = 'loading';
        loadPromise = (async () => {
            try {
                const assets = await withSignal(
                    initializationController.signal,
                    () =>
                        prepareAssets(initializationController.signal).then((prepared) => {
                            // Preparation may finish after disposal even if its host ignored the signal.
                            if (isTerminal()) {
                                prepared.dispose();
                                throw initializationController.signal.reason;
                            }
                            preparedAssets = prepared;
                            return prepared;
                        }),
                    () => initializationController.signal.reason
                );
                if (isTerminal()) {
                    throw new FfmpegError('disposed', 'The FFmpeg session ended during asset preparation');
                }

                worker = workerFactory(assets.workerURL);
                worker.addEventListener('message', onMessage);
                worker.addEventListener('error', onWorkerError);
                worker.addEventListener('messageerror', onWorkerError);
                const info = await request<FfmpegRuntimeInfo>({
                    operation: 'initialize',
                    coreURL: assets.coreURL,
                    wasmURL: assets.wasmURL,
                });
                if (isTerminal()) {
                    throw new FfmpegError('disposed', 'The FFmpeg session was disposed during initialization');
                }

                if (
                    info.runtimeVersion !== ffmpegMetadata.runtimeVersion ||
                    info.ffmpegVersion !== ffmpegMetadata.ffmpegVersion
                ) {
                    throw new FfmpegError('protocol', 'FFmpeg runtime identity does not match the selected build');
                }
                state = 'ready';
                return runtime;
            } catch (error) {
                if (isTerminal()) throw error;
                terminate(
                    'failed',
                    error instanceof FfmpegError
                        ? error
                        : new FfmpegError(
                              'initialization',
                              error instanceof Error ? error.message : 'Initialization failed'
                          )
                );
                throw error;
            }
        })();
        return withSignal(options.signal, () => loadPromise!);
    };

    lifetimeSignal?.addEventListener('abort', onLifetimeAbort, { once: true });
    if (lifetimeSignal?.aborted) onLifetimeAbort();

    return {
        load,
        dispose: () => terminate('disposed', new FfmpegError('disposed', 'The FFmpeg session was disposed')),
        get state() {
            return state;
        },
    };
};
