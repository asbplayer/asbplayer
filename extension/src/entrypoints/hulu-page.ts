import { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { extractExtension, poll, trackFromDef } from '@/pages/util';

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

        const legacyDetectorResponse: () => Promise<VideoData> = async () => {
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

            return {
                error: error,
                basename: basename,
                subtitles: subtitles,
            };
        };

        // Below is the subtitle detection for the hulu.jp as of 2026-5-10. It's implemented as a pure addition
        // to the code above, so as not to avoid breaking anything that may still be working.

        const extractExtensionFromMimeType = (val: any) => {
            if (typeof val !== 'string') {
                return undefined;
            }
            // For subtitle files the last part of the mime type should usually be the extension
            // e.g. text/vtt maps to vtt
            const parts = val.split('/');
            return parts[parts.length - 1];
        };

        const dataByVideoId: Map<string, VideoData> = new Map();
        let lastVideoId: string | undefined;

        const tryExtractMetadata = async (value: any) => {
            try {
                if (typeof value?.ref_id !== 'string' || !(value?.tracks instanceof Array)) {
                    return;
                }
                const videoDataSubtitleTracks: VideoDataSubtitleTrack[] = [];
                const videoId = value.ref_id;

                for (const track of value.tracks) {
                    if (typeof track !== 'object') {
                        continue;
                    }

                    if (
                        track.kind === 'subtitles' &&
                        typeof track.src === 'string' &&
                        typeof track.srclang === 'string'
                    ) {
                        const inferredExtensionFromMimeType = extractExtensionFromMimeType(track.type) || 'vtt';
                        videoDataSubtitleTracks.push(
                            trackFromDef({
                                label: track.label || track.srclang || track.src,
                                url: track.src,
                                language: track.srclang,
                                extension: extractExtension(track.src, inferredExtensionFromMimeType),
                            })
                        );
                    }
                }

                const videoName = new RegExp(`(${videoId}:){0,1}(.+)`).exec(value.name)?.[2];
                if (videoDataSubtitleTracks.length > 0) {
                    dataByVideoId.set(videoId, {
                        basename: videoName || document.title,
                        subtitles: videoDataSubtitleTracks,
                    });
                }

                lastVideoId = value?.ref_id;
            } catch (e) {
                // ignore
            }
        };

        const originalXhrSend = window.XMLHttpRequest.prototype.send;
        window.XMLHttpRequest.prototype.send = function () {
            this.addEventListener('load', function () {
                tryExtractMetadata(this.response);
            });

            // @ts-ignore
            originalXhrSend.apply(this, arguments);
        };

        const videoIdFromUrl = () => {
            return /watch\/(.+)(\/){0,1}/.exec(new URL(window.location.href).pathname)?.[1];
        };

        const newDetectorResponse: () => Promise<VideoData | undefined> = async () => {
            let response: VideoData | undefined;

            const pollPromise = poll(() => {
                const videoId = videoIdFromUrl() ?? lastVideoId;
                if (!videoId) {
                    return false;
                }
                response = dataByVideoId.get(videoId);
                if (response === undefined) {
                    return false;
                }
                return true;
            });

            await pollPromise;
            return response;
        };

        document.addEventListener(
            'asbplayer-get-synced-data',
            async () => {
                let responded = false;
                const newResponsePromise = newDetectorResponse().then((response) => {
                    if (response === undefined || responded) {
                        return;
                    }
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: response,
                        })
                    );
                    responded = true;
                });
                const legacyResponsePromise = legacyDetectorResponse().then((response) => {
                    if (responded) {
                        return;
                    }
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: response,
                        })
                    );
                });
                await Promise.all([newResponsePromise, legacyResponsePromise]);
            },
            false
        );
    }, 0);
});
