import type { Token, Tokenization, TokenReading } from '@project/common';
import type { DictionaryTrack, EnabledAnnotations, TokenAnnotationConfigTarget } from '@project/common/settings';
import {
    areDictionaryTracksEqual,
    dictionaryTrackEnabled,
    TokenStyling,
    getEnabledAnnotations,
    getEnabledAnnotationsForHover,
    defaultSettings,
    shouldUseAnnotation,
} from '@project/common/settings';
import type { PitchAccentContext } from '@project/common/util';
import {
    HAS_LETTER_REGEX,
    iterateOverStringInBlocks,
    ONLY_ASCII_LETTERS_REGEX,
    areTokenizationsEqual,
    isKanaOnly,
    getKanaMoras,
    isKanaMoraPitchHigh,
    isAttachedParticlePitchHigh,
    clearPitchAccentContext,
    getContiguousReading,
} from '@project/common/util';
import {
    ASB_FREQUENCY_CLASS,
    ASB_GLOSS_CLASS,
    ASB_GLOSS_POPUP_CLASS,
    ASB_GLOSS_TEXT_CLASS,
    ASB_GLOSS_UNDER_CLASS,
    ASB_PITCH_ACCENT_CLASS,
    ASB_PITCH_ACCENT_LINE_CLASS,
    ASB_PITCH_ACCENT_MORA_CLASS,
    ASB_PITCH_ACCENT_MORA_HIGH_CLASS,
    ASB_PITCH_ACCENT_MORA_LOW_CLASS,
    ASB_READING_CLASS,
    ASB_TOKEN_CLASS,
    ASB_TOKEN_HIGHLIGHT_CLASS,
    ASB_TOKEN_START_ATTRIBUTE,
} from '@project/common/annotations';

// Subtitles with rich text are ~5KB per subtitle and so is not worth using a render window.
// Having one also negatively affects other extensions such as JPDB Reader which relies on a stable DOM.
// export const ANNOTATIONS_VIDEO_RENDER_BEHIND_MS = 15000; // Seeking backwards is usually 5-10s
// export const ANNOTATIONS_VIDEO_RENDER_AHEAD_MS = 60000; // Seeking forward is usually 5-30s

export interface InternalToken extends Token {
    __internal?: boolean;
}

export const getAnnotationsHtml = (text: string, richText: string | undefined, richTextOnHover: string | undefined) => {
    if (!richTextOnHover) return richText ?? text;
    return `<span class="asbplayer-subtitle-text">${richText ?? text}</span><span class="asbplayer-subtitle-rich">${richTextOnHover}</span>`;
};

export const getAnnotationsForRender = (dt: DictionaryTrack, target: TokenAnnotationConfigTarget) => {
    const enabledAnnotations = getEnabledAnnotations(dt);
    const enabledAnnotationsUnhover = getEnabledAnnotationsForHover(enabledAnnotations, dt, target, false);
    const enabledAnnotationsHover = getEnabledAnnotationsForHover(enabledAnnotations, dt, target, true);
    const glossSize = dt.dictionaryTokenAnnotationConfig[target].gloss.size;
    return {
        dt,
        glossSize,
        isRichTextEnabled: Object.values(enabledAnnotationsUnhover).some((v) => v),
        richTextEnabledAnnotations: enabledAnnotationsUnhover, // Hide annotations configured to appear only on hover
        isRichTextOnHoverEnabled: Object.values(enabledAnnotationsHover).some((v) => v),
        richTextOnHoverEnabledAnnotations: enabledAnnotations, // Show all enabled annotations on hover
    };
};

export interface RenderedRichText {
    richText?: string;
    richTextOnHover?: string;
}

interface CachedRenderedRichText extends RenderedRichText {
    text: string;
    tokenization?: Tokenization;
    tokenAnnotationTarget: TokenAnnotationConfigTarget;
    dictionaryTracks?: DictionaryTrack[];
}

const cachedRichTextIsCurrent = (
    cached: CachedRenderedRichText,
    subtitle: RichTextRenderable,
    tokenAnnotationTarget: TokenAnnotationConfigTarget,
    dictionaryTracks: DictionaryTrack[] | undefined
) =>
    cached.text === subtitle.text &&
    areTokenizationsEqual(cached.tokenization, subtitle.tokenization) &&
    cached.tokenAnnotationTarget === tokenAnnotationTarget &&
    cached.dictionaryTracks?.every((dt, i) => areDictionaryTracksEqual(dt, dictionaryTracks?.[i]));

interface IndexRange {
    min: number;
    max: number;
}

export interface RichTextWindow {
    range?: IndexRange;
    buffer: Map<number, CachedRenderedRichText>;
}

export const emptyRichTextWindow = (): RichTextWindow => ({ buffer: new Map() });

interface RichTextRenderable {
    index: number;
    text: string;
    track: number;
    tokenization?: Tokenization;
}

export const renderRichTextOntoSubtitles = (
    subtitles: readonly RichTextRenderable[],
    tokenAnnotationTarget: TokenAnnotationConfigTarget,
    dictionaryTracks: DictionaryTrack[] | undefined
): Map<number, RenderedRichText> => {
    const rendered = new Map<number, RenderedRichText>();
    if (dictionaryTracks?.length !== defaultSettings.dictionaryTracks.length) return rendered;

    const trackAnnotations = dictionaryTracks.map((dt) => getAnnotationsForRender(dt, tokenAnnotationTarget));
    const allowAsciiReading = false; // Allowing is only for preview purposes for status names to show reading

    for (const subtitle of subtitles) {
        if (!subtitle.tokenization) continue;
        const ta = trackAnnotations[subtitle.track];

        const richText = computeRichText(subtitle.text, subtitle.tokenization, {
            dt: ta.dt,
            enabledAnnotations: ta.richTextEnabledAnnotations,
            allowAsciiReading,
            glossSize: ta.glossSize,
        });
        const richTextOnHover = ta.isRichTextOnHoverEnabled
            ? computeRichText(subtitle.text, subtitle.tokenization, {
                  dt: ta.dt,
                  enabledAnnotations: ta.richTextOnHoverEnabledAnnotations,
                  allowAsciiReading,
                  glossSize: ta.glossSize,
              })
            : undefined;

        if (richText !== undefined || richTextOnHover !== undefined) {
            rendered.set(subtitle.index, { richText, richTextOnHover });
        }
    }

    return rendered;
};

export const renderRichTextWindow = (
    prev: RichTextWindow,
    windowSubtitles: RichTextRenderable[],
    tokenAnnotationTarget: TokenAnnotationConfigTarget,
    dictionaryTracks: DictionaryTrack[] | undefined
): RichTextWindow => {
    if (!windowSubtitles.length) return emptyRichTextWindow();
    const windowSubtitleIndexes = windowSubtitles.map((s) => s.index);
    const range: IndexRange = { min: Math.min(...windowSubtitleIndexes), max: Math.max(...windowSubtitleIndexes) };
    const buffer = new Map<number, CachedRenderedRichText>();

    const toRender: RichTextRenderable[] = [];
    for (const subtitle of windowSubtitles) {
        if (prev.range && subtitle.index >= prev.range.min && subtitle.index <= prev.range.max) {
            const reused = prev.buffer.get(subtitle.index);
            if (reused && cachedRichTextIsCurrent(reused, subtitle, tokenAnnotationTarget, dictionaryTracks)) {
                buffer.set(subtitle.index, reused);
                continue;
            }
        }
        toRender.push(subtitle);
    }
    if (toRender.length) {
        const rendered = renderRichTextOntoSubtitles(toRender, tokenAnnotationTarget, dictionaryTracks);
        for (const subtitle of toRender) {
            const value = rendered.get(subtitle.index);
            buffer.set(subtitle.index, {
                ...value,
                text: subtitle.text,
                tokenization: subtitle.tokenization,
                tokenAnnotationTarget,
                dictionaryTracks,
            });
        }
    }

    return { range, buffer };
};

export const renderRichTextForSubtitle = (
    window: RichTextWindow,
    subtitle: RichTextRenderable,
    tokenAnnotationTarget: TokenAnnotationConfigTarget,
    dictionaryTracks: DictionaryTrack[] | undefined
): RenderedRichText | undefined => {
    const cached = window.buffer.get(subtitle.index);
    if (cached && cachedRichTextIsCurrent(cached, subtitle, tokenAnnotationTarget, dictionaryTracks)) return cached;

    const rendered = renderRichTextOntoSubtitles([subtitle], tokenAnnotationTarget, dictionaryTracks).get(
        subtitle.index
    );
    window.buffer.set(subtitle.index, {
        ...rendered,
        text: subtitle.text,
        tokenization: subtitle.tokenization,
        tokenAnnotationTarget,
        dictionaryTracks,
    });
    return rendered;
};

interface TokenStyleState {
    dt: DictionaryTrack;
    enabledAnnotations: EnabledAnnotations;
    allowAsciiReading: boolean;
    glossSize: number;
}

export const computeRichText = (fullText: string, tokenization: Tokenization, ss: TokenStyleState) => {
    if (tokenization.error) return `<span ${ERROR_STYLE}>${fullText}</span>`;
    if (!tokenization.tokens.length) return;

    const parts: string[] = [];
    const prevPitch: PitchAccentContext = {}; // Context from the previous token to correctly determine pitch for attached particle
    iterateOverStringInBlocks(
        fullText,
        (_, blockIndex) => tokenization.tokens[blockIndex],
        (left, right, token?: Token) => {
            if (token === undefined) {
                clearPitchAccentContext(prevPitch);
                parts.push(fullText.substring(left, right));
            } else {
                parts.push(applyTokenStyle(fullText, token, prevPitch, ss));
            }
        }
    );
    return parts.join('');
};

const ERROR_STYLE = `style="text-decoration: line-through red 3px;"`;
const LOGIC_ERROR_STYLE = `style="text-decoration: line-through red 3px double;"`;

const addressableTokenWrapper = (tokenText: string, token: Token, style?: string) => {
    return `<span ${ASB_TOKEN_START_ATTRIBUTE}="${token.pos[0]}"${style ? ` ${style}` : ''}>${tokenText}</span>`;
};

const collectibleTokenWrapper = (tokenText: string, token: Token, ss: TokenStyleState, style?: string) => {
    const highlightClass =
        ss.enabledAnnotations.color && ss.dt.dictionaryHighlightOnHover ? ` ${ASB_TOKEN_HIGHLIGHT_CLASS}` : '';
    return `<span class="${ASB_TOKEN_CLASS}${highlightClass}" ${ASB_TOKEN_START_ATTRIBUTE}="${token.pos[0]}"${
        style ? ` ${style}` : ''
    }>${tokenText}</span>`;
};

const applyTokenStyle = (fullText: string, token: Token, prevPitch: PitchAccentContext, ss: TokenStyleState) => {
    const rawTokenText = fullText.substring(token.pos[0], token.pos[1]);
    if (!HAS_LETTER_REGEX.test(rawTokenText)) {
        clearPitchAccentContext(prevPitch);
        return rawTokenText;
    }
    const tokenText = applyGlossAnnotation(
        fullText,
        applyFrequencyAnnotation(applyReadingAnnotation(rawTokenText, token, prevPitch, ss), token, ss),
        token,
        ss,
        rawTokenText
    );
    if (token.status === null) return addressableTokenWrapper(tokenText, token, ERROR_STYLE);
    if (token.status === undefined && dictionaryTrackEnabled(ss.dt))
        return addressableTokenWrapper(tokenText, token, LOGIC_ERROR_STYLE); // External tokens may flash this on initial load
    if (!ss.enabledAnnotations.color) return addressableTokenWrapper(tokenText, token);

    const config = ss.dt.dictionaryTokenStatusConfig[token.status!];
    if (!config.display) return collectibleTokenWrapper(tokenText, token, ss);
    if (
        token.pitchAccent != null &&
        ss.enabledAnnotations.pitchAccent &&
        tokenText.includes(`class="${ASB_PITCH_ACCENT_CLASS}"`)
    ) {
        return collectibleTokenWrapper(tokenText, token, ss); // Only colorize the pitch accent when pitch accent is being shown
    }

    const c = `${config.color}${config.alpha}`;
    const t = ss.dt.dictionaryTokenStylingThickness;
    switch (ss.dt.dictionaryTokenStyling) {
        case TokenStyling.TEXT:
            return collectibleTokenWrapper(tokenText, token, ss, `style="-webkit-text-fill-color: ${c};"`);
        case TokenStyling.BACKGROUND:
            return collectibleTokenWrapper(tokenText, token, ss, `style="background-color: ${c};"`);
        case TokenStyling.UNDERLINE:
        case TokenStyling.OVERLINE:
            return collectibleTokenWrapper(
                tokenText,
                token,
                ss,
                `style="text-decoration: ${ss.dt.dictionaryTokenStyling} ${c} ${t}px;"`
            );
        case TokenStyling.OUTLINE:
            return collectibleTokenWrapper(tokenText, token, ss, `style="-webkit-text-stroke: ${t}px ${c};"`);
        default:
            return collectibleTokenWrapper(tokenText, token, ss, LOGIC_ERROR_STYLE);
    }
};

const applyReadingAnnotation = (
    tokenText: string,
    token: Token,
    prevPitch: PitchAccentContext,
    ss: TokenStyleState
) => {
    if (ONLY_ASCII_LETTERS_REGEX.test(tokenText) && !ss.allowAsciiReading) {
        clearPitchAccentContext(prevPitch);
        return tokenText; // Prevent english words from getting readings
    }
    if (!token.readings.length) {
        if (isKanaOnly(tokenText)) return applyPitchAccentAnnotation(tokenText, token, prevPitch, ss, tokenText);
        clearPitchAccentContext(prevPitch);
        return tokenText;
    }

    // Only apply skip logic for tokens generated by this class i.e. marked __internal: true
    if ((token as InternalToken).__internal) {
        if (!ss.enabledAnnotations.reading) {
            preservePitchAccentContext(tokenText, token, prevPitch, ss);
            return tokenText;
        }
        if (token.status == null || !shouldUseAnnotation('reading', token.status, token.states, ss.dt)) {
            preservePitchAccentContext(tokenText, token, prevPitch, ss);
            return tokenText;
        }
    }

    // We want to use a single reading for the entire token if we're applying pitch accent annotations.
    // e.g. 飛び切り readings would be `と き ` so make it contiguous as `とびきり` so connecting and reading pitch is easier
    const tokenForDisplay = { ...token };
    if (token.pitchAccent != null && ss.enabledAnnotations.pitchAccent) {
        tokenForDisplay.readings = [{ pos: [0, tokenText.length], reading: getContiguousReading(tokenText, token) }];
    }

    const parts: string[] = [];
    iterateOverStringInBlocks(
        tokenText,
        (_, blockIndex) => tokenForDisplay.readings[blockIndex],
        (left, right, reading?: TokenReading) => {
            if (reading === undefined) {
                parts.push(tokenText.substring(left, right));
            } else {
                const part = tokenText.substring(reading.pos[0], reading.pos[1]);
                const readingText = applyPitchAccentAnnotation(reading.reading, tokenForDisplay, prevPitch, ss);
                parts.push(`<ruby class="${ASB_READING_CLASS}">${part}<rt>${readingText}</rt></ruby>`);
            }
        }
    );
    return parts.join('');
};

const preservePitchAccentContext = (
    tokenText: string,
    token: Token,
    prevPitch: PitchAccentContext,
    ss: TokenStyleState
) => {
    if (token.status != null && token.pitchAccent != null && ss.enabledAnnotations.pitchAccent) {
        applyPitchAccentAnnotation(getContiguousReading(tokenText, token), token, prevPitch, ss);
    } else {
        clearPitchAccentContext(prevPitch);
    }
};

const glossGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const BASIC_LATIN_EM_WIDTH = 0.5; // Heuristic
const NON_BASIC_LATIN_EM_WIDTH = 1;
const basicLatinGraphemeRegex = /^\p{ASCII}+$/u;
const glossBracketPairs = new Map([
    ['(', ')'],
    ['（', '）'],
    ['[', ']'],
    ['［', '］'],
    ['【', '】'],
    ['{', '}'],
    ['｛', '｝'],
]);
const glossEntityPrefixRegex = /&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+)$/iu;
const glossSurroundingPunctuationRegex = /^[\s,，、.!！?？|｜•・]+|[\s,，、.!！?？|｜•・]+$/gu;
const escapeHtmlText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeHtmlAttribute = (text: string) => escapeHtmlText(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const removeBalancedGlossBrackets = (gloss: string) => {
    const graphemes = Array.from(glossGraphemeSegmenter.segment(gloss), ({ segment }) => segment);
    const stack: { grapheme: string; index: number }[] = [];
    const ranges: [number, number][] = [];

    for (const [index, grapheme] of graphemes.entries()) {
        if (glossBracketPairs.has(grapheme)) {
            stack.push({ grapheme, index });
            continue;
        }

        const opener = stack.at(-1);
        if (opener !== undefined && glossBracketPairs.get(opener.grapheme) === grapheme) {
            stack.pop();
            ranges.push([opener.index, index]);
        }
    }

    if (ranges.length === 0) return gloss;
    return graphemes.filter((_, index) => !ranges.some(([start, end]) => index >= start && index <= end)).join('');
};

const firstGlossSense = (gloss: string) => {
    for (let index = 0; index < gloss.length; index++) {
        const character = gloss[index];
        if (character === '；') return gloss.slice(0, index);
        if (character === ';' && !glossEntityPrefixRegex.test(gloss.slice(0, index))) return gloss.slice(0, index);
        if (
            (character === '|' || character === '｜' || character === '•' || character === '・') &&
            /\s/u.test(gloss[index - 1] ?? '') &&
            /\s/u.test(gloss[index + 1] ?? '')
        ) {
            return gloss.slice(0, index - 1);
        }
    }
    return gloss;
};

const compactGloss = (gloss: string) => {
    const normalizedGloss = gloss.replace(/\s+/gu, ' ').trim();
    const withoutBrackets = removeBalancedGlossBrackets(normalizedGloss);
    const firstSense = firstGlossSense(withoutBrackets);
    const compactedGloss = firstSense.replace(glossSurroundingPunctuationRegex, '').replace(/\s+/gu, ' ').trim();
    return compactedGloss || normalizedGloss;
};

const glossGraphemeWidth = (grapheme: string) =>
    basicLatinGraphemeRegex.test(grapheme) ? BASIC_LATIN_EM_WIDTH : NON_BASIC_LATIN_EM_WIDTH;
const glossTextWidth = (graphemes: string[]) =>
    graphemes.reduce((width, grapheme) => width + glossGraphemeWidth(grapheme), 0);
const fittingGlossGraphemeCount = (graphemes: string[], maxWidth: number) => {
    let width = 0;
    for (const [index, grapheme] of graphemes.entries()) {
        width += glossGraphemeWidth(grapheme);
        if (width > maxWidth) return Math.max(1, index);
    }
    return graphemes.length;
};

const lastWhitespaceIndex = (graphemes: string[], end: number) => {
    for (let index = end - 1; index > 0; index--) {
        if (/^\s$/u.test(graphemes[index])) return index;
    }
    return -1;
};

const glossLines = (gloss: string, rawTokenText: string, glossSize: number) => {
    const tokenGraphemes = Array.from(glossGraphemeSegmenter.segment(rawTokenText), ({ segment }) => segment);
    const glossGraphemes = Array.from(glossGraphemeSegmenter.segment(gloss), ({ segment }) => segment);
    const maxLineWidth = Math.max(BASIC_LATIN_EM_WIDTH, glossTextWidth(tokenGraphemes) / glossSize);
    if (glossTextWidth(glossGraphemes) <= maxLineWidth) return { lines: [gloss], truncated: false };

    const fittingFirstLineLength = fittingGlossGraphemeCount(glossGraphemes, maxLineWidth);
    // The separator itself does not need to fit because it is omitted at the line boundary.
    const whitespaceIndex = lastWhitespaceIndex(glossGraphemes, fittingFirstLineLength + 1);
    const splitOnWhitespace = whitespaceIndex >= 0;
    const firstLineLength = splitOnWhitespace
        ? whitespaceIndex
        : fittingGlossGraphemeCount(glossGraphemes, maxLineWidth - glossGraphemeWidth('-'));
    const firstLine = `${glossGraphemes.slice(0, firstLineLength).join('')}${splitOnWhitespace ? '' : '-'}`;
    const remainingGraphemes = glossGraphemes.slice(firstLineLength + (splitOnWhitespace ? 1 : 0));
    const secondLineLength = fittingGlossGraphemeCount(remainingGraphemes, maxLineWidth);
    if (secondLineLength === remainingGraphemes.length) {
        return {
            lines: [firstLine, remainingGraphemes.join('')],
            truncated: false,
        };
    }

    const truncatedSecondLineLength = fittingGlossGraphemeCount(
        remainingGraphemes,
        maxLineWidth - glossGraphemeWidth('-')
    );
    return {
        lines: [firstLine, `${remainingGraphemes.slice(0, truncatedSecondLineLength).join('')}-`],
        truncated: true,
    };
};

const applyGlossAnnotation = (
    fullText: string,
    tokenText: string,
    token: Token,
    ss: TokenStyleState,
    rawTokenText: string
) => {
    if (!ss.enabledAnnotations.gloss) return tokenText;
    if (token.gloss == null) return tokenText;
    if (token.status == null || !shouldUseAnnotation('gloss', token.status, token.states, ss.dt)) return tokenText;

    const lastNewlineIndex = fullText.lastIndexOf('\n');
    const positionClass = lastNewlineIndex >= 0 && token.pos[0] > lastNewlineIndex ? ` ${ASB_GLOSS_UNDER_CLASS}` : '';
    const className = `${ASB_GLOSS_CLASS}${positionClass}`;
    const { lines: rawLines, truncated } = glossLines(compactGloss(token.gloss), rawTokenText, ss.glossSize);
    const lines = rawLines.map(escapeHtmlText);
    const annotationText = (line: string) => `<span class="${ASB_GLOSS_TEXT_CLASS}">${line}</span>`;
    let annotatedToken: string;
    if (lines.length === 1) {
        annotatedToken = `<ruby class="${className}">${tokenText}<rt>${annotationText(lines[0])}</rt></ruby>`;
    } else {
        const [outerLine, innerLine] = positionClass ? [lines[1], lines[0]] : lines;
        annotatedToken = `<ruby class="${className}"><ruby class="${className}">${tokenText}<rt>${annotationText(innerLine)}</rt></ruby><rt>${annotationText(outerLine)}</rt></ruby>`;
    }

    if (!truncated) return annotatedToken;
    const fullGloss = escapeHtmlAttribute(token.gloss.replace(/\s+/gu, ' ').trim());
    return `<span class="${ASB_GLOSS_POPUP_CLASS}" data-asb-gloss="${fullGloss}">${annotatedToken}</span>`;
};

const applyPitchAccentAnnotation = (
    readingText: string,
    token: Token,
    prevPitch: PitchAccentContext,
    ss: TokenStyleState,
    attachedParticleCandidateText?: string
) => {
    if (!ss.enabledAnnotations.pitchAccent) {
        clearPitchAccentContext(prevPitch);
        return readingText;
    }
    if (!HAS_LETTER_REGEX.test(readingText)) {
        clearPitchAccentContext(prevPitch);
        return readingText;
    }

    const pitchAccentHtmlOrReading = (html: string) => {
        if (token.status == null || !shouldUseAnnotation('pitchAccent', token.status, token.states, ss.dt)) {
            return readingText;
        }
        return html;
    };

    const pitchAccentColor = () => {
        if (token.status == null || !ss.enabledAnnotations.color) return 'currentColor';
        const config = ss.dt.dictionaryTokenStatusConfig[token.status];
        if (!config.display) return 'currentColor';
        return `${config.color}${config.alpha}`;
    };

    if (prevPitch.prevMoras !== undefined && prevPitch.prevPitchAccent !== undefined) {
        const pitchHigh = isAttachedParticlePitchHigh(attachedParticleCandidateText, prevPitch);
        if (pitchHigh !== null) {
            prevPitch.prevMoras = undefined;
            prevPitch.prevPitchAccent = undefined;
            const html = pitchAccentHtml(getKanaMoras(readingText), pitchAccentColor(), () => pitchHigh, prevPitch);
            prevPitch.prevPitchHigh = undefined; // Draw vertical line for attached particles if pitched changed from previous token
            return pitchAccentHtmlOrReading(html);
        }
    }

    if (token.pitchAccent == null) {
        clearPitchAccentContext(prevPitch);
        return readingText;
    }

    const moras = getKanaMoras(readingText);
    prevPitch.prevMoras = moras;
    prevPitch.prevPitchAccent = token.pitchAccent;
    prevPitch.prevPitchHigh = undefined; // Only attached particles care about the change from the previous pitch
    const html = pitchAccentHtml(
        moras,
        pitchAccentColor(),
        (i) => isKanaMoraPitchHigh(i, token.pitchAccent!),
        prevPitch
    );
    if (!attachedParticleCandidateText) prevPitch.prevPitchHigh = undefined; // For furigana we don't want the vertical line since it won't be connected to the particle
    return pitchAccentHtmlOrReading(html);
};

const pitchAccentHtml = (
    moras: string[],
    color: string,
    pitchHigh: (index: number) => boolean,
    prevPitch: PitchAccentContext
) => {
    const parts: string[] = [];
    let prevHigh = prevPitch.prevPitchHigh;
    for (let i = 0; i < moras.length; i++) {
        const high = pitchHigh(i);
        if (prevHigh !== undefined && prevHigh !== high) {
            parts.push(`<span class="${ASB_PITCH_ACCENT_LINE_CLASS}"></span>`);
        }
        prevHigh = high;
        parts.push(
            `<span class="${ASB_PITCH_ACCENT_MORA_CLASS} ${
                high ? ASB_PITCH_ACCENT_MORA_HIGH_CLASS : ASB_PITCH_ACCENT_MORA_LOW_CLASS
            }">${moras[i]}</span>`
        );
    }
    prevPitch.prevPitchHigh = prevHigh;
    return `<span class="${ASB_PITCH_ACCENT_CLASS}" style="--asb-pitch-accent-color: ${color};">${parts.join('')}</span>`;
};

const applyFrequencyAnnotation = (tokenText: string, token: Token, ss: TokenStyleState) => {
    if (!ss.enabledAnnotations.frequency) return tokenText;
    if (token.frequency == null) return tokenText;
    if (token.status == null || !shouldUseAnnotation('frequency', token.status, token.states, ss.dt)) return tokenText;
    return `<ruby class="${ASB_FREQUENCY_CLASS}">${tokenText}<rt>${token.frequency}</rt></ruby>`;
};
