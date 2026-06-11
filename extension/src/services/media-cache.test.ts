import MediaCache from './media-cache';
import { AudioModel, ImageModel } from '@project/common';

describe('MediaCache', () => {
    let cache: MediaCache;

    beforeEach(() => {
        cache = new MediaCache();
    });

    describe('key generation', () => {
        it('generates key from tabId and src', () => {
            const key = cache.key(123, 'https://example.com/video.mp4');
            expect(key).toBe('123:https://example.com/video.mp4');
        });

        it('generates different keys for different tabs', () => {
            const key1 = cache.key(123, 'https://example.com/video.mp4');
            const key2 = cache.key(456, 'https://example.com/video.mp4');
            expect(key1).not.toBe(key2);
        });

        it('generates different keys for different sources', () => {
            const key1 = cache.key(123, 'https://example.com/video1.mp4');
            const key2 = cache.key(123, 'https://example.com/video2.mp4');
            expect(key1).not.toBe(key2);
        });
    });

    describe('get and set', () => {
        it('returns undefined for non-existent key', () => {
            const result = cache.get('123:https://example.com/video.mp4');
            expect(result).toBeUndefined();
        });

        it('stores and retrieves audio model', () => {
            const key = cache.key(123, 'https://example.com/video.mp4');
            const audioModel: AudioModel = {
                base64: 'mockBase64Audio',
                extension: 'mp3',
                paddingStart: 0,
                paddingEnd: 0,
                start: 1000,
                end: 2000,
                playbackRate: 1,
            };

            cache.set(key, {
                subtitleStart: 1000,
                subtitleEnd: 2000,
                audioModel,
            });

            const result = cache.get(key);
            expect(result).toBeDefined();
            expect(result?.audioModel).toEqual(audioModel);
            expect(result?.subtitleStart).toBe(1000);
            expect(result?.subtitleEnd).toBe(2000);
        });

        it('stores and retrieves image model', () => {
            const key = cache.key(123, 'https://example.com/video.mp4');
            const imageModel: ImageModel = {
                base64: 'mockBase64Image',
                extension: 'jpeg',
            };

            cache.set(key, {
                subtitleStart: 1000,
                subtitleEnd: 2000,
                imageModel,
            });

            const result = cache.get(key);
            expect(result).toBeDefined();
            expect(result?.imageModel).toEqual(imageModel);
        });

        it('stores and retrieves both audio and image models', () => {
            const key = cache.key(123, 'https://example.com/video.mp4');
            const audioModel: AudioModel = {
                base64: 'mockBase64Audio',
                extension: 'mp3',
                paddingStart: 0,
                paddingEnd: 0,
                start: 1000,
                end: 2000,
                playbackRate: 1,
            };
            const imageModel: ImageModel = {
                base64: 'mockBase64Image',
                extension: 'jpeg',
            };

            cache.set(key, {
                subtitleStart: 1000,
                subtitleEnd: 2000,
                audioModel,
                imageModel,
            });

            const result = cache.get(key);
            expect(result).toBeDefined();
            expect(result?.audioModel).toEqual(audioModel);
            expect(result?.imageModel).toEqual(imageModel);
        });

        it('overwrites previous value for same key', () => {
            const key = cache.key(123, 'https://example.com/video.mp4');

            cache.set(key, {
                subtitleStart: 1000,
                subtitleEnd: 2000,
            });

            cache.set(key, {
                subtitleStart: 3000,
                subtitleEnd: 4000,
            });

            const result = cache.get(key);
            expect(result?.subtitleStart).toBe(3000);
            expect(result?.subtitleEnd).toBe(4000);
        });
    });

    describe('multiple tabs and sources', () => {
        it('isolates cache by tab and source', () => {
            const key1 = cache.key(123, 'https://example.com/video1.mp4');
            const key2 = cache.key(456, 'https://example.com/video2.mp4');

            cache.set(key1, {
                subtitleStart: 1000,
                subtitleEnd: 2000,
            });

            cache.set(key2, {
                subtitleStart: 3000,
                subtitleEnd: 4000,
            });

            const result1 = cache.get(key1);
            const result2 = cache.get(key2);

            expect(result1?.subtitleStart).toBe(1000);
            expect(result2?.subtitleStart).toBe(3000);
        });

        it('maintains separate caches for same video in different tabs', () => {
            const key1 = cache.key(123, 'https://example.com/video.mp4');
            const key2 = cache.key(456, 'https://example.com/video.mp4');

            const audioModel1: AudioModel = {
                base64: 'audio1',
                extension: 'mp3',
                paddingStart: 0,
                paddingEnd: 0,
                start: 1000,
                end: 2000,
                playbackRate: 1,
            };

            const audioModel2: AudioModel = {
                base64: 'audio2',
                extension: 'mp3',
                paddingStart: 0,
                paddingEnd: 0,
                start: 3000,
                end: 4000,
                playbackRate: 1,
            };

            cache.set(key1, {
                subtitleStart: 1000,
                subtitleEnd: 2000,
                audioModel: audioModel1,
            });

            cache.set(key2, {
                subtitleStart: 3000,
                subtitleEnd: 4000,
                audioModel: audioModel2,
            });

            expect(cache.get(key1)?.audioModel?.base64).toBe('audio1');
            expect(cache.get(key2)?.audioModel?.base64).toBe('audio2');
        });
    });

    describe('subtitle timing', () => {
        it('stores subtitle start and end times', () => {
            const key = cache.key(123, 'https://example.com/video.mp4');

            cache.set(key, {
                subtitleStart: 12345,
                subtitleEnd: 67890,
            });

            const result = cache.get(key);
            expect(result?.subtitleStart).toBe(12345);
            expect(result?.subtitleEnd).toBe(67890);
        });
    });
});
