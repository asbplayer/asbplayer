import { defaultSettings } from '@project/common/settings';
import pagesConfig from '../pages.json';
import { afterEach, beforeAll, expect, it } from '@jest/globals';

let PageDelegate: typeof import('./pages').PageDelegate;

beforeAll(async () => {
    const storage = {
        clear: async () => undefined,
        get: async () => ({}),
        remove: async () => undefined,
        set: async () => undefined,
    };
    Object.defineProperty(globalThis, 'browser', {
        configurable: true,
        value: { runtime: { getURL: (path: string) => path }, storage: { local: storage } },
    });
    Object.defineProperty(globalThis, 'chrome', {
        configurable: true,
        value: { runtime: { getURL: (path: string) => path } },
    });
    PageDelegate = (await import('./pages')).PageDelegate;
});

afterEach(() => {
    document.body.replaceChildren();
});

it('page settings and page configs are consistent', () => {
    for (const page of pagesConfig.pages) {
        expect(page.key in defaultSettings.streamingPages).toBe(true);
    }

    for (const key of Object.keys(defaultSettings.streamingPages)) {
        expect(pagesConfig.pages.find((p) => p.key === key) !== undefined).toBe(true);
    }
});

it('keeps nonmatching videos bindable but prevents them from auto-syncing', () => {
    const page = new PageDelegate(
        {
            host: 'www\\.youtube\\.com',
            videoElementSelector: '#movie_player video',
            autoSync: { enabled: true },
        },
        new URL('https://www.youtube.com/watch?v=video')
    );
    const player = document.createElement('div');
    player.id = 'movie_player';
    const playerVideo = document.createElement('video');
    const thumbnailVideo = document.createElement('video');
    player.append(playerVideo);
    document.body.append(player, thumbnailVideo);

    expect(page.shouldIgnore(playerVideo)).toBe(false);
    expect(page.shouldIgnore(thumbnailVideo)).toBe(false);
    expect(page.canAutoSync(playerVideo)).toBe(true);
    expect(page.canAutoSync(thumbnailVideo)).toBe(false);
});

it('sorts selector matches before nonmatching videos for manual selection', () => {
    const page = new PageDelegate(
        {
            host: 'www\\.youtube\\.com',
            videoElementSelector: '#movie_player video',
            autoSync: { enabled: true },
        },
        new URL('https://www.youtube.com/watch?v=video')
    );
    const player = document.createElement('div');
    player.id = 'movie_player';
    const playerVideo = document.createElement('video');
    const firstThumbnailVideo = document.createElement('video');
    const secondThumbnailVideo = document.createElement('video');
    player.append(playerVideo);
    document.body.append(firstThumbnailVideo, player, secondThumbnailVideo);

    const sorted = [firstThumbnailVideo, playerVideo, secondThumbnailVideo].sort(
        (a, b) => page.videoElementSelectorPreference(a) - page.videoElementSelectorPreference(b)
    );

    expect(sorted).toEqual([playerVideo, firstThumbnailVideo, secondThumbnailVideo]);
});

it('preserves auto-sync eligibility and ordering when no selector is configured', () => {
    const page = new PageDelegate(
        {
            host: 'example\\.com',
            autoSync: { enabled: true },
        },
        new URL('https://example.com/video')
    );
    const firstVideo = document.createElement('video');
    const secondVideo = document.createElement('video');

    expect(page.shouldIgnore(firstVideo)).toBe(false);
    expect(page.canAutoSync(firstVideo)).toBe(true);
    expect(page.canAutoSync(secondVideo)).toBe(true);
    expect(page.videoElementSelectorPreference(firstVideo)).toBe(0);
    expect(page.videoElementSelectorPreference(secondVideo)).toBe(0);
});
