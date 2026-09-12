import type { IndexedSubtitleModel, Token } from '@project/common';
import type { SeekableTracks, TokenJumpTarget } from '@project/common/settings';
import { isTrackSeekable } from '@project/common/settings';
import { getContiguousReading, HAS_LETTER_REGEX, normalizeSearchText } from '@project/common/util';

export interface TokenSelectionLocation {
    subtitleIndex: number;
    tokenStart: number;
}

export interface TokenJumpMatch extends TokenSelectionLocation {
    subtitleArrayIndex: number;
    subtitle: IndexedSubtitleModel;
    token: Token;
}

export const tokenMatchesJumpTarget = (token: Token, target: TokenJumpTarget) => {
    if (target.kind === 'any') return true;
    if (target.kind === 'status') return token.status === target.value;
    return token.states.includes(target.value);
};

const sameLocation = (match: TokenSelectionLocation, location: TokenSelectionLocation) =>
    match.subtitleIndex === location.subtitleIndex && match.tokenStart === location.tokenStart;

export const tokenAtLocation = (
    subtitles: readonly IndexedSubtitleModel[] | undefined,
    location: TokenSelectionLocation
) => {
    const subtitle = subtitles?.find((subtitle) => subtitle.index === location.subtitleIndex);
    return subtitle?.tokenization?.tokens.find((token) => token.pos[0] === location.tokenStart);
};

const searchableTokenTexts = (subtitle: IndexedSubtitleModel, token: Token): string[] => {
    const tokenText = subtitle.text.substring(token.pos[0], token.pos[1]);
    const texts = [tokenText];
    // We want to use a single reading for the entire token if we're searching.
    // e.g. 飛び切り readings would be `と き ` so make it contiguous as `とびきり` so it matches user expectations.
    if (token.readings.length) {
        const readingText = getContiguousReading(tokenText, token);
        if (readingText) texts.push(readingText);
    }
    return texts;
};

export const findAdjacentTokenJumpMatch = <T extends IndexedSubtitleModel>(
    subtitles: readonly T[] | undefined,
    target: TokenJumpTarget,
    forward: boolean,
    currentTime: number,
    seekableTracks: SeekableTracks,
    currentSelection?: TokenSelectionLocation
): TokenJumpMatch | undefined => {
    if (!subtitles?.length) return;

    const seekableTokens: TokenJumpMatch[] = [];
    for (const [subtitleArrayIndex, subtitle] of subtitles.entries()) {
        if (!isTrackSeekable(seekableTracks, subtitle.track)) continue;
        const tokens = subtitle.tokenization?.tokens;
        if (!tokens?.length) continue;

        for (const token of tokens) {
            const rawTokenText = subtitle.text.substring(token.pos[0], token.pos[1]);
            if (!HAS_LETTER_REGEX.test(rawTokenText)) continue;
            seekableTokens.push({
                subtitleArrayIndex,
                subtitle,
                token,
                subtitleIndex: subtitle.index,
                tokenStart: token.pos[0],
            });
        }
    }

    if (!seekableTokens.length) return;

    if (currentSelection) {
        const currentIndex = seekableTokens.findIndex((token) => sameLocation(token, currentSelection));
        if (currentIndex !== -1) {
            for (let offset = 1; offset <= seekableTokens.length; ++offset) {
                const index =
                    (currentIndex + (forward ? offset : -offset) + seekableTokens.length) % seekableTokens.length;
                if (tokenMatchesJumpTarget(seekableTokens[index].token, target)) return seekableTokens[index];
            }
            return;
        }
    }

    const matches = seekableTokens.filter((token) => tokenMatchesJumpTarget(token.token, target));
    if (!matches.length) return;

    if (forward) return matches.find((match) => match.subtitle.end > currentTime) ?? matches[0];

    for (let i = matches.length - 1; i >= 0; --i) {
        if (matches[i].subtitle.start <= currentTime) return matches[i];
    }
    return matches[matches.length - 1];
};

export const findTokenContainingSearch = <T extends IndexedSubtitleModel>(
    subtitle: T | undefined,
    searchTerms: readonly string[],
    regex?: RegExp
): TokenSelectionLocation | undefined => {
    if (!subtitle) return;
    const tokens = subtitle.tokenization?.tokens;
    if (!tokens?.length) return;

    for (const token of tokens) {
        const tokenTexts = searchableTokenTexts(subtitle, token);
        const rawTokenText = tokenTexts[0];
        if (!HAS_LETTER_REGEX.test(rawTokenText)) continue;
        const containsTerm = searchTerms.some((term) => {
            const normalizedTerm = normalizeSearchText(term);
            return tokenTexts.some((text) => normalizeSearchText(text).includes(normalizedTerm));
        });
        const matchesRegex =
            regex !== undefined &&
            tokenTexts.some((text) => {
                regex.lastIndex = 0;
                return regex.test(text);
            });

        if (!containsTerm && !matchesRegex) continue;

        return { subtitleIndex: subtitle.index, tokenStart: token.pos[0] };
    }
};
