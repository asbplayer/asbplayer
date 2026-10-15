import type { IndexedSubtitleModel, Token } from '@project/common';
import type { DictionaryPlaybackConfig, DictionaryPlaybackFeature } from '@project/common/settings';
import { dictionaryPlaybackFeatureEnabled } from '@project/common/settings';
import { HAS_LETTER_REGEX } from '@project/common/util';

type TokenizedText = Pick<IndexedSubtitleModel, 'text' | 'tokenization'>;

export interface SubtitleWordVisibility {
    readonly hiddenTokens: ReadonlySet<Token>;
    readonly hideWholeSubtitle: boolean;
}

// Published token arrays are never mutated (annotation rebuilds replace them), so word tokens keyed on the array
// stay valid across plan rebuilds and renders. Text is checked because it is stored beside the tokenization.
const wordTokensCache = new WeakMap<readonly Token[], { readonly text: string; readonly tokens: readonly Token[] }>();
const noWordVisibility: SubtitleWordVisibility = { hiddenTokens: new Set(), hideWholeSubtitle: false };

export const wordTokens = (subtitle: TokenizedText): readonly Token[] => {
    const tokens = subtitle.tokenization?.tokens;
    if (!tokens) return [];
    const cached = wordTokensCache.get(tokens);
    if (cached?.text === subtitle.text) return cached.tokens;
    const words = tokens.filter((token) => HAS_LETTER_REGEX.test(subtitle.text.slice(...token.pos)));
    wordTokensCache.set(tokens, { text: subtitle.text, tokens: words });
    return words;
};

/** Evaluated while a playback plan is built; status counts are independent for each status and state. */
export function matchingPlaybackTokens(
    subtitle: TokenizedText,
    config: DictionaryPlaybackConfig,
    feature: DictionaryPlaybackFeature
): Token[] {
    if (!dictionaryPlaybackFeatureEnabled(config, feature)) return [];
    return matchingTokens(wordTokens(subtitle), config, feature);
}

function matchingTokens(
    tokens: readonly Token[],
    config: DictionaryPlaybackConfig,
    feature: DictionaryPlaybackFeature
): Token[] {
    const { rules, onStatuses, onStates } = config[feature];
    const statusCounts = new Map<number, number>();
    const stateCounts = new Map<number, number>();
    if (rules.minWords || rules.maxWords) {
        for (const token of tokens) {
            if (token.status != null) statusCounts.set(token.status, (statusCounts.get(token.status) ?? 0) + 1);
            for (const state of new Set(token.states)) stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
        }
    }
    const matchesWordCount = (count: number) => count >= rules.minWords && (!rules.maxWords || count <= rules.maxWords);
    return tokens.filter((token) => {
        const frequency = token.frequency ?? 1;
        if (frequency < rules.minFrequency || (rules.maxFrequency > 0 && frequency > rules.maxFrequency)) return false;
        const statusMatches =
            token.status != null &&
            onStatuses[token.status].enabled &&
            matchesWordCount(statusCounts.get(token.status) ?? 0);
        const stateMatches = token.states.some(
            (state) => onStates[state].enabled && matchesWordCount(stateCounts.get(state) ?? 0)
        );
        return Boolean(statusMatches || stateMatches);
    });
}

/** Uses the same token matches for individual-word hiding and the whole-subtitle threshold. */
export function subtitleWordVisibility(
    subtitle: TokenizedText,
    config: DictionaryPlaybackConfig
): SubtitleWordVisibility {
    if (!dictionaryPlaybackFeatureEnabled(config, 'wordVisibility')) return noWordVisibility;
    const tokens = wordTokens(subtitle);
    const matching = matchingTokens(tokens, config, 'wordVisibility');
    const shownTokens = new Set(matching);
    return {
        hiddenTokens: new Set(tokens.filter((token) => !shownTokens.has(token))),
        hideWholeSubtitle: meetsWholeVisibilityThreshold(
            subtitle.text,
            tokens,
            tokens.length - matching.length,
            config.wordVisibility.wholeSubtitleMatchThreshold
        ),
    };
}

function meetsWholeVisibilityThreshold(
    text: string,
    tokens: readonly Token[],
    hiddenCount: number,
    threshold: number
): boolean {
    if (!hiddenCount) return false;

    // Letter-bearing text outside tokenization remains visible, while punctuation does not count.
    const covered = new Uint8Array(text.length);
    for (const token of tokens) for (let i = token.pos[0]; i < token.pos[1]; i++) covered[i] = 1;
    let unmatchedUntokenizedWords = 0;
    let inUntokenizedWord = false;
    for (let offset = 0; offset < text.length; ) {
        const character = String.fromCodePoint(text.codePointAt(offset)!);
        const untokenizedLetter = HAS_LETTER_REGEX.test(character) && !covered[offset];
        if (untokenizedLetter && !inUntokenizedWord) unmatchedUntokenizedWords++;
        inUntokenizedWord = untokenizedLetter;
        offset += character.length;
    }

    return hiddenCount / (tokens.length + unmatchedUntokenizedWords) >= threshold;
}
