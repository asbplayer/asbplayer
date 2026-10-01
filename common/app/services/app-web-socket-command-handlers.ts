import type { SubtitleModel } from '@project/common/src/model';
import { buildSubtitleTracks } from '@project/common/util';
import type { BoundMedia, SubtitleCue, WebSocketCommandHandlers } from '@project/common/web-socket-client';
import { localMediaId, localMediaTitle } from '@project/common/web-socket-client/web-socket-media';
import { filterByTracks, toSubtitleCues } from '@project/common/web-socket-client/web-socket-subtitles';

export interface AppWebSocketMediaState {
    appId: string;
    subtitles: SubtitleModel[];
    subtitleFileNames: string[];
    isActive: () => boolean;
}

export const appWebSocketCommandHandlers = ({
    appId,
    subtitles,
    subtitleFileNames,
    isActive,
}: AppWebSocketMediaState): Pick<WebSocketCommandHandlers, 'onGetBoundMedia' | 'onGetSubtitles'> => ({
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
