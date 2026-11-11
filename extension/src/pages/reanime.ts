import type { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { canonicalLanguageTag } from '@project/common/util/subtitle-language';
import { BaseGenericPageDiscovery } from '@project/extension/src/pages/base-generic-page';
import { deduplicateTracks } from '@project/extension/src/pages/subtitle-discovery';
import type { VideoDataProvider } from '@project/extension/src/pages/subtitle-discovery';
import { normalizeSubtitleExtension, trackFromDef } from '@project/extension/src/pages/util';

// reanime.to plays episodes in a flixcloud.cc iframe whose SvelteKit hydration script lists every subtitle as
// {url:"…",language:"English (…)",format:"ass",…}. The list is a JS literal, not JSON, so the generic
// inline-JSON discovery misses it, and only the active track ever shows up as a network request.
const subtitleEntry = /\{url:("(?:[^"\\]|\\.)*"),language:("(?:[^"\\]|\\.)*"),format:"(\w+)"/g;
// File names carry an ISO 639-2 code, e.g. <uuid>_jpn_2.ass
const languageFromUrl = /_([a-z]{3})(?:_\d+)?\.\w+(?:[?#]|$)/;

export function reanimeTracksFromScript(text: string): VideoDataSubtitleTrack[] {
    const tracks: VideoDataSubtitleTrack[] = [];
    for (const [, rawUrl, rawLabel, format] of text.matchAll(subtitleEntry)) {
        const url: string = JSON.parse(rawUrl);
        const extension = normalizeSubtitleExtension(format);
        if (extension === undefined) continue;
        const code = languageFromUrl.exec(url)?.[1];
        tracks.push(
            trackFromDef({
                label: JSON.parse(rawLabel),
                language: code === undefined ? undefined : canonicalLanguageTag(code),
                url,
                extension,
            })
        );
    }
    return tracks;
}

export class ReanimeDiscovery implements VideoDataProvider {
    private readonly generic = new BaseGenericPageDiscovery();

    async videoData(video: HTMLVideoElement): Promise<VideoData> {
        const inline = Array.from(document.querySelectorAll('script:not([src])')).flatMap((script) =>
            reanimeTracksFromScript(script.textContent ?? '')
        );
        const generic = await this.generic.videoData(video);
        // Inline tracks first so their descriptive labels win deduplication.
        return { ...generic, subtitles: deduplicateTracks([...inline, ...(generic.subtitles ?? [])]) };
    }
}
