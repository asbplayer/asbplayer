import type { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { trackFromDef } from './util';

export interface DreamingVideo {
    title?: string;
    language?: string;
    hasAccess?: boolean;
    // Inline WebVTT content
    subtitles?: string;
    sources?: {
        // Signed base URL valid for a limited time after the API response is issued
        bunny?: string;
    };
}

const languageLabel = (code: string) => {
    try {
        return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
    } catch {
        return code;
    }
};

const utf8ToBase64 = (text: string) =>
    btoa(
        encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    );

const subtitleTracksFromVideo = (video: DreamingVideo): VideoDataSubtitleTrack[] => {
    if (video.hasAccess === false) {
        return [];
    }

    const inlineVtt =
        typeof video.subtitles === 'string' && video.subtitles.trimStart().startsWith('WEBVTT')
            ? video.subtitles
            : undefined;
    const bunnyBaseUrl = typeof video.sources?.bunny === 'string' ? video.sources.bunny : undefined;
    const url =
        inlineVtt !== undefined
            ? `data:text/vtt;base64,${utf8ToBase64(inlineVtt)}`
            : bunnyBaseUrl !== undefined
              ? `${bunnyBaseUrl}/subtitles.webvtt`
              : undefined;

    if (url === undefined) {
        return [];
    }

    const language = video.language;
    return [
        trackFromDef({
            label: language === undefined ? 'Subtitles' : languageLabel(language),
            language,
            url,
            extension: 'vtt',
        }),
    ];
};

export const videoDataFromResponse = (value: any, fallbackBasename: string): VideoData => {
    const video: DreamingVideo | undefined = value?.video;

    if (typeof video !== 'object' || video === null) {
        return { error: '', basename: fallbackBasename, subtitles: [] };
    }

    return {
        error: '',
        basename: video.title || fallbackBasename,
        subtitles: subtitleTracksFromVideo(video),
    };
};
