import { VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';
import { inferTracks, type InferHooks, trackId } from './util';
import { parse } from 'mpd-parser';

export interface Segment {
    resolvedUri: string;
}

export interface Playlist {
    attributes: any;
    resolvedUri: string;
    segments: Segment[];
}

interface InferTracksFromMpdOptions {
    onJson?: InferHooks['onJson'];
    basename?: () => string;
}

const extractSubtitleTracks = (
    manifest: string,
    mpdUrl: string,
    trackExtractor: (playlist: Playlist, language: string) => VideoDataSubtitleTrackDef | undefined
): VideoDataSubtitleTrack[] => {
    const parsedManifest = parse(manifest, { manifestUri: mpdUrl });
    const subGroups = parsedManifest.mediaGroups?.SUBTITLES?.subs ?? {};
    const tracks: VideoDataSubtitleTrack[] = [];

    if (typeof subGroups !== 'object') {
        return [];
    }

    for (const [language, info] of Object.entries(subGroups)) {
        if (typeof info !== 'object') {
            continue;
        }

        const playlists = (info as any).playlists ?? [];

        if (typeof playlists !== 'object' || !Array.isArray(playlists)) {
            continue;
        }

        for (const playlist of playlists) {
            if (typeof playlist.resolvedUri !== 'string') {
                continue;
            }

            const track = trackExtractor(playlist, language);

            if (track !== undefined) {
                const id = trackId(track);
                tracks.push({ id, ...track });
            }
        }
    }

    return tracks;
};

const tryExtractSubtitleTracks = async (
    mpdUrl: string,
    originalFetch: typeof window.fetch,
    trackExtractor: (playlist: Playlist, language: string) => VideoDataSubtitleTrackDef | undefined
): Promise<VideoDataSubtitleTrack[]> => {
    const manifest = await (await originalFetch(mpdUrl)).text();
    return extractSubtitleTracks(manifest, mpdUrl, trackExtractor);
};

export const inferTracksFromInterceptedMpdViaXMLHTTPRequest = (
    mpdUrlRegex: RegExp,
    trackExtractor: (playlist: Playlist, language: string) => VideoDataSubtitleTrackDef | undefined,
    options: InferTracksFromMpdOptions = {}
) => {
    let lastManifestUrl: string | undefined;
    let lastManifestText: string | undefined;

    const originalXhrOpen = window.XMLHttpRequest.prototype.open;

    window.XMLHttpRequest.prototype.open = function (...args: unknown[]) {
        const url = args[1];

        if (typeof url === 'string' && mpdUrlRegex.test(url)) {
            const requestedManifestUrl = url;

            lastManifestUrl = requestedManifestUrl;
            lastManifestText = undefined;

            this.addEventListener(
                'load',
                () => {
                    let manifestText: string | undefined;

                    try {
                        if (typeof this.responseText === 'string') {
                            manifestText = this.responseText;
                        }
                    } catch {
                        // responseText is unavailable for some response types.
                    }

                    if (manifestText === undefined && typeof this.response === 'string') {
                        manifestText = this.response;
                    }

                    if (manifestText === undefined && this.responseXML !== null) {
                        manifestText = new XMLSerializer().serializeToString(this.responseXML);
                    }

                    if (manifestText !== undefined && manifestText !== '') {
                        lastManifestUrl = this.responseURL || requestedManifestUrl;
                        lastManifestText = manifestText;
                    }
                },
                { once: true }
            );
        }

        // @ts-expect-error: forwarding original XHR arguments
        originalXhrOpen.apply(this, args);
    };

    inferTracks({
        onJson: options.onJson,
        onRequest: async (addTrack, setBasename) => {
            setBasename(options.basename?.() ?? document.title);

            if (lastManifestUrl === undefined) {
                return;
            }

            let tracks: VideoDataSubtitleTrack[];

            if (lastManifestText !== undefined) {
                tracks = extractSubtitleTracks(lastManifestText, lastManifestUrl, trackExtractor);
            } else {
                tracks = await tryExtractSubtitleTracks(lastManifestUrl, window.fetch, trackExtractor);
            }

            for (const track of tracks) {
                addTrack(track);
            }
        },
        waitForBasename: false,
    });
};

export const inferTracksFromInterceptedMpd = (
    mpdUrlRegex: RegExp,
    trackExtractor: (playlist: Playlist, language: string) => VideoDataSubtitleTrackDef | undefined,
    options: InferTracksFromMpdOptions = {}
) => {
    const originalFetch = window.fetch;

    let lastManifestUrl: string | undefined;

    window.fetch = (...args) => {
        const mpdUrl = args.find((arg) => typeof arg === 'string' && mpdUrlRegex.test(arg)) as string;

        if (mpdUrl !== undefined) {
            lastManifestUrl = mpdUrl;
        }

        return originalFetch(...args);
    };

    inferTracks({
        onJson: options.onJson,
        onRequest: async (addTrack, setBasename) => {
            setBasename(options.basename?.() ?? document.title);

            if (lastManifestUrl !== undefined) {
                const tracks = await tryExtractSubtitleTracks(lastManifestUrl, window.fetch, trackExtractor);

                for (const track of tracks) {
                    addTrack(track);
                }
            }
        },
        waitForBasename: false,
    });
};
