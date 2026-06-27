import { Progress } from '@project/common';
import {
    getFullyKnownTokenStatus,
    isTokenStatusKnown,
    NUM_TOKEN_STATUSES,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import {
    DictionaryStatisticsRawTrackSnapshot,
    DictionaryStatisticsSentence,
    DictionaryStatisticsSentences,
    DictionaryStatisticsSnapshot,
    DictionaryStatisticsWaniKaniSnapshot,
    REVIEW_DUES,
} from '@project/common/dictionary-statistics';
import { TokenStatusInfo, WaniKaniTokenStatusInfo } from '@project/common/dictionary-db';
import {
    dedupeTokenStatusInfos,
    getTokenStatus,
    HAS_LETTER_REGEX,
    MS_PER_DAY,
    utcStartOfToday,
} from '@project/common/util';

/**
 * This file along with its consumers can be freely modified without concern to version
 * mismatch between the extension and app. Changes to the published snapshots however
 * must be made with consideration to backwards compatibility.
 */

const dictionaryStatisticsFrequencyBuckets = [1000, 2000, 5000, 10000, 20000] as const;
const minimumComprehensionStatus = TokenStatus.UNKNOWN;
const fullyKnownTokenStatus = getFullyKnownTokenStatus();
const comprehensionStatusRange = fullyKnownTokenStatus - minimumComprehensionStatus;

export type DictionaryComprehensionBand = {
    min: number;
    max: number;
    label: string;
    color: string;
    textColor: string;
};

export const dictionaryStatisticsComprehensionBands = [
    { min: 0, max: 60, label: '<60', color: '#c62828', textColor: '#ffffff' },
    { min: 60, max: 70, label: '60+', color: '#ef6c00', textColor: '#ffffff' },
    { min: 70, max: 80, label: '70+', color: '#f9a825', textColor: '#111111' },
    { min: 80, max: 90, label: '80+', color: '#2e7d32', textColor: '#ffffff' },
    { min: 90, max: 95, label: '90+', color: '#1565c0', textColor: '#ffffff' },
    { min: 95, max: 100, label: '95+', color: 'primary.main', textColor: 'primary.contrastText' },
] as DictionaryComprehensionBand[];

export type DictionaryStatisticsSentenceSort = 'index' | 'frequency' | 'occurrences' | 'comprehension';
const sortCategories: DictionaryStatisticsSentenceSort[] = ['index', 'frequency', 'occurrences', 'comprehension'];

export type DictionaryStatisticsSentenceSortDirection = 'asc' | 'desc';
const sortDirections: DictionaryStatisticsSentenceSortDirection[] = ['asc', 'desc'];

export interface DictionaryStatisticsSentenceSortState {
    sort: DictionaryStatisticsSentenceSort;
    direction: DictionaryStatisticsSentenceSortDirection;
}

export type DictionaryStatisticsSentenceDialogBucket =
    | {
          kind: 'allKnown';
      }
    | {
          kind: 'uncollected';
          groupIndex: number;
      }
    | {
          kind: 'unknown';
          groupIndex: number;
      };

export interface DictionaryStatisticsTokenStatusCount {
    numUnique: number;
    numOccurrences: number;
}

export type DictionaryStatisticsTokenStatusCounts = Map<TokenStatus, DictionaryStatisticsTokenStatusCount>;
export interface DictionaryStatisticsFrequencyBucketStatusCount {
    numUnique: number;
    numOccurrences: number;
}

export type DictionaryStatisticsFrequencyBucketStatusCounts = Map<
    TokenStatus,
    DictionaryStatisticsFrequencyBucketStatusCount
>;

export interface DictionaryStatisticsSentenceStatusCounts {
    sentence: DictionaryStatisticsSentence;
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    comprehensionPercent: number;
    comprehensionBandIndex: number;
}

export interface DictionaryStatisticsSentenceTotals {
    processedSentenceCount: number;
    totalWords: number;
    totalKnownWords: number;
    statusCounts: DictionaryStatisticsSentenceStatusCounts[];
}

export interface DictionaryStatisticsFrequencyBucket {
    label: string;
    count: number;
    statusCounts: DictionaryStatisticsFrequencyBucketStatusCounts;
    numOccurrences: number;
    percent: number;
}

export interface DictionaryStatisticsSentenceComprehensionPoint {
    sentence: DictionaryStatisticsSentence;
    comprehensionPercent: number;
    comprehensionBandIndex: number;
}

export interface DictionaryStatisticsSentenceBucketEntry {
    sentence: DictionaryStatisticsSentence;
    numConsideredTokens: number;
    numKnownTokens: number;
    numUnknownTokens: number;
    numUncollectedTokens: number;
    lowestFrequency?: number;
    highestOccurrences: number;
    comprehensionPercent: number;
    comprehensionBandIndex: number;
}

export interface DictionaryStatisticsSentenceUncollectedBucket {
    tokenCount: number;
    count: number;
    entries: DictionaryStatisticsSentenceBucketEntry[];
}

export interface DictionaryStatisticsSentenceUnknownBucket {
    tokenCount: number;
    count: number;
    entries: DictionaryStatisticsSentenceBucketEntry[];
}

export interface DictionaryStatisticsSentenceBuckets {
    allKnown: {
        count: number;
        entries: DictionaryStatisticsSentenceBucketEntry[];
    };
    uncollected: DictionaryStatisticsSentenceUncollectedBucket[];
    unknown: DictionaryStatisticsSentenceUnknownBucket[];
}

export interface DictionaryStatisticsRewatchProjection {
    ankiUnknownCardsByDeck?: Record<string, number>;
    ankiLearningOrAboveIsMature?: boolean;
    waniKaniLevel?: number;
}

export type DictionaryStatisticsRewatchProjectionsByTrack = Record<number, DictionaryStatisticsRewatchProjection>;

export interface DictionaryStatisticsAnkiUnknownCardsByDeck {
    deckName: string;
    totalUnknownCards: number;
}

export interface DictionaryStatisticsAnkiDeckProjectionStats {
    deckName: string;
    knownWords: number;
    totalWords: number;
}

export interface DictionaryStatisticsWaniKaniProjectionStats {
    level?: number;
    knownWords: number;
    totalWords: number;
}

export interface DictionaryStatisticsRewatchSnapshot {
    rewatch: number;
    numKnownTokens: number;
    numDictionaryKnownTokens: number;
    knownPercent: number;
    comprehensionPercent: number;
    averageWordsPerSentence: number;
    averageKnownWordsPerSentence: number;
    sentenceTotals: DictionaryStatisticsSentenceTotals;
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    sentenceBuckets: DictionaryStatisticsSentenceBuckets;
    ankiDeckStats: DictionaryStatisticsAnkiDeckProjectionStats[];
    waniKaniStats?: DictionaryStatisticsWaniKaniProjectionStats;
}

export interface DictionaryStatisticsTrackSnapshot {
    track: number;
    progress: Progress;
    progressPercent: number;
    statusColors: Record<TokenStatus, string>;
    numDictionaryKnownTokens: number;
    numDictionaryIgnoredTokens: number;
    numUniqueTokens: number;
    consideredTokens: number;
    numIgnoredTokens: number;
    numIgnoredOccurrences: number;
    numKnownTokens: number;
    knownPercent: number;
    comprehensionPercent: number;
    averageWordsPerSentence: number;
    averageKnownWordsPerSentence: number;
    sentenceTotals: DictionaryStatisticsSentenceTotals;
    sentenceComprehensionPoints: DictionaryStatisticsSentenceComprehensionPoint[];
    allSentenceEntries: DictionaryStatisticsSentenceBucketEntry[];
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    frequencyBuckets: DictionaryStatisticsFrequencyBucket[];
    sentenceBuckets: DictionaryStatisticsSentenceBuckets;
    ankiDeckStats: DictionaryStatisticsAnkiDeckProjectionStats[];
    waniKaniStats?: DictionaryStatisticsWaniKaniProjectionStats;
    rewatchSnapshots: DictionaryStatisticsRewatchSnapshot[];
    totalUnknownAnkiCards: number;
    unknownAnkiCardsByDeck: DictionaryStatisticsAnkiUnknownCardsByDeck[];
}

export interface DictionaryStatisticsAnkiDueCounts {
    today: number;
    tomorrow: number;
    week: number;
}

export type DictionaryStatisticsWaniKaniDueCounts = DictionaryStatisticsAnkiDueCounts;

export interface DictionaryStatisticsAnkiDeckModelSnapshot {
    modelName: string;
    uniqueWords: number;
    frequencyBuckets: DictionaryStatisticsFrequencyBucket[];
}

export interface DictionaryStatisticsAnkiDeckSnapshot {
    deckName: string;
    dueCounts: DictionaryStatisticsAnkiDueCounts;
    suspendedCards: number;
    modelSnapshots: DictionaryStatisticsAnkiDeckModelSnapshot[];
}

export interface DictionaryStatisticsAnkiTrackSnapshot {
    available?: boolean;
    progress?: Progress;
    progressPercent: number;
    dueCounts: DictionaryStatisticsAnkiDueCounts;
    deckSnapshots: DictionaryStatisticsAnkiDeckSnapshot[];
}

export interface DictionaryStatisticsWaniKaniTrackSnapshot {
    available?: boolean;
    dueCounts: DictionaryStatisticsWaniKaniDueCounts;
    uniqueWords: number;
    frequencyBuckets: DictionaryStatisticsFrequencyBucket[];
}

interface ProcessedTokenSnapshot {
    status: TokenStatus;
    ignored: boolean;
    frequency: number | null;
    numOccurrences: number;
    externalCandidateStatuses?: TokenStatusInfo[];
}
type ProcessedTokenSnapshots = Map<string, ProcessedTokenSnapshot>;

interface ProcessedSentenceSnapshot {
    sentence: DictionaryStatisticsSentence;
    tokens: ProcessedTokenSnapshots;
}

type TokenGrouping = 'surface' | 'lemma';

type DictionaryStatisticsDictionaryTokens = DictionaryStatisticsRawTrackSnapshot['stats']['dictionary']['tokens'];

interface EvaluatedSentenceSnapshot {
    sentence: DictionaryStatisticsSentence;
    numConsideredTokens: number;
    numKnownTokens: number;
    numUnknownTokens: number;
    numUncollectedTokens: number;
    statusCounts: DictionaryStatisticsTokenStatusCounts;
    consideredTokenKeys: string[];
    uncollectedTokenKeys: string[];
    unknownTokenKeys: string[];
}

interface DictionaryStatisticsDictionaryCounts {
    numKnownTokens: number;
    numIgnoredTokens: number;
}

function emptyAnkiDueCounts(): DictionaryStatisticsAnkiDueCounts {
    return {
        today: 0,
        tomorrow: 0,
        week: 0,
    };
}

function hasCardId(status: TokenStatusInfo): status is TokenStatusInfo & { cardId: number } {
    return status.cardId !== undefined;
}

type WaniKaniTokenStatus = TokenStatusInfo & { waniKani: WaniKaniTokenStatusInfo };
type WaniKaniAssignmentTokenStatus = TokenStatusInfo & {
    waniKani: WaniKaniTokenStatusInfo & { assignmentId: number };
};

function hasWaniKani(status: TokenStatusInfo): status is WaniKaniTokenStatus {
    return status.waniKani !== undefined;
}

function hasAssignmentId(status: WaniKaniTokenStatus): status is WaniKaniAssignmentTokenStatus {
    return status.waniKani.assignmentId !== undefined;
}

function incrementAnkiDueCounts(
    counts: DictionaryStatisticsAnkiDueCounts,
    tokenStatuses: (TokenStatusInfo & { cardId: number })[],
    dueByToday: Set<number>,
    dueByTomorrow: Set<number>,
    dueByWeek: Set<number>
) {
    if (tokenStatuses.some(({ cardId }) => dueByToday.has(cardId))) counts.today += 1;
    if (tokenStatuses.some(({ cardId }) => dueByTomorrow.has(cardId))) counts.tomorrow += 1;
    if (tokenStatuses.some(({ cardId }) => dueByWeek.has(cardId))) counts.week += 1;
}

function incrementWaniKaniDueCounts(
    counts: DictionaryStatisticsWaniKaniDueCounts,
    tokenStatuses: WaniKaniAssignmentTokenStatus[],
    dueByToday: Set<number>,
    dueByTomorrow: Set<number>,
    dueByWeek: Set<number>
) {
    if (tokenStatuses.some(({ waniKani }) => dueByToday.has(waniKani.assignmentId))) counts.today += 1;
    if (tokenStatuses.some(({ waniKani }) => dueByTomorrow.has(waniKani.assignmentId))) counts.tomorrow += 1;
    if (tokenStatuses.some(({ waniKani }) => dueByWeek.has(waniKani.assignmentId))) counts.week += 1;
}

function waniKaniDueAssignmentSets(waniKaniSnapshot?: DictionaryStatisticsWaniKaniSnapshot) {
    const dueByToday = new Set<number>();
    const dueByTomorrow = new Set<number>();
    const dueByWeek = new Set<number>();
    if (!waniKaniSnapshot) return { dueByToday, dueByTomorrow, dueByWeek };

    const todayStart = utcStartOfToday();
    const todayEnd = todayStart.getTime() + (REVIEW_DUES[0] + 1) * MS_PER_DAY;
    const tomorrowEnd = todayStart.getTime() + (REVIEW_DUES[1] + 1) * MS_PER_DAY;
    const weekEnd = todayStart.getTime() + REVIEW_DUES[2] * MS_PER_DAY;
    for (const assignment of waniKaniSnapshot.assignments) {
        if (assignment.data.hidden) continue;
        if (waniKaniSnapshot.subjects[assignment.subjectId]?.data.hidden_at) continue;
        const availableAt = assignment.data.available_at;
        if (availableAt === null || availableAt === undefined) continue;
        const availableAtTime = Date.parse(availableAt);
        if (!Number.isFinite(availableAtTime)) continue;
        if (availableAtTime < todayEnd) dueByToday.add(assignment.assignmentId);
        if (availableAtTime < tomorrowEnd) dueByTomorrow.add(assignment.assignmentId);
        if (availableAtTime < weekEnd) dueByWeek.add(assignment.assignmentId);
    }

    return { dueByToday, dueByTomorrow, dueByWeek };
}

function dictionaryTokenForGroupingKey(groupingKey: string, dictionaryTokens: DictionaryStatisticsDictionaryTokens) {
    if (groupingKey in dictionaryTokens) return dictionaryTokens[groupingKey];
    if (groupingKey.startsWith('token:')) return dictionaryTokens[groupingKey.slice('token:'.length)];
    return;
}

export function clampPercent(value: number) {
    return Math.max(0, Math.min(100, value));
}

export function percent(value: number, total: number) {
    return total > 0 ? (value / total) * 100 : 0;
}

export function percentDisplay(value: number) {
    const fractionDigits = value === 100 ? 0 : value > 99 ? 3 : 1;
    return `${value.toFixed(fractionDigits)}%`;
}

export function dictionaryStatisticsComprehensionBandForPercent(value: number) {
    return dictionaryStatisticsComprehensionBands[comprehensionBandIndexForPercent(value)];
}

export function averageDisplay(value: number) {
    return value.toFixed(1);
}

export function countPercentOccurrencesDisplay(count: number, total: number, occurrences: number) {
    return `${count} · ${percentDisplay(percent(count, total))} (${occurrences})`;
}

function averageFromTotals(total: number, count: number) {
    return count > 0 ? total / count : 0;
}

function comprehensionScore(status: TokenStatus): number {
    return (Math.max(status, minimumComprehensionStatus) - minimumComprehensionStatus) / comprehensionStatusRange;
}

function comprehensionFromStatusOccurrences(statusCounts: DictionaryStatisticsTokenStatusCounts): number {
    let totalOccurrences = 0;
    let comprehensionSum = 0;

    for (let status: TokenStatus = 0; status < NUM_TOKEN_STATUSES; ++status) {
        const numOccurrences = statusCounts.get(status)?.numOccurrences ?? 0;
        totalOccurrences += numOccurrences;
        comprehensionSum += numOccurrences * comprehensionScore(status);
    }

    return totalOccurrences > 0 ? (comprehensionSum / totalOccurrences) * 100 : 0;
}

function comprehensionBandIndexForPercent(value: number): number {
    const clampedValue = clampPercent(value);
    for (let i = 0; i < dictionaryStatisticsComprehensionBands.length - 1; ++i) {
        if (clampedValue < dictionaryStatisticsComprehensionBands[i].max) return i;
    }
    return dictionaryStatisticsComprehensionBands.length - 1;
}

function sentenceAveragesFromTotals(sentenceTotals: DictionaryStatisticsSentenceTotals) {
    return {
        averageWordsPerSentence: averageFromTotals(sentenceTotals.totalWords, sentenceTotals.processedSentenceCount),
        averageKnownWordsPerSentence: averageFromTotals(
            sentenceTotals.totalKnownWords,
            sentenceTotals.processedSentenceCount
        ),
    };
}

function sentenceComprehensionPointsFromSentenceTotals(
    sentenceTotals: DictionaryStatisticsSentenceTotals
): DictionaryStatisticsSentenceComprehensionPoint[] {
    return sentenceTotals.statusCounts.map(({ sentence, comprehensionPercent, comprehensionBandIndex }) => ({
        sentence,
        comprehensionPercent,
        comprehensionBandIndex,
    }));
}

export function sentenceComprehensionPointLabel(point: DictionaryStatisticsSentenceComprehensionPoint) {
    return `#${point.sentence.index + 1} · ${percentDisplay(point.comprehensionPercent)}`;
}

export function sentenceComprehensionXAxisLabels(points: DictionaryStatisticsSentenceComprehensionPoint[]) {
    const total = points.length;
    if (total <= 0) return [{ value: 1, position: 0 }];

    const increment = Math.max(50, Math.ceil(total / 10));
    const values = new Set<number>([1]);
    for (let value = increment; value < total; value += increment) values.add(value);

    const denominator = Math.max(total - 1, 1);
    return Array.from(values)
        .sort((left, right) => left - right)
        .map((value) => ({
            value,
            position: total === 1 ? 0 : ((value - 1) / denominator) * 100,
        }));
}

function emptyStatusCounts(): DictionaryStatisticsTokenStatusCounts {
    const counts: DictionaryStatisticsTokenStatusCounts = new Map();
    for (let status: TokenStatus = 0; status < NUM_TOKEN_STATUSES; ++status) {
        counts.set(status, {
            numUnique: 0,
            numOccurrences: 0,
        });
    }
    return counts;
}

function emptyFrequencyBucketStatusCounts(): DictionaryStatisticsFrequencyBucketStatusCounts {
    const counts: DictionaryStatisticsFrequencyBucketStatusCounts = new Map();
    for (let status: TokenStatus = 0; status < NUM_TOKEN_STATUSES; ++status) {
        counts.set(status, {
            numUnique: 0,
            numOccurrences: 0,
        });
    }
    return counts;
}

function emptySentenceBuckets(): DictionaryStatisticsSentenceBuckets {
    return {
        allKnown: {
            count: 0,
            entries: [],
        },
        uncollected: [
            {
                tokenCount: 1,
                count: 0,
                entries: [],
            },
            {
                tokenCount: 2,
                count: 0,
                entries: [],
            },
        ],
        unknown: [
            {
                tokenCount: 1,
                count: 0,
                entries: [],
            },
            {
                tokenCount: 2,
                count: 0,
                entries: [],
            },
        ],
    };
}

function uncollectedSentenceBucketForCount(
    sentenceBuckets: DictionaryStatisticsSentenceUncollectedBucket[],
    tokenCount: number
) {
    if (tokenCount <= 0) return;
    return tokenCount === 1 ? sentenceBuckets[0] : sentenceBuckets[1];
}

function unknownSentenceBucketForCount(
    sentenceBuckets: DictionaryStatisticsSentenceUnknownBucket[],
    tokenCount: number
) {
    if (tokenCount <= 0) return;
    return tokenCount === 1 ? sentenceBuckets[0] : sentenceBuckets[1];
}

function mergeTokenSnapshot(
    prev: ProcessedTokenSnapshot | undefined,
    curr: ProcessedTokenSnapshot
): ProcessedTokenSnapshot {
    if (!prev) return { ...curr };
    return {
        status: Math.max(prev.status, curr.status),
        ignored: prev.ignored && curr.ignored,
        frequency:
            prev.frequency != null && curr.frequency != null
                ? Math.min(prev.frequency, curr.frequency)
                : (prev.frequency ?? curr.frequency),
        numOccurrences: prev.numOccurrences + curr.numOccurrences,
        externalCandidateStatuses: dedupeTokenStatusInfos([
            ...(prev.externalCandidateStatuses ?? []),
            ...(curr.externalCandidateStatuses ?? []),
        ]),
    };
}

function processSentenceSnapshots(
    sentences: DictionaryStatisticsSentences,
    grouping: TokenGrouping
): ProcessedSentenceSnapshot[] {
    const sentenceSnapshots: ProcessedSentenceSnapshot[] = [];
    for (const sentence of Object.values(sentences).sort((left, right) => left.index - right.index)) {
        const tokens: ProcessedTokenSnapshots = new Map();
        for (const token of sentence.tokenization?.tokens ?? []) {
            const key = grouping === 'lemma' ? (token.lemmasGroupingKey ?? token.groupingKey) : token.groupingKey;
            if (!key) continue;
            const tokenText = sentence.text.substring(token.pos[0], token.pos[1]);
            if (!HAS_LETTER_REGEX.test(tokenText)) continue;
            tokens.set(
                key,
                mergeTokenSnapshot(tokens.get(key), {
                    status: token.status ?? TokenStatus.UNCOLLECTED,
                    ignored: token.states.includes(TokenState.IGNORED),
                    frequency: token.frequency ?? null,
                    numOccurrences: 1,
                    externalCandidateStatuses: token.externalCandidateStatuses,
                })
            );
        }
        sentenceSnapshots.push({ sentence, tokens });
    }
    return sentenceSnapshots;
}

function surfaceProjectedStatusesForGrouping(
    sentenceSnapshots: ProcessedSentenceSnapshot[],
    projectedStatuses: Map<string, TokenStatus>,
    grouping: TokenGrouping
) {
    const groupedStatuses = new Map<string, TokenStatus>();
    for (const { sentence } of sentenceSnapshots) {
        for (const token of sentence.tokenization?.tokens ?? []) {
            const sourceKey = token.groupingKey;
            const targetKey = grouping === 'lemma' ? (token.lemmasGroupingKey ?? token.groupingKey) : token.groupingKey;
            if (!sourceKey || !targetKey || token.states.includes(TokenState.IGNORED)) continue;
            const projectedStatus = projectedStatuses.get(sourceKey);
            if (projectedStatus === undefined) continue;
            const tokenText = sentence.text.substring(token.pos[0], token.pos[1]);
            if (!HAS_LETTER_REGEX.test(tokenText)) continue;

            groupedStatuses.set(
                targetKey,
                Math.max(groupedStatuses.get(targetKey) ?? projectedStatus, projectedStatus) as TokenStatus
            );
        }
    }
    return groupedStatuses;
}

function mergeProjectedStatuses(...projectedStatusMaps: Map<string, TokenStatus>[]) {
    const mergedStatuses = new Map<string, TokenStatus>();
    for (const projectedStatuses of projectedStatusMaps) {
        for (const [tokenKey, status] of projectedStatuses.entries()) {
            mergedStatuses.set(tokenKey, Math.max(mergedStatuses.get(tokenKey) ?? status, status) as TokenStatus);
        }
    }
    return mergedStatuses;
}

function mergeSentenceTokenSnapshots(sentenceSnapshots: ProcessedSentenceSnapshot[]): ProcessedTokenSnapshots {
    const tokens: ProcessedTokenSnapshots = new Map();
    for (const { tokens: sentenceTokens } of sentenceSnapshots) {
        for (const [key, token] of sentenceTokens.entries())
            tokens.set(key, mergeTokenSnapshot(tokens.get(key), token));
    }
    return tokens;
}

function evaluateSentenceSnapshot(
    sentenceSnapshot: ProcessedSentenceSnapshot,
    projectedStatuses?: Map<string, TokenStatus>
): EvaluatedSentenceSnapshot {
    const statusCounts = emptyStatusCounts();
    let numConsideredTokens = 0;
    let numKnownTokens = 0;
    let numUnknownTokens = 0;
    let numUncollectedTokens = 0;
    const consideredTokenKeys: string[] = [];
    const uncollectedTokenKeys: string[] = [];
    const unknownTokenKeys: string[] = [];

    for (const [tokenKey, token] of sentenceSnapshot.tokens.entries()) {
        if (token.ignored) continue;

        const status = Math.max(projectedStatuses?.get(tokenKey) ?? token.status, token.status) as TokenStatus;
        numConsideredTokens += 1;
        consideredTokenKeys.push(tokenKey);
        const count = statusCounts.get(status)!;
        count.numUnique += 1;
        count.numOccurrences += token.numOccurrences;

        if (isTokenStatusKnown(status)) {
            numKnownTokens += 1;
            continue;
        }
        if (status === TokenStatus.UNKNOWN) {
            numUnknownTokens += 1;
            unknownTokenKeys.push(tokenKey);
            continue;
        }
        if (status === TokenStatus.UNCOLLECTED) {
            numUncollectedTokens += 1;
            uncollectedTokenKeys.push(tokenKey);
        }
    }

    return {
        sentence: sentenceSnapshot.sentence,
        numConsideredTokens,
        numKnownTokens,
        numUnknownTokens,
        numUncollectedTokens,
        statusCounts,
        consideredTokenKeys,
        uncollectedTokenKeys,
        unknownTokenKeys,
    };
}

function sentenceTotals(sentenceSnapshots: EvaluatedSentenceSnapshot[]): DictionaryStatisticsSentenceTotals {
    const totalWords = sentenceSnapshots.reduce(
        (sum, sentenceSnapshot) => sum + sentenceSnapshot.numConsideredTokens,
        0
    );
    const totalKnownWords = sentenceSnapshots.reduce(
        (sum, sentenceSnapshot) => sum + sentenceSnapshot.numKnownTokens,
        0
    );

    return {
        processedSentenceCount: sentenceSnapshots.length,
        totalWords,
        totalKnownWords,
        statusCounts: sentenceSnapshots.map((sentenceSnapshot) => {
            const comprehensionPercent = comprehensionFromStatusOccurrences(sentenceSnapshot.statusCounts);
            return {
                sentence: sentenceSnapshot.sentence,
                statusCounts: sentenceSnapshot.statusCounts,
                comprehensionPercent,
                comprehensionBandIndex: comprehensionBandIndexForPercent(comprehensionPercent),
            };
        }),
    };
}

function sentenceBucketEntry(
    sentenceSnapshot: EvaluatedSentenceSnapshot,
    relevantTokenKeys: string[],
    tokens: ProcessedTokenSnapshots
): DictionaryStatisticsSentenceBucketEntry {
    let lowestFrequency: number | undefined;
    let highestOccurrences = 0;

    for (const tokenKey of relevantTokenKeys) {
        const token = tokens.get(tokenKey); // Using global counts is more accurate but filtered views may have 3 sentences with a token above 4 sentences with another token
        if (!token || token.ignored) continue;

        if (token.frequency != null && (lowestFrequency === undefined || token.frequency < lowestFrequency)) {
            lowestFrequency = token.frequency;
        }

        if (token.numOccurrences > highestOccurrences) highestOccurrences = token.numOccurrences;
    }

    const comprehensionPercent = comprehensionFromStatusOccurrences(sentenceSnapshot.statusCounts);

    return {
        sentence: sentenceSnapshot.sentence,
        numConsideredTokens: sentenceSnapshot.numConsideredTokens,
        numKnownTokens: sentenceSnapshot.numKnownTokens,
        numUnknownTokens: sentenceSnapshot.numUnknownTokens,
        numUncollectedTokens: sentenceSnapshot.numUncollectedTokens,
        lowestFrequency,
        highestOccurrences,
        comprehensionPercent,
        comprehensionBandIndex: comprehensionBandIndexForPercent(comprehensionPercent),
    };
}

function allSentenceEntries(
    sentenceSnapshots: EvaluatedSentenceSnapshot[],
    tokens: ProcessedTokenSnapshots
): DictionaryStatisticsSentenceBucketEntry[] {
    return sentenceSnapshots.map((sentenceSnapshot) =>
        sentenceBucketEntry(sentenceSnapshot, sentenceSnapshot.consideredTokenKeys, tokens)
    );
}

function buildSentenceBucketData(
    sentenceSnapshots: EvaluatedSentenceSnapshot[],
    tokens: ProcessedTokenSnapshots
): DictionaryStatisticsSentenceBuckets {
    const sentenceBuckets = emptySentenceBuckets();

    for (const sentenceSnapshot of sentenceSnapshots) {
        if (
            sentenceSnapshot.numConsideredTokens &&
            sentenceSnapshot.numKnownTokens === sentenceSnapshot.numConsideredTokens
        ) {
            sentenceBuckets.allKnown.count += 1;
            sentenceBuckets.allKnown.entries.push(
                sentenceBucketEntry(sentenceSnapshot, sentenceSnapshot.consideredTokenKeys, tokens)
            );
        }

        const uncollectedBucket = uncollectedSentenceBucketForCount(
            sentenceBuckets.uncollected,
            sentenceSnapshot.numUncollectedTokens
        );
        if (uncollectedBucket) {
            uncollectedBucket.count += 1;
            uncollectedBucket.entries.push(
                sentenceBucketEntry(sentenceSnapshot, sentenceSnapshot.uncollectedTokenKeys, tokens)
            );

            continue;
        }

        const unknownBucket = unknownSentenceBucketForCount(sentenceBuckets.unknown, sentenceSnapshot.numUnknownTokens);
        if (!unknownBucket) continue;

        unknownBucket.count += 1;
        unknownBucket.entries.push(sentenceBucketEntry(sentenceSnapshot, sentenceSnapshot.unknownTokenKeys, tokens));
    }

    return sentenceBuckets;
}

function statusCountsAndFrequenciesForSnapshots(tokens: Iterable<ProcessedTokenSnapshot>) {
    const statusCounts = emptyStatusCounts();
    const frequencyCounts = new Array(dictionaryStatisticsFrequencyBuckets.length).fill(0);
    const frequencyStatusCounts = Array.from({ length: dictionaryStatisticsFrequencyBuckets.length }, () =>
        emptyFrequencyBucketStatusCounts()
    );
    const frequencyOccurrenceCounts = new Array(dictionaryStatisticsFrequencyBuckets.length).fill(0);
    let overflowFrequencyCount = 0;
    const overflowFrequencyStatusCounts = emptyFrequencyBucketStatusCounts();
    let overflowFrequencyOccurrences = 0;
    let unknownFrequencyCount = 0;
    const unknownFrequencyStatusCounts = emptyFrequencyBucketStatusCounts();
    let unknownFrequencyOccurrences = 0;
    let numIgnoredTokens = 0;
    let numIgnoredOccurrences = 0;
    let numKnownTokens = 0;

    for (const token of tokens) {
        if (token.ignored) {
            numIgnoredTokens += 1;
            numIgnoredOccurrences += token.numOccurrences;
            continue;
        }

        const count = statusCounts.get(token.status)!;
        count.numUnique += 1;
        count.numOccurrences += token.numOccurrences;
        if (isTokenStatusKnown(token.status)) numKnownTokens += 1;

        if (token.frequency == null) {
            unknownFrequencyCount += 1;
            const unknownFrequencyStatusCount = unknownFrequencyStatusCounts.get(token.status)!;
            unknownFrequencyStatusCount.numUnique += 1;
            unknownFrequencyStatusCount.numOccurrences += token.numOccurrences;
            unknownFrequencyOccurrences += token.numOccurrences;
            continue;
        }

        let isOverflow = true;
        for (let i = 0; i < dictionaryStatisticsFrequencyBuckets.length; ++i) {
            if (token.frequency > dictionaryStatisticsFrequencyBuckets[i]) continue;
            frequencyCounts[i] += 1;
            const frequencyStatusCount = frequencyStatusCounts[i].get(token.status)!;
            frequencyStatusCount.numUnique += 1;
            frequencyStatusCount.numOccurrences += token.numOccurrences;
            frequencyOccurrenceCounts[i] += token.numOccurrences;
            isOverflow = false;
            break;
        }

        if (isOverflow) {
            overflowFrequencyCount += 1;
            const overflowFrequencyStatusCount = overflowFrequencyStatusCounts.get(token.status)!;
            overflowFrequencyStatusCount.numUnique += 1;
            overflowFrequencyStatusCount.numOccurrences += token.numOccurrences;
            overflowFrequencyOccurrences += token.numOccurrences;
        }
    }

    const consideredTokens = Array.from(statusCounts.values()).reduce((sum, count) => sum + count.numUnique, 0);

    const frequencyBuckets: DictionaryStatisticsFrequencyBucket[] = dictionaryStatisticsFrequencyBuckets.map(
        (curr, index) => {
            const prev = dictionaryStatisticsFrequencyBuckets[index - 1];
            return {
                label: prev === undefined ? `1-${curr}` : `${prev + 1}-${curr}`,
                count: frequencyCounts[index],
                statusCounts: frequencyStatusCounts[index],
                numOccurrences: frequencyOccurrenceCounts[index],
                percent: percent(frequencyCounts[index], consideredTokens),
            };
        }
    );
    frequencyBuckets.push({
        label: `${dictionaryStatisticsFrequencyBuckets[dictionaryStatisticsFrequencyBuckets.length - 1]}+`,
        count: overflowFrequencyCount,
        statusCounts: overflowFrequencyStatusCounts,
        numOccurrences: overflowFrequencyOccurrences,
        percent: percent(overflowFrequencyCount, consideredTokens),
    });
    frequencyBuckets.push({
        label: 'Unknown',
        count: unknownFrequencyCount,
        statusCounts: unknownFrequencyStatusCounts,
        numOccurrences: unknownFrequencyOccurrences,
        percent: percent(unknownFrequencyCount, consideredTokens),
    });

    return {
        statusCounts,
        frequencyBuckets,
        consideredTokens,
        numIgnoredTokens,
        numIgnoredOccurrences,
        numKnownTokens,
    };
}

function statusCountsAndFrequencies(tokens: ProcessedTokenSnapshots) {
    return statusCountsAndFrequenciesForSnapshots(tokens.values());
}

function dictionaryCountsFromRaw(
    dictionary: DictionaryStatisticsRawTrackSnapshot['stats']['dictionary'],
    dictionaryAnkiTreatSuspended: TokenStatus | 'NORMAL'
): DictionaryStatisticsDictionaryCounts {
    let numKnownTokens = 0;
    let numIgnoredTokens = 0;
    for (const token of Object.values(dictionary.tokens)) {
        if (token.states.includes(TokenState.IGNORED)) {
            numIgnoredTokens += 1;
            continue;
        }
        const status = getTokenStatus(token.statuses, dictionaryAnkiTreatSuspended);
        if (isTokenStatusKnown(status)) numKnownTokens += 1;
    }
    return { numKnownTokens, numIgnoredTokens };
}

function tokenStatusesForProjection(
    tokenKey: string,
    tokenSnapshot: ProcessedTokenSnapshot,
    dictionaryTokens: DictionaryStatisticsDictionaryTokens
) {
    const token = dictionaryTokenForGroupingKey(tokenKey, dictionaryTokens);
    return tokenSnapshot.externalCandidateStatuses ?? token?.externalCandidateStatuses ?? token?.statuses ?? [];
}

function sortAnkiCardIdsByDue(cardIds: number[], cardsInfo: DictionaryStatisticsSnapshot['anki']['cardsInfo']) {
    return [...cardIds].sort((left, right) => {
        const leftDue = cardsInfo[left]?.due ?? Number.POSITIVE_INFINITY;
        const rightDue = cardsInfo[right]?.due ?? Number.POSITIVE_INFINITY;
        return leftDue - rightDue || left - right;
    });
}

function sortedUnknownAnkiCardIds(
    cardsStatus: DictionaryStatisticsSnapshot['anki']['cardsStatus'],
    cardsInfo: DictionaryStatisticsSnapshot['anki']['cardsInfo']
) {
    if (cardsStatus === undefined) return [];
    const unknownCards = Object.entries(cardsStatus).flatMap(([cardId, status]) =>
        status === TokenStatus.UNKNOWN ? [Number(cardId)] : []
    );
    return sortAnkiCardIdsByDue(unknownCards, cardsInfo);
}

interface UnknownAnkiCardsByDeck extends DictionaryStatisticsAnkiUnknownCardsByDeck {
    cardIds: number[];
}

function groupUnknownAnkiCardIdsByDeck(
    cardIds: number[],
    cardsInfo: DictionaryStatisticsSnapshot['anki']['cardsInfo']
): UnknownAnkiCardsByDeck[] {
    const cardsByDeck = new Map<string, number[]>();
    for (const cardId of cardIds) {
        const deckName = cardsInfo[cardId]?.deckName;
        if (!deckName) continue;

        const deckCardIds = cardsByDeck.get(deckName);
        if (deckCardIds) deckCardIds.push(cardId);
        else cardsByDeck.set(deckName, [cardId]);
    }

    return Array.from(cardsByDeck.entries())
        .map(([deckName, cardIds]) => ({ deckName, cardIds, totalUnknownCards: cardIds.length }))
        .sort((left, right) => left.deckName.localeCompare(right.deckName));
}

function clampedProjectedAnkiUnknownCards(value: number | undefined, total: number) {
    const requestedCards = value ?? 0;
    return Number.isFinite(requestedCards) ? Math.max(0, Math.min(total, Math.floor(requestedCards))) : 0;
}

function projectedUnknownAnkiCardIds(
    unknownAnkiCardsByDeck: UnknownAnkiCardsByDeck[],
    projection: DictionaryStatisticsRewatchProjection
) {
    return new Set(
        unknownAnkiCardsByDeck.flatMap(({ deckName, cardIds, totalUnknownCards }) => {
            const count = clampedProjectedAnkiUnknownCards(
                projection.ankiUnknownCardsByDeck?.[deckName],
                totalUnknownCards
            );
            return cardIds.slice(0, count);
        })
    );
}

interface ProjectionOptions {
    dictionaryTokens: DictionaryStatisticsDictionaryTokens;
    cardsInfo: DictionaryStatisticsSnapshot['anki']['cardsInfo'];
    dictionaryAnkiTreatSuspended: TokenStatus | 'NORMAL';
    ankiCardIds: Set<number>;
    ankiLearningOrAboveIsMature: boolean;
    waniKaniLevel?: number;
}

interface ProjectionData {
    projectedStatuses: Map<string, TokenStatus>;
    ankiDeckStats: DictionaryStatisticsAnkiDeckProjectionStats[];
    waniKaniStats?: DictionaryStatisticsWaniKaniProjectionStats;
}

function projectedByAnki(status: TokenStatusInfo, options: ProjectionOptions) {
    if (!hasCardId(status)) return false;
    return (
        options.ankiCardIds.has(status.cardId) ||
        (options.ankiLearningOrAboveIsMature && status.status >= TokenStatus.LEARNING)
    );
}

function projectedByWaniKani(status: TokenStatusInfo, waniKaniLevel: number | undefined) {
    return hasWaniKani(status) && waniKaniLevel !== undefined && status.waniKani.subjectLevel <= waniKaniLevel;
}

function projectionData(tokenEntries: [string, ProcessedTokenSnapshot][], options: ProjectionOptions): ProjectionData {
    const projectedStatuses = new Map<string, TokenStatus>();
    const deckCounts = new Map<string, { knownWords: number; totalWords: number }>();
    let waniKaniKnownWords = 0;
    let waniKaniTotalWords = 0;

    for (const [tokenKey, tokenSnapshot] of tokenEntries) {
        if (tokenSnapshot.ignored) continue;

        const statuses = tokenStatusesForProjection(tokenKey, tokenSnapshot, options.dictionaryTokens);
        if (
            statuses.some(
                (status) => projectedByAnki(status, options) || projectedByWaniKani(status, options.waniKaniLevel)
            )
        ) {
            projectedStatuses.set(tokenKey, Math.max(tokenSnapshot.status, fullyKnownTokenStatus) as TokenStatus);
        }

        const statusesByDeck = new Map<string, (TokenStatusInfo & { cardId: number })[]>();
        for (const status of statuses.filter(hasCardId)) {
            const deckName = options.cardsInfo[status.cardId]?.deckName;
            if (!deckName) continue;

            const deckStatuses = statusesByDeck.get(deckName) ?? [];
            deckStatuses.push(status);
            statusesByDeck.set(deckName, deckStatuses);
        }

        for (const [deckName, statuses] of statusesByDeck.entries()) {
            const status = statuses.some((status) => projectedByAnki(status, options))
                ? fullyKnownTokenStatus
                : getTokenStatus(statuses, options.dictionaryAnkiTreatSuspended);

            const counts = deckCounts.get(deckName) ?? { knownWords: 0, totalWords: 0 };
            counts.totalWords += 1;
            if (isTokenStatusKnown(status)) counts.knownWords += 1;
            deckCounts.set(deckName, counts);
        }

        const waniKaniStatuses = statuses.filter(hasWaniKani);
        if (!waniKaniStatuses.length) continue;

        const waniKaniStatus = waniKaniStatuses.some((status) => projectedByWaniKani(status, options.waniKaniLevel))
            ? fullyKnownTokenStatus
            : getTokenStatus(waniKaniStatuses, 'NORMAL');

        waniKaniTotalWords += 1;
        if (isTokenStatusKnown(waniKaniStatus)) waniKaniKnownWords += 1;
    }

    return {
        projectedStatuses,
        ankiDeckStats: Array.from(deckCounts.entries())
            .map(([deckName, counts]) => ({ deckName, ...counts }))
            .sort((left, right) => left.deckName.localeCompare(right.deckName)),
        waniKaniStats:
            waniKaniTotalWords > 0
                ? { level: options.waniKaniLevel, knownWords: waniKaniKnownWords, totalWords: waniKaniTotalWords }
                : undefined,
    };
}

function promoteTokenStatus(status: TokenStatus): TokenStatus {
    return Math.min(status + 1, fullyKnownTokenStatus) as TokenStatus;
}

function promoteProjectedStatuses(
    tokenEntries: [string, ProcessedTokenSnapshot][],
    projectedStatuses: Map<string, TokenStatus>
) {
    for (const [tokenKey, token] of tokenEntries) {
        if (token.ignored) continue;
        const currentStatus = projectedStatuses.get(tokenKey) ?? token.status;
        if (currentStatus <= TokenStatus.UNCOLLECTED || currentStatus >= fullyKnownTokenStatus) continue;
        projectedStatuses.set(tokenKey, promoteTokenStatus(currentStatus));
    }
}

function projectedRewatchSnapshot(
    rewatch: number,
    dictionaryKnownTokens: number,
    aggregateTokens: ProcessedTokenSnapshots,
    aggregateSentenceSnapshots: ProcessedSentenceSnapshot[],
    sentenceFilterTokens: ProcessedTokenSnapshots,
    sentenceFilterSnapshots: ProcessedSentenceSnapshot[],
    currentKnownTokens: number,
    consideredTokens: number,
    aggregateProjectedStatuses: Map<string, TokenStatus>,
    sentenceFilterProjectedStatuses: Map<string, TokenStatus>,
    projectionData: ProjectionData
): DictionaryStatisticsRewatchSnapshot {
    const tokenEntries = Array.from(aggregateTokens.entries());
    const evaluatedProjectedSentences = aggregateSentenceSnapshots.map((sentenceSnapshot) =>
        evaluateSentenceSnapshot(sentenceSnapshot, aggregateProjectedStatuses)
    );
    const evaluatedSentenceFilters = sentenceFilterSnapshots.map((sentenceSnapshot) =>
        evaluateSentenceSnapshot(sentenceSnapshot, sentenceFilterProjectedStatuses)
    );
    const projectedSentenceTotals = sentenceTotals(evaluatedProjectedSentences);
    const projectedSentenceBuckets = buildSentenceBucketData(evaluatedSentenceFilters, sentenceFilterTokens);
    const { averageWordsPerSentence, averageKnownWordsPerSentence } =
        sentenceAveragesFromTotals(projectedSentenceTotals);
    const projectedStatusCounts = emptyStatusCounts();
    let projectedKnownTokens = 0;

    for (const [tokenKey, token] of tokenEntries) {
        if (token.ignored) continue;
        const projectedStatus = Math.max(
            aggregateProjectedStatuses.get(tokenKey) ?? token.status,
            token.status
        ) as TokenStatus;
        const count = projectedStatusCounts.get(projectedStatus)!;
        count.numUnique += 1;
        count.numOccurrences += token.numOccurrences;
        if (isTokenStatusKnown(projectedStatus)) projectedKnownTokens += 1;
    }

    const comprehensionPercent = comprehensionFromStatusOccurrences(projectedStatusCounts);

    return {
        rewatch,
        numKnownTokens: projectedKnownTokens,
        numDictionaryKnownTokens: dictionaryKnownTokens + (projectedKnownTokens - currentKnownTokens),
        knownPercent: percent(projectedKnownTokens, consideredTokens),
        comprehensionPercent,
        averageWordsPerSentence,
        averageKnownWordsPerSentence,
        sentenceTotals: projectedSentenceTotals,
        statusCounts: projectedStatusCounts,
        sentenceBuckets: projectedSentenceBuckets,
        ankiDeckStats: projectionData.ankiDeckStats,
        waniKaniStats: projectionData.waniKaniStats,
    };
}

function rewatchSnapshotsFromRaw(
    dictionaryKnownTokens: number,
    aggregateTokens: ProcessedTokenSnapshots,
    aggregateSentenceSnapshots: ProcessedSentenceSnapshot[],
    sentenceFilterTokens: ProcessedTokenSnapshots,
    sentenceFilterSnapshots: ProcessedSentenceSnapshot[],
    currentKnownTokens: number,
    consideredTokens: number,
    aggregateProjectionData: ProjectionData,
    sentenceFilterProjectionData: ProjectionData
): DictionaryStatisticsRewatchSnapshot[] {
    const tokenEntries = Array.from(sentenceFilterTokens.entries());
    const sentenceFilterProjectedStatuses = sentenceFilterProjectionData.projectedStatuses;
    const aggregateProjectedStatuses = () =>
        mergeProjectedStatuses(
            aggregateProjectionData.projectedStatuses,
            surfaceProjectedStatusesForGrouping(sentenceFilterSnapshots, sentenceFilterProjectedStatuses, 'lemma')
        );
    const rewatchSnapshots: DictionaryStatisticsRewatchSnapshot[] = [
        projectedRewatchSnapshot(
            0,
            dictionaryKnownTokens,
            aggregateTokens,
            aggregateSentenceSnapshots,
            sentenceFilterTokens,
            sentenceFilterSnapshots,
            currentKnownTokens,
            consideredTokens,
            aggregateProjectedStatuses(),
            sentenceFilterProjectedStatuses,
            aggregateProjectionData
        ),
    ];

    while (true) {
        promoteProjectedStatuses(tokenEntries, sentenceFilterProjectedStatuses);

        const tokensToPromote = new Set<string>();
        for (const sentenceSnapshot of sentenceFilterSnapshots) {
            const evaluated = evaluateSentenceSnapshot(sentenceSnapshot, sentenceFilterProjectedStatuses);
            const isIPlusOneUncollected =
                evaluated.numConsideredTokens > 0 && evaluated.numKnownTokens === evaluated.numConsideredTokens - 1;
            if (!isIPlusOneUncollected) continue;
            if (evaluated.uncollectedTokenKeys.length === 1 && evaluated.numUnknownTokens === 0) {
                tokensToPromote.add(evaluated.uncollectedTokenKeys[0]);
            }
        }
        if (!tokensToPromote.size) break;

        for (const tokenKey of Array.from(tokensToPromote).sort()) {
            const currentStatus =
                sentenceFilterProjectedStatuses.get(tokenKey) ?? sentenceFilterTokens.get(tokenKey)?.status;
            if (currentStatus !== undefined && currentStatus < fullyKnownTokenStatus) {
                sentenceFilterProjectedStatuses.set(
                    tokenKey,
                    Math.max(promoteTokenStatus(currentStatus), TokenStatus.LEARNING) as TokenStatus
                );
            }
        }

        rewatchSnapshots.push(
            projectedRewatchSnapshot(
                rewatchSnapshots.length,
                dictionaryKnownTokens,
                aggregateTokens,
                aggregateSentenceSnapshots,
                sentenceFilterTokens,
                sentenceFilterSnapshots,
                currentKnownTokens,
                consideredTokens,
                aggregateProjectedStatuses(),
                sentenceFilterProjectedStatuses,
                aggregateProjectionData
            )
        );
    }

    return rewatchSnapshots;
}

function processDictionaryStatisticsTrackSnapshot(
    snapshot: DictionaryStatisticsSnapshot,
    trackSnapshot: DictionaryStatisticsRawTrackSnapshot,
    projection: DictionaryStatisticsRewatchProjection = {}
): DictionaryStatisticsTrackSnapshot {
    const { dictionary, sentences } = trackSnapshot.stats;
    const aggregateSentenceSnapshots = processSentenceSnapshots(sentences, 'lemma');
    const sentenceFilterSnapshots = processSentenceSnapshots(sentences, 'surface');
    const dictionaryAnkiTreatSuspended =
        snapshot.settings.dictionaryTracks[trackSnapshot.track]?.dictionaryAnkiTreatSuspended ?? 'NORMAL';
    const dictionaryCounts = dictionaryCountsFromRaw(dictionary, dictionaryAnkiTreatSuspended);

    const aggregateTokens = mergeSentenceTokenSnapshots(aggregateSentenceSnapshots);
    const sentenceFilterTokens = mergeSentenceTokenSnapshots(sentenceFilterSnapshots);
    const aggregateTokenEntries = Array.from(aggregateTokens.entries());
    const sentenceFilterTokenEntries = Array.from(sentenceFilterTokens.entries());
    const cardsInfo = snapshot.anki.cardsInfo ?? {};
    const unknownAnkiCardIds = sortedUnknownAnkiCardIds(snapshot.anki.cardsStatus, cardsInfo);
    const unknownAnkiCardsByDeck = groupUnknownAnkiCardIdsByDeck(unknownAnkiCardIds, cardsInfo);
    const projectedAnkiCardIds = projectedUnknownAnkiCardIds(unknownAnkiCardsByDeck, projection);
    const waniKaniLevel =
        projection.waniKaniLevel !== undefined &&
        Number.isFinite(projection.waniKaniLevel) &&
        projection.waniKaniLevel > 0
            ? Math.floor(projection.waniKaniLevel)
            : undefined;
    const projectionOptions = {
        dictionaryTokens: dictionary.tokens,
        cardsInfo,
        dictionaryAnkiTreatSuspended,
    };
    const currentKnowledgeData = projectionData(aggregateTokenEntries, {
        ...projectionOptions,
        ankiCardIds: new Set<number>(),
        ankiLearningOrAboveIsMature: false,
    });
    const aggregateProjectedData = projectionData(aggregateTokenEntries, {
        ...projectionOptions,
        ankiCardIds: projectedAnkiCardIds,
        ankiLearningOrAboveIsMature: projection.ankiLearningOrAboveIsMature ?? false,
        waniKaniLevel,
    });
    const sentenceFilterProjectedData = projectionData(sentenceFilterTokenEntries, {
        ...projectionOptions,
        ankiCardIds: projectedAnkiCardIds,
        ankiLearningOrAboveIsMature: projection.ankiLearningOrAboveIsMature ?? false,
        waniKaniLevel,
    });
    const sentenceTokenCounts = statusCountsAndFrequencies(aggregateTokens);

    const {
        statusCounts,
        frequencyBuckets,
        consideredTokens,
        numIgnoredTokens,
        numIgnoredOccurrences,
        numKnownTokens,
    } = sentenceTokenCounts;
    const evaluatedSentenceSnapshots = aggregateSentenceSnapshots.map((sentenceSnapshot) =>
        evaluateSentenceSnapshot(sentenceSnapshot)
    );
    const evaluatedSentenceFilters = sentenceFilterSnapshots.map((sentenceSnapshot) =>
        evaluateSentenceSnapshot(sentenceSnapshot)
    );
    const currentSentenceTotals = sentenceTotals(evaluatedSentenceSnapshots);
    const { averageWordsPerSentence, averageKnownWordsPerSentence } = sentenceAveragesFromTotals(currentSentenceTotals);
    const currentSentenceBuckets = buildSentenceBucketData(evaluatedSentenceFilters, sentenceFilterTokens);
    const sentenceComprehensionPoints = sentenceComprehensionPointsFromSentenceTotals(currentSentenceTotals);
    const trackAllSentenceEntries = allSentenceEntries(evaluatedSentenceSnapshots, aggregateTokens);
    const comprehensionPercent = comprehensionFromStatusOccurrences(statusCounts);
    const rewatchSnapshots = rewatchSnapshotsFromRaw(
        dictionaryCounts.numKnownTokens,
        aggregateTokens,
        aggregateSentenceSnapshots,
        sentenceFilterTokens,
        sentenceFilterSnapshots,
        sentenceTokenCounts.numKnownTokens,
        sentenceTokenCounts.consideredTokens,
        aggregateProjectedData,
        sentenceFilterProjectedData
    );

    return {
        track: trackSnapshot.track,
        progress: trackSnapshot.progress,
        progressPercent: percent(trackSnapshot.progress.current, trackSnapshot.progress.total),
        statusColors: trackSnapshot.statusColors,
        numDictionaryKnownTokens: dictionaryCounts.numKnownTokens,
        numDictionaryIgnoredTokens: dictionaryCounts.numIgnoredTokens,
        numUniqueTokens: aggregateTokens.size,
        consideredTokens,
        numIgnoredTokens,
        numIgnoredOccurrences,
        numKnownTokens,
        knownPercent: percent(numKnownTokens, consideredTokens),
        comprehensionPercent,
        averageWordsPerSentence,
        averageKnownWordsPerSentence,
        sentenceTotals: currentSentenceTotals,
        sentenceComprehensionPoints,
        allSentenceEntries: trackAllSentenceEntries,
        statusCounts,
        frequencyBuckets,
        sentenceBuckets: currentSentenceBuckets,
        ankiDeckStats: currentKnowledgeData.ankiDeckStats,
        waniKaniStats: currentKnowledgeData.waniKaniStats,
        rewatchSnapshots,
        totalUnknownAnkiCards: unknownAnkiCardIds.length,
        unknownAnkiCardsByDeck: unknownAnkiCardsByDeck.map(({ deckName, totalUnknownCards }) => ({
            deckName,
            totalUnknownCards,
        })),
    };
}

function compareSentenceFrequency(
    left: DictionaryStatisticsSentenceBucketEntry,
    right: DictionaryStatisticsSentenceBucketEntry
) {
    const leftFrequency = left.lowestFrequency ?? Number.POSITIVE_INFINITY;
    const rightFrequency = right.lowestFrequency ?? Number.POSITIVE_INFINITY;
    return leftFrequency - rightFrequency;
}

function compareSentenceOccurrences(
    left: DictionaryStatisticsSentenceBucketEntry,
    right: DictionaryStatisticsSentenceBucketEntry
) {
    return left.highestOccurrences - right.highestOccurrences;
}

function compareSentenceComprehension(
    left: DictionaryStatisticsSentenceBucketEntry,
    right: DictionaryStatisticsSentenceBucketEntry
) {
    return left.comprehensionPercent - right.comprehensionPercent;
}

function compareSentenceIndex(
    left: DictionaryStatisticsSentenceBucketEntry,
    right: DictionaryStatisticsSentenceBucketEntry
) {
    return left.sentence.index - right.sentence.index;
}

function compareWithDirection(comparison: number, direction: DictionaryStatisticsSentenceSortDirection) {
    return direction === 'desc' ? -comparison : comparison;
}

function frequencyDirection(preferMostFrequent: boolean): DictionaryStatisticsSentenceSortDirection {
    return preferMostFrequent ? 'asc' : 'desc';
}

function countDirection(preferHighest: boolean): DictionaryStatisticsSentenceSortDirection {
    return preferHighest ? 'desc' : 'asc';
}

export function defaultDictionaryStatisticsSentenceSortDirection(sort: DictionaryStatisticsSentenceSort) {
    return sort === 'occurrences' || sort === 'comprehension' ? 'desc' : 'asc';
}

export function defaultDictionaryStatisticsSentenceSortState(
    sort: DictionaryStatisticsSentenceSort = 'index'
): DictionaryStatisticsSentenceSortState {
    return {
        sort,
        direction: defaultDictionaryStatisticsSentenceSortDirection(sort),
    };
}

export function nextDictionaryStatisticsSentenceSortCategory(
    current: DictionaryStatisticsSentenceSortState
): DictionaryStatisticsSentenceSortState {
    const index = sortCategories.findIndex((s) => s === current.sort);
    const nextSort = sortCategories[(index + 1) % sortCategories.length];
    return { sort: nextSort, direction: current.direction };
}

export function nextDictionaryStatisticsSentenceSortDirection(
    current: DictionaryStatisticsSentenceSortState
): DictionaryStatisticsSentenceSortState {
    const index = sortDirections.findIndex((d) => d === current.direction);
    const nextDirection = sortDirections[(index + 1) % sortDirections.length];
    return { sort: current.sort, direction: nextDirection };
}

export function statusSentenceBucketLabel(
    bucket: DictionaryStatisticsSentenceUncollectedBucket,
    uncollectedLabel: string
) {
    if (bucket.tokenCount > 1) return `${bucket.tokenCount}+ ${uncollectedLabel}`;
    return `${bucket.tokenCount} ${uncollectedLabel}`;
}

export function sentenceDialogBucketData(
    bucket: DictionaryStatisticsSentenceDialogBucket,
    sentenceBuckets: DictionaryStatisticsSentenceBuckets,
    labels: {
        knownSentencesLabel: string;
        uncollectedLabel: string;
        unknownLabel: string;
    }
) {
    if (bucket.kind === 'allKnown') {
        return {
            label: labels.knownSentencesLabel,
            entries: sentenceBuckets.allKnown.entries,
        };
    }

    if (bucket.kind === 'uncollected') {
        const uncollectedBucket = sentenceBuckets.uncollected[bucket.groupIndex];
        if (!uncollectedBucket) return;
        return {
            label: statusSentenceBucketLabel(uncollectedBucket, labels.uncollectedLabel),
            entries: uncollectedBucket.entries,
        };
    }

    const unknownBucket = sentenceBuckets.unknown[bucket.groupIndex];
    if (!unknownBucket) return;
    return {
        label: statusSentenceBucketLabel(unknownBucket, labels.unknownLabel),
        entries: unknownBucket.entries,
    };
}

export function selectedRewatchSnapshotForTrack(
    trackSnapshot: DictionaryStatisticsTrackSnapshot,
    selectedRewatchesByTrack: Record<number, number>
) {
    if (!trackSnapshot.rewatchSnapshots.length) return;
    const maxRewatch = trackSnapshot.rewatchSnapshots[trackSnapshot.rewatchSnapshots.length - 1].rewatch;
    const selectedRewatch = Math.min(selectedRewatchesByTrack[trackSnapshot.track] ?? 0, maxRewatch);
    return (
        trackSnapshot.rewatchSnapshots.find((rewatchSnapshot) => rewatchSnapshot.rewatch === selectedRewatch) ??
        trackSnapshot.rewatchSnapshots[0]
    );
}

export function sortDictionaryStatisticsSentenceBucketEntries(
    entries: DictionaryStatisticsSentenceBucketEntry[],
    sortState: DictionaryStatisticsSentenceSortState
) {
    const next = entries.slice();
    next.sort((left, right) => {
        if (sortState.sort === 'comprehension') {
            const comprehensionComparison = compareWithDirection(
                compareSentenceComprehension(left, right),
                sortState.direction
            );
            if (comprehensionComparison !== 0) return comprehensionComparison;

            const preferHighest = sortState.direction === 'desc';
            const frequencyComparison = compareWithDirection(
                compareSentenceFrequency(left, right),
                frequencyDirection(preferHighest)
            );
            if (frequencyComparison !== 0) return frequencyComparison;

            const occurrenceComparison = compareWithDirection(
                compareSentenceOccurrences(left, right),
                countDirection(preferHighest)
            );
            if (occurrenceComparison !== 0) return occurrenceComparison;

            return compareSentenceIndex(left, right);
        }

        if (sortState.sort === 'frequency') {
            const frequencyComparison = compareWithDirection(
                compareSentenceFrequency(left, right),
                sortState.direction
            );
            if (frequencyComparison !== 0) return frequencyComparison;

            const preferHighest = sortState.direction === 'asc';
            const comprehensionComparison = compareWithDirection(
                compareSentenceComprehension(left, right),
                countDirection(preferHighest)
            );
            if (comprehensionComparison !== 0) return comprehensionComparison;

            const occurrenceComparison = compareWithDirection(
                compareSentenceOccurrences(left, right),
                countDirection(preferHighest)
            );
            if (occurrenceComparison !== 0) return occurrenceComparison;

            return compareSentenceIndex(left, right);
        }

        if (sortState.sort === 'occurrences') {
            const occurrenceComparison = compareWithDirection(
                compareSentenceOccurrences(left, right),
                sortState.direction
            );
            if (occurrenceComparison !== 0) return occurrenceComparison;

            const preferHighest = sortState.direction === 'desc';
            const comprehensionComparison = compareWithDirection(
                compareSentenceComprehension(left, right),
                countDirection(preferHighest)
            );
            if (comprehensionComparison !== 0) return comprehensionComparison;

            const frequencyComparison = compareWithDirection(
                compareSentenceFrequency(left, right),
                frequencyDirection(preferHighest)
            );
            if (frequencyComparison !== 0) return frequencyComparison;

            return compareSentenceIndex(left, right);
        }

        const indexComparison = compareWithDirection(compareSentenceIndex(left, right), sortState.direction);
        if (indexComparison !== 0) return indexComparison;

        const frequencyComparison = compareWithDirection(compareSentenceFrequency(left, right), 'asc');
        if (frequencyComparison !== 0) return frequencyComparison;

        const occurrenceComparison = compareWithDirection(compareSentenceOccurrences(left, right), 'desc');
        if (occurrenceComparison !== 0) return occurrenceComparison;

        const comprehensionComparison = compareWithDirection(compareSentenceComprehension(left, right), 'desc');
        if (comprehensionComparison !== 0) return comprehensionComparison;

        return compareSentenceIndex(left, right);
    });
    return next;
}

export function processDictionaryStatisticsSnapshot(
    snapshot?: DictionaryStatisticsSnapshot,
    projectionsByTrack: DictionaryStatisticsRewatchProjectionsByTrack = {}
): DictionaryStatisticsTrackSnapshot[] {
    return (
        snapshot?.snapshots.map((trackSnapshot) =>
            processDictionaryStatisticsTrackSnapshot(snapshot, trackSnapshot, projectionsByTrack[trackSnapshot.track])
        ) ?? []
    );
}

export function processDictionaryStatisticsAnkiTrackSnapshot(
    snapshot: DictionaryStatisticsSnapshot | undefined,
    track: number
): DictionaryStatisticsAnkiTrackSnapshot {
    const dueCounts = emptyAnkiDueCounts();
    const progressPercent = snapshot?.anki.progress
        ? percent(snapshot.anki.progress.current, snapshot.anki.progress.total)
        : 0;
    const rawTrackSnapshot = snapshot?.snapshots.find((candidate) => candidate.track === track);
    if (!snapshot || !rawTrackSnapshot) {
        return {
            available: snapshot?.anki.available,
            progress: snapshot?.anki.progress,
            progressPercent,
            dueCounts,
            deckSnapshots: [],
        };
    }

    const dueByToday = new Set(snapshot.anki.dueCards?.[0] ?? []);
    const dueByTomorrow = new Set(snapshot.anki.dueCards?.[1] ?? []);
    const dueByWeek = new Set(snapshot.anki.dueCards?.[7] ?? []);
    const cardsInfo = snapshot.anki.cardsInfo ?? {};
    const dictionaryAnkiTreatSuspended =
        snapshot.settings.dictionaryTracks[track]?.dictionaryAnkiTreatSuspended ?? 'NORMAL';
    const sentenceSnapshots = processSentenceSnapshots(rawTrackSnapshot.stats.sentences, 'lemma');
    const tokens = mergeSentenceTokenSnapshots(sentenceSnapshots);
    const deckDueCounts = new Map<string, DictionaryStatisticsAnkiDueCounts>();
    const deckSuspendedCardIds = new Map<string, Set<number>>();
    const deckModelTokenSnapshots = new Map<string, Map<string, ProcessedTokenSnapshot[]>>();

    for (const [tokenKey, tokenSnapshot] of tokens.entries()) {
        if (tokenSnapshot.ignored) continue;

        const token = dictionaryTokenForGroupingKey(tokenKey, rawTrackSnapshot.stats.dictionary.tokens);
        if (token?.states.includes(TokenState.IGNORED)) continue;

        const tokenStatuses = (tokenSnapshot.externalCandidateStatuses ?? token?.statuses ?? []).filter(hasCardId);
        if (!tokenStatuses.length) continue;

        incrementAnkiDueCounts(dueCounts, tokenStatuses, dueByToday, dueByTomorrow, dueByWeek);

        const deckStatuses = new Map<string, (TokenStatusInfo & { cardId: number })[]>();
        for (const status of tokenStatuses) {
            const cardInfo = cardsInfo[status.cardId];
            const deckName = cardInfo?.deckName;
            if (!deckName) continue;
            const statusesForDeck = deckStatuses.get(deckName) ?? [];
            statusesForDeck.push(status);
            deckStatuses.set(deckName, statusesForDeck);

            if (status.suspended) {
                const suspendedCardIds = deckSuspendedCardIds.get(deckName) ?? new Set<number>();
                suspendedCardIds.add(status.cardId);
                deckSuspendedCardIds.set(deckName, suspendedCardIds);
            }
        }

        for (const [deckName, statuses] of deckStatuses.entries()) {
            const dueCountsForDeck = deckDueCounts.get(deckName) ?? emptyAnkiDueCounts();
            incrementAnkiDueCounts(dueCountsForDeck, statuses, dueByToday, dueByTomorrow, dueByWeek);
            deckDueCounts.set(deckName, dueCountsForDeck);

            const modelStatuses = new Map<string, (TokenStatusInfo & { cardId: number })[]>();
            for (const status of statuses) {
                const modelName = cardsInfo[status.cardId]?.modelName;
                if (!modelName) continue;
                const statusesForModel = modelStatuses.get(modelName) ?? [];
                statusesForModel.push(status);
                modelStatuses.set(modelName, statusesForModel);
            }

            if (!modelStatuses.size) continue;

            const modelSnapshotsForDeck =
                deckModelTokenSnapshots.get(deckName) ?? new Map<string, ProcessedTokenSnapshot[]>();
            for (const [modelName, statusesForModel] of modelStatuses.entries()) {
                const tokenStatus = getTokenStatus(statusesForModel, dictionaryAnkiTreatSuspended);
                const modelTokens = modelSnapshotsForDeck.get(modelName) ?? [];
                modelTokens.push({
                    status: tokenStatus,
                    ignored: false,
                    frequency: tokenSnapshot.frequency,
                    numOccurrences: tokenSnapshot.numOccurrences,
                });
                modelSnapshotsForDeck.set(modelName, modelTokens);
            }
            deckModelTokenSnapshots.set(deckName, modelSnapshotsForDeck);
        }
    }

    return {
        available: snapshot.anki.available,
        progress: snapshot.anki.progress,
        progressPercent,
        dueCounts,
        deckSnapshots: Array.from(deckModelTokenSnapshots.entries())
            .map(([deckName, modelTokenSnapshots]) => {
                return {
                    deckName,
                    dueCounts: deckDueCounts.get(deckName) ?? emptyAnkiDueCounts(),
                    suspendedCards: deckSuspendedCardIds.get(deckName)?.size ?? 0,
                    modelSnapshots: Array.from(modelTokenSnapshots.entries())
                        .map(([modelName, modelTokens]) => {
                            const { consideredTokens, frequencyBuckets } =
                                statusCountsAndFrequenciesForSnapshots(modelTokens);
                            return {
                                modelName,
                                uniqueWords: consideredTokens,
                                frequencyBuckets,
                            };
                        })
                        .filter((modelSnapshot) => modelSnapshot.uniqueWords > 0)
                        .sort((left, right) => left.modelName.localeCompare(right.modelName)),
                };
            })
            .filter((deckSnapshot) => deckSnapshot.modelSnapshots.length > 0)
            .sort((left, right) => left.deckName.localeCompare(right.deckName)),
    };
}

export function processDictionaryStatisticsWaniKaniTrackSnapshot(
    snapshot: DictionaryStatisticsSnapshot | undefined,
    track: number
): DictionaryStatisticsWaniKaniTrackSnapshot {
    const dueCounts = emptyAnkiDueCounts();
    const waniKaniSnapshot = snapshot?.waniKani?.[track];
    const rawTrackSnapshot = snapshot?.snapshots.find((candidate) => candidate.track === track);
    if (!snapshot || !rawTrackSnapshot) {
        return {
            available: waniKaniSnapshot?.available,
            dueCounts,
            uniqueWords: 0,
            frequencyBuckets: [],
        };
    }

    const { dueByToday, dueByTomorrow, dueByWeek } = waniKaniDueAssignmentSets(waniKaniSnapshot);
    const sentenceSnapshots = processSentenceSnapshots(rawTrackSnapshot.stats.sentences, 'lemma');
    const tokens = mergeSentenceTokenSnapshots(sentenceSnapshots);
    const waniKaniTokenSnapshots: ProcessedTokenSnapshot[] = [];

    for (const [tokenKey, tokenSnapshot] of tokens.entries()) {
        if (tokenSnapshot.ignored) continue;

        const token = dictionaryTokenForGroupingKey(tokenKey, rawTrackSnapshot.stats.dictionary.tokens);
        if (token?.states.includes(TokenState.IGNORED)) continue;

        const tokenStatuses = (tokenSnapshot.externalCandidateStatuses ?? token?.statuses ?? []).filter(hasWaniKani);
        if (!tokenStatuses.length) continue;

        incrementWaniKaniDueCounts(
            dueCounts,
            tokenStatuses.filter(hasAssignmentId),
            dueByToday,
            dueByTomorrow,
            dueByWeek
        );
        waniKaniTokenSnapshots.push({
            status: getTokenStatus(tokenStatuses, 'NORMAL'),
            ignored: false,
            frequency: tokenSnapshot.frequency,
            numOccurrences: tokenSnapshot.numOccurrences,
        });
    }

    const { consideredTokens, frequencyBuckets } = statusCountsAndFrequenciesForSnapshots(waniKaniTokenSnapshots);
    return {
        available: waniKaniSnapshot?.available,
        dueCounts,
        uniqueWords: consideredTokens,
        frequencyBuckets,
    };
}

export interface DictionarySimplifiedStatisticsTrackSnapshot {
    comprehensionPercent: number;
    sentenceBuckets: DictionaryStatisticsSentenceBuckets;
    progress: Progress;
}

export function processSimplifiedDictionaryStatistics(
    snapshot?: DictionaryStatisticsSnapshot
): DictionarySimplifiedStatisticsTrackSnapshot[] {
    return (
        snapshot?.snapshots?.map((trackSnapshot) =>
            processSimplifiedDictionaryStatisticsTrackSnapshot(trackSnapshot)
        ) ?? []
    );
}

function processSimplifiedDictionaryStatisticsTrackSnapshot(
    trackSnapshot: DictionaryStatisticsRawTrackSnapshot
): DictionarySimplifiedStatisticsTrackSnapshot {
    const { sentences } = trackSnapshot.stats;
    const aggregateSentenceSnapshots = processSentenceSnapshots(sentences, 'lemma');
    const sentenceFilterSnapshots = processSentenceSnapshots(sentences, 'surface');
    const aggregateTokens = mergeSentenceTokenSnapshots(aggregateSentenceSnapshots);
    const sentenceFilterTokens = mergeSentenceTokenSnapshots(sentenceFilterSnapshots);
    const { statusCounts } = statusCountsAndFrequencies(aggregateTokens);
    const evaluatedSentenceSnapshots = sentenceFilterSnapshots.map((sentenceSnapshot) =>
        evaluateSentenceSnapshot(sentenceSnapshot)
    );
    const sentenceBuckets = buildSentenceBucketData(evaluatedSentenceSnapshots, sentenceFilterTokens);
    const comprehensionPercent = comprehensionFromStatusOccurrences(statusCounts);
    const progress = trackSnapshot.progress;
    return { comprehensionPercent, sentenceBuckets, progress };
}
