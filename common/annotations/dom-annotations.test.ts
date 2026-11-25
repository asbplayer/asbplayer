import { describe, expect, it } from '@jest/globals';
import { TokenState, TokenStatus } from '@project/common/settings';
import {
    makeSubtitle,
    makeToken,
    makeDictionaryTrack,
    makeDictionaryTracks,
} from '@project/common/annotations/annotations-test-utils';
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
    bindNativeTokenSelection,
    clearTokenSelectionInRoot,
    currentTokenSelectionLocation,
    HoveredToken,
    restorableTokenSelectionInRoot,
    selectTokenInRoot,
} from '@project/common/annotations/dom-annotations';
import { renderRichTextOntoSubtitles } from '@project/common/annotations/render-annotations';
import { findAdjacentTokenJumpMatch, findTokenContainingSearch } from '@project/common/annotations/token-navigation';
import { registerSubtitleCopyScope } from '@project/common/annotations/subtitle-copy';

describe('native subtitle copy', () => {
    const copy = (target: EventTarget) => {
        const event = new Event('copy', { bubbles: true, cancelable: true, composed: true });
        const clipboard = new Map<string, string>();
        Object.defineProperty(event, 'clipboardData', {
            value: { setData: (type: string, value: string) => clipboard.set(type, value) },
        });
        target.dispatchEvent(event);
        return { handled: event.defaultPrevented, text: clipboard.get('text/plain') };
    };

    it('copies visible base text backward across cues, excluding ruby and inactive copies', () => {
        const container = document.createElement('div');
        container.innerHTML =
            `<span ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="0">` +
            '<ruby><b>alpha</b><rp>(</rp><rt>reading</rt><rp>)</rp></ruby> &amp; ' +
            '<span style="display: none">bravo</span><ruby>bravo<rt>frequency</rt></ruby><br>delta</span>' +
            `<br><span ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="1"><ruby>charlie<rt>gloss</rt></ruby></span>`;
        document.body.append(container);
        registerSubtitleCopyScope(container, `[${ASB_SUBTITLE_INDEX_ATTRIBUTE}]`);
        const selection = document.getSelection()!;
        const unbind = bindNativeTokenSelection(document);
        try {
            const start = container.querySelector('b')!.firstChild!;
            const end = container.querySelectorAll('ruby')[2].firstChild!;
            selection.setBaseAndExtent(end, 3, start, 2);

            expect(copy(container)).toEqual({ handled: true, text: 'pha & bravo\ndelta\ncha' });
            expect(selection.anchorNode).toBe(end);
            expect(selection.focusOffset).toBe(2);
            unbind();
            expect(copy(container)).toEqual({ handled: false, text: undefined });
        } finally {
            selection.removeAllRanges();
            unbind();
            container.remove();
        }
    });

    it('leaves native copy alone when page text sits between two owned endpoints', () => {
        const container = document.createElement('div');
        container.innerHTML =
            `<span ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="0">first</span>` +
            '<span>page text</span>' +
            `<span ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="1">second</span>`;
        document.body.append(container);
        registerSubtitleCopyScope(container, `[${ASB_SUBTITLE_INDEX_ATTRIBUTE}]`);
        const selection = document.getSelection()!;
        const unbind = bindNativeTokenSelection(document);
        try {
            selection.setBaseAndExtent(container.firstChild!.firstChild!, 1, container.lastChild!.firstChild!, 2);
            expect(copy(container)).toEqual({ handled: false, text: undefined });
        } finally {
            selection.removeAllRanges();
            unbind();
            container.remove();
        }
    });

    it('leaves multiple selected ruby annotations to native copy even with a trailing line break', () => {
        const cue = document.createElement('span');
        cue.innerHTML = '<ruby><ruby><ruby>base<rt>reading</rt></ruby><rt>42</rt></ruby><rt>gloss</rt></ruby><br>';
        document.body.append(cue);
        registerSubtitleCopyScope(cue);
        const selection = document.getSelection()!;
        const unbind = bindNativeTokenSelection(document);
        try {
            selection.setBaseAndExtent(cue.querySelector('rt')!.firstChild!, 0, cue, cue.childNodes.length);
            expect(selection.toString()).toBe('reading42gloss');
            expect(copy(cue)).toEqual({ handled: false, text: undefined });
        } finally {
            selection.removeAllRanges();
            unbind();
            cue.remove();
        }
    });

    it.each([
        { name: 'the selection is entirely inside a reading', owned: true },
        { name: 'the markup is not in an asbplayer subtitle container', owned: false },
    ])('leaves native copy alone when $name', ({ owned }) => {
        const container = document.createElement('div');
        container.innerHTML = `<span ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="0"><ruby>base<rt>reading</rt></ruby></span>`;
        document.body.append(container);
        if (owned) registerSubtitleCopyScope(container.firstElementChild as HTMLElement);
        const selection = document.getSelection()!;
        const unbind = bindNativeTokenSelection(document);
        try {
            selection.selectAllChildren(owned ? container.querySelector('rt')! : container);
            expect(copy(container)).toEqual({ handled: false, text: undefined });
        } finally {
            selection.removeAllRanges();
            unbind();
            container.remove();
        }
    });
});

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
        const pins = () => Array.from(subtitles.querySelectorAll('.asb-token-native-selection'));

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
        const pins = () => Array.from(root.querySelectorAll('.asb-token-native-selection'));

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
            expect(cue.querySelector('.asb-token-native-selection')).toBe(branch);
            branch.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            expect(cue.querySelector('.asb-token-native-selection')).toBeNull();
        } finally {
            unbind();
            cue.remove();
        }
    });

    it('leaves shortcut-selected branches under shortcut control', () => {
        const cue = document.createElement('div');
        cue.innerHTML = `<span class="asb-subtitles" ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="0">
            <span class="${ASB_TOKEN_HOVER_CLASS} ${ASB_TOKEN_HOVER_WORD_CLASS}">
                <span class="${ASB_TOKEN_BASE_CLASS}"><span ${ASB_TOKEN_START_ATTRIBUTE}="0">word</span></span>
                <span class="${ASB_TOKEN_ON_WORD_HOVER_CLASS}"><span ${ASB_TOKEN_START_ATTRIBUTE}="0">word</span></span>
            </span>
        </span>`;
        document.body.append(cue);
        const unbind = bindNativeTokenSelection(document);
        try {
            expect(selectTokenInRoot(cue, { subtitleIndex: 0, tokenStart: 0 })).toBe(true);
            document.dispatchEvent(new Event('selectionchange'));
            expect(document.getSelection()?.toString()).toBe('word');
            expect(cue.querySelector('.asb-token-native-selection')).toBeNull();
        } finally {
            document.getSelection()?.removeAllRanges();
            unbind();
            cue.remove();
        }
    });
});

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

    it('selects but does not collect a rendered token when color is disabled', () => {
        const subtitle = makeSubtitle({
            text: 'word',
            tokenization: { tokens: [makeToken({ pos: [0, 4] })] },
        });
        const richText = renderRichTextOntoSubtitles(
            [subtitle],
            'video',
            makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: false })),
            { adaptiveWordVisibilityEnabled: true }
        ).get(subtitle.index)?.richText;
        const wrapper = document.createElement('div');
        wrapper.dataset.track = '0';
        wrapper.setAttribute(ASB_SUBTITLE_INDEX_ATTRIBUTE, String(subtitle.index));
        wrapper.innerHTML = richText ?? '';
        document.body.append(wrapper);
        const token = wrapper.querySelector(`[${ASB_TOKEN_START_ATTRIBUTE}]`) as HTMLElement;
        const hoveredToken = new HoveredToken();

        hoveredToken.handleMouseOver({ target: token } as unknown as MouseEvent);

        expect(selectTokenInRoot(wrapper, { subtitleIndex: subtitle.index, tokenStart: 0 })).toBe(true);
        expect(hoveredToken.parse()).toBeNull();
        wrapper.remove();
    });

    it.each([false, true])('selects the word or cue variant and parses the token with coloring: %s', (colorize) => {
        const track = makeDictionaryTrack({ dictionaryColorizeSubtitles: colorize });
        track.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.UNKNOWN].gloss = true;
        track.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.UNKNOWN].frequency = true;
        track.dictionaryTokenAnnotationConfig.video.gloss.onHoverEnabled = true;
        track.dictionaryTokenAnnotationConfig.video.gloss.hoverPerToken = true;
        track.dictionaryTokenAnnotationConfig.video.frequency.onHoverEnabled = true;
        const subtitle = makeSubtitle({
            text: '語学 学習',
            tokenization: {
                tokens: [
                    makeToken({ pos: [0, 2], status: TokenStatus.UNKNOWN, frequency: 5 }),
                    makeToken({ pos: [3, 5], status: TokenStatus.UNKNOWN, frequency: 7, gloss: 'study' }),
                ],
            },
        });
        const wrapper = document.createElement('div');
        wrapper.className = 'asb-subtitles';
        wrapper.dataset.track = '0';
        wrapper.setAttribute(ASB_SUBTITLE_INDEX_ATTRIBUTE, String(subtitle.index));
        wrapper.innerHTML =
            renderRichTextOntoSubtitles([subtitle], 'video', makeDictionaryTracks(track), {
                adaptiveWordVisibilityEnabled: true,
            }).get(0)?.richText ?? '';
        document.body.append(wrapper);
        const hovered = new HoveredToken();
        const selectedVariant = (className: string) => {
            const selected = document.getSelection()?.anchorNode;
            const element = selected instanceof Element ? selected : selected?.parentElement;
            return element?.closest(`.${className}`);
        };
        expect(selectTokenInRoot(wrapper, { subtitleIndex: subtitle.index, tokenStart: 3 })).toBe(true);
        expect(selectedVariant(ASB_TOKEN_ON_WORD_HOVER_CLASS)).toBeInstanceOf(HTMLElement);
        expect(hovered.parse()).toEqual(colorize ? { token: '学習', track: 0 } : null);
        expect(wrapper.querySelectorAll(`.${ASB_TOKEN_HOVER_CLASS}.${ASB_TOKEN_SELECTED_CLASS}`)).toHaveLength(1);
        expect(selectTokenInRoot(wrapper, { subtitleIndex: subtitle.index, tokenStart: 0 })).toBe(true);
        expect(selectedVariant(ASB_TOKEN_ON_CUE_HOVER_CLASS)).toBeInstanceOf(HTMLElement);
        expect(hovered.parse()).toEqual(colorize ? { token: '語学', track: 0 } : null);
        clearTokenSelectionInRoot(wrapper);
        expect(wrapper.querySelector(`.${ASB_TOKEN_SELECTED_CLASS}`)).toBeNull();
        wrapper.remove();
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

describe('token jump navigation', () => {
    const target = { kind: 'status' as const, value: TokenStatus.UNKNOWN };

    it('returns no match for zero subtitles and filters non-seekable tracks and non-letter tokens', () => {
        expect(findAdjacentTokenJumpMatch([], target, true, 0, 1)).toBeUndefined();

        const subtitles = [
            makeSubtitle({
                index: 10,
                text: '!!!',
                tokenization: { tokens: [makeToken({ pos: [0, 3] })] },
            }),
            makeSubtitle({
                index: 11,
                track: 1,
                text: 'hidden',
                tokenization: { tokens: [makeToken({ pos: [0, 6] })] },
            }),
        ];

        expect(findAdjacentTokenJumpMatch(subtitles, target, true, 0, 1)).toBeUndefined();
    });

    it('navigates by time and wraps relative to the current selection', () => {
        const first = makeSubtitle({
            index: 10,
            start: 100,
            end: 200,
            text: 'first',
            tokenization: { tokens: [makeToken({ pos: [0, 5] })] },
        });
        const second = makeSubtitle({
            index: 20,
            start: 500,
            end: 600,
            text: 'second',
            tokenization: { tokens: [makeToken({ pos: [0, 6] })] },
        });
        const subtitles = [first, second];

        expect(findAdjacentTokenJumpMatch(subtitles, target, true, 250, 1)?.subtitle).toBe(second);
        expect(findAdjacentTokenJumpMatch(subtitles, target, false, 250, 1)?.subtitle).toBe(first);
        expect(
            findAdjacentTokenJumpMatch(subtitles, target, true, 250, 1, {
                subtitleIndex: second.index,
                tokenStart: 0,
            })?.subtitle
        ).toBe(first);
    });

    it('matches state targets', () => {
        const subtitle = makeSubtitle({
            text: 'ignored',
            tokenization: { tokens: [makeToken({ states: [TokenState.IGNORED] })] },
        });

        expect(
            findAdjacentTokenJumpMatch([subtitle], { kind: 'state', value: TokenState.IGNORED }, true, 0, 1)?.subtitle
        ).toBe(subtitle);
    });

    it('matches every token for an any-token target regardless of status or state', () => {
        const subtitle = makeSubtitle({
            text: 'first second',
            tokenization: {
                tokens: [
                    makeToken({ pos: [0, 5], status: TokenStatus.MATURE, states: [TokenState.IGNORED] }),
                    makeToken({ pos: [6, 12], status: TokenStatus.UNCOLLECTED, states: [] }),
                ],
            },
        });
        const target = { kind: 'any' as const };
        const first = findAdjacentTokenJumpMatch([subtitle], target, true, 0, 1);
        const second = findAdjacentTokenJumpMatch([subtitle], target, true, 0, 1, first);

        expect(first?.token.pos).toEqual([0, 5]);
        expect(second?.token.pos).toEqual([6, 12]);
    });

    it('continues from a selected token after it stops matching the jump target', () => {
        const subtitle = makeSubtitle({
            index: 12,
            text: 'aaa bbb ccc',
            tokenization: {
                tokens: [
                    makeToken({ pos: [0, 3], status: TokenStatus.UNKNOWN }),
                    makeToken({ pos: [4, 7], status: TokenStatus.LEARNING }),
                    makeToken({ pos: [8, 11], status: TokenStatus.UNKNOWN }),
                ],
            },
        });
        const selection = { subtitleIndex: 12, tokenStart: 4 };

        expect(findAdjacentTokenJumpMatch([subtitle], target, true, 0, 1, selection)?.token.pos).toEqual([8, 11]);
        expect(findAdjacentTokenJumpMatch([subtitle], target, false, 0, 1, selection)?.token.pos).toEqual([0, 3]);
    });

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

describe('token search highlighting', () => {
    const subtitle = makeSubtitle({
        index: 7,
        text: 'first 語学 last',
        tokenization: {
            tokens: [
                makeToken({ pos: [0, 5] }),
                makeToken({ pos: [6, 8], readings: [{ pos: [0, 2], reading: 'ごがく' }] }),
                makeToken({ pos: [9, 13] }),
            ],
        },
    });

    it('returns the token containing a normalized plain-text search', () => {
        expect(findTokenContainingSearch(subtitle, ['IRS'])).toEqual({ subtitleIndex: 7, tokenStart: 0 });
    });

    it('returns the token containing a reading or regular-expression search', () => {
        expect(findTokenContainingSearch(subtitle, ['がく'])).toEqual({ subtitleIndex: 7, tokenStart: 6 });
        expect(findTokenContainingSearch(subtitle, [], /last/i)).toEqual({ subtitleIndex: 7, tokenStart: 9 });
    });

    it('does not highlight when a search spans tokens or tokenization is unavailable', () => {
        expect(findTokenContainingSearch(subtitle, ['first 語学'])).toBeUndefined();
        expect(findTokenContainingSearch(makeSubtitle({ tokenization: undefined }), ['word'])).toBeUndefined();
        expect(findTokenContainingSearch(undefined, ['word'])).toBeUndefined();
    });
});
