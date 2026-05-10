import { VideoData, VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';
import { extractExtension, poll, trackId } from '@/pages/util';

declare global {
    interface XMLHttpRequest {
        _vodPlaybackResourcesTitleId?: string;
    }
}
interface MetadataUrls {
    vodPlaybackResourcesUrl?: string;
    vodPlaybackResourceBody?: string;
    playerChromeResourcesUrl?: string;
}

export default defineUnlistedScript(() => {
    const metadataUrls: { [entityId: string]: MetadataUrls } = {};

    const urlParam = (url: string, param: string) => {
        const params = new URLSearchParams(new URL(url).search);
        return params.get(param);
    };

    let lastEntityId: string | undefined;

    // Returns the captured titleId if the URL is a VOD playback resources request. The
    // caller pairs the body with the same id when the request is actually sent.
    const captureRequestUrl = (url: string): string | undefined => {
        if (url.includes('GetVodPlaybackResources')) {
            const titleId = urlParam(url, 'titleId');

            if (titleId) {
                const urls = metadataUrls[titleId] ?? {};
                urls.vodPlaybackResourcesUrl = url;
                metadataUrls[titleId] = urls;
                lastEntityId = titleId;
                return titleId;
            }
        }

        if (url.includes('playerChromeResources') && url.includes('catalogMetadataV2')) {
            const entityId = urlParam(url, 'entityId');

            if (entityId) {
                const urls = metadataUrls[entityId] ?? {};
                urls.playerChromeResourcesUrl = url;
                metadataUrls[entityId] = urls;
                lastEntityId = entityId;
            }
        }

        return undefined;
    };

    const originalXhrOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function () {
        const url = arguments[1];

        if (typeof url === 'string') {
            const titleId = captureRequestUrl(url);

            if (titleId) {
                this._vodPlaybackResourcesTitleId = titleId;
            }
        }

        // @ts-ignore
        originalXhrOpen.apply(this, arguments);
    };

    const originalXhrSend = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.send = function () {
        if (this._vodPlaybackResourcesTitleId && typeof arguments[0] === 'string') {
            metadataUrls[this._vodPlaybackResourcesTitleId].vodPlaybackResourceBody = arguments[0];
        }

        // @ts-ignore
        originalXhrSend.apply(this, arguments);
    };

    // Prime's player issues these calls via fetch, so mirror the capture there too.
    const originalFetch = window.fetch;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
        try {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

            if (typeof url === 'string') {
                const titleId = captureRequestUrl(url);

                if (titleId) {
                    if (init && typeof init.body === 'string') {
                        metadataUrls[titleId].vodPlaybackResourceBody = init.body;
                    } else if (input instanceof Request) {
                        // Body lives on the Request object itself. Clone so the page's
                        // own consumption is unaffected.
                        input
                            .clone()
                            .text()
                            .then((body) => {
                                if (body) {
                                    metadataUrls[titleId].vodPlaybackResourceBody = body;
                                }
                            })
                            .catch(() => {
                                // Ignore so the page's fetch is not broken.
                            });
                    }
                }
            }
        } catch {
            // Never let our interceptor break the page's fetches.
        }

        // @ts-ignore
        return originalFetch.apply(this, arguments);
    };

    const basenameFromUrl = async (url: string) => {
        const catalog = (await (await fetch(url)).json())?.resources?.catalogMetadataV2?.catalog;

        if (!catalog) {
            return '';
        }

        const parts = [];

        if (typeof catalog.seriesTitle === 'string') {
            const seriesParts = [];
            seriesParts.push(catalog.seriesTitle);

            if (typeof catalog.seasonNumber === 'number') {
                seriesParts.push(`S${catalog.seasonNumber}`);
            }

            if (typeof catalog.episodeNumber === 'number') {
                seriesParts.push(`E${catalog.episodeNumber}`);
            }

            parts.push(seriesParts.join('.'));
        }

        if (typeof catalog.title === 'string') {
            parts.push(catalog.title);
        }

        return parts.join(' - ');
    };

    const tracksFromUrl = async (url: string, body: string) => {
        const response = await (
            await fetch(url, {
                method: 'POST',
                body,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            })
        ).json();

        // Treat stale-session error responses as a real error rather than letting
        // the picker show no tracks. Titles with no subtitles still pass through.
        if (!response?.timedTextUrls?.result) {
            throw new Error(
                'Could not detect subtitles. Try refreshing this page and starting playback. (stale playback session)'
            );
        }

        const tracks = response?.timedTextUrls?.result?.subtitleUrls;
        const subtitleTracks: VideoDataSubtitleTrack[] = [];

        if (tracks instanceof Array) {
            for (const track of tracks) {
                const def: VideoDataSubtitleTrackDef = {
                    label: track.displayName,
                    language: track.languageCode.toLowerCase(),
                    url: track.url,
                    extension: extractExtension(track.url, 'ttml2'),
                };

                subtitleTracks.push({
                    id: trackId(def),
                    ...def,
                });
            }
        }

        return subtitleTracks;
    };

    document.addEventListener(
        'asbplayer-get-synced-data',
        async () => {
            try {
                if (lastEntityId) {
                    const entityId = lastEntityId;
                    const capturedUrls = await poll(() => {
                        const urls = metadataUrls[entityId];
                        return Boolean(
                            urls &&
                                urls.playerChromeResourcesUrl &&
                                urls.vodPlaybackResourcesUrl &&
                                urls.vodPlaybackResourceBody
                        );
                    });

                    if (capturedUrls) {
                        const urls = metadataUrls[entityId];
                        const basename = await basenameFromUrl(urls.playerChromeResourcesUrl!);
                        const subtitles = await tracksFromUrl(
                            urls.vodPlaybackResourcesUrl!,
                            urls.vodPlaybackResourceBody!
                        );
                        const data: VideoData = { basename, subtitles };
                        document.dispatchEvent(
                            new CustomEvent('asbplayer-synced-data', {
                                detail: data,
                            })
                        );
                    } else {
                        document.dispatchEvent(
                            new CustomEvent('asbplayer-synced-data', {
                                detail: {
                                    error: 'Could not detect subtitles. Try refreshing this page and starting playback. (incomplete metadata)',
                                    basename: '',
                                    subtitles: [],
                                },
                            })
                        );
                    }
                } else {
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: {
                                error: 'Could not detect subtitles. Try refreshing this page and starting playback. (no video ID captured)',
                                basename: '',
                                subtitles: [],
                            },
                        })
                    );
                }
            } catch (e) {
                const error = e instanceof Error ? e.message : String(e);
                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: { error },
                    })
                );
            }
        },
        false
    );
});
