import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DisplaySubtitleModel, LoadableSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { SubtitleReader } from '@project/common/subtitle-reader';
import type VideoChannel from '@project/common/app/services/video-channel';
import { timeDurationDisplay } from '@project/common/util';
import { asbTrace } from '@project/common/util/log';

interface UseSubtitleTracksParams {
    subtitleTracks: LoadableSubtitleTrack<FileWithId>[] | undefined;
    subtitleReader: Pick<SubtitleReader, 'subtitles'>;
    subtitles: DisplaySubtitleModel[] | undefined;
    channel: Pick<VideoChannel, 'onReady' | 'subtitles'> | undefined;
    getSubtitleOffset: () => number;
    onSubtitles: Dispatch<SetStateAction<DisplaySubtitleModel[] | undefined>>;
    onLoaded: (subtitleSourceFiles: File[]) => void;
    onError: (error: unknown) => void;
}

/** Loads owned source tracks and synchronizes their cues when the video is ready. */
export const useSubtitleTracks = ({
    subtitleTracks,
    subtitleReader,
    subtitles,
    channel,
    getSubtitleOffset,
    onSubtitles,
    onLoaded,
    onError,
}: UseSubtitleTracksParams) => {
    const [loadingSubtitles, setLoadingSubtitles] = useState(false);
    const [subtitlesSentThroughChannel, setSubtitlesSentThroughChannel] = useState(false);
    const [loadedSource, setLoadedSource] = useState<{
        tracks: LoadableSubtitleTrack<FileWithId>[];
        reader: typeof subtitleReader;
    }>();
    const subtitleFileNames = useMemo(
        () =>
            subtitleTracks?.map(({ fileParts }) => {
                const firstFilePart = fileParts[0];
                return firstFilePart?.file.name ?? '';
            }) ?? [],
        [subtitleTracks]
    );

    useEffect(() => {
        let cancelled = false;
        setLoadedSource(undefined);

        // Without source tracks, subtitles belong to an external owner (e.g. the side panel).
        if (subtitleTracks === undefined) {
            setLoadingSubtitles(false);
            return;
        }

        const tracks = subtitleTracks;
        async function load() {
            asbTrace('playback/player', 'Loading player subtitles', {
                subtitleTrackCount: tracks.length,
                subtitleFileCount: tracks.reduce((count, { fileParts }) => count + fileParts.length, 0),
                tracks: tracks.map(({ fileParts }, track) => ({
                    track,
                    fileCount: fileParts.length,
                    fileNames: Array.from(
                        new Set(fileParts.map(({ file: subtitleSourceFile }) => subtitleSourceFile.name))
                    ),
                })),
            });
            const offset = getSubtitleOffset();
            setLoadingSubtitles(tracks.length > 0);

            try {
                const nodes =
                    tracks.length === 0
                        ? []
                        : await subtitleReader.subtitles(
                              tracks.map(({ fileParts }) => ({
                                  fileParts: fileParts.map(({ file: subtitleSourceFile }) => subtitleSourceFile),
                              }))
                          );
                if (cancelled) return;
                const length = nodes.length > 0 ? nodes[nodes.length - 1].end + offset : 0;
                const loadedSubtitles: DisplaySubtitleModel[] = nodes.map((subtitle, index) => ({
                    text: subtitle.text,
                    textImage: subtitle.textImage,
                    start: subtitle.start + offset,
                    originalStart: subtitle.start,
                    end: subtitle.end + offset,
                    originalEnd: subtitle.end,
                    displayTime: timeDurationDisplay(subtitle.start + offset, length),
                    displayEndTime: timeDurationDisplay(subtitle.end + offset, length),
                    track: subtitle.track,
                    index,
                    tokenization: subtitle.tokenization,
                }));

                setLoadedSource({ tracks, reader: subtitleReader });
                setSubtitlesSentThroughChannel(false);
                asbTrace('playback/player', 'Loaded player subtitles', {
                    subtitleCount: loadedSubtitles.length,
                    subtitleCountsByTrack: tracks.map(
                        (_, track) => loadedSubtitles.filter((subtitle) => subtitle.track === track).length
                    ),
                    offset,
                });
                onSubtitles(loadedSubtitles);
            } catch (error) {
                if (cancelled) return;
                asbTrace('playback/player', 'Failed to load player subtitles', { error });
                onError(error);
                onSubtitles([]);
                setLoadedSource({ tracks, reader: subtitleReader });
                setSubtitlesSentThroughChannel(false);
            } finally {
                if (!cancelled) setLoadingSubtitles(false);
            }

            if (!cancelled) {
                onLoaded(
                    tracks.flatMap(({ fileParts }) =>
                        fileParts.map(({ file: subtitleSourceFile }) => subtitleSourceFile)
                    )
                );
            }
        }

        void load().catch((error) => {
            if (!cancelled) onError(error);
        });
        return () => {
            cancelled = true;
        };
    }, [subtitleReader, onLoaded, onError, subtitleTracks, onSubtitles, getSubtitleOffset]);

    useEffect(() => {
        setSubtitlesSentThroughChannel(false);
    }, [channel]);

    useEffect(() => {
        if (
            channel === undefined ||
            subtitles === undefined ||
            subtitlesSentThroughChannel ||
            subtitleTracks === undefined ||
            loadedSource?.tracks !== subtitleTracks ||
            loadedSource?.reader !== subtitleReader
        ) {
            return;
        }

        return channel.onReady(() => {
            setSubtitlesSentThroughChannel(true);
            const syncedSubtitles = subtitleTracks.length === 0 ? [] : subtitles;
            asbTrace('playback/player', 'Sending subtitles to media channel', {
                subtitleCount: syncedSubtitles.length,
                trackCount: subtitleTracks.length,
                fileCount: subtitleTracks.reduce((count, { fileParts }) => count + fileParts.length, 0),
                subtitleFileNames,
            });
            channel.subtitles(syncedSubtitles, subtitleFileNames);
        });
    }, [
        subtitles,
        channel,
        subtitleFileNames,
        subtitleTracks,
        subtitleReader,
        loadedSource,
        subtitlesSentThroughChannel,
    ]);

    return { loadingSubtitles, subtitleFileNames };
};
