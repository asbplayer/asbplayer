import { VideoDataSubtitleTrack } from '@project/common';
import { Parser } from 'm3u8-parser';
import { extractExtension, inferTracks, trackFromDef } from './util';

function baseUrlForUrl(url: string) {
    const parsedUrl = new URL(url);
    const originAndPath = `${parsedUrl.origin}${parsedUrl.pathname}`;
    return originAndPath.substring(0, originAndPath.lastIndexOf('/'));
}

export function fetchM3U8(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Bypass cache since Chrome might try to use a cached response that doesn't have appropriate CORS headers
            fetch(url, { cache: 'no-store' })
                .then((response) => response.text())
                .then((text) => {
                    const parser = new Parser();
                    parser.push(text);
                    parser.end();
                    resolve(parser.manifest);
                })
                .catch(reject);
        }, 0);
    });
}

export function subtitleTrackSegmentsFromM3U8(url: string): Promise<VideoDataSubtitleTrack[]> {
    return new Promise((resolve, reject) => {
        setTimeout(async () => {
            try {
                const manifest = await fetchM3U8(url);
                const subtitleGroups = manifest.mediaGroups?.SUBTITLES;

                if (typeof subtitleGroups !== 'object' || !subtitleGroups) {
                    resolve([]);
                    return;
                }

                const baseUrl = baseUrlForUrl(url);
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

                        if (track && typeof track.language === 'string' && typeof track.uri === 'string') {
                            const fetchTrack = async (): Promise<VideoDataSubtitleTrack | undefined> => {
                                const subtitleM3U8Url = `${baseUrl}/${track.uri}`;
                                const subManifest = await fetchM3U8(subtitleM3U8Url);
                                if (!subManifest.segments?.length) {
                                    return undefined;
                                }
                                const subtitleBaseUrl = baseUrlForUrl(subtitleM3U8Url);
                                const urls = subManifest.segments
                                    .filter((s: any) => !s.discontinuity && s.uri)
                                    .map((s: any) => `${subtitleBaseUrl}/${s.uri}`);
                                return trackFromDef({
                                    label: label,
                                    language: track.language,
                                    url: urls,
                                    extension: extractExtension(subManifest.segments[0].uri, 'vtt'),
                                });
                            };
                            promises.push(fetchTrack());
                        }
                    }
                }

                const tracks = (await Promise.all(promises)).filter(
                    (t): t is VideoDataSubtitleTrack => t !== undefined
                );
                resolve(tracks);
            } catch (e) {
                reject(e);
            }
        }, 0);
    });
}

export const inferTracksFromInterceptedM3u8 = (urlRegex: RegExp) => {
    let lastManifestUrl: string | undefined;

    const originalXhrOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function () {
        const url = arguments[1];

        if (typeof url === 'string' && urlRegex.test(url)) {
            lastManifestUrl = url;
        }

        // @ts-ignore
        originalXhrOpen.apply(this, arguments);
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
