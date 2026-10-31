import { muxAnimatedWebp } from '@project/common';
import type { CaptureArea, CaptureViewport, RectModel } from '@project/common';
import AudioRecorder from '@project/extension/src/services/audio-recorder';
import { bufferToBase64 } from '@project/common/base64';

const animatedWebpMaxFrames = 90;

// Safety limit for open-ended (manually stopped) captures, so a forgotten recording can't hold the tab
// capture stream and keep buffering frames forever.
const animatedWebpMaxOpenEndedMs = 30_000;

// The area to capture for a video, in the page's coordinates. A video inside an iframe reports its rect relative to
// that iframe, so it is offset by the iframe's position in the page. Must run in the page's root frame.
export const captureArea = (
    rect: RectModel,
    frameId: string | undefined,
    iframesById: { [frameId: string]: HTMLIFrameElement } | undefined
): CaptureArea => {
    const iframe = frameId === undefined ? undefined : iframesById?.[frameId];

    if (iframe !== undefined) {
        const iframeRect = iframe.getBoundingClientRect();
        rect = {
            left: rect.left + iframeRect.left,
            top: rect.top + iframeRect.top,
            width: rect.width,
            height: rect.height,
        };
    }

    return { rect, viewport: currentViewport() };
};

export const currentViewport = (): CaptureViewport => ({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
});

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

export const cropDimensions = (
    frameWidth: number,
    frameHeight: number,
    viewport: CaptureViewport,
    rect: RectModel,
    maxWidth: number,
    maxHeight: number
): CropDimensions => {
    const scaleX = frameWidth / viewport.width;
    const scaleY = frameHeight / viewport.height;
    const sx = Math.max(0, rect.left * scaleX);
    const sy = Math.max(0, rect.top * scaleY);
    const sw = Math.min(frameWidth - sx, rect.width * scaleX) || frameWidth;
    const sh = Math.min(frameHeight - sy, rect.height * scaleY) || frameHeight;
    const scale = Math.min(1, maxWidth > 0 ? maxWidth / sw : 1, maxHeight > 0 ? maxHeight / sh : 1);
    return { sx, sy, sw, sh, dw: Math.max(1, Math.round(sw * scale)), dh: Math.max(1, Math.round(sh * scale)) };
};

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
export const armAnimatedWebpCapture = async (
    streamId: string,
    fps: number,
    quality: number,
    recordAudio: boolean,
    viewport: CaptureViewport
) => {
    discardArmedAnimatedWebpCapture();

    const constraints: MediaStreamConstraints = {
        video: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId,
                maxWidth: Math.round(viewport.width * viewport.devicePixelRatio),
                maxHeight: Math.round(viewport.height * viewport.devicePixelRatio),
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
    readonly viewport: CaptureViewport;
    readonly rect: RectModel;
    readonly maxWidth: number;
    readonly maxHeight: number;
    // Play the captured audio back, which keeps the tab audible. Only possible outside the page, since inside it
    // the playback would feed back into the tab capture.
    readonly playAudio?: boolean;
}

export interface AnimatedWebpResult {
    readonly base64: string;
    readonly audioBase64?: string;
    // Set when the image couldn't be made. The audio is recorded separately, so it can still be there.
    readonly imageError?: string;
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

// Forget a finished capture so it no longer counts as the active one.
export const releaseAnimatedWebpCapture = (handle: ActiveAnimatedWebpCapture) => {
    if (active === handle) {
        active = undefined;
    }
};

const captureAnimatedWebp = async (
    capture: ArmedAnimatedWebpCapture,
    { durationMs, viewport, rect, maxWidth, maxHeight, playAudio = false }: AnimatedWebpCaptureOptions
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
    let frameError: unknown;

    try {
        // Capturing the tab mutes it, unless the captured audio is played back (see playAudio)
        let audioRecorder: AudioRecorder | undefined;

        if (audioTrack) {
            audioRecorder = new AudioRecorder();
            await audioRecorder.start(new MediaStream([audioTrack]), !playAudio);
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
                    dimensions = cropDimensions(
                        frame.displayWidth,
                        frame.displayHeight,
                        viewport,
                        rect,
                        maxWidth,
                        maxHeight
                    );
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
        } catch (e) {
            frameError = e;
        } finally {
            clearTimeout(stopTimeout);
            await reader.cancel().catch(() => {});
        }

        if (audioRecorder) {
            audioBase64 = await audioRecorder.stop(!playAudio);
        }
    } finally {
        capture.stream.getTracks().forEach((t) => t.stop());
    }

    try {
        if (frameError !== undefined) {
            throw frameError;
        }

        if (frames.length === 0) {
            throw new Error('No frames captured');
        }

        const muxFrames = frames.map((frame, i) => {
            const nextUs = i + 1 < frames.length ? frames[i + 1].timestampUs : frame.timestampUs + frameIntervalUs;
            return { data: frame.data, durationMs: Math.max(1, Math.round((nextUs - frame.timestampUs) / 1000)) };
        });

        return { base64: bufferToBase64(muxAnimatedWebp(muxFrames).buffer), audioBase64 };
    } catch (e) {
        // Keep the audio, which was recorded from the same stream, even though the image couldn't be made
        return { base64: '', audioBase64, imageError: e instanceof Error ? e.message : String(e) };
    }
};
