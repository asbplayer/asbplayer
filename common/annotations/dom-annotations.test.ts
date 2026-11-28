import { describe, expect, it } from '@jest/globals';
import { TokenStatus } from '@project/common/settings';
import {
    makeSubtitle,
    makeToken,
    makeDictionaryTrack,
    makeDictionaryTracks,
} from '@project/common/annotations/annotations-test-utils';
import {
    ASB_SUBTITLE_INDEX_ATTRIBUTE,
    ASB_TOKEN_START_ATTRIBUTE,
    ASB_TOKEN_BASE_CLASS,
    ASB_TOKEN_HOVER_CLASS,
    ASB_TOKEN_HOVER_WORD_CLASS,
    ASB_TOKEN_NATIVE_SELECTION_CLASS,
    ASB_TOKEN_ON_CUE_HOVER_CLASS,
    ASB_TOKEN_ON_WORD_HOVER_CLASS,
    ASB_TOKEN_SELECTED_CLASS,
} from '@project/common/annotations/dom-annotations';
import { HoveredToken } from '@project/common/annotations/dom-hovered-token';
import { bindNativeTokenSelection } from '@project/common/annotations/dom-native-selection';
import { clearTokenSelectionInRoot, selectTokenInRoot } from '@project/common/annotations/dom-token-selection';
import { renderRichTextOntoSubtitles } from '@project/common/annotations/render-annotations';

describe('native selection and token shortcuts', () => {
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
            expect(cue.querySelector(`.${ASB_TOKEN_NATIVE_SELECTION_CLASS}`)).toBeNull();
        } finally {
            document.getSelection()?.removeAllRanges();
            unbind();
            cue.remove();
        }
    });
});

describe('rendered annotations and token shortcuts', () => {
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
});
