import { webmOpusMimeType } from '@project/common/audio-transcode/webm-audio';
import { asbError, asbTrace } from '@project/common/util/log';

/** How far ahead of playback to keep audio in MSE. */
const bufferAheadMs = 120_000;
/** Played audio kept when evicting after the browser's buffer quota is reached. */
const retainedPlayedMs = 30_000;
const appendChunkBytes = 64 * 1024;
/** Playback advancing does not fire buffer events, so poll for room to append or evict. */
const pumpIntervalMs = 250;
const opusFrameDurationMs = 20;

export const supportsStreamingAudio = () =>
    typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(webmOpusMimeType);

/** Accepted audio bounds, in milliseconds, matching PlaybackEngine timestamps. */
export type AudioSeekableRange = { readonly start: number; readonly end: number };

/** Only seek inside audio the browser has actually accepted, leaving one Opus frame at the end. */
export const clampAudioSeekMs = (timestampMs: number, range: AudioSeekableRange | undefined) => {
    if (range === undefined) return Math.max(0, timestampMs);
    return Math.max(range.start, Math.min(timestampMs, Math.max(range.start, range.end - opusFrameDurationMs)));
};

export const audioBufferedRange = (buffered: TimeRanges): AudioSeekableRange =>
    buffered.length === 0
        ? { start: 0, end: 0 }
        : { start: buffered.start(0) * 1000, end: buffered.end(buffered.length - 1) * 1000 };

export interface StreamingAudioSource {
    readonly url: string;
    append(audio: Blob): void;
    dispose(): void;
}

/**
 * Owns MSE in the playback document (including pop-outs). A cumulative, immutable WebM Blob
 * lets a newly opened player replay the stream without restarting the native conversion.
 * Only a bounded window ahead is kept in MSE; the complete output becomes an ordinary Blob source.
 */
export const createStreamingAudio = ({
    currentTimeMs,
    onBuffered,
    onError,
}: {
    currentTimeMs: () => number;
    onBuffered: (range: AudioSeekableRange) => void;
    onError: (error: unknown) => void;
}): StreamingAudioSource => {
    const mediaSource = new MediaSource();
    const url = URL.createObjectURL(mediaSource);
    let sourceBuffer: SourceBuffer | undefined;
    let available: Blob | undefined;
    let consumed = 0;
    let reading = false;
    let disposed = false;
    let quotaExceeded = false;

    const fail = (error: unknown) => {
        if (disposed) return;
        asbError('audio/streaming', 'Streamed audio playback failed', { consumedBytes: consumed, error });
        dispose();
        onError(error);
    };
    /** Browser audio quotas vary. Drop played audio, keeping recent history, then retry once it is removed. */
    const evictPlayedAudio = (buffer: SourceBuffer) => {
        const range = audioBufferedRange(buffer.buffered);
        const evictBeforeMs = currentTimeMs() - retainedPlayedMs;
        if (evictBeforeMs <= range.start) return;
        asbTrace('audio/streaming', 'Evicting played audio after the buffer quota was reached', {
            bufferedStart: range.start,
            bufferedEnd: range.end,
            evictBeforeMs,
        });
        quotaExceeded = false;
        buffer.remove(0, evictBeforeMs / 1000);
    };
    const appendNextChunk = async (buffer: SourceBuffer, audio: Blob) => {
        const end = Math.min(audio.size, consumed + appendChunkBytes);
        reading = true;
        let bytes: ArrayBuffer;
        try {
            bytes = await audio.slice(consumed, end).arrayBuffer();
        } finally {
            reading = false;
        }
        if (disposed || mediaSource.readyState !== 'open') return;
        try {
            buffer.appendBuffer(bytes);
            consumed = end;
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'QuotaExceededError')) throw error;
            asbTrace('audio/streaming', 'Buffer quota reached; waiting for playback to advance', {
                currentTimeMs: currentTimeMs(),
                consumedBytes: consumed,
            });
            quotaExceeded = true;
        }
    };
    const bufferedFarEnoughAhead = (buffer: SourceBuffer) =>
        audioBufferedRange(buffer.buffered).end > currentTimeMs() + bufferAheadMs;
    const pump = () => {
        if (disposed || reading || mediaSource.readyState !== 'open') return;
        if (sourceBuffer === undefined || sourceBuffer.updating || available === undefined) return;
        if (quotaExceeded) {
            evictPlayedAudio(sourceBuffer);
            return;
        }
        if (consumed >= available.size || bufferedFarEnoughAhead(sourceBuffer)) return;
        appendNextChunk(sourceBuffer, available).catch(fail);
    };
    const updated = () => {
        if (disposed || sourceBuffer === undefined) return;
        onBuffered(audioBufferedRange(sourceBuffer.buffered));
        pump();
    };
    const failed = () => fail(new Error('The browser could not decode the streamed Opus audio'));
    const opened = () => {
        if (disposed || sourceBuffer !== undefined) return;
        try {
            sourceBuffer = mediaSource.addSourceBuffer(webmOpusMimeType);
            asbTrace('audio/streaming', 'Opened streamed audio buffer', { availableBytes: available?.size ?? 0 });
            sourceBuffer.addEventListener('updateend', updated);
            sourceBuffer.addEventListener('error', failed);
            pump();
        } catch (error) {
            fail(error);
        }
    };
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        clearInterval(interval);
        mediaSource.removeEventListener('sourceopen', opened);
        sourceBuffer?.removeEventListener('updateend', updated);
        sourceBuffer?.removeEventListener('error', failed);
        if (mediaSource.readyState === 'open' && sourceBuffer?.updating) sourceBuffer.abort();
        available = undefined;
        URL.revokeObjectURL(url);
    };
    mediaSource.addEventListener('sourceopen', opened);
    const interval = setInterval(pump, pumpIntervalMs);
    return {
        url,
        append(blob: Blob) {
            if (disposed) return;
            available = blob;
            pump();
        },
        dispose,
    };
};
