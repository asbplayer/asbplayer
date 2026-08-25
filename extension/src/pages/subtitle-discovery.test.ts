import type { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { afterEach, expect, it, jest } from '@jest/globals';
import {
    absoluteHttpUrl,
    absoluteSubtitleUrl,
    basenameForVideo,
    bindVideoDataDiscovery,
    deduplicateTracks,
    isJsonContentType,
    normalizedContentType,
    responseTextWithinLimit,
    tracksFromJson,
} from '@project/extension/src/pages/subtitle-discovery';

function appendVideo() {
    const video = document.createElement('video');
    document.body.appendChild(video);
    return video;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    document.body.replaceChildren();
    document.head.querySelectorAll('meta[property="og:title"]').forEach((element) => element.remove());
    document.title = '';
    history.replaceState(null, '', '/');
});

it('normalizes JSON MIME types and restricts resolved URLs to supported protocols', () => {
    expect(normalizedContentType(' Application/Problem+JSON ; charset=utf-8')).toBe('application/problem+json');
    expect(isJsonContentType(' Application/Problem+JSON ; charset=utf-8')).toBe(true);
    expect(isJsonContentType('text/json')).toBe(false);
    expect(absoluteSubtitleUrl('../captions/en.vtt', 'https://example.com/video/watch')).toBe(
        'https://example.com/captions/en.vtt'
    );
    expect(absoluteSubtitleUrl('data:text/vtt,WEBVTT', 'https://example.com/video')).toBe('data:text/vtt,WEBVTT');
    expect(absoluteSubtitleUrl('javascript:alert(1)', 'https://example.com/video')).toBeUndefined();
    expect(absoluteSubtitleUrl('https://[invalid', 'https://example.com/video')).toBeUndefined();
    expect(absoluteHttpUrl('blob:https://example.com/id', 'https://example.com/video')).toBeUndefined();
    expect(absoluteHttpUrl('https://[invalid', 'https://example.com/video')).toBeUndefined();
});

it('honors JSON traversal depth and object-count limits', () => {
    const nested = { player: { tracks: [{ kind: 'captions', src: '/deep.vtt' }] } };
    expect(tracksFromJson(nested, 'http://localhost/', { maximumDepth: 1 }).tracks).toEqual([]);
    expect(tracksFromJson(nested, 'http://localhost/', { maximumDepth: 3 }).tracks).toMatchObject([
        { url: 'http://localhost/deep.vtt' },
    ]);

    const siblings = {
        first: { irrelevant: true },
        second: { kind: 'captions', src: '/later.vtt' },
    };
    expect(tracksFromJson(siblings, 'http://localhost/', { maximumObjects: 2 }).tracks).toEqual([]);
    expect(tracksFromJson(siblings, 'http://localhost/', { maximumObjects: 3 }).tracks).toMatchObject([
        { url: 'http://localhost/later.vtt' },
    ]);
});

it('discovers contextual string tracks but keeps strict discovery unambiguous', () => {
    const metadata = { subtitles: { English: '/captions/en.vtt', ignored: '/video.mp4' } };

    expect(tracksFromJson(metadata, 'http://localhost/').tracks).toEqual([]);
    expect(tracksFromJson(metadata, 'http://localhost/', { contextual: true }).tracks).toMatchObject([
        { label: 'English', url: 'http://localhost/captions/en.vtt', extension: 'vtt' },
    ]);
});

it('inherits subtitle metadata through namespaced JSON-serialized XML', () => {
    const metadata = {
        MPD: [
            {
                Period: [
                    {
                        SupplementalProperty: [
                            {
                                'nvod:SubtitleSet': [
                                    {
                                        '@type': 'text/vtt',
                                        'nvod:Subtitle': [
                                            {
                                                '@lang': 'ko',
                                                'nvod:Source': [
                                                    {
                                                        '@type': 'string',
                                                        '#text': 'https://cdn.example.com/captions/korean',
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    };

    expect(
        tracksFromJson(metadata, 'https://example.com/watch', {
            contextual: true,
            maximumDepth: 12,
        }).tracks
    ).toMatchObject([
        {
            label: 'ko',
            language: 'ko',
            url: 'https://cdn.example.com/captions/korean',
            extension: 'vtt',
        },
    ]);
});

it('uses response provenance as root subtitle context', () => {
    const metadata = { page: { items: [{ src: '/resources/spanish.vtt', lang: 'es' }] } };

    expect(tracksFromJson(metadata, 'https://example.com/api/subtitles', { contextual: true }).tracks).toEqual([]);
    expect(
        tracksFromJson(metadata, 'https://example.com/api/subtitles', {
            contextual: true,
            rootSubtitleContext: true,
        }).tracks
    ).toMatchObject([
        {
            label: 'es',
            language: 'es',
            url: 'https://example.com/resources/spanish.vtt',
            extension: 'vtt',
        },
    ]);
});

it('returns only strongly identified subtitle metadata references', () => {
    const discovery = tracksFromJson(
        {
            subtitleRef: '/api/video/1/subtitles',
            imageRef: '/api/video/1/images',
            hasSubtitles: 'true',
            captionUrl: 'javascript:alert(1)',
        },
        'https://example.com/watch',
        { contextual: true }
    );

    expect([...discovery.metadataUrls]).toEqual(['https://example.com/api/video/1/subtitles']);
});

it('retains extensionless sources only when their own subtitle record has explicit track metadata', () => {
    const discovery = tracksFromJson(
        {
            subtitles: [
                {
                    second_subtitle_position: 0,
                    product_subtitle_language_id: 3,
                    name: 'English',
                    language: 'en',
                    url: 'https://cdn.example/subtitles/opaque-id',
                },
                { url: 'https://cdn.example/subtitles/insufficient-evidence' },
                { subtitle_language_id: 4, url: 'https://cdn.example/video/movie.mp4' },
                { subtitle_language_id: 5, type: 'video/mp4', url: 'https://cdn.example/video/opaque-id' },
            ],
        },
        'https://example.com/watch',
        { contextual: true }
    );

    expect(discovery.extensionlessTracks).toEqual([
        {
            label: 'English',
            language: 'en',
            url: 'https://cdn.example/subtitles/opaque-id',
        },
    ]);
});

it('bounds both buffered and streaming response bodies', async () => {
    const bufferedResponse = (text: string) => ({ body: null, text: async () => text }) as unknown as Response;

    await expect(responseTextWithinLimit(bufferedResponse('1234'), 4)).resolves.toBe('1234');
    await expect(responseTextWithinLimit(bufferedResponse('12345'), 4)).resolves.toBeUndefined();

    const cancel = jest.fn(async () => undefined);
    const releaseLock = jest.fn();
    const read = jest
        .fn<() => Promise<ReadableStreamReadResult<Uint8Array>>>()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([4, 5, 6]) });
    const streamingResponse = {
        body: { getReader: () => ({ read, cancel, releaseLock }) },
    } as unknown as Response;

    await expect(responseTextWithinLimit(streamingResponse, 5)).resolves.toBeUndefined();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledTimes(1);
});

it('assembles a streaming response exactly at the size limit', async () => {
    const originalTextDecoder = Object.getOwnPropertyDescriptor(globalThis, 'TextDecoder');
    Object.defineProperty(globalThis, 'TextDecoder', {
        configurable: true,
        value: class {
            decode(bytes: Uint8Array) {
                return String.fromCharCode(...bytes);
            }
        },
    });
    const releaseLock = jest.fn();
    const read = jest
        .fn<() => Promise<ReadableStreamReadResult<Uint8Array>>>()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([104, 101, 108]) })
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([108, 111]) })
        .mockResolvedValueOnce({ done: true, value: undefined });
    const response = {
        body: { getReader: () => ({ read, cancel: jest.fn(), releaseLock }) },
    } as unknown as Response;

    try {
        await expect(responseTextWithinLimit(response, 5)).resolves.toBe('hello');
        expect(releaseLock).toHaveBeenCalledTimes(1);
    } finally {
        if (originalTextDecoder === undefined) Reflect.deleteProperty(globalThis, 'TextDecoder');
        else Object.defineProperty(globalThis, 'TextDecoder', originalTextDecoder);
    }
});

it('times out a buffered response body', async () => {
    jest.useFakeTimers();
    const response = {
        body: null,
        text: () => new Promise<string>(() => undefined),
    } as unknown as Response;

    const result = responseTextWithinLimit(response, 5, 100);
    await jest.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toBeUndefined();
});

it('deduplicates scalar and segmented resources while retaining the first track', () => {
    const tracks = [
        { id: 'first', label: 'First', extension: 'vtt', url: '/same.vtt' },
        { id: 'duplicate', label: 'Duplicate', extension: 'vtt', url: '/same.vtt' },
        { id: 'segments', label: 'Segments', extension: 'vtt', url: ['/1.vtt', '/2.vtt'] },
        { id: 'segments-copy', label: 'Segments copy', extension: 'vtt', url: ['/1.vtt', '/2.vtt'] },
        { id: 'file-only', label: 'File only', extension: 'vtt' },
    ] satisfies VideoDataSubtitleTrack[];

    expect(deduplicateTracks(tracks).map((track) => track.id)).toEqual(['first', 'segments']);
});

it('uses basename metadata in its documented fallback order', () => {
    const video = appendVideo();
    const openGraphTitle = document.createElement('meta');
    openGraphTitle.setAttribute('property', 'og:title');
    openGraphTitle.content = 'Open Graph';
    document.head.appendChild(openGraphTitle);
    document.title = 'Document';

    video.title = 'Element title';
    video.setAttribute('aria-label', 'ARIA label');
    expect(basenameForVideo(video)).toBe('Element title');

    video.removeAttribute('title');
    expect(basenameForVideo(video)).toBe('ARIA label');

    video.removeAttribute('aria-label');
    expect(basenameForVideo(video)).toBe('Open Graph');

    openGraphTitle.remove();
    expect(basenameForVideo(video)).toBe('Document');
});

it('binds discovery requests to the video that emitted the event', async () => {
    const video = appendVideo();
    const calls: HTMLVideoElement[] = [];
    const videoData = async (requestedVideo: HTMLVideoElement): Promise<VideoData> => {
        calls.push(requestedVideo);
        return {
            error: '',
            basename: 'Bound video',
            subtitles: [],
        };
    };
    const listener = jest.fn();
    video.addEventListener('asbplayer-synced-data', listener);
    const unbind = bindVideoDataDiscovery({ videoData });

    video.dispatchEvent(new CustomEvent('asbplayer-get-synced-data', { bubbles: true, composed: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(video);
    expect((listener.mock.calls[0][0] as CustomEvent<VideoData>).detail.basename).toBe('Bound video');
    unbind();
});

it('publishes only the newest overlapping request for a video', async () => {
    const video = appendVideo();
    const first = deferred<VideoData>();
    const second = deferred<VideoData>();
    const videoData = jest
        .fn<(video: HTMLVideoElement) => Promise<VideoData>>()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
    const received: VideoData[] = [];
    video.addEventListener('asbplayer-synced-data', (event) => received.push((event as CustomEvent<VideoData>).detail));
    const unbind = bindVideoDataDiscovery({ videoData });

    video.dispatchEvent(new CustomEvent('asbplayer-get-synced-data', { bubbles: true, composed: true }));
    video.dispatchEvent(new CustomEvent('asbplayer-get-synced-data', { bubbles: true, composed: true }));
    second.resolve({ basename: 'Newest', subtitles: [] });
    await Promise.resolve();
    first.resolve({ basename: 'Stale', subtitles: [] });
    await Promise.resolve();
    await Promise.resolve();

    expect(received.map((data) => data.basename)).toEqual(['Newest']);
    unbind();
});

it('publishes fallback data when discovery rejects', async () => {
    const video = appendVideo();
    document.title = 'Fallback title';
    const received = new Promise<VideoData>((resolve) => {
        video.addEventListener('asbplayer-synced-data', (event) => resolve((event as CustomEvent<VideoData>).detail), {
            once: true,
        });
    });
    const unbind = bindVideoDataDiscovery({ videoData: async () => Promise.reject(new Error('Discovery failed')) });

    video.dispatchEvent(new CustomEvent('asbplayer-get-synced-data', { bubbles: true, composed: true }));

    await expect(received).resolves.toEqual({
        error: '',
        basename: 'Fallback title',
        subtitles: [],
    });
    unbind();
});

it('suppresses pending results after navigation and stops handling events after unbinding', async () => {
    const video = appendVideo();
    const request = deferred<VideoData>();
    const videoData = jest.fn(() => request.promise);
    const listener = jest.fn();
    video.addEventListener('asbplayer-synced-data', listener);
    const unbind = bindVideoDataDiscovery({ videoData });

    video.dispatchEvent(new CustomEvent('asbplayer-get-synced-data', { bubbles: true, composed: true }));
    history.pushState(null, '', '/another-page');
    request.resolve({ basename: 'Previous page', subtitles: [] });
    await Promise.resolve();
    await Promise.resolve();

    expect(listener).not.toHaveBeenCalled();
    unbind();
    video.dispatchEvent(new CustomEvent('asbplayer-get-synced-data', { bubbles: true, composed: true }));
    expect(videoData).toHaveBeenCalledTimes(1);
});
