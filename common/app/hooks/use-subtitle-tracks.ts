import { useEffect, useMemo, useState } from 'react';
import { SubtitleTracksController } from '@project/common/app/services/subtitle-tracks-controller';
import type {
    SubtitleTracksOptions,
    SubtitleTracksState,
} from '@project/common/app/services/subtitle-tracks-controller';
import { subtitleSourceNames } from '@project/common/subtitle-reader/subtitle-stream';

/** Connects the subtitle lifecycle controller to React state and effects. */
export const useSubtitleTracks = (options: SubtitleTracksOptions) => {
    const [state, setState] = useState<SubtitleTracksState>({ sources: [], loadingFiles: false });
    const [controller] = useState(() => new SubtitleTracksController(options, setState));
    controller.options = options;
    const { source, channel } = options;
    const tracks = source.kind === 'local' ? source.tracks : undefined;
    const reader = source.kind === 'local' ? source.reader : undefined;
    const producer = source.kind === 'producer' ? source.producer : undefined;
    const supportsProgressiveSubtitles = source.kind !== 'local' && source.supportsProgressiveSubtitles;

    useEffect(() => {
        controller.setSource(controller.options.source);
        return () => controller.cancelSource();
    }, [controller, source.kind, tracks, reader, producer]);

    useEffect(() => controller.connect(channel), [controller, channel, source.kind, supportsProgressiveSubtitles]);

    const subtitleFileNames = useMemo(
        () =>
            state.sources.length
                ? subtitleSourceNames(state.sources)
                : (tracks?.map(({ fileParts }) => fileParts[0]?.file.name ?? '') ?? []),
        [state.sources, tracks]
    );
    return {
        sourceStates: state.sources,
        subtitleFileNames,
        loadingSubtitles: state.loadingFiles || state.sources.some((track) => track.status === 'loading'),
    };
};
