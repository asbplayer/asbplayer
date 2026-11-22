import type SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { SubtitleCuePublisher } from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceUpdate } from '@project/common/subtitle-reader/subtitle-stream';
import { asbTrace } from '@project/common/util/log';

/** Publishes the first cues immediately, coalesces subsequent batches, and flushes before a terminal update. */
export async function streamSubtitles(
    url: string,
    extension: string,
    subtitleReader: Pick<SubtitleReader, 'createProgressiveReader'>,
    source: { readonly track: number; readonly loadId: string },
    signal: AbortSignal,
    update: (update: SubtitleSourceUpdate) => void
): Promise<void> {
    const startedAt = performance.now();
    signal.throwIfAborted();
    let body: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let publicationError: Error | undefined;
    const publisher = new SubtitleCuePublisher(
        (cues) => {
            signal.throwIfAborted();
            update({ type: 'cues', ...source, cues });
        },
        (error) => {
            publicationError = error instanceof Error ? error : new Error(String(error));
            void body?.cancel().catch(() => undefined); // Release a pending network read so the operation can report the publication failure.
        }
    );
    const cancel = () => {
        publisher.dispose();
        void body?.cancel().catch(() => undefined);
    };
    let bytes = 0;

    try {
        const parser = subtitleReader.createProgressiveReader(extension);
        const response = await fetch(url, { signal });
        signal.throwIfAborted();
        if (!response.ok) {
            void response.body?.cancel().catch(() => undefined);
            throw new Error(`Progressive subtitle retrieval failed: ${response.status} ${response.statusText}`);
        }
        if (!response.body) throw new Error('Progressive subtitle response has no readable body');
        body = response.body.getReader();
        signal.addEventListener('abort', cancel, { once: true });
        const decoder = new TextDecoder();
        asbTrace('subtitle/progressive', 'Started reading progressive subtitle response', {
            ...source,
            contentType: response.headers.get('content-type'),
        });
        while (true) {
            signal.throwIfAborted();
            const { value, done } = await body.read();
            signal.throwIfAborted();
            if (publicationError !== undefined) throw publicationError;
            bytes += value?.byteLength ?? 0;
            const cues = parser.read(done ? decoder.decode() : decoder.decode(value, { stream: true }), done);
            signal.throwIfAborted();
            publisher.add(cues);
            if (done) break;
        }
        publisher.flush();
        signal.throwIfAborted();
    } catch (error) {
        const failure = publicationError ?? error;
        if (!signal.aborted) {
            if (!publicationError) {
                try {
                    publisher.flush();
                } catch {
                    // Preserve the original failure when reporting it to the consumer.
                }
            }
            if (!signal.aborted) {
                update({
                    type: 'failed',
                    ...source,
                    error: failure instanceof Error ? failure.message : String(failure),
                });
            }
        }
        throw failure;
    } finally {
        signal.removeEventListener('abort', cancel);
        publisher.dispose();
        await body?.cancel().catch(() => undefined);
        body?.releaseLock();
    }
    signal.throwIfAborted();
    update({ type: 'complete', ...source });
    asbTrace('subtitle/progressive', 'Finished reading progressive subtitles', {
        ...source,
        bytes,
        elapsedMs: performance.now() - startedAt,
    });
}
