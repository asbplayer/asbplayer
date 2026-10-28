import type { CopyHistoryItem, SubtitleModel } from '@project/common/src/model';
import type { Card, SubtitleCue } from '@project/common/external-commands/commands';

export const filterByTracks = (subtitles: SubtitleModel[], trackNumbers: number[] | undefined) => {
    if (trackNumbers === undefined || trackNumbers.length === 0) {
        return subtitles;
    }

    return subtitles.filter((subtitle) => trackNumbers.includes(subtitle.track));
};

export const toSubtitleCues = (subtitles: SubtitleModel[]): SubtitleCue[] =>
    subtitles.map(({ text, start, end, track }) => ({ text, start, end, track }));

const toSubtitleCue = ({ text, start, end, track }: SubtitleModel): SubtitleCue => ({ text, start, end, track });

export const copyHistoryItemsToCards = (copyHistoryItems: CopyHistoryItem[]): Card[] =>
    copyHistoryItems.map((c) => ({
        id: c.id,
        subtitle: toSubtitleCue(c.subtitle),
        text: c.text,
        word: c.word,
        definition: c.definition,
        customFieldValues: c.customFieldValues,
        url: c.url,
        image: c.image,
        audio: c.audio,
    }));
