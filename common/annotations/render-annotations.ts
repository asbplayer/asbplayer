import { Token, Tokenization, TokenReading } from '@project/common';
import {
    areDictionaryTracksEqual,
    DictionaryTrack,
    dictionaryTrackEnabled,
    TokenStyling,
    getEnabledAnnotations,
    getEnabledAnnotationsForHover,
    EnabledAnnotations,
    defaultSettings,
    shouldUseAnnotation,
    TokenAnnotationConfigTarget,
} from '@project/common/settings';
import {
    HAS_LETTER_REGEX,
    iterateOverStringInBlocks,
    ONLY_ASCII_LETTERS_REGEX,
    areTokenizationsEqual,
    isKanaOnly,
    getKanaMoras,
    isKanaMoraPitchHigh,
    isAttachedParticlePitchHigh,
    PitchAccentContext,
    clearPitchAccentContext,
} from '@project/common/util';
import {
    ASB_FREQUENCY_CLASS,
    ASB_PITCH_ACCENT_CLASS,
    ASB_PITCH_ACCENT_LINE_CLASS,
    ASB_PITCH_ACCENT_MORA_CLASS,
    ASB_PITCH_ACCENT_MORA_HIGH_CLASS,
    ASB_PITCH_ACCENT_MORA_LOW_CLASS,
    ASB_READING_CLASS,
    ASB_TOKEN_CLASS,
    ASB_TOKEN_HIGHLIGHT_CLASS,
} from '@project/common/annotations';

export const ANNOTATIONS_VIDEO_RENDER_BEHIND_MS = 15000; // Seeking backwards is usually 5-10s
export const ANNOTATIONS_VIDEO_RENDER_AHEAD_MS = 60000; // Seeking forward is usually 5-30s

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
    return {
        dt,
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
    subtitles: RichTextRenderable[],
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
        const hasExternalReading = subtitle.tokenization.tokens.some(
            (token) => !(token as InternalToken).__internal && token.readings.length > 0
        ); // Display external readings even if no annotations are enabled, unnecessary for richTextOnHover

        const richText =
            ta.isRichTextEnabled || hasExternalReading
                ? computeRichText(subtitle.text, subtitle.tokenization, {
                      dt: ta.dt,
                      enabledAnnotations: ta.richTextEnabledAnnotations,
                      allowAsciiReading,
                  })
                : undefined;
        const richTextOnHover = ta.isRichTextOnHoverEnabled
            ? computeRichText(subtitle.text, subtitle.tokenization, {
                  dt: ta.dt,
                  enabledAnnotations: ta.richTextOnHoverEnabledAnnotations,
                  allowAsciiReading,
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

const applyTokenStyle = (fullText: string, token: Token, prevPitch: PitchAccentContext, ss: TokenStyleState) => {
    const rawTokenText = fullText.substring(token.pos[0], token.pos[1]);
    if (!HAS_LETTER_REGEX.test(rawTokenText)) {
        clearPitchAccentContext(prevPitch);
        return rawTokenText;
    }
    const tokenText = applyFrequencyAnnotation(applyReadingAnnotation(rawTokenText, token, prevPitch, ss), token, ss);
    if (token.status === null) return `<span ${ERROR_STYLE}>${tokenText}</span>`;
    if (token.status === undefined && dictionaryTrackEnabled(ss.dt))
        return `<span ${LOGIC_ERROR_STYLE}>${tokenText}</span>`; // External tokens may flash this on initial load
    if (!ss.enabledAnnotations.color) return tokenText;

    const s = `<span class="${ASB_TOKEN_CLASS}${ss.dt.dictionaryHighlightOnHover ? ` ${ASB_TOKEN_HIGHLIGHT_CLASS}` : ''}"`; // Only allow collection and highlighting if colors is enabled so that user has feedback
    const config = ss.dt.dictionaryTokenStatusConfig[token.status!];
    if (!config.display) return `${s}>${tokenText}</span>`;
    if (
        token.pitchAccent != null &&
        ss.enabledAnnotations.pitchAccent &&
        (!token.readings.length ||
            (ss.enabledAnnotations.reading && shouldUseAnnotation('reading', token.status!, token.states, ss.dt)))
    ) {
        return `${s}>${tokenText}</span>`; // Colorize the pitch accent annotation only when being shown
    }

    const c = `${config.color}${config.alpha}`;
    const t = ss.dt.dictionaryTokenStylingThickness;
    switch (ss.dt.dictionaryTokenStyling) {
        case TokenStyling.TEXT:
            return `${s} style="-webkit-text-fill-color: ${c};">${tokenText}</span>`;
        case TokenStyling.BACKGROUND:
            return `${s} style="background-color: ${c};">${tokenText}</span>`;
        case TokenStyling.UNDERLINE:
        case TokenStyling.OVERLINE:
            return `${s} style="text-decoration: ${ss.dt.dictionaryTokenStyling} ${c} ${t}px;">${tokenText}</span>`;
        case TokenStyling.OUTLINE:
            return `${s} style="-webkit-text-stroke: ${t}px ${c};">${tokenText}</span>`;
        default:
            return `${s} ${LOGIC_ERROR_STYLE}>${tokenText}</span>`;
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
            clearPitchAccentContext(prevPitch);
            return tokenText;
        }
        if (token.status == null || !shouldUseAnnotation('reading', token.status, token.states, ss.dt)) {
            clearPitchAccentContext(prevPitch);
            return tokenText;
        }
    }

    // We want to use a single reading for the entire token if we're applying pitch accent annotations.
    // e.g. 飛び切り readings would be `と き ` so make it contiguous as `とびきり` so connecting and reading pitch is easier
    const tokenForDisplay = { ...token };
    if (token.pitchAccent != null && ss.enabledAnnotations.pitchAccent) {
        tokenForDisplay.readings = [{ pos: [0, tokenText.length], reading: '' }];
        iterateOverStringInBlocks(
            tokenText,
            (_, blockIndex) => token.readings[blockIndex],
            (left, right, reading?: TokenReading) => {
                if (reading === undefined) tokenForDisplay.readings[0].reading += tokenText.substring(left, right);
                else tokenForDisplay.readings[0].reading += reading.reading;
            }
        );
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
            return html;
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
    return html;
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
