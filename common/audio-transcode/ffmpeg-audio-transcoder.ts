import type { FfmpegSession } from '@project/ffmpeg';
import { FfmpegError } from '@project/ffmpeg/session';
import { ffmpegMetadata } from '@project/ffmpeg/metadata';
import { finalizeWebmAudio, webmOpusMimeType } from '@project/common/audio-transcode/webm-audio';
import { asbTrace } from '@project/common/util/log';
import type { AudioTranscodeOptions } from '@project/common/audio-transcode';

/** Only the website loads this implementation; shared UI imports the host interface instead. */
export const transcodeAudioTrack = async ({
    file,
    fileId,
    trackIndex,
    createSession,
    onAudio,
    signal,
}: AudioTranscodeOptions & {
    createSession: (options: { signal: AbortSignal }) => FfmpegSession;
}): Promise<Blob> => {
    signal.throwIfAborted();
    const chunks: Blob[] = [];
    const startedAt = performance.now();
    const context: { sessionId?: string; fileId: string; inputBytes: number; trackIndex: number } = {
        fileId,
        inputBytes: file.size,
        trackIndex,
    };
    let stage: 'creatingSession' | 'loadingDecoder' | 'transcoding' | 'finalizing' = 'creatingSession';
    let outputBytes = 0;
    let session: FfmpegSession | undefined;
    try {
        session = createSession({ signal });
        context.sessionId = session.id;
        stage = 'loadingDecoder';
        asbTrace('audio/transcode', 'Loading audio decoder', { ...context });
        const runtime = await session.load({ signal });
        signal.throwIfAborted();
        stage = 'transcoding';
        asbTrace('audio/transcode', 'Decoder ready; converting audio', {
            ...context,
            runtimeVersion: ffmpegMetadata.runtimeVersion,
            ffmpegVersion: ffmpegMetadata.ffmpegVersion,
            runtimeArchiveSha256: ffmpegMetadata.runtimeArchive.sha256,
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
                outputBytes += chunk.size;
                onAudio(new Blob(chunks, { type: webmOpusMimeType }));
            },
        });
        signal.throwIfAborted();
        stage = 'finalizing';
        const blob = await finalizeWebmAudio(chunks, duration);
        signal.throwIfAborted();
        asbTrace('audio/transcode', 'Audio conversion completed', {
            ...context,
            outputBytes: blob.size,
            chunks: chunks.length,
            durationMs: duration * 1000,
            elapsedMs: performance.now() - startedAt,
        });
        return blob;
    } catch (error) {
        asbTrace('audio/transcode', signal.aborted ? 'Audio conversion cancelled' : 'Audio conversion failed', {
            ...context,
            stage,
            outputBytes,
            chunks: chunks.length,
            errorCode: error instanceof FfmpegError ? error.code : undefined,
            elapsedMs: performance.now() - startedAt,
            ...(signal.aborted ? {} : { error }),
        });
        throw error;
    } finally {
        session?.dispose();
    }
};
