import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConfirmedVideoDataSubtitleTrack, LoadableSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { MediaSources } from '@project/common/app/services/media-sources';
import type { EmbeddedSubtitles } from '@project/common/embedded-subtitles/embedded-subtitles';
import { asbError } from '@project/common/util/log';

class EmbeddedSelectionError extends Error {}

/** Prepare the selection without extracting embedded tracks. Their completed files arrive from the producer. */
const resolveSubtitleSelection = async (
    tracks: readonly ConfirmedVideoDataSubtitleTrack[],
    source: FileWithId | undefined,
    service: EmbeddedSubtitles,
    signal: AbortSignal
): Promise<FileWithId[]> => {
    signal.throwIfAborted();
    if (tracks.some((track) => track.disabledReason)) throw new Error('Unsupported subtitle selection');
    const descriptors = tracks.flatMap((track) => (track.embedded ? [track.embedded] : []));
    let preparedById: Map<string, FileWithId> | undefined;
    if (descriptors.length) {
        if (!source) throw new EmbeddedSelectionError('Missing embedded subtitle source');
        try {
            preparedById = await service.prepare(source, descriptors, signal);
        } catch (cause) {
            throw new EmbeddedSelectionError('Could not prepare embedded subtitle selection', { cause });
        }
    }
    const downloadedById = new Map<string, FileWithId>();
    const files: FileWithId[] = [];
    for (const track of tracks) {
        signal.throwIfAborted();
        if (track.embedded) {
            const file = preparedById?.get(track.id);
            if (!file) throw new EmbeddedSelectionError('Unresolved embedded subtitle');
            files.push(file);
        } else if (track.id === '-') {
            files.push({ id: '-', file: new File([''], '.srt') });
        } else if (track.file) {
            files.push({ id: track.id, file: track.file });
        } else {
            if (typeof track.url !== 'string') throw new Error('Invalid subtitle URL');
            let file = downloadedById.get(track.id);
            if (!file) {
                const response = await fetch(track.url, { signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                file = { id: track.id, file: new File([await response.blob()], `${track.name}.${track.extension}`) };
                downloadedById.set(track.id, file);
            }
            files.push(file);
        }
    }
    signal.throwIfAborted();
    return files;
};

/** Prepares one confirmation. The player owns any subsequent embedded extraction. */
export const useSubtitleSelection = ({
    source,
    service,
    selectedTrackIds,
    sources,
}: {
    source: FileWithId | undefined;
    service: EmbeddedSubtitles;
    selectedTrackIds: readonly string[];
    sources: MediaSources;
}) => {
    const request = useRef<AbortController>(undefined);
    const [state, setState] = useState<'idle' | 'loading' | Error>('idle');
    const cancel = useCallback(() => {
        request.current?.abort();
        request.current = undefined;
        setState('idle');
    }, []);
    useEffect(() => {
        cancel();
        return () => request.current?.abort();
    }, [source?.file, source?.id, service, cancel]);

    const confirm = useCallback(
        (
            tracks: readonly ConfirmedVideoDataSubtitleTrack[],
            commit: (tracks: LoadableSubtitleTrack<FileWithId>[], signal: AbortSignal) => Promise<void>
        ) => {
            if (request.current) return;
            const controller = new AbortController();
            request.current = controller;
            const { signal } = controller;
            setState('loading');
            void (async () => {
                try {
                    if (
                        tracks.length !== selectedTrackIds.length ||
                        tracks.some((track, index) => track.id !== selectedTrackIds[index])
                    ) {
                        throw new Error('Subtitle selection has changed');
                    }
                    const files = await resolveSubtitleSelection(tracks, source, service, signal);
                    signal.throwIfAborted();
                    const selectedTracks = files.map(
                        (file) => sources.findSubtitleTrack(file) ?? { fileParts: [file] }
                    );
                    await commit(selectedTracks, signal);
                    if (!signal.aborted) setState('idle');
                } catch (error) {
                    if (!signal.aborted) {
                        asbError('app/selector', 'Failed to confirm subtitle selection:', error);
                        setState(error instanceof Error ? error : new Error(String(error)));
                    }
                } finally {
                    if (request.current === controller) request.current = undefined;
                }
            })();
        },
        [source, service, selectedTrackIds, sources]
    );

    return {
        confirm,
        cancel,
        busy: state === 'loading',
        error: state instanceof Error ? state : undefined,
        embeddedError: state instanceof EmbeddedSelectionError,
    };
};
