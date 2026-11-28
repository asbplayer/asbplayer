import { describe, expect, it } from '@jest/globals';
import {
    ASB_TOKEN_BASE_CLASS,
    ASB_TOKEN_HOVER_CLASS,
    ASB_TOKEN_HOVER_WORD_CLASS,
    ASB_TOKEN_NATIVE_SELECTION_CLASS,
    ASB_TOKEN_ON_WORD_HOVER_CLASS,
} from '@project/common/annotations/dom-annotations';
import { bindNativeTokenSelection } from '@project/common/annotations/dom-native-selection';

describe('native token selection', () => {
    it.each([false, true])('pins both ends of a cross-cue selection (backward: %s)', (backward) => {
        const subtitles = document.createElement('div');
        subtitles.innerHTML = ['first', 'second']
            .map(
                (
                    word
                ) => `<span class="asb-subtitles"><span class="${ASB_TOKEN_HOVER_CLASS} ${ASB_TOKEN_HOVER_WORD_CLASS}">
                <span class="${ASB_TOKEN_BASE_CLASS}">${word}</span>
                <span class="${ASB_TOKEN_ON_WORD_HOVER_CLASS}">${word}</span>
            </span></span>`
            )
            .join(' ');
        document.body.append(subtitles);
        const unbind = bindNativeTokenSelection(document);
        const selection = document.getSelection()!;
        const endpoints = Array.from(subtitles.querySelectorAll(`.${ASB_TOKEN_ON_WORD_HOVER_CLASS}`));
        const [start, end] = backward ? [...endpoints].reverse() : endpoints;
        const pins = () => Array.from(subtitles.querySelectorAll(`.${ASB_TOKEN_NATIVE_SELECTION_CLASS}`));

        try {
            start.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            expect(pins()).toEqual([start]);

            selection.setBaseAndExtent(start.firstChild!, 1, end.firstChild!, 2);
            document.dispatchEvent(new Event('selectionchange'));
            end.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            expect(pins()).toEqual(endpoints);

            selection.removeAllRanges();
            document.dispatchEvent(new Event('selectionchange'));
            expect(pins()).toEqual([]);
        } finally {
            selection.removeAllRanges();
            unbind();
            subtitles.remove();
        }
    });

    it.each([
        { api: 'composed range', canPin: true },
        { api: 'legacy Chrome', canPin: true },
        { api: 'neither API', canPin: false },
    ])('handles shadow subtitle selection with $api', ({ api, canPin }) => {
        const host = document.createElement('div');
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = ['first', 'second']
            .map(
                (word) => `<span class="${ASB_TOKEN_HOVER_CLASS}">
                    <span class="${ASB_TOKEN_ON_WORD_HOVER_CLASS}">${word}</span>
                </span>`
            )
            .join(' ');
        document.body.append(host);
        let shadowRoots: ShadowRoot[] = [];
        const unbind = bindNativeTokenSelection(document, () => shadowRoots);
        shadowRoots = [root]; // The extension discovers video roots after binding.
        const selection = document.getSelection()!;
        const endpoints = Array.from(root.querySelectorAll(`.${ASB_TOKEN_ON_WORD_HOVER_CLASS}`));
        const [start, end] = endpoints;
        const anchorNode = start.firstChild!;
        const focusNode = end.firstChild!;
        const pins = () => Array.from(root.querySelectorAll(`.${ASB_TOKEN_NATIVE_SELECTION_CLASS}`));

        // jsdom has no shadow selection APIs. Simulate the browser exposing the actual endpoints
        // through a composed range or the root's selection, but not through the document selection.
        Object.defineProperty(selection, 'getComposedRanges', {
            configurable: true,
            value:
                api === 'composed range'
                    ? ({ shadowRoots: roots }: { shadowRoots: readonly ShadowRoot[] }) =>
                          roots.includes(root)
                              ? [{ startContainer: anchorNode, endContainer: focusNode, collapsed: false }]
                              : []
                    : undefined,
        });
        if (api === 'legacy Chrome') {
            Object.defineProperty(root, 'getSelection', {
                value: () => ({ anchorNode, focusNode, isCollapsed: false }),
            });
        }

        try {
            selection.collapse(document.body, 0);
            start.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
            document.dispatchEvent(new Event('selectionchange'));
            end.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
            expect(pins()).toEqual(canPin ? endpoints : []);

            shadowRoots = [];
            document.dispatchEvent(new Event('selectionchange'));
            expect(pins()).toEqual([]);

            shadowRoots = [root];
            document.dispatchEvent(new Event('selectionchange'));
            expect(pins()).toEqual(canPin ? endpoints : []);

            selection.removeAllRanges();
            document.dispatchEvent(new Event('selectionchange'));
            expect(pins()).toEqual([]);
        } finally {
            selection.removeAllRanges();
            Reflect.deleteProperty(selection, 'getComposedRanges');
            unbind();
            host.remove();
        }
    });

    it('releases the branch after a click without a text selection', () => {
        const cue = document.createElement('span');
        cue.innerHTML = `<span class="${ASB_TOKEN_HOVER_CLASS}">
            <span class="${ASB_TOKEN_ON_WORD_HOVER_CLASS}">word</span>
        </span>`;
        document.body.append(cue);
        const unbind = bindNativeTokenSelection(document);
        const branch = cue.querySelector(`.${ASB_TOKEN_ON_WORD_HOVER_CLASS}`)!;
        try {
            branch.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            expect(cue.querySelector(`.${ASB_TOKEN_NATIVE_SELECTION_CLASS}`)).toBe(branch);
            branch.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            expect(cue.querySelector(`.${ASB_TOKEN_NATIVE_SELECTION_CLASS}`)).toBeNull();
        } finally {
            unbind();
            cue.remove();
        }
    });
});
