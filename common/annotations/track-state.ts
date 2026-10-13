import { isKanaOnly, normalizeToken } from '@project/common/util';
import type { DictionaryTrack, TokenState } from '@project/common/settings';
import { DictionaryTokenSource, TokenMatchStrategy } from '@project/common/settings';
import type { Yomitan } from '@project/common/yomitan';
import { TokenCollection, TokenCollectionArray } from '@project/common/annotations/token-collection';

/**
 * Contains all information specific to a track
 */
export class TrackState {
    readonly track: number;
    readonly dt: DictionaryTrack;
    readonly yt: Yomitan | undefined;
    readonly ytLastResetAt: number;
    readonly tokenCollectionExact: TokenCollection;
    readonly tokenCollectionLemma: TokenCollection;
    readonly tokenCollectionAny: TokenCollectionArray;
    readonly tokenStates: Map<string, TokenState[]>;
    readonly indexTokenOccurrences: Map<number, Map<string, number>>;

    constructor(track: number, dt: DictionaryTrack) {
        this.track = track;
        this.dt = dt;
        this.yt = undefined;
        this.ytLastResetAt = 0;
        this.tokenStates = new Map();
        this.indexTokenOccurrences = new Map();

        /**
         * The logic will need to be revisited if new states are added.
         * States come from local records, even when an external record supplies the status.
         */
        const updateTokenStates = (normalizedToken: string, states: TokenState[]) => {
            if (!states.length) return;
            const existingStates = this.tokenStates.get(normalizedToken);
            if (!existingStates) {
                this.tokenStates.set(normalizedToken, states);
                return;
            }
            for (const state of states) {
                if (!existingStates.includes(state)) existingStates.push(state);
            }
        };
        this.tokenCollectionExact = new TokenCollection(TokenMatchStrategy.EXACT_FORM_COLLECTED, dt, updateTokenStates);
        this.tokenCollectionLemma = new TokenCollection(TokenMatchStrategy.LEMMA_FORM_COLLECTED, dt, updateTokenStates);
        this.tokenCollectionAny = new TokenCollectionArray(
            TokenMatchStrategy.ANY_FORM_COLLECTED,
            dt,
            updateTokenStates
        );
    }

    updateDictionaryTrack(dt: DictionaryTrack) {
        (this.dt as any) = dt;
        this.tokenCollectionExact.updateDictionaryTrack(dt);
        this.tokenCollectionLemma.updateDictionaryTrack(dt);
        this.tokenCollectionAny.updateDictionaryTrack(dt);
    }

    updateYomitan(yt: Yomitan | undefined) {
        (this.yt as any) = yt;
    }

    resetYomitan() {
        (this.ytLastResetAt as any) = Date.now();
        if (!this.yt) return;
        this.yt.resetCache();
        this.updateYomitan(undefined);
    }

    /**
     * How to filter based on the dictionaryMatchAcrossScripts setting:
     * If the tokens between subtitles and collection don't ever contain kana (not Japanese) then these checks do nothing.
     * This feature (and multiple lemmas) currently only apply to Japanese but could be expanded for other languages.
     *
     * if dictionaryMatchAcrossScripts:
     *   - Kana subtitles can match kanji in collection, could be homophones but text processing can't handle it so we allow it.
     *   - Kanji subtitles only match with kanji in collection, prevents kana collected matches all kanji homophones.
     * if not dictionaryMatchAcrossScripts:
     *   - Never match across scripts, downside is if kanji is collected kana will need to be collected too.
     *   - Essentially a strict mode where the user needs to collect all script forms of a word.
     */
    private lemmasForScript(trimmedToken: string, lemmas: readonly string[]): readonly string[] {
        const tokenIsKanaOnly = isKanaOnly(trimmedToken);
        if (tokenIsKanaOnly && this.dt.dictionaryMatchAcrossScripts) return lemmas;
        return lemmas.filter((lemma) => isKanaOnly(lemma) === tokenIsKanaOnly);
    }

    async lemmatizeForScript(trimmedToken: string, normalize = true) {
        const rawLemmas = await this.yt!.lemmatize(trimmedToken);
        if (!rawLemmas) return;
        const lemmas = this.lemmasForScript(trimmedToken, rawLemmas);
        return normalize ? lemmas.map(normalizeToken) : lemmas;
    }

    groupingKeysForToken(
        trimmedToken: string,
        lemmas: readonly string[],
        source: DictionaryTokenSource | undefined
    ): { groupingKey: string; lemmasGroupingKey?: string } {
        const groupingKey = trimmedToken;
        let lemmasGroupingKey: string | undefined;

        const strategy =
            source === DictionaryTokenSource.ANKI_SENTENCE
                ? this.dt.dictionaryAnkiSentenceTokenMatchStrategy
                : this.dt.dictionaryTokenMatchStrategy;
        if (
            strategy === TokenMatchStrategy.ANY_FORM_COLLECTED ||
            strategy === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED ||
            strategy === TokenMatchStrategy.LEMMA_FORM_COLLECTED
        ) {
            const groupingLemmas = this.lemmasForScript(trimmedToken, lemmas);
            if (groupingLemmas.length) lemmasGroupingKey = JSON.stringify(Array.from(new Set(groupingLemmas)).sort());
        }

        return { groupingKey, lemmasGroupingKey };
    }
}
