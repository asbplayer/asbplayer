import { VideoDataSubtitleTrack } from '@project/common';
import { extractExtension, trackFromDef } from '@/pages/util';

export default defineUnlistedScript(() => {
    setTimeout(() => {
        function isObject(val: any) {
            return typeof val === 'object' && !Array.isArray(val) && val !== null;
        }

        function extractSubtitleTracks(value: any) {
            const subtitles = [];
            if (isObject(value.transcripts_urls?.webvtt)) {
                const urls = value.transcripts_urls.webvtt;

                for (const language of Object.keys(urls)) {
                    const url = urls[language];

                    if (typeof url === 'string') {
                        if (subtitles.find((s) => s.label === s.language) === undefined) {
                            subtitles.push(
                                trackFromDef({
                                    label: language,
                                    language: language.toLowerCase(),
                                    url: url,
                                    extension: extractExtension(url, 'vtt'),
                                })
                            );
                        }
                    }
                }
            }

            return subtitles;
        }

        let playlistController: AbortController | undefined;

        function fetchPlaylistAndExtractSubtitles(payload: any): Promise<VideoDataSubtitleTrack[]> {
            playlistController?.abort();
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    playlistController?.abort();
                    playlistController = new AbortController();
                    fetch('https://play.hulu.com/v6/playlist', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'content-type': 'application/json' },
                        body: payload,
                        signal: playlistController.signal,
                    })
                        .then((response) => response.json())
                        .then((json) => resolve(extractSubtitleTracks(json)))
                        .catch(reject);
                }, 0);
            });
        }

        function extractBasename(payload: any) {
            if (payload?.items instanceof Array && payload.items.length > 0) {
                const item = payload.items[0];
                if (item.series_name && item.season_short_display_name && item.number && item.name) {
                    return `${item.series_name}.${item.season_short_display_name}.E${item.number} - ${item.name}`;
                }

                return item.name ?? '';
            }

            return '';
        }

        let upnextController: AbortController | undefined;

        function fetchUpNextAndExtractBasename(eabId: string): Promise<string> {
            upnextController?.abort();
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    upnextController?.abort();
                    upnextController = new AbortController();
                    fetch(
                        `https://discover.hulu.com/content/v3/browse/upnext?current_eab=${encodeURIComponent(
                            eabId
                        )}&referral_host=www.hulu.com&schema=4`,
                        { signal: upnextController.signal }
                    )
                        .then((response) => response.json())
                        .then((json) => resolve(extractBasename(json)))
                        .catch(reject);
                }, 0);
            });
        }

        let subtitlesPromise: Promise<VideoDataSubtitleTrack[]> | undefined;
        let basenamePromise: Promise<string> | undefined;

        const originalStringify = JSON.stringify;
        JSON.stringify = function (value) {
            // @ts-ignore
            const stringified = originalStringify.apply(this, arguments);
            if (
                typeof value?.content_eab_id === 'string' &&
                typeof value?.playback === 'object' &&
                value?.playback !== null
            ) {
                subtitlesPromise = fetchPlaylistAndExtractSubtitles(stringified);
                basenamePromise = fetchUpNextAndExtractBasename(value.content_eab_id);
            }

            return stringified;
        };

        document.addEventListener(
            'asbplayer-get-synced-data',
            async () => {
                let basename = '';
                let subtitles: VideoDataSubtitleTrack[] = [];
                let error = '';

                try {
                    if (basenamePromise !== undefined) {
                        basename = await basenamePromise;
                        basenamePromise = undefined;
                    }

                    if (subtitlesPromise !== undefined) {
                        subtitles = await subtitlesPromise;
                        subtitlesPromise = undefined;
                    }
                } catch (e) {
                    if (e instanceof Error) {
                        error = e.message;
                    } else {
                        error = String(e);
                    }
                }

                const response = {
                    error: error,
                    basename: basename,
                    subtitles: subtitles,
                };

                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: response,
                    })
                );
            },
            false
        );
    }, 0);
});
