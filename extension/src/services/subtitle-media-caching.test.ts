/**
 * Integration tests documenting the subtitle media caching behavior.
 *
 * Feature: When mining the same subtitle multiple times, the audio and screenshot
 * are cached to avoid re-recording. The "Clear cached media" button allows users
 * to re-record and update the cache.
 */

import MediaCache from './media-cache';
import { AudioModel, ImageModel, SubtitleModel } from '@project/common';

describe('Subtitle Media Caching Integration', () => {
    let cache: MediaCache;
    const tabId = 123;
    const videoSrc = 'https://example.com/video.mp4';

    const createSubtitle = (start: number, end: number, text: string): SubtitleModel => ({
        text,
        start,
        end,
        originalStart: start,
        originalEnd: end,
        track: 0,
    });

    const createAudioModel = (label: string): AudioModel => ({
        base64: `audio-${label}`,
        extension: 'mp3',
        paddingStart: 0,
        paddingEnd: 0,
        start: 1000,
        end: 2000,
        playbackRate: 1,
    });

    const createImageModel = (label: string): ImageModel => ({
        base64: `image-${label}`,
        extension: 'jpeg',
    });

    beforeEach(() => {
        cache = new MediaCache();
    });

    describe('Initial mine behavior', () => {
        it('records fresh media for first mine of a subtitle', () => {
            const key = cache.key(tabId, videoSrc);
            const subtitle = createSubtitle(1000, 2000, 'Hello');

            // First mine: no cache exists
            expect(cache.get(key)).toBeUndefined();

            // After recording, media is cached
            const audio = createAudioModel('initial');
            const image = createImageModel('initial');

            cache.set(key, {
                subtitleStart: subtitle.start,
                subtitleEnd: subtitle.end,
                audioModel: audio,
                imageModel: image,
            });

            const cached = cache.get(key);
            expect(cached).toBeDefined();
            expect(cached?.audioModel?.base64).toBe('audio-initial');
            expect(cached?.imageModel?.base64).toBe('image-initial');
        });
    });

    describe('Repeated mine behavior', () => {
        it('reuses cached media when mining the same subtitle again', () => {
            const key = cache.key(tabId, videoSrc);
            const subtitle = createSubtitle(1000, 2000, 'Hello');

            // First mine: cache media
            const audio1 = createAudioModel('first-recording');
            const image1 = createImageModel('first-recording');
            cache.set(key, {
                subtitleStart: subtitle.start,
                subtitleEnd: subtitle.end,
                audioModel: audio1,
                imageModel: image1,
            });

            // Second mine of same subtitle: check cache first
            const cached = cache.get(key);
            const isSameSubtitle =
                cached !== undefined && cached.subtitleStart === subtitle.start && cached.subtitleEnd === subtitle.end;

            expect(isSameSubtitle).toBe(true);
            expect(cached?.audioModel?.base64).toBe('audio-first-recording');
            expect(cached?.imageModel?.base64).toBe('image-first-recording');
        });

        it('does not reuse cache for different subtitle', () => {
            const key = cache.key(tabId, videoSrc);

            // Cache first subtitle
            cache.set(key, {
                subtitleStart: 1000,
                subtitleEnd: 2000,
                audioModel: createAudioModel('first'),
                imageModel: createImageModel('first'),
            });

            // Mining a different subtitle (different timing)
            const differentSubtitle = createSubtitle(3000, 4000, 'World');
            const cached = cache.get(key);
            const isSameSubtitle =
                cached !== undefined &&
                cached.subtitleStart === differentSubtitle.start &&
                cached.subtitleEnd === differentSubtitle.end;

            expect(isSameSubtitle).toBe(false);
        });
    });

    describe('Clear cache behavior', () => {
        it('allows re-recording after cache is updated', () => {
            const key = cache.key(tabId, videoSrc);
            const subtitle = createSubtitle(1000, 2000, 'Hello');

            // Initial mine
            cache.set(key, {
                subtitleStart: subtitle.start,
                subtitleEnd: subtitle.end,
                audioModel: createAudioModel('initial'),
                imageModel: createImageModel('initial'),
            });

            // User presses "Clear cached media" button -> re-records
            // The re-record updates the cache with new media
            const newAudio = createAudioModel('re-recorded');
            const newImage = createImageModel('re-recorded');
            cache.set(key, {
                subtitleStart: subtitle.start,
                subtitleEnd: subtitle.end,
                audioModel: newAudio,
                imageModel: newImage,
            });

            // Next mine of same subtitle uses the updated cache
            const cached = cache.get(key);
            expect(cached?.audioModel?.base64).toBe('audio-re-recorded');
            expect(cached?.imageModel?.base64).toBe('image-re-recorded');
        });
    });

    describe('Multi-tab isolation', () => {
        it('maintains separate caches for same video in different tabs', () => {
            const tab1Key = cache.key(123, videoSrc);
            const tab2Key = cache.key(456, videoSrc);
            const subtitle = createSubtitle(1000, 2000, 'Hello');

            // Tab 1: mine and cache
            cache.set(tab1Key, {
                subtitleStart: subtitle.start,
                subtitleEnd: subtitle.end,
                audioModel: createAudioModel('tab1'),
            });

            // Tab 2: mine same subtitle, no cache exists
            expect(cache.get(tab2Key)).toBeUndefined();

            // Tab 2: mine and cache
            cache.set(tab2Key, {
                subtitleStart: subtitle.start,
                subtitleEnd: subtitle.end,
                audioModel: createAudioModel('tab2'),
            });

            // Both tabs have independent caches
            expect(cache.get(tab1Key)?.audioModel?.base64).toBe('audio-tab1');
            expect(cache.get(tab2Key)?.audioModel?.base64).toBe('audio-tab2');
        });

        it('maintains separate caches for different videos in same tab', () => {
            const video1Key = cache.key(tabId, 'https://example.com/video1.mp4');
            const video2Key = cache.key(tabId, 'https://example.com/video2.mp4');
            const subtitle = createSubtitle(1000, 2000, 'Hello');

            cache.set(video1Key, {
                subtitleStart: subtitle.start,
                subtitleEnd: subtitle.end,
                audioModel: createAudioModel('video1'),
            });

            cache.set(video2Key, {
                subtitleStart: subtitle.start,
                subtitleEnd: subtitle.end,
                audioModel: createAudioModel('video2'),
            });

            expect(cache.get(video1Key)?.audioModel?.base64).toBe('audio-video1');
            expect(cache.get(video2Key)?.audioModel?.base64).toBe('audio-video2');
        });
    });

    describe('Edge cases', () => {
        it('handles cache with only audio', () => {
            const key = cache.key(tabId, videoSrc);
            cache.set(key, {
                subtitleStart: 1000,
                subtitleEnd: 2000,
                audioModel: createAudioModel('audio-only'),
            });

            const cached = cache.get(key);
            expect(cached?.audioModel).toBeDefined();
            expect(cached?.imageModel).toBeUndefined();
        });

        it('handles cache with only image', () => {
            const key = cache.key(tabId, videoSrc);
            cache.set(key, {
                subtitleStart: 1000,
                subtitleEnd: 2000,
                imageModel: createImageModel('image-only'),
            });

            const cached = cache.get(key);
            expect(cached?.imageModel).toBeDefined();
            expect(cached?.audioModel).toBeUndefined();
        });

        it('handles empty cache record', () => {
            const key = cache.key(tabId, videoSrc);
            cache.set(key, {
                subtitleStart: 1000,
                subtitleEnd: 2000,
            });

            const cached = cache.get(key);
            expect(cached).toBeDefined();
            expect(cached?.audioModel).toBeUndefined();
            expect(cached?.imageModel).toBeUndefined();
            expect(cached?.subtitleStart).toBe(1000);
            expect(cached?.subtitleEnd).toBe(2000);
        });
    });
});
