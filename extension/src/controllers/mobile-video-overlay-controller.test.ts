import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PlayMode } from '@project/common';
import { MobileVideoOverlayController } from './mobile-video-overlay-controller';
import { OffsetAnchor } from '../services/element-overlay';
import type Binding from '../services/binding';

describe('MobileVideoOverlayController playback mode requests', () => {
    const runtimeListeners = new Set<(message: any, sender: any, sendResponse: (response?: any) => void) => void>();

    beforeEach(() => {
        runtimeListeners.clear();
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
        document.documentElement.style.removeProperty('color-scheme');
        delete (globalThis as any).browser;
    });

    const createController = (paused: boolean, offsetAnchor = OffsetAnchor.bottom, videoHeight = 450) => {
        const video = document.createElement('video');
        Object.defineProperty(video, 'paused', { configurable: true, value: paused });
        video.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 800,
            height: videoHeight,
            right: 800,
            bottom: videoHeight,
            x: 0,
            y: 0,
            toJSON() {},
        });
        document.body.appendChild(video);
        const context = {
            video,
            synced: true,
            registeredVideoSrc: 'video-src',
            recordingMedia: false,
            recordMedia: true,
            playModes: new Set([PlayMode.normal]),
        } as unknown as Binding;
        return new MobileVideoOverlayController(context, offsetAnchor);
    };

    const selectorClosed = () => {
        for (const listener of runtimeListeners) {
            listener(
                {
                    sender: 'asbplayer-mobile-overlay-to-video',
                    src: 'video-src',
                    message: { command: 'playback-mode-selector-closed' },
                },
                {},
                () => {}
            );
        }
    };

    const selectorOpened = () => {
        for (const listener of runtimeListeners) {
            listener(
                {
                    sender: 'asbplayer-mobile-overlay-to-video',
                    src: 'video-src',
                    message: { command: 'playback-mode-selector-opened' },
                },
                {},
                () => {}
            );
        }
    };

    it('renders a wide selector host until the temporary selector reports that it closed', () => {
        const controller = createController(false);

        controller.showPlaybackModes();

        const iframe = document.querySelector('iframe');
        expect(iframe).not.toBeNull();
        expect(iframe?.getAttribute('allowtransparency')).toBe('true');
        expect(iframe?.style.colorScheme).toBe('normal');
        expect(iframe?.style.width).toBe('1000px');
        const topContainer = document.querySelector<HTMLElement>('.asbplayer-mobile-video-overlay-container-top');
        expect(topContainer).not.toBeNull();
        expect(topContainer?.style.top).toBe('8px');
        expect(document.querySelector('.asbplayer-mobile-video-overlay-container-bottom')).toBeNull();
        expect(runtimeListeners.size).toBe(1);

        selectorClosed();

        expect(document.querySelector('iframe')).toBeNull();
        expect(runtimeListeners.size).toBe(0);
    });

    it('refreshes an already visible temporary selector without replacing its host', () => {
        const controller = createController(false);
        controller.showPlaybackModes();
        const firstIframe = document.querySelector<HTMLIFrameElement>('iframe');

        controller.showPlaybackModes();

        expect(document.querySelector<HTMLIFrameElement>('iframe')).toBe(firstIframe);
        selectorClosed();
        controller.unbind();
    });

    it('does not show a temporary selector when the button-opened selector is active', () => {
        const controller = createController(true);
        controller.enabled = true;
        selectorOpened();

        controller.showPlaybackModes();

        expect(document.querySelector<HTMLIFrameElement>('iframe')?.style.width).toBe('410px');
        expect(document.querySelector('.asbplayer-mobile-video-overlay-container-bottom')).not.toBeNull();
        expect(document.querySelector('.asbplayer-mobile-video-overlay-container-top')).toBeNull();

        selectorClosed();
        controller.unbind();
    });

    it('uses a dark color scheme set by page CSS', () => {
        document.documentElement.style.colorScheme = 'dark';
        const controller = createController(false);

        controller.showPlaybackModes();

        const iframe = document.querySelector<HTMLIFrameElement>('iframe');
        expect(iframe?.classList.contains('asbplayer-color-scheme-dark')).toBe(true);
        expect(iframe?.style.colorScheme).toBe('dark');
        expect(iframe?.src).toContain('colorScheme=dark');
        controller.unbind();
    });

    it('leaves the persistent overlay visible after the temporary selector closes while paused', () => {
        const controller = createController(true);
        controller.enabled = true;
        expect(document.querySelector('.asbplayer-mobile-video-overlay-container-bottom')).not.toBeNull();
        expect(document.querySelector<HTMLIFrameElement>('iframe')?.style.width).toBe('410px');

        controller.showPlaybackModes();
        expect(document.querySelector('.asbplayer-mobile-video-overlay-container-top')).not.toBeNull();
        expect(document.querySelector('.asbplayer-mobile-video-overlay-container-bottom')).toBeNull();
        selectorClosed();

        expect(document.querySelector('iframe')).not.toBeNull();
        expect(document.querySelector<HTMLIFrameElement>('iframe')?.style.width).toBe('410px');
        expect(document.querySelector('.asbplayer-mobile-video-overlay-container-top')).toBeNull();
        expect(document.querySelector('.asbplayer-mobile-video-overlay-container-bottom')).not.toBeNull();
        expect(runtimeListeners.size).toBe(1);
        controller.unbind();
    });

    it('assigns a new instance id when replacing the persistent overlay iframe', () => {
        const controller = createController(true);
        controller.enabled = true;
        const firstIframe = document.querySelector<HTMLIFrameElement>('iframe');
        const firstInstanceId = new URL(firstIframe!.src).searchParams.get('overlayId');

        controller.showPlaybackModes();

        const selectorIframe = document.querySelector<HTMLIFrameElement>('iframe');
        const selectorInstanceId = new URL(selectorIframe!.src).searchParams.get('overlayId');
        expect(firstInstanceId).not.toBeNull();
        expect(selectorInstanceId).not.toBe(firstInstanceId);
        controller.unbind();
    });

    it('restores the persistent overlay width when its configured anchor is already at the top', () => {
        const controller = createController(true, OffsetAnchor.top);
        controller.enabled = true;

        controller.showPlaybackModes();
        expect(document.querySelector<HTMLIFrameElement>('iframe')?.style.width).toBe('1000px');
        selectorClosed();

        expect(document.querySelector<HTMLIFrameElement>('iframe')?.style.width).toBe('410px');
        expect(document.querySelector('.asbplayer-mobile-video-overlay-container-top')).not.toBeNull();
        controller.unbind();
    });

    it('provides enough height for a selector below the controls on a small video', () => {
        const controller = createController(true, OffsetAnchor.top, 200);
        controller.enabled = true;
        expect(document.querySelector<HTMLIFrameElement>('iframe')?.style.height).toBe('64px');

        controller.showPlaybackModes();

        expect(document.querySelector<HTMLIFrameElement>('iframe')?.style.height).toBe('128px');
        controller.unbind();
    });

    it('shows a remembered-mode request after a paused persistent overlay is released from force hiding', () => {
        const controller = createController(true, OffsetAnchor.top);
        controller.enabled = true;
        controller.forceHide = true;

        controller.showPlaybackModes();
        expect(document.querySelector('iframe')).toBeNull();

        controller.forceHide = false;
        expect(document.querySelector<HTMLIFrameElement>('iframe')?.style.width).toBe('1000px');
        expect(document.querySelector<HTMLIFrameElement>('iframe')?.style.height).toBe('128px');
        controller.unbind();
    });
});
