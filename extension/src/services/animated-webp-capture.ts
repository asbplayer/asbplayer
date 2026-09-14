import { muxAnimatedWebp } from '@project/common';
import type { RectModel } from '@project/common';
import { bufferToBase64 } from '@project/common/base64';

const animatedWebpMaxFrames = 90;

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

const recordTrack = (track: MediaStreamTrack, mimeType: string): { stop: () => Promise<Blob> } => {
    const recorder = new MediaRecorder(new MediaStream([track]));
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    recorder.start();
    return {
        stop: () => {
            recorder.stop();
            return stopped;
        },
    };
};

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

// Reads video frames from an already-armed tab-capture stream, crops and encodes each kept frame to a
// static WebP, then muxes them into one animated WebP. Each frame's real timestamp drives its per-frame
// duration. Audio is recorded from the same stream in parallel.
export const finishAnimatedWebpCapture = async (
    capture: ArmedAnimatedWebpCapture,
    durationMs: number,
    rect: RectModel,
    maxWidth: number,
    maxHeight: number,
    onRecordingStopped?: () => (() => void) | void
): Promise<{ base64: string; audioBase64?: string }> => {
    const Processor = (window as any).MediaStreamTrackProcessor;

    if (!Processor) {
        capture.stream.getTracks().forEach((t) => t.stop());
        throw new Error('MediaStreamTrackProcessor is unavailable');
    }

    const { videoTrack, audioTrack, fps, quality } = capture;
    const frameIntervalUs = Math.max(1e6 / fps, (durationMs * 1000) / animatedWebpMaxFrames);
    const frames: { timestampUs: number; data: Uint8Array }[] = [];
    let audioBase64: string | undefined;

    try {
        // The tab is briefly muted while capturing (piping the captured audio back to keep the tab
        // audible would feed back into tabCapture). The MediaRecorder still records the audio cleanly.
        const audioRecording = audioTrack ? recordTrack(audioTrack, 'audio/webm') : undefined;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const reader: ReadableStreamDefaultReader<VideoFrame> = new Processor({
            track: videoTrack,
        }).readable.getReader();

        // Safety net: a stalled track would otherwise hang reader.read(). Stopping it closes the reader.
        const stopTimeout = setTimeout(() => videoTrack.stop(), durationMs + 2000);

        let dimensions: CropDimensions | undefined;
        let firstTimestampUs: number | undefined;
        let nextCaptureUs = -Infinity;

        try {
            while (frames.length < animatedWebpMaxFrames) {
                const { value: frame, done } = await reader.read();

                if (done || !frame) {
                    break;
                }

                const timestampUs = frame.timestamp;

                if (firstTimestampUs === undefined) {
                    firstTimestampUs = timestampUs;
                }

                if (timestampUs - firstTimestampUs >= durationMs * 1000) {
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
            }
        } finally {
            clearTimeout(stopTimeout);
            await reader.cancel().catch(() => {});
        }

        if (audioRecording) {
            audioBase64 = bufferToBase64(await (await audioRecording.stop()).arrayBuffer());
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
