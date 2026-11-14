import type { FfmpegSession } from '@project/ffmpeg';
import { FfmpegError } from '@project/ffmpeg/session';
import { ffmpegMetadata } from '@project/ffmpeg/metadata';
import type {
    ExtractedSubtitleFile,
    SubtitleExtractionOptions,
} from '@project/common/embedded-subtitles/subtitle-source';
import { asbTrace } from '@project/common/util/log';

/** Only the website loads this adapter; shared subtitle code uses SubtitleHost. */
export const extractSubtitleTracks = async ({
    file,
    fileId,
    trackIndexes,
    signal,
    onChunk,
    createSession,
}: SubtitleExtractionOptions & {
    createSession: (options: { signal: AbortSignal }) => FfmpegSession;
}): Promise<ExtractedSubtitleFile[]> => {
    signal.throwIfAborted();
    if (trackIndexes.length === 0) return [];
    const started = performance.now();
    const context: { sessionId?: string; fileId: string; inputBytes: number; trackIndexes: number[] } = {
        fileId,
        inputBytes: file.size,
        trackIndexes,
    };
    const chunks = new Map(trackIndexes.map((index) => [index, [] as Blob[]]));
    let session: FfmpegSession | undefined;
    let stage: 'creatingSession' | 'loadingExtractor' | 'extracting' | 'finalizing' = 'creatingSession';
    let outputBytes = 0;
    let chunkCount = 0;
    try {
        session = createSession({ signal });
        context.sessionId = session.id;
        stage = 'loadingExtractor';
        asbTrace('app/subtitles', 'Loading embedded subtitle extractor', { ...context });
        const runtime = await session.load({ signal });
        signal.throwIfAborted();
        stage = 'extracting';
        asbTrace('app/subtitles', 'Starting embedded subtitle extraction', {
            ...context,
            runtimeVersion: ffmpegMetadata.runtimeVersion,
            ffmpegVersion: ffmpegMetadata.ffmpegVersion,
            runtimeArchiveSha256: ffmpegMetadata.runtimeArchive.sha256,
            elapsedMs: performance.now() - started,
        });
        const results = await runtime.extractSubtitles({
            input: file,
            trackIndexes,
            signal,
            onChunk: (index, chunk) => {
                signal.throwIfAborted();
                const parts = chunks.get(index);
                if (!parts) throw new Error('Unexpected embedded subtitle track');
                parts.push(new Blob([chunk]));
                onChunk(index, chunk);
                outputBytes += chunk.byteLength;
                chunkCount++;
            },
        });
        signal.throwIfAborted();
        stage = 'finalizing';
        const files = results.map((result): ExtractedSubtitleFile => {
            const parts = chunks.get(result.trackIndex);
            if (!parts) throw new Error('Unexpected embedded subtitle track');
            const output = {
                trackIndex: result.trackIndex,
                blob: new Blob(parts, { type: result.mimeType }),
            };
            return { ...output, format: result.extension };
        });
        asbTrace('app/subtitles', 'Finished embedded subtitle extraction', {
            ...context,
            elapsedMs: performance.now() - started,
            trackCount: files.length,
            outputBytes,
            chunks: chunkCount,
        });
        return files;
    } catch (error) {
        asbTrace(
            'app/subtitles',
            signal.aborted ? 'Embedded subtitle extraction cancelled' : 'Embedded subtitle extraction failed',
            {
                ...context,
                stage,
                elapsedMs: performance.now() - started,
                outputBytes,
                chunks: chunkCount,
                errorCode: error instanceof FfmpegError ? error.code : undefined,
                ...(signal.aborted ? {} : { error }),
            }
        );
        throw error;
    } finally {
        session?.dispose();
    }
};
