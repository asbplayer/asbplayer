import { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { poll, trackFromDef } from '@/pages/util';

declare const netflix: any | undefined;

export default defineUnlistedScript(() => {
    setTimeout(() => {
        function getAPI() {
            if (typeof netflix === 'undefined') {
                return undefined;
            }

            return netflix?.appContext?.state?.playerApp?.getAPI?.();
        }

        function getVideoPlayer() {
            return getAPI()?.videoPlayer;
        }

        function player() {
            const netflixVideo = getVideoPlayer();

            if (netflixVideo) {
                const playerSessionIds = netflixVideo.getAllPlayerSessionIds?.() || [];

                if (0 === playerSessionIds.length) {
                    console.error('No Netflix player session IDs');
                    return undefined;
                }

                const playerSessionId = playerSessionIds[playerSessionIds.length - 1];
                return netflixVideo.getVideoPlayerBySessionId?.(playerSessionId);
            }

            console.error('Missing netflix global');
            return undefined;
        }

        // Reads subtitle download URLs from the most recent player session (the last id
        // from getAllPlayerSessionIds). Walks that session state and matches objects by
        // structure (type === 'timedtext' with a urls array), which avoids depending on the
        // minified property paths inside the player object that may change between releases.
        function timedTextUrls(): Map<string, string> {
            const urls = new Map<string, string>();
            const sessionIds = getVideoPlayer()?.getAllPlayerSessionIds?.() || [];

            if (sessionIds.length === 0) {
                return urls;
            }

            const activeSessionId = sessionIds[sessionIds.length - 1];
            const root =
                netflix?.appContext?.state?.playerApp?.getState?.()?.videoPlayer?.cadmiumPlayerRepository
                    ?.playersById?.[activeSessionId];

            if (!root) {
                return urls;
            }

            const seen = new WeakSet<object>();
            const stack: { node: any; depth: number }[] = [{ node: root, depth: 0 }];

            // Timedtext objects sit about 12 levels below the session root, so the depth
            // 20 cap below leaves margin without walking unrelated deep state.
            while (stack.length > 0) {
                const { node, depth } = stack.pop()!;

                if (node === null || typeof node !== 'object' || depth > 20 || seen.has(node)) {
                    continue;
                }

                seen.add(node);

                if (node instanceof ArrayBuffer || ArrayBuffer.isView(node)) {
                    continue;
                }

                try {
                    if (
                        node.type === 'timedtext' &&
                        typeof node.trackId === 'string' &&
                        Array.isArray(node.urls) &&
                        node.urls.length > 0 &&
                        typeof node.urls[0]?.url === 'string' &&
                        !urls.has(node.trackId)
                    ) {
                        urls.set(node.trackId, node.urls[0].url);
                    }
                } catch (e) {
                    // Ignore properties that throw on access
                }

                if (Array.isArray(node)) {
                    for (const value of node) {
                        if (value !== null && typeof value === 'object') {
                            stack.push({ node: value, depth: depth + 1 });
                        }
                    }
                } else {
                    for (const key of Object.keys(node)) {
                        let value;

                        try {
                            value = node[key];
                        } catch (e) {
                            continue;
                        }

                        if (value !== null && typeof value === 'object') {
                            stack.push({ node: value, depth: depth + 1 });
                        }
                    }
                }
            }

            return urls;
        }

        document.addEventListener('asbplayer-netflix-seek', (e) => {
            player()?.seek((e as CustomEvent).detail);
        });

        document.addEventListener('asbplayer-netflix-play', () => {
            player()?.play();
        });

        document.addEventListener('asbplayer-netflix-pause', () => {
            player()?.pause();
        });

        function determineBasename(titleId: string): [string, boolean] {
            const videoApi = getAPI()?.getVideoMetadataByVideoId?.(titleId)?.getCurrentVideo?.();
            const actualTitle = videoApi?.getTitle?.();

            if (typeof actualTitle !== 'string') {
                return [`${titleId}`, true];
            }

            let basename = actualTitle;

            if (videoApi?.isEpisodic?.() === true) {
                const season = `${videoApi?.getSeason()?._season?.seq}`.padStart(2, '0');
                const ep = `${videoApi?.getEpisodeNumber?.()}`.padStart(2, '0');
                const epTitle = videoApi?.getEpisodeTitle?.();
                basename += ` S${season}E${ep} ${epTitle}`;
            }

            return [basename, false];
        }

        async function determineBasenameWithRetries(titleId: string, retries: number): Promise<string> {
            if (retries <= 0) {
                return `${titleId}`;
            }

            const [basename, shouldRetry] = determineBasename(titleId);

            if (shouldRetry) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                return await determineBasenameWithRetries(titleId, --retries);
            }

            return basename;
        }

        const dataForTrack = (track: any, urlsByTrackId?: Map<string, string>): VideoDataSubtitleTrack | undefined => {
            // Skip the "Off" track, forced-narrative tracks, and image-based (bitmap)
            // subtitles, which can't be parsed as text.
            if (!track.bcp47 || track.isNoneTrack || track.isForcedNarrative || track.isImageBased) {
                return undefined;
            }

            const isClosedCaptions = 'CLOSEDCAPTIONS' === track.rawTrackType;
            const language = isClosedCaptions ? `${track.bcp47.toLowerCase()}-CC` : track.bcp47.toLowerCase();
            const label = `${track.bcp47} - ${track.displayName}${isClosedCaptions ? ' [CC]' : ''}`;

            return trackFromDef({
                label,
                language,
                // 'lazy' is a sentinel value indicating to the content script that it should
                // make a lazy language-specific request to get the URL
                url: urlsByTrackId?.get(track.trackId) ?? 'lazy',
                // Netflix subtitle downloads on this path are IMSC 1.1 (TTML)
                extension: 'nfimsc',
            });
        };

        const buildResponse = async () => {
            const response: VideoData = { error: '', basename: '', subtitles: [] };
            const np = player();
            const titleId = np?.getMovieId();

            if (!np || !titleId) {
                response.error = 'Netflix Player or Title Id not found...';
                return response;
            }

            response.basename = await determineBasenameWithRetries(titleId, 5);
            const urlsByTrackId = timedTextUrls();
            response.subtitles = (np.getTimedTextTrackList() ?? [])
                .map((track: any) => dataForTrack(track, urlsByTrackId))
                .filter((data: VideoDataSubtitleTrack | undefined) => data !== undefined);
            return response;
        };

        document.addEventListener(
            'asbplayer-get-synced-data',
            async () => {
                const response: VideoData = await buildResponse();

                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: response,
                    })
                );
            },
            false
        );

        const fetchDataForLanguage = async (e: Event) => {
            const fail = (message?: string) => {
                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-language-data', {
                        detail: {
                            error: message ?? 'Failed to fetch subtitles for requested language',
                            basename: '',
                            subtitles: [],
                        },
                    })
                );
            };

            const np = player();

            if (np === undefined) {
                fail();
                return;
            }

            const previousTrack = np.getTimedTextTrack();
            let shouldRevert = false;

            try {
                const event = e as CustomEvent;
                const language = event.detail as string;
                const track = np
                    .getTimedTextTrackList()
                    ?.find((track: any) => dataForTrack(track)?.language === language);

                if (track === undefined) {
                    fail();
                    return;
                }

                if (timedTextUrls().has(track.trackId)) {
                    // URL is already present in player state (e.g. from a previous request)
                    // so send the response now and early-out
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-language-data', {
                            detail: await buildResponse(),
                        })
                    );
                    return;
                }

                // This track has no URL yet. Temporarily set it as the active text track to
                // make Netflix fetch one.
                await np.setTimedTextTrack(track);
                shouldRevert = true;

                // Wait for the URL to appear in player state
                const succeeded = await poll(() => timedTextUrls().has(track.trackId));

                if (!succeeded) {
                    fail();
                    return;
                }

                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-language-data', {
                        detail: await buildResponse(),
                    })
                );
            } catch (e) {
                fail(e instanceof Error ? e.message : String(e));
            } finally {
                if (shouldRevert && previousTrack !== undefined) {
                    await np.setTimedTextTrack(previousTrack);
                }
            }
        };

        let currentFetchForLanguagePromise: Promise<void> | undefined;

        document.addEventListener(
            'asbplayer-get-synced-language-data',
            // Fetch data for specific language, since Netflix does not provide all URLs in the initial data sync
            async (e) => {
                if (currentFetchForLanguagePromise === undefined) {
                    currentFetchForLanguagePromise = fetchDataForLanguage(e);
                } else {
                    currentFetchForLanguagePromise.then(() => fetchDataForLanguage(e));
                }

                await currentFetchForLanguagePromise;
                currentFetchForLanguagePromise = undefined;
            },
            false
        );

        Function.prototype.apply = new Proxy(Function.prototype.apply, {
            apply: function (target, originalThis, args) {
                if (args && args[1] && typeof args[1][0] === 'string') {
                    const property = args[1][0];

                    if (
                        property === 'preciseSeeking' ||
                        property === 'preciseseeking' ||
                        property === 'preciseseekingontwocoredevice'
                    ) {
                        return true;
                    }
                }

                // @ts-ignore
                return target.call(originalThis, ...args);
            },
        });

        document.addEventListener('asbplayer-query-netflix', async () => {
            const apiAvailable = await poll(() => getVideoPlayer() !== undefined, 30000);
            document.dispatchEvent(
                new CustomEvent('asbplayer-netflix-enabled', {
                    detail: apiAvailable,
                })
            );
        });
    }, 0);
});
