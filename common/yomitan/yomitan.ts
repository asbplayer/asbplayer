import { Fetcher, HttpFetcher, Progress } from '@project/common';
import { DictionaryTrack } from '@project/common/settings';
import {
    AsyncSemaphore,
    fromBatches,
    HAS_LETTER_REGEX,
    inBatches,
    isKanaOnly,
    NEWLINES_REGEX,
    STERM_AND_NEWLINES_REGEX,
} from '@project/common/util';
import { coerce, lt, gte } from 'semver';

const TOKENIZE_BATCH_SIZE = 100; // 1k can cause 1.5GB memory on Yomitan for subtitles, Anki cards may be larger too
const TERM_ENTRIES_BATCH_SIZE = 10; // 100 is only 10% faster (17s vs 19s for a 23min subtitle)
const BATCH_FAIL_THRESHOLD = 3; // If we fail this many times due to batch size, reduce the batch size permanently.
const TERM_ENTRIES_DEBOUNCE_MS = 10; // Prevents using too much resources
const FREQUENCY_MODE_INFERENCE_GROUP_SIZE = 10;
const FREQUENCY_MODE_INFERENCE_RANK_BASED_MATCHES = 7;

const YEAR_MONTH_REGEX = /(?<year>20\d{2})(?<month>[01]\d)/;

export interface TokenPart {
    text: string;
    reading: string;
}

interface TokenPartResult extends TokenPart {
    lemma?: string;
    lemmaReading?: string;
    headwords?: TermHeadword[][];
}

interface TermHeadword {
    index: number;
    headwordIndex?: number;
    term: string;
    reading: string;
    sources: TermSource[];
    frequencies?: TermFrequency[];
    pronunciations?: TermPronunciation[];
}

interface TermSource {
    originalText: string;
    transformedText: string;
    deinflectedText: string;
    matchType: 'exact' | 'prefix' | 'suffix';
    matchSource: 'term' | 'reading' | 'sequence';
    isPrimary: boolean;
}

type FrequencyMode = 'rank-based' | 'occurrence-based';
interface TermFrequency {
    index: number;
    headwordIndex: number;
    dictionary: string;
    dictionaryIndex: number;
    dictionaryAlias: string;
    hasReading: boolean;
    frequencyMode?: FrequencyMode | null;
    frequency: number;
    displayValue: string | null;
    displayValueParsed: boolean;
}

/**
 * number: Mora position of the pitch accent downstep. A value of 0 indicates that the word does not have a downstep (heiban).
 * string: Pitch level of each mora with H representing high and L representing low. For example: HHLL for a 4 mora word. Add an additional pitch level at the end to explicitly define the suffix.
 *   - pattern: /^[HL]+$/
 */
export type PitchAccentPosition = number | string;
interface PitchAccent {
    type: 'pitch-accent';
    positions: PitchAccentPosition;
    nasalPositions: number[];
    devoicePositions: number[];
    tags: object[];
}

interface PhoneticTranscription {
    type: 'phonetic-transcription';
    ipa: string;
    tags: object[];
}

interface TermPronunciation {
    index: number;
    headwordIndex: number;
    dictionary: string;
    dictionaryIndex: number;
    dictionaryAlias: string;
    pronunciations: (PitchAccent | PhoneticTranscription)[];
}

interface TokenizeResult {
    id: string;
    source: string;
    dictionary: string;
    index: number;
    content: TokenPartResult[][];
}

interface TermEntriesResult {
    dictionaryEntries: TermDictionaryEntry[];
    originalTextLength: number;
    index: number;
}

interface TermDictionaryEntry {
    headwords: TermHeadword[];
    frequencies: TermFrequency[];
    pronunciations: TermPronunciation[];
}

export class Yomitan {
    private readonly dt: DictionaryTrack;
    private readonly fetcher: Fetcher;
    private readonly asyncSemaphore: AsyncSemaphore;
    private readonly tokenizeCache: Map<string, TokenPart[][]>;
    private readonly lemmatizeCache: Map<string, string[]>;
    private readonly frequencyCache: Map<string, number | null>;
    private readonly pitchAccentCache: Map<string, PitchAccentPosition | null>;
    private readonly frequencyModeInferenceData: Map<string, Map<string, number>>;
    private readonly inferredFrequencyModes: Map<string, FrequencyMode>;
    private readonly lemmaTokenFallback: boolean; // Allow collecting ungrouped segments (no dictionary entry)
    private readonly tokensWereModified?: (token: string) => void;
    private supportsMecab: boolean;
    private supportsMecabLemma: boolean;
    private supportsTokenizeFrequency: boolean;
    private supportsTokenizePronunciations: boolean;
    private supportsTermEntriesBulk: boolean;
    private lastCancelledAt: number;
    private tokenizeBatchSize: number;
    private tokenizeBatchFailCount: number;
    private termEntriesBatchSize: number;
    private termEntriesBatchFailCount: number;

    constructor(
        dictionaryTrack: DictionaryTrack,
        fetcher = new HttpFetcher(),
        options?: { lemmaTokenFallback: boolean; tokensWereModified: (token: string) => void }
    ) {
        this.dt = dictionaryTrack;
        this.fetcher = fetcher;
        this.asyncSemaphore = new AsyncSemaphore({ permits: 1 });
        this.tokenizeCache = new Map();
        this.lemmatizeCache = new Map();
        this.frequencyCache = new Map();
        this.pitchAccentCache = new Map();
        this.frequencyModeInferenceData = new Map();
        this.inferredFrequencyModes = new Map();
        this.lemmaTokenFallback = options?.lemmaTokenFallback ?? false;
        this.tokensWereModified = options?.tokensWereModified;
        this.supportsMecab = false;
        this.supportsMecabLemma = false;
        this.supportsTokenizeFrequency = false;
        this.supportsTokenizePronunciations = false;
        this.supportsTermEntriesBulk = false;
        this.lastCancelledAt = 0;
        this.tokenizeBatchSize = TOKENIZE_BATCH_SIZE;
        this.tokenizeBatchFailCount = 0;
        this.termEntriesBatchSize = TERM_ENTRIES_BATCH_SIZE;
        this.termEntriesBatchFailCount = 0;
    }

    getSupportsMecab(): boolean {
        return this.supportsMecab;
    }

    getSupportsMecabLemma(): boolean {
        return this.supportsMecabLemma;
    }

    getSupportsTermEntriesBulk(): boolean {
        return this.supportsTermEntriesBulk;
    }

    getSupportsBulkFrequency(): boolean {
        if (this.dt.dictionaryYomitanParser === 'scanning-parser') return this.supportsTokenizeFrequency;
        return this.supportsTermEntriesBulk;
    }

    getSupportsBulkPitchAccent(): boolean {
        if (this.dt.dictionaryYomitanParser === 'scanning-parser') return this.supportsTokenizePronunciations;
        return this.supportsTermEntriesBulk;
    }

    resetCache() {
        this.tokenizeCache.clear();
        this.lemmatizeCache.clear();
        this.frequencyCache.clear();
        this.pitchAccentCache.clear();
        this.frequencyModeInferenceData.clear();
        this.inferredFrequencyModes.clear();
        this.lastCancelledAt = Date.now();
    }

    async splitAndTokenizeBulk(
        text: string,
        statusUpdates?: (progress: Progress) => Promise<void>,
        yomitanUrl?: string
    ): Promise<TokenPart[][]> {
        return this.tokenizeBulk(
            text
                .split(STERM_AND_NEWLINES_REGEX)
                .map((p) => p.trim())
                .filter((p) => HAS_LETTER_REGEX.test(p)),
            statusUpdates,
            yomitanUrl
        );
    }

    async tokenize(text: string, yomitanUrl?: string): Promise<TokenPart[][]> {
        let tokens = this.tokenizeCache.get(text);
        if (tokens) return tokens;
        tokens = [];

        if (this.dt.dictionaryYomitanParser === 'mecab' && !this.getSupportsMecab()) {
            throw new Error('Yomitan is not configured to support MeCab');
        }
        const res: TokenizeResult[] = await this._executeAction(
            'tokenize',
            { text, scanLength: this.dt.dictionaryYomitanScanLength, parser: this.dt.dictionaryYomitanParser },
            yomitanUrl
        );
        if (!Array.isArray(res)) throw new Error(`Unexpected Yomitan tokenize response: ${JSON.stringify(res)}`);
        const tokenizeResults = this.filterDictionaries(res, this.dt.dictionaryYomitanParser);

        const newlines: { text: string; index: number }[] = [];
        for (const m of text.matchAll(NEWLINES_REGEX)) newlines.push({ text: m[0], index: m.index });

        for (const tokenizeResult of tokenizeResults) this.cacheFromTokenize(tokenizeResult, tokens, newlines); // Requires this.filterDictionaries to ensure one tokenizeResult per index
        this.tokenizeCache.set(text, tokens);
        return tokens;
    }

    async tokenizeBulk(
        allTexts: string[],
        statusUpdates?: (progress: Progress) => Promise<void>,
        yomitanUrl?: string,
        batchSize = this.tokenizeBatchSize
    ): Promise<TokenPart[][]> {
        let batchError = false;
        try {
            return await fromBatches(
                allTexts,
                async (texts) => {
                    const tokensByText: TokenPart[][][] = [];
                    const textsToFetch: string[] = [];
                    const fetchedTextIndices: number[] = [];
                    const newlinesByText: { text: string; index: number }[][] = [];
                    for (const [index, text] of texts.entries()) {
                        const tokensForText = this.tokenizeCache.get(text);
                        if (tokensForText) {
                            tokensByText[index] = tokensForText;
                            continue;
                        }
                        textsToFetch.push(text);
                        fetchedTextIndices.push(index);
                        const newlines: { text: string; index: number }[] = [];
                        for (const m of text.matchAll(NEWLINES_REGEX)) newlines.push({ text: m[0], index: m.index });
                        newlinesByText.push(newlines);
                    }
                    if (!textsToFetch.length) return tokensByText.flat();

                    if (this.dt.dictionaryYomitanParser === 'mecab' && !this.getSupportsMecab()) {
                        throw new Error('Yomitan is not configured to support MeCab');
                    }
                    const res: TokenizeResult[] | string = await this._executeAction(
                        'tokenize',
                        {
                            text: textsToFetch,
                            scanLength: this.dt.dictionaryYomitanScanLength,
                            parser: this.dt.dictionaryYomitanParser,
                        },
                        yomitanUrl
                    );
                    if (!Array.isArray(res)) {
                        if (typeof res === 'string' && res.includes('exceed')) batchError = true; // {"message":"Message exceeded maximum allowed size of 64MiB."}
                        throw new Error(`Unexpected Yomitan tokenize response: ${JSON.stringify(res)}`);
                    }
                    const tokenizeResults = this.filterDictionaries(res, this.dt.dictionaryYomitanParser);

                    // Requires this.filterDictionaries to ensure one tokenizeResult per index
                    for (const tokenizeResult of tokenizeResults) {
                        const tokensForText: TokenPart[][] = [];
                        this.cacheFromTokenize(tokenizeResult, tokensForText, newlinesByText[tokenizeResult.index]);
                        this.tokenizeCache.set(textsToFetch[tokenizeResult.index], tokensForText);
                        tokensByText[fetchedTextIndices[tokenizeResult.index]] = tokensForText;
                    }

                    if (this.dt.dictionaryYomitanParser !== 'scanning-parser' && this.supportsTermEntriesBulk) {
                        const termsToFetch = new Set<string>();
                        for (const tokenizeResult of tokenizeResults) {
                            for (const tokenParts of tokenizeResult.content) {
                                const tokenPart = tokenParts[0];
                                if (!tokenPart) continue;
                                const token = tokenParts
                                    .map((p) => p.text)
                                    .join('')
                                    .trim();
                                termsToFetch.add(token);
                            }
                        }
                        await this.termEntriesBulk(Array.from(termsToFetch), false, yomitanUrl);
                    }

                    return tokensByText.flat();
                },
                { batchSize, statusUpdates }
            );
        } catch (e) {
            if (!batchError || batchSize <= 1) throw e;
            ++this.tokenizeBatchFailCount;
            if (this.tokenizeBatchFailCount >= BATCH_FAIL_THRESHOLD) {
                const newDefaultBatchSize = Math.ceil(this.tokenizeBatchSize / 2);
                console.warn(
                    `Yomitan tokenize failed due to batch size too many times, reducing batch size from ${this.tokenizeBatchSize} to ${newDefaultBatchSize}`
                );
                this.tokenizeBatchSize = newDefaultBatchSize;
                this.tokenizeBatchFailCount = 0;
            }
            return this.tokenizeBulk(allTexts, statusUpdates, yomitanUrl, Math.ceil(batchSize / 2));
        }
    }

    /**
     * Filter MeCab tokenize results to prefer the newest UniDic dictionary when multiple dictionaries are returned.
     * Ensures one TokenizeResult per text index.
     * @param tokenizeRes The array of TokenizeResult from Yomitan's tokenize API.
     * @param parser The parser used (only 'mecab' requires filtering).
     * @returns The filtered array of TokenizeResult.
     */
    private filterDictionaries(
        tokenizeRes: TokenizeResult[],
        parser: typeof this.dt.dictionaryYomitanParser
    ): TokenizeResult[] {
        if (parser !== 'mecab') return tokenizeRes;

        const preferenceMap = new Map<string, { year: number; month: number }>();
        const preference = (dictionary: string): { year: number; month: number } => {
            const lower = dictionary.toLowerCase();
            if (preferenceMap.has(lower)) return preferenceMap.get(lower)!;
            let year = 1;
            let month = 0;
            if (lower.includes('unidic')) {
                const match = dictionary.match(YEAR_MONTH_REGEX);
                year = match?.groups?.year ? parseInt(match.groups.year) : 2;
                month = match?.groups?.month ? parseInt(match.groups.month) : 0;
            } else if (lower === 'ipadic-neologd') {
                year = 0;
                month = 0;
            }
            preferenceMap.set(lower, { year, month });
            return preferenceMap.get(lower)!;
        };

        const indexDictMap = new Map<number, { res: TokenizeResult; year: number; month: number }>();
        for (const res of tokenizeRes) {
            const curr = indexDictMap.get(res.index);
            const pref = preference(res.dictionary);
            if (!curr || pref.year > curr.year || (pref.year === curr.year && pref.month > curr.month)) {
                indexDictMap.set(res.index, { res, ...pref });
            }
        }
        const results: TokenizeResult[] = [];
        for (const [index, val] of indexDictMap.entries()) results[index] = val.res;
        return results;
    }

    private cacheFromTokenize(
        tokenizeResult: TokenizeResult,
        tokensForText: TokenPart[][],
        newlines: { text: string; index: number }[]
    ): void {
        let currIndex = 0;
        for (const tokenParts of tokenizeResult.content) {
            const tokenPart = tokenParts[0];
            if (!tokenPart) continue;

            const tokenText = tokenParts.map((p) => p.text).join('');
            currIndex += tokenText.length;
            while (newlines.length && newlines[0].index < currIndex) {
                const { text } = newlines.shift()!;
                if (tokenText.includes(text)) continue; // scanning-parser includes newlines
                tokensForText.push([{ text, reading: '' }]);
                currIndex += text.length;
            }
            tokensForText.push(tokenParts.map((p) => ({ text: p.text, reading: p.reading })));
            const token = tokenText.trim();

            if (!this.lemmatizeCache.has(token)) this.extractLemmaFromMecab(token, tokenPart);

            const headwords = tokenPart.headwords;
            if (headwords) {
                if (!this.lemmatizeCache.has(token)) this.extractLemmas(token, headwords);
                if (!this.frequencyCache.has(token)) this.extractFrequencyFromTokenize(token, headwords);
                if (!this.pitchAccentCache.has(token)) this.extractPitchAccentFromTokenize(token, headwords);
            }
        }
        while (newlines.length) {
            const { text } = newlines.shift()!;
            tokensForText.push([{ text, reading: '' }]);
        }
    }

    verifyTokenizeResult(originalText: string, tokenizeRes: TokenPart[][]): void {
        const originalTextFromTokenize = tokenizeRes.map((t) => t.map((p) => p.text).join('')).join('');
        if (originalTextFromTokenize === originalText) return;
        throw new Error(
            `Tokenize result does not match the original text:\n${originalText}\n--->\n${originalTextFromTokenize}`
        );
    }

    private extractLemmaFromMecab(token: string, tokenPart: TokenPartResult): void {
        if (!this.getSupportsMecabLemma()) return;
        const lemmas: string[] = [];
        if (tokenPart.lemma?.length) lemmas.push(tokenPart.lemma);
        if (tokenPart.lemmaReading?.length && !lemmas.includes(tokenPart.lemmaReading)) {
            lemmas.push(tokenPart.lemmaReading);
        }
        if (lemmas.length) this.lemmatizeCache.set(token, lemmas);
    }

    /**
     * Extract the minimum frequency for a token in a rank-based frequency dictionary using Yomitan's tokenize API.
     */
    private extractFrequencyFromTokenize(
        token: string,
        tokenizeHeadwords: TermHeadword[][],
        preferTermSource = true
    ): void {
        if (!this.supportsTokenizeFrequency) return;
        let minFrequency: number | null = null;
        for (const headwords of tokenizeHeadwords) {
            for (const headword of headwords) {
                for (const source of headword.sources) {
                    if (source.originalText !== token) continue;
                    if (!source.isPrimary) continue;
                    if (source.matchType !== 'exact') continue;
                    if (source.matchSource !== 'term' && preferTermSource) continue; // Frequency of this exact form, don't promote rare kanji
                    if (!headword.frequencies) continue;
                    for (const f of headword.frequencies) {
                        if (!Number.isFinite(f.frequency) || f.frequency <= 0) continue;
                        if (this.resolveFrequencyMode(token, f) !== 'rank-based') continue;
                        minFrequency = minFrequency === null ? f.frequency : Math.min(minFrequency, f.frequency);
                    }
                    break;
                }
            }
        }
        if (minFrequency === null && preferTermSource) {
            return this.extractFrequencyFromTokenize(token, tokenizeHeadwords, false);
        }
        this.frequencyCache.set(token, minFrequency);
    }

    /**
     * Extract the first pitch accent position for a token using Yomitan's tokenize API.
     */
    private extractPitchAccentFromTokenize(token: string, tokenizeHeadwords: TermHeadword[][]): void {
        if (!this.supportsTokenizePronunciations) return;
        const pitchAccents = new Map<PitchAccentPosition, number>();
        for (const headwords of tokenizeHeadwords) {
            for (const headword of headwords) {
                for (const source of headword.sources) {
                    if (source.originalText !== token) continue;
                    if (!source.isPrimary) continue;
                    if (source.matchType !== 'exact') continue;
                    if (!headword.pronunciations) continue;
                    for (const termPronunciations of headword.pronunciations) {
                        for (const p of termPronunciations.pronunciations) {
                            if (p.type !== 'pitch-accent') continue;
                            pitchAccents.set(p.positions, (pitchAccents.get(p.positions) ?? 0) + 1);
                        }
                    }
                }
            }
        }
        let maxCount = 0;
        let selected: PitchAccentPosition | null = null;
        for (const [position, count] of pitchAccents.entries()) {
            if (count < maxCount) continue;
            if (count > maxCount) {
                maxCount = count;
                selected = position;
                continue;
            }
            if (typeof position !== 'string' || typeof selected === 'string') continue;
            selected = position; // Prefer the first string result when tied
        }
        this.pitchAccentCache.set(token, selected);
    }

    /**
     * Lemmatize a token using Yomitan's termEntries API. There will likely always be edge cases but it should perform
     * well nearly all of the time. Returns the first term and reading lemmas (e.g. kanji and kana for Japanese). Examples:
     * 過ぎる   ->  過ぎる, すぎる
     * 過ぎます ->  過ぎる, すぎる
     * すぎる   ->  過ぎる, すぎる
     * すぎます ->  過ぎる, すぎる
     */
    private extractLemmas(token: string, entries: TermHeadword[][]): string[] {
        let foundLemma = false; // Only add the first valid lemma
        let lookForKanji = isKanaOnly(token); // Use the first valid kanji form if the token is only Hiragana/Katakana
        const lemmas: string[] = [];
        for (const headwords of entries) {
            for (const headword of headwords) {
                for (const source of headword.sources) {
                    if (source.originalText !== token) continue;
                    if (!source.isPrimary) continue;
                    if (source.matchType !== 'exact') continue;
                    const lemma = source.deinflectedText; // This is either the term or reading, whatever the form of the input is
                    if (lookForKanji && lemma !== headword.term && lemma === headword.reading) {
                        lookForKanji = false;
                        if (!lemmas.includes(headword.term)) lemmas.unshift(headword.term); // e.g. すぎます -> 過ぎる
                    }
                    if (foundLemma) continue;
                    foundLemma = true;
                    if (!lemmas.includes(headword.term)) lemmas.unshift(headword.term);
                    if (!lemmas.includes(headword.reading)) lemmas.push(headword.reading);
                    if (!lemmas.includes(lemma)) lemmas.push(lemma); // Usually redundant but matchSource can be 'sequence' which could be different
                }
            }
        }
        if (!lemmas.length && this.lemmaTokenFallback) lemmas.push(token);
        this.lemmatizeCache.set(token, lemmas);
        return lemmas;
    }

    async lemmatize(token: string, yomitanUrl?: string): Promise<string[] | undefined> {
        let lemmas = this.lemmatizeCache.get(token);
        if (lemmas) return lemmas;
        if (!HAS_LETTER_REGEX.test(token)) {
            this.lemmatizeCache.set(token, []);
            this.frequencyCache.set(token, null);
            this.pitchAccentCache.set(token, null);
            return [];
        }
        const now = Date.now();
        const semaphoreId = await this.asyncSemaphore.acquire(1);
        try {
            lemmas = this.lemmatizeCache.get(token);
            if (lemmas) return lemmas;
            if (now < this.lastCancelledAt) return;
            const res: TermEntriesResult = await this._executeAction('termEntries', { term: token }, yomitanUrl);
            if (!Array.isArray(res?.dictionaryEntries)) {
                throw new Error(`Unexpected Yomitan termEntries response: ${JSON.stringify(res)}`);
            }
            const dictionaryEntries: TermDictionaryEntry[] = res.dictionaryEntries;
            if (!this.frequencyCache.has(token)) this.extractFrequency(token, dictionaryEntries);
            if (!this.pitchAccentCache.has(token)) this.extractPitchAccent(token, dictionaryEntries);
            return this.extractLemmas(
                token,
                dictionaryEntries.map((entry) => entry.headwords)
            );
        } finally {
            setTimeout(() => this.asyncSemaphore.release(semaphoreId), TERM_ENTRIES_DEBOUNCE_MS);
        }
    }

    /**
     * Get the minimum frequency for a token in a rank-based frequency dictionary using Yomitan's API.
     * This function will return undefined immediately and asynchronously update the cache if tokensWereModified is provided and the token is not in the cache.
     */
    async frequency(token: string, yomitanUrl?: string): Promise<number | undefined | null> {
        const minFrequency = this.frequencyCache.get(token);
        if (minFrequency !== undefined) return minFrequency;
        if (!HAS_LETTER_REGEX.test(token)) {
            this.frequencyCache.set(token, null);
            this.pitchAccentCache.set(token, null);
            this.lemmatizeCache.set(token, []);
            return null;
        }
        if (this.tokensWereModified) {
            void (async () => {
                const now = Date.now();
                const semaphoreId = await this.asyncSemaphore.acquire();
                try {
                    if (this.frequencyCache.has(token)) return;
                    if (now < this.lastCancelledAt) {
                        this.tokensWereModified!(token); // May need to reprocess with the new Yomitan instance
                        return;
                    }
                    const res: TermEntriesResult = await this._executeAction(
                        'termEntries',
                        { term: token },
                        yomitanUrl
                    );
                    if (!Array.isArray(res?.dictionaryEntries)) {
                        throw new Error(`Unexpected Yomitan termEntries response: ${JSON.stringify(res)}`);
                    }
                    const dictionaryEntries: TermDictionaryEntry[] = res.dictionaryEntries;
                    this.extractFrequency(token, dictionaryEntries);
                    if (!this.pitchAccentCache.has(token)) this.extractPitchAccent(token, dictionaryEntries);
                    if (!this.lemmatizeCache.has(token)) {
                        this.extractLemmas(
                            token,
                            dictionaryEntries.map((entry) => entry.headwords)
                        );
                    }
                    this.tokensWereModified!(token);
                } finally {
                    setTimeout(() => this.asyncSemaphore.release(semaphoreId), TERM_ENTRIES_DEBOUNCE_MS);
                }
            })();
            return; // undefined means the caller should call again later
        }

        const now = Date.now();
        const semaphoreId = await this.asyncSemaphore.acquire();
        try {
            const freq = this.frequencyCache.get(token);
            if (freq !== undefined) return freq;
            if (now < this.lastCancelledAt) return;
            const res: TermEntriesResult = await this._executeAction('termEntries', { term: token }, yomitanUrl);
            if (!Array.isArray(res?.dictionaryEntries)) {
                throw new Error(`Unexpected Yomitan termEntries response: ${JSON.stringify(res)}`);
            }
            const dictionaryEntries: TermDictionaryEntry[] = res.dictionaryEntries;
            if (!this.pitchAccentCache.has(token)) this.extractPitchAccent(token, dictionaryEntries);
            if (!this.lemmatizeCache.has(token)) {
                this.extractLemmas(
                    token,
                    dictionaryEntries.map((entry) => entry.headwords)
                );
            }
            return this.extractFrequency(token, dictionaryEntries);
        } finally {
            setTimeout(() => this.asyncSemaphore.release(semaphoreId), TERM_ENTRIES_DEBOUNCE_MS);
        }
    }

    /**
     * Extract the minimum frequency for a token in a rank-based frequency dictionary using Yomitan's termEntries API.
     */
    private extractFrequency(token: string, entries: TermDictionaryEntry[], preferTermSource = true): number | null {
        let minFrequency: number | null = null;
        for (const entry of entries) {
            const matchingHeadwordIndices = new Set<number>();
            for (const [i, headword] of entry.headwords.entries()) {
                for (const source of headword.sources) {
                    if (source.originalText !== token) continue;
                    if (!source.isPrimary) continue;
                    if (source.matchType !== 'exact') continue;
                    if (source.matchSource !== 'term' && preferTermSource) continue; // Frequency of this exact form, don't promote rare kanji
                    matchingHeadwordIndices.add(headword.headwordIndex ?? i); // requires this.supportsTokenizeFrequency otherwise array index is more accurate than headword.index
                    break;
                }
            }
            if (!matchingHeadwordIndices.size) continue;
            for (const f of entry.frequencies) {
                if (!matchingHeadwordIndices.has(f.headwordIndex)) continue;
                if (!Number.isFinite(f.frequency) || f.frequency <= 0) continue;
                if (this.resolveFrequencyMode(token, f) !== 'rank-based') continue;
                minFrequency = minFrequency === null ? f.frequency : Math.min(minFrequency, f.frequency);
            }
        }
        if (minFrequency === null && preferTermSource) return this.extractFrequency(token, entries, false);
        this.frequencyCache.set(token, minFrequency);
        return minFrequency;
    }

    /**
     * Extract the first pitch accent position for a token using Yomitan's termEntries API.
     * This function will return undefined immediately and asynchronously update the cache if tokensWereModified is provided and the token is not in the cache.
     */
    async pitchAccent(token: string, yomitanUrl?: string): Promise<PitchAccentPosition | undefined | null> {
        const positions = this.pitchAccentCache.get(token);
        if (positions !== undefined) return positions;
        if (!HAS_LETTER_REGEX.test(token)) {
            this.pitchAccentCache.set(token, null);
            this.frequencyCache.set(token, null);
            this.lemmatizeCache.set(token, []);
            return null;
        }
        if (this.tokensWereModified) {
            void (async () => {
                const now = Date.now();
                const semaphoreId = await this.asyncSemaphore.acquire();
                try {
                    if (this.pitchAccentCache.has(token)) return;
                    if (now < this.lastCancelledAt) {
                        this.tokensWereModified!(token); // May need to reprocess with the new Yomitan instance
                        return;
                    }
                    const res: TermEntriesResult = await this._executeAction(
                        'termEntries',
                        { term: token },
                        yomitanUrl
                    );
                    if (!Array.isArray(res?.dictionaryEntries)) {
                        throw new Error(`Unexpected Yomitan termEntries response: ${JSON.stringify(res)}`);
                    }
                    const dictionaryEntries: TermDictionaryEntry[] = res.dictionaryEntries;
                    this.extractPitchAccent(token, dictionaryEntries);
                    if (!this.frequencyCache.has(token)) this.extractFrequency(token, dictionaryEntries);
                    if (!this.lemmatizeCache.has(token)) {
                        this.extractLemmas(
                            token,
                            dictionaryEntries.map((entry) => entry.headwords)
                        );
                    }
                    this.tokensWereModified!(token);
                } finally {
                    setTimeout(() => this.asyncSemaphore.release(semaphoreId), TERM_ENTRIES_DEBOUNCE_MS);
                }
            })();
            return; // undefined means the caller should call again later
        }

        const now = Date.now();
        const semaphoreId = await this.asyncSemaphore.acquire();
        try {
            const positions = this.pitchAccentCache.get(token);
            if (positions !== undefined) return positions;
            if (now < this.lastCancelledAt) return;
            const res: TermEntriesResult = await this._executeAction('termEntries', { term: token }, yomitanUrl);
            if (!Array.isArray(res?.dictionaryEntries)) {
                throw new Error(`Unexpected Yomitan termEntries response: ${JSON.stringify(res)}`);
            }
            const dictionaryEntries: TermDictionaryEntry[] = res.dictionaryEntries;
            if (!this.frequencyCache.has(token)) this.extractFrequency(token, dictionaryEntries);
            if (!this.lemmatizeCache.has(token)) {
                this.extractLemmas(
                    token,
                    dictionaryEntries.map((entry) => entry.headwords)
                );
            }
            return this.extractPitchAccent(token, dictionaryEntries);
        } finally {
            setTimeout(() => this.asyncSemaphore.release(semaphoreId), TERM_ENTRIES_DEBOUNCE_MS);
        }
    }

    /**
     * Extract the first pitch accent position for a token using Yomitan's termEntries API.
     */
    private extractPitchAccent(token: string, entries: TermDictionaryEntry[]): PitchAccentPosition | null {
        const pitchAccents = new Map<PitchAccentPosition, number>();
        for (const entry of entries) {
            const matchingHeadwordIndices = new Set<number>();
            for (const [i, headword] of entry.headwords.entries()) {
                for (const source of headword.sources) {
                    if (source.originalText !== token) continue;
                    if (!source.isPrimary) continue;
                    if (source.matchType !== 'exact') continue;
                    matchingHeadwordIndices.add(headword.headwordIndex ?? i); // requires this.supportsTokenizeFrequency otherwise array index is more accurate than headword.index
                    break;
                }
            }
            if (!matchingHeadwordIndices.size) continue;
            for (const termPronunciations of entry.pronunciations) {
                if (!matchingHeadwordIndices.has(termPronunciations.headwordIndex)) continue;
                for (const p of termPronunciations.pronunciations) {
                    if (p.type !== 'pitch-accent') continue;
                    pitchAccents.set(p.positions, (pitchAccents.get(p.positions) ?? 0) + 1);
                }
            }
        }
        let maxCount = 0;
        let selected: PitchAccentPosition | null = null;
        for (const [position, count] of pitchAccents.entries()) {
            if (count < maxCount) continue;
            if (count > maxCount) {
                maxCount = count;
                selected = position;
                continue;
            }
            if (typeof position !== 'string' || typeof selected === 'string') continue;
            selected = position; // Prefer the first string result when tied
        }
        this.pitchAccentCache.set(token, selected);
        return selected;
    }

    async termEntriesBulk(
        tokens: string[],
        triggerTokensWereModified: boolean,
        yomitanUrl?: string,
        batchSize = this.termEntriesBatchSize
    ): Promise<void> {
        let batchError = false;
        try {
            const tokensToFetch = new Set<string>();
            for (const token of tokens) {
                if (
                    this.lemmatizeCache.has(token) &&
                    this.frequencyCache.has(token) &&
                    this.pitchAccentCache.has(token)
                ) {
                    continue;
                }
                if (!HAS_LETTER_REGEX.test(token)) {
                    this.lemmatizeCache.set(token, []);
                    this.frequencyCache.set(token, null);
                    this.pitchAccentCache.set(token, null);
                    if (triggerTokensWereModified) this.tokensWereModified?.(token);
                    continue;
                }
                tokensToFetch.add(token);
            }
            if (!tokensToFetch.size) return;

            const now = Date.now();
            const semaphoreId = await this.asyncSemaphore.acquire(2);
            try {
                if (now < this.lastCancelledAt) return;
                for (const token of tokensToFetch) {
                    if (
                        this.lemmatizeCache.has(token) &&
                        this.frequencyCache.has(token) &&
                        this.pitchAccentCache.has(token)
                    ) {
                        tokensToFetch.delete(token);
                    }
                }
                if (!tokensToFetch.size) return;

                await inBatches(
                    Array.from(tokensToFetch),
                    async (terms) => {
                        const res: TermEntriesResult | string = await this._executeAction(
                            'termEntries',
                            { term: terms },
                            yomitanUrl
                        );
                        if (!Array.isArray(res)) {
                            if (typeof res === 'string' && res.includes('exceed')) batchError = true; // {"message":"Message exceeded maximum allowed size of 64MiB."}
                            throw new Error(`Unexpected Yomitan termEntries response: ${JSON.stringify(res)}`);
                        }
                        const dictionaryEntries: TermDictionaryEntry[][] = [];
                        for (const result of res) dictionaryEntries[result.index] = result.dictionaryEntries;
                        for (const [index, token] of terms.entries()) {
                            const entries = dictionaryEntries[index];
                            let modified = false;
                            if (!this.lemmatizeCache.has(token)) {
                                this.extractLemmas(
                                    token,
                                    entries.map((entry) => entry.headwords)
                                );
                                modified = true;
                            }
                            if (!this.frequencyCache.has(token)) {
                                this.extractFrequency(token, entries);
                                modified = true;
                            }
                            if (!this.pitchAccentCache.has(token)) {
                                this.extractPitchAccent(token, entries);
                                modified = true;
                            }
                            if (modified && triggerTokensWereModified) this.tokensWereModified?.(token);
                        }
                    },
                    { batchSize }
                );
            } finally {
                this.asyncSemaphore.release(semaphoreId);
            }
        } catch (e) {
            if (!batchError || batchSize <= 1) throw e;
            ++this.termEntriesBatchFailCount;
            if (this.termEntriesBatchFailCount >= BATCH_FAIL_THRESHOLD) {
                const newDefaultBatchSize = Math.ceil(this.termEntriesBatchSize / 2);
                console.warn(
                    `Yomitan termEntries failed due to batch size too many times, reducing batch size from ${this.termEntriesBatchSize} to ${newDefaultBatchSize}`
                );
                this.termEntriesBatchSize = newDefaultBatchSize;
                this.termEntriesBatchFailCount = 0;
            }
            return this.termEntriesBulk(tokens, triggerTokensWereModified, yomitanUrl, Math.ceil(batchSize / 2));
        }
    }

    private resolveFrequencyMode(token: string, f: TermFrequency): FrequencyMode | undefined {
        if (f.frequencyMode) return f.frequencyMode;

        let frequencies = this.frequencyModeInferenceData.get(f.dictionary);
        if (!frequencies) {
            frequencies = new Map();
            this.frequencyModeInferenceData.set(f.dictionary, frequencies);
        }
        const existingFrequency = frequencies.get(token);
        if (existingFrequency === undefined || f.frequency < existingFrequency) frequencies.set(token, f.frequency);
        return this.inferredFrequencyModes.get(f.dictionary);
    }

    inferFrequencyModesFromTokenOccurrences(tokenOccurrencesByIndex: Map<number, Map<string, number>>): void {
        const occurrencesByToken = new Map<string, number>();
        for (const tokenOccurrences of tokenOccurrencesByIndex.values()) {
            for (const [token, occurrences] of tokenOccurrences.entries()) {
                occurrencesByToken.set(token, (occurrencesByToken.get(token) ?? 0) + occurrences);
            }
        }
        for (const [dictionary, frequencies] of this.frequencyModeInferenceData.entries()) {
            const records: { token: string; frequency: number; occurrences: number }[] = [];
            for (const [token, frequency] of frequencies.entries()) {
                const occurrences = occurrencesByToken.get(token);
                if (occurrences === undefined) continue;
                records.push({ token, frequency, occurrences });
            }
            if (records.length < FREQUENCY_MODE_INFERENCE_GROUP_SIZE * 2) continue;
            const previousFrequencyMode = this.inferredFrequencyModes.get(dictionary);

            const recordsByOccurrences = [...records].sort(
                (left, right) => right.occurrences - left.occurrences || left.frequency - right.frequency
            );
            const mostOccurringWords = recordsByOccurrences.slice(0, FREQUENCY_MODE_INFERENCE_GROUP_SIZE);
            const leastOccurringWords = recordsByOccurrences.slice(-FREQUENCY_MODE_INFERENCE_GROUP_SIZE);
            let rankBasedMatches = 0;
            for (let i = 0; i < FREQUENCY_MODE_INFERENCE_GROUP_SIZE; i++) {
                if (mostOccurringWords[i].frequency < leastOccurringWords[i].frequency) ++rankBasedMatches;
            }
            const frequencyMode =
                rankBasedMatches >= FREQUENCY_MODE_INFERENCE_RANK_BASED_MATCHES ? 'rank-based' : 'occurrence-based';

            if (previousFrequencyMode === frequencyMode) continue;
            console.log(
                `Inferred '${frequencyMode}' for the '${dictionary}' frequency dictionary (previously ${previousFrequencyMode}) based on:`,
                {
                    mostOccurringWords,
                    leastOccurringWords,
                }
            );

            this.inferredFrequencyModes.set(dictionary, frequencyMode);
            if (frequencyMode === 'rank-based') {
                for (const [token, frequency] of frequencies.entries()) {
                    const cachedFrequency = this.frequencyCache.get(token);
                    this.frequencyCache.set(
                        token,
                        cachedFrequency === undefined || cachedFrequency === null
                            ? frequency
                            : Math.min(cachedFrequency, frequency)
                    );
                    this.tokensWereModified?.(token);
                }
            } else if (previousFrequencyMode === 'rank-based') {
                for (const token of frequencies.keys()) {
                    this.frequencyCache.delete(token);
                    this.tokensWereModified?.(token);
                }
            }
        }
    }

    async version(yomitanUrl?: string) {
        const version: string = (await this._executeAction('yomitanVersion', {}, yomitanUrl)).version;
        if (version === '0.0.0.0') {
            if (this.dt.dictionaryYomitanParser === 'mecab') {
                await this.verifyMecabSupport(yomitanUrl);
            } else {
                this.supportsMecab = false;
                this.supportsMecabLemma = false;
            }
            this.supportsTokenizeFrequency = true;
            this.supportsTermEntriesBulk = true;
            return version;
        }
        const semver = coerce(version)?.version;
        if (!semver || lt(semver, '25.12.16')) {
            throw new Error(`Minimum Yomitan version is 25.12.16.0, found ${version}`);
        }
        if (this.dt.dictionaryYomitanParser === 'mecab' && gte(semver, '26.3.9')) {
            await this.verifyMecabSupport(yomitanUrl);
        } else {
            this.supportsMecab = false;
            this.supportsMecabLemma = false;
        }
        if (gte(semver, '26.4.6')) {
            this.supportsTokenizeFrequency = true;
            this.supportsTermEntriesBulk = true;
        } else {
            this.supportsTokenizeFrequency = false;
            this.supportsTermEntriesBulk = false;
        }
        return version;
    }

    private async verifyMecabSupport(yomitanUrl?: string) {
        const text = '思い出せなくなった';
        try {
            const tokenizeResults = this.filterDictionaries(
                await this._executeAction(
                    'tokenize',
                    {
                        text,
                        scanLength: this.dt.dictionaryYomitanScanLength,
                        parser: 'mecab',
                    },
                    yomitanUrl
                ),
                'mecab'
            );
            if (tokenizeResults[0].source !== 'mecab') {
                console.error(
                    `Yomitan did not return MeCab results as expected for '${text}': ${JSON.stringify(tokenizeResults)}`
                );
                this.supportsMecab = false;
                this.supportsMecabLemma = false;
                return;
            }
            const tokenParts = tokenizeResults[0].content[0];
            if (tokenParts.map((p) => p.text).join('') !== '思い出せなく') {
                console.error(
                    `Yomitan MeCab tokenization unexpected for '${text}': ${JSON.stringify(tokenizeResults)}`
                );
                this.supportsMecab = false;
                this.supportsMecabLemma = false;
                return;
            }
            this.supportsMecab = true;
            if (tokenParts[0].lemma !== '思い出す' || tokenParts[0].lemmaReading !== 'おもいだす') {
                console.error(`Yomitan MeCab lemma unexpected for '${text}': ${JSON.stringify(tokenizeResults)}`);
                this.supportsMecabLemma = false;
                return;
            }
            this.supportsMecabLemma = true;
        } catch (e) {
            console.error(`Yomitan MeCab support check failed for '${text}':`, e);
            this.supportsMecab = false;
            this.supportsMecabLemma = false;
        }
    }

    private async _executeAction(path: string, body: object, yomitanUrl?: string) {
        const json = await this.fetcher.fetch(`${yomitanUrl ?? this.dt.dictionaryYomitanUrl}/${path}`, body);
        if (!json || json === '{}') throw new Error(`Yomitan API error for ${path}: ${json}`);
        return json;
    }
}
