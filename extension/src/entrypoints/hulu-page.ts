import { VideoDataSubtitleTrackDef } from '@project/common';
import { extractExtension, inferTracks, poll } from '@/pages/util';

export default defineUnlistedScript(() => {
    const tracksByEntityId = new Map<string, VideoDataSubtitleTrackDef[]>();

    function entityIdFromEabId(eabId: unknown): string | undefined {
        if (typeof eabId !== 'string') {
            return undefined;
        }
        const m = eabId.match(/^EAB::([0-9a-fA-F-]+)/);
        return m ? m[1] : undefined;
    }

    function entityIdFromPathname(pathname: string): string | undefined {
        const m = pathname.match(/^\/watch\/([0-9a-fA-F-]+)/);
        return m ? m[1] : undefined;
    }

    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        // @ts-ignore
        const promise = originalFetch.apply(this, args);
        const input = args[0];
        const url =
            typeof input === 'string'
                ? input
                : input instanceof Request
                  ? input.url
                  : input instanceof URL
                    ? input.href
                    : '';
        if (url.includes('play.hulu.com/v6/playlist')) {
            promise
                .then((response) => response.clone().json())
                .then((json) => {
                    // Key by entityId from the response itself. Hulu sometimes fires
                    // the next video's playlist before updating window.location, so
                    // the URL is not a reliable identifier at fetch time.
                    const entityId = entityIdFromEabId(json?.content_eab_id);
                    if (!entityId) {
                        return;
                    }
                    const urls = json?.transcripts_urls?.webvtt;
                    const tracks: VideoDataSubtitleTrackDef[] = [];
                    if (urls && typeof urls === 'object' && !Array.isArray(urls)) {
                        for (const language of Object.keys(urls)) {
                            const u = urls[language];
                            if (typeof u === 'string') {
                                tracks.push({
                                    label: language,
                                    language: language.toLowerCase(),
                                    url: u,
                                    extension: extractExtension(u, 'vtt'),
                                });
                            }
                        }
                    }
                    tracksByEntityId.set(entityId, tracks);
                })
                .catch(() => {});
        }
        return promise;
    };

    function basenameFromDOM(): string | undefined {
        for (const pm of document.querySelectorAll('[data-testid="player-metadata"]')) {
            const text = (pm.textContent || '').trim();
            if (text.startsWith('UP NEXT')) {
                continue;
            }

            const series = pm.querySelector('span')?.textContent?.trim();
            if (!series) {
                continue;
            }

            const divs = Array.from(pm.querySelectorAll('div')).map((d) => (d.textContent || '').trim());
            const seasonEpIdx = divs.findIndex((t) => /^S\d+\s+E\d+$/.test(t));
            if (seasonEpIdx === -1) {
                return series;
            }

            const seasonEp = divs[seasonEpIdx].replace(/\s+/g, '.');
            const title = divs[seasonEpIdx + 2];
            if (!title || title === '•' || title === '-') {
                return `${series}.${seasonEp}`;
            }
            return `${series}.${seasonEp} - ${title}`;
        }
        return undefined;
    }

    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            const entityId = entityIdFromPathname(window.location.pathname);
            if (!entityId) {
                return;
            }

            // Wait for Hulu's own /v6/playlist response to be observed by the fetch wrapper.
            await poll(() => tracksByEntityId.has(entityId));
            const tracks = tracksByEntityId.get(entityId);
            if (!tracks) {
                return;
            }

            // Wait briefly for the DOM-driven basename to appear.
            let basename: string | undefined;
            await poll(() => {
                basename = basenameFromDOM();
                return basename !== undefined;
            }, 5000);

            // Bail if the user has soft-navigated to a different video since this request started.
            if (entityIdFromPathname(window.location.pathname) !== entityId) {
                return;
            }

            if (basename) {
                setBasename(basename);
            }
            for (const track of tracks) {
                addTrack(track);
            }
        },
        waitForBasename: false,
    });
});
