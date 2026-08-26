import { defaultSettings } from '@project/common/settings';
import pagesConfig from '@project/extension/src/pages.json';
import { afterEach, beforeAll, expect, it } from '@jest/globals';
import type {
    PageDelegate as PageDelegateClass,
    pageDelegateForUrl as PageDelegateForUrlFunction,
} from '@project/extension/src/services/pages';

let PageDelegate: typeof PageDelegateClass;
let pageDelegateForUrl: typeof PageDelegateForUrlFunction;

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
    const pages = await import('@project/extension/src/services/pages');
    PageDelegate = pages.PageDelegate;
    pageDelegateForUrl = pages.pageDelegateForUrl;
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

it('uses an explicit integration instead of the generic fallback', () => {
    const youtube = pagesConfig.pages.find((page) => page.key === 'youtube')!;
    const page = pageDelegateForUrl(pagesConfig.pages, new URL('https://www.youtube.com/watch?v=video'), {
        tutorial: false,
        genericSubtitleParser: 'off',
    });

    expect(page.config).toMatchObject(youtube);
    expect(page.config.generic).not.toBe(true);
});

it('uses the tutorial integration instead of the generic fallback', () => {
    const page = pageDelegateForUrl(pagesConfig.pages, new URL('https://example.com/tutorial'), {
        tutorial: true,
        genericSubtitleParser: 'off',
    });

    expect(page.config.pageScript).toBe('asbplayer-tutorial-page.js');
    expect(page.config.generic).not.toBe(true);
});

it('does not use generic subtitle detection by default on an unsupported page', () => {
    const page = pageDelegateForUrl(pagesConfig.pages, new URL('https://unsupported.example/video'), {
        tutorial: false,
        genericSubtitleParser: 'off',
    });
    const video = document.createElement('video');

    expect(page.config.pageScript).toBeUndefined();
    expect(page.config.generic).not.toBe(true);
    expect(page.isVideoPage()).toBe(true);
    expect(page.canAutoSync(video)).toBe(false);
});

it('does not add generic discovery to configured pages by default', () => {
    const twitch = pageDelegateForUrl(pagesConfig.pages, new URL('https://www.twitch.tv/example'), {
        tutorial: false,
        genericSubtitleParser: 'off',
    });
    const archive = pageDelegateForUrl(pagesConfig.pages, new URL('https://archive.org/details/example'), {
        tutorial: false,
        genericSubtitleParser: 'off',
    });

    expect(twitch.config).toMatchObject({
        key: 'twitch',
        allowVideoElementsWithBlankSrc: true,
    });
    expect(twitch.config.pageScript).toBeUndefined();
    expect(twitch.config.generic).not.toBe(true);
    expect(archive.config).toMatchObject({
        key: 'archive',
        searchShadowRootsForVideoElements: true,
    });
    expect(archive.config.pageScript).toBeUndefined();
    expect(archive.config.generic).not.toBe(true);
});

it('uses non-autosyncing generic discovery when enabled for an unsupported site', () => {
    const page = pageDelegateForUrl(pagesConfig.pages, new URL('https://unsupported.example/video'), {
        tutorial: false,
        genericSubtitleParser: 'base',
    });

    expect(page.config).toMatchObject({
        pageScript: 'base-generic-page.js',
        generic: true,
        refreshSubtitleDataOnPickerOpen: true,
        searchShadowRootsForVideoElements: false,
        autoSync: { enabled: false },
    });
});

it('prefers a configured page shadow-root option over the generic discovery mode', () => {
    const archive = pageDelegateForUrl(pagesConfig.pages, new URL('https://archive.org/details/example'), {
        tutorial: false,
        genericSubtitleParser: 'base',
    });
    const explicitlyDisabled = pageDelegateForUrl(
        [{ host: 'example\\.com', searchShadowRootsForVideoElements: false }],
        new URL('https://example.com/video'),
        {
            tutorial: false,
            genericSubtitleParser: 'aggressive',
        }
    );

    expect(archive.config).toMatchObject({
        key: 'archive',
        pageScript: 'base-generic-page.js',
        searchShadowRootsForVideoElements: true,
    });
    expect(explicitlyDisabled.config).toMatchObject({
        pageScript: 'aggressive-generic-page.js',
        searchShadowRootsForVideoElements: false,
    });
});

it('uses an explicit integration even when generic discovery is enabled for its host', () => {
    const page = pageDelegateForUrl(pagesConfig.pages, new URL('https://www.youtube.com/watch?v=video'), {
        tutorial: false,
        genericSubtitleParser: 'base',
    });

    expect(page.config).toMatchObject(pagesConfig.pages.find((page) => page.key === 'youtube')!);
    expect(page.config.generic).not.toBe(true);
});

it('uses aggressive discovery and searches shadow roots in aggressive mode', () => {
    const page = pageDelegateForUrl(pagesConfig.pages, new URL('https://unsupported.example/video'), {
        tutorial: false,
        genericSubtitleParser: 'aggressive',
    });

    expect(page.config).toMatchObject({
        pageScript: 'aggressive-generic-page.js',
        generic: true,
        refreshSubtitleDataOnPickerOpen: true,
        searchShadowRootsForVideoElements: true,
        autoSync: { enabled: false },
    });
});

it('does not activate generic discovery when parsing is off', () => {
    const page = pageDelegateForUrl(pagesConfig.pages, new URL('https://unsupported.example/video'), {
        tutorial: false,
        genericSubtitleParser: 'off',
    });

    expect(page.config.pageScript).toBeUndefined();
    expect(page.config.searchShadowRootsForVideoElements).toBeUndefined();
});

it('keeps nonmatching videos bindable but prevents them from auto-syncing', () => {
    const page = new PageDelegate(
        {
            host: 'www\\.youtube\\.com',
            preferredVideoElementSelector: '#movie_player video',
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

it('sorts preferred videos before nonmatching videos for manual selection', () => {
    const page = new PageDelegate(
        {
            host: 'www\\.youtube\\.com',
            preferredVideoElementSelector: '#movie_player video',
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
        (a, b) => page.videoElementPreference(a) - page.videoElementPreference(b)
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
    expect(page.videoElementPreference(firstVideo)).toBe(0);
    expect(page.videoElementPreference(secondVideo)).toBe(0);
});
