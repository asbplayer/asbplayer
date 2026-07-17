import { VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';

export function extractExtension(url: string, fallback: string) {
    const path = url.split(/[?#]/)[0];
    const dotIndex = path.lastIndexOf('.');
    return dotIndex === -1 ? fallback : path.substring(dotIndex + 1);
}

export async function poll(test: () => boolean, timeout: number = 10000): Promise<boolean> {
    if (test()) {
        return true;
    }

    const t0 = Date.now();
    let passed = false;

    while (!passed && Date.now() < t0 + timeout) {
        await new Promise<void>((loopResolve) => {
            setTimeout(() => {
                passed = test();
                loopResolve();
            }, 1000);
        });
    }

    return passed;
}

type SubtitlesByKey = { [key: string]: VideoDataSubtitleTrack[] };

export interface InferHooks {
    onJson?: (
        value: any,
        addTrack: (track: VideoDataSubtitleTrackDef) => void,
        setBasename: (basename: string) => void
    ) => void;
    onRequest?: (
        addTrack: (track: VideoDataSubtitleTrackDef) => void,
        setBasename: (basename: string) => void
    ) => Promise<void>;
    observeResponseJson?: boolean;
    getCacheKey?: () => string;
    waitForBasename: boolean;
}

export const trackFromDef = (def: VideoDataSubtitleTrackDef) => {
    return { id: trackId(def), ...def };
};

export const trackId = (def: VideoDataSubtitleTrackDef) => {
    return `${def.language}:${def.label}:${def.url}`;
};

export function inferTracks(
    { onJson, onRequest, observeResponseJson = false, getCacheKey, waitForBasename }: InferHooks,
    timeout?: number
) {
    setTimeout(() => {
        const subtitlesByKey: SubtitlesByKey = {};
        const basenameByKey: { [key: string]: string } = {};
        let trackDataRequestHandled = false;
        const currentCacheKey = () => getCacheKey?.() ?? window.location.pathname;

        if (onJson !== undefined) {
            const handleJson = (value: unknown) => {
                let tracksFound = false;
                let basenameFound = false;

                onJson(
                    value,
                    (track) => {
                        const key = currentCacheKey();

                        if (typeof subtitlesByKey[key] === 'undefined') {
                            subtitlesByKey[key] = [];
                        }

                        const newId = trackId(track);

                        if (subtitlesByKey[key].find((s) => s.id === newId) === undefined) {
                            subtitlesByKey[key].push({ id: newId, ...track });
                            tracksFound = true;
                        }
                    },
                    (theBasename) => {
                        basenameByKey[currentCacheKey()] = theBasename;
                        basenameFound = true;
                    }
                );

                if (trackDataRequestHandled && (tracksFound || basenameFound)) {
                    // Only notify additional tracks after the initial request for track info
                    const key = currentCacheKey();
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: {
                                error: '',
                                basename: basenameByKey[key] ?? '',
                                subtitles: subtitlesByKey[key],
                            },
                        })
                    );
                }
            };

            const originalParse = JSON.parse;

            JSON.parse = function (...args: unknown[]) {
                // @ts-expect-error: forwarding original parse arguments
                const value = originalParse.apply(this, args);
                handleJson(value);

                return value;
            };

            if (observeResponseJson && typeof Response !== 'undefined') {
                const originalResponseJson = Response.prototype.json;

                Response.prototype.json = async function (this: Response) {
                    const value: unknown = await originalResponseJson.call(this);
                    handleJson(value);
                    return value;
                };
            }
        }

        function garbageCollect() {
            const currentKey = currentCacheKey();
            for (const key of Object.keys(subtitlesByKey)) {
                if (key !== currentKey) {
                    delete subtitlesByKey[key];
                }
            }
            for (const key of Object.keys(basenameByKey)) {
                if (key !== currentKey) {
                    delete basenameByKey[key];
                }
            }
        }

        document.addEventListener(
            'asbplayer-get-synced-data',
            () => {
                void (async () => {
                    // Pin the cache key at request-start time so async onRequest callbacks
                    // resolving after a soft-navigation still file their data correctly.
                    const requestKey = currentCacheKey();

                    if (onRequest !== undefined) {
                        void onRequest(
                            (track) => {
                                if (typeof subtitlesByKey[requestKey] === 'undefined') {
                                    subtitlesByKey[requestKey] = [];
                                }

                                const newId = trackId(track);

                                if (subtitlesByKey[requestKey].find((s) => s.id === newId) === undefined) {
                                    subtitlesByKey[requestKey].push({ id: newId, ...track });
                                }
                            },
                            (theBasename) => {
                                basenameByKey[requestKey] = theBasename;
                                if (!trackDataRequestHandled && requestKey === currentCacheKey()) {
                                    // Notify basename even if still waiting for subtitle track info
                                    document.dispatchEvent(
                                        new CustomEvent('asbplayer-synced-data', {
                                            detail: {
                                                error: '',
                                                basename: theBasename,
                                                subtitles: undefined,
                                            },
                                        })
                                    );
                                }
                            }
                        ).catch(console.error);
                    }

                    const ready = () => {
                        const key = currentCacheKey();
                        return (!waitForBasename || (basenameByKey[key] ?? '') !== '') && key in subtitlesByKey;
                    };

                    if (!ready()) {
                        await poll(ready, timeout);
                    }

                    const currentKey = currentCacheKey();
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: {
                                error: '',
                                basename: basenameByKey[currentKey] ?? '',
                                subtitles: subtitlesByKey[currentKey] ?? [],
                            },
                        })
                    );

                    garbageCollect();
                    trackDataRequestHandled = true;
                })().catch(console.error);
            },
            false
        );
    }, 0);
}
