import { describe, expect, it } from '@jest/globals';
import {
    ASB_TOKEN_BASE_CLASS,
    ASB_TOKEN_CLASS,
    ASB_TOKEN_HOVER_CLASS,
    ASB_TOKEN_ON_CUE_HOVER_CLASS,
    ASB_TOKEN_ON_WORD_HOVER_CLASS,
} from '@project/common/annotations/dom-annotations';
import { HoveredToken } from '@project/common/annotations/dom-hovered-token';
import { selectTokenInRoot } from '@project/common/annotations/dom-token-selection';

describe('HoveredToken', () => {
    it('extracts visible token text and track while ignoring ruby text', () => {
        const hoveredToken = new HoveredToken();
        const wrapper = document.createElement('div');
        wrapper.dataset.track = '3';
        wrapper.innerHTML = '<span class="asb-token"> 語<ruby><rb>学</rb><rt>がく</rt></ruby> </span>';
        const inner = wrapper.querySelector('ruby') as HTMLElement;

        hoveredToken.handleMouseOver({ target: inner } as unknown as MouseEvent);

        expect(hoveredToken.parse()).toEqual({ token: '語学', track: 3 });
    });

    it('clears when the hovered token receives mouseout', () => {
        const hoveredToken = new HoveredToken();
        const wrapper = document.createElement('div');
        wrapper.dataset.track = '1';
        wrapper.innerHTML = '<span class="asb-token">word</span>';
        const token = wrapper.querySelector('.asb-token') as HTMLElement;

        hoveredToken.handleMouseOver({ target: token } as unknown as MouseEvent);
        expect(hoveredToken.parse()).toEqual({ token: 'word', track: 1 });

        hoveredToken.handleMouseOut({ target: token } as unknown as MouseEvent);
        expect(hoveredToken.parse()).toBeNull();
    });

    it('preserves the hovered token when mouseout comes from a different element', () => {
        const hoveredToken = new HoveredToken();
        const wrapper = document.createElement('div');
        wrapper.dataset.track = '1';
        wrapper.innerHTML = '<span class="asb-token">word</span><span class="other">other</span>';
        const token = wrapper.querySelector('.asb-token') as HTMLElement;
        const other = wrapper.querySelector('.other') as HTMLElement;

        hoveredToken.handleMouseOver({ target: token } as unknown as MouseEvent);
        hoveredToken.handleMouseOut({ target: other } as unknown as MouseEvent);

        expect(hoveredToken.parse()).toEqual({ token: 'word', track: 1 });
    });

    it('treats a jumped-to token selection as the hovered token', () => {
        const hoveredToken = new HoveredToken();
        const wrapper = document.createElement('div');
        wrapper.dataset.track = '2';
        wrapper.setAttribute('data-asb-subtitle-index', '4');
        wrapper.innerHTML = '<span class="asb-token" data-asb-token-start="0">selected</span>';
        document.body.append(wrapper);

        expect(selectTokenInRoot(wrapper, { subtitleIndex: 4, tokenStart: 0 })).toBe(true);
        expect(hoveredToken.parse()).toEqual({ token: 'selected', track: 2 });

        wrapper.remove();
    });

    it('does not collect an addressable token without the collectible class', () => {
        const hoveredToken = new HoveredToken();
        const wrapper = document.createElement('div');
        wrapper.dataset.track = '1';
        wrapper.innerHTML = '<span data-asb-token-start="0">word</span>';
        const token = wrapper.firstElementChild as HTMLElement;
        document.body.append(wrapper);
        document.getSelection()?.removeAllRanges();

        hoveredToken.handleMouseOver({ target: token } as unknown as MouseEvent);

        expect(hoveredToken.parse()).toBeNull();
        wrapper.remove();
    });

    it.each([
        {
            name: 'collects the visible branch',
            hitSelector: '.live',
            detached: false,
            expected: { token: 'word', track: 1 },
        },
        { name: 'ignores hidden collectible copies', hitSelector: '.uncolored', detached: false, expected: null },
        { name: 'ignores a different word under the pointer', hitSelector: '.other', detached: false, expected: null },
        { name: 'ignores a detached word', hitSelector: '.live', detached: true, expected: null },
    ])('$name when the last mouse target is in the old base branch', ({ hitSelector, detached, expected }) => {
        const hoveredToken = new HoveredToken();
        const doc = document.implementation.createHTMLDocument();
        const cue = doc.createElement('div');
        cue.dataset.track = '1';
        cue.innerHTML = `
            <span class="${ASB_TOKEN_HOVER_CLASS}">
                <span class="${ASB_TOKEN_BASE_CLASS}"><span data-asb-token-start="0">word</span></span>
                <span class="${ASB_TOKEN_ON_CUE_HOVER_CLASS}" hidden>
                    <span class="${ASB_TOKEN_CLASS}" data-asb-token-start="0">hidden</span>
                </span>
                <span class="${ASB_TOKEN_ON_WORD_HOVER_CLASS}">
                    <span class="${hitSelector === '.uncolored' ? 'uncolored' : `live ${ASB_TOKEN_CLASS}`}"
                        data-asb-token-start="0">word</span>
                </span>
            </span>
            <span class="${ASB_TOKEN_HOVER_CLASS}">
                <span class="other ${ASB_TOKEN_CLASS}" data-asb-token-start="5">other</span>
            </span>`;
        doc.body.append(cue);
        const base = cue.querySelector<HTMLElement>(`.${ASB_TOKEN_BASE_CLASS}`)!;
        // jsdom doesn't implement layout or hit testing.
        Object.defineProperty(doc, 'elementFromPoint', {
            value: (x: number, y: number) => (x === 10 && y === 20 ? cue.querySelector(hitSelector) : null),
        });
        cue.addEventListener('mouseover', (event) => hoveredToken.handleMouseOver(event));
        base.firstElementChild!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 10, clientY: 20 }));
        base.hidden = true;
        if (detached) cue.remove();

        expect(hoveredToken.parse()).toEqual(expected);
    });

    it('does not use a selected token from another subtitle overlay while hovering', () => {
        const hoveredToken = new HoveredToken();
        const selectedOverlay = document.createElement('div');
        selectedOverlay.className = 'asb-subtitles-container-bottom';
        selectedOverlay.innerHTML =
            '<span data-track="1" data-asb-subtitle-index="0"><span class="asb-token" data-asb-token-start="0">selected</span></span>';
        const hoveredOverlay = document.createElement('div');
        hoveredOverlay.className = 'asb-subtitles-container-bottom';
        hoveredOverlay.innerHTML =
            '<span data-track="2" data-asb-subtitle-index="0"><span class="asb-token" data-asb-token-start="0">hovered</span></span>';
        document.body.append(selectedOverlay, hoveredOverlay);
        expect(selectTokenInRoot(selectedOverlay, { subtitleIndex: 0, tokenStart: 0 })).toBe(true);
        const hovered = hoveredOverlay.querySelector('.asb-token')!;

        hoveredToken.handleMouseOver({ target: hovered } as unknown as MouseEvent);

        expect(hoveredToken.parse()).toEqual({ token: 'hovered', track: 2 });
        selectedOverlay.remove();
        hoveredOverlay.remove();
    });
});
