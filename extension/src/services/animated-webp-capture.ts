import { muxAnimatedWebp } from '@project/common';
import type { ImageCaptureParams, RectModel } from '@project/common';
import type Binding from '@project/extension/src/services/binding';
import AudioRecorder from '@project/extension/src/services/audio-recorder';
import { bufferToBase64 } from '@project/common/base64';

const animatedWebpMaxFrames = 90;

// Safety limit for open-ended (manually stopped) captures, so a forgotten recording can't hold the tab
// capture stream and keep buffering frames forever.
const animatedWebpMaxOpenEndedMs = 30_000;

const canvasToWebpBytes = (canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('Failed to encode WebP frame'));
                    return;
                }
                blob.arrayBuffer()
                    .then((buffer) => resolve(new Uint8Array(buffer)))
                    .catch(reject);
            },
            'image/webp',
            quality
        );
    });

// The captured frame is the whole tab, so map the video element's CSS-pixel rect onto it (matching the
// screenshot crop path). Derived once from the first frame.
interface CropDimensions {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dw: number;
    dh: number;
}

const cropDimensions = (
    frameWidth: number,
    frameHeight: number,
    rect: RectModel,
    maxWidth: number,
    maxHeight: number
): CropDimensions => {
    const scaleX = frameWidth / window.innerWidth;
    const scaleY = frameHeight / window.innerHeight;
    const sx = Math.max(0, rect.left * scaleX);
    const sy = Math.max(0, rect.top * scaleY);
    const sw = Math.min(frameWidth - sx, rect.width * scaleX) || frameWidth;
    const sh = Math.min(frameHeight - sy, rect.height * scaleY) || frameHeight;
    const scale = Math.min(1, maxWidth > 0 ? maxWidth / sw : 1, maxHeight > 0 ? maxHeight / sh : 1);
    return { sx, sy, sw, sh, dw: Math.max(1, Math.round(sw * scale)), dh: Math.max(1, Math.round(sh * scale)) };
};

export class NoArmedAnimatedWebpCaptureError extends Error {}

export interface ArmedAnimatedWebpCapture {
    readonly stream: MediaStream;
    readonly videoTrack: MediaStreamTrack;
    readonly audioTrack?: MediaStreamTrack;
    readonly fps: number;
    readonly quality: number;
}

let armed: ArmedAnimatedWebpCapture | undefined;
let armedDiscardTimeout: ReturnType<typeof setTimeout> | undefined;

// Negotiates the tab-capture stream (getUserMedia) up front, before the mining seek happens, so the
// stream is already flowing by the time playback resumes at the padding-adjusted start. Without this,
// the settings lookups + tabCapture stream negotiation that happen after the seek can eat into (or
// entirely swallow) the intended pre-roll, clipping the start of the recording.
export const armAnimatedWebpCapture = async (streamId: string, fps: number, quality: number, recordAudio: boolean) => {
    discardArmedAnimatedWebpCapture();

    const dpr = window.devicePixelRatio || 1;
    const constraints: MediaStreamConstraints = {
        video: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId,
                maxWidth: Math.round(window.innerWidth * dpr),
                maxHeight: Math.round(window.innerHeight * dpr),
            },
        } as any,
    };

    if (recordAudio) {
        constraints.audio = { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } } as any;
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    armed = {
        stream,
        videoTrack: stream.getVideoTracks()[0],
        audioTrack: recordAudio ? stream.getAudioTracks()[0] : undefined,
        fps,
        quality,
    };

    // Don't hold an open tab-capture stream forever if the mine that armed it never actually finishes
    // (canceled, or the finish message is lost).
    armedDiscardTimeout = setTimeout(discardArmedAnimatedWebpCapture, 10_000);
};

// Consumes the currently-armed capture (if any), so it can only be used once.
export const takeArmedAnimatedWebpCapture = (): ArmedAnimatedWebpCapture | undefined => {
    const capture = armed;
    armed = undefined;

    if (armedDiscardTimeout) {
        clearTimeout(armedDiscardTimeout);
        armedDiscardTimeout = undefined;
    }

    return capture;
};

export const discardArmedAnimatedWebpCapture = () => {
    if (armedDiscardTimeout) {
        clearTimeout(armedDiscardTimeout);
        armedDiscardTimeout = undefined;
    }

    armed?.stream.getTracks().forEach((t) => t.stop());
    armed = undefined;
};

export interface AnimatedWebpCaptureOptions {
    // Omit for an open-ended capture that runs until stop() is called
    readonly durationMs?: number;
    readonly rect: RectModel;
    readonly maxWidth: number;
    readonly maxHeight: number;
    readonly onRecordingStopped?: () => (() => void) | void;
}

export interface AnimatedWebpResult {
    readonly base64: string;
    readonly audioBase64?: string;
}

export interface ActiveAnimatedWebpCapture {
    // Whether the capture has a fixed duration, as opposed to running until stopped
    readonly timed: boolean;
    // Ends the capture early; result still resolves with whatever was captured so far
    readonly stop: () => void;
    readonly result: Promise<AnimatedWebpResult>;
}

let active: ActiveAnimatedWebpCapture | undefined;

export const activeAnimatedWebpCapture = (): ActiveAnimatedWebpCapture | undefined => active;

// Reads video frames from an already-armed tab-capture stream, crops and encodes each kept frame to a
// static WebP, then muxes them into one animated WebP. Each frame's real timestamp drives its per-frame
// duration. Audio is recorded from the same stream in parallel.
export const startAnimatedWebpCapture = (
    capture: ArmedAnimatedWebpCapture,
    options: AnimatedWebpCaptureOptions
): ActiveAnimatedWebpCapture => {
    // Stopping the video track closes the frame reader, which ends the capture loop promptly (the same
    // mechanism as the stalled-track safety net below).
    const stop = () => capture.videoTrack.stop();
    const result = captureAnimatedWebp(capture, options);
    const handle: ActiveAnimatedWebpCapture = { timed: options.durationMs !== undefined, stop, result };
    active = handle;

    if (handle.timed) {
        // The caller that asked for a timed capture awaits its result
        result.then(
            () => releaseAnimatedWebpCapture(handle),
            () => releaseAnimatedWebpCapture(handle)
        );
    } else {
        // An open-ended capture is kept (even once it has hit its limit) until stop collects it. Whoever
        // stops it awaits result, so this just keeps an unattended failure from going unhandled.
        result.catch(() => {});
    }

    return handle;
};

// Options for capturing a clip of the video that `binding` owns. A video inside an iframe reports its rect
// relative to that iframe, so it is offset by the iframe's position in the page.
export const animatedWebpCaptureOptions = (
    params: ImageCaptureParams,
    binding: Binding | undefined,
    iframesById: { [frameId: string]: HTMLIFrameElement } | undefined,
    durationMs?: number
): AnimatedWebpCaptureOptions => {
    let rect = params.rect;
    const iframe = params.frameId === undefined ? undefined : iframesById?.[params.frameId];

    if (iframe !== undefined) {
        const iframeRect = iframe.getBoundingClientRect();
        rect = {
            left: rect.left + iframeRect.left,
            top: rect.top + iframeRect.top,
            width: rect.width,
            height: rect.height,
        };
    }

    return {
        durationMs,
        rect,
        maxWidth: params.maxWidth,
        maxHeight: params.maxHeight,
        onRecordingStopped: () => {
            binding?.pause();
            binding?.subtitleController.persistentNotification('info.processingClip');
            return () => binding?.subtitleController.hideNotification();
        },
    };
};

// Prefer a capture that was already armed (getUserMedia negotiated) before the mining seek happened, so we
// don't lose the start of the clip to that negotiation's latency. Fall back to arming it now if none is
// available.
export const takeOrArmAnimatedWebpCapture = async (message: {
    streamId?: string;
    fps?: number;
    quality?: number;
    recordAudio: boolean;
}) => {
    const armed = takeArmedAnimatedWebpCapture();

    if (armed) {
        return armed;
    }

    if (message.streamId === undefined || message.fps === undefined || message.quality === undefined) {
        throw new NoArmedAnimatedWebpCaptureError('No armed animated WebP capture and no stream to arm one from');
    }

    await armAnimatedWebpCapture(message.streamId, message.fps, message.quality, message.recordAudio);
    return takeArmedAnimatedWebpCapture()!;
};

// Forget a finished capture so it no longer counts as the active one.
export const releaseAnimatedWebpCapture = (handle: ActiveAnimatedWebpCapture) => {
    if (active === handle) {
        active = undefined;
    }
};

const captureAnimatedWebp = async (
    capture: ArmedAnimatedWebpCapture,
    { durationMs, rect, maxWidth, maxHeight, onRecordingStopped }: AnimatedWebpCaptureOptions
): Promise<AnimatedWebpResult> => {
    const Processor = (window as any).MediaStreamTrackProcessor;

    if (!Processor) {
        capture.stream.getTracks().forEach((t) => t.stop());
        throw new Error('MediaStreamTrackProcessor is unavailable');
    }

    const { videoTrack, audioTrack, fps, quality } = capture;
    const timed = durationMs !== undefined;
    const limitMs = durationMs ?? animatedWebpMaxOpenEndedMs;
    // A timed capture picks its interval up front so it never exceeds the frame cap. An open-ended one
    // can't know its length, so it starts at the target fps and thins out its frames as it grows.
    let frameIntervalUs = timed ? Math.max(1e6 / fps, (limitMs * 1000) / animatedWebpMaxFrames) : 1e6 / fps;
    let frames: { timestampUs: number; data: Uint8Array }[] = [];
    let audioBase64: string | undefined;

    try {
        // The tab is briefly muted while capturing (piping the captured audio back to keep the tab
        // audible would feed back into tabCapture), hence doNotManageStream. The audio is still recorded cleanly.
        let audioRecorder: AudioRecorder | undefined;

        if (audioTrack) {
            audioRecorder = new AudioRecorder();
            await audioRecorder.start(new MediaStream([audioTrack]), true);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const reader: ReadableStreamDefaultReader<VideoFrame> = new Processor({
            track: videoTrack,
        }).readable.getReader();

        // Safety net: a stalled track would otherwise hang reader.read(). Stopping it closes the reader.
        const stopTimeout = setTimeout(() => videoTrack.stop(), limitMs + 2000);

        let dimensions: CropDimensions | undefined;
        let firstTimestampUs: number | undefined;
        let nextCaptureUs = -Infinity;

        try {
            while (true) {
                const { value: frame, done } = await reader.read();

                if (done || !frame) {
                    break;
                }

                const timestampUs = frame.timestamp;

                if (firstTimestampUs === undefined) {
                    firstTimestampUs = timestampUs;
                }

                if (timestampUs - firstTimestampUs >= limitMs * 1000) {
                    frame.close();
                    break;
                }

                // Drop frames closer together than the target interval.
                if (timestampUs < nextCaptureUs) {
                    frame.close();
                    continue;
                }
                nextCaptureUs = timestampUs + frameIntervalUs;

                if (!dimensions) {
                    dimensions = cropDimensions(frame.displayWidth, frame.displayHeight, rect, maxWidth, maxHeight);
                    canvas.width = dimensions.dw;
                    canvas.height = dimensions.dh;
                }

                const { sx, sy, sw, sh, dw, dh } = dimensions;
                ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, dw, dh);
                frame.close();
                frames.push({ timestampUs, data: await canvasToWebpBytes(canvas, quality) });

                if (frames.length >= animatedWebpMaxFrames) {
                    if (timed) {
                        break;
                    }

                    frames = frames.filter((_, i) => i % 2 === 0);
                    frameIntervalUs *= 2;
                }
            }
        } finally {
            clearTimeout(stopTimeout);
            await reader.cancel().catch(() => {});
        }

        if (audioRecorder) {
            audioBase64 = await audioRecorder.stop(true);
        }
    } finally {
        capture.stream.getTracks().forEach((t) => t.stop());
    }

    // Capture done — pause the video and show the processing notification while muxing.
    const removeOverlay = onRecordingStopped?.();

    try {
        if (frames.length === 0) {
            throw new Error('No frames captured');
        }

        const muxFrames = frames.map((frame, i) => {
            const nextUs = i + 1 < frames.length ? frames[i + 1].timestampUs : frame.timestampUs + frameIntervalUs;
            return { data: frame.data, durationMs: Math.max(1, Math.round((nextUs - frame.timestampUs) / 1000)) };
        });

        return { base64: bufferToBase64(muxAnimatedWebp(muxFrames).buffer), audioBase64 };
    } finally {
        removeOverlay?.();
    }
};
