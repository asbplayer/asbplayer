import { afterEach, expect, it, jest } from '@jest/globals';
import { AggressiveGenericPageDiscovery } from '@project/extension/src/pages/aggressive-generic-page';

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    document.body.replaceChildren();
    history.replaceState(null, '', '/');
});

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
