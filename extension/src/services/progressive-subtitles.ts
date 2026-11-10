import type SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import type { SubtitleSourceCue, SubtitleSourceUpdate } from '@project/common/subtitle-reader/subtitle-stream';
import { ProgressiveSubtitleReader } from '@project/common/subtitle-reader/progressive-subtitle-reader';
import { asbTrace } from '@project/common/util/log';

const publicationIntervalMs = 100;

/** Publishes the first cues immediately, coalesces subsequent batches, and flushes before a terminal update. */
export async function streamSubtitles(
    url: string,
    extension: string,
    subtitleReader: Pick<SubtitleReader, 'subtitles'>,
    source: { readonly track: number; readonly loadId: string },
    signal: AbortSignal,
    update: (update: SubtitleSourceUpdate) => void
): Promise<void> {
    const startedAt = performance.now();
    signal.throwIfAborted();
    let body: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let pendingCues: SubtitleSourceCue[] = [];
    let publicationTimer: ReturnType<typeof setTimeout> | undefined;
    let lastPublicationAt: number | undefined;
    let publicationError: Error | undefined;

    const flush = () => {
        clearTimeout(publicationTimer);
        publicationTimer = undefined;
        signal.throwIfAborted();
        if (!pendingCues.length) return;
        const cues = pendingCues;
        pendingCues = [];
        lastPublicationAt = performance.now();
        update({ type: 'cues', ...source, cues });
    };
    const cancel = () => {
        clearTimeout(publicationTimer);
        pendingCues = [];
        void body?.cancel().catch(() => undefined);
    };
    const publish = (cues: SubtitleSourceCue[]) => {
        pendingCues.push(...cues);
        if (!pendingCues.length) return;
        const remaining =
            lastPublicationAt === undefined ? 0 : publicationIntervalMs - (performance.now() - lastPublicationAt);
        if (remaining <= 0) {
            flush();
        } else if (publicationTimer === undefined) {
            publicationTimer = setTimeout(() => {
                publicationTimer = undefined;
                if (signal.aborted) return;
                try {
                    flush();
                } catch (error) {
                    publicationError = error instanceof Error ? error : new Error(String(error));
                    // Release a pending network read so the operation can report the publication failure.
                    void body?.cancel().catch(() => undefined);
                }
            }, remaining);
        }
    };

    try {
        const parser = new ProgressiveSubtitleReader(subtitleReader, extension);
        const response = await fetch(url, { signal });
        if (!response.ok) {
            throw new Error(`Progressive subtitle retrieval failed: ${response.status} ${response.statusText}`);
        }
        if (!response.body) throw new Error('Progressive subtitle response has no readable body');
        signal.throwIfAborted();
        body = response.body.getReader();
        signal.addEventListener('abort', cancel, { once: true });
        const decoder = new TextDecoder();
        let bytes = 0;
        asbTrace('subtitle/progressive', 'Started reading progressive subtitle response', {
            ...source,
            contentType: response.headers.get('content-type'),
        });
        while (true) {
            signal.throwIfAborted();
            const { value, done } = await body.read();
            if (publicationError !== undefined) throw publicationError;
            bytes += value?.byteLength ?? 0;
            const cues = await parser.read(done ? decoder.decode() : decoder.decode(value, { stream: true }), done);
            signal.throwIfAborted();
            publish(cues);
            if (done) break;
        }
        flush();
        update({ type: 'complete', ...source });
        asbTrace('subtitle/progressive', 'Finished reading progressive subtitles', {
            ...source,
            bytes,
            elapsedMs: performance.now() - startedAt,
        });
    } catch (error) {
        if (!signal.aborted) {
            flush();
            update({ type: 'failed', ...source, error: error instanceof Error ? error.message : String(error) });
        }
        throw error;
    } finally {
        signal.removeEventListener('abort', cancel);
        clearTimeout(publicationTimer);
        await body?.cancel().catch(() => undefined);
        body?.releaseLock();
    }
}
