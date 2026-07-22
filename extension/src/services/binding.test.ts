import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AutoPausePreference, PlayMode, type IndexedSubtitleModel } from '@project/common';
import Binding from './binding';
import { MockStorageArea } from './mock-storage-area';

let mockPlaybackModeOverlayShows = 0;

jest.mock('@project/common/subtitle-reader', () => ({
    SubtitleReader: class SubtitleReader {},
}));
jest.mock('./localization-fetcher', () => ({
    fetchLocalization: jest.fn(async () => ({})),
}));
jest.mock('./i18n', () => ({
    i18nInit: jest.fn(async () => undefined),
}));
jest.mock('./build-flags', () => ({
    isFirefoxBuild: false,
}));
jest.mock('../controllers/anki-ui-controller', () => ({
    __esModule: true,
    default: class AnkiUiController {
        updateSettings() {}
    },
}));
jest.mock('../controllers/controls-controller', () => ({
    __esModule: true,
    default: class ControlsController {},
}));
jest.mock('../controllers/drag-controller', () => ({
    __esModule: true,
    default: class DragController {
        bind() {}
        unbind() {}
    },
}));
jest.mock('../controllers/mobile-gesture-controller', () => ({
    MobileGestureController: class MobileGestureController {
        bind() {}
        unbind() {}
    },
}));
jest.mock('../controllers/mobile-video-overlay-controller', () => ({
    MobileVideoOverlayController: class MobileVideoOverlayController {
        bind() {}
        unbind() {}
        setPlaybackModes() {}
        show() {}
        showPlaybackModes() {
            mockPlaybackModeOverlayShows++;
        }
        async updateModel() {}
    },
}));
jest.mock('../controllers/notification-controller', () => ({
    __esModule: true,
    default: class NotificationController {
        unbind() {}
    },
}));
jest.mock('../controllers/bulk-export-controller', () => ({
    __esModule: true,
    default: class BulkExportController {
        bind() {}
        unbind() {}
    },
}));
jest.mock('../controllers/video-data-sync-controller', () => ({
    __esModule: true,
    default: class VideoDataSyncController {
        pickerVisible = false;
        openedLocation = undefined;
        async requestSubtitles() {}
        updateSettings() {}
        unbind() {}
    },
}));
jest.mock('./key-bindings', () => ({
    __esModule: true,
    default: class KeyBindings {
        setKeyBindSet() {}
        unbind() {}
    },
}));

const makeSubtitle = (overrides: Partial<IndexedSubtitleModel> = {}): IndexedSubtitleModel => {
    const start = overrides.start ?? 0;
    const end = overrides.end ?? 1000;
    return {
        text: 'subtitle',
        start,
        end,
        originalStart: start,
        originalEnd: end,
        track: 0,
        index: 0,
        ...overrides,
    };
};

describe('Binding playback mode integration', () => {
    const runtimeListeners = new Set<(request: any, sender: any, sendResponse: (response?: any) => void) => void>();
    let storage: MockStorageArea;

    type FrameTestVideo = HTMLVideoElement & { presentFrame(timestampMs: number): void };

    const createVideo = (): FrameTestVideo => {
        const video = document.createElement('video') as FrameTestVideo;
        let nextFrameHandle = 1;
        const frameCallbacks = new Map<number, VideoFrameRequestCallback>();
        video.src = 'https://example.com/video.mp4';
        Object.defineProperties(video, {
            readyState: { configurable: true, value: 4 },
            duration: { configurable: true, value: 120 },
            paused: { configurable: true, value: false, writable: true },
            requestVideoFrameCallback: {
                configurable: true,
                value: (callback: VideoFrameRequestCallback) => {
                    const handle = nextFrameHandle++;
                    frameCallbacks.set(handle, callback);
                    return handle;
                },
            },
            cancelVideoFrameCallback: {
                configurable: true,
                value: (handle: number) => frameCallbacks.delete(handle),
            },
            presentFrame: {
                configurable: true,
                value: (timestampMs: number) => {
                    video.currentTime = timestampMs / 1000;
                    const callbacks = [...frameCallbacks.values()];
                    frameCallbacks.clear();
                    for (const callback of callbacks) {
                        callback(0, {
                            presentationTime: 0,
                            expectedDisplayTime: 0,
                            width: 0,
                            height: 0,
                            mediaTime: video.currentTime,
                            presentedFrames: 1,
                            processingDuration: 0,
                        });
                    }
                },
            },
        });
        return video;
    };

    const flushPlaybackTiming = async () => {
        await jest.advanceTimersByTimeAsync(0);
    };

    const sendSubtitles = (binding: Binding, subtitles: IndexedSubtitleModel[]) => {
        const request = {
            sender: 'asbplayer-extension-to-video',
            src: binding.registeredVideoSrc,
            message: {
                command: 'subtitles',
                value: subtitles,
                name: 'subtitles.srt',
            },
        };
        for (const listener of runtimeListeners) listener(request, {}, () => undefined);
    };

    const sendPlaybackRate = (binding: Binding, value: number) => {
        const request = {
            sender: 'asbplayer-extension-to-video',
            src: binding.registeredVideoSrc,
            message: { command: 'playbackRate', value },
        };
        for (const listener of runtimeListeners) listener(request, {}, () => undefined);
    };

    const displayedSubtitleTexts = () =>
        Array.from(document.querySelectorAll('.asbplayer-subtitles span[data-track]')).map(
            (element) => element.textContent?.trim() ?? ''
        );

    beforeEach(() => {
        jest.useFakeTimers();
        runtimeListeners.clear();
        mockPlaybackModeOverlayShows = 0;
        storage = new MockStorageArea();
        (globalThis as any).browser = {
            storage: { local: storage },
            runtime: {
                getURL: (path: string) => `moz-extension://test${path}`,
                sendMessage: jest.fn(async () => undefined),
                onMessage: {
                    addListener: (listener: (request: any, sender: any, sendResponse: () => void) => void) =>
                        runtimeListeners.add(listener),
                    removeListener: (listener: (request: any, sender: any, sendResponse: () => void) => void) =>
                        runtimeListeners.delete(listener),
                },
            },
        };
    });

    afterEach(() => {
        jest.useRealTimers();
        delete (globalThis as any).browser;
        document.body.replaceChildren();
    });

    it('applies playback modes through real video timing without overwriting the inactive rate', async () => {
        const video = createVideo();
        const binding = new Binding(video, false);
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);
        sendSubtitles(binding, [
            makeSubtitle({ start: 0, end: 200 }),
            makeSubtitle({ start: 3000, end: 4000, originalStart: 3000, originalEnd: 4000, index: 1 }),
        ]);
        video.currentTime = 1.5;
        video.playbackRate = 1.5;

        await jest.advanceTimersByTimeAsync(100);
        expect(video.playbackRate).toBe(1.5);

        binding.togglePlayMode(PlayMode.fastForward);
        video.presentFrame(1500);
        await flushPlaybackTiming();
        expect(video.playbackRate).toBe(2.7);

        binding.togglePlayMode(PlayMode.normal);
        expect(video.playbackRate).toBe(1.5);
        video.playbackRate = 1.5;
        await jest.advanceTimersByTimeAsync(100);
        expect(video.playbackRate).toBe(1.5);

        binding.unbind();
    });

    it('publishes compiled subtitle visibility changes from presented video frames', async () => {
        const video = createVideo();
        const binding = new Binding(video, false);
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);
        sendSubtitles(binding, [makeSubtitle({ start: 1000, end: 2000 })]);
        await jest.advanceTimersByTimeAsync(1000);

        video.presentFrame(1000);
        await flushPlaybackTiming();
        expect(displayedSubtitleTexts()).toContain('subtitle');

        video.presentFrame(2000);
        await flushPlaybackTiming();
        expect(binding.subtitleController.currentSubtitle()[0]).toBeNull();

        binding.unbind();
    });

    it('reconciles subtitle visibility on a user seek without firing auto-pause actions', async () => {
        await storage.set({ autoPausePreference: AutoPausePreference.atStartAndEnd });
        const video = createVideo();
        const binding = new Binding(video, false);
        const pause = jest.spyOn(binding, 'pause').mockImplementation(() => {});
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);
        const subtitle = makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000 });
        sendSubtitles(binding, [subtitle]);
        await jest.advanceTimersByTimeAsync(1000);
        binding.togglePlayMode(PlayMode.autoPause);

        video.dispatchEvent(new Event('seeking'));
        video.currentTime = 4;
        video.dispatchEvent(new Event('seeked'));
        await flushPlaybackTiming();
        video.presentFrame(4100);
        await flushPlaybackTiming();

        expect(displayedSubtitleTexts()).toContain('subtitle');
        expect(pause).not.toHaveBeenCalled();
        binding.unbind();
    });

    it('shifts visible subtitle state immediately when the offset changes while paused', async () => {
        const video = createVideo();
        const binding = new Binding(video, false);
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);
        sendSubtitles(binding, [makeSubtitle({ start: 1000, end: 2000, originalStart: 1000, originalEnd: 2000 })]);
        await jest.advanceTimersByTimeAsync(1000);
        video.presentFrame(1500);
        await flushPlaybackTiming();
        expect(displayedSubtitleTexts()).toContain('subtitle');

        Object.defineProperty(video, 'paused', { configurable: true, value: true });
        binding.subtitleController.offset(1000);
        await flushPlaybackTiming();

        expect(binding.subtitleController.currentSubtitle()[0]).toBeNull();
        binding.unbind();
    });

    it('applies separate signed playback mode offsets to auto-pause through real video timing', async () => {
        await storage.set({
            autoPausePreference: AutoPausePreference.atStartAndEnd,
            playbackModeStartOffset: -250,
            playbackModeEndOffset: 400,
        });
        const video = createVideo();
        const binding = new Binding(video, false);
        const pause = jest.spyOn(binding, 'pause').mockImplementation(() => {});
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);
        sendSubtitles(binding, [makeSubtitle({ start: 1000, end: 2000 })]);
        binding.togglePlayMode(PlayMode.autoPause);

        video.presentFrame(750);
        await flushPlaybackTiming();
        expect(pause).toHaveBeenCalledTimes(1);

        video.presentFrame(2400);
        await flushPlaybackTiming();
        expect(pause).toHaveBeenCalledTimes(2);

        binding.unbind();
    });

    it('uses playback mode offsets for repeat without auto-pause', async () => {
        await storage.set({
            playbackModeStartOffset: -250,
            playbackModeEndOffset: 400,
            repeatCountPreference: 1,
        });
        const video = createVideo();
        const binding = new Binding(video, false);
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);
        sendSubtitles(binding, [makeSubtitle({ start: 1000, end: 2000 })]);
        binding.togglePlayMode(PlayMode.repeat);

        video.presentFrame(2398);
        await flushPlaybackTiming();
        expect(video.currentTime).toBe(2.398);

        video.presentFrame(2399);
        await flushPlaybackTiming();
        expect(video.currentTime).toBe(0.75);

        binding.unbind();
    });

    it('routes playback-engine seeks through the Netflix page adapter', async () => {
        document.dispatchEvent(new CustomEvent('asbplayer-netflix-enabled', { detail: true }));
        const netflixSeeks: number[] = [];
        const onNetflixSeek = (event: Event) => netflixSeeks.push((event as CustomEvent<number>).detail);
        document.addEventListener('asbplayer-netflix-seek', onNetflixSeek);
        const video = createVideo();
        const binding = new Binding(video, false);

        try {
            binding.bind();
            await jest.advanceTimersByTimeAsync(0);
            sendSubtitles(binding, [makeSubtitle({ start: 1000, end: 2000, originalStart: 1000, originalEnd: 2000 })]);
            binding.togglePlayMode(PlayMode.repeat);

            video.presentFrame(1999);
            await flushPlaybackTiming();

            expect(netflixSeeks).toEqual([1000]);
            expect(video.currentTime).toBe(1.999);
        } finally {
            binding.unbind();
            document.removeEventListener('asbplayer-netflix-seek', onNetflixSeek);
            document.dispatchEvent(new CustomEvent('asbplayer-netflix-enabled', { detail: false }));
        }
    });

    it('uses configurable condensed gaps without applying playback mode offsets', async () => {
        await storage.set({
            playbackModeStartOffset: -250,
            playbackModeEndOffset: 400,
            playbackModesStartGap: -250,
            playbackModesEndGap: 400,
        });
        const video = createVideo();
        const binding = new Binding(video, false);
        const play = jest.spyOn(binding, 'play').mockResolvedValue(undefined);
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);
        sendSubtitles(binding, [
            makeSubtitle(),
            makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 }),
        ]);
        binding.togglePlayMode(PlayMode.condensed);

        video.presentFrame(1500);
        await flushPlaybackTiming();
        video.dispatchEvent(new Event('seeked')); // jsdom does not emit the native seeked event when currentTime is assigned.
        await flushPlaybackTiming();

        expect(video.currentTime).toBe(3.749);
        expect(play).toHaveBeenCalledTimes(1);
        binding.unbind();
    });

    it('uses normal playback while recording', async () => {
        const video = createVideo();
        const binding = new Binding(video, false);
        const pause = jest.spyOn(binding, 'pause').mockImplementation(() => {});
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);
        sendSubtitles(binding, [
            makeSubtitle(),
            makeSubtitle({ start: 4000, end: 5000, originalStart: 4000, originalEnd: 5000, index: 1 }),
        ]);
        for (const listener of runtimeListeners) {
            listener(
                {
                    sender: 'asbplayer-extension-to-video',
                    src: binding.registeredVideoSrc,
                    message: { command: 'recording-started' },
                },
                {},
                () => undefined
            );
        }
        binding.togglePlayMode(PlayMode.autoPause);
        binding.togglePlayMode(PlayMode.condensed);
        binding.togglePlayMode(PlayMode.fastForward);
        binding.togglePlayMode(PlayMode.repeat);

        video.presentFrame(1100);
        await flushPlaybackTiming();

        expect(pause).not.toHaveBeenCalled();
        expect(video.currentTime).toBe(1.1);
        expect(video.playbackRate).toBe(1);

        video.presentFrame(2100);
        await flushPlaybackTiming();

        expect(pause).not.toHaveBeenCalled();
        expect(video.currentTime).toBe(2.1);
        binding.unbind();
    });

    it('keeps unseekable subtitles visible without applying auto-pause or condensed playback', async () => {
        await storage.set({
            autoPausePreference: AutoPausePreference.atStartAndEnd,
            seekableTracks: 1,
        });
        const video = createVideo();
        const binding = new Binding(video, false);
        const pause = jest.spyOn(binding, 'pause').mockImplementation(() => {});
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);
        const first = makeSubtitle({ start: 1000, end: 2000, track: 1 });
        const second = makeSubtitle({
            start: 4000,
            end: 5000,
            originalStart: 3000,
            originalEnd: 4000,
            track: 1,
            index: 1,
        });
        sendSubtitles(binding, [first, second]);
        await jest.advanceTimersByTimeAsync(1000);
        binding.togglePlayMode(PlayMode.autoPause);
        binding.togglePlayMode(PlayMode.condensed);

        video.presentFrame(1100);
        await flushPlaybackTiming();
        expect(displayedSubtitleTexts()).toContain('subtitle');

        video.presentFrame(2100);
        await flushPlaybackTiming();

        expect(pause).not.toHaveBeenCalled();
        expect(video.currentTime).toBe(2.1);
        binding.unbind();
    });

    it('keeps active modes for non-empty subtitles and resets them when subtitles are cleared', async () => {
        const video = createVideo();
        const binding = new Binding(video, false);
        binding.bind();
        binding.togglePlayMode(PlayMode.fastForward);

        sendSubtitles(binding, [makeSubtitle({ start: 1000, end: 2000 })]);
        video.presentFrame(0);
        await flushPlaybackTiming();
        expect(video.playbackRate).toBe(2.7);

        sendSubtitles(binding, []);
        sendSubtitles(binding, [makeSubtitle({ start: 1000, end: 2000 })]);
        video.presentFrame(0);
        await flushPlaybackTiming();
        expect(video.playbackRate).toBe(1);

        await Promise.resolve();
        binding.unbind();
    });

    it('restores enabled modes when settings load and resets them when subtitles clear', async () => {
        await storage.set({
            rememberPlaybackModes: true,
            lastPlaybackModes: [PlayMode.fastForward, PlayMode.repeat],
        });
        const binding = new Binding(createVideo(), false);
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);

        expect(mockPlaybackModeOverlayShows).toBe(1);

        sendSubtitles(binding, []);
        expect(mockPlaybackModeOverlayShows).toBe(2);

        sendSubtitles(binding, [makeSubtitle()]);
        expect(mockPlaybackModeOverlayShows).toBe(2);

        sendSubtitles(binding, [makeSubtitle()]);
        expect(mockPlaybackModeOverlayShows).toBe(2);

        sendSubtitles(binding, []);
        expect(mockPlaybackModeOverlayShows).toBe(2);

        binding.unbind();
    });

    it('does not show the playback mode overlay when the remembered selection has no enabled modes', async () => {
        await storage.set({
            rememberPlaybackModes: true,
            lastPlaybackModes: [PlayMode.normal],
        });
        const binding = new Binding(createVideo(), false);
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);

        sendSubtitles(binding, [makeSubtitle()]);

        expect(mockPlaybackModeOverlayShows).toBe(0);
        binding.unbind();
    });

    it.each([
        { rememberPlaybackModes: false, name: 'disabled' },
        { rememberPlaybackModes: true, name: 'enabled' },
    ])(
        'uses the configured playback rate inside subtitles during fast-forward when mode remembering is $name',
        async ({ rememberPlaybackModes }) => {
            await storage.set({
                playbackRate: 1.4,
                playbackModeStartOffset: 200,
                playbackModeEndOffset: -200,
                playbackModesStartGap: -200,
                playbackModesEndGap: 200,
                fastForwardPlaybackMinimumSkipIntervalMs: 0,
                rememberPlaybackModes,
                lastPlaybackModes: [PlayMode.fastForward],
            });
            const video = createVideo();
            const binding = new Binding(video, false);

            binding.bind();
            await jest.advanceTimersByTimeAsync(0);
            sendSubtitles(binding, [makeSubtitle({ start: 1000, end: 2000 })]);
            if (!rememberPlaybackModes) binding.togglePlayMode(PlayMode.fastForward);

            video.presentFrame(750);
            await flushPlaybackTiming();
            expect(video.playbackRate).toBe(2.7);

            video.presentFrame(800);
            await flushPlaybackTiming();
            expect(video.playbackRate).toBe(1.4);

            video.presentFrame(1500);
            await flushPlaybackTiming();
            expect(video.playbackRate).toBe(1.4);

            video.presentFrame(1900);
            await flushPlaybackTiming();
            expect(video.playbackRate).toBe(1.4);

            video.presentFrame(2000);
            await flushPlaybackTiming();
            expect(video.playbackRate).toBe(1.4);

            video.presentFrame(2200);
            await flushPlaybackTiming();
            expect(video.playbackRate).toBe(2.7);
            binding.unbind();
        }
    );

    it('applies the latest incoming playback rate', async () => {
        const video = createVideo();
        const binding = new Binding(video, false);
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);

        sendPlaybackRate(binding, 1);
        sendPlaybackRate(binding, 1.5);
        sendPlaybackRate(binding, 1.5);

        expect(video.playbackRate).toBe(1.5);
        binding.unbind();
    });

    it.each([
        { enabled: true, expectedNotifications: 1, name: 'enabled' },
        { enabled: false, expectedNotifications: 0, name: 'disabled' },
    ])('honors the playback-rate notification setting when $name', async ({ enabled, expectedNotifications }) => {
        await storage.set({ playbackRateNotificationEnabled: enabled });
        const video = createVideo();
        const binding = new Binding(video, false);
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);
        sendSubtitles(binding, [makeSubtitle()]);
        const notification = jest.spyOn(binding.subtitleController, 'notification').mockImplementation(() => {});

        Object.defineProperty(video, 'playbackRate', { configurable: true, value: 1.3, writable: true });
        video.dispatchEvent(new Event('ratechange'));

        expect(notification).toHaveBeenCalledTimes(expectedNotifications);
        binding.unbind();
    });

    it('notifies once when a keybind changes the playback rate', async () => {
        await storage.set({ playbackRateNotificationEnabled: true });
        const video = createVideo();
        const binding = new Binding(video, false);
        binding.bind();
        await jest.advanceTimersByTimeAsync(0);
        sendSubtitles(binding, [makeSubtitle()]);
        const notification = jest.spyOn(binding.subtitleController, 'notification').mockImplementation(() => {});

        binding.adjustPlaybackRate(0.1);
        video.dispatchEvent(new Event('ratechange'));

        expect(notification).toHaveBeenCalledTimes(1);
        expect(notification).toHaveBeenCalledWith({
            locKey: 'info.playbackRate',
            replacements: { rate: '1.1' },
        });
        binding.unbind();
    });

    it('applies the configured playback rate after settings load', async () => {
        await storage.set({ playbackRate: 1.4 });
        const video = createVideo();
        const binding = new Binding(video, false);

        binding.bind();
        await jest.advanceTimersByTimeAsync(0);

        expect(video.playbackRate).toBe(1.4);
        sendSubtitles(binding, [makeSubtitle()]);
        expect(video.playbackRate).toBe(1.4);
        binding.unbind();
    });

    it.each([
        { rememberPlaybackRate: false, name: 'disabled' },
        { rememberPlaybackRate: true, name: 'enabled' },
    ])(
        'keeps the loaded playback rate setting after a video rate change when remembering is $name',
        async ({ rememberPlaybackRate }) => {
            await storage.set({ playbackRate: 1.1, rememberPlaybackRate });
            const video = createVideo();
            const binding = new Binding(video, false);
            binding.bind();
            await jest.advanceTimersByTimeAsync(0);

            video.playbackRate = 1.3;
            video.dispatchEvent(new Event('ratechange'));
            await flushPlaybackTiming();

            expect(await storage.get('playbackRate')).toEqual({ playbackRate: 1.1 });
            binding.unbind();
        }
    );
});
