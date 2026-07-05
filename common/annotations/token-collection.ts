import {
    DictionaryTokenSource,
    dictionaryTokenSourcePriority,
    externalWordSourcePriority,
    isExternalWordSource,
    TokenMatchStrategy,
    TokenState,
    TokenStatus,
    isWordSource,
    TokenMatchStrategyPriority,
    DictionaryTrack,
} from '@project/common/settings';
import { TokenStatusInfo } from '@project/common/dictionary-db';
import { getTokenStatus, dedupeTokenStatusInfos, isKanaOnly, normalizeToken } from '@project/common/util';
import type { TrackState } from '@project/common/annotations';

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
export class TokenCollectionBase<T = TokenStatusResult | TokenStatusResult[]> {
    protected readonly collection: Map<string, T>;
    protected readonly dt: DictionaryTrack;
    protected readonly updateTokenStates: (normalizedToken: string, states: TokenState[]) => void;
    readonly enabled: boolean;
    readonly wordEnabled: boolean;
    readonly sentenceEnabled: boolean;

    constructor(
        classType:
            | TokenMatchStrategy.EXACT_FORM_COLLECTED
            | TokenMatchStrategy.LEMMA_FORM_COLLECTED
            | TokenMatchStrategy.ANY_FORM_COLLECTED,
        dt: DictionaryTrack,
        updateTokenStates: (normalizedToken: string, states: TokenState[]) => void
    ) {
        this.collection = new Map();
        this.dt = dt;
        this.updateTokenStates = updateTokenStates;
        switch (classType) {
            case TokenMatchStrategy.EXACT_FORM_COLLECTED:
                this.wordEnabled =
                    dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.EXACT_FORM_COLLECTED ||
                    dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
                this.sentenceEnabled =
                    dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.EXACT_FORM_COLLECTED ||
                    dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
                break;
            case TokenMatchStrategy.LEMMA_FORM_COLLECTED:
                this.wordEnabled =
                    dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.LEMMA_FORM_COLLECTED ||
                    dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
                this.sentenceEnabled =
                    dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.LEMMA_FORM_COLLECTED ||
                    dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
                break;
            case TokenMatchStrategy.ANY_FORM_COLLECTED:
                this.wordEnabled = dt.dictionaryTokenMatchStrategy === TokenMatchStrategy.ANY_FORM_COLLECTED;
                this.sentenceEnabled =
                    dt.dictionaryAnkiSentenceTokenMatchStrategy === TokenMatchStrategy.ANY_FORM_COLLECTED;
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

    updateDictionaryTrack(dt: DictionaryTrack) {
        (this.dt as DictionaryTrack) = dt;
    }

    protected tokenStatusResult(
        statuses: TokenStatusInfo[],
        source: DictionaryTokenSource,
        externalCandidateStatuses?: TokenStatusInfo[],
        normalizedToken?: string
    ): TokenStatusResult {
        const candidateStatuses = externalCandidateStatuses ?? statuses;
        return {
            status: getTokenStatus(statuses, this.dt.dictionaryAnkiTreatSuspended),
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

export class TokenCollection extends TokenCollectionBase<TokenStatusResult> {
    add(
        statuses: TokenStatusInfo[],
        source: DictionaryTokenSource,
        externalCandidateStatuses: TokenStatusInfo[] | undefined,
        key: string,
        states: TokenState[]
    ): void {
        const normalizedKey = normalizeToken(key);
        this.updateTokenStates(normalizedKey, states);
        const statusResult = this.tokenStatusResult(statuses, source, externalCandidateStatuses);
        const existing = this.collection.get(normalizedKey);
        this.collection.set(
            normalizedKey,
            existing ? super.mergeTokenStatusResults(existing, statusResult) : statusResult
        );
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

export class TokenCollectionArray extends TokenCollectionBase<TokenStatusResult[]> {
    add(
        statuses: TokenStatusInfo[],
        source: DictionaryTokenSource,
        externalCandidateStatuses: TokenStatusInfo[] | undefined,
        normalizedKey: string,
        states: TokenState[],
        token: string
    ): void {
        const normalizedToken = normalizeToken(token);
        this.updateTokenStates(normalizedToken, states);
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
                if (this.dt.dictionaryMatchAcrossScripts) {
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

export async function resolveTokenStatus(
    trimmedToken: string,
    normalizedToken: string,
    ts: TrackState
): Promise<ResolvedTokenStatusResult | null> {
    if (!ts.yt) throw new Error('Yomitan uninitialized - cannot calculate token status');
    const lemmas = await ts.lemmatizeForScript(trimmedToken);
    if (!lemmas) return null;

    let tokenStatusResult: ResolvedTokenStatusResult | null;
    switch (ts.dt.dictionaryTokenMatchStrategyPriority) {
        case TokenMatchStrategyPriority.EXACT:
            tokenStatusResult = await handlePriorityExact(normalizedToken, lemmas, ts);
            break;
        case TokenMatchStrategyPriority.LEMMA:
            tokenStatusResult = await handlePriorityLemma(normalizedToken, lemmas, ts);
            break;
        case TokenMatchStrategyPriority.BEST_KNOWN:
            tokenStatusResult = await handlePriorityKnown(normalizedToken, lemmas, ts, (tokenStatuses) =>
                Math.max(...tokenStatuses)
            );
            break;
        case TokenMatchStrategyPriority.LEAST_KNOWN:
            tokenStatusResult = await handlePriorityKnown(normalizedToken, lemmas, ts, (tokenStatuses) =>
                Math.min(...tokenStatuses)
            );
            break;
        default:
            throw new Error(`Unknown strategy priority: ${ts.dt.dictionaryTokenMatchStrategyPriority}`);
    }
    return tokenStatusResult;
}

async function handlePriorityExact(
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

async function handlePriorityLemma(
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

async function handlePriorityKnown(
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
