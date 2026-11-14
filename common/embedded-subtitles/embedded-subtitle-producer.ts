import { v4 as uuid } from 'uuid';
import type { LoadableSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { SubtitleCuePublisher } from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceProducer } from '@project/common/subtitle-reader/subtitle-stream';
import type { EmbeddedSubtitleDescriptor } from '@project/common/embedded-subtitles/subtitle-source';
import type { EmbeddedSubtitles } from '@project/common/embedded-subtitles/embedded-subtitles';
import { embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import { asbError } from '@project/common/util/log';

/** Hands extraction to the player; only completed Files are returned to persistence. */
export const embeddedSubtitleProducer =
    ({
        source,
        tracks,
        service,
        reader,
        errorMessage,
        onComplete,
        pendingDescriptors,
    }: {
        source: FileWithId;
        tracks: LoadableSubtitleTrack<FileWithId>[];
        service: EmbeddedSubtitles;
        reader: SubtitleReader;
        errorMessage: string;
        pendingDescriptors: EmbeddedSubtitleDescriptor[];
        onComplete: (tracks: LoadableSubtitleTrack<FileWithId>[], signal: AbortSignal) => Promise<void>;
    }): SubtitleSourceProducer =>
    async (publishUpdate, signal) => {
        const trackIndexes = new Set(pendingDescriptors.map(({ trackIndex }) => trackIndex));
        const selected = tracks.map(({ fileParts }, track) => ({
            track,
            loadId: uuid(),
            name: fileParts[0]?.file.name ?? '',
            trackIndex: fileParts[0]?.embedded?.trackIndex,
        }));
        const pending = selected.filter(
            (track) => track.trackIndex !== undefined && trackIndexes.has(track.trackIndex)
        );
        signal.throwIfAborted();
        publishUpdate({
            type: 'snapshot',
            tracks: selected.map(({ track, loadId, name }) => ({ track, loadId, name, status: 'loading', cues: [] })),
        });
        const extraction = new AbortController();
        let publicationError: Error | undefined;
        const readers = new Map(
            [...trackIndexes].map((trackIndex) => {
                const targets = pending.filter((track) => track.trackIndex === trackIndex);
                return [
                    trackIndex,
                    {
                        decoder: new TextDecoder(),
                        parser: reader.createProgressiveReader('srt'),
                        publisher: new SubtitleCuePublisher(
                            (cues) => {
                                signal.throwIfAborted();
                                for (const track of targets) {
                                    publishUpdate({ type: 'cues', track: track.track, loadId: track.loadId, cues });
                                }
                            },
                            (error) => {
                                publicationError = error instanceof Error ? error : new Error(String(error));
                                extraction.abort(publicationError); // A timer can fail while extraction is waiting for the worker.
                            }
                        ),
                    },
                ] as const;
            })
        );
        const cancel = () => {
            for (const stream of readers.values()) stream.publisher.dispose();
            extraction.abort(signal.reason);
        };
        signal.addEventListener('abort', cancel, { once: true });
        let completed: Map<string, FileWithId>;
        try {
            const nodes = await reader.subtitles(
                tracks.map(({ fileParts }, track) => ({
                    fileParts: pending.some((item) => item.track === track) ? [] : fileParts.map(({ file }) => file),
                }))
            );
            signal.throwIfAborted();
            for (const track of selected.filter((track) => !pending.includes(track))) {
                const cues = nodes
                    .filter((node) => node.track === track.track)
                    .map((node, cueId) => ({ ...node, cueId }));
                if (cues.length) publishUpdate({ type: 'cues', track: track.track, loadId: track.loadId, cues });
                publishUpdate({ type: 'complete', track: track.track, loadId: track.loadId });
            }
            completed = await service.extract(source, pendingDescriptors, extraction.signal, (trackIndex, bytes) => {
                extraction.signal.throwIfAborted();
                const stream = readers.get(trackIndex);
                if (!stream) throw new Error('Unexpected embedded subtitle track');
                stream.publisher.add(stream.parser.read(stream.decoder.decode(bytes, { stream: true }), false));
            });
            extraction.signal.throwIfAborted();
            for (const stream of readers.values()) {
                stream.publisher.add(stream.parser.read(stream.decoder.decode(), true));
                stream.publisher.flush();
            }
            for (const track of pending) publishUpdate({ type: 'complete', track: track.track, loadId: track.loadId });
        } catch (error) {
            if (signal.aborted) throw error;
            for (const stream of readers.values()) stream.publisher.flush();
            asbError('app/subtitles', 'Failed to produce embedded subtitles', publicationError ?? error);
            for (const track of selected) {
                publishUpdate({ type: 'failed', track: track.track, loadId: track.loadId, error: errorMessage });
            }
            return;
        } finally {
            signal.removeEventListener('abort', cancel);
            for (const stream of readers.values()) stream.publisher.dispose();
        }
        const files = tracks.map(({ fileParts }) => ({
            fileParts: fileParts.map((file) => {
                if (!file.embedded || !trackIndexes.has(file.embedded.trackIndex)) return file;
                return completed.get(embeddedSubtitleId(source.id, file.embedded.trackIndex))!;
            }),
        }));
        await onComplete(files, signal);
    };
