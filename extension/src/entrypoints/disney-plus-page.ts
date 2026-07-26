import { inferTracks } from '@/pages/util';
import { subtitleTrackSegmentsFromM3U8 } from '@/pages/m3u8-util';

export default defineUnlistedScript(() => {
    // --- Disney+ player API access (reverse-engineered) ---
    // The Disney+ web player attaches a media player object to the React fiber tree
    // above the <video> element. It exposes seek(ms)/play()/pause() and
    // timeline.info.playheadPositionMs (true content time in ms). On Disney+,
    // video.currentTime is per-MediaSource relative time and direct writes to it are
    // ignored by the player, so we drive the player API directly (Netflix-style).
    const seekEventName = 'asbplayer-disney-plus-seek';
    const playEventName = 'asbplayer-disney-plus-play';
    const pauseEventName = 'asbplayer-disney-plus-pause';
    const seekedEventName = 'asbplayer-disney-plus-seeked';

    const isDisneyPlusPlayer = (value: any) =>
        value &&
        typeof value === 'object' &&
        typeof value.seek === 'function' &&
        typeof value.scrub === 'function' &&
        typeof value.play === 'function' &&
        typeof value.pause === 'function';

    const playerFromObject = (value: any): any => {
        if (!value || typeof value !== 'object') {
            return undefined;
        }

        let keys: string[];

        try {
            keys = Object.keys(value);
        } catch {
            return undefined;
        }

        for (const key of keys.slice(0, 60)) {
            let candidate: any;

            try {
                candidate = value[key];
            } catch {
                continue;
            }

            if (isDisneyPlusPlayer(candidate)) {
                return candidate;
            }
        }

        return undefined;
    };

    const findDisneyPlusPlayer = (): any => {
        for (const video of document.querySelectorAll('video')) {
            let element: Element | null = video;
            let fiberKey: string | undefined;
            let host: any;

            while (element) {
                fiberKey = Object.keys(element).find(
                    (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
                );

                if (fiberKey) {
                    host = element;
                    break;
                }

                element = element.parentElement;
            }

            if (!fiberKey) {
                continue;
            }

            let fiber = host[fiberKey];
            let steps = 0;

            while (fiber && steps < 400) {
                steps++;
                let found = playerFromObject(fiber.memoizedProps);

                if (!found) {
                    let hook = fiber.memoizedState;
                    let hookSteps = 0;

                    while (hook && hookSteps < 20 && !found) {
                        found = playerFromObject(hook.memoizedState);
                        hook = hook.next;
                        hookSteps++;
                    }
                }

                if (!found && fiber.stateNode && typeof fiber.stateNode === 'object') {
                    found = playerFromObject(fiber.stateNode);
                }

                if (found) {
                    return found;
                }

                fiber = fiber.return;
            }
        }

        return undefined;
    };

    const dispatchSeekedEvent = (player: any) => {
        const ms = player?.timeline?.info?.playheadPositionMs;

        if (typeof ms === 'number' && isFinite(ms)) {
            document.dispatchEvent(new CustomEvent(seekedEventName, { detail: ms }));
        }
    };

    let cachedPlayer: any;
    const disneyPlusPlayer = (): any => {
        if (isDisneyPlusPlayer(cachedPlayer)) {
            return cachedPlayer;
        }

        cachedPlayer = findDisneyPlusPlayer();
        cachedPlayer?.on('@EVENT/PLAYER/PLAYBACK/MEDIA_SEEK_COMPLETE', () => {
            dispatchSeekedEvent(cachedPlayer);
        });
        cachedPlayer?.on('@EVENT/PLAYER/TIMECODE', () => {
            dispatchSeekedEvent(cachedPlayer);
        });
        cachedPlayer?.on('@EVENT/PLAYER/PLAYBACK/MEDIA_PAUSED', () => {
            dispatchSeekedEvent(cachedPlayer);
        });
        cachedPlayer?.on('@EVENT/PLAYER/PLAYBACK/MEDIA_SEEKING', () => {
            dispatchSeekedEvent(cachedPlayer);
        });
        cachedPlayer?.on('@EVENT/PLAYER/PLAYBACK/MEDIA_RESUMED', () => {
            dispatchSeekedEvent(cachedPlayer);
        });
        cachedPlayer?.on('@EVENT/PLAYER/PLAYBACK/MEDIA_STARTED', () => {
            dispatchSeekedEvent(cachedPlayer);
        });
        return cachedPlayer;
    };

    document.addEventListener(seekEventName, (e) => {
        // detail is absolute content time in milliseconds
        disneyPlusPlayer()?.seek((e as CustomEvent).detail);
    });
    document.addEventListener(playEventName, () => disneyPlusPlayer()?.play());
    document.addEventListener(pauseEventName, () => disneyPlusPlayer()?.pause());

    // Install the JSON.parse/Response.json hooks synchronously (not deferred behind a
    // setTimeout) since Disney+'s own bundle can fire and parse its playback manifest
    // request within the same tick the page script finishes loading. A deferred install
    // here was losing that race intermittently, leaving lastM3U8Url/lastBasename unset and
    // subtitle auto-detection silently failing.
    {
        let lastM3U8Url: string | undefined = undefined;
        let lastBasename: string | undefined = undefined;

        const processParsedValue = (value: any) => {
            if (value?.stream?.sources instanceof Array && value.stream.sources.length > 0) {
                const url = value.stream.sources[0].complete?.url;

                if (url) {
                    lastM3U8Url = url;
                }
            }

            if (value?.data?.playerExperience?.title) {
                lastBasename = value?.data?.playerExperience?.title;
                if (value?.data?.playerExperience?.subtitle) {
                    lastBasename += ` ${value?.data?.playerExperience?.subtitle}`;
                }
            }
        };

        const originalParse = JSON.parse;
        JSON.parse = function (...args: unknown[]) {
            // @ts-expect-error: forwarding original parse arguments
            const value = originalParse.apply(this, args);
            processParsedValue(value);
            return value;
        };

        // Response.prototype.json() is served by an internal parser that never calls the
        // patched JSON.parse above, so hook it directly too in case Disney+ fetches the
        // manifest that way in some region/experiment variant.
        const originalResponseJson = Response.prototype.json;
        Response.prototype.json = function (this: Response) {
            return originalResponseJson.call(this).then((value: any) => {
                processParsedValue(value);
                return value;
            });
        };

        inferTracks(
            {
                onRequest: async (addTrack, setBasename) => {
                    if (lastBasename !== undefined) {
                        setBasename(lastBasename);
                    }

                    if (lastM3U8Url !== undefined) {
                        const tracks = await subtitleTrackSegmentsFromM3U8(lastM3U8Url);

                        for (const track of tracks) {
                            addTrack(track);
                        }
                    }
                },
                waitForBasename: false,
            },
            60_000
        );
    }
});
