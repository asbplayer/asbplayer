import type { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { trackFromDef } from './util';

export const noAccessError = 'This video requires a Dreaming subscription';
export const notSignedInError = 'Not signed in to Dreaming';

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

// Failures that can resolve on their own: auth that has not finished hydrating,
// rate limiting, and server-side errors. Anything else is reported immediately.
export const isRetryableStatus = (status: number) =>
    status === 401 || status === 408 || status === 429 || status >= 500;

export const statusError = (status: number) =>
    status === 401 ? notSignedInError : `Video API returned status ${status}`;

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

    const basename = video.title || fallbackBasename;

    // Locked videos come back without subtitle sources - explain why instead of
    // reporting an empty track list as if the video simply had no subtitles
    if (video.hasAccess === false) {
        return { error: noAccessError, basename, subtitles: [] };
    }

    return { error: '', basename, subtitles: subtitleTracksFromVideo(video) };
};
