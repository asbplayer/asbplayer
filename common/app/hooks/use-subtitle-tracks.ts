import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DisplaySubtitleModel, LoadableSubtitleTrack, SubtitleSourceMessage } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { SubtitleReader } from '@project/common/subtitle-reader';
import type VideoChannel from '@project/common/app/services/video-channel';
import {
    displaySubtitleSnapshot,
    SubtitleStream,
    subtitleSourceNames,
} from '@project/common/subtitle-reader/subtitle-stream';
import type {
    SubtitleSourceProducer,
    SubtitleSourceState,
    SubtitleSourceUpdate,
} from '@project/common/subtitle-reader/subtitle-stream';
import { asbTrace } from '@project/common/util/log';

interface UseSubtitleTracksParams {
    source:
        | {
              kind: 'local';
              tracks: LoadableSubtitleTrack<FileWithId>[] | undefined;
              reader: Pick<SubtitleReader, 'subtitles'>;
              onLoaded: (subtitleSourceFiles: File[]) => void;
          }
        | { kind: 'remote'; supportsProgressiveSubtitles: boolean; onOffset: (offset: number) => void }
        | {
              kind: 'producer';
              producer: SubtitleSourceProducer;
              supportsProgressiveSubtitles: boolean;
              onStarted: () => void;
          };
    subtitles: DisplaySubtitleModel[] | undefined;
    channel:
        | Pick<
              VideoChannel,
              | 'onReady'
              | 'subtitles'
              | 'subtitlesUpdated'
              | 'onSubtitleSource'
              | 'subtitleSource'
              | 'requestSubtitleSource'
          >
        | undefined;
    getSubtitleOffset: () => number;
    onSubtitles: Dispatch<SetStateAction<DisplaySubtitleModel[] | undefined>>;
    onError: (error: unknown) => void;
}

/** Loads local files, runs a producer, or consumes the source owned by a connected video. */
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
    const producer = source.kind === 'producer' ? source.producer : undefined;
    const supportsProgressiveSubtitles = source.kind !== 'local' && source.supportsProgressiveSubtitles;
    const stream = useRef(new SubtitleStream());
    const currentSubtitles = useRef(subtitles);
    currentSubtitles.current = subtitles;
    const fileLoad = useRef<object | undefined>(undefined);
    const ready = useRef(false);
    const owner = useRef<'none' | 'loading-files' | 'files' | 'producer' | 'remote'>(
        subtitleTracks === undefined ? 'none' : 'loading-files'
    );
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [sourceStates, setSourceStates] = useState<readonly SubtitleSourceState[]>([]);
    const subtitleFileNames = useMemo(() => {
        if (!sourceStates.length) return subtitleTracks?.map(({ fileParts }) => fileParts[0]?.file.name ?? '') ?? [];
        return subtitleSourceNames(sourceStates);
    }, [sourceStates, subtitleTracks]);

    const publish = useCallback(() => {
        const snapshot = stream.current.snapshot;
        // Older extensions identify cues by index, so both sides need the completed selection.
        if (
            source.kind === 'producer' &&
            !supportsProgressiveSubtitles &&
            snapshot.tracks.some((track) => track.status === 'loading')
        ) {
            return;
        }
        setSourceStates(snapshot.tracks);
        onSubtitles((previous) => displaySubtitleSnapshot(snapshot, previous ?? [], getSubtitleOffset()));
    }, [source.kind, supportsProgressiveSubtitles, onSubtitles, getSubtitleOffset]);

    const sendSnapshot = useCallback(() => {
        if (!channel || !ready.current) return;
        if (source.kind === 'remote') return;
        if (source.kind === 'local' ? owner.current !== 'files' : owner.current !== 'producer') return;
        const snapshot = stream.current.snapshot;
        const displayed = displaySubtitleSnapshot(snapshot, currentSubtitles.current ?? [], getSubtitleOffset());
        if (source.kind === 'producer' && supportsProgressiveSubtitles) {
            channel.subtitleSource({ type: 'snapshot', ...stream.current.sourceSnapshot, offset: getSubtitleOffset() });
            const annotated = displayed.filter((cue) => cue.tokenization !== undefined);
            if (annotated.length) channel.subtitlesUpdated(annotated);
            return;
        }
        if (snapshot.tracks.some((track) => track.status === 'loading')) return;
        const names = subtitleSourceNames(snapshot.tracks);
        asbTrace('playback/player', 'Sending subtitles to media channel', {
            subtitleCount: snapshot.subtitles.length,
            trackCount: snapshot.tracks.length,
            subtitleFileNames: names,
        });
        channel.subtitles(displayed, names);
    }, [channel, source.kind, supportsProgressiveSubtitles, getSubtitleOffset]);

    const receive = useCallback(
        (update: SubtitleSourceMessage['update']) => {
            if (fileLoad.current !== undefined || source.kind !== 'remote') return;
            if (!stream.current.update(update)) return;
            if (update.type === 'snapshot') source.onOffset(update.offset);
            owner.current = 'remote';
            publish();
            if (update.type === 'failed') onError(new Error(update.error));
        },
        [publish, onError, source]
    );

    const receiveProducer = useCallback(
        (update: SubtitleSourceUpdate) => {
            if (!stream.current.update(update)) return;
            publish();
            if (update.type === 'failed') onError(new Error(update.error));
            if (channel && ready.current) {
                if (supportsProgressiveSubtitles) {
                    channel.subtitleSource(
                        update.type === 'snapshot' ? { ...update, offset: getSubtitleOffset() } : update
                    );
                } else {
                    sendSnapshot();
                }
            }
        },
        [publish, onError, channel, supportsProgressiveSubtitles, getSubtitleOffset, sendSnapshot]
    );

    const latest = useRef({ receive, receiveProducer, sendSnapshot, publish, source, onError });
    latest.current = { receive, receiveProducer, sendSnapshot, publish, source, onError };
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
        if (source.kind === 'producer') {
            const controller = new AbortController();
            owner.current = 'producer';
            setLoadingFiles(false);
            void source
                .producer((update) => {
                    if (!controller.signal.aborted) latest.current.receiveProducer(update);
                }, controller.signal)
                .catch((error) => {
                    if (!controller.signal.aborted) latest.current.onError(error);
                });
            source.onStarted(); // Hand off loading UI now; further progress belongs to the subtitle source.
            return () => controller.abort();
        }
        if (source.kind === 'remote') {
            setLoadingFiles(false);
            if (owner.current !== 'remote') setSourceStates([]);
            owner.current = 'remote';
            return;
        }
        const { tracks: subtitleTracks, reader: subtitleReader } = source;
        if (subtitleTracks === undefined) {
            setLoadingFiles(false);
            if (owner.current === 'files' || owner.current === 'loading-files' || owner.current === 'producer') {
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
                stream.current.replace([], names, error instanceof Error ? error.message : String(error));
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
    }, [source.kind, producer, subtitleTracks, subtitleReader]);

    return {
        sourceStates,
        subtitleFileNames,
        loadingSubtitles: loadingFiles || sourceStates.some((source) => source.status === 'loading'),
    };
};
