import { afterEach, expect, it, jest } from '@jest/globals';
import {
    parseM3U8,
    subtitleTrackSegmentsFromM3U8,
    subtitleTrackSegmentsFromM3U8Manifest,
} from '@project/extension/src/pages/m3u8-util';

const originalFetch = globalThis.fetch;

function mockManifestFetch(manifests: ReadonlyMap<string, string>) {
    const fetchSpy = jest.fn(async (input: RequestInfo | URL) => {
        const url = typeof Request !== 'undefined' && input instanceof Request ? input.url : input.toString();
        const text = manifests.get(url);
        if (text === undefined) {
            throw new Error(`Unexpected manifest request: ${url}`);
        }
        return { text: async () => text } as unknown as Response;
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchSpy });
    return fetchSpy;
}

afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
});

it('parses subtitle media groups and segments from manifest text', () => {
    const manifest = parseM3U8(`#EXTM3U
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="subs/en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1280000,SUBTITLES="subs"
video.m3u8`);

    expect(manifest.mediaGroups.SUBTITLES.subs.English).toMatchObject({ language: 'en', uri: 'subs/en.m3u8' });
});

it('fetches subtitle track segments and resolves relative URIs against each manifest location', async () => {
    mockManifestFetch(
        new Map([
            [
                'https://cdn.example/media/master.m3u8',
                `#EXTM3U
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="subs/en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1280000,SUBTITLES="subs"
video.m3u8`,
            ],
            [
                'https://cdn.example/media/subs/en.m3u8',
                `#EXTM3U
#EXTINF:10,
../segments/en-1.webvtt
#EXTINF:10,
https://other-cdn.example/en-2.webvtt
#EXT-X-ENDLIST`,
            ],
        ])
    );

    await expect(subtitleTrackSegmentsFromM3U8('https://cdn.example/media/master.m3u8')).resolves.toMatchObject([
        {
            label: 'English',
            language: 'en',
            url: ['https://cdn.example/media/segments/en-1.webvtt', 'https://other-cdn.example/en-2.webvtt'],
            extension: 'vtt',
        },
    ]);
});

it('excludes forced renditions and tracks whose manifests contain no usable segments', async () => {
    mockManifestFetch(
        new Map([
            [
                'https://cdn.example/master.m3u8',
                `#EXTM3U
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="en.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English--forced--",LANGUAGE="en",URI="en-forced.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Empty",LANGUAGE="ja",URI="empty.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1280000,SUBTITLES="subs"
video.m3u8`,
            ],
            [
                'https://cdn.example/en.m3u8',
                `#EXTM3U
#EXT-X-DISCONTINUITY
#EXTINF:10,
skipped.vtt
#EXTINF:10,
en-1.vtt
#EXT-X-ENDLIST`,
            ],
            [
                'https://cdn.example/empty.m3u8',
                `#EXTM3U
#EXT-X-ENDLIST`,
            ],
        ])
    );

    await expect(subtitleTrackSegmentsFromM3U8('https://cdn.example/master.m3u8')).resolves.toMatchObject([
        {
            label: 'English',
            language: 'en',
            url: ['https://cdn.example/en-1.vtt'],
            extension: 'vtt',
        },
    ]);
});

it('resolves to no tracks when the master manifest has no subtitle groups', async () => {
    mockManifestFetch(
        new Map([
            [
                'https://cdn.example/master.m3u8',
                `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1280000
video.m3u8`,
            ],
        ])
    );

    await expect(subtitleTrackSegmentsFromM3U8('https://cdn.example/master.m3u8')).resolves.toEqual([]);
});

it('maps xml segment suffixes to ttml2 and preserves unnormalized suffixes', async () => {
    const loader = async (url: string) => ({
        manifest: parseM3U8(`#EXTM3U
#EXTINF:10,
segment-1.${url.includes('xml') ? 'xml' : 'scc'}
#EXT-X-ENDLIST`),
        url,
    });
    const masterManifest = parseM3U8(`#EXTM3U
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="TTML",LANGUAGE="en",URI="xml.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Other",LANGUAGE="ja",URI="other.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1280000,SUBTITLES="subs"
video.m3u8`);

    const tracks = await subtitleTrackSegmentsFromM3U8Manifest(
        'https://cdn.example/master.m3u8',
        masterManifest,
        loader
    );

    expect(tracks).toMatchObject([
        { label: 'TTML', extension: 'ttml2' },
        { label: 'Other', extension: 'scc' },
    ]);
});

it('keeps a URI-bearing subtitle rendition when its optional language is absent', async () => {
    const loader = async (url: string) => ({
        manifest: parseM3U8(`#EXTM3U
#EXTINF:10,
segment-1.vtt
#EXT-X-ENDLIST`),
        url,
    });
    const masterManifest = parseM3U8(`#EXTM3U
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",URI="en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1280000,SUBTITLES="subs"
video.m3u8`);

    await expect(
        subtitleTrackSegmentsFromM3U8Manifest('https://cdn.example/master.m3u8', masterManifest, loader)
    ).resolves.toMatchObject([
        {
            label: 'English',
            language: undefined,
            url: ['https://cdn.example/segment-1.vtt'],
            extension: 'vtt',
        },
    ]);
});

it('resolves segment URIs against the final manifest URL reported by the loader', async () => {
    const loader = async (url: string) => ({
        manifest: parseM3U8(`#EXTM3U
#EXTINF:10,
segment-1.vtt
#EXT-X-ENDLIST`),
        // Simulate a redirect to a different location
        url: url.replace('cdn.example', 'redirected.example'),
    });
    const masterManifest = parseM3U8(`#EXTM3U
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="subs/en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=1280000,SUBTITLES="subs"
video.m3u8`);

    const tracks = await subtitleTrackSegmentsFromM3U8Manifest(
        'https://cdn.example/master.m3u8',
        masterManifest,
        loader
    );

    expect(tracks).toMatchObject([{ url: ['https://redirected.example/subs/segment-1.vtt'] }]);
});
