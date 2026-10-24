import { createFfmpegSession, ffmpegMetadata } from '@project/ffmpeg';
import type { FfmpegRuntimeInfo, FfmpegWorker, PreparedFfmpegAssets, WorkerRequest } from '@project/ffmpeg';

const preparedAssets = (): PreparedFfmpegAssets => ({
    workerURL: 'blob:verified-worker',
    coreURL: 'blob:verified-core',
    wasmURL: 'blob:verified-wasm',
    dispose: jest.fn(),
});

const runtimeInfo = (overrides: Partial<FfmpegRuntimeInfo> = {}): FfmpegRuntimeInfo => ({
    runtimeVersion: ffmpegMetadata.runtimeVersion,
    ffmpegVersion: ffmpegMetadata.ffmpegVersion,
    ffmpegConfiguration: '--disable-all',
    ffmpegLicense: 'LGPL version 2.1 or later',
    linkedLibraries: ['libavutil'],
    libraries: [
        { name: 'libavutil', version: 1, configuration: '--disable-all', license: 'LGPL version 2.1 or later' },
    ],
    operations: ['inspect'],
    ...overrides,
});

class FakeWorker implements FfmpegWorker {
    readonly target = new EventTarget();
    readonly messages: WorkerRequest[] = [];
    readonly terminate = jest.fn();
    responseInfo = runtimeInfo();
    autoReply = true;

    postMessage(message: WorkerRequest) {
        this.messages.push(message);
        if (!this.autoReply) return;
        queueMicrotask(() =>
            this.target.dispatchEvent(
                new MessageEvent('message', {
                    data: {
                        sessionId: message.sessionId,
                        requestId: message.requestId,
                        ok: true,
                        result: this.responseInfo,
                    },
                })
            )
        );
    }

    addEventListener(type: 'message' | 'error' | 'messageerror', listener: EventListener) {
        this.target.addEventListener(type, listener);
    }

    removeEventListener(type: 'message' | 'error' | 'messageerror', listener: EventListener) {
        this.target.removeEventListener(type, listener);
    }
}

/** Asset preparation is asynchronous; wait until the session has started its worker. */
const workerStarted = async (worker: FakeWorker) => {
    for (let attempt = 0; worker.messages.length === 0; attempt++) {
        if (attempt > 100) throw new Error('The session did not start its worker');
        await Promise.resolve();
    }
    return worker.messages[0];
};

describe('FFmpeg session', () => {
    it('does not prepare or start a worker for an already cancelled owner', async () => {
        const controller = new AbortController();
        controller.abort();
        const prepare = jest.fn(async () => preparedAssets());
        const factory = jest.fn(() => new FakeWorker());
        const session = createFfmpegSession({
            signal: controller.signal,
            prepareAssets: prepare,
            workerFactory: factory,
        });
        await expect(session.load()).rejects.toMatchObject({ code: 'disposed' });
        expect(prepare).not.toHaveBeenCalled();
        expect(factory).not.toHaveBeenCalled();
    });

    it('owner cancellation terminates running work and releases executable URLs once', async () => {
        const assets = preparedAssets();
        const worker = new FakeWorker();
        const owner = new AbortController();
        const session = createFfmpegSession({
            signal: owner.signal,
            prepareAssets: async () => assets,
            workerFactory: () => worker,
        });
        const runtime = await session.load();
        worker.autoReply = false;
        const inspection = runtime.inspect();
        owner.abort();
        await expect(inspection).rejects.toMatchObject({ code: 'aborted' });
        await expect(runtime.inspect()).rejects.toMatchObject({ code: 'disposed' });
        session.dispose();
        expect(worker.terminate).toHaveBeenCalledTimes(1);
        expect(assets.dispose).toHaveBeenCalledTimes(1);
    });

    it('preserves an app update error from asset preparation without starting a worker', async () => {
        const error = Object.assign(new Error('Update the app to continue.'), { code: 'update-required' });
        const factory = jest.fn(() => new FakeWorker());
        const session = createFfmpegSession({
            workerFactory: factory,
            prepareAssets: async () => {
                throw error;
            },
        });
        await expect(session.load()).rejects.toBe(error);
        expect(factory).not.toHaveBeenCalled();
        expect(session.state).toBe('failed');
    });

    it('prepares assets lazily once before starting a shared worker', async () => {
        let finishPreparation!: () => void;
        const assets = preparedAssets();
        const preparation = new Promise<PreparedFfmpegAssets>((resolve) => {
            finishPreparation = () => resolve(assets);
        });
        const prepareAssets = jest.fn(() => preparation);
        const worker = new FakeWorker();
        const factory = jest.fn(() => worker);
        const session = createFfmpegSession({
            workerFactory: factory,
            prepareAssets,
        });
        expect(prepareAssets).not.toHaveBeenCalled();
        const first = session.load();
        const second = session.load();
        expect(factory).not.toHaveBeenCalled();
        finishPreparation();
        expect(await first).toBe(await second);
        expect(prepareAssets).toHaveBeenCalledTimes(1);
        expect(factory).toHaveBeenCalledTimes(1);
        expect(factory).toHaveBeenCalledWith(assets.workerURL);
        expect(worker.messages[0]).toMatchObject({ coreURL: assets.coreURL, wasmURL: assets.wasmURL });
        expect(assets.dispose).not.toHaveBeenCalled();
        session.dispose();
        expect(assets.dispose).toHaveBeenCalledTimes(1);
    });

    it('aborting a caller during preparation preserves other callers and shared initialization', async () => {
        let finishPreparation!: () => void;
        const preparation = new Promise<PreparedFfmpegAssets>((resolve) => {
            finishPreparation = () => resolve(preparedAssets());
        });
        const worker = new FakeWorker();
        const session = createFfmpegSession({
            workerFactory: () => worker,
            prepareAssets: () => preparation,
        });
        const controller = new AbortController();
        const first = session.load({ signal: controller.signal });
        const second = session.load();
        controller.abort();
        await expect(first).rejects.toMatchObject({ code: 'aborted' });
        finishPreparation();
        await expect(second).resolves.toBeDefined();
        expect(session.state).toBe('ready');
        session.dispose();
    });

    it('disposes promptly during unresponsive preparation and never starts the worker', async () => {
        let preparationSignal: AbortSignal | undefined;
        let finishPreparation!: () => void;
        const assets = preparedAssets();
        const preparation = new Promise<PreparedFfmpegAssets>((resolve) => {
            finishPreparation = () => resolve(assets);
        });
        const factory = jest.fn(() => new FakeWorker());
        const session = createFfmpegSession({
            workerFactory: factory,
            prepareAssets: (signal) => {
                preparationSignal = signal;
                return preparation;
            },
        });
        const loading = session.load();
        session.dispose();
        await expect(loading).rejects.toMatchObject({ code: 'disposed' });
        expect(preparationSignal?.aborted).toBe(true);
        finishPreparation();
        await Promise.resolve();
        expect(factory).not.toHaveBeenCalled();
        expect(session.state).toBe('disposed');
        expect(assets.dispose).toHaveBeenCalledTimes(1);
    });

    it('owner cancellation stops shared preparation even when preparation ignores its signal', async () => {
        const factory = jest.fn(() => new FakeWorker());
        const controller = new AbortController();
        const session = createFfmpegSession({
            workerFactory: factory,
            signal: controller.signal,
            prepareAssets: () => new Promise(() => {}),
        });
        const first = session.load();
        const second = session.load();
        controller.abort();
        await expect(first).rejects.toMatchObject({ code: 'aborted' });
        await expect(second).rejects.toMatchObject({ code: 'aborted' });
        expect(session.state).toBe('disposed');
        expect(factory).not.toHaveBeenCalled();
    });

    it('is lazy, loads one versioned worker, and exposes runtime inspection', async () => {
        const worker = new FakeWorker();
        const factory = jest.fn(() => worker);
        const session = createFfmpegSession({ prepareAssets: async () => preparedAssets(), workerFactory: factory });
        expect(factory).not.toHaveBeenCalled();

        const [first, second] = await Promise.all([session.load(), session.load()]);
        expect(first).toBe(second);
        expect(factory).toHaveBeenCalledWith('blob:verified-worker');
        const controller = new AbortController();
        await expect(first.inspect({ signal: controller.signal })).resolves.toEqual(runtimeInfo());
        controller.abort();
        expect(worker.messages.map(({ operation }) => operation)).toEqual(['initialize', 'inspect']);
        expect(session.state).toBe('ready');
        expect(worker.terminate).not.toHaveBeenCalled();
    });

    it('rejects an already-aborted load without creating a worker', async () => {
        const controller = new AbortController();
        controller.abort();
        const factory = jest.fn();
        const session = createFfmpegSession({ prepareAssets: async () => preparedAssets(), workerFactory: factory });
        await expect(session.load({ signal: controller.signal })).rejects.toMatchObject({ code: 'aborted' });
        expect(factory).not.toHaveBeenCalled();
        expect(session.state).toBe('new');
    });

    it('aborting one concurrent load caller does not cancel the shared initialization', async () => {
        const worker = new FakeWorker();
        worker.autoReply = false;
        const session = createFfmpegSession({
            prepareAssets: async () => preparedAssets(),
            workerFactory: () => worker,
        });
        const first = session.load();
        const controller = new AbortController();
        const second = session.load({ signal: controller.signal });

        controller.abort();

        await expect(second).rejects.toMatchObject({ code: 'aborted' });
        expect(session.state).toBe('loading');
        const initialize = await workerStarted(worker);
        worker.target.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    sessionId: initialize.sessionId,
                    requestId: initialize.requestId,
                    ok: true,
                    result: runtimeInfo(),
                },
            })
        );
        await expect(first).resolves.toBeDefined();
        expect(session.state).toBe('ready');
        expect(worker.terminate).not.toHaveBeenCalled();
    });

    it('keeps disposal terminal when initialization resolves just before disposal', async () => {
        const worker = new FakeWorker();
        worker.autoReply = false;
        const session = createFfmpegSession({
            prepareAssets: async () => preparedAssets(),
            workerFactory: () => worker,
        });
        const loading = session.load();
        const initialize = await workerStarted(worker);
        worker.target.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    sessionId: initialize.sessionId,
                    requestId: initialize.requestId,
                    ok: true,
                    result: runtimeInfo(),
                },
            })
        );
        session.dispose();

        await expect(loading).rejects.toMatchObject({ code: 'disposed' });
        expect(session.state).toBe('disposed');
        expect(worker.terminate).toHaveBeenCalledTimes(1);
    });

    it('makes a mismatched runtime terminal and releases its worker and executable URLs once', async () => {
        const assets = preparedAssets();
        const worker = new FakeWorker();
        worker.responseInfo = runtimeInfo({ runtimeVersion: 'mismatch' });
        const session = createFfmpegSession({
            prepareAssets: async () => assets,
            workerFactory: () => worker,
        });
        await expect(session.load()).rejects.toMatchObject({ code: 'protocol' });
        expect(session.state).toBe('failed');
        session.dispose();
        expect(worker.terminate).toHaveBeenCalledTimes(1);
        expect(assets.dispose).toHaveBeenCalledTimes(1);
    });

    it('rejects FFmpeg versions that only share the expected version prefix', async () => {
        const worker = new FakeWorker();
        worker.responseInfo = runtimeInfo({ ffmpegVersion: `${ffmpegMetadata.ffmpegVersion}0` });
        const session = createFfmpegSession({
            prepareAssets: async () => preparedAssets(),
            workerFactory: () => worker,
        });
        await expect(session.load()).rejects.toMatchObject({ code: 'protocol' });
        expect(session.state).toBe('failed');
        expect(worker.terminate).toHaveBeenCalledTimes(1);
    });

    it('aborts an unresponsive request without disposing the session', async () => {
        const worker = new FakeWorker();
        const session = createFfmpegSession({
            prepareAssets: async () => preparedAssets(),
            workerFactory: () => worker,
        });
        const runtime = await session.load();
        worker.autoReply = false;
        const controller = new AbortController();
        const inspection = runtime.inspect({ signal: controller.signal });
        controller.abort();
        await expect(inspection).rejects.toMatchObject({ code: 'aborted' });
        expect(session.state).toBe('ready');
        expect(worker.terminate).not.toHaveBeenCalled();

        const inspect = worker.messages[1];
        worker.target.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    sessionId: inspect.sessionId,
                    requestId: inspect.requestId,
                    ok: true,
                    result: runtimeInfo(),
                },
            })
        );
        expect(session.state).toBe('ready');
    });

    it('ignores a late aborted reply while another request is pending', async () => {
        const worker = new FakeWorker();
        const session = createFfmpegSession({
            prepareAssets: async () => preparedAssets(),
            workerFactory: () => worker,
        });
        const runtime = await session.load();
        worker.autoReply = false;

        const firstController = new AbortController();
        const first = runtime.inspect({ signal: firstController.signal });
        firstController.abort();
        await expect(first).rejects.toMatchObject({ code: 'aborted' });

        const second = runtime.inspect();
        const [initialize, firstInspect, secondInspect] = worker.messages;
        worker.target.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    sessionId: firstInspect.sessionId,
                    requestId: firstInspect.requestId,
                    ok: true,
                    result: runtimeInfo(),
                },
            })
        );
        expect(session.state).toBe('ready');

        worker.target.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    sessionId: initialize.sessionId,
                    requestId: secondInspect.requestId,
                    ok: true,
                    result: runtimeInfo(),
                },
            })
        );
        await expect(second).resolves.toEqual(runtimeInfo());
    });

    it('fails a reply for a request that was never issued by the session', async () => {
        const worker = new FakeWorker();
        const session = createFfmpegSession({
            prepareAssets: async () => preparedAssets(),
            workerFactory: () => worker,
        });
        const runtime = await session.load();
        worker.autoReply = false;
        const inspection = runtime.inspect();
        const request = worker.messages[1];

        worker.target.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    sessionId: request.sessionId,
                    requestId: request.requestId + 1,
                    ok: true,
                    result: runtimeInfo(),
                },
            })
        );
        await expect(inspection).rejects.toMatchObject({ code: 'protocol' });
        expect(session.state).toBe('failed');
    });

    it('allows a slow initialization to continue until the owner cancels it', async () => {
        jest.useFakeTimers();
        const worker = new FakeWorker();
        worker.autoReply = false;
        const controller = new AbortController();
        const session = createFfmpegSession({
            prepareAssets: async () => preparedAssets(),
            workerFactory: () => worker,
            signal: controller.signal,
        });
        const loading = session.load();
        await workerStarted(worker);
        jest.advanceTimersByTime(120_000);
        expect(session.state).toBe('loading');
        controller.abort();
        await expect(loading).rejects.toMatchObject({ code: 'aborted' });
        expect(session.state).toBe('disposed');
        expect(worker.terminate).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });

    it('fails all work on malformed or stale replies', async () => {
        for (const data of [
            { malformed: true },
            { sessionId: 'stale', requestId: 2, ok: true, result: runtimeInfo() },
        ]) {
            const worker = new FakeWorker();
            const session = createFfmpegSession({
                prepareAssets: async () => preparedAssets(),
                workerFactory: () => worker,
            });
            const runtime = await session.load();
            worker.autoReply = false;
            const inspection = runtime.inspect();
            worker.target.dispatchEvent(new MessageEvent('message', { data }));
            await expect(inspection).rejects.toMatchObject({ code: 'protocol' });
            expect(session.state).toBe('failed');
        }
    });

    it('terminates exactly once when disposed', async () => {
        const worker = new FakeWorker();
        const session = createFfmpegSession({
            prepareAssets: async () => preparedAssets(),
            workerFactory: () => worker,
        });
        await session.load();
        session.dispose();
        session.dispose();
        expect(worker.terminate).toHaveBeenCalledTimes(1);
    });
});
