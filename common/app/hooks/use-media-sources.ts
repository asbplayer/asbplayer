import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { VideoDataSubtitleTrack } from '@project/common';
import type { SubtitleReader } from '@project/common/subtitle-reader';
import type { SubtitleHost } from '@project/common/embedded-subtitles/subtitle-source';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import { genericSubtitleDisplayLabel } from '@project/common/util/subtitle-language';
import { subtitleCodecDisplayName } from '@project/common/media-probe';
import { emptySubtitleTrack } from '@project/common/components/VideoDataSyncDialog';
import { IndexedDBFileSessionRepository, supportsFileSystemAccess } from '@project/common/file-system-access';
import { MediaSourcesController } from '@project/common/app/services/media-sources-controller';
import type { SourcesAppliedEvent } from '@project/common/app/services/media-sources-controller';

let sessionRepository: IndexedDBFileSessionRepository | undefined;
const getSessionRepository = () => {
    if (sessionRepository === undefined && supportsFileSystemAccess()) {
        sessionRepository = new IndexedDBFileSessionRepository();
    }
    return sessionRepository;
};

/** Connects MediaSourcesController to React state, i18n formatting, and the player's subtitle producer. */
export const useMediaSources = ({
    subtitleHost,
    subtitleReader,
    onSourcesApplied,
    onError,
}: {
    subtitleHost: SubtitleHost;
    subtitleReader: SubtitleReader;
    onSourcesApplied: (event: SourcesAppliedEvent) => void;
    onError: (error: unknown) => void;
}) => {
    const { t } = useTranslation();
    const callbacksRef = useRef({ onSourcesApplied, onError });
    callbacksRef.current = { onSourcesApplied, onError };

    const controller = useMemo(
        () =>
            new MediaSourcesController({
                subtitleHost,
                sessionRepository: getSessionRepository(),
                onSourcesApplied: (event) => callbacksRef.current.onSourcesApplied(event),
                onError: (error) => callbacksRef.current.onError(error),
            }),
        [subtitleHost]
    );

    useEffect(() => {
        controller.initialize();
        return () => controller.dispose();
    }, [controller]);

    const state = useSyncExternalStore(controller.subscribe, controller.getState);

    const pickerTracks = useMemo<VideoDataSubtitleTrack[]>(() => {
        const tracksById = new Map<string, VideoDataSubtitleTrack>();
        // A zero-byte SRT preserves empty slots without making confirmation fetch the "-" URL.
        tracksById.set('-', { ...emptySubtitleTrack(t), file: new File([''], '.srt') });
        for (const track of state.picker.externalTracks) {
            tracksById.set(track.id, track);
        }
        const video = state.sources.videoFile;
        if (video && state.picker.embeddedTracks) {
            for (const track of state.picker.embeddedTracks) {
                const id = embeddedSubtitleId(video.id, track.trackIndex);
                tracksById.set(id, {
                    ...tracksById.get(id),
                    id,
                    extension: track.outputFormat ?? 'srt',
                    language: track.language,
                    embedded: embeddedDescriptor(video, track),
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
        }
        return [...tracksById.values()];
    }, [state.picker.externalTracks, state.picker.embeddedTracks, state.sources.videoFile, t]);

    const { selectionError, discoveryError } = state.picker;
    const pickerErrorMessage = useMemo(() => {
        if (selectionError?.kind === 'selection') return t('info.error', { message: selectionError.error.message });
        if (selectionError?.kind === 'embedded' || discoveryError) return t('error.embeddedSubtitlesLoadFailed');
        return '';
    }, [selectionError, discoveryError, t]);

    const subtitleProducer = useMemo(
        () =>
            controller.createProducer(state.embeddedSelection, {
                reader: subtitleReader,
                errorMessage: t('error.embeddedSubtitlesLoadFailed'),
            }),
        [controller, state.embeddedSelection, subtitleReader, t]
    );

    return {
        controller,
        sources: state.sources,
        canRestoreLastSession: state.canRestoreLastSession,
        subtitleProducer,
        picker: {
            open: state.picker.open,
            tracks: pickerTracks,
            selectedTrackIds: state.picker.selectedTrackIds,
            discovering: state.picker.discovering,
            confirming: state.picker.confirming,
            errorMessage: pickerErrorMessage,
        },
    };
};
