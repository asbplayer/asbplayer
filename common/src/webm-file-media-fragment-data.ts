import {
    CancelledMediaFragmentDataRenderingError,
    createVideoElement,
    disposeVideoElement,
    makeMediaFragmentFileName,
    minWebmMediaFragmentDurationMs,
    type MediaFragmentData,
    preferredWebmMediaFragmentMimeType,
    mediaFragmentErrorForFile,
} from './media-fragment';
import { FileModel, MediaFragmentErrorCode } from './model';

const videoSeekEpsilonSeconds = 0.001;
const defaultCaptureFrameRate = 24;
const minWebmVideoBitsPerSecond = 1_000_000;
const maxWebmVideoBitsPerSecond = 24_000_000;
const minVp9WebmVideoBitsPerSecond = 2_000_000;
const webmRenderTimeoutMs = 20_000;
const videoSeekTimeoutMs = 3_000;
const frameRenderWatchdogTimeoutMs = 10_000;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const durationFromInterval = (startTimestamp: number, endTimestamp: number) => {
    const duration = Math.abs(endTimestamp - startTimestamp);
    return Math.max(minWebmMediaFragmentDurationMs, duration);
};

const normalizeDimension = (value: number) => {
    const floored = Math.max(1, Math.floor(value));

    if (floored <= 2) {
        return floored;
    }

    return floored - (floored % 2);
};

const targetBitsPerPixelForMimeType = (mimeType: string) => {
    const normalizedMimeType = mimeType.toLowerCase();

    if (normalizedMimeType.includes('av1')) {
        return 0.04;
    }

    if (normalizedMimeType.includes('vp9')) {
        return 0.06;
    }

    return 0.1;
};

const minBitsPerSecondForMimeType = (mimeType: string) => {
    if (mimeType.toLowerCase().includes('vp9')) {
        return minVp9WebmVideoBitsPerSecond;
    }

    return minWebmVideoBitsPerSecond;
};

const estimateVideoBitsPerSecond = (width: number, height: number, frameRate: number, mimeType: string) => {
    const estimated = Math.round(width * height * frameRate * targetBitsPerPixelForMimeType(mimeType));
    return clamp(estimated, minBitsPerSecondForMimeType(mimeType), maxWebmVideoBitsPerSecond);
};

const blobToDataUrl = async (blob: Blob): Promise<string> =>
    await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error('Could not read blob as data URL'));
        reader.readAsDataURL(blob);
    });

const errorFromAbortSignal = (abortSignal: AbortSignal) => {
    const abortSignalWithReason = abortSignal as AbortSignal & { reason?: unknown };
    const reason = abortSignalWithReason.reason;

    if (reason instanceof Error) {
        return reason;
    }

    return new CancelledMediaFragmentDataRenderingError();
};

const throwIfAborted = (abortSignal: AbortSignal) => {
    if (abortSignal.aborted) {
        throw errorFromAbortSignal(abortSignal);
    }
};

type RenderCanvasContext = {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
};

type CaptureStreamSetup = {
    stream: MediaStream;
    captureTrack?: CanvasCaptureMediaStreamTrack;
};

type RecorderSetup = {
    recorder: MediaRecorder;
    recorderStarted: Promise<void>;
    stopRecorder: Promise<Blob>;
};

type FrameLoopSetup = {
    video: HTMLVideoElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    captureTrack?: CanvasCaptureMediaStreamTrack;
    startTimestampMs: number;
    targetEndTimestampMs: number;
    fallbackFrameDelayMs: number;
    renderWatchdogTimeoutMs: number;
    pauseCapture?: () => void;
    resumeCapture?: () => void;
    abortSignal: AbortSignal;
};

type WebmCaptureSettings = {
    sourceWidth: number;
    sourceHeight: number;
    outputWidth: number;
    outputHeight: number;
    startTimestampMs: number;
    endTimestampMs: number;
    durationMs: number;
    captureFrameRate: number;
    fallbackFrameDelayMs: number;
    targetBitsPerPixel: number;
    minBitsPerSecond: number;
    videoBitsPerSecond: number;
    renderWatchdogTimeoutMs: number;
};

type FrameSchedulerMode = 'video-frame-callback' | 'animation-frame';

type CaptureRunSetup = {
    video: HTMLVideoElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    settings: WebmCaptureSettings;
    mimeType: string;
    abortSignal: AbortSignal;
};

type WebmCaptureLogSettings = WebmCaptureSettings & {
    mimeType: string;
    captureMode: 'manual-request-frame' | 'timed-capture-stream';
};

type OwnedRenderResources = {
    video?: HTMLVideoElement;
    canvas?: HTMLCanvasElement;
    ctx?: CanvasRenderingContext2D;
};

export class WebmFileMediaFragmentData implements MediaFragmentData {
    private readonly _file: FileModel;
    private readonly _startTimestamp: number;
    private readonly _durationMs: number;
    private readonly _maxWidth: number;
    private readonly _maxHeight: number;
    private readonly _baseName: string;
    private _video?: HTMLVideoElement;
    private _canvas?: HTMLCanvasElement;
    private _ctx?: CanvasRenderingContext2D;
    private _blobPromise?: Promise<Blob>;
    private _renderAbortController?: AbortController;
    private _cachedBlob?: Blob;
    private _disposed = false;

    constructor(
        file: FileModel,
        startTimestamp: number,
        endTimestamp: number,
        maxWidth: number,
        maxHeight: number,
        resources?: OwnedRenderResources
    ) {
        this._file = file;
        this._startTimestamp = Math.max(0, startTimestamp);
        this._durationMs = durationFromInterval(startTimestamp, endTimestamp);
        this._maxWidth = maxWidth;
        this._maxHeight = maxHeight;
        this._baseName = makeMediaFragmentFileName(file.name, this._startTimestamp);
        this._video = resources?.video;
        this._canvas = resources?.canvas;
        this._ctx = resources?.ctx;
    }

    get name() {
        return `${this._baseName}.webm`;
    }

    get timestamp() {
        return this._startTimestamp;
    }

    get endTimestamp() {
        return this._startTimestamp + this._durationMs;
    }

    get extension() {
        return 'webm';
    }

    get error(): MediaFragmentErrorCode | undefined {
        return mediaFragmentErrorForFile(this._file);
    }

    atTimestamp(timestamp: number) {
        if (timestamp === this._startTimestamp) {
            return this;
        }

        // If render is active, dispose old resources when cancellation settles.
        // Otherwise transfer ownership to the new timestamp instance.
        if (this._blobPromise) {
            this.dispose();
            return new WebmFileMediaFragmentData(
                this._file,
                timestamp,
                timestamp + this._durationMs,
                this._maxWidth,
                this._maxHeight
            );
        }

        const resources = this._takeResources();
        return new WebmFileMediaFragmentData(
            this._file,
            timestamp,
            timestamp + this._durationMs,
            this._maxWidth,
            this._maxHeight,
            resources
        );
    }

    get canChangeTimestamp() {
        return true;
    }

    async base64() {
        const dataUrl = await this.dataUrl();
        return dataUrl.substring(dataUrl.indexOf(',') + 1);
    }

    async dataUrl() {
        return await blobToDataUrl(await this.blob());
    }

    async blob(): Promise<Blob> {
        if (this._disposed) {
            throw new CancelledMediaFragmentDataRenderingError();
        }

        if (this._cachedBlob) {
            return this._cachedBlob;
        }

        if (this._blobPromise) {
            return this._blobPromise;
        }

        const renderAbortController = new AbortController();
        this._renderAbortController = renderAbortController;

        const blobPromise = this._renderWebmLocked(renderAbortController.signal)
            .then((blob) => {
                this._cachedBlob = blob;
                return blob;
            })
            .catch((error) => {
                this._blobPromise = undefined;
                throw error;
            })
            .finally(() => {
                if (this._renderAbortController === renderAbortController) {
                    this._renderAbortController = undefined;
                }

                if (this._disposed) {
                    this._disposeResources();
                }
            });

        this._blobPromise = blobPromise;
        return blobPromise;
    }

    private async _renderWebmLocked(abortSignal: AbortSignal): Promise<Blob> {
        throwIfAborted(abortSignal);

        const mimeType = this._resolveMimeType();
        const video = await this._videoElement(this._file);
        const settings = this._captureSettings(video, mimeType);
        const { canvas, ctx } = this._setupCanvasContext(video, settings.outputWidth, settings.outputHeight);

        return await this._captureBlob({
            video,
            canvas,
            ctx,
            settings,
            mimeType,
            abortSignal,
        });
    }

    private _resolveMimeType() {
        const mimeType = preferredWebmMediaFragmentMimeType();
        if (!mimeType || typeof MediaRecorder === 'undefined') {
            throw new Error('WebM capture is not supported in this browser');
        }

        console.info(`[MediaFragment] Using WebM codec: ${mimeType}`);
        if (!mimeType.includes('av1')) {
            console.info(`[MediaFragment] WebM codec fallback triggered: preferred AV1 unavailable, using ${mimeType}`);
        }

        return mimeType;
    }

    private _captureSettings(video: HTMLVideoElement, mimeType: string): WebmCaptureSettings {
        const { width, height } = this._dimensions(video);
        const maxVideoDurationMs = Number.isFinite(video.duration)
            ? Math.max(0, video.duration * 1000)
            : this._startTimestamp + this._durationMs;
        const startTimestampMs = clamp(this._startTimestamp, 0, maxVideoDurationMs);
        const endTimestampMs = clamp(startTimestampMs + this._durationMs, startTimestampMs, maxVideoDurationMs);
        const captureFrameRate = defaultCaptureFrameRate;

        return {
            sourceWidth: video.videoWidth,
            sourceHeight: video.videoHeight,
            outputWidth: width,
            outputHeight: height,
            startTimestampMs,
            endTimestampMs,
            durationMs: Math.max(0, endTimestampMs - startTimestampMs),
            captureFrameRate,
            fallbackFrameDelayMs: Math.max(1, Math.round(1000 / captureFrameRate)),
            targetBitsPerPixel: targetBitsPerPixelForMimeType(mimeType),
            minBitsPerSecond: minBitsPerSecondForMimeType(mimeType),
            videoBitsPerSecond: estimateVideoBitsPerSecond(width, height, captureFrameRate, mimeType),
            // Per-frame stall watchdog (not a total render budget).
            renderWatchdogTimeoutMs: frameRenderWatchdogTimeoutMs,
        };
    }

    private async _captureBlob({
        video,
        canvas,
        ctx,
        settings,
        mimeType,
        abortSignal,
    }: CaptureRunSetup): Promise<Blob> {
        const chunks: BlobPart[] = [];
        let stream: MediaStream | undefined;
        let mediaRecorder: MediaRecorder | undefined;
        let stopRecorder: Promise<Blob> | undefined;
        let recorderStarted: Promise<void> | undefined;
        let captureTrack: CanvasCaptureMediaStreamTrack | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        try {
            const renderPromise = (async () => {
                const captureStreamSetup = this._setupCaptureStream(canvas, settings.captureFrameRate);
                stream = captureStreamSetup.stream;
                captureTrack = captureStreamSetup.captureTrack;

                this._logWebmCaptureSettings({
                    ...settings,
                    mimeType,
                    captureMode: captureTrack ? 'manual-request-frame' : 'timed-capture-stream',
                });

                const recorderSetup = this._setupRecorder(stream, mimeType, settings.videoBitsPerSecond, chunks);
                mediaRecorder = recorderSetup.recorder;
                recorderStarted = recorderSetup.recorderStarted;
                stopRecorder = recorderSetup.stopRecorder;

                await this._seekVideo(video, settings.startTimestampMs / 1000, abortSignal);
                this._prepareVideoForCapture(video);

                mediaRecorder.start();
                if (mediaRecorder.state !== 'recording') {
                    await recorderStarted;
                }

                await this._runFrameLoop({
                    video,
                    ctx,
                    width: settings.outputWidth,
                    height: settings.outputHeight,
                    captureTrack,
                    startTimestampMs: settings.startTimestampMs,
                    targetEndTimestampMs: settings.endTimestampMs,
                    fallbackFrameDelayMs: settings.fallbackFrameDelayMs,
                    renderWatchdogTimeoutMs: settings.renderWatchdogTimeoutMs,
                    pauseCapture: () => this._pauseRecorder(mediaRecorder),
                    resumeCapture: () => this._resumeRecorder(mediaRecorder),
                    abortSignal,
                });

                const blob = await this._stopAndFlushRecorder(mediaRecorder, stopRecorder);
                if (!blob || blob.size <= 0) {
                    throw new Error('Could not encode WebM from local video');
                }

                mediaRecorder = undefined;
                stopRecorder = undefined;
                return blob;
            })();
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    const error = new Error(`WebM rendering timed out after ${webmRenderTimeoutMs}ms`);
                    this._cancelRendering();
                    reject(error);
                }, webmRenderTimeoutMs);
            });

            return await Promise.race([renderPromise, timeoutPromise]);
        } finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }

            video.pause();

            await this._stopAndFlushRecorder(mediaRecorder, stopRecorder).catch(() => undefined);

            if (stream) {
                for (const track of stream.getTracks()) {
                    track.stop();
                }
            }
        }
    }

    private _setupCanvasContext(video: HTMLVideoElement, width: number, height: number): RenderCanvasContext {
        if (!this._canvas) {
            this._canvas = document.createElement('canvas');
        }

        const canvas = this._canvas;
        if (typeof canvas.captureStream !== 'function') {
            throw new Error('WebM capture stream is not supported in this browser');
        }

        canvas.width = width;
        canvas.height = height;

        if (!this._ctx) {
            this._ctx = canvas.getContext('2d') ?? undefined;
        }

        if (!this._ctx) {
            throw new Error('Could not create WebM capture canvas context');
        }

        const scalingRatio = Math.min(width / Math.max(1, video.videoWidth), height / Math.max(1, video.videoHeight));
        this._ctx.imageSmoothingEnabled = scalingRatio < 0.9;
        this._ctx.imageSmoothingQuality = 'medium';

        return {
            canvas,
            ctx: this._ctx,
        };
    }

    private _setupCaptureStream(canvas: HTMLCanvasElement, captureFrameRate: number): CaptureStreamSetup {
        let manualCaptureStream: MediaStream | undefined;
        try {
            manualCaptureStream = canvas.captureStream(0);
        } catch (_) {
            manualCaptureStream = undefined;
        }

        const manualCaptureTrack = manualCaptureStream?.getVideoTracks()[0] as
            | CanvasCaptureMediaStreamTrack
            | undefined;

        if (manualCaptureStream && manualCaptureTrack && typeof manualCaptureTrack.requestFrame === 'function') {
            return {
                stream: manualCaptureStream,
                captureTrack: manualCaptureTrack,
            };
        }

        console.info(
            `[MediaFragment] Capture-stream fallback triggered: requestFrame unavailable, using timed capture at ${captureFrameRate}fps`
        );

        for (const track of manualCaptureStream?.getTracks() ?? []) {
            track.stop();
        }

        return {
            stream: canvas.captureStream(captureFrameRate),
            captureTrack: undefined,
        };
    }

    private _setupRecorder(
        stream: MediaStream,
        mimeType: string,
        videoBitsPerSecond: number,
        chunks: BlobPart[]
    ): RecorderSetup {
        const recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond,
        });

        let resolveRecorderStarted: (() => void) | undefined;
        let rejectRecorderStarted: ((error: Error) => void) | undefined;
        const recorderStarted = new Promise<void>((resolve, reject) => {
            resolveRecorderStarted = resolve;
            rejectRecorderStarted = reject;
        });
        const stopRecorder = new Promise<Blob>((resolve, reject) => {
            recorder.onstart = () => {
                resolveRecorderStarted?.();
                resolveRecorderStarted = undefined;
                rejectRecorderStarted = undefined;
            };
            recorder.onerror = (event) => {
                const error = event.error;
                const recorderError =
                    error instanceof Error ? error : new Error(`Could not encode WebM: ${String(error)}`);
                rejectRecorderStarted?.(recorderError);
                resolveRecorderStarted = undefined;
                rejectRecorderStarted = undefined;
                reject(recorderError);
            };
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        });

        return {
            recorder,
            recorderStarted,
            stopRecorder,
        };
    }

    private async _runFrameLoop({
        video,
        ctx,
        width,
        height,
        captureTrack,
        startTimestampMs,
        targetEndTimestampMs,
        fallbackFrameDelayMs,
        renderWatchdogTimeoutMs,
        pauseCapture,
        resumeCapture,
        abortSignal,
    }: FrameLoopSetup): Promise<void> {
        throwIfAborted(abortSignal);

        let videoFrameCallbackHandle: number | undefined;
        let animationFrameHandle: number | undefined;
        const pageVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

        const clearScheduledFrame = () => {
            if (videoFrameCallbackHandle !== undefined && typeof video.cancelVideoFrameCallback === 'function') {
                video.cancelVideoFrameCallback(videoFrameCallbackHandle);
                videoFrameCallbackHandle = undefined;
            }

            if (animationFrameHandle !== undefined) {
                cancelAnimationFrame(animationFrameHandle);
                animationFrameHandle = undefined;
            }
        };

        const drawFrame = () => {
            ctx.drawImage(video, 0, 0, width, height);
            captureTrack?.requestFrame();
        };
        const frameSchedulerMode: FrameSchedulerMode =
            typeof video.requestVideoFrameCallback === 'function' ? 'video-frame-callback' : 'animation-frame';
        if (frameSchedulerMode !== 'video-frame-callback') {
            console.info('[MediaFragment] Frame-scheduler fallback triggered: using requestAnimationFrame');
        }
        const done = (mediaTimeSeconds?: number) => {
            const mediaTimeMs = (mediaTimeSeconds ?? video.currentTime) * 1000;
            // Fallback schedulers can observe a slightly stale currentTime, so bias the end threshold a bit earlier.
            const thresholdMs =
                mediaTimeSeconds === undefined
                    ? Math.max(startTimestampMs, targetEndTimestampMs - fallbackFrameDelayMs / 2)
                    : targetEndTimestampMs;
            return mediaTimeMs >= thresholdMs;
        };
        const schedule = (onFrame: (mediaTimeSeconds?: number) => void) => {
            if (frameSchedulerMode === 'video-frame-callback') {
                videoFrameCallbackHandle = video.requestVideoFrameCallback((_, metadata) =>
                    onFrame(metadata.mediaTime)
                );
                return;
            }

            if (frameSchedulerMode === 'animation-frame') {
                animationFrameHandle = requestAnimationFrame(() => onFrame());
            }
        };

        drawFrame();
        await video.play();
        throwIfAborted(abortSignal);

        try {
            await new Promise<void>((resolve, reject) => {
                let settled = false;
                let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
                let waitingForVisibleTab = false;
                function onVideoError() {
                    fail(new Error(video.error?.message ?? 'Could not play video to capture WebM'));
                }
                function onVideoEnded() {
                    finish();
                }
                function onAbort() {
                    fail(errorFromAbortSignal(abortSignal));
                }
                function clearWatchdog() {
                    if (watchdogTimer !== undefined) {
                        clearTimeout(watchdogTimer);
                        watchdogTimer = undefined;
                    }
                }
                function cleanup() {
                    clearWatchdog();
                    clearScheduledFrame();
                    video.removeEventListener('error', onVideoError);
                    video.removeEventListener('ended', onVideoEnded);
                    abortSignal.removeEventListener('abort', onAbort);
                    if (typeof document !== 'undefined') {
                        document.removeEventListener('visibilitychange', onVisibilityChange);
                    }
                }
                function armWatchdog() {
                    clearWatchdog();
                    watchdogTimer = setTimeout(() => {
                        fail(new Error(`WebM rendering timed out after ${renderWatchdogTimeoutMs}ms`));
                    }, renderWatchdogTimeoutMs);
                }
                function pauseForHiddenTab() {
                    if (settled || waitingForVisibleTab) {
                        return;
                    }

                    waitingForVisibleTab = true;
                    clearWatchdog();
                    clearScheduledFrame();
                    pauseCapture?.();
                    video.pause();
                    console.info('[MediaFragment] Pausing WebM render while tab is hidden');
                }
                function resumeAfterHiddenTab() {
                    if (settled || !waitingForVisibleTab || !pageVisible()) {
                        return;
                    }

                    waitingForVisibleTab = false;
                    console.info('[MediaFragment] Resuming WebM render after tab became visible');
                    resumeCapture?.();
                    Promise.resolve(video.paused && !video.ended ? video.play() : undefined)
                        .then(() => {
                            if (settled) {
                                return;
                            }

                            if (abortSignal.aborted) {
                                fail(errorFromAbortSignal(abortSignal));
                                return;
                            }

                            if (done()) {
                                finish();
                                return;
                            }

                            armWatchdog();
                            schedule(onFrame);
                        })
                        .catch((error) => {
                            fail(
                                error instanceof Error
                                    ? error
                                    : new Error(`Could not resume WebM capture playback: ${String(error)}`)
                            );
                        });
                }
                function onVisibilityChange() {
                    if (pageVisible()) {
                        resumeAfterHiddenTab();
                    } else {
                        pauseForHiddenTab();
                    }
                }
                function finish() {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    cleanup();
                    resolve();
                }
                function fail(error: Error) {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    cleanup();
                    reject(error);
                }

                const onFrame = (mediaTimeSeconds?: number) => {
                    try {
                        if (abortSignal.aborted) {
                            fail(errorFromAbortSignal(abortSignal));
                            return;
                        }

                        if (!pageVisible()) {
                            pauseForHiddenTab();
                            return;
                        }

                        if (done(mediaTimeSeconds)) {
                            finish();
                            return;
                        }

                        drawFrame();

                        if (done(mediaTimeSeconds)) {
                            finish();
                            return;
                        }

                        armWatchdog();
                        schedule(onFrame);
                    } catch (error) {
                        fail(
                            error instanceof Error ? error : new Error(`Could not render WebM frame: ${String(error)}`)
                        );
                    }
                };

                video.addEventListener('error', onVideoError);
                video.addEventListener('ended', onVideoEnded);
                abortSignal.addEventListener('abort', onAbort, { once: true });
                if (typeof document !== 'undefined') {
                    document.addEventListener('visibilitychange', onVisibilityChange);
                }
                if (abortSignal.aborted) {
                    onAbort();
                    return;
                }

                if (!pageVisible()) {
                    pauseForHiddenTab();
                    return;
                }

                armWatchdog();
                schedule(onFrame);
            });
        } finally {
            clearScheduledFrame();
        }
    }

    private _dimensions(video: HTMLVideoElement) {
        if (video.videoWidth <= 0 || video.videoHeight <= 0) {
            throw new Error('Could not determine source video dimensions for WebM capture');
        }

        const widthRatio = this._maxWidth <= 0 ? 1 : this._maxWidth / video.videoWidth;
        const heightRatio = this._maxHeight <= 0 ? 1 : this._maxHeight / video.videoHeight;
        const ratio = Math.min(1, Math.min(widthRatio, heightRatio));

        return {
            width: normalizeDimension(video.videoWidth * ratio),
            height: normalizeDimension(video.videoHeight * ratio),
        };
    }

    private _prepareVideoForCapture(video: HTMLVideoElement) {
        // Video element is owned by this class instance; capture can mutate playback state.
        video.muted = true;
        video.volume = 0;
        video.playbackRate = 1;
    }

    private async _stopAndFlushRecorder(
        recorder: MediaRecorder | undefined,
        stopRecorder: Promise<Blob> | undefined
    ): Promise<Blob | undefined> {
        if (!recorder || !stopRecorder) {
            return undefined;
        }

        if (recorder.state !== 'inactive') {
            recorder.stop();
        }

        return await stopRecorder;
    }

    private _pauseRecorder(recorder: MediaRecorder | undefined) {
        if (!recorder || recorder.state !== 'recording') {
            return;
        }

        recorder.pause();
    }

    private _resumeRecorder(recorder: MediaRecorder | undefined) {
        if (!recorder || recorder.state !== 'paused') {
            return;
        }

        recorder.resume();
    }

    private _logWebmCaptureSettings(settings: WebmCaptureLogSettings) {
        console.info('[MediaFragment] WebM capture settings', settings);
    }

    private async _seekVideo(video: HTMLVideoElement, timestamp: number, abortSignal?: AbortSignal): Promise<void> {
        if (abortSignal) {
            throwIfAborted(abortSignal);
        }

        return await new Promise<void>((resolve, reject) => {
            const maxTimestamp = Number.isFinite(video.duration) ? video.duration : timestamp;
            const seekTo = clamp(timestamp, 0, maxTimestamp);
            let timeout: ReturnType<typeof setTimeout> | undefined;
            let settled = false;
            function onSeeked() {
                finish();
            }
            function onVideoError() {
                fail(new Error(video.error?.message ?? 'Could not seek video to create WebM'));
            }
            function onAbort() {
                if (abortSignal) {
                    fail(errorFromAbortSignal(abortSignal));
                }
            }
            function cleanup() {
                if (timeout !== undefined) {
                    clearTimeout(timeout);
                    timeout = undefined;
                }

                video.removeEventListener('seeked', onSeeked);
                video.removeEventListener('error', onVideoError);
                abortSignal?.removeEventListener('abort', onAbort);
            }
            function finish() {
                if (settled) {
                    return;
                }

                settled = true;
                cleanup();
                resolve();
            }
            function fail(error: Error) {
                if (settled) {
                    return;
                }

                settled = true;
                cleanup();
                reject(error);
            }
            video.addEventListener('seeked', onSeeked);
            video.addEventListener('error', onVideoError);
            if (abortSignal) {
                abortSignal.addEventListener('abort', onAbort, { once: true });
                if (abortSignal.aborted) {
                    onAbort();
                    return;
                }
            }

            timeout = setTimeout(() => {
                fail(new Error(`Video seek timed out after ${videoSeekTimeoutMs}ms`));
            }, videoSeekTimeoutMs);

            if (Math.abs(video.currentTime - seekTo) <= videoSeekEpsilonSeconds) {
                finish();
                return;
            }

            video.currentTime = seekTo;
        });
    }

    private async _videoElement(file: FileModel): Promise<HTMLVideoElement> {
        if (this._disposed) {
            throw new CancelledMediaFragmentDataRenderingError();
        }

        if (!this._video) {
            this._video = await createVideoElement(file.blobUrl);
        }

        return this._video;
    }

    private _cancelRendering() {
        if (this._renderAbortController && !this._renderAbortController.signal.aborted) {
            this._renderAbortController.abort(new CancelledMediaFragmentDataRenderingError());
        }
    }

    private _takeResources(): OwnedRenderResources {
        const resources: OwnedRenderResources = {
            video: this._video,
            canvas: this._canvas,
            ctx: this._ctx,
        };

        this._video = undefined;
        this._canvas = undefined;
        this._ctx = undefined;
        return resources;
    }

    private _disposeResources() {
        disposeVideoElement(this._video);
        this._video = undefined;
        this._canvas?.remove();
        this._canvas = undefined;
        this._ctx = undefined;
    }

    dispose() {
        this._disposed = true;
        this._cancelRendering();

        if (this._blobPromise) {
            this._blobPromise.finally(() => {
                if (this._disposed) {
                    this._disposeResources();
                }
            });
            return;
        }

        this._disposeResources();
    }
}
