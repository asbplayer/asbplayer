import type { SubtitleModel } from '@project/common/src/model';
import type { SubtitleCue } from '@project/common/web-socket-client/web-socket-commands';

export const filterByTracks = (subtitles: SubtitleModel[], trackNumbers: number[] | undefined) => {
    if (trackNumbers === undefined || trackNumbers.length === 0) {
        return subtitles;
    }

    return subtitles.filter((subtitle) => trackNumbers.includes(subtitle.track));
};

export const toSubtitleCues = (subtitles: SubtitleModel[]): SubtitleCue[] =>
    subtitles.map(({ text, start, end, track }) => ({ text, start, end, track }));
