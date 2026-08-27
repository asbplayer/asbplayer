import { afterEach, expect, it, jest } from '@jest/globals';

// The package ships ESM that this repository's Jest setup does not transform.
jest.mock('@project/common/subtitle-reader/subtitles-to-srt', () => ({
    subtitlesToSrt: (subtitles: readonly { text: string }[]) => subtitles.map(({ text }) => text).join('\n'),
}));

import { AggressiveGenericPageDiscovery } from '@project/extension/src/pages/aggressive-generic-page';

function appendJson(value: unknown) {
    const script = document.createElement('script');
    script.type = 'application/json';
    script.textContent = JSON.stringify(value);
    document.body.appendChild(script);
}

function mockTextTrack(video: HTMLVideoElement, initialCues: readonly object[]) {
    let cues = initialCues;
    const track = new EventTarget() as EventTarget & TextTrack;
    Object.defineProperties(track, {
        kind: { configurable: true, value: 'captions' },
        label: { configurable: true, value: 'English' },
        language: { configurable: true, value: 'en' },
        mode: { configurable: true, writable: true, value: 'hidden' },
        cues: {
            configurable: true,
            get: () => Object.assign({}, cues, { length: cues.length }),
        },
    });
    const textTracks = new EventTarget() as EventTarget & TextTrackList;
    Object.defineProperties(textTracks, {
        0: { configurable: true, value: track },
        length: { configurable: true, value: 1 },
    });
    Object.defineProperty(video, 'textTracks', { configurable: true, value: textTracks });
    return {
        track,
        setCues(value: readonly object[]) {
            cues = value;
        },
    };
}

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    document.body.replaceChildren();
    history.replaceState(null, '', '/');
});

function jsonResponse(url: string, value: unknown) {
    return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'application/json' },
        clone() {
            return this;
        },
        text: async () => JSON.stringify(value),
    } as unknown as Response;
}

it('discovers contextual subtitle metadata observed through JSON.parse', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const originalOpen = window.XMLHttpRequest.prototype.open;
    const originalParse = JSON.parse;
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        JSON.parse(
            JSON.stringify({
                player: {
                    subtitles: [{ src: '/captions/ja.vtt', label: 'Japanese', language: 'ja' }],
                },
            })
        );

        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [
                {
                    label: 'Japanese',
                    language: 'ja',
                    url: 'http://localhost/captions/ja.vtt',
                    extension: 'vtt',
                },
            ],
        });
    } finally {
        uninstall();
    }

    expect(window.fetch).toBe(originalFetch);
    expect(window.XMLHttpRequest.prototype.open).toBe(originalOpen);
    expect(JSON.parse).toBe(originalParse);
});

it('discovers HLS renditions from a manifest URL observed only in a runtime JSON response', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const resources = new Map([
        [
            'https://cdn.example/config/playback.json',
            {
                contentType: 'application/json',
                text: JSON.stringify({ playback: { manifestUrl: '../master.m3u8' } }),
            },
        ],
        [
            'https://cdn.example/master.m3u8',
            {
                contentType: 'application/vnd.apple.mpegurl',
                responseUrl: 'https://media.example/redirected/master.m3u8',
                text: '#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="en.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1,SUBTITLES="subs"\nvideo.m3u8',
            },
        ],
        [
            'https://media.example/redirected/en.m3u8',
            {
                contentType: 'application/vnd.apple.mpegurl',
                text: '#EXTM3U\n#EXTINF:10,\nen-1.vtt\n#EXT-X-ENDLIST',
            },
        ],
    ]);
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        const resource = resources.get(url);
        if (resource === undefined) throw new Error(`Unexpected URL: ${url}`);
        return {
            ok: true,
            status: 200,
            url: 'responseUrl' in resource ? resource.responseUrl : url,
            headers: { get: () => resource.contentType },
            clone() {
                return this;
            },
            text: async () => resource.text,
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch('https://cdn.example/config/playback.json');

        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [
                {
                    label: 'English',
                    language: 'en',
                    url: ['https://media.example/redirected/en-1.vtt'],
                    extension: 'vtt',
                },
            ],
        });
        expect(fetchMock.mock.calls.map(([input]) => input.toString())).toEqual([
            'https://cdn.example/config/playback.json',
            'https://cdn.example/master.m3u8',
            'https://media.example/redirected/en.m3u8',
        ]);
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('bounds manifest requests sourced from runtime JSON', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        return {
            ok: true,
            status: 200,
            url,
            headers: { get: () => 'application/vnd.apple.mpegurl' },
            text: async () => '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nvideo.m3u8',
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        JSON.parse(
            JSON.stringify({
                playback: Array.from({ length: 4 }, (_, index) => ({
                    manifestUrl: `https://cdn.example/master-${index}.m3u8`,
                })),
            })
        );

        await discovery.videoData(video);
        expect(fetchMock.mock.calls.map(([input]) => input.toString())).toEqual([
            'https://cdn.example/master-0.m3u8',
            'https://cdn.example/master-1.m3u8',
            'https://cdn.example/master-2.m3u8',
        ]);
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('uses a larger bounded traversal only for strongly hinted JSON.parse payloads', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        JSON.parse(
            JSON.stringify({
                blockers: Array.from({ length: 700 }, (_, index) => ({ analytics: index })),
                player: {
                    state: {
                        subtitleInfos: [
                            {
                                Url: 'https://cdn.example/timedtext?id=1',
                                Format: 'webvtt',
                                LanguageCodeName: 'eng-US',
                            },
                        ],
                    },
                },
            })
        );

        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [
                {
                    language: 'eng-us',
                    url: 'https://cdn.example/timedtext?id=1',
                    extension: 'vtt',
                },
            ],
        });
    } finally {
        uninstall();
    }
});

it('uses one bounded aggressive pass for a large late hydration payload', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    for (let index = 0; index < 7; index++) appendJson({ analytics: { index } });
    appendJson({
        padding: 'x'.repeat(130_000),
        blockers: Array.from({ length: 700 }, (_, index) => ({ analytics: index })),
        __DEFAULT_SCOPE__: {
            webapp: {
                videoDetail: {
                    itemInfo: {
                        itemStruct: {
                            video: {
                                subtitleInfos: [
                                    {
                                        Url: 'https://cdn.example/timedtext?id=1',
                                        Format: 'webvtt',
                                        LanguageCodeName: 'eng-US',
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        },
    });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [
                {
                    label: 'eng-us',
                    language: 'eng-us',
                    url: 'https://cdn.example/timedtext?id=1',
                    extension: 'vtt',
                },
            ],
        });
    } finally {
        uninstall();
    }
});

it('passively accumulates enabled cues only in aggressive mode', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const firstCue = { startTime: 1, endTime: 2, text: 'First' };
    const secondCue = { startTime: 3, endTime: 4, text: 'Second' };
    const textTrack = mockTextTrack(video, [firstCue]);
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await discovery.videoData(video);
        textTrack.setCues([secondCue]);
        textTrack.track.dispatchEvent(new Event('cuechange'));
        textTrack.setCues([]);

        const data = await discovery.videoData(video);
        expect(data.subtitles).toHaveLength(1);
        expect(data.subtitles?.[0]).toMatchObject({
            label: 'English (captured during playback)',
            language: 'en',
            extension: 'srt',
        });
        const text = decodeURIComponent((data.subtitles?.[0].url as string).split(',', 2)[1]);
        expect(text).toContain('First');
        expect(text).toContain('Second');
        expect(textTrack.track.mode).toBe('hidden');
    } finally {
        uninstall();
    }
});

it('clears aggressively accumulated cues on navigation and teardown', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const textTrack = mockTextTrack(video, [{ startTime: 1, endTime: 2, text: 'Old page' }]);
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    await discovery.videoData(video);
    textTrack.setCues([]);
    history.pushState(null, '', '/new-page');
    await expect(discovery.videoData(video)).resolves.toMatchObject({ subtitles: [] });

    textTrack.setCues([{ startTime: 3, endTime: 4, text: 'After cleanup' }]);
    textTrack.track.dispatchEvent(new Event('cuechange'));
    uninstall();
    textTrack.setCues([]);
    await expect(discovery.videoData(video)).resolves.toMatchObject({ subtitles: [] });
});

it('uses subtitle-service hostnames as context without matching unrelated prefixes', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        return {
            ok: true,
            status: 200,
            url,
            headers: { get: () => 'text/plain' },
            clone() {
                return this;
            },
            text: async () => 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n',
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch('https://subscription.example/resource');
        await window.fetch('https://subs.example/resource');

        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [
                expect.objectContaining({
                    url: 'https://subs.example/resource',
                    extension: 'vtt',
                }),
            ],
        });
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('follows a subtitle metadata reference once and applies response URL context', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const metadataUrl = 'https://example.com/api/videos/1.json';
    const subtitlesUrl = 'https://example.com/api/videos/1/subtitulos';
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === metadataUrl) return jsonResponse(url, { video: { subtitleRef: subtitlesUrl } });
        return jsonResponse(url, { page: { items: [{ src: '/captions/es.vtt', lang: 'es' }] } });
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch(metadataUrl);

        const expected = {
            subtitles: [
                {
                    label: 'es',
                    language: 'es',
                    url: 'https://example.com/captions/es.vtt',
                    extension: 'vtt',
                },
            ],
        };
        await expect(discovery.videoData(video)).resolves.toMatchObject(expected);
        await expect(discovery.videoData(video)).resolves.toMatchObject(expected);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('bounds subtitle metadata reference requests', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const metadataUrl = 'https://example.com/api/videos/1.json';
    const references = Array.from({ length: 5 }, (_, index) => ({
        subtitleRef: `https://example.com/api/subtitles/${index}`,
    }));
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        return jsonResponse(url, url === metadataUrl ? { references } : { page: { items: [] } });
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch(metadataUrl);
        await discovery.videoData(video);

        expect(fetchMock).toHaveBeenCalledTimes(5);
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('sniffs extensionless subtitle responses intercepted through fetch', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const response = {
        ok: true,
        status: 200,
        url: 'https://cdn.example/caption?id=1',
        headers: { get: () => 'text/plain' },
        clone() {
            return this;
        },
        text: async () => 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n',
    } as unknown as Response;
    const fetchMock = jest.fn(async () => response);
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch('https://cdn.example/caption?id=1');
        const data = await discovery.videoData(video);

        expect(data.subtitles).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    url: 'https://cdn.example/caption?id=1',
                    extension: 'vtt',
                }),
            ])
        );
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('trusts captured body structure over misleading subtitle URLs and MIME types', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const originalGetEntriesByType = Object.getOwnPropertyDescriptor(performance, 'getEntriesByType');
    const responses = new Map([
        ['https://cdn.example/empty.vtt', { contentType: 'text/vtt', text: '' }],
        ['https://cdn.example/error.vtt', { contentType: 'text/vtt', text: '<!doctype html><title>Error</title>' }],
        ['https://cdn.example/encrypted.vtt', { contentType: 'text/vtt', text: 'A'.repeat(128) }],
        [
            'https://cdn.example/captions.webvtt',
            {
                contentType: 'text/vtt',
                text: JSON.stringify({ subtitles: [{ src: '/real.vtt', language: 'en' }] }),
            },
        ],
    ]);
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        const resource = responses.get(url);
        if (resource === undefined) throw new Error(`Unexpected URL: ${url}`);
        return {
            ok: true,
            status: 200,
            url,
            headers: { get: () => resource.contentType },
            clone() {
                return this;
            },
            text: async () => resource.text,
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    Object.defineProperty(performance, 'getEntriesByType', {
        configurable: true,
        value: () =>
            Array.from(responses.keys(), (name) => ({
                name,
                entryType: 'resource',
                initiatorType: 'fetch',
            })) as PerformanceResourceTiming[],
    });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        for (const url of responses.keys()) await window.fetch(url);

        const data = await discovery.videoData(video);
        expect(data.subtitles).toEqual([
            expect.objectContaining({
                language: 'en',
                url: 'https://cdn.example/real.vtt',
                extension: 'vtt',
            }),
        ]);
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
        if (originalGetEntriesByType === undefined) Reflect.deleteProperty(performance, 'getEntriesByType');
        else Object.defineProperty(performance, 'getEntriesByType', originalGetEntriesByType);
    }
});

it('does not mistake a declared ASS subtitle with a late events section for JSON', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const url = 'https://cdn.example/long-styles.ass';
    const text = `[Script Info]\n${'Comment: style metadata\n'.repeat(1_000)}[Events]\nDialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,Hello`;
    Object.defineProperty(window, 'fetch', {
        configurable: true,
        writable: true,
        value: jest.fn(async () => {
            return {
                ok: true,
                status: 200,
                url,
                headers: { get: () => 'text/x-ass' },
                clone() {
                    return this;
                },
                text: async () => text,
            } as unknown as Response;
        }),
    });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch(url);
        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [expect.objectContaining({ url, extension: 'ass' })],
        });
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('filters storyboard WebVTT without rejecting mixed dialogue cues', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const storyboard = `WEBVTT

00:00:00.000 --> 00:00:01.000
sprite.jpg#xywh=0,0,100,100

00:00:01.000 --> 00:00:02.000
sprite.jpg#xywh=100,0,100,100
`;
    const dialogue = `WEBVTT

00:00:00.000 --> 00:00:01.000
See image.jpg#xywh=0,0,100,100

00:00:01.000 --> 00:00:02.000
Spoken dialogue
`;
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        return {
            ok: true,
            status: 200,
            url,
            headers: { get: () => 'text/vtt' },
            clone() {
                return this;
            },
            text: async () => (url.includes('storyboard') ? storyboard : dialogue),
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch('https://cdn.example/storyboard.vtt');
        await window.fetch('https://cdn.example/dialogue.vtt');

        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [expect.objectContaining({ url: 'https://cdn.example/dialogue.vtt' })],
        });
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('captures a MIME-mislabelled body only after metadata identifies its URL as a subtitle', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const identifiedUrl = 'https://media.example/resource?id=identified';
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        return {
            ok: true,
            status: 200,
            url,
            headers: { get: () => 'image/jpeg' },
            clone() {
                return this;
            },
            text: async () => 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n',
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch('https://media.example/resource?id=unknown');
        JSON.parse(
            JSON.stringify({
                captionTracks: [{ baseUrl: identifiedUrl, languageCodeName: 'en', fileName: 'English' }],
            })
        );
        await window.fetch(identifiedUrl);

        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [
                expect.objectContaining({
                    label: 'English',
                    language: 'en',
                    url: identifiedUrl,
                    extension: 'vtt',
                }),
            ],
        });
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('fetches and sniffs an extensionless source identified by sibling subtitle metadata', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const metadataUrl = 'https://example.com/playback.json';
    const subtitleUrl = 'https://cdn.example/subtitles/opaque-id';
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === metadataUrl) {
            return jsonResponse(url, {
                subtitles: [
                    {
                        product_subtitle_language_id: 3,
                        name: 'English',
                        language: 'en',
                        url: subtitleUrl,
                    },
                    { url: 'https://cdn.example/subtitles/insufficient-evidence' },
                ],
            });
        }
        return {
            ok: true,
            status: 200,
            url,
            headers: { get: () => 'text/plain' },
            body: null,
            text: async () => '\uFEFF1\n00:00:00,000 --> 00:00:01,000\nHello\n',
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch(metadataUrl);

        const expected = {
            subtitles: [
                {
                    label: 'English',
                    language: 'en',
                    url: subtitleUrl,
                    extension: 'srt',
                },
            ],
        };
        await expect(discovery.videoData(video)).resolves.toMatchObject(expected);
        await expect(discovery.videoData(video)).resolves.toMatchObject(expected);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('uses the newest body when the same intercepted resource is observed again', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const texts = ['not a subtitle', 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nNewest\n'];
    Object.defineProperty(window, 'fetch', {
        configurable: true,
        writable: true,
        value: jest.fn(async () => {
            const text = texts.shift()!;
            return {
                ok: true,
                status: 200,
                url: 'https://cdn.example/caption?id=repeat',
                headers: { get: () => 'text/plain' },
                clone() {
                    return this;
                },
                text: async () => text,
            } as unknown as Response;
        }),
    });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch('https://cdn.example/caption?id=repeat');
        await window.fetch('https://cdn.example/caption?id=repeat');

        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [
                expect.objectContaining({
                    url: 'https://cdn.example/caption?id=repeat',
                    extension: 'vtt',
                }),
            ],
        });
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('does not leak an unhandled rejection when an intercepted fetch fails', async () => {
    const originalFetch = window.fetch;
    const requestError = new Error('Network unavailable');
    Object.defineProperty(window, 'fetch', {
        configurable: true,
        writable: true,
        value: jest.fn(async () => {
            throw requestError;
        }),
    });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await expect(window.fetch('https://cdn.example/captions.vtt')).rejects.toBe(requestError);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('stops waiting for a stalled intercepted response body', async () => {
    jest.useFakeTimers();
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const cancel = jest.fn(async () => undefined);
    const clonedResponse = {
        ok: true,
        status: 200,
        url: 'https://cdn.example/captions?id=1',
        headers: { get: () => 'text/plain' },
        body: {
            getReader: () => ({
                read: () => new Promise<ReadableStreamReadResult<Uint8Array>>(() => undefined),
                cancel,
                releaseLock: jest.fn(),
            }),
        },
    } as unknown as Response;
    const response = {
        ...clonedResponse,
        clone: () => clonedResponse,
    };
    Object.defineProperty(window, 'fetch', {
        configurable: true,
        writable: true,
        value: jest.fn(async () => response),
    });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch(response.url);
        const dataPromise = discovery.videoData(video);
        await jest.advanceTimersByTimeAsync(500);

        await expect(dataPromise).resolves.toMatchObject({ subtitles: [] });
        expect(cancel).toHaveBeenCalledTimes(1);
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('sniffs extensionless subtitle responses intercepted through XMLHttpRequest', async () => {
    const originalXmlHttpRequest = Object.getOwnPropertyDescriptor(window, 'XMLHttpRequest');
    class FakeXmlHttpRequest extends EventTarget {
        response: unknown = null;
        responseText = '';
        responseType: XMLHttpRequestResponseType = '';
        status = 0;

        open(...args: unknown[]) {
            void args;
        }

        getResponseHeader(name: string) {
            return name.toLowerCase() === 'content-type' ? 'text/plain' : null;
        }
    }
    Object.defineProperty(window, 'XMLHttpRequest', { configurable: true, value: FakeXmlHttpRequest });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        const xhr = new FakeXmlHttpRequest();
        xhr.open('GET', 'https://cdn.example/caption?id=1');
        xhr.status = 200;
        xhr.responseText = 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n';
        xhr.dispatchEvent(new Event('loadend'));
        const video = document.createElement('video');
        document.body.append(video);

        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [{ url: 'https://cdn.example/caption?id=1', extension: 'vtt' }],
        });
    } finally {
        uninstall();
        if (originalXmlHttpRequest === undefined) Reflect.deleteProperty(window, 'XMLHttpRequest');
        else Object.defineProperty(window, 'XMLHttpRequest', originalXmlHttpRequest);
    }
});

it('discovers subtitles from JSON, array-buffer, and blob XMLHttpRequest responses', async () => {
    const originalXmlHttpRequest = Object.getOwnPropertyDescriptor(window, 'XMLHttpRequest');
    const originalTextDecoder = Object.getOwnPropertyDescriptor(globalThis, 'TextDecoder');
    Object.defineProperty(globalThis, 'TextDecoder', {
        configurable: true,
        value: class {
            decode(bytes: ArrayBuffer | ArrayBufferView) {
                const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer);
                return String.fromCharCode(...view);
            }
        },
    });
    class FakeXmlHttpRequest extends EventTarget {
        contentType = 'text/plain';
        response: any = null;
        responseText = '';
        responseType: XMLHttpRequestResponseType = '';
        status = 0;

        open(...args: unknown[]) {
            void args;
        }

        getResponseHeader(name: string) {
            return name.toLowerCase() === 'content-type' ? this.contentType : null;
        }
    }
    Object.defineProperty(window, 'XMLHttpRequest', { configurable: true, value: FakeXmlHttpRequest });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        const json = new FakeXmlHttpRequest();
        json.open('GET', 'https://cdn.example/caption-json?id=1');
        json.status = 200;
        json.contentType = 'application/problem+json; charset=utf-8';
        json.responseType = 'json';
        json.response = { subtitles: [{ src: '/captions/from-json.vtt', language: 'en' }] };
        json.dispatchEvent(new Event('loadend'));

        const arrayBuffer = new FakeXmlHttpRequest();
        arrayBuffer.open('GET', 'https://cdn.example/caption-array?id=1');
        arrayBuffer.status = 200;
        arrayBuffer.responseType = 'arraybuffer';
        arrayBuffer.response = new Uint8Array([87, 69, 66, 86, 84, 84, 10]).buffer;
        arrayBuffer.dispatchEvent(new Event('loadend'));

        const srt = '1\n00:00:00,000 --> 00:00:01,000\nHello\n';
        const blob = new FakeXmlHttpRequest();
        blob.open('GET', 'https://cdn.example/subtitle-blob?id=1');
        blob.status = 200;
        blob.responseType = 'blob';
        blob.response = { size: srt.length, text: async () => srt };
        blob.dispatchEvent(new Event('loadend'));

        await expect(discovery.videoData(document.createElement('video'))).resolves.toMatchObject({
            subtitles: expect.arrayContaining([
                expect.objectContaining({ url: 'https://cdn.example/captions/from-json.vtt', extension: 'vtt' }),
                expect.objectContaining({ url: 'https://cdn.example/caption-array?id=1', extension: 'vtt' }),
                expect.objectContaining({ url: 'https://cdn.example/subtitle-blob?id=1', extension: 'srt' }),
            ]),
        });
    } finally {
        uninstall();
        if (originalXmlHttpRequest === undefined) Reflect.deleteProperty(window, 'XMLHttpRequest');
        else Object.defineProperty(window, 'XMLHttpRequest', originalXmlHttpRequest);
        if (originalTextDecoder === undefined) Reflect.deleteProperty(globalThis, 'TextDecoder');
        else Object.defineProperty(globalThis, 'TextDecoder', originalTextDecoder);
    }
});

it('discovers HLS renditions without also exposing their segments as tracks', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const resources = new Map([
        [
            'https://cdn.example/master.m3u8',
            {
                contentType: 'application/vnd.apple.mpegurl',
                text: '#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="en.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1,SUBTITLES="subs"\nvideo.m3u8',
            },
        ],
        [
            'https://cdn.example/en.m3u8',
            {
                contentType: 'application/vnd.apple.mpegurl',
                text: '#EXTM3U\n#EXTINF:10,\nen-1.vtt\n#EXTINF:10,\nen-2.vtt\n#EXT-X-ENDLIST',
            },
        ],
        ['https://cdn.example/en-1.vtt', { contentType: 'text/vtt', text: 'WEBVTT\n' }],
    ]);
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        const resource = resources.get(url);
        if (resource === undefined) throw new Error(`Unexpected URL: ${url}`);
        const response = {
            ok: true,
            status: 200,
            url,
            headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? resource.contentType : null) },
            clone() {
                return { ...this };
            },
            text: async () => resource.text,
        } as unknown as Response;
        return response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch('https://cdn.example/master.m3u8');
        await window.fetch('https://cdn.example/en.m3u8');
        await window.fetch('https://cdn.example/en-1.vtt');

        const data = await discovery.videoData(video);
        expect(data.subtitles).toHaveLength(1);
        expect(data.subtitles?.[0]).toMatchObject({
            label: 'English',
            language: 'en',
            extension: 'vtt',
            url: ['https://cdn.example/en-1.vtt', 'https://cdn.example/en-2.vtt'],
        });
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('limits aggressive HLS discovery to ten subtitle renditions', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const renditions = Array.from({ length: 12 }, (_, index) => index);
    const masterManifest = `#EXTM3U
${renditions
    .map(
        (index) =>
            `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Language ${index}",LANGUAGE="l${index}",URI="sub-${index}.m3u8"`
    )
    .join('\n')}
#EXT-X-STREAM-INF:BANDWIDTH=1,SUBTITLES="subs"
video.m3u8`;
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        const match = /sub-(\d+)\.m3u8$/.exec(url);
        const text =
            url === 'https://cdn.example/master.m3u8'
                ? masterManifest
                : match === null
                  ? undefined
                  : `#EXTM3U\n#EXTINF:10,\nsub-${match[1]}.vtt\n#EXT-X-ENDLIST`;
        if (text === undefined) throw new Error(`Unexpected URL: ${url}`);
        return {
            ok: true,
            status: 200,
            url,
            headers: { get: () => 'application/vnd.apple.mpegurl' },
            clone() {
                return this;
            },
            text: async () => text,
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch('https://cdn.example/master.m3u8');
        const data = await discovery.videoData(video);

        expect(data.subtitles).toHaveLength(10);
        expect(fetchMock.mock.calls.map(([input]) => input.toString())).toEqual([
            'https://cdn.example/master.m3u8',
            ...renditions.slice(0, 10).map((index) => `https://cdn.example/sub-${index}.m3u8`),
        ]);
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('ranks a validated complete sidecar ahead of a segmented rendition', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const resources = new Map([
        [
            'https://cdn.example/master.m3u8',
            {
                contentType: 'application/vnd.apple.mpegurl',
                text: '#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="en.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1,SUBTITLES="subs"\nvideo.m3u8',
            },
        ],
        [
            'https://cdn.example/en.m3u8',
            {
                contentType: 'application/vnd.apple.mpegurl',
                text: '#EXTM3U\n#EXTINF:10,\nen-1.vtt\n#EXT-X-ENDLIST',
            },
        ],
        [
            'https://cdn.example/complete.srt',
            {
                contentType: 'application/x-subrip',
                text: '1\n00:00:00,000 --> 00:00:01,000\nHello\n',
            },
        ],
    ]);
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        const resource = resources.get(url);
        if (resource === undefined) throw new Error(`Unexpected URL: ${url}`);
        return {
            ok: true,
            status: 200,
            url,
            headers: { get: () => resource.contentType },
            clone() {
                return this;
            },
            text: async () => resource.text,
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch('https://cdn.example/master.m3u8');
        await window.fetch('https://cdn.example/en.m3u8');
        await window.fetch('https://cdn.example/complete.srt');

        const data = await discovery.videoData(video);
        expect(data.subtitles).toHaveLength(2);
        expect(data.subtitles?.map((track) => track.url)).toEqual([
            'https://cdn.example/complete.srt',
            ['https://cdn.example/en-1.vtt'],
        ]);
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('keeps HLS segment suppression after the parent manifest leaves the recent window', async () => {
    let now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const resources = new Map([
        [
            'https://cdn.example/master.m3u8',
            '#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="en.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1,SUBTITLES="subs"\nvideo.m3u8',
        ],
        ['https://cdn.example/en.m3u8', '#EXTM3U\n#EXTINF:10,\nen-1.vtt\n#EXT-X-ENDLIST'],
        ['https://cdn.example/en-1.vtt', 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n'],
    ]);
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        const text = resources.get(url);
        if (text === undefined) throw new Error(`Unexpected URL: ${url}`);
        return {
            ok: true,
            status: 200,
            url,
            headers: { get: () => (url.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'text/vtt') },
            clone() {
                return this;
            },
            text: async () => text,
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch('https://cdn.example/master.m3u8');
        await window.fetch('https://cdn.example/en.m3u8');
        await window.fetch('https://cdn.example/en-1.vtt');
        await discovery.videoData(video);

        now = 31_000;
        await window.fetch('https://cdn.example/en-1.vtt');

        await expect(discovery.videoData(video)).resolves.toMatchObject({ subtitles: [] });
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('loads an HLS manifest discovered through buffered performance entries', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const originalGetEntriesByType = Object.getOwnPropertyDescriptor(performance, 'getEntriesByType');
    const masterUrl = 'https://cdn.example/master.m3u8';
    const resources = new Map([
        [
            masterUrl,
            '#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="en.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1,SUBTITLES="subs"\nvideo.m3u8',
        ],
        ['https://cdn.example/en.m3u8', '#EXTM3U\n#EXTINF:10,\nen-1.vtt\n#EXT-X-ENDLIST'],
    ]);
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const text = resources.get(input.toString());
        if (text === undefined) throw new Error(`Unexpected URL: ${input.toString()}`);
        return {
            ok: true,
            status: 200,
            body: null,
            text: async () => text,
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    Object.defineProperty(performance, 'getEntriesByType', {
        configurable: true,
        value: jest.fn(() => [
            { name: masterUrl, entryType: 'resource', initiatorType: 'other' } as PerformanceResourceTiming,
        ]),
    });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [
                {
                    label: 'English',
                    language: 'en',
                    extension: 'vtt',
                    url: ['https://cdn.example/en-1.vtt'],
                },
            ],
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
        if (originalGetEntriesByType === undefined) Reflect.deleteProperty(performance, 'getEntriesByType');
        else Object.defineProperty(performance, 'getEntriesByType', originalGetEntriesByType);
    }
});

it('discovers extensionless DASH subtitles using representation MIME metadata', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const manifestUrl = 'https://cdn.example/media/playback?id=1';
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT10S">
  <Period duration="PT10S">
    <AdaptationSet contentType="text" mimeType="application/ttml+xml" lang="en">
      <Role schemeIdUri="urn:mpeg:dash:role:2011" value="subtitle"/>
      <Representation id="sub-en"><BaseURL>captions?id=en</BaseURL></Representation>
    </AdaptationSet>
  </Period>
</MPD>`;
    const response = {
        ok: true,
        status: 200,
        url: manifestUrl,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/dash+xml' : null) },
        clone() {
            return this;
        },
        text: async () => manifest,
    } as unknown as Response;
    Object.defineProperty(window, 'fetch', {
        configurable: true,
        writable: true,
        value: jest.fn(async () => response),
    });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch(manifestUrl);

        await expect(discovery.videoData(video)).resolves.toMatchObject({
            subtitles: [
                {
                    label: 'en',
                    language: 'en',
                    extension: 'ttml2',
                    url: ['https://cdn.example/media/captions?id=en'],
                },
            ],
        });
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('does not expose a DASH subtitle segment as a second standalone track', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const manifestUrl = 'https://cdn.example/media/manifest.mpd';
    const segmentUrl = 'https://cdn.example/media/captions.ttml';
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT10S">
  <Period duration="PT10S">
    <AdaptationSet contentType="text" mimeType="application/ttml+xml" lang="en">
      <Representation id="sub-en"><BaseURL>captions.ttml</BaseURL></Representation>
    </AdaptationSet>
  </Period>
</MPD>`;
    const ttml = '<tt xmlns="http://www.w3.org/ns/ttml"><body><p begin="0s" end="1s">Hello</p></body></tt>';
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        return {
            ok: true,
            status: 200,
            url,
            headers: { get: () => (url === manifestUrl ? 'application/dash+xml' : 'application/ttml+xml') },
            clone() {
                return this;
            },
            text: async () => (url === manifestUrl ? manifest : ttml),
        } as unknown as Response;
    });
    Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchMock });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        await window.fetch(manifestUrl);
        await window.fetch(segmentUrl);

        const data = await discovery.videoData(video);
        expect(data.subtitles).toHaveLength(1);
        expect(data.subtitles?.[0]).toMatchObject({
            language: 'en',
            url: [segmentUrl],
            extension: 'ttml2',
        });
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});

it('does not expose intercepted resources or JSON metadata from a previous navigation', async () => {
    const video = document.createElement('video');
    document.body.append(video);
    const originalFetch = window.fetch;
    const response = {
        ok: true,
        status: 200,
        url: 'https://cdn.example/old-caption.vtt',
        headers: { get: () => 'text/vtt' },
        clone() {
            return this;
        },
        text: async () => 'WEBVTT\n',
    } as unknown as Response;
    Object.defineProperty(window, 'fetch', {
        configurable: true,
        writable: true,
        value: jest.fn(async () => response),
    });
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstall = discovery.install();

    try {
        history.replaceState(null, '', '/first-video');
        await window.fetch(response.url);
        JSON.parse(JSON.stringify({ subtitles: [{ src: '/old-json.vtt', language: 'en' }] }));

        history.pushState(null, '', '/second-video');

        await expect(discovery.videoData(video)).resolves.toMatchObject({ subtitles: [] });
    } finally {
        uninstall();
        if (originalFetch === undefined) delete (window as { fetch?: typeof fetch }).fetch;
        else window.fetch = originalFetch;
    }
});
