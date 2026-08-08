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

it('ranks selector matches independently from auto-sync eligibility', () => {
    const page = new PageDelegate(
        {
            host: 'www\\.youtube\\.com',
            autoSync: { enabled: true },
            videoElementSelectorPreferences: ['#movie_player video', '.preferred-video'],
        },
        new URL('https://www.youtube.com/watch?v=video')
    );
    const player = document.createElement('div');
    player.id = 'movie_player';
    const preferredVideo = document.createElement('video');
    preferredVideo.src = 'blob:preferred';
    const secondaryVideo = document.createElement('video');
    secondaryVideo.className = 'preferred-video';
    secondaryVideo.src = 'blob:secondary';
    const fallbackVideo = document.createElement('video');
    fallbackVideo.src = 'blob:fallback';
    player.append(preferredVideo);
    document.body.append(player, secondaryVideo, fallbackVideo);

    expect(page.videoElementSelectorPreference(preferredVideo)).toBe(0);
    expect(page.videoElementSelectorPreference(secondaryVideo)).toBe(1);
    expect(page.videoElementSelectorPreference(fallbackVideo)).toBe(2);
    expect(page.canAutoSync(preferredVideo)).toBe(true);
    expect(page.canAutoSync(secondaryVideo)).toBe(true);
    expect(page.canAutoSync(fallbackVideo)).toBe(true);
});

it('preserves the existing auto-sync behavior when no selector preferences are configured', () => {
    const page = new PageDelegate(
        {
            host: 'example\\.com',
            autoSync: { enabled: true },
        },
        new URL('https://example.com/video')
    );
    const firstVideo = document.createElement('video');
    firstVideo.src = 'https://example.com/first.mp4';
    const secondVideo = document.createElement('video');
    secondVideo.src = 'https://example.com/second.mp4';
    document.body.append(firstVideo, secondVideo);

    expect(page.videoElementSelectorPreference(firstVideo)).toBe(0);
    expect(page.videoElementSelectorPreference(secondVideo)).toBe(0);
    expect(page.canAutoSync(firstVideo)).toBe(true);
    expect(page.canAutoSync(secondVideo)).toBe(true);
});
