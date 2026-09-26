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

const sameLocation = (location: TokenSelectionLocation, subtitleIndex: number, tokenStart: number) =>
    location.subtitleIndex === subtitleIndex && location.tokenStart === tokenStart;

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

    type MatchPosition = { subtitleArrayIndex: number; tokenArrayIndex: number };
    const emptyPosition = (): MatchPosition => ({ subtitleArrayIndex: -1, tokenArrayIndex: -1 });
    const firstMatch = emptyPosition();
    const firstFutureMatch = emptyPosition();
    const lastPastMatch = emptyPosition();
    const lastMatch = emptyPosition();
    const lastMatchBeforeSelection = emptyPosition();
    let currentSelectionFound = false;

    const makeMatch = (position: MatchPosition): TokenJumpMatch | undefined => {
        if (position.subtitleArrayIndex === -1) return;
        const subtitle = subtitles[position.subtitleArrayIndex];
        const token = subtitle.tokenization?.tokens[position.tokenArrayIndex];
        if (!token) return;
        return {
            subtitleArrayIndex: position.subtitleArrayIndex,
            subtitle,
            token,
            subtitleIndex: subtitle.index,
            tokenStart: token.pos[0],
        };
    };

    for (const [subtitleArrayIndex, subtitle] of subtitles.entries()) {
        if (!isTrackSeekable(seekableTracks, subtitle.track)) continue;
        const tokens = subtitle.tokenization?.tokens;
        if (!tokens?.length) continue;

        for (const [tokenArrayIndex, token] of tokens.entries()) {
            const rawTokenText = subtitle.text.substring(token.pos[0], token.pos[1]);
            if (!HAS_LETTER_REGEX.test(rawTokenText)) continue;

            const isCurrentSelection =
                !!currentSelection && sameLocation(currentSelection, subtitle.index, token.pos[0]);
            const matchesTarget = tokenMatchesJumpTarget(token, target);
            if (matchesTarget) {
                if (firstMatch.subtitleArrayIndex === -1) {
                    firstMatch.subtitleArrayIndex = subtitleArrayIndex;
                    firstMatch.tokenArrayIndex = tokenArrayIndex;
                }
                lastMatch.subtitleArrayIndex = subtitleArrayIndex;
                lastMatch.tokenArrayIndex = tokenArrayIndex;

                if (firstFutureMatch.subtitleArrayIndex === -1 && subtitle.end > currentTime) {
                    firstFutureMatch.subtitleArrayIndex = subtitleArrayIndex;
                    firstFutureMatch.tokenArrayIndex = tokenArrayIndex;
                }
                if (subtitle.start <= currentTime) {
                    lastPastMatch.subtitleArrayIndex = subtitleArrayIndex;
                    lastPastMatch.tokenArrayIndex = tokenArrayIndex;
                }
                if (!currentSelectionFound && !isCurrentSelection) {
                    lastMatchBeforeSelection.subtitleArrayIndex = subtitleArrayIndex;
                    lastMatchBeforeSelection.tokenArrayIndex = tokenArrayIndex;
                }
            }

            if (isCurrentSelection) {
                currentSelectionFound = true;
            } else if (currentSelectionFound && forward && matchesTarget) {
                return makeMatch({ subtitleArrayIndex, tokenArrayIndex });
            }
        }
    }

    if (currentSelectionFound) {
        if (forward) return makeMatch(firstMatch);
        return makeMatch(lastMatchBeforeSelection) ?? makeMatch(lastMatch);
    }

    if (forward) return makeMatch(firstFutureMatch) ?? makeMatch(firstMatch);
    return makeMatch(lastPastMatch) ?? makeMatch(lastMatch);
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
