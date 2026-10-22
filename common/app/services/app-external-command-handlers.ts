import type { SubtitleModel } from '@project/common/src/model';
import { buildSubtitleTracks } from '@project/common/util';
import type { BoundMedia, SubtitleCue, ExternalCommandHandlers } from '@project/common/external-commands';
import { localMediaId, localMediaTitle } from '@project/common/external-commands/media';
import { filterByTracks, toSubtitleCues } from '@project/common/external-commands/subtitles';

export interface AppExternalMediaState {
    appId: string;
    subtitles: SubtitleModel[];
    subtitleFileNames: string[];
    isActive: () => boolean;
}

export const appExternalCommandHandlers = ({
    appId,
    subtitles,
    subtitleFileNames,
    isActive,
}: AppExternalMediaState): Pick<ExternalCommandHandlers, 'onGetBoundMedia' | 'onGetSubtitles'> => ({
    onGetBoundMedia: async (): Promise<BoundMedia[]> => {
        if (subtitles.length === 0) {
            return [];
        }

        const loadedSubtitles = buildSubtitleTracks(subtitles, subtitleFileNames);
        return [
            {
                id: localMediaId(appId),
                type: 'local',
                title: localMediaTitle(loadedSubtitles),
                loadedSubtitles,
                active: isActive(),
            },
        ];
    },
    onGetSubtitles: async (mediaId, trackNumbers): Promise<SubtitleCue[]> => {
        const targeted = mediaId === undefined ? isActive() : mediaId === localMediaId(appId);

        if (!targeted) {
            return [];
        }

        return toSubtitleCues(filterByTracks(subtitles, trackNumbers));
    },
});
