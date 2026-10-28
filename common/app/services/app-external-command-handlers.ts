import type { SubtitleModel } from '@project/common/src/model';
import { buildSubtitleTracks } from '@project/common/util';
import type {
    BoundMedia,
    SubtitleCue,
    ExternalCommandHandlers,
    GetMiningHistoryCommand,
    GetMiningHistoryResponseBody,
} from '@project/common/external-commands';
import { localMediaId, localMediaTitle } from '@project/common/external-commands/media';
import { copyHistoryItemsToCards, filterByTracks, toSubtitleCues } from '@project/common/external-commands/util';
import type { CopyHistoryRepository } from '@project/common/copy-history';

export interface AppExternalMediaState {
    appId: string;
    subtitles: SubtitleModel[];
    subtitleFileNames: string[];
    isActive: () => boolean;
}

export const appExternalCommandHandlers = (
    { appId, subtitles, subtitleFileNames, isActive }: AppExternalMediaState,
    copyHistoryRepository: CopyHistoryRepository
): Pick<ExternalCommandHandlers, 'onGetBoundMedia' | 'onGetSubtitles' | 'onGetMiningHistory'> => ({
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
    onGetMiningHistory: async (command: GetMiningHistoryCommand): Promise<GetMiningHistoryResponseBody> => {
        const copyHistoryItems = await copyHistoryRepository.fetch(command.body.limit, command.body.filter?.cardIds);
        return { cards: copyHistoryItemsToCards(copyHistoryItems) };
    },
});
