import type { VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';
import { inferTracks, trackId } from '@project/extension/src/pages/util';
import type { InferHooks } from '@project/extension/src/pages/util';
import { inheritAttributes, stringToMpdXml, toM3u8, toPlaylists } from 'mpd-parser';

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

export interface MpdTrackMetadata {
    mimeType?: string;
}

type MpdTrackExtractor = (
    playlist: Playlist,
    language: string,
    metadata?: MpdTrackMetadata
) => VideoDataSubtitleTrackDef | undefined;

function parseMpdManifest(manifest: string, manifestUri: string) {
    const parsedManifestInfo = inheritAttributes(stringToMpdXml(manifest), { manifestUri });
    const dashPlaylists = toPlaylists(parsedManifestInfo.representationInfo);
    const metadata = new Map<string, MpdTrackMetadata>();
    for (const playlist of dashPlaylists) {
        const { id, mimeType } = playlist.attributes;
        if (typeof id === 'string') metadata.set(id, { mimeType });
    }
    return {
        manifest: toM3u8({
            dashPlaylists,
            locations: parsedManifestInfo.locations,
            contentSteering: parsedManifestInfo.contentSteeringInfo,
            eventStream: parsedManifestInfo.eventStream,
        }),
        metadata,
    };
}

export const subtitleTracksFromMpdManifest = (
    mpdUrl: string,
    manifest: string,
    trackExtractor: MpdTrackExtractor
): VideoDataSubtitleTrack[] => {
    const { manifest: parsedManifest, metadata: metadataByRepresentationId } = parseMpdManifest(manifest, mpdUrl);
    const subGroups = parsedManifest.mediaGroups?.SUBTITLES?.subs ?? {};
    const tracks: VideoDataSubtitleTrack[] = [];

    if (typeof subGroups !== 'object') return tracks;
    for (const [language, info] of Object.entries(subGroups)) {
        if (typeof info !== 'object' || info === null) continue;
        const playlists = (info as any).playlists ?? [];
        if (!Array.isArray(playlists)) continue;
        for (const playlist of playlists) {
            if (typeof playlist.resolvedUri !== 'string') continue;
            const representationId = playlist.attributes?.NAME;
            const metadata =
                typeof representationId === 'string' ? metadataByRepresentationId.get(representationId) : undefined;
            const track = trackExtractor(playlist, language, metadata);
            if (track !== undefined) tracks.push({ id: trackId(track), ...track });
        }
    }
    return tracks;
};

const tryExtractSubtitleTracks = async (
    mpdUrl: string,
    originalFetch: typeof window.fetch,
    trackExtractor: MpdTrackExtractor
): Promise<VideoDataSubtitleTrack[]> => {
    const manifest = await (await originalFetch(mpdUrl)).text();
    return subtitleTracksFromMpdManifest(mpdUrl, manifest, trackExtractor);
};

export const inferTracksFromInterceptedMpdViaXMLHTTPRequest = (
    mpdUrlRegex: RegExp,
    trackExtractor: MpdTrackExtractor,
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
                tracks = subtitleTracksFromMpdManifest(lastManifestUrl, lastManifestText, trackExtractor);
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
    trackExtractor: MpdTrackExtractor,
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
