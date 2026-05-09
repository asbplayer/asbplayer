import { WebmFileMediaFragmentData } from './webm-file-media-fragment-data';
import { FileModel } from './model';

type Listener = (event: Event) => void;
type VideoFrameCallback = (now: number, metadata: { mediaTime: number }) => void;

class MockVideoElement {
    currentTime = 1;
    paused = true;
    ended = false;
    error?: { message?: string };
    play = jest.fn(async () => {
        this.paused = false;
    });
    pause = jest.fn(() => {
        this.paused = true;
    });

    lastRequestedVideoFrameCallbackId?: number;

    private _nextVideoFrameCallbackId = 1;
    private _videoFrameCallbacks = new Map<number, VideoFrameCallback>();
    private _listeners = new Map<string, Set<Listener>>();

    requestVideoFrameCallback(callback: VideoFrameCallback) {
        const id = this._nextVideoFrameCallbackId++;
        this.lastRequestedVideoFrameCallbackId = id;
        this._videoFrameCallbacks.set(id, callback);
        return id;
    }

    cancelVideoFrameCallback(id: number) {
        this._videoFrameCallbacks.delete(id);
    }

    triggerRequestedVideoFrame(mediaTimeSeconds: number) {
        const callbackId = this.lastRequestedVideoFrameCallbackId;
        if (callbackId === undefined) {
            throw new Error('No pending video frame callback');
        }

        this.currentTime = mediaTimeSeconds;
        const callback = this._videoFrameCallbacks.get(callbackId);
        this._videoFrameCallbacks.delete(callbackId);
        callback?.(0, { mediaTime: mediaTimeSeconds });
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (!this._listeners.has(type)) {
            this._listeners.set(type, new Set());
        }

        this._listeners.get(type)!.add(toListener(listener));
    }

    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        this._listeners.get(type)?.delete(toListener(listener));
    }
}

const toListener = (listener: EventListenerOrEventListenerObject): Listener => {
    if (typeof listener === 'function') {
        return listener;
    }

    return (event) => listener.handleEvent(event);
};

const file: FileModel = {
    name: 'sample.mp4',
    blobUrl: 'blob:sample',
};

const setVisibilityState = (state: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: state,
    });
};

const flushAsync = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

beforeEach(() => {
    jest.useFakeTimers();
    setVisibilityState('visible');
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    setVisibilityState('visible');
});

it('pauses WebM rendering while the tab is hidden and resumes without tripping the watchdog', async () => {
    const pauseCapture = jest.fn();
    const resumeCapture = jest.fn();
    const data = new WebmFileMediaFragmentData(file, 1_000, 2_000, 320, 180);
    const video = new MockVideoElement();
    const ctx = {
        drawImage: jest.fn(),
    } as unknown as CanvasRenderingContext2D;

    let settled = false;
    const frameLoopPromise = (data as any)
        ._runFrameLoop({
            video,
            ctx,
            width: 320,
            height: 180,
            startTimestampMs: 1_000,
            targetEndTimestampMs: 2_000,
            fallbackFrameDelayMs: 42,
            renderWatchdogTimeoutMs: 3_000,
            pauseCapture,
            resumeCapture,
            abortSignal: new AbortController().signal,
        })
        .finally(() => {
            settled = true;
        });

    await flushAsync();

    expect(video.play).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);

    setVisibilityState('hidden');
    video.paused = true;
    document.dispatchEvent(new Event('visibilitychange'));

    expect(pauseCapture).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(10_000);
    await flushAsync();

    expect(settled).toEqual(false);

    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await flushAsync();

    expect(resumeCapture).toHaveBeenCalledTimes(1);
    expect(video.play).toHaveBeenCalledTimes(2);

    video.triggerRequestedVideoFrame(2);

    await expect(frameLoopPromise).resolves.toBeUndefined();
});

it('fails WebM rendering after the global timeout elapses', async () => {
    const data = new WebmFileMediaFragmentData(file, 1_000, 2_000, 320, 180);
    const dataAny = data as any;
    const video = new MockVideoElement();
    const canvas = {} as HTMLCanvasElement;
    const ctx = {} as CanvasRenderingContext2D;
    const stopTrack = jest.fn();
    const recorderStop = jest.fn();
    const stopRecorderPromise = Promise.resolve(new Blob());

    jest.spyOn(dataAny, '_setupCaptureStream').mockReturnValue({
        stream: { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream,
        captureTrack: undefined,
    });
    jest.spyOn(dataAny, '_setupRecorder').mockReturnValue({
        recorder: { state: 'recording', stop: recorderStop } as unknown as MediaRecorder,
        recorderStarted: Promise.resolve(),
        stopRecorder: stopRecorderPromise,
    });
    jest.spyOn(dataAny, '_seekVideo').mockReturnValue(new Promise(() => {}));

    const renderPromise = dataAny._captureBlob({
        video,
        canvas,
        ctx,
        settings: {
            outputWidth: 320,
            outputHeight: 180,
            startTimestampMs: 1_000,
            endTimestampMs: 2_000,
            durationMs: 1_000,
            captureFrameRate: 24,
            fallbackFrameDelayMs: 42,
            targetBitsPerPixel: 0.1,
            minBitsPerSecond: 1_000_000,
            videoBitsPerSecond: 1_000_000,
            renderWatchdogTimeoutMs: 10_000,
        },
        mimeType: 'video/webm',
        abortSignal: new AbortController().signal,
    });

    jest.advanceTimersByTime(20_000);
    await flushAsync();

    await expect(renderPromise).rejects.toThrow('WebM rendering timed out after 20000ms');
    expect(recorderStop).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(video.pause).toHaveBeenCalledTimes(1);
});
