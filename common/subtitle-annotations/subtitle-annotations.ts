import {
    DictionaryBuildAnkiCacheState,
    DictionaryBuildAnkiCacheStateError,
    DictionaryBuildAnkiCacheStateErrorCode,
    DictionaryBuildAnkiCacheStateType,
    DictionaryBuildWaniKaniCacheState,
    DictionaryBuildWaniKaniCacheStateError,
    DictionaryBuildWaniKaniCacheStateErrorCode,
    DictionaryBuildWaniKaniCacheStateType,
    Fetcher,
    RichSubtitleModel,
    Token,
    Tokenization,
    TokenizedSubtitleModel,
    TokenReading,
} from '@project/common';
import { Anki } from '@project/common/anki';
import {
    ApplyStrategy,
    areDictionaryTracksEqual,
    AsbplayerSettings,
    dictionaryStatusCollectionEnabled,
    DictionaryTokenSource,
    DictionaryTrack,
    dictionaryTrackEnabled,
    dictionaryTokenSourcePriority,
    externalWordSourcePriority,
    getFullyKnownTokenStatus,
    isExternalWordSource,
    SettingsProvider,
    TokenFrequencyAnnotation,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenReadingAnnotation,
    TokenState,
    TokenStatus,
    TokenStyling,
    isWordSource,
} from '@project/common/settings';
import { TokenStatusInfo, DictionaryProvider, LemmaResults, TokenResults } from '@project/common/dictionary-db';
import {
    DictionaryStatistics,
    DictionaryStatisticsAnkiDueCardsSnapshot,
    DictionaryStatisticsAnkiSnapshot,
    DictionaryStatisticsWaniKaniSnapshot,
    REVIEW_DUES,
} from '@project/common/dictionary-statistics';
import { SubtitleCollection, SubtitleCollectionOptions } from '@project/common/subtitle-collection';
import {
    arrayEquals,
    HAS_LETTER_REGEX,
    inBatches,
    iterateOverStringInBlocks,
    ONLY_ASCII_LETTERS_REGEX,
    areTokenizationsEqual,
    getTokenStatus,
    dedupeTokenStatusInfos,
    isKanaOnly,
    normalizeToken,
} from '@project/common/util';
import { Yomitan } from '@project/common/yomitan/yomitan';

const TOKEN_CACHE_BUILD_AHEAD_INIT = 10;
const TOKEN_CACHE_BUILD_AHEAD = 100;
const TOKEN_CACHE_BUILD_AHEAD_THRESHOLD = 10; // Only build ahead with only this many rich subtitles left
const TOKEN_CACHE_BATCH_SIZE = 1; // Processing more than 1 at a time is slower
const TOKEN_CACHE_DEFAULT_REFRESH_INTERVAL = 10000;
const TOKEN_CACHE_STATISTICS_REFRESH_INTERVAL = 1000;
let tokenCacheRefreshInterval = TOKEN_CACHE_DEFAULT_REFRESH_INTERVAL;
const YOMITAN_RETRY_DELAY = 10000;
const ANKI_REFRESH_INTERVAL = 10000; // We need to poll in-case the user mines to Anki outside of asbplayer (e.g directly from Yomitan), local requests so no rate concerns
const WANIKANI_REFRESH_INTERVAL = 10000; // Only until the first successful refresh since users can't mine to it and it's an external server

const ASB_TOKEN_CLASS = 'asb-token';
const ASB_TOKEN_HIGHLIGHT_CLASS = 'asb-token-highlight';
const ASB_READING_CLASS = 'asb-reading';
const ASB_FREQUENCY_CLASS = 'asb-frequency';
// const ASB_FREQUENCY_HOVER_CLASS = 'asb-frequency-hover';

/**
 * Contains all information specific to a track
 */
class TrackState {
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
        this.tokenCollectionExact = new TokenCollection(this, TokenMatchStrategy.EXACT_FORM_COLLECTED);
        this.tokenCollectionLemma = new TokenCollection(this, TokenMatchStrategy.LEMMA_FORM_COLLECTED);
        this.tokenCollectionAny = new TokenCollectionArray(this, TokenMatchStrategy.ANY_FORM_COLLECTED);
        this.tokenStates = new Map();
        this.indexTokenOccurrences = new Map();
    }

    updateDictionaryTrack(dt: DictionaryTrack) {
        (this.dt as DictionaryTrack) = dt;
    }

    updateYomitan(yt: Yomitan | undefined) {
        (this.yt as Yomitan | undefined) = yt;
    }

    resetYomitan() {
        (this.ytLastResetAt as number) = Date.now();
        if (!this.yt) return;
        this.yt.resetCache();
        this.updateYomitan(undefined);
    }

    /**
     * The logic will need to be revisited if new states are added.
     * It also currently relies on the fact that only local tokens can have states.
     */
    updateTokenStates(normalizedToken: string, states: TokenState[]): void {
        if (!states.length) return;
        const existingStates = this.tokenStates.get(normalizedToken);
        if (!existingStates) {
            this.tokenStates.set(normalizedToken, states);
            return;
        }
        for (const state of states) {
            if (!existingStates.includes(state)) existingStates.push(state);
        }
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
    private lemmasForScript(trimmedToken: string, lemmas: string[]): string[] {
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
        lemmas: string[],
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

/**
 * The processed data from the db.
 */
interface TokenStatusResult {
    status: TokenStatus;
    source: DictionaryTokenSource;
    normalizedToken?: string; // For ANY_FORM_COLLECTED to prefer exact, then lemma, then any form.
    externalCandidateStatuses?: TokenStatusInfo[];
}

/**
 * The final status after applying strategies.
 */
interface ResolvedTokenStatusResult {
    status: TokenStatus;
    source?: DictionaryTokenSource;
    externalCandidateStatuses?: TokenStatusInfo[];
}

/**
 * Contains the tokens from the db depending on strategy configured.
 */
class TokenCollectionBase<T = TokenStatusResult | TokenStatusResult[]> {
    protected readonly collection: Map<string, T>;
    protected readonly ts: TrackState;
    readonly enabled: boolean;
    readonly wordEnabled: boolean;
    readonly sentenceEnabled: boolean;

    constructor(
        ts: TrackState,
        classType:
            | TokenMatchStrategy.EXACT_FORM_COLLECTED
            | TokenMatchStrategy.LEMMA_FORM_COLLECTED
            | TokenMatchStrategy.ANY_FORM_COLLECTED
    ) {
        this.collection = new Map();
        this.ts = ts;
        switch (classType) {
            case TokenMatchStrategy.EXACT_FORM_COLLECTED:
                this.wordEnabled =
                    ts.dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.EXACT_FORM_COLLECTED ||
                    ts.dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
                this.sentenceEnabled =
                    ts.dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.EXACT_FORM_COLLECTED ||
                    ts.dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
                break;
            case TokenMatchStrategy.LEMMA_FORM_COLLECTED:
                this.wordEnabled =
                    ts.dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.LEMMA_FORM_COLLECTED ||
                    ts.dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
                this.sentenceEnabled =
                    ts.dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.LEMMA_FORM_COLLECTED ||
                    ts.dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
                break;
            case TokenMatchStrategy.ANY_FORM_COLLECTED:
                this.wordEnabled = ts.dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.ANY_FORM_COLLECTED;
                this.sentenceEnabled =
                    ts.dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.ANY_FORM_COLLECTED;
                break;
            default:
                throw new Error(`Unsupported TokenMatchStrategy: ${classType}`);
        }
        this.enabled = this.wordEnabled || this.sentenceEnabled;
    }

    get(normalizedKey: string): T | undefined {
        return this.collection.get(normalizedKey);
    }

    delete(normalizedKey: string): boolean {
        return this.collection.delete(normalizedKey);
    }

    addQuery(queryMap: Map<string, string[]>, key: string): void {
        const normalizedKey = normalizeToken(key);
        const queries = queryMap.get(normalizedKey);
        if (queries) {
            if (!queries.includes(key)) queries.push(key); // Send all original forms for backwards compatibility with older extension db lookups
            return;
        }
        if (!this.collection.has(normalizedKey)) queryMap.set(normalizedKey, [key]);
    }

    getAllQueries(queryMap: Map<string, string[]>): string[] {
        return Array.from(queryMap.values()).flat();
    }

    protected tokenStatusResult(
        statuses: TokenStatusInfo[],
        source: DictionaryTokenSource,
        externalCandidateStatuses?: TokenStatusInfo[],
        normalizedToken?: string
    ): TokenStatusResult {
        const candidateStatuses = externalCandidateStatuses ?? statuses;
        return {
            status: getTokenStatus(statuses, this.ts.dt.dictionaryAnkiTreatSuspended),
            source,
            normalizedToken,
            externalCandidateStatuses: candidateStatuses.length ? candidateStatuses : undefined,
        };
    }

    private compareTokenStatusResults(left: TokenStatusResult, right: TokenStatusResult): number {
        const sourcePriority = dictionaryTokenSourcePriority(left.source) - dictionaryTokenSourcePriority(right.source);
        if (sourcePriority !== 0) return sourcePriority;
        const statusPriority = left.status - right.status;
        if (statusPriority !== 0) return statusPriority;
        if (isExternalWordSource(left.source) && isExternalWordSource(right.source)) {
            return externalWordSourcePriority(left.source) - externalWordSourcePriority(right.source);
        }
        return 0;
    }

    protected mergeTokenStatusResults(left: TokenStatusResult, right: TokenStatusResult): TokenStatusResult {
        return {
            ...(this.compareTokenStatusResults(left, right) >= 0 ? left : right),
            externalCandidateStatuses: dedupeTokenStatusInfos([
                ...(left.externalCandidateStatuses ?? []),
                ...(right.externalCandidateStatuses ?? []),
            ]),
        };
    }

    static resolveTokenStatusResults(
        tokenStatusResults: TokenStatusResult[],
        cmp: (tokenStatuses: TokenStatus[]) => TokenStatus = (tokenStatuses) => Math.max(...tokenStatuses)
    ): ResolvedTokenStatusResult {
        const status = cmp(tokenStatusResults.map((result) => result.status));
        const selectedResult = tokenStatusResults.find((result) => result.status === status)!;
        return {
            status: selectedResult.status,
            source: selectedResult.source,
            externalCandidateStatuses: dedupeTokenStatusInfos(
                tokenStatusResults.flatMap((result) => result.externalCandidateStatuses ?? [])
            ),
        };
    }
}

class TokenCollection extends TokenCollectionBase<TokenStatusResult> {
    add(
        statuses: TokenStatusInfo[],
        source: DictionaryTokenSource,
        externalCandidateStatuses: TokenStatusInfo[] | undefined,
        key: string,
        states: TokenState[]
    ): void {
        const statusResult = this.tokenStatusResult(statuses, source, externalCandidateStatuses);
        const normalizedKey = normalizeToken(key);
        const existing = this.collection.get(normalizedKey);
        this.collection.set(
            normalizedKey,
            existing ? super.mergeTokenStatusResults(existing, statusResult) : statusResult
        );
        this.ts.updateTokenStates(normalizedKey, states);
    }

    private resolve(
        normalizedTokens: string[],
        sourceMatches: (source: DictionaryTokenSource) => boolean
    ): TokenStatusResult[] {
        const statusResults: TokenStatusResult[] = [];
        for (const normalizedToken of normalizedTokens) {
            const statusResult = this.collection.get(normalizedToken);
            if (statusResult && sourceMatches(statusResult.source)) statusResults.push(statusResult);
        }
        return statusResults;
    }

    resolveForWord(normalizedTokens: string[]): TokenStatusResult[] {
        if (!this.wordEnabled) return [];
        return this.resolve(normalizedTokens, (source) => isWordSource(source));
    }

    resolveForSentence(normalizedTokens: string[]): TokenStatusResult[] {
        if (!this.sentenceEnabled) return [];
        return this.resolve(normalizedTokens, (source) => !isWordSource(source));
    }
}

class TokenCollectionArray extends TokenCollectionBase<TokenStatusResult[]> {
    add(
        statuses: TokenStatusInfo[],
        source: DictionaryTokenSource,
        externalCandidateStatuses: TokenStatusInfo[] | undefined,
        normalizedKey: string,
        states: TokenState[],
        token: string
    ): void {
        const normalizedToken = normalizeToken(token);
        const statusResult = this.tokenStatusResult(statuses, source, externalCandidateStatuses, normalizedToken);
        const statusResults = this.collection.get(normalizedKey);
        if (!statusResults) {
            this.collection.set(normalizedKey, [statusResult]);
            return;
        }
        const duplicateIndex = statusResults.findIndex((r) => r.normalizedToken === statusResult.normalizedToken);
        if (duplicateIndex === -1) {
            statusResults.push(statusResult);
        } else {
            statusResults[duplicateIndex] = super.mergeTokenStatusResults(statusResults[duplicateIndex], statusResult);
        }
        this.ts.updateTokenStates(normalizedToken, states);
    }

    /**
     * Need to check ANY_FORM_COLLECTED results against dictionaryMatchAcrossScripts explicitly since we never checked
     * the token, only the lemmas. EXACT_FORM_COLLECTED and LEMMA_FORM_COLLECTED looks for an exact match with either the
     * surface form or lemma form so they don't need this extra filtering.
     */
    private getStatusResults(
        normalizedToken: string,
        normalizedLemmas: string[],
        sourceMatches: (source: DictionaryTokenSource) => boolean
    ): TokenStatusResult[] {
        const tokenIsKanaOnly = isKanaOnly(normalizedToken);
        const anyFormStatusResults: TokenStatusResult[] = [];
        for (const normalizedLemma of normalizedLemmas) {
            const statusResults = this.collection.get(normalizedLemma);
            if (!statusResults) continue;
            for (const statusResult of statusResults) {
                if (!sourceMatches(statusResult.source)) continue;
                const collectedTokenIsKanaOnly = isKanaOnly(statusResult.normalizedToken!);
                if (this.ts.dt.dictionaryMatchAcrossScripts) {
                    if (tokenIsKanaOnly || !collectedTokenIsKanaOnly) anyFormStatusResults.push(statusResult);
                } else {
                    if (tokenIsKanaOnly === collectedTokenIsKanaOnly) anyFormStatusResults.push(statusResult);
                }
            }
        }
        return anyFormStatusResults;
    }

    private tokenMatchesKey(normalizedToken: string, normalizedKey: string): boolean {
        return normalizedToken === normalizedKey;
    }

    private tokenMatchesAnyKey(normalizedToken: string, normalizedKeys: string[]): boolean {
        return normalizedKeys.some((normalizedKey) => this.tokenMatchesKey(normalizedToken, normalizedKey));
    }

    private resolve(
        normalizedToken: string,
        lemmas: string[],
        sourceMatches: (source: DictionaryTokenSource) => boolean,
        exactPriority: boolean | null
    ): TokenStatusResult[] {
        const statusResults = this.getStatusResults(normalizedToken, lemmas, sourceMatches);
        if (!statusResults.length || exactPriority === null) return statusResults;
        if (exactPriority === true) {
            const exactMatches = statusResults.filter((r) => this.tokenMatchesKey(r.normalizedToken!, normalizedToken));
            if (exactMatches.length) return exactMatches;
            const lemmaMatches = statusResults.filter((r) => this.tokenMatchesAnyKey(r.normalizedToken!, lemmas));
            if (lemmaMatches.length) return lemmaMatches;
        } else if (exactPriority === false) {
            const lemmaMatches = statusResults.filter((r) => this.tokenMatchesAnyKey(r.normalizedToken!, lemmas));
            if (lemmaMatches.length) return lemmaMatches;
            const exactMatches = statusResults.filter((r) => this.tokenMatchesKey(r.normalizedToken!, normalizedToken));
            if (exactMatches.length) return exactMatches;
        }
        return statusResults;
    }

    resolveForWord(normalizedToken: string, lemmas: string[], exactPriority: boolean | null): TokenStatusResult[] {
        if (!this.wordEnabled) return [];
        return this.resolve(normalizedToken, lemmas, (source) => isWordSource(source), exactPriority);
    }

    resolveForSentence(normalizedToken: string, lemmas: string[], exactPriority: boolean | null): TokenStatusResult[] {
        if (!this.sentenceEnabled) return [];
        return this.resolve(normalizedToken, lemmas, (source) => !isWordSource(source), exactPriority);
    }
}

export interface InternalToken extends Token {
    __internal?: boolean;
}

interface InternalSubtitleModel extends TokenizedSubtitleModel {
    text: string;
    __tokenized?: boolean;
}

function untokenize(s: InternalSubtitleModel) {
    s.__tokenized = undefined;
    s.richText = undefined;
    if (s.tokenization) {
        s.tokenization.tokens = s.tokenization.tokens.filter((t) => !(t as InternalToken).__internal);
        if (s.tokenization.tokens.length) {
            s.tokenization.error = undefined;
            for (const token of s.tokenization.tokens) {
                token.states = [];
                token.status = undefined;
            }
        } else {
            s.tokenization = undefined;
        }
    }
    if (s.originalText !== undefined) s.text = s.originalText;
}

function originalTokenization(tokenization: Tokenization | undefined): Tokenization {
    return {
        tokens:
            tokenization?.tokens
                ?.filter((t) => !(t as InternalToken).__internal)
                .map((t) => ({
                    pos: [t.pos[0], t.pos[1]],
                    readings: t.readings.map((r) => ({ pos: [r.pos[0], r.pos[1]], reading: r.reading })),
                    states: [],
                })) ?? [],
    };
}

export class SubtitleAnnotations extends SubtitleCollection<RichSubtitleModel> {
    private _subtitles: InternalSubtitleModel[];
    private totalSubtitlesPerTrack: Map<number, number>;
    private readonly dictionaryProvider: DictionaryProvider;
    private readonly settingsProvider: SettingsProvider;
    private readonly dictionaryStatistics: DictionaryStatistics;
    private statisticsBatchProcessedIndex: number;
    private statisticsProcessedSubtitleIndexesByTrack: Map<number, Set<number>>;
    private generateStatistics?: boolean; // A manual trigger will keep this a true for the remainder of this class's lifetime, unless auto is toggled off.
    private generateStatisticsRequested: boolean; // Prevent premature cancellation during statistics generation
    private subtitlesInterval?: ReturnType<typeof setInterval>;
    private showingSubtitles?: RichSubtitleModel[];
    private showingNeedsRefreshCount: number;
    private buildLowerThreshold: number;
    private buildUpperThreshold: number;
    private initialized: boolean; // The first build after startup/reset has been completed

    private profile: string | undefined | null;
    private anki: Anki | undefined;
    private readonly fetcher?: Fetcher;
    private trackStates: TrackState[];
    private refreshCache: Set<number>; // Re-processes these indexes on next build
    private erroredCache: Set<number>; // Re-processes these indexes if they are in the build threshold
    private tokenToIndexesCache: Map<string, Set<number>>;
    private tokensForRefresh: Set<string>;
    private externalTokenReadings: Map<string, Map<number, TokenReading[]>>;
    private ankiState: {
        recentlyModifiedCardIds: Set<number>;
        recentlyModifiedFirstCheck: boolean;
        refreshing: boolean;
        refreshed: boolean;
        lastRefresh: number;
        triggerRefresh: boolean;
        statisticsRefreshed: boolean;
    };
    private waniKaniState: {
        refreshing: boolean;
        refreshed: boolean;
        lastRefresh: number;
        triggerRefresh: boolean;
        statisticsRefreshed: boolean;
    };
    private annotationsLastRefresh: number;
    private annotationsBuilding: boolean;
    private annotationsBuildingCurrentIndexes: Set<number>;
    private shouldCancelBuild: boolean; // Set to true to stop current build, checked after each async calls
    private tokenRequestFailedForTracks: Set<number>;

    private readonly subtitleAnnotationsUpdated: (updatedSubtitles: RichSubtitleModel[], dt: DictionaryTrack[]) => void;
    private readonly getMediaTimeMs?: () => number;

    private removeBuildAnkiCacheStateChangeCB?: () => void;
    private removeBuildWaniKaniCacheStateChangeCB?: () => void;
    private removeAnkiCardModifiedCB?: () => void;
    private removeRequestStatisticsSnapshotCB?: () => void;
    private removeRequestStatisticsGenerationCB?: () => void;

    constructor(
        dictionaryProvider: DictionaryProvider,
        settingsProvider: SettingsProvider,
        options: SubtitleCollectionOptions,
        mediaId: string,
        subtitleAnnotationsUpdated: (updatedSubtitles: RichSubtitleModel[], dt: DictionaryTrack[]) => void,
        getMediaTimeMs?: () => number,
        fetcher?: Fetcher
    ) {
        super({ ...options, returnNextToShow: true });
        this._subtitles = [];
        this.totalSubtitlesPerTrack = new Map();
        this.dictionaryProvider = dictionaryProvider;
        this.settingsProvider = settingsProvider;
        this.dictionaryStatistics = new DictionaryStatistics(settingsProvider, dictionaryProvider, mediaId);
        this.statisticsBatchProcessedIndex = 0;
        this.statisticsProcessedSubtitleIndexesByTrack = new Map();
        this.generateStatisticsRequested = false;
        this.buildLowerThreshold = 0;
        this.buildUpperThreshold = 0;
        this.initialized = false;
        this.profile = null;
        this.fetcher = fetcher;
        this.trackStates = [];
        this.subtitleAnnotationsUpdated = subtitleAnnotationsUpdated;
        this.getMediaTimeMs = getMediaTimeMs;
        this.showingNeedsRefreshCount = 0;
        this.refreshCache = new Set();
        this.erroredCache = new Set();
        this.tokenToIndexesCache = new Map();
        this.tokensForRefresh = new Set();
        this.externalTokenReadings = new Map();
        this.ankiState = {
            recentlyModifiedCardIds: new Set(),
            recentlyModifiedFirstCheck: true,
            refreshing: false,
            refreshed: false,
            lastRefresh: Date.now(),
            triggerRefresh: false,
            statisticsRefreshed: false,
        };
        this.waniKaniState = {
            refreshing: false,
            refreshed: false,
            lastRefresh: Date.now(),
            triggerRefresh: false,
            statisticsRefreshed: false,
        };
        this.annotationsLastRefresh = Date.now();
        this.annotationsBuilding = false;
        this.annotationsBuildingCurrentIndexes = new Set();
        this.shouldCancelBuild = false;
        this.tokenRequestFailedForTracks = new Set();
    }

    get subtitles() {
        return this._subtitles;
    }

    setSubtitles(subtitles: TokenizedSubtitleModel[]) {
        for (const s of subtitles) {
            if (s.originalText === undefined) s.originalText = s.text;
        }
        const needsReset =
            subtitles.length !== this._subtitles.length ||
            subtitles.some((s) => {
                const prev = this._subtitles[s.index];
                if ((s.originalText ?? s.text) !== (prev.originalText ?? prev.text)) return true;
                return !areTokenizationsEqual(
                    originalTokenization(s.tokenization),
                    originalTokenization(prev.tokenization)
                );
            });
        if (!needsReset) {
            // Preserve existing cache here so callers don't need to be aware of it
            for (const s of subtitles) {
                (s as InternalSubtitleModel).text = this._subtitles[s.index].text;
                s.tokenization = this._subtitles[s.index].tokenization;
                s.richText = this._subtitles[s.index].richText;
                (s as InternalSubtitleModel).__tokenized = this._subtitles[s.index].__tokenized;
            }
        }
        this._subtitles = subtitles.map((s) => ({ ...s })); // Separate internals from react state changes
        this.totalSubtitlesPerTrack.clear();
        for (const s of this._subtitles) {
            this.totalSubtitlesPerTrack.set(s.track, (this.totalSubtitlesPerTrack.get(s.track) ?? 0) + 1);
        }
        super.setSubtitles(this._subtitles);
        if (needsReset) {
            this._resetCache();
            this.refreshCache.clear();
            this.erroredCache.clear();
            this.tokenToIndexesCache.clear();
            this.tokensForRefresh.clear();
            this.externalTokenReadings.clear();
            for (const subtitle of this._subtitles) {
                if (!subtitle.tokenization) continue;
                for (const token of subtitle.tokenization.tokens) {
                    if ((token as InternalToken).__internal) continue;
                    if (!token.readings.length) continue;
                    const tokenText = subtitle.text.substring(token.pos[0], token.pos[1]);
                    let externalReadings = this.externalTokenReadings.get(tokenText);
                    if (!externalReadings) {
                        externalReadings = new Map();
                        this.externalTokenReadings.set(tokenText, externalReadings);
                    }
                    externalReadings.set(subtitle.track, token.readings);
                }
            }
            const { annotationsStartIndex, annotationsEndIndex } = this._getAnnotationsIndexes(true);
            void this._buildAnnotations(annotationsStartIndex, annotationsEndIndex, true);
        }
    }

    private _resetCache() {
        if (this.annotationsBuilding) this.shouldCancelBuild = true;
        this.profile = null;
        this.anki = undefined;
        this.trackStates.forEach((ts) => ts.resetYomitan());
        this.trackStates = [];
        this.showingSubtitles = undefined;
        this.showingNeedsRefreshCount = 0;
        this.dictionaryStatistics.reset();
        this.statisticsBatchProcessedIndex = 0;
        this.statisticsProcessedSubtitleIndexesByTrack.clear();
        this.generateStatisticsRequested = false;
        this.ankiState.recentlyModifiedCardIds.clear();
        this.ankiState.recentlyModifiedFirstCheck = true;
        this.ankiState.refreshed = false;
        this.ankiState.lastRefresh = Date.now();
        this.ankiState.triggerRefresh = false;
        this.ankiState.statisticsRefreshed = false;
        this.waniKaniState.refreshed = false;
        this.waniKaniState.lastRefresh = Date.now();
        this.waniKaniState.triggerRefresh = false;
        this.waniKaniState.statisticsRefreshed = false;
        this.annotationsLastRefresh = Date.now();
        this._subtitles.forEach(untokenize);
        this.buildLowerThreshold = 0;
        this.buildUpperThreshold = 0;
        this.initialized = false;
    }

    reset() {
        this.setSubtitles([]);
    }

    settingsUpdated(settings: AsbplayerSettings) {
        let settingsAreEqual =
            (!this.anki || this.anki.ankiConnectUrl === settings.ankiConnectUrl) &&
            this.trackStates.length === settings.dictionaryTracks.length;
        for (const [index, dt] of settings.dictionaryTracks.entries()) {
            const ts = this.trackStates[index];
            if (ts && areDictionaryTracksEqual(ts.dt, dt)) continue;
            settingsAreEqual = false;
            break;
        }
        if (settingsAreEqual) return;

        this._updateGenerateStatistics(
            this.trackStates.map((ts) => ts.dt),
            settings.dictionaryTracks
        );

        const subtitlesToReset: InternalSubtitleModel[] = []; // Tracks that went from enabled to disabled need all subscribers to purge their richText
        for (const ts of this.trackStates) {
            if (!dictionaryTrackEnabled(ts.dt)) continue; // Already disabled
            const newDt = settings.dictionaryTracks[ts.track];
            if (newDt && dictionaryTrackEnabled(newDt)) continue; // We will be processing, keep current richText on screen until then
            subtitlesToReset.push(...this._subtitles.filter((s) => s.track === ts.track));
            ts.updateDictionaryTrack(newDt);
        }
        if (subtitlesToReset.length) {
            for (const s of subtitlesToReset) {
                untokenize(s);
            }
            this.subtitleAnnotationsUpdated(subtitlesToReset, settings.dictionaryTracks);
        }
        this._resetCache();
        const { annotationsStartIndex, annotationsEndIndex } = this._getAnnotationsIndexes(true);
        void this._buildAnnotations(annotationsStartIndex, annotationsEndIndex, true);
    }

    tokensWereModified(modifiedTokens: string[]) {
        for (const token of modifiedTokens) this.tokensForRefresh.add(normalizeToken(token));
    }

    buildAnkiCacheStateChange(state: DictionaryBuildAnkiCacheState) {
        this.tokensWereModified(state.body?.modifiedTokens ?? []);
        if (state.type === DictionaryBuildAnkiCacheStateType.error) {
            const body = state.body as DictionaryBuildAnkiCacheStateError;
            if (
                body?.code === DictionaryBuildAnkiCacheStateErrorCode.noAnki ||
                body?.code === DictionaryBuildAnkiCacheStateErrorCode.noYomitan
            ) {
                this.ankiState.statisticsRefreshed = false;
            }
            if (body) {
                console.error(
                    `Dictionary Anki cache build error (${body.code} - ${body.msg}): ${JSON.stringify(body.data ?? {})}`
                );
            } else {
                console.error(`Dictionary Anki cache build error: Unknown error`);
            }
            if (body?.code !== DictionaryBuildAnkiCacheStateErrorCode.concurrentBuild) {
                this.ankiState.recentlyModifiedCardIds.clear();
                this.ankiState.recentlyModifiedFirstCheck = false;
            }
        } else if (state.type === DictionaryBuildAnkiCacheStateType.stats) {
            this.ankiState.statisticsRefreshed = false;
        }
    }

    buildWaniKaniCacheStateChange(state: DictionaryBuildWaniKaniCacheState) {
        this.tokensWereModified(state.body.modifiedTokens ?? []);
        if (state.type === DictionaryBuildWaniKaniCacheStateType.error) {
            const body = state.body as DictionaryBuildWaniKaniCacheStateError;
            if (
                body?.code === DictionaryBuildWaniKaniCacheStateErrorCode.invalidWaniKaniToken ||
                body?.code === DictionaryBuildWaniKaniCacheStateErrorCode.noYomitan
            ) {
                this.waniKaniState.statisticsRefreshed = false;
            }
            console.error(
                `Dictionary WaniKani cache build error (${body.code} - ${body.msg}): ${JSON.stringify(body.data ?? {})}`
            );
        } else if (state.type === DictionaryBuildWaniKaniCacheStateType.stats) {
            this.waniKaniState.statisticsRefreshed = false;
        }
    }

    ankiCardWasModified() {
        this.ankiState.triggerRefresh = true;
        this.ankiState.statisticsRefreshed = false;
    }

    hoverOnly(track: number) {
        return this.trackStates[track]?.dt.dictionaryColorizeOnHoverOnly;
    }

    async saveTokenLocal(
        track: number,
        token: string,
        status: TokenStatus | null,
        states: TokenState[],
        applyStates: ApplyStrategy
    ): Promise<void> {
        if (this.profile === null) return;
        const profile = this.profile;
        const ts = this.trackStates[track];
        if (!ts || !dictionaryTrackEnabled(ts.dt) || !ts.yt) return;

        const lemmas = await ts.yt.lemmatize(token);
        if (!lemmas) return;
        await this.dictionaryProvider.saveRecordLocalBulk(profile, [{ token, status, lemmas, states }], applyStates);
        this.tokensForRefresh.add(normalizeToken(token));
        for (const lemma of lemmas) this.tokensForRefresh.add(normalizeToken(lemma));
    }

    requestStatisticsGeneration() {
        this.generateStatistics = true;
    }

    private async _checkAnkiRecentlyModifiedCards(profile: string | undefined, fields: string[], decks: string[]) {
        try {
            if (!this.anki) throw new Error('Anki not initialized');
            const cardIds = await this.anki.findRecentlyEditedOrReviewedCards(1, fields, decks); // Can't efficiently poll suspended status
            if (
                cardIds.length === this.ankiState.recentlyModifiedCardIds.size &&
                cardIds.every((cardId) => this.ankiState.recentlyModifiedCardIds.has(cardId))
            ) {
                if (this.ankiState.recentlyModifiedFirstCheck) this.ankiState.recentlyModifiedFirstCheck = false;
                return;
            }
            this.ankiState.recentlyModifiedCardIds = new Set(cardIds);
            if (this.ankiState.recentlyModifiedFirstCheck) {
                this.ankiState.recentlyModifiedFirstCheck = false;
                return;
            }
            await this.dictionaryProvider.buildAnkiCache(profile, await this.settingsProvider.getAll());
            this.ankiState.triggerRefresh = true;
            this.ankiState.statisticsRefreshed = false;
        } catch (e) {
            console.error(`Error checking Anki recently modified cards:`, e);
            this.anki = undefined;
            this.ankiState.recentlyModifiedCardIds.clear();
            this.ankiState.recentlyModifiedFirstCheck = false;
        }
    }

    private async _refreshAnki() {
        if (this.profile === null || !this.trackStates.length) return;
        const profile = this.profile;

        if (this.ankiState.refreshing) return;
        try {
            this.ankiState.refreshing = true;
            if (!this.anki) {
                try {
                    const settings = await this.settingsProvider.getAll();
                    this.anki = new Anki(settings, this.fetcher);
                    const permission = (await this.anki.requestPermission()).permission;
                    if (permission !== 'granted') throw new Error(`permission ${permission}`);
                } catch (e) {
                    console.warn('Anki permission request failed:', e);
                    this.anki = undefined;
                }
            }

            const allFieldsSet = new Set<string>();
            for (const ts of this.trackStates) {
                if (!dictionaryStatusCollectionEnabled(ts.dt)) continue;
                for (const field of ts.dt.dictionaryAnkiWordFields.concat(ts.dt.dictionaryAnkiSentenceFields)) {
                    allFieldsSet.add(field);
                }
            }
            const fields = Array.from(allFieldsSet);
            const allDecksSet = new Set<string>();
            for (const ts of this.trackStates) {
                if (!dictionaryStatusCollectionEnabled(ts.dt)) continue;
                if (!ts.dt.dictionaryAnkiDecks.length) {
                    allDecksSet.clear(); // Query all decks
                    break;
                }
                for (const deck of ts.dt.dictionaryAnkiDecks) allDecksSet.add(deck);
            }
            const decks = Array.from(allDecksSet);

            if (this.anki && !this.ankiState.refreshed) {
                await this.dictionaryProvider.buildAnkiCache(profile, await this.settingsProvider.getAll()); // Keep cache updated without user action
                this.ankiState.refreshed = true;
            }
            await this._checkAnkiRecentlyModifiedCards(profile, fields, decks);
            await this._refreshAnkiStatistics(profile, fields, decks);
        } catch (e) {
            console.warn('Anki refresh failed:', e);
            this.ankiState.refreshed = false;
        } finally {
            this.ankiState.refreshing = false;
        }
    }

    private async _refreshAnkiStatistics(profile: string | undefined, fields: string[], decks: string[]) {
        if (!this.generateStatistics) return;
        if (this.ankiState.statisticsRefreshed) return;

        const startedAt = Date.now();
        try {
            if (!this.anki) throw new Error('Anki not initialized');

            const ankiCardRecords = (await this.dictionaryProvider.getRecords(profile, undefined)).ankiCardRecords;
            const cardsInfo: DictionaryStatisticsAnkiSnapshot['cardsInfo'] = {};
            const cardsStatus: NonNullable<DictionaryStatisticsAnkiSnapshot['cardsStatus']> = {};
            for (const cardRecords of Object.values(ankiCardRecords)) {
                for (const cardRecord of Object.values(cardRecords)) {
                    cardsInfo[cardRecord.cardId] = cardRecord.data!;
                    cardsStatus[cardRecord.cardId] = cardRecord.status;
                }
            }

            // Fallback to requesting from Anki if extension and therefore the db hasn't been updated
            if (Object.keys(cardsInfo).length && !Object.values(cardsInfo)[0]) {
                for (const cardInfo of await this.anki.cardsInfo(Object.keys(cardsInfo).map((id) => parseInt(id)))) {
                    cardsInfo[cardInfo.cardId] = {
                        deckName: cardInfo.deckName,
                        modelName: cardInfo.modelName,
                        due: cardInfo.due,
                    };
                }
            }

            const dueCards: DictionaryStatisticsAnkiDueCardsSnapshot = {};
            for (const due of REVIEW_DUES) dueCards[due] = await this.anki.findCardsDueBy(due, fields, decks);
            const totalCards = Object.keys(cardsStatus).length;
            this.dictionaryStatistics.replaceAnkiSnapshot({
                available: true,
                progress: {
                    current: totalCards,
                    total: totalCards,
                    startedAt,
                },
                cardsInfo,
                cardsStatus,
                dueCards,
            });
            this.ankiState.statisticsRefreshed = true;
        } catch (e) {
            console.error('Error refreshing Anki for statistics:', e);
            this.anki = undefined;
            this.dictionaryStatistics.replaceAnkiSnapshot({
                available: false,
                cardsInfo: {},
                cardsStatus: {},
                dueCards: {},
            });
        }
    }

    private async _refreshWaniKani() {
        if (this.profile === null || !this.trackStates.length) return;
        const profile = this.profile;

        if (this.waniKaniState.refreshing) return;
        try {
            this.waniKaniState.refreshing = true;
            if (
                !this.trackStates.some(
                    (ts) => dictionaryStatusCollectionEnabled(ts.dt) && ts.dt.dictionaryWaniKaniApiToken.trim()
                )
            ) {
                return;
            }
            if (!this.waniKaniState.refreshed) {
                await this.dictionaryProvider.buildWaniKaniCache(profile); // Don't need to poll on tokensModified since users can't mine to it unlike Anki
                this.waniKaniState.refreshed = true;
            }
            await this._refreshWaniKaniStatistics(profile);
        } catch (e) {
            this.waniKaniState.refreshed = false;
            console.warn('WaniKani refresh failed:', e);
        } finally {
            this.waniKaniState.refreshing = false;
        }
    }

    private async _refreshWaniKaniStatistics(profile: string | undefined): Promise<void> {
        if (!this.generateStatistics) return;
        if (this.waniKaniState.statisticsRefreshed) return;

        const waniKaniSnapshots: Record<number, DictionaryStatisticsWaniKaniSnapshot> = {};
        for (const ts of this.trackStates) {
            if (!dictionaryStatusCollectionEnabled(ts.dt)) continue;

            try {
                const records = await this.dictionaryProvider.getRecords(profile, ts.track);
                waniKaniSnapshots[ts.track] = {
                    available: true,
                    assignments: Object.values(records.waniKaniAssignmentRecords?.[ts.track] ?? {}),
                    subjects: records.waniKaniSubjectRecords?.[ts.track] ?? {},
                };
            } catch (e) {
                console.error(`Error refreshing WaniKani for Track${ts.track + 1} statistics:`, e);
                waniKaniSnapshots[ts.track] = { available: false, assignments: [], subjects: {} };
            }
        }
        this.waniKaniState.statisticsRefreshed = true;
        if (!Object.keys(waniKaniSnapshots).length) return;
        this.dictionaryStatistics.replaceWaniKaniSnapshots(waniKaniSnapshots);
    }

    private _shouldAutoGenerateStatistics(dictionaryTracks: DictionaryTrack[]) {
        return dictionaryTracks.some((dt) => dictionaryTrackEnabled(dt) && dt.dictionaryAutoGenerateStatistics);
    }

    private _updateGenerateStatistics(oldTracks: DictionaryTrack[], newTracks: DictionaryTrack[]) {
        const wasEnabled = this._shouldAutoGenerateStatistics(oldTracks);
        const nowEnabled = this._shouldAutoGenerateStatistics(newTracks);
        if (wasEnabled && !nowEnabled) this.generateStatistics = false;
        else this.generateStatistics = this.generateStatistics || nowEnabled;
    }

    bind() {
        if (this.removeBuildAnkiCacheStateChangeCB) this.removeBuildAnkiCacheStateChangeCB();
        this.removeBuildAnkiCacheStateChangeCB = this.dictionaryProvider.onBuildAnkiCacheStateChange((state) =>
            this.buildAnkiCacheStateChange(state)
        );
        if (this.removeBuildWaniKaniCacheStateChangeCB) this.removeBuildWaniKaniCacheStateChangeCB();
        this.removeBuildWaniKaniCacheStateChangeCB = this.dictionaryProvider.onBuildWaniKaniCacheStateChange((state) =>
            this.buildWaniKaniCacheStateChange(state)
        );
        if (this.removeAnkiCardModifiedCB) this.removeAnkiCardModifiedCB();
        this.removeAnkiCardModifiedCB = this.dictionaryProvider.onAnkiCardModified(() => this.ankiCardWasModified());
        if (this.removeRequestStatisticsSnapshotCB) this.removeRequestStatisticsSnapshotCB();
        this.removeRequestStatisticsSnapshotCB = this.dictionaryProvider.onRequestStatisticsSnapshot(() => {
            this.dictionaryStatistics.publishSnapshot();
        });
        if (this.removeRequestStatisticsGenerationCB) this.removeRequestStatisticsGenerationCB();
        this.removeRequestStatisticsGenerationCB = this.dictionaryProvider.onRequestStatisticsGeneration(() => {
            this.requestStatisticsGeneration();
        });

        this.subtitlesInterval = setInterval(() => {
            if (!this.subtitles.length) return;

            if (
                this.generateStatistics === true &&
                this.statisticsBatchProcessedIndex < this.subtitles.length &&
                this.initialized
            ) {
                if (this.annotationsBuilding && !this.generateStatisticsRequested) this.shouldCancelBuild = true;
                this.generateStatisticsRequested = true;
                const { annotationsStartIndex, annotationsEndIndex } = this._getAnnotationsIndexes();
                void this._buildAnnotations(annotationsStartIndex, annotationsEndIndex);
                this.annotationsLastRefresh = Date.now();
            }

            if (this.getMediaTimeMs) {
                const slice = this.subtitlesAt(this.getMediaTimeMs());
                const subtitlesAreNew =
                    this.showingSubtitles === undefined ||
                    !arrayEquals(slice.showing, this.showingSubtitles, (a, b) => a.index === b.index);
                if (subtitlesAreNew) {
                    this.showingSubtitles = slice.showing;
                    this.showingNeedsRefreshCount++;
                    if (
                        this.annotationsBuilding &&
                        !this.generateStatisticsRequested &&
                        this.initialized &&
                        slice.showing.some(
                            (s) =>
                                !this.subtitles[s.index].__tokenized &&
                                !this.annotationsBuildingCurrentIndexes.has(s.index)
                        )
                    ) {
                        this.shouldCancelBuild = true;
                    }
                }
                if (this.showingNeedsRefreshCount) {
                    const { annotationsStartIndex, annotationsEndIndex } = this._getAnnotationsIndexes(
                        false,
                        slice.showing
                    );
                    void this._buildAnnotations(annotationsStartIndex, annotationsEndIndex).then((res) => {
                        if (res) this.showingNeedsRefreshCount = Math.max(0, this.showingNeedsRefreshCount - 1);
                    });
                    this.annotationsLastRefresh = Date.now();
                }
            }
            if (
                (this.tokensForRefresh.size || // Don't force a build for this.refreshCache.size as it may update too frequently for token.frequency
                    Date.now() - this.annotationsLastRefresh >= tokenCacheRefreshInterval) &&
                !this.showingNeedsRefreshCount
            ) {
                const { annotationsStartIndex, annotationsEndIndex } = this._getAnnotationsIndexes();
                void this._buildAnnotations(annotationsStartIndex, annotationsEndIndex);
                this.annotationsLastRefresh = Date.now();
            }
            if (
                (this.ankiState.triggerRefresh || Date.now() - this.ankiState.lastRefresh >= ANKI_REFRESH_INTERVAL) &&
                !this.ankiState.refreshing
            ) {
                void this._refreshAnki();
                this.ankiState.lastRefresh = Date.now();
                this.ankiState.triggerRefresh = false;
            }
            if (
                (this.waniKaniState.triggerRefresh ||
                    Date.now() - this.waniKaniState.lastRefresh >= WANIKANI_REFRESH_INTERVAL) &&
                !this.waniKaniState.refreshing
            ) {
                void this._refreshWaniKani();
                this.waniKaniState.lastRefresh = Date.now();
                this.waniKaniState.triggerRefresh = false;
            }
        }, 100);
    }

    private _getAnnotationsIndexes(init?: boolean, subtitles?: RichSubtitleModel[]) {
        if (!subtitles?.length) {
            if (this.getMediaTimeMs) {
                const slice = this.subtitlesAt(this.getMediaTimeMs());
                subtitles = slice.showing;
                if (!subtitles.length) subtitles = slice.nextToShow ?? [];
            } else {
                return { annotationsStartIndex: 0, annotationsEndIndex: this.subtitles.length };
            }
        }
        const tokenCacheBuildAhead = init ? TOKEN_CACHE_BUILD_AHEAD_INIT : TOKEN_CACHE_BUILD_AHEAD;
        if (!subtitles.length) return { annotationsStartIndex: 0, annotationsEndIndex: tokenCacheBuildAhead };
        const annotationsStartIndex = Math.min(...subtitles.map((s) => s.index));
        const annotationsEndIndex = Math.max(...subtitles.map((s) => s.index)) + 1 + tokenCacheBuildAhead;
        return { annotationsStartIndex, annotationsEndIndex };
    }

    private async _buildAnnotations(
        annotationsStartIndex: number,
        annotationsEndIndex: number,
        init?: boolean
    ): Promise<boolean> {
        if (!this.subtitles.length) return true;
        if (this.annotationsBuilding) return false;
        let tokensRefreshed: string[] = [];
        let skipTracks: number[] = [];
        let buildWasCancelled = false;
        let updateThresholds = false;
        let statisticsBatching = false;
        let builtNewTokenization = false;
        try {
            this.annotationsBuilding = true;
            if (this.profile === null) {
                const profile = (await this.settingsProvider.activeProfile())?.name;
                if (this.profile === null) this.profile = profile;
            }
            const profile = this.profile;
            if (!this.trackStates.length) {
                this.trackStates = (await this.settingsProvider.getSingle('dictionaryTracks')).map(
                    (dt, track) => new TrackState(track, dt)
                );
                if (this.generateStatistics === undefined) {
                    this.generateStatistics = this._shouldAutoGenerateStatistics(this.trackStates.map((ts) => ts.dt));
                }
            }
            if (this.trackStates.every((t) => !dictionaryTrackEnabled(t.dt))) return true;
            if (this.shouldCancelBuild) return false;

            for (const ts of this.trackStates) {
                if (!dictionaryTrackEnabled(ts.dt) || ts.yt) continue;
                if (Date.now() - ts.ytLastResetAt < YOMITAN_RETRY_DELAY) {
                    skipTracks.push(ts.track);
                    continue;
                }
                try {
                    const yt = new Yomitan(ts.dt, this.fetcher, {
                        lemmaTokenFallback: true,
                        tokensWereModified: (token) => {
                            const indexes = this.tokenToIndexesCache.get(normalizeToken(token)) ?? [];
                            for (const index of indexes) this.refreshCache.add(index);
                        },
                    });
                    await yt.version();
                    ts.updateYomitan(yt);
                } catch (e) {
                    console.error(`YomitanTrack${ts.track + 1} version request failed:`, e);
                    ts.resetYomitan();
                }
            }

            const generatingStatistics = this.generateStatistics === true && this.initialized;
            if (generatingStatistics) {
                statisticsBatching = this.statisticsBatchProcessedIndex < this.subtitles.length;
                if (statisticsBatching) {
                    annotationsStartIndex = this.statisticsBatchProcessedIndex;
                    annotationsEndIndex = Math.min(
                        this.subtitles.length,
                        annotationsStartIndex + TOKEN_CACHE_BUILD_AHEAD
                    );
                    for (let i = annotationsStartIndex; i < annotationsEndIndex; i++) this.refreshCache.add(i);
                }
                if (!this.dictionaryStatistics.hasStatistics()) {
                    this.generateStatisticsRequested = true;
                    for (const ts of this.trackStates) {
                        if (!dictionaryTrackEnabled(ts.dt)) continue;
                        this.dictionaryStatistics.init(ts.track, this.totalSubtitlesPerTrack.get(ts.track) ?? 0);
                        this.statisticsProcessedSubtitleIndexesByTrack.set(ts.track, new Set());
                    }
                    void this.dictionaryStatistics.refreshDictionaryTokens(profile); // Init with dictionary token state
                    this.ankiState.triggerRefresh = true;
                    this.waniKaniState.triggerRefresh = true;
                    tokenCacheRefreshInterval = TOKEN_CACHE_STATISTICS_REFRESH_INTERVAL;
                }
            }
            const subtitles = !skipTracks.length
                ? this.subtitles.slice(annotationsStartIndex, annotationsEndIndex)
                : this.subtitles
                      .slice(annotationsStartIndex, annotationsEndIndex)
                      .filter((s) => !skipTracks.includes(s.track));
            if (!subtitles.length) return !skipTracks.length;

            if (this.refreshCache.size || this.tokensForRefresh.size) {
                const existingIndexes = new Set(subtitles.map((s) => s.index));
                for (const token of this.tokensForRefresh) {
                    tokensRefreshed.push(token);
                    for (const index of this.tokenToIndexesCache.get(token) ?? []) this.refreshCache.add(index);
                }
                for (const index of this.refreshCache) {
                    if (existingIndexes.has(index)) continue;
                    existingIndexes.add(index);
                    subtitles.push(this.subtitles[index]); // Process all relevant subtitles even if not in buffer
                }
            } else if (!subtitles.some((s) => this.erroredCache.has(s.index))) {
                if (
                    annotationsStartIndex >= this.buildLowerThreshold &&
                    annotationsStartIndex < this.buildUpperThreshold
                ) {
                    return true;
                }
                updateThresholds = true;
            }

            try {
                for (const subtitle of subtitles) this.annotationsBuildingCurrentIndexes.add(subtitle.index);
                await this._buildTokenAndLemmaMap(profile, subtitles);
            } finally {
                this.annotationsBuildingCurrentIndexes.clear();
            }

            const statisticsTracksToUpdate = new Set<number>();
            await inBatches(
                subtitles,
                async (batch) => {
                    await Promise.all(
                        batch.map(async ({ index, text, track, __tokenized: alreadyTokenized }) => {
                            if (this.shouldCancelBuild) return;
                            if (alreadyTokenized && !this.refreshCache.has(index) && !this.erroredCache.has(index)) {
                                return;
                            }
                            const ts = this.trackStates[track];
                            if (!dictionaryTrackEnabled(ts.dt)) return;
                            const deletedFromRefreshCache = this.refreshCache.delete(index);
                            const deletedFromErroredCache = this.erroredCache.delete(index);
                            try {
                                this.annotationsBuildingCurrentIndexes.add(index);
                                const existingTokenization = this.subtitles[index].tokenization;
                                const tokenizationModel = !existingTokenization
                                    ? await this._tokenizationModel(text, index, ts)
                                    : await this._tokenizationModelMergedWithExistingOne(
                                          text,
                                          existingTokenization,
                                          index,
                                          ts
                                      );
                                if (this.shouldCancelBuild) return;
                                if (
                                    areTokenizationsEqual(tokenizationModel?.tokenization, existingTokenization) &&
                                    !this.generateStatisticsRequested
                                ) {
                                    return;
                                }
                                builtNewTokenization = true;
                                const updatedSubtitles: RichSubtitleModel[] = [];
                                if (tokenizationModel) {
                                    const { tokenization, reconstructedText } = tokenizationModel;
                                    const subtitle = this.subtitles[index];
                                    subtitle.tokenization = tokenization;
                                    subtitle.richText = undefined;
                                    if (subtitle.originalText === undefined) subtitle.originalText = subtitle.text;
                                    subtitle.text = reconstructedText;
                                    subtitle.__tokenized = true;
                                    updatedSubtitles.push(subtitle);
                                    this._recordTokenOccurrences(index, reconstructedText, tokenization, ts);
                                    if (generatingStatistics) {
                                        const sentence = { ...subtitle };
                                        renderRichTextOntoSubtitles(
                                            [sentence],
                                            this.trackStates.map((ts) => ts.dt)
                                        );
                                        this.dictionaryStatistics.ingest(sentence); // Treat the entire source entry as a single sentence
                                        if (
                                            sentence.tokenization!.tokens.every(
                                                (t) =>
                                                    t.frequency !== undefined ||
                                                    t.states.includes(TokenState.IGNORED) ||
                                                    !HAS_LETTER_REGEX.test(
                                                        reconstructedText.substring(t.pos[0], t.pos[1])
                                                    )
                                            )
                                        ) {
                                            this.statisticsProcessedSubtitleIndexesByTrack.get(track)!.add(index);
                                            statisticsTracksToUpdate.add(track);
                                        }
                                    }
                                }
                                this.subtitleAnnotationsUpdated(
                                    updatedSubtitles,
                                    this.trackStates.map((ts) => ts.dt)
                                );
                            } catch (e) {
                                console.error(`Error building annotations for subtitle index ${index}:`, e);
                                if (deletedFromRefreshCache) this.refreshCache.add(index);
                                else this.erroredCache.add(index);
                            } finally {
                                if (this.shouldCancelBuild) {
                                    if (deletedFromRefreshCache) this.refreshCache.add(index);
                                    else if (deletedFromErroredCache) this.erroredCache.add(index);
                                }
                                this.annotationsBuildingCurrentIndexes.delete(index);
                            }
                        })
                    );
                },
                { batchSize: TOKEN_CACHE_BATCH_SIZE }
            );

            if (statisticsTracksToUpdate.size) {
                for (const track of statisticsTracksToUpdate) {
                    const indexes = this.statisticsProcessedSubtitleIndexesByTrack.get(track)!;
                    this.dictionaryStatistics.updateProgress(track, indexes.size);
                }
                if (
                    Array.from(this.statisticsProcessedSubtitleIndexesByTrack).every(
                        ([track, indexes]) => indexes.size >= (this.totalSubtitlesPerTrack.get(track) ?? 0)
                    )
                ) {
                    tokenCacheRefreshInterval = TOKEN_CACHE_DEFAULT_REFRESH_INTERVAL;
                }
            }
            if (tokensRefreshed.length && generatingStatistics) {
                void this.dictionaryStatistics.refreshDictionaryTokens(profile);
            }

            if (this.shouldCancelBuild || skipTracks.length) {
                buildWasCancelled = true;
                tokensRefreshed = [];
                updateThresholds = false;
            }
        } finally {
            if (this.tokenRequestFailedForTracks.size) {
                tokensRefreshed = [];
                updateThresholds = false;
                for (const track of this.tokenRequestFailedForTracks) this.trackStates[track].resetYomitan();
                this.tokenRequestFailedForTracks.clear();
            } else if (!this.shouldCancelBuild && !skipTracks.length) {
                if (builtNewTokenization) this._inferFrequencyModesFromTokenOccurrences();
                this.initialized = true;
                if (statisticsBatching) {
                    this.statisticsBatchProcessedIndex = annotationsEndIndex;
                    if (annotationsEndIndex >= this.subtitles.length) {
                        this.generateStatisticsRequested = false;
                    }
                }
            }
            if (updateThresholds && !init) {
                this.buildUpperThreshold = annotationsEndIndex - TOKEN_CACHE_BUILD_AHEAD_THRESHOLD;
                this.buildLowerThreshold = annotationsStartIndex; // Build whenever the user seeks backwards
            }
            if (
                tokensRefreshed.length &&
                tokensRefreshed.length === this.tokensForRefresh.size &&
                tokensRefreshed.every((token) => this.tokensForRefresh.has(token))
            ) {
                this.tokensForRefresh.clear();
            }
            this.shouldCancelBuild = false;
            this.annotationsBuilding = false;
        }
        return !buildWasCancelled;
    }

    private _recordTokenOccurrences(
        index: number,
        reconstructedText: string,
        tokenization: Tokenization,
        ts: TrackState
    ): void {
        const tokenOccurrences = new Map<string, number>();
        for (const token of tokenization.tokens) {
            const tokenText = reconstructedText.substring(token.pos[0], token.pos[1]).trim();
            if (!HAS_LETTER_REGEX.test(tokenText)) continue;
            tokenOccurrences.set(tokenText, (tokenOccurrences.get(tokenText) ?? 0) + 1);
        }
        ts.indexTokenOccurrences.set(index, tokenOccurrences);
    }

    private _inferFrequencyModesFromTokenOccurrences(): void {
        for (const ts of this.trackStates) {
            if (!dictionaryTrackEnabled(ts.dt) || !ts.yt) continue;
            ts.yt.inferFrequencyModesFromTokenOccurrences(ts.indexTokenOccurrences);
        }
    }

    private async _buildTokenAndLemmaMap(profile: string | undefined, subtitles: RichSubtitleModel[]): Promise<void> {
        const eventsPerTrack = new Map<number, string[]>();
        for (const subtitle of subtitles) {
            const eventsForTrack = eventsPerTrack.get(subtitle.track);
            if (eventsForTrack) eventsForTrack.push(subtitle.text);
            else eventsPerTrack.set(subtitle.track, [subtitle.text]);
        }

        for (const [track, texts] of eventsPerTrack.entries()) {
            const ts = this.trackStates[track];
            try {
                if (!ts.yt) continue;
                const tokenizeBulkRes = await ts.yt.tokenizeBulk(texts);
                if (!dictionaryStatusCollectionEnabled(ts.dt)) continue; // Still want to bulk tokenize if TokenReadingAnnotation.ALWAYS but no coloring
                if (this.shouldCancelBuild) return;

                for (const token of this.tokensForRefresh) {
                    ts.tokenCollectionExact.delete(token);
                    ts.tokenCollectionLemma.delete(token);
                    ts.tokenCollectionAny.delete(token);
                    ts.tokenStates.delete(token);
                }

                const forExactFormQuery = new Map<string, string[]>();
                const forLemmaFormQuery = new Map<string, string[]>();
                const forAnyFormQuery = new Map<string, string[]>();
                for (const tokenParts of tokenizeBulkRes) {
                    const token = tokenParts
                        .map((p) => p.text)
                        .join('')
                        .trim();
                    if (ts.tokenCollectionExact.enabled) ts.tokenCollectionExact.addQuery(forExactFormQuery, token);
                    if (ts.tokenCollectionLemma.enabled || ts.tokenCollectionAny.enabled) {
                        const lemmas = (await ts.lemmatizeForScript(token, false)) ?? [];
                        if (ts.tokenCollectionLemma.enabled) {
                            for (const lemma of lemmas) {
                                ts.tokenCollectionLemma.addQuery(forLemmaFormQuery, lemma);
                            }
                        }
                        if (ts.tokenCollectionAny.enabled) {
                            for (const lemma of lemmas) {
                                ts.tokenCollectionAny.addQuery(forAnyFormQuery, lemma);
                            }
                        }
                    }
                }
                if (this.shouldCancelBuild) return;

                const [exactFormResultMap, lemmaFormResultMap, anyFormResultsMap] = await Promise.all([
                    forExactFormQuery.size
                        ? this.dictionaryProvider.getBulk(
                              profile,
                              track,
                              ts.tokenCollectionExact.getAllQueries(forExactFormQuery)
                          )
                        : ({} as TokenResults),
                    forLemmaFormQuery.size
                        ? this.dictionaryProvider.getBulk(
                              profile,
                              track,
                              ts.tokenCollectionLemma.getAllQueries(forLemmaFormQuery)
                          )
                        : ({} as TokenResults),
                    forAnyFormQuery.size
                        ? this.dictionaryProvider.getByLemmaBulk(
                              profile,
                              track,
                              ts.tokenCollectionAny.getAllQueries(forAnyFormQuery)
                          )
                        : ({} as LemmaResults),
                ]);
                if (this.shouldCancelBuild) return;

                for (const [token, { states, statuses, externalCandidateStatuses, source }] of Object.entries(
                    exactFormResultMap
                )) {
                    ts.tokenCollectionExact.add(statuses, source, externalCandidateStatuses, token, states);
                }
                for (const [lemma, { states, statuses, externalCandidateStatuses, source }] of Object.entries(
                    lemmaFormResultMap
                )) {
                    ts.tokenCollectionLemma.add(statuses, source, externalCandidateStatuses, lemma, states);
                }
                for (const [lemma, lemmaResults] of Object.entries(anyFormResultsMap)) {
                    for (const { states, statuses, externalCandidateStatuses, source, token } of lemmaResults) {
                        ts.tokenCollectionAny.add(statuses, source, externalCandidateStatuses, lemma, states, token);
                    }
                }
            } catch (e) {
                console.error(`Error building token and lemma map for track ${track}:`, e);
                ts.resetYomitan();
            }
        }
    }

    /**
     * If a subtitle has an existing tokenization, the existing tokens are respected.
     * This function only tokenizes the pieces of text in between the existing tokens, and returns a tokenization
     * containing both the existing and newly-computed tokens.
     */
    private async _tokenizationModelMergedWithExistingOne(
        fullText: string,
        existingTokenization: Tokenization,
        index: number,
        ts: TrackState
    ): Promise<{ reconstructedText: string; tokenization: Tokenization } | undefined> {
        if (!ts.yt) {
            this.tokenRequestFailedForTracks.add(ts.track);
            console.error(`Yomitan not initialized`);
            existingTokenization.error = true;
            return { reconstructedText: fullText, tokenization: existingTokenization };
        }
        if (!existingTokenization.tokens?.length) {
            return this._tokenizationModel(fullText, index, ts);
        }

        // We only respect tokens that were not generated by this class i.e. not marked __internal: true
        const externalTokens = existingTokenization.tokens.filter((t) => !(t as InternalToken).__internal);

        // To ensure that the final token list is in-order, all tokens (existing or not) are chained onto this promise
        let promise: Promise<void> = Promise.resolve();
        const reconstructedTextParts: string[] = [];
        const allTokens: Token[] = [];
        let error = false;

        iterateOverStringInBlocks(
            fullText,
            (_, blockIndex) => externalTokens[blockIndex],
            (left, right, existingToken?: Token) => {
                if (existingToken === undefined) {
                    promise = promise.then(async () => {
                        const model = await this._tokenizationModel(fullText.substring(left, right), index, ts, left);
                        if (this.shouldCancelBuild) return;
                        if (!model) {
                            error = true; // Should only be undefined if this.shouldCancelBuild
                            this.erroredCache.add(index);
                            return;
                        }
                        reconstructedTextParts.push(model.reconstructedText);
                        if (model.tokenization.tokens.length) {
                            for (const t of model.tokenization.tokens) allTokens.push(t);
                        } else if (model.tokenization.error) {
                            error = true;
                            this.erroredCache.add(index);
                        }
                    });
                } else {
                    promise = promise.then(async () => {
                        const tokenText = fullText.substring(existingToken.pos[0], existingToken.pos[1]);
                        const trimmedToken = tokenText.trim();
                        const normalizedToken = normalizeToken(trimmedToken);

                        const indexes = this.tokenToIndexesCache.get(normalizedToken);
                        if (indexes) indexes.add(index);
                        else this.tokenToIndexesCache.set(normalizedToken, new Set([index]));

                        const lemmas = await ts.yt!.lemmatize(trimmedToken);
                        if (this.shouldCancelBuild) return;
                        if (!lemmas) {
                            error = true;
                            this.erroredCache.add(index);
                            return;
                        }
                        for (const lemma of lemmas) {
                            const normalizedLemma = normalizeToken(lemma);
                            const indexes = this.tokenToIndexesCache.get(normalizedLemma);
                            if (indexes) indexes.add(index);
                            else this.tokenToIndexesCache.set(normalizedLemma, new Set([index]));
                        }

                        const states = ts.tokenStates.get(normalizedToken) ?? [];
                        const tokenStatusResult =
                            states.includes(TokenState.IGNORED) || !HAS_LETTER_REGEX.test(trimmedToken)
                                ? { status: getFullyKnownTokenStatus() }
                                : ((await this._tokenStatus(trimmedToken, normalizedToken, ts)) ?? { status: null });
                        const status = tokenStatusResult.status;
                        const source = 'source' in tokenStatusResult ? tokenStatusResult.source : undefined;
                        const token: Token = {
                            pos: [existingToken.pos[0], existingToken.pos[1]],
                            readings: existingToken.readings.map((r) => ({
                                pos: [r.pos[0], r.pos[1]],
                                reading: r.reading,
                            })),
                            status,
                            states,
                            ...ts.groupingKeysForToken(trimmedToken, lemmas, source),
                        };
                        if ('externalCandidateStatuses' in tokenStatusResult) {
                            token.externalCandidateStatuses = tokenStatusResult.externalCandidateStatuses;
                        }
                        if (token.status === null) this.erroredCache.add(index);
                        await this._updateFrequency(token, trimmedToken, index, ts);
                        if (this.shouldCancelBuild) return;

                        reconstructedTextParts.push(tokenText);
                        allTokens.push(token);
                    });
                }
            }
        );
        try {
            await promise;
        } catch (e) {
            this.tokenRequestFailedForTracks.add(ts.track);
            console.error(`Tokenization request failed for index ${index}:`, e);
            this.erroredCache.add(index);
            existingTokenization.error = true;
            return { reconstructedText: fullText, tokenization: existingTokenization };
        }
        if (this.shouldCancelBuild) return;
        return { reconstructedText: reconstructedTextParts.join(''), tokenization: { tokens: allTokens, error } };
    }

    private async _tokenizationModel(
        fullText: string,
        index: number,
        ts: TrackState,
        baseIndex = 0
    ): Promise<{ reconstructedText: string; tokenization: Tokenization } | undefined> {
        try {
            if (!ts.yt) throw new Error(`Yomitan not initialized for Track${ts.track + 1}`);
            const tokenizeRes = await ts.yt.tokenize(fullText);
            if (this.shouldCancelBuild) return;
            ts.yt.verifyTokenizeResult(fullText, tokenizeRes);

            const tokens: Token[] = [];
            let currentOffset = 0;
            let reconstructedTextParts = [];
            for (const tokenParts of tokenizeRes) {
                const tokenText = tokenParts.map((p) => p.text).join('');
                reconstructedTextParts.push(tokenText);
                const trimmedToken = tokenText.trim();
                const normalizedToken = normalizeToken(trimmedToken);

                const indexes = this.tokenToIndexesCache.get(normalizedToken);
                if (indexes) indexes.add(index);
                else this.tokenToIndexesCache.set(normalizedToken, new Set([index]));

                // Build token
                const token: InternalToken = {
                    pos: [baseIndex + currentOffset, baseIndex + currentOffset + tokenText.length],
                    states: ts.tokenStates.get(normalizedToken) ?? [],
                    __internal: true, // This token was generated by this class
                    readings: [],
                };
                tokens.push(token);
                currentOffset += tokenText.length;

                // Build readings
                const externalReadings = this.externalTokenReadings.get(tokenText);
                if (externalReadings) {
                    token.readings = externalReadings.get(ts.track) ?? externalReadings.values().next().value!;
                } else {
                    let currentPartOffset = 0;
                    for (const part of tokenParts) {
                        if (part.reading) {
                            token.readings.push({
                                pos: [currentPartOffset, currentPartOffset + part.text.length],
                                reading: part.reading,
                            });
                        }
                        currentPartOffset += part.text.length;
                    }
                }

                const lemmas = await ts.yt.lemmatize(trimmedToken);
                if (this.shouldCancelBuild) return;
                if (!lemmas) {
                    this.erroredCache.add(index);
                    token.status = null;
                    continue;
                }
                for (const lemma of lemmas) {
                    const normalizedLemma = normalizeToken(lemma);
                    const indexes = this.tokenToIndexesCache.get(normalizedLemma);
                    if (indexes) indexes.add(index);
                    else this.tokenToIndexesCache.set(normalizedLemma, new Set([index]));
                }

                // Build token status
                if (token.states.includes(TokenState.IGNORED) || !HAS_LETTER_REGEX.test(trimmedToken)) {
                    token.status = getFullyKnownTokenStatus();
                    const { groupingKey, lemmasGroupingKey } = ts.groupingKeysForToken(trimmedToken, lemmas, undefined);
                    token.groupingKey = groupingKey;
                    token.lemmasGroupingKey = lemmasGroupingKey;
                    continue;
                }
                const tokenStatusResult = (await this._tokenStatus(trimmedToken, normalizedToken, ts)) ?? {
                    status: null,
                };
                const source = 'source' in tokenStatusResult ? tokenStatusResult.source : undefined;
                token.status = tokenStatusResult.status;
                const { groupingKey, lemmasGroupingKey } = ts.groupingKeysForToken(trimmedToken, lemmas, source);
                token.groupingKey = groupingKey;
                token.lemmasGroupingKey = lemmasGroupingKey;
                if ('externalCandidateStatuses' in tokenStatusResult) {
                    token.externalCandidateStatuses = tokenStatusResult.externalCandidateStatuses;
                }
                if (token.status === null) this.erroredCache.add(index);
                await this._updateFrequency(token, trimmedToken, index, ts);
                if (this.shouldCancelBuild) return;
            }

            return { reconstructedText: reconstructedTextParts.join(''), tokenization: { tokens } };
        } catch (error) {
            this.tokenRequestFailedForTracks.add(ts.track);
            console.error(`Error annotating subtitle text for Track${ts.track + 1}:`, error);
            this.erroredCache.add(index);
            return { reconstructedText: fullText, tokenization: { tokens: [], error: true } };
        }
    }

    private async _updateFrequency(token: Token, trimmedToken: string, index: number, ts: TrackState): Promise<void> {
        if (!ts.yt) throw new Error('Yomitan uninitialized - cannot update token frequency');
        const ano = this.generateStatistics
            ? TokenFrequencyAnnotation.ALWAYS
            : ts.dt.dictionaryTokenFrequencyAnnotation;
        if (ano === TokenFrequencyAnnotation.NEVER) return;
        if (ano === TokenFrequencyAnnotation.UNCOLLECTED_ONLY && token.status !== TokenStatus.UNCOLLECTED) return;
        if (this.initialized || ts.yt.getSupportsBulkFrequency()) {
            token.frequency = await ts.yt.frequency(trimmedToken);
        } else {
            this.refreshCache.add(index);
        }
    }

    private async _tokenStatus(
        trimmedToken: string,
        normalizedToken: string,
        ts: TrackState
    ): Promise<ResolvedTokenStatusResult | null> {
        if (!ts.yt) throw new Error('Yomitan uninitialized - cannot calculate token status');
        const lemmas = await ts.lemmatizeForScript(trimmedToken);
        if (this.shouldCancelBuild) return null;
        if (!lemmas) return null;

        let tokenStatusResult: ResolvedTokenStatusResult | null;
        switch (ts.dt.dictionaryTokenMatchStrategyPriority) {
            case TokenMatchStrategyPriority.EXACT:
                tokenStatusResult = await this._handlePriorityExact(normalizedToken, lemmas, ts);
                break;
            case TokenMatchStrategyPriority.LEMMA:
                tokenStatusResult = await this._handlePriorityLemma(normalizedToken, lemmas, ts);
                break;
            case TokenMatchStrategyPriority.BEST_KNOWN:
                tokenStatusResult = await this._handlePriorityKnown(normalizedToken, lemmas, ts, (tokenStatuses) =>
                    Math.max(...tokenStatuses)
                );
                break;
            case TokenMatchStrategyPriority.LEAST_KNOWN:
                tokenStatusResult = await this._handlePriorityKnown(normalizedToken, lemmas, ts, (tokenStatuses) =>
                    Math.min(...tokenStatuses)
                );
                break;
            default:
                throw new Error(`Unknown strategy priority: ${ts.dt.dictionaryTokenMatchStrategyPriority}`);
        }
        return tokenStatusResult;
    }

    private async _handlePriorityExact(
        normalizedToken: string,
        lemmas: string[],
        ts: TrackState
    ): Promise<ResolvedTokenStatusResult | null> {
        const statusResults: TokenStatusResult[] = [];

        statusResults.push(...ts.tokenCollectionExact.resolveForWord([normalizedToken]));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);
        statusResults.push(...ts.tokenCollectionLemma.resolveForWord(lemmas));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);
        statusResults.push(...ts.tokenCollectionAny.resolveForWord(normalizedToken, lemmas, true));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);

        statusResults.push(...ts.tokenCollectionExact.resolveForSentence([normalizedToken]));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);
        statusResults.push(...ts.tokenCollectionLemma.resolveForSentence(lemmas));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);
        statusResults.push(...ts.tokenCollectionAny.resolveForSentence(normalizedToken, lemmas, true));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);

        return { status: TokenStatus.UNCOLLECTED };
    }

    private async _handlePriorityLemma(
        normalizedToken: string,
        lemmas: string[],
        ts: TrackState
    ): Promise<ResolvedTokenStatusResult | null> {
        const statusResults: TokenStatusResult[] = [];

        statusResults.push(...ts.tokenCollectionLemma.resolveForWord(lemmas));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);
        statusResults.push(...ts.tokenCollectionExact.resolveForWord([normalizedToken]));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);
        statusResults.push(...ts.tokenCollectionAny.resolveForWord(normalizedToken, lemmas, false));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);

        statusResults.push(...ts.tokenCollectionLemma.resolveForSentence(lemmas));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);
        statusResults.push(...ts.tokenCollectionExact.resolveForSentence([normalizedToken]));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);
        statusResults.push(...ts.tokenCollectionAny.resolveForSentence(normalizedToken, lemmas, false));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults);

        return { status: TokenStatus.UNCOLLECTED };
    }

    private async _handlePriorityKnown(
        normalizedToken: string,
        lemmas: string[],
        ts: TrackState,
        cmp: (tokenStatuses: TokenStatus[]) => TokenStatus
    ): Promise<ResolvedTokenStatusResult | null> {
        const statusResults: TokenStatusResult[] = [];

        statusResults.push(...ts.tokenCollectionExact.resolveForWord([normalizedToken]));
        statusResults.push(...ts.tokenCollectionLemma.resolveForWord(lemmas));
        statusResults.push(...ts.tokenCollectionAny.resolveForWord(normalizedToken, lemmas, null));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults, cmp);

        statusResults.push(...ts.tokenCollectionExact.resolveForSentence([normalizedToken]));
        statusResults.push(...ts.tokenCollectionLemma.resolveForSentence(lemmas));
        statusResults.push(...ts.tokenCollectionAny.resolveForSentence(normalizedToken, lemmas, null));
        if (statusResults.length) return TokenCollectionBase.resolveTokenStatusResults(statusResults, cmp);

        return { status: TokenStatus.UNCOLLECTED };
    }

    unbind() {
        this.reset();
        if (this.removeBuildAnkiCacheStateChangeCB) {
            this.removeBuildAnkiCacheStateChangeCB();
            this.removeBuildAnkiCacheStateChangeCB = undefined;
        }
        if (this.removeBuildWaniKaniCacheStateChangeCB) {
            this.removeBuildWaniKaniCacheStateChangeCB();
            this.removeBuildWaniKaniCacheStateChangeCB = undefined;
        }
        if (this.removeAnkiCardModifiedCB) {
            this.removeAnkiCardModifiedCB();
            this.removeAnkiCardModifiedCB = undefined;
        }
        if (this.removeRequestStatisticsSnapshotCB) {
            this.removeRequestStatisticsSnapshotCB();
            this.removeRequestStatisticsSnapshotCB = undefined;
        }
        if (this.removeRequestStatisticsGenerationCB) {
            this.removeRequestStatisticsGenerationCB();
            this.removeRequestStatisticsGenerationCB = undefined;
        }
        if (this.subtitlesInterval) {
            clearInterval(this.subtitlesInterval);
            this.subtitlesInterval = undefined;
        }
    }
}

export class HoveredToken {
    private _hoveredElement: HTMLElement | null;

    constructor() {
        this._hoveredElement = null;
    }

    handleMouseOver(mouseEvent: MouseEvent): void {
        if (!(mouseEvent.target instanceof HTMLElement)) return;
        this._hoveredElement = mouseEvent.target;
    }

    handleMouseOut(mouseEvent: MouseEvent): void {
        if (!(mouseEvent.target instanceof HTMLElement) || this._hoveredElement === mouseEvent.target) {
            this._hoveredElement = null;
        }
    }

    parse(): { token: string; track: number } | null {
        const tokenEl = this._hoveredElement?.closest(`.${ASB_TOKEN_CLASS}`);
        if (!tokenEl) return null;

        const trackStr = tokenEl.closest('[data-track]')?.getAttribute('data-track');
        if (!trackStr) return null;

        let token = '';
        for (const child of tokenEl.childNodes) token += this._extractTokenFromNode(child);
        token = token.trim();
        if (!token.length) return null;
        return { token, track: parseInt(trackStr) };
    }

    private _extractTokenFromNode(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        let token = '';
        const el = node as HTMLElement;
        if (el.tagName === 'RUBY') {
            for (const child of el.childNodes) {
                if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName === 'RT') continue;
                token += this._extractTokenFromNode(child);
            }
            return token;
        }

        for (const child of el.childNodes) token += this._extractTokenFromNode(child);
        return token;
    }
}

export const renderRichTextOntoSubtitles = (subtitles: RichSubtitleModel[], dictionaryTracks?: DictionaryTrack[]) => {
    for (const s of subtitles) {
        if (s.tokenization && !s.richText) {
            s.richText = computeRichText(s.text, s.tokenization, dictionaryTracks?.[s.track]);
        }
    }
};

const computeRichText = (fullText: string, tokenization: Tokenization, dt?: DictionaryTrack) => {
    if (tokenization.error) {
        return `<span ${ERROR_STYLE}>${fullText}</span>`;
    }

    if (!tokenization.tokens?.length) {
        return undefined;
    }

    const parts: string[] = [];
    iterateOverStringInBlocks(
        fullText,
        (_, blockIndex) => tokenization.tokens[blockIndex],
        (left, right, token?: Token) => {
            if (token === undefined) {
                parts.push(fullText.substring(left, right));
            } else {
                parts.push(applyTokenStyle(fullText, token, false, dt));
            }
        }
    );
    return parts.join('');
};

const ERROR_STYLE = `style="text-decoration: line-through red 3px;"`;
const LOGIC_ERROR_STYLE = `style="text-decoration: line-through red 3px double;"`;

export const applyTokenStyle = (fullText: string, token: Token, allowAsciiReading: boolean, dt?: DictionaryTrack) => {
    const tokenText = applyFrequencyAnnotation(
        applyReadingAnnotation(fullText, token, allowAsciiReading, dt),
        token,
        dt
    );
    if (token.status === null) return `<span ${ERROR_STYLE}>${tokenText}</span>`;
    if (token.status === undefined && dt && dictionaryTrackEnabled(dt)) {
        return `<span ${LOGIC_ERROR_STYLE}>${tokenText}</span>`; // External tokens may flash this on initial load
    }
    if (!dt?.dictionaryColorizeSubtitles) return tokenText;

    const s = HAS_LETTER_REGEX.test(tokenText)
        ? `<span class="${ASB_TOKEN_CLASS}${dt.dictionaryHighlightOnHover ? ` ${ASB_TOKEN_HIGHLIGHT_CLASS}` : ''}"`
        : '<span';
    const config = dt.dictionaryTokenStatusConfig[token.status!];
    if (!config.display) return `${s}>${tokenText}</span>`;

    const c = `${config.color}${config.alpha}`;
    const t = dt.dictionaryTokenStylingThickness;
    switch (dt.dictionaryTokenStyling) {
        case TokenStyling.TEXT:
            return `${s} style="-webkit-text-fill-color: ${c};">${tokenText}</span>`;
        case TokenStyling.BACKGROUND:
            return `${s} style="background-color: ${c};">${tokenText}</span>`;
        case TokenStyling.UNDERLINE:
        case TokenStyling.OVERLINE:
            return `${s} style="text-decoration: ${dt.dictionaryTokenStyling} ${c} ${t}px;">${tokenText}</span>`;
        case TokenStyling.OUTLINE:
            return `${s} style="-webkit-text-stroke: ${t}px ${c};">${tokenText}</span>`;
        default:
            return `${s} ${LOGIC_ERROR_STYLE}>${tokenText}</span>`;
    }
};

const applyReadingAnnotation = (fullText: string, token: Token, allowAsciiReading: boolean, dt?: DictionaryTrack) => {
    const tokenText = fullText.substring(token.pos[0], token.pos[1]);
    if (!token.readings.length || !HAS_LETTER_REGEX.test(tokenText)) {
        return tokenText; // Prevent 。 -> まる
    }
    if (ONLY_ASCII_LETTERS_REGEX.test(tokenText) && !allowAsciiReading) {
        return tokenText; // Prevent english words from getting readings
    }

    // Only apply skip logic for tokens generated by this class i.e. marked __internal: true
    if (dt && (token as InternalToken).__internal) {
        const ignoredToken = token.states.includes(TokenState.IGNORED);
        const ano = ignoredToken
            ? dt.dictionaryDisplayIgnoredTokenReadings
                ? TokenReadingAnnotation.ALWAYS
                : TokenReadingAnnotation.NEVER
            : dt.dictionaryTokenReadingAnnotation;
        if (ano === TokenReadingAnnotation.NEVER) return tokenText;
        if (token.status !== undefined && token.status !== null) {
            if (
                (ano === TokenReadingAnnotation.LEARNING_OR_BELOW && token.status > TokenStatus.LEARNING) ||
                (ano === TokenReadingAnnotation.UNKNOWN_OR_BELOW && token.status > TokenStatus.UNKNOWN)
            ) {
                return tokenText;
            }
        }
    }

    const parts: string[] = [];
    iterateOverStringInBlocks(
        tokenText,
        (_, blockIndex) => token.readings[blockIndex],
        (left, right, reading?: TokenReading) => {
            if (reading === undefined) {
                parts.push(tokenText.substring(left, right));
            } else {
                const part = tokenText.substring(reading.pos[0], reading.pos[1]);
                parts.push(`<ruby class="${ASB_READING_CLASS}">${part}<rt>${reading.reading}</rt></ruby>`);
            }
        }
    );
    return parts.join('');
};

const applyFrequencyAnnotation = (tokenText: string, token: Token, dt?: DictionaryTrack) => {
    if (token.frequency == null || !HAS_LETTER_REGEX.test(tokenText) || !dt) return tokenText;
    if (dt.dictionaryTokenFrequencyAnnotation === TokenFrequencyAnnotation.NEVER) return tokenText;
    if (
        dt.dictionaryTokenFrequencyAnnotation === TokenFrequencyAnnotation.UNCOLLECTED_ONLY &&
        token.status !== TokenStatus.UNCOLLECTED
    ) {
        return tokenText;
    }
    return `<ruby class="${ASB_FREQUENCY_CLASS}">${tokenText}<rt>${token.frequency}</rt></ruby>`;
};
