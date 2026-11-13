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
    source:
        | {
              kind: 'local';
              tracks: LoadableSubtitleTrack<FileWithId>[] | undefined;
              reader: Pick<SubtitleReader, 'subtitles'>;
              onLoaded: (subtitleSourceFiles: File[]) => void;
          }
        | { kind: 'remote'; supportsProgressiveSubtitles: boolean };
    subtitles: DisplaySubtitleModel[] | undefined;
    channel: Pick<VideoChannel, 'onReady' | 'subtitles' | 'onSubtitleSource' | 'requestSubtitleSource'> | undefined;
    getSubtitleOffset: () => number;
    onSubtitles: Dispatch<SetStateAction<DisplaySubtitleModel[] | undefined>>;
    onError: (error: unknown) => void;
}

/** Loads local files or consumes the subtitle source owned by a connected video. */
export const useSubtitleTracks = ({
    source,
    subtitles,
    channel,
    getSubtitleOffset,
    onSubtitles,
    onError,
}: UseSubtitleTracksParams) => {
    const subtitleTracks = source.kind === 'local' ? source.tracks : undefined;
    const subtitleReader = source.kind === 'local' ? source.reader : undefined;
    const supportsProgressiveSubtitles = source.kind === 'remote' && source.supportsProgressiveSubtitles;
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
            if (fileLoad.current !== undefined || source.kind === 'local') return;
            if (!stream.current.update(update)) return;
            owner.current = 'remote';
            publish();
            if (update.type === 'failed') onError(new Error(update.error));
        },
        [publish, onError, source.kind]
    );

    const latest = useRef({ receive, sendSnapshot, publish, source, onError });
    latest.current = { receive, sendSnapshot, publish, source, onError };
    useEffect(() => {
        ready.current = false;
        if (!channel) return;
        const removeSource = channel.onSubtitleSource((update) => latest.current.receive(update));
        const removeReady = channel.onReady(() => {
            ready.current = true;
            if (source.kind === 'remote') {
                if (supportsProgressiveSubtitles) channel.requestSubtitleSource();
            } else {
                latest.current.sendSnapshot();
            }
        });
        return () => {
            ready.current = false;
            removeSource();
            removeReady();
        };
    }, [channel, source.kind, supportsProgressiveSubtitles]);
    useEffect(() => {
        const source = latest.current.source;
        if (source.kind === 'remote') {
            setLoadingFiles(false);
            if (owner.current !== 'remote') setSourceStates([]);
            owner.current = 'remote';
            return;
        }
        const { tracks: subtitleTracks, reader: subtitleReader } = source;
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
                latest.current.publish();
                latest.current.sendSnapshot();
            } catch (error) {
                if (fileLoad.current !== generation) return;
                asbTrace('playback/player', 'Failed to load player subtitles', { error });
                latest.current.onError(error);
                stream.current.replace([], names);
                owner.current = 'files';
                latest.current.publish();
                latest.current.sendSnapshot();
            } finally {
                if (fileLoad.current === generation) {
                    fileLoad.current = undefined;
                    setLoadingFiles(false);
                    const source = latest.current.source;
                    if (source.kind === 'local') {
                        source.onLoaded(subtitleTracks.flatMap(({ fileParts }) => fileParts.map(({ file }) => file)));
                    }
                }
            }
        })().catch((error) => latest.current.onError(error));
        return () => {
            if (fileLoad.current === generation) fileLoad.current = undefined;
        };
    }, [subtitleTracks, subtitleReader, source.kind]);

    return {
        sourceStates,
        subtitleFileNames,
        loadingSubtitles: loadingFiles || sourceStates.some((source) => source.status === 'loading'),
    };
};
