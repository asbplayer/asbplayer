import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { CachingElementOverlay, OffsetAnchor } from '@project/extension/src/services/element-overlay';

describe('CachingElementOverlay fullscreen transitions', () => {
    let fullscreenElement: Element | null;

    beforeEach(() => {
        fullscreenElement = null;
        Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            get: () => fullscreenElement,
        });
    });

    afterEach(() => {
        document.body.replaceChildren();
        delete (document as unknown as { fullscreenElement?: Element | null }).fullscreenElement;
        delete (document as unknown as { elementFromPoint?: typeof document.elementFromPoint }).elementFromPoint;
    });

    it('updates the class of every subtitle when moving into and out of fullscreen', () => {
        const targetElement = document.createElement('video');
        const overlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'non-fullscreen-container',
            nonFullscreenContentClassName: 'non-fullscreen-content',
            fullscreenContainerClassName: 'fullscreen-container',
            fullscreenContentClassName: 'fullscreen-content',
            offsetAnchor: OffsetAnchor.bottom,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });

        overlay.setHtml([
            { key: 'one', html: () => '<span>one</span>' },
            { key: 'two', html: () => '<span>two</span>' },
        ]);
        const nonFullscreenElements = [...document.querySelectorAll('.non-fullscreen-container > div')];
        expect(nonFullscreenElements).toHaveLength(2);
        expect(nonFullscreenElements.every((element) => element.className === 'non-fullscreen-content')).toBe(true);

        fullscreenElement = document.documentElement;
        document.dispatchEvent(new Event('fullscreenchange'));

        const fullscreenElements = [...document.querySelectorAll('.fullscreen-container > div')];
        expect(fullscreenElements).toHaveLength(2);
        expect(fullscreenElements.every((element) => element.className === 'fullscreen-content')).toBe(true);

        fullscreenElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));

        const returnedElements = [...document.querySelectorAll('.non-fullscreen-container > div')];
        expect(returnedElements).toHaveLength(2);
        expect(returnedElements.every((element) => element.className === 'non-fullscreen-content')).toBe(true);

        overlay.dispose();
    });

    it('does not apply subtitle content classes to structural line breaks during transitions', () => {
        const targetElement = document.createElement('video');
        const overlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'non-fullscreen-container',
            nonFullscreenContentClassName: 'non-fullscreen-content',
            fullscreenContainerClassName: 'fullscreen-container',
            fullscreenContentClassName: 'fullscreen-content',
            offsetAnchor: OffsetAnchor.bottom,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });

        overlay.setHtml([{ key: 'subtitle', html: () => '<span>subtitle</span>' }]);
        overlay.appendHtml('<span>offset</span>');

        const lineBreak = document.querySelector('.non-fullscreen-container > br');
        expect(lineBreak?.className).toBe('');

        fullscreenElement = document.documentElement;
        document.dispatchEvent(new Event('fullscreenchange'));

        expect(document.querySelector('.fullscreen-container > br')).toBe(lineBreak);
        expect(lineBreak?.className).toBe('');
        expect(
            [...document.querySelectorAll('.fullscreen-container > div')].every(
                (element) => element.className === 'fullscreen-content'
            )
        ).toBe(true);

        fullscreenElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));

        expect(document.querySelector('.non-fullscreen-container > br')).toBe(lineBreak);
        expect(lineBreak?.className).toBe('');

        overlay.dispose();
    });

    it('positions the destination immediately in its fullscreen parent coordinate space', () => {
        const fullscreenRoot = document.createElement('div');
        const videoParent = document.createElement('div');
        const targetElement = document.createElement('video');
        fullscreenRoot.appendChild(videoParent);
        videoParent.appendChild(targetElement);
        document.body.appendChild(fullscreenRoot);

        videoParent.getBoundingClientRect = () => ({ left: 100, top: 50, width: 800, height: 500 }) as DOMRect;
        targetElement.getBoundingClientRect = () => ({ left: 140, top: 90, width: 600, height: 300 }) as DOMRect;
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: () => videoParent.lastElementChild,
        });

        const overlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'non-fullscreen-container',
            nonFullscreenContentClassName: 'non-fullscreen-content',
            fullscreenContainerClassName: 'fullscreen-container',
            fullscreenContentClassName: 'fullscreen-content',
            offsetAnchor: OffsetAnchor.bottom,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });
        overlay.setHtml([{ key: 'subtitle', html: () => '<span>subtitle</span>' }]);

        fullscreenElement = fullscreenRoot;
        document.dispatchEvent(new Event('fullscreenchange'));

        const fullscreenContainer = videoParent.querySelector<HTMLElement>('.fullscreen-container');
        expect(fullscreenContainer?.style.left).toBe('340px');
        expect(fullscreenContainer?.style.top).toBe('265px');

        overlay.dispose();
    });

    it('accounts for horizontal and vertical document scrolling outside fullscreen', () => {
        const originalScrollX = Object.getOwnPropertyDescriptor(window, 'scrollX');
        const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
        Object.defineProperty(window, 'scrollX', { configurable: true, value: 30 });
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 100 });
        const targetElement = document.createElement('video');
        targetElement.getBoundingClientRect = () => ({ left: 10, top: 20, width: 400, height: 200 }) as DOMRect;
        const overlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'non-fullscreen-container',
            nonFullscreenContentClassName: 'non-fullscreen-content',
            fullscreenContainerClassName: 'fullscreen-container',
            fullscreenContentClassName: 'fullscreen-content',
            offsetAnchor: OffsetAnchor.bottom,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });

        try {
            overlay.setHtml([{ key: 'subtitle', html: () => '<span>subtitle</span>' }]);

            const container = document.querySelector<HTMLElement>('.non-fullscreen-container');
            expect(container?.style.left).toBe('240px');
            expect(container?.style.top).toBe('245px');
        } finally {
            overlay.dispose();
            if (originalScrollX) Object.defineProperty(window, 'scrollX', originalScrollX);
            else delete (window as unknown as { scrollX?: number }).scrollX;
            if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
            else delete (window as unknown as { scrollY?: number }).scrollY;
        }
    });

    it('anchors bottom subtitles to the video bottom when it is partially clipped', () => {
        const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
        const targetElement = document.createElement('video');
        targetElement.getBoundingClientRect = () => ({ left: 10, top: -100, width: 400, height: 360 }) as DOMRect;
        const overlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'non-fullscreen-container',
            nonFullscreenContentClassName: 'non-fullscreen-content',
            fullscreenContainerClassName: 'fullscreen-container',
            fullscreenContentClassName: 'fullscreen-content',
            offsetAnchor: OffsetAnchor.bottom,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });

        try {
            overlay.setHtml([{ key: 'subtitle', html: () => '<span>subtitle</span>' }]);

            expect(document.querySelector<HTMLElement>('.non-fullscreen-container')?.style.top).toBe('685px');
        } finally {
            overlay.dispose();
            if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
            else delete (window as unknown as { scrollY?: number }).scrollY;
        }
    });

    it('keeps top and bottom overlays attached to the video while it scrolls above the viewport', () => {
        const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
        let scrollY = 0;
        Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
        const targetElement = document.createElement('video');
        targetElement.getBoundingClientRect = () =>
            ({ left: 10, top: 100 - scrollY, width: 400, height: 200 }) as DOMRect;
        const topOverlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'top-container',
            nonFullscreenContentClassName: 'top-content',
            fullscreenContainerClassName: 'fullscreen-top-container',
            fullscreenContentClassName: 'fullscreen-top-content',
            offsetAnchor: OffsetAnchor.top,
            contentPositionOffset: 8,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });
        const bottomOverlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'bottom-container',
            nonFullscreenContentClassName: 'bottom-content',
            fullscreenContainerClassName: 'fullscreen-bottom-container',
            fullscreenContentClassName: 'fullscreen-bottom-content',
            offsetAnchor: OffsetAnchor.bottom,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });

        try {
            topOverlay.setHtml([{ key: 'top', html: () => '<span>top</span>' }]);
            bottomOverlay.setHtml([{ key: 'bottom', html: () => '<span>bottom</span>' }]);
            const topContainer = document.querySelector<HTMLElement>('.top-container');
            const bottomContainer = document.querySelector<HTMLElement>('.bottom-container');
            expect(topContainer?.style.top).toBe('108px');
            expect(bottomContainer?.style.top).toBe('225px');

            scrollY = 400;
            topOverlay.refresh();
            bottomOverlay.refresh();

            expect(topContainer?.style.top).toBe('108px');
            expect(bottomContainer?.style.top).toBe('225px');
        } finally {
            topOverlay.dispose();
            bottomOverlay.dispose();
            if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
            else delete (window as unknown as { scrollY?: number }).scrollY;
        }
    });

    it('preserves the last valid layout while video geometry is transiently unavailable', () => {
        const targetElement = document.createElement('video');
        let rect = { left: 10, top: 20, width: 400, height: 200 };
        targetElement.getBoundingClientRect = () => rect as DOMRect;
        const overlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'non-fullscreen-container',
            nonFullscreenContentClassName: 'non-fullscreen-content',
            fullscreenContainerClassName: 'fullscreen-container',
            fullscreenContentClassName: 'fullscreen-content',
            offsetAnchor: OffsetAnchor.bottom,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });

        overlay.setHtml([{ key: 'subtitle', html: () => '<span>subtitle</span>' }]);
        const container = document.querySelector<HTMLElement>('.non-fullscreen-container');
        expect(container?.style.left).toBe('210px');
        expect(container?.style.top).toBe('145px');

        rect = { left: 0, top: 0, width: 0, height: 0 };
        overlay.refresh();

        expect(container?.style.left).toBe('210px');
        expect(container?.style.top).toBe('145px');
        overlay.dispose();
    });

    it('hides an overlay until valid video geometry is available', () => {
        const targetElement = document.createElement('video');
        let rect = { left: 0, top: 0, width: 0, height: 0 };
        targetElement.getBoundingClientRect = () => rect as DOMRect;
        const overlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'non-fullscreen-container',
            nonFullscreenContentClassName: 'non-fullscreen-content',
            fullscreenContainerClassName: 'fullscreen-container',
            fullscreenContentClassName: 'fullscreen-content',
            offsetAnchor: OffsetAnchor.bottom,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });

        overlay.setHtml([{ key: 'subtitle', html: () => '<span>subtitle</span>' }]);
        const container = document.querySelector<HTMLElement>('.non-fullscreen-container');
        expect(container?.style.getPropertyValue('visibility')).toBe('hidden');
        expect(container?.style.getPropertyPriority('visibility')).toBe('important');

        rect = { left: 10, top: 20, width: 400, height: 200 };
        overlay.refresh();

        expect(container?.style.visibility).toBe('');
        expect(container?.style.left).toBe('210px');
        expect(container?.style.top).toBe('145px');
        overlay.dispose();
    });

    it('positions windowed subtitles in their actual containing block coordinate space', () => {
        const originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
        const originalBodyRect = document.body.getBoundingClientRect;
        const originalBodyProperties = Object.fromEntries(
            ['scrollLeft', 'scrollTop', 'clientLeft', 'clientTop'].map((property) => [
                property,
                Object.getOwnPropertyDescriptor(document.body, property),
            ])
        );
        Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
            configurable: true,
            get() {
                return this.classList.contains('non-fullscreen-container') ? document.body : null;
            },
        });
        document.body.getBoundingClientRect = () => ({ left: 20, top: 40, width: 800, height: 600 }) as DOMRect;
        Object.defineProperties(document.body, {
            scrollLeft: { configurable: true, value: 5 },
            scrollTop: { configurable: true, value: 7 },
            clientLeft: { configurable: true, value: 2 },
            clientTop: { configurable: true, value: 3 },
        });
        const targetElement = document.createElement('video');
        targetElement.getBoundingClientRect = () => ({ left: 100, top: 100, width: 200, height: 100 }) as DOMRect;
        const overlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'non-fullscreen-container',
            nonFullscreenContentClassName: 'non-fullscreen-content',
            fullscreenContainerClassName: 'fullscreen-container',
            fullscreenContentClassName: 'fullscreen-content',
            offsetAnchor: OffsetAnchor.bottom,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });

        try {
            overlay.setHtml([{ key: 'subtitle', html: () => '<span>subtitle</span>' }]);

            const container = document.querySelector<HTMLElement>('.non-fullscreen-container');
            expect(container?.style.left).toBe('183px');
            expect(container?.style.top).toBe('89px');
        } finally {
            overlay.dispose();
            document.body.getBoundingClientRect = originalBodyRect;
            if (originalOffsetParent) {
                Object.defineProperty(HTMLElement.prototype, 'offsetParent', originalOffsetParent);
            } else {
                delete (HTMLElement.prototype as unknown as { offsetParent?: Element | null }).offsetParent;
            }
            for (const [property, descriptor] of Object.entries(originalBodyProperties)) {
                if (descriptor) Object.defineProperty(document.body, property, descriptor);
                else delete (document.body as unknown as Record<string, unknown>)[property];
            }
        }
    });

    it('reparents the fullscreen container when the video moves to a new player subtree', () => {
        const fullscreenRoot = document.createElement('div');
        const firstParent = document.createElement('div');
        const secondParent = document.createElement('div');
        const targetElement = document.createElement('video');
        fullscreenRoot.append(firstParent, secondParent);
        firstParent.appendChild(targetElement);
        document.body.appendChild(fullscreenRoot);
        firstParent.getBoundingClientRect = secondParent.getBoundingClientRect = () =>
            ({ left: 0, top: 0, width: 800, height: 500 }) as DOMRect;
        targetElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 500 }) as DOMRect;
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: () => targetElement.parentElement?.lastElementChild ?? null,
        });

        const overlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'non-fullscreen-container',
            nonFullscreenContentClassName: 'non-fullscreen-content',
            fullscreenContainerClassName: 'fullscreen-container',
            fullscreenContentClassName: 'fullscreen-content',
            offsetAnchor: OffsetAnchor.bottom,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });
        overlay.setHtml([{ key: 'subtitle', html: () => '<span>subtitle</span>' }]);

        fullscreenElement = fullscreenRoot;
        document.dispatchEvent(new Event('fullscreenchange'));
        expect(firstParent.querySelector('.fullscreen-container')).not.toBeNull();

        secondParent.appendChild(targetElement);
        document.dispatchEvent(new Event('fullscreenchange'));

        expect(firstParent.querySelector('.fullscreen-container')).toBeNull();
        expect(secondParent.querySelector('.fullscreen-container')).not.toBeNull();

        overlay.dispose();
    });

    it('resizes responsive cached content when the video width changes', () => {
        const targetElement = document.createElement('video');
        let videoWidth = 640;
        targetElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: videoWidth, height: 360 }) as DOMRect;
        const overlay = new CachingElementOverlay({
            targetElement,
            nonFullscreenContainerClassName: 'non-fullscreen-container',
            nonFullscreenContentClassName: 'non-fullscreen-content',
            fullscreenContainerClassName: 'fullscreen-container',
            fullscreenContentClassName: 'fullscreen-content',
            offsetAnchor: OffsetAnchor.bottom,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });

        overlay.setHtml([
            {
                key: 'image',
                html: () => '<div data-asb-video-width-ratio="0.5"></div>',
            },
        ]);
        const responsiveContent = document.querySelector<HTMLElement>('[data-asb-video-width-ratio]');
        expect(responsiveContent?.style.width).toBe('320px');

        videoWidth = 1280;
        overlay.refresh();

        expect(responsiveContent?.style.width).toBe('640px');
        overlay.dispose();
    });
});
