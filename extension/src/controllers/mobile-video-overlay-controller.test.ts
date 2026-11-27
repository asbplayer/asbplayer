import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MobileVideoOverlayController } from '@project/extension/src/controllers/mobile-video-overlay-controller';
import { OffsetAnchor, overlayOffsetAnchor } from '@project/extension/src/services/element-overlay';
import type Binding from '@project/extension/src/services/binding';

describe('overlayOffsetAnchor', () => {
    it('resolves auto based on subtitleAlignment and maps explicit edges directly', () => {
        expect(overlayOffsetAnchor('auto', 'bottom')).toBe(OffsetAnchor.top);
        expect(overlayOffsetAnchor('auto', 'top')).toBe(OffsetAnchor.bottom);
        expect(overlayOffsetAnchor('top', 'top')).toBe(OffsetAnchor.top);
        expect(overlayOffsetAnchor('bottom', 'bottom')).toBe(OffsetAnchor.bottom);
        expect(overlayOffsetAnchor('left', 'bottom')).toBe(OffsetAnchor.left);
        expect(overlayOffsetAnchor('right', 'top')).toBe(OffsetAnchor.right);
    });
});

describe('MobileVideoOverlayController', () => {
    const runtimeListeners = new Set<(message: any, sender: any, sendResponse: (response?: any) => void) => void>();
    const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');

    beforeEach(() => {
        runtimeListeners.clear();
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
        (globalThis as any).browser = {
            runtime: {
                getURL: (path: string) => `extension://${path}`,
                sendMessage: jest.fn(),
                onMessage: {
                    addListener: (listener: (message: any, sender: any, sendResponse: () => void) => void) =>
                        runtimeListeners.add(listener),
                    removeListener: (listener: (message: any, sender: any, sendResponse: () => void) => void) =>
                        runtimeListeners.delete(listener),
                },
            },
        };
    });

    afterEach(() => {
        document.body.replaceChildren();
        delete (globalThis as any).browser;
        if (originalInnerWidth) Object.defineProperty(window, 'innerWidth', originalInnerWidth);
        else delete (window as unknown as { innerWidth?: number }).innerWidth;
        if (originalInnerHeight) Object.defineProperty(window, 'innerHeight', originalInnerHeight);
        else delete (window as unknown as { innerHeight?: number }).innerHeight;
    });

    const createContext = () => {
        const video = document.createElement('video');
        Object.defineProperty(video, 'paused', { configurable: true, value: true });
        video.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 }) as DOMRect;
        document.body.appendChild(video);

        return {
            video,
            registeredVideoSrc: 'https://example.com/video.mp4',
            synced: true,
            recordingMedia: false,
            recordMedia: true,
            currentTimeMs: 0,
            subtitleController: {
                subtitles: [],
                currentSubtitle: () => [null],
            },
            settings: {
                get: async () => ({
                    language: 'en',
                    clickToMineDefaultAction: 0,
                    themeType: 'dark',
                    streamingDisplaySubtitles: true,
                    seekableTracks: 1,
                }),
            },
            togglePlayMode: jest.fn(),
        } as unknown as Binding;
    };

    const sendOverlayMessage = (src: string, command: string) => {
        for (const listener of runtimeListeners) {
            listener(
                {
                    sender: 'asbplayer-mobile-overlay-to-video',
                    src,
                    message: { command },
                },
                {},
                () => {}
            );
        }
    };

    it.each([
        [OffsetAnchor.top, 'top', '410px', '108px'],
        [OffsetAnchor.bottom, 'bottom', '410px', '108px'],
        [OffsetAnchor.left, 'left', '180px', '410px'],
        [OffsetAnchor.right, 'right', '180px', '410px'],
    ])(
        'renders the expected container class, iframe anchor, and dimensions for %s',
        (offsetAnchor, expectedAnchor, expectedWidth, expectedHeight) => {
            const context = createContext();
            const controller = new MobileVideoOverlayController(context, offsetAnchor);
            controller.enabled = true;

            const container = document.querySelector<HTMLElement>(
                `.asbplayer-mobile-video-overlay-container-${expectedAnchor}`
            );
            const iframe = container?.querySelector('iframe');
            expect(container).not.toBeNull();
            expect(iframe).not.toBeNull();
            expect(new URL(iframe!.src).searchParams.get('anchor')).toBe(expectedAnchor);
            expect(iframe!.style.width).toBe(expectedWidth);
            expect(iframe!.style.height).toBe(expectedHeight);

            controller.unbind();
        }
    );

    it('switches anchor classes and iframe parameters when offsetAnchor changes while shown', () => {
        const context = createContext();
        const controller = new MobileVideoOverlayController(context, OffsetAnchor.top);
        controller.enabled = true;

        expect(document.querySelector('.asbplayer-mobile-video-overlay-container-top')).not.toBeNull();

        controller.offsetAnchor = OffsetAnchor.right;

        expect(document.querySelector('.asbplayer-mobile-video-overlay-container-top')).toBeNull();
        const rightContainer = document.querySelector('.asbplayer-mobile-video-overlay-container-right');
        const iframe = rightContainer?.querySelector('iframe');
        expect(rightContainer).not.toBeNull();
        expect(new URL(iframe!.src).searchParams.get('anchor')).toBe('right');
        expect(iframe!.style.width).toBe('180px');
        expect(iframe!.style.height).toBe('410px');

        controller.unbind();
    });

    it('expands vertical overlay iframe width while play mode selector is open and restores on close or hide', () => {
        const context = createContext();
        const controller = new MobileVideoOverlayController(context, OffsetAnchor.left);
        controller.enabled = true;

        const iframe = () =>
            document.querySelector<HTMLIFrameElement>('.asbplayer-mobile-video-overlay-container-left iframe');

        expect(iframe()?.style.width).toBe('180px');

        sendOverlayMessage(context.registeredVideoSrc, 'playback-mode-selector-opened');
        expect(iframe()?.style.width).toBe('340px');

        sendOverlayMessage(context.registeredVideoSrc, 'playback-mode-selector-closed');
        expect(iframe()?.style.width).toBe('180px');

        sendOverlayMessage(context.registeredVideoSrc, 'playback-mode-selector-opened');
        expect(iframe()?.style.width).toBe('340px');

        controller.hide();
        controller.show();
        expect(iframe()?.style.width).toBe('180px');

        controller.unbind();
    });
});
