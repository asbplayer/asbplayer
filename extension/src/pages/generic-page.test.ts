import { afterEach, expect, it, jest } from '@jest/globals';
import {
    GenericPageDiscovery,
    installGenericPageDiscovery,
    nativeSubtitleTracks,
} from '@project/extension/src/pages/generic-page';

function appendVideo(parent: ParentNode = document.body) {
    const video = document.createElement('video');
    parent.appendChild(video);
    return video;
}

function appendJson(value: unknown, type = 'application/json') {
    const script = document.createElement('script');
    script.type = type;
    script.textContent = JSON.stringify(value);
    document.body.appendChild(script);
    return script;
}

function mockPerformanceEntries(entries: readonly PerformanceEntry[]) {
    const performanceWithEntries = performance as Performance & {
        getEntriesByType?: (entryType: string) => PerformanceEntryList;
    };
    const original = performanceWithEntries.getEntriesByType;
    Object.defineProperty(performanceWithEntries, 'getEntriesByType', {
        configurable: true,
        value: () => entries,
    });
    return () => {
        if (original === undefined) Reflect.deleteProperty(performanceWithEntries, 'getEntriesByType');
        else performanceWithEntries.getEntriesByType = original;
    };
}

afterEach(() => {
    jest.restoreAllMocks();
    document.body.replaceChildren();
    document.head.querySelectorAll('meta[property="og:title"]').forEach((element) => element.remove());
    document.title = '';
    history.replaceState(null, '', '/');
});

it('returns only native subtitle and caption tracks from the requested video', () => {
    const requestedVideo = appendVideo();
    requestedVideo.innerHTML = `
        <track kind="subtitles" src="/subs/en.vtt" srclang="en" label="English">
        <track kind="captions" src="/subs/ja" srclang="ja">
        <track kind="chapters" src="/chapters.vtt" label="Chapters">
        <track kind="subtitles" src="" label="Empty">
    `;
    const otherVideo = appendVideo();
    otherVideo.innerHTML = '<track kind="subtitles" src="/subs/fr.vtt" srclang="fr">';

    expect(nativeSubtitleTracks(requestedVideo)).toMatchObject([
        {
            label: 'English',
            language: 'en',
            url: 'http://localhost/subs/en.vtt',
            extension: 'vtt',
        },
        {
            label: 'ja',
            language: 'ja',
            url: 'http://localhost/subs/ja',
            extension: 'vtt',
        },
    ]);
});

it('serializes a populated programmatic text track without changing its mode', () => {
    const video = appendVideo();
    const subtitleTrack = {
        kind: 'subtitles',
        label: 'English',
        language: 'en-US',
        mode: 'hidden',
        cues: {
            0: { startTime: 1.25, endTime: 3.5, text: 'First line\nSecond line' },
            1: { startTime: 4, endTime: 5, text: 'Third line' },
            length: 2,
        },
    } as unknown as TextTrack;
    Object.defineProperty(video, 'textTracks', {
        configurable: true,
        value: { 0: subtitleTrack, length: 1 },
    });

    const tracks = nativeSubtitleTracks(video);

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({ label: 'English', language: 'en-us', extension: 'vtt' });
    expect(decodeURIComponent((tracks[0].url as string).split(',', 2)[1])).toBe(
        'WEBVTT\n\n00:00:01.250 --> 00:00:03.500\nFirst line\nSecond line\n\n' +
            '00:00:04.000 --> 00:00:05.000\nThird line\n'
    );
    expect(subtitleTrack.mode).toBe('hidden');
});

it('skips unreadable and unreasonably large cue lists', () => {
    const video = appendVideo();
    const unreadableTrack = {
        kind: 'captions',
        label: 'Unreadable',
        language: '',
        get cues() {
            throw new Error('Blocked by player');
        },
    } as unknown as TextTrack;
    const oversizedTrack = {
        kind: 'subtitles',
        label: 'Oversized',
        language: '',
        cues: { length: 10_001 },
    } as unknown as TextTrack;
    Object.defineProperty(video, 'textTracks', {
        configurable: true,
        value: { 0: unreadableTrack, 1: oversizedTrack, length: 2 },
    });

    expect(nativeSubtitleTracks(video)).toEqual([]);
});

it('discovers strict subtitle metadata from small explicitly typed inline JSON', async () => {
    const video = appendVideo();
    appendJson({
        player: {
            tracks: [
                { kind: 'captions', src: '/subs/en.vtt', srclang: 'EN', label: 'English' },
                { kind: 'subtitles', file: '/subs/ja.ass?token=x', language: 'ja', label: 'Japanese' },
                { src: '/subs/es', contentType: 'text/vtt; charset=utf-8', language: 'es' },
            ],
        },
    });

    await expect(new GenericPageDiscovery().videoData(video)).resolves.toMatchObject({
        subtitles: [
            { label: 'English', language: 'en', url: 'http://localhost/subs/en.vtt', extension: 'vtt' },
            { label: 'Japanese', language: 'ja', url: 'http://localhost/subs/ja.ass?token=x', extension: 'ass' },
            { label: 'es', language: 'es', url: 'http://localhost/subs/es', extension: 'vtt' },
        ],
    });
});

it('discovers bounded HLS subtitles from an explicit inline manifest URL', async () => {
    const video = appendVideo();
    appendJson({ player: { hlsUrl: 'https://cdn.example/media/master.m3u8' } });

    const manifests = new Map([
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
segment-1.vtt
#EXTINF:10,
segment-2.vtt
#EXT-X-ENDLIST`,
        ],
    ]);
    const originalFetch = globalThis.fetch;
    const fetchSpy = jest.fn(async (input: RequestInfo | URL) => {
        const url = typeof Request !== 'undefined' && input instanceof Request ? input.url : input.toString();
        const text = manifests.get(url);
        if (text === undefined) {
            return { ok: false, status: 404, headers: { get: () => null } } as unknown as Response;
        }
        return {
            ok: true,
            status: 200,
            url,
            headers: { get: () => null },
            text: async () => text,
        } as unknown as Response;
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchSpy });

    try {
        await expect(new GenericPageDiscovery().videoData(video)).resolves.toMatchObject({
            subtitles: [
                {
                    label: 'English',
                    language: 'en',
                    extension: 'vtt',
                    url: [
                        'https://cdn.example/media/subs/segment-1.vtt',
                        'https://cdn.example/media/subs/segment-2.vtt',
                    ],
                },
            ],
        });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
        if (originalFetch === undefined) delete (globalThis as { fetch?: typeof fetch }).fetch;
        else globalThis.fetch = originalFetch;
    }
});

it('discovers direct subtitle resources from the bounded performance timeline', async () => {
    const video = appendVideo();
    const restorePerformanceEntries = mockPerformanceEntries([
        { name: 'https://cdn.example/subtitles/en.srt?token=x', initiatorType: 'xmlhttprequest' },
        { name: 'https://cdn.example/video.mp4', initiatorType: 'fetch' },
        { name: 'https://cdn.example/thumbnail.vtt', initiatorType: 'img' },
    ] as unknown as PerformanceEntry[]);

    try {
        await expect(new GenericPageDiscovery().videoData(video)).resolves.toMatchObject({
            subtitles: [
                {
                    label: 'en',
                    language: 'en',
                    url: 'https://cdn.example/subtitles/en.srt?token=x',
                    extension: 'srt',
                },
            ],
        });
    } finally {
        restorePerformanceEntries();
    }
});

it('rejects ambiguous JSON URLs and explicit non-subtitle tracks', async () => {
    const video = appendVideo();
    appendJson({
        tracks: [
            { url: '/looks-like-a-subtitle.vtt', label: 'No semantics' },
            { kind: 'thumbnails', file: '/thumbnails.vtt', type: 'text/vtt' },
            { kind: 'captions', file: '/extensionless', label: 'No format' },
            { kind: 'captions', file: '/wrong-mime.vtt', type: 'video/mp4' },
            { kind: 'captions', file: '/wrong-format.vtt', format: 'mp4' },
            { kind: 'captions', file: 'javascript:alert(1)', format: 'vtt' },
            { kind: 'captions', file: '/valid.srt', label: 'Valid' },
        ],
    });

    await expect(new GenericPageDiscovery().videoData(video)).resolves.toMatchObject({
        subtitles: [{ label: 'Valid', url: 'http://localhost/valid.srt', extension: 'srt' }],
    });
});

it('ignores unsupported, structured-data, malformed, and oversized scripts', async () => {
    const video = appendVideo();
    appendJson({ kind: 'captions', src: '/unsupported.vtt' }, 'application/octet-stream');
    appendJson({ kind: 'captions', src: '/structured.vtt' }, 'application/ld+json');
    const malformed = document.createElement('script');
    malformed.type = 'application/json';
    malformed.textContent = '{';
    document.body.appendChild(malformed);
    appendJson({
        padding: 'x'.repeat(128_000),
        track: { kind: 'captions', src: '/oversized.vtt' },
    });

    await expect(new GenericPageDiscovery().videoData(video)).resolves.toMatchObject({ subtitles: [] });
});

it('does not associate page-level inline metadata with one of several videos', async () => {
    const requestedVideo = appendVideo();
    requestedVideo.innerHTML = '<track kind="captions" src="/native.vtt" label="Native">';
    appendVideo();
    appendJson({ kind: 'captions', src: '/page-level.vtt', label: 'Page level' });
    const restorePerformanceEntries = mockPerformanceEntries([
        { name: 'https://cdn.example/page-level.srt', initiatorType: 'xmlhttprequest' },
    ] as unknown as PerformanceEntry[]);

    try {
        await expect(new GenericPageDiscovery().videoData(requestedVideo)).resolves.toMatchObject({
            subtitles: [{ label: 'Native', url: 'http://localhost/native.vtt' }],
        });
    } finally {
        restorePerformanceEntries();
    }
});

it('deduplicates the same resource found through native and inline metadata', async () => {
    const video = appendVideo();
    video.innerHTML = '<track kind="captions" src="/same.vtt" label="Native">';
    appendJson({ tracks: [{ kind: 'captions', file: '/same.vtt', label: 'Inline' }] });

    await expect(new GenericPageDiscovery().videoData(video)).resolves.toMatchObject({
        subtitles: [{ label: 'Native', url: 'http://localhost/same.vtt' }],
    });
});

it('uses video-scoped title metadata before page title metadata', async () => {
    const video = appendVideo();
    video.setAttribute('aria-label', 'Video title');
    document.title = 'Document title';
    const openGraphTitle = document.createElement('meta');
    openGraphTitle.setAttribute('property', 'og:title');
    openGraphTitle.content = 'Open Graph title';
    document.head.appendChild(openGraphTitle);

    await expect(new GenericPageDiscovery().videoData(video)).resolves.toMatchObject({ basename: 'Video title' });
});

it('installation leaves host networking and parsing globals untouched', () => {
    const originalFetch = window.fetch;
    const originalOpen = window.XMLHttpRequest.prototype.open;
    const originalSend = window.XMLHttpRequest.prototype.send;
    const originalParse = JSON.parse;

    const uninstall = installGenericPageDiscovery();

    expect(window.fetch).toBe(originalFetch);
    expect(window.XMLHttpRequest.prototype.open).toBe(originalOpen);
    expect(window.XMLHttpRequest.prototype.send).toBe(originalSend);
    expect(JSON.parse).toBe(originalParse);
    uninstall();
});
