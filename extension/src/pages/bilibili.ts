import { VideoDataSubtitleTrackDef } from '@project/common';
import { extractExtension } from './util';

type JsonObject = Record<string, unknown>;

const objectValue = (value: unknown): JsonObject | undefined =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;

const nonEmptyString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value : undefined;

const absoluteUrl = (url: string, baseUrl: string): string | undefined => {
    try {
        return new URL(url, baseUrl).href;
    } catch {
        return undefined;
    }
};

export function extractBilibiliTracks(value: unknown, baseUrl: string): VideoDataSubtitleTrackDef[] {
    const tracks: VideoDataSubtitleTrackDef[] = [];
    const data = objectValue(objectValue(value)?.data);

    if (Array.isArray(data?.subtitles)) {
        for (const value of data.subtitles) {
            const track = objectValue(value);
            const label = nonEmptyString(track?.lang);
            const language = nonEmptyString(track?.lang_key);
            const srt = objectValue(track?.srt);
            const rawUrl = nonEmptyString(srt?.url) ?? nonEmptyString(track?.url);

            if (label === undefined || language === undefined || rawUrl === undefined) {
                continue;
            }

            const url = absoluteUrl(rawUrl, baseUrl);

            if (url === undefined) {
                continue;
            }

            const extension = extractExtension(url, 'srt').toLowerCase();
            tracks.push({
                label,
                language,
                url,
                extension: extension === 'json' ? 'bbjson' : extension,
            });
        }
    }

    const mainlandSubtitles = objectValue(data?.subtitle)?.subtitles;

    if (Array.isArray(mainlandSubtitles)) {
        for (const value of mainlandSubtitles) {
            const track = objectValue(value);
            const language = nonEmptyString(track?.lan);
            const rawUrl = nonEmptyString(track?.subtitle_url);

            if (language === undefined || rawUrl === undefined) {
                continue;
            }

            const url = absoluteUrl(rawUrl, baseUrl);

            if (url === undefined) {
                continue;
            }

            tracks.push({
                label: nonEmptyString(track?.lan_doc) ?? language,
                language,
                url,
                extension: 'bbjson',
            });
        }
    }

    return tracks;
}
