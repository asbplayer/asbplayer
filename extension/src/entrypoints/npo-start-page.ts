import { asbError } from '@project/common/util/log';
import type { VideoDataSubtitleTrack } from '@project/common';
import { trackFromDef } from '@/pages/util';
import {
    isNpoStreamLinkUrl,
    npoBasename,
    npoEpisodeSlug,
    npoProgramDetailUrl,
    npoStreamLinkSubtitles,
    npoTracks,
    npoVttDataUrl,
} from '@/pages/npo';
import type { NpoTrack } from '@/pages/npo';

const maxCacheEntries = 20;
const streamLinkWaitMs = 2000;

const remember = <K, V>(map: Map<K, V>, key: K, value: V) => {
    map.delete(key);
    map.set(key, value);

    while (map.size > maxCacheEntries) {
        map.delete(map.keys().next().value as K);
    }
};

export default defineUnlistedScript(() => {
    // Subtitle lists from the player's stream-link responses, by productId. The latest response wins, including
    // an empty list.
    const streamSubtitles = new Map<string, NpoTrack[]>();
    // Cleaned subtitle data URLs by source URL, so repeated picker opens reuse the same content and track ids.
    const cleanedSubtitles = new Map<string, Promise<string | undefined>>();

    // The player keeps its own reference to fetch from before this script runs, then reads the stream-link
    // response with Response.json(). Observe that call for stream-link responses only, and hand the page back the
    // very same promise so its behaviour can't change.
    const originalFetch = window.fetch.bind(window);
    const originalResponseJson = Response.prototype.json;
    Response.prototype.json = function (this: Response) {
        const value = originalResponseJson.call(this);

        try {
            if (isNpoStreamLinkUrl(this.url)) {
                value
                    .then((json: unknown) => {
                        const found = npoStreamLinkSubtitles(json);

                        if (found !== undefined) {
                            remember(streamSubtitles, found.productId, found.tracks);
                        }
                    })
                    .catch(() => {});
            }
        } catch {
            // Never interfere with the page's own request.
        }

        return value;
    };

    const loadSubtitle = (url: string): Promise<string | undefined> => {
        const cached = cleanedSubtitles.get(url);

        if (cached !== undefined) {
            return cached;
        }

        const promise = (async () => {
            const response = await originalFetch(url);
            return response.ok ? npoVttDataUrl(await response.text()) : undefined;
        })();
        remember(cleanedSubtitles, url, promise);
        // Don't cache network failures.
        promise.catch(() => cleanedSubtitles.delete(url));
        return promise;
    };

    const waitForStreamLink = async (productId: string) => {
        const t0 = Date.now();

        while (!streamSubtitles.has(productId) && Date.now() - t0 < streamLinkWaitMs) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    };

    const resolve = async (pathname: string): Promise<{ basename: string; subtitles: VideoDataSubtitleTrack[] }> => {
        const slug = npoEpisodeSlug(pathname);

        if (slug === undefined) {
            return { basename: '', subtitles: [] };
        }

        const detail = await (await originalFetch(npoProgramDetailUrl(slug))).json();
        const basename = npoBasename(detail) ?? slug;
        const productId = detail?.productId;

        if (typeof productId !== 'string') {
            return { basename, subtitles: [] };
        }

        await waitForStreamLink(productId);
        const tracks = await npoTracks(productId, streamSubtitles.get(productId), loadSubtitle);
        return {
            basename,
            subtitles: tracks.map((track) => trackFromDef({ ...track, extension: 'vtt' })),
        };
    };

    const dispatch = (detail: { error: string; basename?: string; subtitles?: VideoDataSubtitleTrack[] }) =>
        document.dispatchEvent(new CustomEvent('asbplayer-synced-data', { detail }));

    document.addEventListener(
        'asbplayer-get-synced-data',
        () => {
            void (async () => {
                // Answer with one complete track list. If the page navigated to another episode while resolving,
                // resolve again for the episode now showing.
                let pathname = window.location.pathname;
                let result = await resolve(pathname);

                for (let attempt = 0; attempt < 2 && pathname !== window.location.pathname; ++attempt) {
                    pathname = window.location.pathname;
                    result = await resolve(pathname);
                }

                dispatch({ error: '', ...result });
            })().catch((error) => {
                asbError('npo-start', 'Failed to resolve subtitles', error);
                dispatch({ error: error instanceof Error ? error.message : String(error) });
            });
        },
        false
    );
});
