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
    ASB_TOKEN_SELECTED_CLASS,
    clearTokenSelectionInRoot,
    currentTokenSelectionLocation,
    HoveredToken,
    selectTokenInRoot,
} from '@project/common/annotations/dom-annotations';
import { renderRichTextOntoSubtitles } from '@project/common/annotations/render-annotations';
import { findAdjacentTokenJumpMatch, findTokenContainingSearch } from '@project/common/annotations/token-navigation';

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

    it('selects but does not collect a rendered token when color is disabled', () => {
        const subtitle = makeSubtitle({
            text: 'word',
            tokenization: { tokens: [makeToken({ pos: [0, 4] })] },
        });
        const richText = renderRichTextOntoSubtitles(
            [subtitle],
            'video',
            makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: false }))
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

    it('does not use a selected token from another subtitle overlay while hovering', () => {
        const hoveredToken = new HoveredToken();
        const selectedOverlay = document.createElement('div');
        selectedOverlay.className = 'asbplayer-subtitles-container-bottom';
        selectedOverlay.innerHTML =
            '<span data-track="1" data-asb-subtitle-index="0"><span class="asb-token" data-asb-token-start="0">selected</span></span>';
        const hoveredOverlay = document.createElement('div');
        hoveredOverlay.className = 'asbplayer-subtitles-container-bottom';
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

    it('selects the requested token in a root and reports missing locations', () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'asbplayer-token-container';
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

    it('activates hover annotations and clears only the previous selection in the same root', () => {
        const firstRoot = document.createElement('div');
        firstRoot.innerHTML =
            '<span class="asb-subtitles" data-asb-subtitle-index="1"><span class="asbplayer-subtitle-text"><span class="asb-token" data-asb-token-start="0">plain</span></span><span class="asbplayer-subtitle-rich"><span class="asb-token" data-asb-token-start="0">rich</span></span></span>';
        const secondRoot = document.createElement('div');
        secondRoot.innerHTML =
            '<span class="asb-subtitles" data-asb-subtitle-index="2"><span class="asb-token" data-asb-token-start="0">other</span></span>';
        document.body.append(firstRoot, secondRoot);

        expect(selectTokenInRoot(secondRoot, { subtitleIndex: 2, tokenStart: 0 })).toBe(true);
        expect(selectTokenInRoot(firstRoot, { subtitleIndex: 1, tokenStart: 0 })).toBe(true);

        expect(firstRoot.querySelector(`.${ASB_SUBTITLE_TOKEN_SELECTED_CLASS}`)).not.toBeNull();
        expect(firstRoot.querySelectorAll(`.${ASB_TOKEN_SELECTED_CLASS}`)).toHaveLength(2);
        expect(document.getSelection()?.toString()).toBe('rich');
        expect(secondRoot.querySelector(`.${ASB_TOKEN_SELECTED_CLASS}`)).not.toBeNull();

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
