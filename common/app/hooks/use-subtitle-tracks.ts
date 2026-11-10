import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DisplaySubtitleModel, LoadableSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { SubtitleReader } from '@project/common/subtitle-reader';
import type VideoChannel from '@project/common/app/services/video-channel';
import { displaySubtitleSnapshot, SubtitleStream } from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceState, SubtitleSourceUpdate } from '@project/common/subtitle-reader/subtitle-stream';
import { asbTrace } from '@project/common/util/log';

interface UseSubtitleTracksParams {
    sourceOwnership: 'local' | 'remote';
    subtitleTracks: LoadableSubtitleTrack<FileWithId>[] | undefined;
    subtitleReader: Pick<SubtitleReader, 'subtitles'>;
    subtitles: DisplaySubtitleModel[] | undefined;
    channel: Pick<VideoChannel, 'onReady' | 'subtitles' | 'onSubtitleSource' | 'requestSubtitleSource'> | undefined;
    supportsProgressiveSubtitles: boolean;
    getSubtitleOffset: () => number;
    onSubtitles: Dispatch<SetStateAction<DisplaySubtitleModel[] | undefined>>;
    onLoaded: (subtitleSourceFiles: File[]) => void;
    onError: (error: unknown) => void;
}

/** Loads local files or consumes the subtitle source owned by a connected video. */
export const useSubtitleTracks = ({
    sourceOwnership,
    subtitleTracks,
    subtitleReader,
    subtitles,
    channel,
    supportsProgressiveSubtitles,
    getSubtitleOffset,
    onSubtitles,
    onLoaded,
    onError,
}: UseSubtitleTracksParams) => {
    const stream = useRef(new SubtitleStream());
    const currentSubtitles = useRef(subtitles);
    currentSubtitles.current = subtitles;
    const fileLoad = useRef<object | undefined>(undefined);
    const ready = useRef(false);
    const owner = useRef<'none' | 'loading-files' | 'files' | 'remote'>(
        subtitleTracks === undefined ? 'none' : 'loading-files'
    );
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [sourceStates, setSourceStates] = useState<readonly SubtitleSourceState[]>([]);
    const subtitleFileNames = useMemo(() => {
        if (!sourceStates.length) return subtitleTracks?.map(({ fileParts }) => fileParts[0]?.file.name ?? '') ?? [];
        const names: string[] = [];
        for (const state of sourceStates) {
            while (names.length <= state.track) names.push('');
            names[state.track] = state.name;
        }
        return names;
    }, [sourceStates, subtitleTracks]);

    const publish = useCallback(() => {
        const snapshot = stream.current.snapshot;
        setSourceStates(snapshot.tracks);
        onSubtitles((previous) => displaySubtitleSnapshot(snapshot, previous ?? [], getSubtitleOffset()));
    }, [onSubtitles, getSubtitleOffset]);

    const sendSnapshot = useCallback(() => {
        if (!channel || !ready.current || owner.current !== 'files') return;
        const snapshot = stream.current.snapshot;
        const displayed = displaySubtitleSnapshot(snapshot, currentSubtitles.current ?? [], getSubtitleOffset());
        const names: string[] = [];
        for (const state of snapshot.tracks) {
            while (names.length <= state.track) names.push('');
            names[state.track] = state.name;
        }
        asbTrace('playback/player', 'Sending subtitles to media channel', {
            subtitleCount: snapshot.subtitles.length,
            trackCount: snapshot.tracks.length,
            subtitleFileNames: names,
        });
        channel.subtitles(displayed, names);
    }, [channel, getSubtitleOffset]);

    const receive = useCallback(
        (update: SubtitleSourceUpdate) => {
            if (fileLoad.current !== undefined || sourceOwnership === 'local') return;
            if (!stream.current.update(update)) return;
            owner.current = 'remote';
            publish();
            if (update.type === 'failed') onError(new Error(update.error));
        },
        [publish, onError, sourceOwnership]
    );

    const callbacks = useRef({ receive, sendSnapshot, publish, onLoaded, onError });
    callbacks.current = { receive, sendSnapshot, publish, onLoaded, onError };
    useEffect(() => {
        ready.current = false;
        if (!channel) return;
        const removeSource = channel.onSubtitleSource((update) => callbacks.current.receive(update));
        const removeReady = channel.onReady(() => {
            ready.current = true;
            if (sourceOwnership === 'remote') {
                if (supportsProgressiveSubtitles) channel.requestSubtitleSource();
            } else {
                callbacks.current.sendSnapshot();
            }
        });
        return () => {
            ready.current = false;
            removeSource();
            removeReady();
        };
    }, [channel, sourceOwnership, supportsProgressiveSubtitles]);
    useEffect(() => {
        if (sourceOwnership === 'remote') {
            setLoadingFiles(false);
            if (owner.current !== 'remote') setSourceStates([]);
            owner.current = 'remote';
            return;
        }
        if (subtitleTracks === undefined) {
            setLoadingFiles(false);
            if (owner.current === 'files' || owner.current === 'loading-files') {
                owner.current = 'remote';
                setSourceStates([]);
            }
            return;
        }
        owner.current = 'loading-files';
        const generation = {};
        fileLoad.current = generation;
        setLoadingFiles(subtitleTracks.length > 0);
        const names = subtitleTracks.map(({ fileParts }) => fileParts[0]?.file.name ?? '');
        asbTrace('playback/player', 'Loading player subtitles', {
            subtitleTrackCount: subtitleTracks.length,
            subtitleFileCount: subtitleTracks.reduce((count, { fileParts }) => count + fileParts.length, 0),
            subtitleFileNames: names,
        });
        void (async () => {
            try {
                const nodes =
                    subtitleTracks.length === 0
                        ? []
                        : await subtitleReader.subtitles(
                              subtitleTracks.map(({ fileParts }) => ({ fileParts: fileParts.map(({ file }) => file) }))
                          );
                if (fileLoad.current !== generation) return;
                stream.current.replace(
                    nodes.map((cue) => ({ ...cue, originalStart: cue.start, originalEnd: cue.end })),
                    names
                );
                owner.current = 'files';
                asbTrace('playback/player', 'Loaded player subtitles', {
                    subtitleCount: nodes.length,
                    subtitleCountsByTrack: subtitleTracks.map(
                        (_, track) => nodes.filter((cue) => cue.track === track).length
                    ),
                });
                callbacks.current.publish();
                callbacks.current.sendSnapshot();
            } catch (error) {
                if (fileLoad.current !== generation) return;
                asbTrace('playback/player', 'Failed to load player subtitles', { error });
                callbacks.current.onError(error);
                stream.current.replace([], names);
                owner.current = 'files';
                callbacks.current.publish();
                callbacks.current.sendSnapshot();
            } finally {
                if (fileLoad.current === generation) {
                    fileLoad.current = undefined;
                    setLoadingFiles(false);
                    callbacks.current.onLoaded(
                        subtitleTracks.flatMap(({ fileParts }) => fileParts.map(({ file }) => file))
                    );
                }
            }
        })().catch((error) => callbacks.current.onError(error));
        return () => {
            if (fileLoad.current === generation) fileLoad.current = undefined;
        };
    }, [subtitleTracks, subtitleReader, sourceOwnership]);

    return {
        sourceStates,
        subtitleFileNames,
        loadingSubtitles: loadingFiles || sourceStates.some((source) => source.status === 'loading'),
    };
};
