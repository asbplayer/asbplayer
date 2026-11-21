import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import { genericSubtitleDisplayLabel } from '@project/common/util/subtitle-language';
import { subtitleCodecDisplayName, probeAudioTracks } from '@project/common/media-probe';
import { useVideoDataSyncDialogState } from '@project/common/components/VideoDataSyncDialog';
import type { ProbedAudioTrack } from '@project/common/media-probe';
import { asbWarn } from '@project/common/util/log';
import type { FileWithId } from '@project/common/file-selector';
import type { SubtitleHost } from '@project/common/embedded-subtitles/subtitle-source';
import { useEmbeddedSubtitles } from '@project/common/app/hooks/use-embedded-subtitles';

export const useLocalSubtitlePicker = ({
    source,
    host,
    subtitleFiles,
    initialFiles,
    discoveryKey,
}: {
    source: FileWithId | undefined;
    host: SubtitleHost;
    subtitleFiles: readonly FileWithId[];
    initialFiles: readonly (FileWithId | undefined)[];
    discoveryKey?: object;
}) => {
    const { t } = useTranslation();
    const picker = useVideoDataSyncDialogState(initialFiles);
    const { subtitleTrackSelectorOpen, openSubtitleTrackSelector, openSubtitleTrackSelectorWithFiles } = picker;
    const [autoDiscoverSource, setAutoDiscoverSource] = useState<{ file: File; discoverSubtitles: boolean }>();
    const embedded = useEmbeddedSubtitles({
        source,
        host,
        open: subtitleTrackSelectorOpen,
        discoveryKey: discoveryKey ?? autoDiscoverSource,
        discoverOnLoad: autoDiscoverSource?.discoverSubtitles === true && autoDiscoverSource.file === source?.file,
    });
    const { cancel: cancelDiscovery, tracks, error } = embedded;
    const [audioCatalog, setAudioCatalog] = useState<{ file: File; tracks: readonly ProbedAudioTrack[] }>();
    const audioTracks = audioCatalog?.file === source?.file ? audioCatalog?.tracks : undefined;
    useEffect(() => {
        if (!source || audioTracks || (!subtitleTrackSelectorOpen && !autoDiscoverSource)) return;
        const controller = new AbortController();
        void probeAudioTracks(source.file, controller.signal)
            .catch((probeError) => {
                if (!controller.signal.aborted) asbWarn('media/probe', 'Could not discover audio tracks:', probeError);
                return [];
            })
            .then((probedTracks) => {
                if (!controller.signal.aborted) setAudioCatalog({ file: source.file, tracks: probedTracks });
            });
        return () => controller.abort();
    }, [source, audioTracks, subtitleTrackSelectorOpen, autoDiscoverSource]);
    const { setSubtitleTrackSelectorTracks } = picker;
    const cancel = useCallback(() => {
        setAutoDiscoverSource(undefined);
        cancelDiscovery();
    }, [cancelDiscovery]);
    const { closeSubtitleTrackSelector: closePicker } = picker;
    const closeSubtitleTrackSelector = useCallback(() => {
        cancel();
        closePicker();
    }, [cancel, closePicker]);

    const onManualFilesImported = useCallback(
        (videoFile: FileWithId | undefined, files: readonly FileWithId[]) => {
            setAutoDiscoverSource(undefined);
            if (files.length > 1) {
                openSubtitleTrackSelectorWithFiles(files);
            } else if (videoFile) {
                setAutoDiscoverSource({
                    file: videoFile.file,
                    discoverSubtitles:
                        !files.length && !subtitleFiles.some((file) => file.id !== '-' && !file.embedded),
                });
            }
        },
        [openSubtitleTrackSelectorWithFiles, subtitleFiles]
    );

    useEffect(() => {
        if (
            !autoDiscoverSource ||
            autoDiscoverSource.file !== source?.file ||
            !audioTracks ||
            (autoDiscoverSource.discoverSubtitles && !tracks && !error)
        ) {
            return;
        }
        setAutoDiscoverSource(undefined);
        if (
            (audioTracks.length > 1 ||
                (autoDiscoverSource.discoverSubtitles &&
                    tracks?.some((track) => track.outputFormat) &&
                    !subtitleFiles.some((file) => file.id !== '-'))) &&
            !subtitleTrackSelectorOpen
        ) {
            openSubtitleTrackSelector();
        }
    }, [
        autoDiscoverSource,
        audioTracks,
        source,
        tracks,
        error,
        subtitleFiles,
        subtitleTrackSelectorOpen,
        openSubtitleTrackSelector,
    ]);

    useEffect(() => {
        if (!subtitleTrackSelectorOpen || !source || !tracks) return;
        // Reapply cached embedded choices after a replacement import resets the external choices.
        setSubtitleTrackSelectorTracks((previous) => {
            const tracksById = new Map(previous.map((track) => [track.id, track]));
            for (const track of tracks) {
                const id = embeddedSubtitleId(source.id, track.trackIndex);
                tracksById.set(id, {
                    ...tracksById.get(id),
                    id,
                    extension: track.outputFormat ?? 'srt',
                    language: track.language,
                    embedded: embeddedDescriptor(source, track),
                    label: [
                        genericSubtitleDisplayLabel(track.title, track.language, ''),
                        subtitleCodecDisplayName(track.codec),
                        t('settings.subtitleTrackChoice', { trackNumber: track.trackIndex + 1 }),
                    ]
                        .filter(Boolean)
                        .join(' · '),
                    disabledReason: track.outputFormat
                        ? undefined
                        : t('error.unsupportedFormat', { format: subtitleCodecDisplayName(track.codec) }),
                });
            }
            return [...tracksById.values()];
        });
    }, [tracks, source, subtitleTrackSelectorOpen, discoveryKey, setSubtitleTrackSelectorTracks, t]);

    return {
        ...picker,
        audioTracks,
        closeSubtitleTrackSelector,
        onManualFilesImported,
        embedded: { ...embedded, cancel },
    };
};
