import { asbError } from '@project/common/util';
import type { VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';

export function getLocale(language: string): Intl.Locale | undefined {
    try {
        return new Intl.Locale(language.trim().replace(/_/g, '-'));
    } catch {
        return;
    }
}

export function canonicalLanguageTag(language: Intl.Locale): string;
export function canonicalLanguageTag(language: string): string | undefined;
export function canonicalLanguageTag(language: string | Intl.Locale): string | undefined {
    const locale = typeof language === 'string' ? getLocale(language) : language;
    return locale?.baseName; // baseName normalizes for Intl.DisplayNames
}

function capitalizeFirstLetter(value: string, locale: string): string {
    const firstCodePoint = value.codePointAt(0);
    if (firstCodePoint === undefined) return value;
    const firstCharacter = String.fromCodePoint(firstCodePoint);
    return firstCharacter.toLocaleUpperCase(locale) + value.slice(firstCharacter.length);
}

export function languageDisplayName(language: string, locale: Intl.Locale | undefined = getLocale(language)): string {
    const canonical = canonicalLanguageTag(language);
    if (canonical === undefined || locale === undefined) return language;

    try {
        const displayLocale = canonicalLanguageTag(locale);
        const displayName = new Intl.DisplayNames([displayLocale], {
            type: 'language',
            languageDisplay: 'standard',
            fallback: 'none',
        }).of(canonical);
        return displayName === undefined ? language : capitalizeFirstLetter(displayName, displayLocale);
    } catch {
        return language;
    }
}

export function extractExtension(url: string, fallback: string) {
    const path = url.split(/[?#]/)[0];
    const dotIndex = path.lastIndexOf('.');
    return dotIndex <= path.lastIndexOf('/') ? fallback : path.substring(dotIndex + 1);
}

const normalizedSubtitleExtensions: Readonly<Record<string, string>> = {
    ass: 'ass',
    dfxp: 'dfxp',
    srt: 'srt',
    ssa: 'ass',
    sup: 'sup',
    ttml: 'ttml2',
    ttml2: 'ttml2',
    vtt: 'vtt',
    webvtt: 'vtt',
};

export function normalizeSubtitleExtension(extension: string): string | undefined {
    return normalizedSubtitleExtensions[extension.trim().toLowerCase()];
}

export function subtitleFileExtensionForUrl(url: string, declaredExtension: string): string {
    return normalizeSubtitleExtension(extractExtension(url, '')) ?? declaredExtension;
}

export function mediaSourceUrl(media: HTMLMediaElement): string | undefined {
    return (
        media.currentSrc ||
        media.src ||
        Array.from(media.querySelectorAll('source')).find((source) => source.src.length > 0)?.src ||
        undefined
    );
}

export function mediaSourceIdentity(media: HTMLMediaElement): unknown {
    return media.srcObject ?? mediaSourceUrl(media) ?? undefined;
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

type SubtitlesByPath = { [key: string]: VideoDataSubtitleTrack[] };

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
        const basenameByPath: { [key: string]: string } = {};
        let trackDataRequestHandled = false;

        if (onJson !== undefined) {
            const originalParse = JSON.parse;

            JSON.parse = function (...args: unknown[]) {
                // @ts-expect-error: forwarding original parse arguments
                const value = originalParse.apply(this, args);
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
                        basenameByPath[window.location.pathname] = theBasename;
                        basenameFound = true;
                    }
                );

                if (trackDataRequestHandled && (tracksFound || basenameFound)) {
                    // Only notify additional tracks after the initial request for track info
                    const currentPath = window.location.pathname;
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: {
                                error: '',
                                basename: basenameByPath[currentPath] ?? '',
                                subtitles: subtitlesByPath[currentPath],
                            },
                        })
                    );
                }

                return value;
            };
        }

        function garbageCollect() {
            const currentPath = window.location.pathname;
            for (const path of Object.keys(subtitlesByPath)) {
                if (path !== currentPath) {
                    delete subtitlesByPath[path];
                }
            }
            for (const path of Object.keys(basenameByPath)) {
                if (path !== currentPath) {
                    delete basenameByPath[path];
                }
            }
        }

        document.addEventListener(
            'asbplayer-get-synced-data',
            () => {
                void (async () => {
                    // Pin the pathname at request-start time so async onRequest
                    // callbacks resolving after a soft-navigation still file their
                    // tracks and basename under the path they were fetched for.
                    const requestPath = window.location.pathname;

                    if (onRequest !== undefined) {
                        void onRequest(
                            (track) => {
                                if (typeof subtitlesByPath[requestPath] === 'undefined') {
                                    subtitlesByPath[requestPath] = [];
                                }

                                const newId = trackId(track);

                                if (subtitlesByPath[requestPath].find((s) => s.id === newId) === undefined) {
                                    subtitlesByPath[requestPath].push({ id: newId, ...track });
                                }
                            },
                            (theBasename) => {
                                basenameByPath[requestPath] = theBasename;
                                if (!trackDataRequestHandled && requestPath === window.location.pathname) {
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
                        ).catch((error) => asbError('subtitle/source', error));
                    }

                    const ready = () => {
                        const path = window.location.pathname;
                        return (!waitForBasename || (basenameByPath[path] ?? '') !== '') && path in subtitlesByPath;
                    };

                    if (!ready()) {
                        await poll(ready, timeout);
                    }

                    const currentPath = window.location.pathname;
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: {
                                error: '',
                                basename: basenameByPath[currentPath] ?? '',
                                subtitles: subtitlesByPath[currentPath] ?? [],
                            },
                        })
                    );

                    garbageCollect();
                    trackDataRequestHandled = true;
                })().catch((error) => asbError('subtitle/source', error));
            },
            false
        );
    }, 0);
}
