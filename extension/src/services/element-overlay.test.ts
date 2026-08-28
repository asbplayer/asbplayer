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
});
