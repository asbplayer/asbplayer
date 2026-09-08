import type { VideoDataSubtitleTrack } from '@project/common';
import { detectedSubtitleLabel, genericSubtitleDisplayLabel } from '@project/extension/src/pages/subtitle-discovery';
import { Parser } from 'm3u8-parser';
import {
    extractExtension,
    inferTracks,
    normalizeSubtitleExtension,
    trackFromDef,
} from '@project/extension/src/pages/util';

export function parseM3U8(text: string): any {
    const parser = new Parser();
    parser.push(text);
    parser.end();
    return parser.manifest;
}

export function limitM3U8SubtitleRenditions(manifest: any, maximumRenditions: number) {
    const subtitleGroups = manifest?.mediaGroups?.SUBTITLES;
    if (subtitleGroups === null || typeof subtitleGroups !== 'object') return manifest;

    let remaining = maximumRenditions;
    const groups: Record<string, Record<string, unknown>> = {};
    for (const [groupId, group] of Object.entries(subtitleGroups)) {
        if (remaining === 0 || group === null || typeof group !== 'object') break;
        const entries = Object.entries(group).slice(0, remaining);
        if (entries.length === 0) continue;
        groups[groupId] = Object.fromEntries(entries);
        remaining -= entries.length;
    }

    return {
        ...manifest,
        mediaGroups: { ...manifest.mediaGroups, SUBTITLES: groups },
    };
}

export function fetchM3U8(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Bypass cache since Chrome might try to use a cached response that doesn't have appropriate CORS headers
            fetch(url, { cache: 'no-store' })
                .then((response) => response.text())
                .then((text) => {
                    resolve(parseM3U8(text));
                })
                .catch(reject);
        }, 0);
    });
}

export function subtitleTrackSegmentsFromM3U8(url: string): Promise<VideoDataSubtitleTrack[]> {
    return fetchM3U8(url).then((manifest) => subtitleTrackSegmentsFromM3U8Manifest(url, manifest));
}

export interface LoadedM3U8Manifest {
    manifest: any;
    url: string;
}

export async function subtitleTrackSegmentsFromM3U8Manifest(
    url: string,
    manifest: any,
    manifestLoader: (url: string) => Promise<LoadedM3U8Manifest> = async (manifestUrl) => ({
        manifest: await fetchM3U8(manifestUrl),
        url: manifestUrl,
    })
): Promise<VideoDataSubtitleTrack[]> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            void (async () => {
                const subtitleGroups = manifest.mediaGroups?.SUBTITLES;

                if (typeof subtitleGroups !== 'object' || !subtitleGroups) {
                    resolve([]);
                    return;
                }

                const promises: Promise<VideoDataSubtitleTrack | undefined>[] = [];

                for (const group of Object.values(subtitleGroups)) {
                    if (typeof group !== 'object' || !group) {
                        continue;
                    }

                    for (const label of Object.keys(group)) {
                        if (label.includes('--forced--')) {
                            // These tracks are not for the main content and duplicate the language code
                            // so let's exclude them
                            // Unfortunately could not find a better way to distinguish them from the real subtitle content
                            continue;
                        }

                        const track = (group as any)[label];

                        if (track && typeof track.uri === 'string') {
                            const fetchTrack = async (): Promise<VideoDataSubtitleTrack | undefined> => {
                                const subtitleM3U8Url = new URL(track.uri, url).href;
                                const loadedManifest = await manifestLoader(subtitleM3U8Url);
                                const subManifest = loadedManifest.manifest;
                                const segments = (subManifest.segments ?? []).filter(
                                    (segment: any) => !segment.discontinuity && typeof segment.uri === 'string'
                                );
                                if (!segments.length) return;
                                const urls = segments.map(
                                    (segment: any) => new URL(segment.uri, loadedManifest.url).href
                                );
                                const rawExtension = extractExtension(urls[0], 'vtt').toLowerCase();
                                const language = typeof track.language === 'string' ? track.language : undefined;
                                return trackFromDef({
                                    label: genericSubtitleDisplayLabel(label, language, detectedSubtitleLabel),
                                    language,
                                    url: urls,
                                    extension:
                                        // A best-effort heuristic to treat XML subtitle segments in HLS as TTML
                                        rawExtension === 'xml'
                                            ? 'ttml2'
                                            : (normalizeSubtitleExtension(rawExtension) ?? rawExtension),
                                });
                            };
                            promises.push(fetchTrack());
                        }
                    }
                }

                const tracks = (await Promise.all(promises)).filter(
                    (track): track is VideoDataSubtitleTrack => track !== undefined
                );
                resolve(tracks);
            })().catch(reject);
        }, 0);
    });
}

export const inferTracksFromInterceptedM3u8 = (urlRegex: RegExp) => {
    let lastManifestUrl: string | undefined;

    const originalXhrOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (...args: unknown[]) {
        const url = args[1];

        if (typeof url === 'string' && urlRegex.test(url)) {
            lastManifestUrl = url;
        }

        // @ts-expect-error: forwarding original XHR arguments
        originalXhrOpen.apply(this, args);
    };

    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            setBasename(document.title);

            if (lastManifestUrl !== undefined) {
                const tracks = await subtitleTrackSegmentsFromM3U8(lastManifestUrl);
                for (const track of tracks) {
                    addTrack(track);
                }
            }
        },
        waitForBasename: false,
    });
};
