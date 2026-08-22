import type { VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';
import { inferTracks, trackId } from '@project/extension/src/pages/util';
import { parse } from 'mpd-parser';

export interface Segment {
    resolvedUri: string;
}

export interface Playlist {
    attributes: any;
    resolvedUri: string;
    segments: Segment[];
}

export interface MpdTrackMetadata {
    mimeType?: string;
}

function subtitleMetadataByRepresentationId(manifest: string) {
    const metadata = new Map<string, MpdTrackMetadata>();
    const document = new DOMParser().parseFromString(manifest, 'application/xml');
    for (const representation of Array.from(document.getElementsByTagNameNS('*', 'Representation'))) {
        const id = representation.getAttribute('id');
        if (!id) continue;
        let parent = representation.parentElement;
        while (parent !== null && parent.localName !== 'AdaptationSet') parent = parent.parentElement;
        metadata.set(id, {
            mimeType: representation.getAttribute('mimeType') ?? parent?.getAttribute('mimeType') ?? undefined,
        });
    }
    return metadata;
}

export const subtitleTracksFromMpdManifest = (
    mpdUrl: string,
    manifest: string,
    trackExtractor: (
        playlist: Playlist,
        language: string,
        metadata?: MpdTrackMetadata
    ) => VideoDataSubtitleTrackDef | undefined
): VideoDataSubtitleTrack[] => {
    const parsedManifest = parse(manifest, { manifestUri: mpdUrl });
    const metadataByRepresentationId = subtitleMetadataByRepresentationId(manifest);
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
    trackExtractor: (playlist: Playlist, language: string) => VideoDataSubtitleTrackDef | undefined
): Promise<VideoDataSubtitleTrack[]> => {
    const manifest = await (await originalFetch(mpdUrl)).text();
    return subtitleTracksFromMpdManifest(mpdUrl, manifest, trackExtractor);
};

export const inferTracksFromInterceptedMpdViaXMLHTTPRequest = (
    mpdUrlRegex: RegExp,
    trackExtractor: (playlist: Playlist, language: string) => VideoDataSubtitleTrackDef | undefined
) => {
    let lastManifestUrl: string | undefined;

    const originalXhrOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (...args: unknown[]) {
        const url = args[1];

        if (typeof url === 'string' && mpdUrlRegex.test(url)) {
            lastManifestUrl = url;
        }

        // @ts-expect-error: forwarding original XHR arguments
        originalXhrOpen.apply(this, args);
    };

    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            setBasename(document.title);

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

export const inferTracksFromInterceptedMpd = (
    mpdUrlRegex: RegExp,
    trackExtractor: (playlist: Playlist, language: string) => VideoDataSubtitleTrackDef | undefined
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
        onRequest: async (addTrack, setBasename) => {
            setBasename(document.title);

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
