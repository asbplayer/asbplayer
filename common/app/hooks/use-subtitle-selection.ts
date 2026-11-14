import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConfirmedVideoDataSubtitleTrack, LoadableSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { MediaSources } from '@project/common/app/services/media-sources';
import type { EmbeddedSubtitles } from '@project/common/embedded-subtitles/embedded-subtitles';
import type { SubtitleSourceStatus } from '@project/common/subtitle-reader/subtitle-stream';
import { asbError } from '@project/common/util/log';

/** Prepare the selection without extracting embedded tracks; their completed files arrive from the producer. */
const resolveSubtitleSelection = async (
    tracks: ConfirmedVideoDataSubtitleTrack[],
    source: FileWithId | undefined,
    service: EmbeddedSubtitles,
    signal: AbortSignal
): Promise<FileWithId[]> => {
    signal.throwIfAborted();
    if (tracks.some((track) => track.disabledReason)) throw new Error('Unsupported subtitle selection');
    const descriptors = tracks.flatMap((track) => (track.embedded ? [track.embedded] : []));
    if (descriptors.length > 0 && !source) throw new Error('Missing embedded subtitle source');
    const prepared =
        descriptors.length > 0 ? await service.prepare(source!, descriptors, signal) : new Map<string, FileWithId>();
    const downloaded = new Map<string, FileWithId>();
    const files: FileWithId[] = [];
    for (const track of tracks) {
        signal.throwIfAborted();
        if (track.embedded) {
            const file = prepared.get(track.id);
            if (!file) throw new Error('Unresolved embedded subtitle');
            files.push(file);
        } else if (track.id === '-') {
            files.push({ id: '-', file: new File([''], '.srt') });
        } else if (track.file) {
            files.push({ id: track.id, file: track.file });
        } else {
            if (typeof track.url !== 'string') throw new Error('Invalid subtitle URL');
            let file = downloaded.get(track.id);
            if (!file) {
                const response = await fetch(track.url, { signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                file = { id: track.id, file: new File([await response.blob()], `${track.name}.${track.extension}`) };
                downloaded.set(track.id, file);
            }
            files.push(file);
        }
    }
    signal.throwIfAborted();
    return files;
};

/** Preserves unchanged subtitles or prepares a new selection; the player owns embedded extraction. */
export const useSubtitleSelection = ({
    source,
    service,
    selectedTrackIds,
    sources,
}: {
    source: FileWithId | undefined;
    service: EmbeddedSubtitles;
    selectedTrackIds: string[];
    sources: MediaSources;
}) => {
    const request = useRef<AbortController>(undefined);
    const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
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
        ({
            tracks,
            audioTrackIndex,
            subtitleSourceStatus,
            onSubtitlesUnchanged,
            commit,
        }: {
            tracks: ConfirmedVideoDataSubtitleTrack[];
            audioTrackIndex: number | undefined;
            subtitleSourceStatus: SubtitleSourceStatus;
            onSubtitlesUnchanged: () => void;
            commit: (tracks: LoadableSubtitleTrack<FileWithId>[], signal: AbortSignal) => Promise<void>;
        }) => {
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
                    // Keep annotations and an active producer for audio-only or unchanged choices.
                    // An unchanged confirmation still retries a failed subtitle load or session commit.
                    if (
                        state !== 'failed' &&
                        sources.matchesSubtitleSelection(tracks) &&
                        (audioTrackIndex !== sources.audioTrackIndex || subtitleSourceStatus !== 'failed')
                    ) {
                        onSubtitlesUnchanged();
                        if (!signal.aborted) setState('idle');
                        return;
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
                        setState('failed');
                    }
                } finally {
                    if (request.current === controller) request.current = undefined;
                }
            })();
        },
        [source, service, selectedTrackIds, sources, state]
    );

    return {
        confirm,
        cancel,
        busy: state === 'loading',
        error: state === 'failed',
    };
};
