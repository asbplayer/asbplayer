import type { FfmpegSession } from '@project/ffmpeg';
import { finalizeWebmAudio, webmOpusMimeType } from '@project/common/audio-transcode/webm-audio';
import { asbTrace } from '@project/common/util/log';

/** Supplied by the host so the shared UI uses its runtime cache and asset policy. */
export interface AudioTranscodeHost {
    supportsAudioPlayback(): boolean;
    createSession(options: { signal: AbortSignal }): FfmpegSession;
}

export const transcodeAudioTrack = async ({
    file,
    trackIndex,
    host,
    onAudio,
    signal,
}: {
    file: File;
    trackIndex: number;
    host: AudioTranscodeHost;
    signal: AbortSignal;
    /** Cumulative immutable audio prefix; the coordinator owns chunk accumulation. */
    onAudio: (audio: Blob) => void;
}): Promise<Blob> => {
    signal.throwIfAborted();
    if (!host.supportsAudioPlayback()) throw new Error('WebM Opus playback is not supported by this browser');
    const chunks: Blob[] = [];
    const startedAt = performance.now();
    const context = { inputBytes: file.size, trackIndex };
    let stage: 'loadingDecoder' | 'transcoding' = 'loadingDecoder';
    asbTrace('audio/transcode', 'Loading audio decoder', context);
    const session = host.createSession({ signal });
    try {
        const runtime = await session.load({ signal });
        signal.throwIfAborted();
        stage = 'transcoding';
        asbTrace('audio/transcode', 'Decoder ready; converting audio', {
            ...context,
            elapsedMs: performance.now() - startedAt,
        });
        const duration = await runtime.transcodeAudio({
            input: file,
            trackIndex,
            signal,
            onChunk: (bytes) => {
                signal.throwIfAborted();
                const chunk = new Blob([bytes], { type: webmOpusMimeType });
                chunks.push(chunk);
                onAudio(new Blob(chunks, { type: webmOpusMimeType }));
            },
        });
        signal.throwIfAborted();
        const blob = await finalizeWebmAudio(chunks, duration);
        signal.throwIfAborted();
        asbTrace('audio/transcode', 'Audio conversion completed', {
            ...context,
            outputBytes: blob.size,
            elapsedMs: performance.now() - startedAt,
        });
        return blob;
    } catch (error) {
        asbTrace('audio/transcode', signal.aborted ? 'Audio conversion cancelled' : 'Audio conversion failed', {
            ...context,
            stage,
            elapsedMs: performance.now() - startedAt,
            ...(signal.aborted ? {} : { error }),
        });
        throw error;
    } finally {
        session.dispose();
    }
};
