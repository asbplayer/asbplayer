import { describe, expect, it } from '@jest/globals';
import { TokenStatus } from '@project/common/settings';
import { makeSubtitle, makeToken } from '@project/common/annotations/annotations-test-utils';
import {
    ASB_SUBTITLE_INDEX_ATTRIBUTE,
    ASB_TOKEN_START_ATTRIBUTE,
    ASB_SUBTITLE_TOKEN_SELECTED_CLASS,
    ASB_TOKEN_AUTO_PAUSE_SELECTED_CLASS,
    ASB_TOKEN_BASE_CLASS,
    ASB_TOKEN_CLASS,
    ASB_TOKEN_HOVER_CLASS,
    ASB_TOKEN_HOVER_CUE_CLASS,
    ASB_TOKEN_HOVER_WORD_CLASS,
    ASB_TOKEN_ON_CUE_HOVER_CLASS,
    ASB_TOKEN_ON_WORD_HOVER_CLASS,
    ASB_TOKEN_SELECTED_CLASS,
} from '@project/common/annotations/dom-annotations';
import {
    clearTokenSelectionInRoot,
    currentTokenSelectionLocation,
    restorableTokenSelectionInRoot,
    selectTokenInRoot,
} from '@project/common/annotations/dom-token-selection';

describe('DOM token selection', () => {
    it('reads the selected token location independently of its status', () => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = '<span data-asb-subtitle-index="12"><span data-asb-token-start="2">word</span></span>';
        document.body.append(wrapper);
        const tokenElement = wrapper.querySelector('[data-asb-token-start]') as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(tokenElement);
        document.getSelection()?.removeAllRanges();
        document.getSelection()?.addRange(range);
        const subtitle = makeSubtitle({
            index: 12,
            text: '__word',
            tokenization: { tokens: [makeToken({ pos: [2, 6] })] },
        });

        expect(currentTokenSelectionLocation([subtitle], document)).toEqual({
            subtitleIndex: 12,
            tokenStart: 2,
        });
        document.getSelection()?.removeAllRanges();
        tokenElement.classList.add(ASB_TOKEN_SELECTED_CLASS);
        expect(currentTokenSelectionLocation([subtitle], document)).toEqual({
            subtitleIndex: 12,
            tokenStart: 2,
        });
        subtitle.tokenization!.tokens[0].status = TokenStatus.MATURE;
        expect(currentTokenSelectionLocation([subtitle], document)).toEqual({ subtitleIndex: 12, tokenStart: 2 });
        wrapper.remove();
    });

    it('does not read a selection from outside the supplied root', () => {
        const selectedRoot = document.createElement('div');
        const otherRoot = document.createElement('div');
        selectedRoot.innerHTML =
            '<span data-asb-subtitle-index="12"><span class="asb-token" data-asb-token-start="0">word</span></span>';
        document.body.append(selectedRoot, otherRoot);
        const tokenElement = selectedRoot.querySelector('.asb-token') as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(tokenElement);
        document.getSelection()?.removeAllRanges();
        document.getSelection()?.addRange(range);
        const subtitle = makeSubtitle({
            index: 12,
            text: 'word',
            tokenization: { tokens: [makeToken({ pos: [0, 4] })] },
        });

        expect(currentTokenSelectionLocation([subtitle], otherRoot)).toBeUndefined();

        selectedRoot.remove();
        otherRoot.remove();
    });

    it('falls back to the marked token when the text selection is in a token outside the root', () => {
        const selectedRoot = document.createElement('div');
        const markedRoot = document.createElement('div');
        selectedRoot.innerHTML =
            '<span data-asb-subtitle-index="1"><span class="asb-token" data-asb-token-start="0">other</span></span>';
        markedRoot.innerHTML = `<span data-asb-subtitle-index="12"><span class="asb-token ${ASB_TOKEN_SELECTED_CLASS}" data-asb-token-start="0">word</span></span>`;
        document.body.append(selectedRoot, markedRoot);
        const range = document.createRange();
        range.selectNodeContents(selectedRoot.querySelector('.asb-token')!);
        document.getSelection()?.removeAllRanges();
        document.getSelection()?.addRange(range);
        const subtitle = makeSubtitle({
            index: 12,
            text: 'word',
            tokenization: { tokens: [makeToken({ pos: [0, 4] })] },
        });

        expect(currentTokenSelectionLocation([subtitle], markedRoot)).toEqual({ subtitleIndex: 12, tokenStart: 0 });

        document.getSelection()?.removeAllRanges();
        selectedRoot.remove();
        markedRoot.remove();
    });

    it('restores a re-rendered token selection without taking a text selection from elsewhere', () => {
        const root = document.createElement('div');
        const outside = document.createElement('p');
        outside.textContent = 'outside';
        const html =
            '<span data-asb-subtitle-index="3"><span class="asb-token" data-asb-token-start="0">word</span></span>';
        root.innerHTML = html;
        document.body.append(root, outside);
        selectTokenInRoot(root, { subtitleIndex: 3, tokenStart: 0 }, { autoPause: true });
        expect(restorableTokenSelectionInRoot(root)).toEqual({
            location: { subtitleIndex: 3, tokenStart: 0 },
            options: { autoPause: true, selectText: true },
        });

        const outsideRange = document.createRange();
        outsideRange.selectNodeContents(outside);
        document.getSelection()?.removeAllRanges();
        document.getSelection()?.addRange(outsideRange);
        const selection = restorableTokenSelectionInRoot(root)!;
        expect(selection.options).toEqual({ autoPause: true, selectText: false });

        root.innerHTML = html;
        expect(selectTokenInRoot(root, selection.location, selection.options)).toBe(true);
        expect(root.querySelector(`.${ASB_TOKEN_AUTO_PAUSE_SELECTED_CLASS}`)).not.toBeNull();
        expect(document.getSelection()?.toString()).toBe('outside');
        expect(restorableTokenSelectionInRoot(document.createElement('div'))).toBeUndefined();

        document.getSelection()?.removeAllRanges();
        root.remove();
        outside.remove();
    });

    it('selects the requested token in a root and reports missing locations', () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'asb-token-container';
        wrapper.tabIndex = -1;
        wrapper.innerHTML = '<span data-asb-subtitle-index="4"><span data-asb-token-start="1">target</span></span>';
        const focusedElement = document.createElement('button');
        document.body.append(focusedElement, wrapper);
        focusedElement.focus();

        expect(selectTokenInRoot(wrapper, { subtitleIndex: 4, tokenStart: 1 }, { focusContainer: false })).toBe(true);
        expect(document.getSelection()?.toString()).toBe('target');
        expect(document.activeElement).toBe(focusedElement);
        expect(selectTokenInRoot(wrapper, { subtitleIndex: 5, tokenStart: 1 })).toBe(false);
        clearTokenSelectionInRoot(wrapper);
        expect(wrapper.querySelector(`.${ASB_TOKEN_SELECTED_CLASS}`)).toBeNull();
        expect(document.getSelection()?.toString()).toBe('');
        wrapper.remove();
    });

    it.each([undefined, false, true])(
        'preserves an existing selection when delayed pause selection arrives (auto-pause: %s)',
        (autoPause) => {
            const root = document.createElement('div');
            root.innerHTML =
                '<span data-asb-subtitle-index="0"><span class="asb-token" data-asb-token-start="0">one</span>' +
                '<span class="asb-token" data-asb-token-start="4">two</span></span>';
            document.body.append(root);
            try {
                if (autoPause !== undefined) {
                    selectTokenInRoot(root, { subtitleIndex: 0, tokenStart: 4 }, { autoPause });
                }
                expect(
                    selectTokenInRoot(
                        root,
                        { subtitleIndex: 0, tokenStart: 0 },
                        {
                            autoPause: true,
                            onlyIfUnselected: true,
                        }
                    )
                ).toBe(true);
                expect(root.querySelector(`.${ASB_TOKEN_SELECTED_CLASS}`)?.textContent).toBe(
                    autoPause === undefined ? 'one' : 'two'
                );
                expect(root.querySelector(`.${ASB_TOKEN_AUTO_PAUSE_SELECTED_CLASS}`) !== null).toBe(
                    autoPause !== false
                );
                expect(document.getSelection()?.toString()).toBe(autoPause === undefined ? 'one' : 'two');
            } finally {
                root.remove();
                document.getSelection()?.removeAllRanges();
            }
        }
    );

    it('activates hover annotations and clears only the previous selection in the same root', () => {
        const firstRoot = document.createElement('div');
        firstRoot.innerHTML = `<span class="asb-subtitles" ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="1">
            <span class="${ASB_TOKEN_HOVER_CLASS} ${ASB_TOKEN_HOVER_CUE_CLASS} ${ASB_TOKEN_HOVER_WORD_CLASS}">
                <span class="${ASB_TOKEN_BASE_CLASS}"><span class="${ASB_TOKEN_CLASS}" ${ASB_TOKEN_START_ATTRIBUTE}="0">plain</span></span>
                <span class="${ASB_TOKEN_ON_CUE_HOVER_CLASS}"><span class="${ASB_TOKEN_CLASS}" ${ASB_TOKEN_START_ATTRIBUTE}="0">cue</span></span>
                <span class="${ASB_TOKEN_ON_WORD_HOVER_CLASS}"><span class="${ASB_TOKEN_CLASS}" ${ASB_TOKEN_START_ATTRIBUTE}="0">rich</span></span>
            </span>
        </span>`;
        const secondRoot = document.createElement('div');
        secondRoot.innerHTML =
            '<span class="asb-subtitles" data-asb-subtitle-index="2"><span class="asb-token" data-asb-token-start="0">other</span></span>';
        document.body.append(firstRoot, secondRoot);

        expect(selectTokenInRoot(secondRoot, { subtitleIndex: 2, tokenStart: 0 })).toBe(true);
        expect(selectTokenInRoot(firstRoot, { subtitleIndex: 1, tokenStart: 0 })).toBe(true);

        expect(firstRoot.querySelector(`.${ASB_SUBTITLE_TOKEN_SELECTED_CLASS}`)).not.toBeNull();
        expect(firstRoot.querySelector(`.${ASB_TOKEN_HOVER_CLASS}.${ASB_TOKEN_SELECTED_CLASS}`)).not.toBeNull();
        expect(document.getSelection()?.toString()).toBe('rich');
        expect(secondRoot.querySelector(`.${ASB_TOKEN_SELECTED_CLASS}`)).not.toBeNull();
        clearTokenSelectionInRoot(firstRoot);
        expect(firstRoot.querySelector(`.${ASB_TOKEN_SELECTED_CLASS}`)).toBeNull();
        expect(document.getSelection()?.toString()).toBe('');

        firstRoot.remove();
        secondRoot.remove();
    });
});
