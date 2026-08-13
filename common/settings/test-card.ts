import type { CardModel } from '..';
import { urlToBase64 } from '@project/common/base64';

export const testCard: (urls: { imageUrl: string; audioUrl: string }) => Promise<CardModel> = async ({
    imageUrl,
    audioUrl,
}) => {
    return {
        subtitle: {
            text: 'So therefore the way to work towards perfection is simply to keep going, to enjoy the language.\n-Steve Kaufmann',
            start: 288925,
            end: 294695,
            originalStart: 288925,
            originalEnd: 294695,
            track: 0,
        },
        text: 'So therefore the way to work towards perfection is simply to keep going, to enjoy the language.\n-Steve Kaufmann',
        word: 'enjoy',
        definition: 'take delight or pleasure in (an activity or occasion).',
        surroundingSubtitles: [],
        subtitleFileName: "You Don't Have to Be Perfect to Become Fluent.srt",
        url: 'https://www.youtube.com/watch?v=eO4d6iueGzY',
        image: {
            base64: await urlToBase64(imageUrl),
            extension: 'jpeg',
        },
        audio: {
            base64: await urlToBase64(audioUrl),
            extension: 'mp3',
            paddingStart: 0,
            paddingEnd: 1000,
        },
        mediaTimestamp: 288925,
    };
};
