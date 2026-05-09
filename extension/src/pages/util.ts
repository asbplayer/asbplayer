import { VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';

export function extractExtension(url: string, fallback: string) {
    const path = url.split(/[?#]/)[0];
    const dotIndex = path.lastIndexOf('.');
    return dotIndex === -1 ? fallback : path.substring(dotIndex + 1);
}

export function poll(test: () => boolean, timeout: number = 10000): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
        if (test()) {
            resolve(true);
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

        resolve(passed);
    });
}

type SubtitlesByPath = { [key: string]: VideoDataSubtitleTrack[] };

export interface InferHooks {
    onJson?: (
        value: any,
        addTrack: (track: VideoDataSubtitleTrackDef) => void,
        setBasename: (basename: string) => void
    ) => void;
    onRequest?: (addTrack: (track: VideoDataSubtitleTrackDef) => void, setBasename: (basename: string) => void) => void;
    waitForBasename: boolean;
}

export const trackFromDef = (def: VideoDataSubtitleTrackDef) => {
    return { id: trackId(def), ...def };
};

export const trackId = (def: VideoDataSubtitleTrackDef) => {
    return `${def.language}:${def.label}:${def.url}`;
};

export function inferTracks({ onJson, onRequest, waitForBasename }: InferHooks, timeout?: number) {
    setTimeout(() => {
        const subtitlesByPath: SubtitlesByPath = {};
        let basename = '';
        let trackDataRequestHandled = false;

        if (onJson !== undefined) {
            const originalParse = JSON.parse;

            JSON.parse = function () {
                // @ts-ignore
                const value = originalParse.apply(this, arguments);
                let tracksFound = false;
                let basenameFound = false;

                onJson?.(
                    value,
                    (track) => {
                        const path = window.location.pathname;

                        if (typeof subtitlesByPath[path] === 'undefined') {
                            subtitlesByPath[path] = [];
                        }

                        const newId = trackId(track);

                        if (subtitlesByPath[path].find((s) => s.id === newId) === undefined) {
                            subtitlesByPath[path].push({ id: newId, ...track });
                            tracksFound = true;
                        }
                    },
                    (theBasename) => {
                        basename = theBasename;
                        basenameFound = true;
                    }
                );

                if (trackDataRequestHandled && (tracksFound || basenameFound)) {
                    // Only notify additional tracks after the initial request for track info
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: {
                                error: '',
                                basename: basename,
                                subtitles: subtitlesByPath[window.location.pathname],
                            },
                        })
                    );
                }

                return value;
            };
        }

        function garbageCollect() {
            for (const path of Object.keys(subtitlesByPath)) {
                if (path !== window.location.pathname) {
                    delete subtitlesByPath[path];
                }
            }
        }

        document.addEventListener(
            'asbplayer-get-synced-data',
            async () => {
                onRequest?.(
                    (track) => {
                        const path = window.location.pathname;

                        if (typeof subtitlesByPath[path] === 'undefined') {
                            subtitlesByPath[path] = [];
                        }

                        const newId = trackId(track);

                        if (subtitlesByPath[path].find((s) => s.id === newId) === undefined) {
                            subtitlesByPath[path].push({ id: newId, ...track });
                        }
                    },
                    (theBasename) => {
                        basename = theBasename;
                        if (!trackDataRequestHandled) {
                            // Notify basename even if still waiting for subtitle track info
                            document.dispatchEvent(
                                new CustomEvent('asbplayer-synced-data', {
                                    detail: {
                                        error: '',
                                        basename: basename,
                                        subtitles: undefined,
                                    },
                                })
                            );
                        }
                    }
                );

                const ready = () =>
                    (!waitForBasename || basename !== '') && window.location.pathname in subtitlesByPath;

                if (!ready()) {
                    await poll(ready, timeout);
                }

                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: {
                            error: '',
                            basename: basename,
                            subtitles: subtitlesByPath[window.location.pathname] ?? [],
                        },
                    })
                );

                garbageCollect();
                trackDataRequestHandled = true;
            },
            false
        );
    }, 0);
}
