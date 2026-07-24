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
    const timeEventName = 'asbplayer-disney-plus-time';
    const seekStartedEventName = 'asbplayer-disney-plus-seek-started';
    const seekedEventName = 'asbplayer-disney-plus-seeked';
    const seekCancelledEventName = 'asbplayer-disney-plus-seek-cancelled';

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

    const contentTime = (player: any): number | undefined => {
        const ms = player?.timeline?.info?.playheadPositionMs;
        return typeof ms === 'number' && isFinite(ms) ? ms : undefined;
    };

    let cachedPlayer: any;
    let advancing = false;
    let advancingBeforeSeek = false;
    let pendingSeekRequest: { requestId: string; timestampMs: number } | undefined;

    const dispatchTimeEvent = (player: any, eventAdvancing?: boolean) => {
        const timestampMs = contentTime(player);
        if (timestampMs === undefined) return;
        document.dispatchEvent(
            new CustomEvent(timeEventName, {
                detail: { timestampMs, advancing: eventAdvancing },
            })
        );
    };

    const disneyPlusPlayer = (): any => {
        if (isDisneyPlusPlayer(cachedPlayer)) return cachedPlayer;

        cachedPlayer = findDisneyPlusPlayer();
        cachedPlayer?.on('@EVENT/PLAYER/PLAYBACK/MEDIA_SEEK_COMPLETE', () => {
            const timestampMs = contentTime(cachedPlayer);
            if (timestampMs === undefined) return;
            dispatchTimeEvent(cachedPlayer, advancingBeforeSeek);
            document.dispatchEvent(
                new CustomEvent(seekedEventName, {
                    detail: { timestampMs, requestId: pendingSeekRequest?.requestId },
                })
            );
            pendingSeekRequest = undefined;
        });
        cachedPlayer?.on('@EVENT/PLAYER/TIMECODE', () => {
            dispatchTimeEvent(cachedPlayer, advancing);
        });
        cachedPlayer?.on('@EVENT/PLAYER/PLAYBACK/MEDIA_PAUSED', () => {
            advancing = false;
            dispatchTimeEvent(cachedPlayer, false);
        });
        cachedPlayer?.on('@EVENT/PLAYER/PLAYBACK/MEDIA_SEEKING', () => {
            advancingBeforeSeek = advancing;
            dispatchTimeEvent(cachedPlayer, false);
            document.dispatchEvent(
                new CustomEvent(seekStartedEventName, {
                    detail: { timestampMs: contentTime(cachedPlayer) ?? 0, requestId: pendingSeekRequest?.requestId },
                })
            );
        });
        cachedPlayer?.on('@EVENT/PLAYER/PLAYBACK/MEDIA_RESUMED', () => {
            advancing = true;
            dispatchTimeEvent(cachedPlayer, true);
        });
        cachedPlayer?.on('@EVENT/PLAYER/PLAYBACK/MEDIA_STARTED', () => {
            advancing = true;
            dispatchTimeEvent(cachedPlayer, true);
        });
        dispatchTimeEvent(cachedPlayer, advancing);
        return cachedPlayer;
    };

    document.addEventListener(seekEventName, (e) => {
        // detail is absolute content time in milliseconds
        const detail = (e as CustomEvent<{ requestId: string; timestampMs: number }>).detail;
        const player = disneyPlusPlayer();
        if (!player || !Number.isFinite(detail?.timestampMs)) {
            if (detail?.requestId !== undefined) {
                document.dispatchEvent(new CustomEvent(seekCancelledEventName, { detail: detail.requestId }));
            }
            return;
        }
        if (pendingSeekRequest !== undefined) {
            document.dispatchEvent(new CustomEvent(seekCancelledEventName, { detail: pendingSeekRequest.requestId }));
        }
        pendingSeekRequest = { requestId: detail.requestId, timestampMs: detail.timestampMs };
        try {
            void Promise.resolve(player.seek(detail.timestampMs)).catch(() => {
                document.dispatchEvent(new CustomEvent(seekCancelledEventName, { detail: detail.requestId }));
                if (pendingSeekRequest?.requestId === detail.requestId) pendingSeekRequest = undefined;
            });
        } catch {
            document.dispatchEvent(new CustomEvent(seekCancelledEventName, { detail: detail.requestId }));
            pendingSeekRequest = undefined;
        }
    });
    document.addEventListener(seekCancelledEventName, (e) => {
        const requestId = (e as CustomEvent<string>).detail;
        if (pendingSeekRequest?.requestId === requestId) pendingSeekRequest = undefined;
    });
    document.addEventListener(playEventName, () => disneyPlusPlayer()?.play());
    document.addEventListener(pauseEventName, () => disneyPlusPlayer()?.pause());

    setTimeout(() => {
        let lastM3U8Url: string | undefined = undefined;
        let lastBasename: string | undefined = undefined;
        const originalParse = JSON.parse;
        JSON.parse = function (...args: unknown[]) {
            // @ts-expect-error: forwarding original parse arguments
            const value = originalParse.apply(this, args);
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
            return value;
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
    }, 0);
});
