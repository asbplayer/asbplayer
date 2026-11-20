import { asbError } from '@project/common/util/log';
import type { VideoDataSubtitleTrackDef } from '@project/common';
import { inferTracks } from '@/pages/util';
import {
    cleanNpoVtt,
    npoBasename,
    npoCdnSubtitleUrl,
    npoEpisodeSlug,
    npoPomsSubtitleUrl,
    npoProgramDetailUrl,
    npoStreamLinkSubtitles,
} from '@/pages/npo';

export default defineUnlistedScript(() => {
    // Subtitle lists seen in the player's stream-link responses, by productId.
    const streamSubtitles = new Map<string, VideoDataSubtitleTrackDef[]>();
    const observe = (value: unknown) => {
        const found = npoStreamLinkSubtitles(value);

        if (found !== undefined && found.tracks.length > 0) {
            streamSubtitles.set(found.productId, found.tracks);
        }
    };

    const originalParse = JSON.parse;
    JSON.parse = function (...args: unknown[]) {
        // @ts-expect-error: forwarding original parse arguments
        const value = originalParse.apply(this, args);
        observe(value);
        return value;
    };

    const originalResponseJson = Response.prototype.json;
    Response.prototype.json = async function (this: Response) {
        const value: unknown = await originalResponseJson.call(this);
        observe(value);
        return value;
    };

    // Fetches and cleans a subtitle file. Returns undefined when the file doesn't exist.
    const cleanedTrackUrl = async (url: string): Promise<string | undefined> => {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                return undefined;
            }

            return `data:text/vtt;charset=utf-8,${encodeURIComponent(cleanNpoVtt(await response.text()))}`;
        } catch (e) {
            asbError('npo-start', 'Failed to clean subtitles, falling back to raw url', url, e);
            return url;
        }
    };

    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            const slug = npoEpisodeSlug(window.location.pathname);

            if (slug === undefined) {
                return;
            }

            try {
                const detail = await (await fetch(npoProgramDetailUrl(slug))).json();
                setBasename(npoBasename(detail) ?? slug);
                const productId = detail?.productId;

                if (typeof productId !== 'string') {
                    return;
                }

                const candidates = streamSubtitles.get(productId) ?? [
                    { label: 'Nederlands', language: 'nl', url: npoCdnSubtitleUrl(productId), extension: 'vtt' },
                ];
                let added = 0;

                for (const candidate of candidates) {
                    const url = typeof candidate.url === 'string' ? await cleanedTrackUrl(candidate.url) : undefined;

                    if (url !== undefined) {
                        addTrack({ ...candidate, url });
                        ++added;
                    }
                }

                if (added === 0) {
                    const url = await cleanedTrackUrl(npoPomsSubtitleUrl(productId));

                    if (url !== undefined) {
                        addTrack({ label: 'Nederlands', language: 'nl', url, extension: 'vtt' });
                    }
                }
            } catch (e) {
                asbError('npo-start', 'Failed to infer tracks for', slug, e);
            }
        },

        waitForBasename: true,
    });
});
