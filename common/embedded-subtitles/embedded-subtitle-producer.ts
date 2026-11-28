import { v4 as uuid } from 'uuid';
import type { LoadableSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { SubtitleCuePublisher } from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceCue, SubtitleSourceProducer } from '@project/common/subtitle-reader/subtitle-stream';
import type { EmbeddedSubtitleDescriptor } from '@project/common/embedded-subtitles/subtitle-source';
import type { EmbeddedSubtitles } from '@project/common/embedded-subtitles/embedded-subtitles';
import { embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import { asbError } from '@project/common/util/log';
import { ffmpegSubtitleFormats } from '@project/ffmpeg/protocol';

/** Hands extraction to the player. Only completed Files are returned to persistence. */
export const embeddedSubtitleProducer =
    ({
        source,
        tracks,
        service,
        reader,
        errorMessage,
        onFinished,
        pendingDescriptors,
    }: {
        source: FileWithId;
        tracks: LoadableSubtitleTrack<FileWithId>[];
        service: EmbeddedSubtitles;
        reader: SubtitleReader;
        errorMessage: () => string;
        pendingDescriptors: EmbeddedSubtitleDescriptor[];
        onFinished: (tracks: LoadableSubtitleTrack<FileWithId>[], signal: AbortSignal) => Promise<void>;
    }): SubtitleSourceProducer =>
    async (publishUpdate, signal) => {
        const pendingEmbeddedTrackIndexes = new Set(pendingDescriptors.map(({ trackIndex }) => trackIndex));
        const selectedSlots = tracks.map(({ fileParts }, slotIndex) => ({
            slotIndex,
            loadId: uuid(),
            name: fileParts[0]?.file.name ?? '',
            embeddedTrackIndex: fileParts[0]?.embedded?.trackIndex,
        }));
        const pendingSlots = selectedSlots.filter(
            ({ embeddedTrackIndex }) =>
                embeddedTrackIndex !== undefined && pendingEmbeddedTrackIndexes.has(embeddedTrackIndex)
        );
        signal.throwIfAborted();
        publishUpdate({
            type: 'snapshot',
            tracks: selectedSlots.map(({ slotIndex, loadId, name }) => ({
                track: slotIndex,
                loadId,
                name,
                status: 'loading',
                cues: [],
            })),
        });
        signal.throwIfAborted();
        const extraction = new AbortController();
        let publicationError: Error | undefined;
        const streamsByTrackIndex = new Map(
            pendingDescriptors.map(({ trackIndex: embeddedTrackIndex, format }) => {
                const targets = pendingSlots.filter((slot) => slot.embeddedTrackIndex === embeddedTrackIndex);
                let parse: (bytes: ArrayBuffer, final: boolean) => SubtitleSourceCue[];
                if (format === ffmpegSubtitleFormats.image.extension) {
                    const parser = reader.createProgressiveImageReader();
                    parse = (bytes, final) => parser.read(bytes, final);
                } else {
                    const decoder = new TextDecoder();
                    const parser = reader.createProgressiveReader(ffmpegSubtitleFormats.text.extension);
                    parse = (bytes, final) => parser.read(decoder.decode(bytes, { stream: !final }), final);
                }
                return [
                    embeddedTrackIndex,
                    {
                        parse,
                        publisher: new SubtitleCuePublisher(
                            (cues) => {
                                signal.throwIfAborted();
                                for (const { slotIndex, loadId } of targets) {
                                    publishUpdate({ type: 'cues', track: slotIndex, loadId, cues });
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
            for (const stream of streamsByTrackIndex.values()) stream.publisher.dispose();
            extraction.abort(signal.reason);
        };
        const failedFileSlots = new Set<number>();
        const loadFiles = () =>
            Promise.all(
                selectedSlots
                    .filter((slot) => !pendingSlots.includes(slot))
                    .map(async ({ slotIndex, loadId, name }) => {
                        try {
                            const nodes = await reader.subtitles([
                                { fileParts: tracks[slotIndex].fileParts.map(({ file }) => file) },
                            ]);
                            if (signal.aborted) return;
                            const cues = nodes.map(({ start, end, text, textImage, tokenization }, cueId) => ({
                                cueId,
                                start,
                                end,
                                text,
                                textImage,
                                tokenization,
                            }));
                            if (cues.length) publishUpdate({ type: 'cues', track: slotIndex, loadId, cues });
                        } catch (error) {
                            if (signal.aborted) return;
                            failedFileSlots.add(slotIndex);
                            asbError('app/subtitles', 'Failed to load selected subtitle files:', {
                                track: slotIndex,
                                name,
                                error,
                            });
                            publishUpdate({
                                type: 'failed',
                                track: slotIndex,
                                loadId,
                                error: error instanceof Error ? error.message : String(error),
                            });
                            return;
                        }
                        publishUpdate({ type: 'complete', track: slotIndex, loadId });
                    })
            );
        const extract = async () => {
            let extracted: Map<string, FileWithId>;
            try {
                extracted = await service.extract(
                    source,
                    pendingDescriptors,
                    extraction.signal,
                    (embeddedTrackIndex, bytes) => {
                        extraction.signal.throwIfAborted();
                        const stream = streamsByTrackIndex.get(embeddedTrackIndex);
                        if (!stream) throw new Error('Unexpected embedded subtitle track');
                        stream.publisher.add(stream.parse(bytes, false));
                    }
                );
                extraction.signal.throwIfAborted();
                for (const stream of streamsByTrackIndex.values()) {
                    stream.publisher.add(stream.parse(new ArrayBuffer(0), true));
                    stream.publisher.flush();
                }
            } catch (error) {
                if (signal.aborted) throw error;
                for (const stream of streamsByTrackIndex.values()) stream.publisher.flush();
                asbError('app/subtitles', 'Failed to produce embedded subtitles', publicationError ?? error);
                const resolvedErrorMessage = errorMessage();
                for (const { slotIndex, loadId } of pendingSlots) {
                    signal.throwIfAborted();
                    publishUpdate({ type: 'failed', track: slotIndex, loadId, error: resolvedErrorMessage });
                }
                return;
            }
            for (const { slotIndex, loadId } of pendingSlots) {
                signal.throwIfAborted();
                publishUpdate({ type: 'complete', track: slotIndex, loadId });
            }
            return extracted;
        };
        signal.addEventListener('abort', cancel, { once: true });
        let completed: Map<string, FileWithId> | undefined;
        try {
            [completed] = await Promise.all([extract(), loadFiles()]);
            signal.throwIfAborted();
        } catch (error) {
            extraction.abort(error);
            throw error;
        } finally {
            signal.removeEventListener('abort', cancel);
            for (const stream of streamsByTrackIndex.values()) stream.publisher.dispose();
        }
        const completedTracks = tracks.map(({ fileParts }, slotIndex) => ({
            fileParts: failedFileSlots.has(slotIndex)
                ? []
                : fileParts.flatMap((file) => {
                      if (!file.embedded || !pendingEmbeddedTrackIndexes.has(file.embedded.trackIndex)) return [file];
                      const output = completed?.get(embeddedSubtitleId(source.id, file.embedded.trackIndex));
                      return output ? [output] : [];
                  }),
        }));
        await onFinished(completedTracks, signal);
    };
