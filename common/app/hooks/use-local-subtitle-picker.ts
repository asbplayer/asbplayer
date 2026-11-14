import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import { genericSubtitleDisplayLabel } from '@project/common/util/subtitle-language';
import { subtitleCodecDisplayName } from '@project/common/media-probe';
import { useVideoDataSyncDialogState } from '@project/common/components/VideoDataSyncDialog';
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
    subtitleFiles: FileWithId[];
    initialFiles: FileWithId[];
    discoveryKey?: object;
}) => {
    const { t } = useTranslation();
    const picker = useVideoDataSyncDialogState(initialFiles);
    const { subtitleTrackSelectorOpen, openSubtitleTrackSelector, openSubtitleTrackSelectorWithFiles } = picker;
    const [autoDiscoverSource, setAutoDiscoverSource] = useState<{ file: File }>();
    const embedded = useEmbeddedSubtitles({
        source,
        host,
        open: subtitleTrackSelectorOpen,
        discoveryKey: discoveryKey ?? autoDiscoverSource,
        discoverOnLoad: autoDiscoverSource !== undefined && autoDiscoverSource.file === source?.file,
    });
    const { cancel: cancelDiscovery, tracks, error } = embedded;
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

    // Only manual imports opt into automatic opening; restoring a session does not.
    const onFilesImported = useCallback(
        (videoFile: FileWithId | undefined, files: FileWithId[]) => {
            setAutoDiscoverSource(undefined);
            if (files.length > 1) {
                openSubtitleTrackSelectorWithFiles(files);
            } else if (
                videoFile &&
                files.length === 0 &&
                !subtitleFiles.some((file) => file.id !== '-' && !file.embedded)
            ) {
                setAutoDiscoverSource({ file: videoFile.file });
            }
        },
        [openSubtitleTrackSelectorWithFiles, subtitleFiles]
    );

    useEffect(() => {
        if (!autoDiscoverSource || autoDiscoverSource.file !== source?.file || (!tracks && !error)) return;
        setAutoDiscoverSource(undefined);
        if (
            tracks?.some((track) => track.outputFormat) &&
            !subtitleFiles.some((file) => file.id !== '-') &&
            !subtitleTrackSelectorOpen
        ) {
            openSubtitleTrackSelector();
        }
    }, [
        autoDiscoverSource,
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
            const merged = new Map(previous.map((track) => [track.id, track]));
            for (const track of tracks) {
                const id = embeddedSubtitleId(source.id, track.trackIndex);
                merged.set(id, {
                    ...merged.get(id),
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
            return [...merged.values()];
        });
    }, [tracks, source, subtitleTrackSelectorOpen, discoveryKey, setSubtitleTrackSelectorTracks, t]);

    return {
        ...picker,
        closeSubtitleTrackSelector,
        onFilesImported,
        embedded: { ...embedded, cancel },
    };
};
