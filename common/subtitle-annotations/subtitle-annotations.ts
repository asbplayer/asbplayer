import {
    DictionaryBuildAnkiCacheState,
    DictionaryBuildAnkiCacheStateError,
    DictionaryBuildAnkiCacheStateErrorCode,
    DictionaryBuildAnkiCacheStateType,
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
    getFullyKnownTokenStatus,
    SettingsProvider,
    TokenFrequencyAnnotation,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenReadingAnnotation,
    TokenState,
    TokenStatus,
    TokenStyling,
} from '@project/common/settings';
import { CardStatus, DictionaryProvider, LemmaResults, TokenResults } from '@project/common/dictionary-db';
import {
    DictionaryStatistics,
    DictionaryStatisticsAnkiDueCardsSnapshot,
    DictionaryStatisticsAnkiSnapshot,
} from '@project/common/dictionary-statistics';
import { SubtitleCollection, SubtitleCollectionOptions } from '@project/common/subtitle-collection';
import {
    arrayEquals,
    HAS_LETTER_REGEX,
    inBatches,
    iterateOverStringInBlocks,
    ONLY_ASCII_LETTERS_REGEX,
    areTokenizationsEqual,
} from '@project/common/util';
import { Yomitan } from '@project/common/yomitan/yomitan';

const TOKEN_CACHE_BUILD_AHEAD_INIT = 10;
const TOKEN_CACHE_BUILD_AHEAD = 100;
const TOKEN_CACHE_BUILD_AHEAD_THRESHOLD = 10; // Only build ahead with only this many rich subtitles left
const TOKEN_CACHE_BATCH_SIZE = 1; // Processing more than 1 at a time is slower
const TOKEN_CACHE_DEFAULT_REFRESH_INTERVAL = 10000;
const TOKEN_CACHE_STATISTICS_REFRESH_INTERVAL = 1000;
let tokenCacheRefreshInterval = TOKEN_CACHE_DEFAULT_REFRESH_INTERVAL;
const ANKI_REFRESH_INTERVAL = 10000;
const ANKI_DUES = [0, 1, 7] as const; // 0 = due today, 1 = due within a day, 7 = due within a week

const ASB_TOKEN_CLASS = 'asb-token';
const ASB_TOKEN_HIGHLIGHT_CLASS = 'asb-token-highlight';
const ASB_READING_CLASS = 'asb-reading';
const ASB_FREQUENCY_CLASS = 'asb-frequency';
// const ASB_FREQUENCY_HOVER_CLASS = 'asb-frequency-hover';

interface TokenStatusResult {
    status: TokenStatus;
    source: DictionaryTokenSource;
    token?: string; // For any form filtering
}

interface ResolvedTokenStatusResult {
    status: TokenStatus;
    source?: DictionaryTokenSource;
}

interface TrackState {
    track: number;
    dt: DictionaryTrack;
    yt: Yomitan | undefined;
    collectedExactForm: Map<string, TokenStatusResult>;
    collectedLemmaForm: Map<string, TokenStatusResult>;
    collectedAnyForm: Map<string, TokenStatusResult[]>;
    tokenCardIds: Map<string, Map<number, boolean>>;
    tokenStates: Map<string, TokenState[]>;
}

function shouldUseExactForm(s: TokenMatchStrategy): boolean {
    return s === TokenMatchStrategy.EXACT_FORM_COLLECTED || s === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
}

function shouldUseLemmaForm(s: TokenMatchStrategy): boolean {
    return s === TokenMatchStrategy.LEMMA_FORM_COLLECTED || s === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
}

function shouldUseAnyForm(s: TokenMatchStrategy): boolean {
    return s === TokenMatchStrategy.ANY_FORM_COLLECTED;
}

function shouldUseLemmaGroupingKey(source: DictionaryTokenSource | undefined, dt: DictionaryTrack): boolean {
    const strategy =
        source === DictionaryTokenSource.ANKI_SENTENCE
            ? dt.dictionaryAnkiSentenceTokenMatchStrategy
            : dt.dictionaryTokenMatchStrategy;
    return strategy === TokenMatchStrategy.ANY_FORM_COLLECTED || strategy === TokenMatchStrategy.LEMMA_FORM_COLLECTED;
}

function groupingKeyForToken(
    trimmedToken: string,
    lemmas: string[],
    source: DictionaryTokenSource | undefined,
    dt: DictionaryTrack
): string {
    // if (lemmas.length && shouldUseLemmaGroupingKey(source, dt)) {
    //     return `lemma:${JSON.stringify(Array.from(new Set(lemmas)).sort())}`;
    // }
    return `token:${trimmedToken}`; // Using lemma causes the sentence status to disagree with richText (e.g. "Known sentences" have unknown tokens displayed but they are actually known due to their lemmas).
}

export function getCardTokenStatus(
    statuses: CardStatus[],
    dictionaryAnkiTreatSuspended: TokenStatus | 'NORMAL'
): TokenStatus {
    if (statuses.length && dictionaryAnkiTreatSuspended !== 'NORMAL') {
        const unsuspended = statuses.filter((status) => !status.suspended);
        if (!unsuspended.length) return dictionaryAnkiTreatSuspended;
        statuses = unsuspended;
    }
    if (statuses.some((c) => c.status === TokenStatus.MATURE)) return TokenStatus.MATURE;
    if (statuses.some((c) => c.status === TokenStatus.YOUNG)) return TokenStatus.YOUNG;
    if (statuses.some((c) => c.status === TokenStatus.GRADUATED)) return TokenStatus.GRADUATED;
    if (statuses.some((c) => c.status === TokenStatus.LEARNING)) return TokenStatus.LEARNING;
    return TokenStatus.UNKNOWN;
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

function resetYomitan(ts: TrackState) {
    if (!ts.yt) return;
    ts.yt.resetCache();
    ts.yt = undefined;
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
    private ankiLastRefresh: number;
    private ankiRefreshTrigger: boolean;
    private ankiRefreshing: boolean;
    private ankiRecentlyModifiedCardIds: Set<number>;
    private ankiRecentlyModifiedFirstCheck: boolean;
    private ankiStatisticsRefreshAll: boolean;
    private ankiStatisticsRefreshNew: boolean;
    private annotationsLastRefresh: number;
    private annotationsBuilding: boolean;
    private annotationsBuildingCurrentIndexes: Set<number>;
    private shouldCancelBuild: boolean; // Set to true to stop current build, checked after each async calls
    private tokenRequestFailedForTracks: Set<number>;

    private readonly subtitleAnnotationsUpdated: (updatedSubtitles: RichSubtitleModel[], dt: DictionaryTrack[]) => void;
    private readonly getMediaTimeMs?: () => number;

    private removeBuildAnkiCacheStateChangeCB?: () => void;
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
        this.ankiLastRefresh = Date.now();
        this.ankiRefreshTrigger = false;
        this.ankiRefreshing = false;
        this.ankiRecentlyModifiedCardIds = new Set();
        this.ankiRecentlyModifiedFirstCheck = true;
        this.ankiStatisticsRefreshAll = false;
        this.ankiStatisticsRefreshNew = false;
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
        this.trackStates.forEach(resetYomitan);
        this.trackStates = [];
        this.showingSubtitles = undefined;
        this.showingNeedsRefreshCount = 0;
        this.dictionaryStatistics.reset();
        this.statisticsBatchProcessedIndex = 0;
        this.statisticsProcessedSubtitleIndexesByTrack.clear();
        this.generateStatisticsRequested = false;
        this.ankiRefreshTrigger = false;
        this.ankiRecentlyModifiedCardIds.clear();
        this.ankiRecentlyModifiedFirstCheck = true;
        this.ankiStatisticsRefreshAll = false;
        this.ankiStatisticsRefreshNew = false;
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
            ts.dt = newDt;
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
        for (const token of modifiedTokens) this.tokensForRefresh.add(token);
    }

    buildAnkiCacheStateChange(state: DictionaryBuildAnkiCacheState) {
        this.tokensWereModified(state.body?.modifiedTokens ?? []);
        if (state.type === DictionaryBuildAnkiCacheStateType.error) {
            const body = state.body as DictionaryBuildAnkiCacheStateError;
            if (body) {
                console.error(
                    `Dictionary Anki cache build error (${body.code} - ${body.msg}): ${JSON.stringify(body.data ?? {})}`
                );
            } else {
                console.error(`Dictionary Anki cache build error: Unknown error`);
            }
            if (body?.code !== DictionaryBuildAnkiCacheStateErrorCode.concurrentBuild) {
                this.ankiRecentlyModifiedCardIds.clear();
                this.ankiRecentlyModifiedFirstCheck = false;
            }
        }
    }

    ankiCardWasModified() {
        this.ankiRefreshTrigger = true;
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
        this.tokensForRefresh.add(token);
        for (const lemma of lemmas) this.tokensForRefresh.add(lemma);
    }

    requestStatisticsGeneration() {
        this.generateStatistics = true;
    }

    private async _refreshAnki() {
        if (this.profile === null || !this.trackStates.length) return;
        const profile = this.profile;

        if (this.ankiRefreshing) return;
        try {
            this.ankiRefreshing = true;
            if (!this.anki) {
                try {
                    this.anki = new Anki(await this.settingsProvider.getAll(), this.fetcher);
                    const permission = (await this.anki.requestPermission()).permission;
                    if (permission !== 'granted') throw new Error(`permission ${permission}`);
                    await this.dictionaryProvider.buildAnkiCache(profile, await this.settingsProvider.getAll()); // Keep cache updated without user action
                    this.ankiStatisticsRefreshAll = true;
                } catch (e) {
                    console.warn('Anki permission request failed:', e);
                    this.anki = undefined;
                }
            }

            const cardIdsMap = new Map<number, boolean>();
            const allFieldsSet = new Set<string>();
            for (const ts of this.trackStates) {
                if (!dictionaryStatusCollectionEnabled(ts.dt)) continue;
                for (const tokenCardIds of ts.tokenCardIds.values()) {
                    for (const [cardId, queried] of tokenCardIds.entries()) {
                        cardIdsMap.set(cardId, queried && cardIdsMap.get(cardId) !== false);
                    }
                }
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

            await this._checkAnkiRecentlyModifiedCards(profile, fields, decks);
            await this._refreshAnkiStatistics(cardIdsMap, fields, decks);
        } finally {
            this.ankiRefreshing = false;
        }
    }

    private async _checkAnkiRecentlyModifiedCards(profile: string | undefined, fields: string[], decks: string[]) {
        try {
            if (!this.anki) throw new Error('Anki not initialized');
            const cardIds = await this.anki.findRecentlyEditedOrReviewedCards(1, fields, decks); // Can't efficiently poll suspended status
            if (
                cardIds.length === this.ankiRecentlyModifiedCardIds.size &&
                cardIds.every((cardId) => this.ankiRecentlyModifiedCardIds.has(cardId))
            ) {
                if (this.ankiRecentlyModifiedFirstCheck) this.ankiRecentlyModifiedFirstCheck = false;
                return;
            }
            this.ankiRecentlyModifiedCardIds = new Set(cardIds);
            if (this.ankiRecentlyModifiedFirstCheck) {
                this.ankiRecentlyModifiedFirstCheck = false;
                return;
            }
            await this.dictionaryProvider.buildAnkiCache(profile, await this.settingsProvider.getAll());
            this.ankiStatisticsRefreshAll = true;
        } catch (e) {
            console.error(`Error checking Anki recently modified cards:`, e);
            this.anki = undefined;
            this.ankiRecentlyModifiedCardIds.clear();
            this.ankiRecentlyModifiedFirstCheck = false;
        }
    }

    private async _refreshAnkiStatistics(cardIdsMap: Map<number, boolean>, fields: string[], decks: string[]) {
        if (this.statisticsBatchProcessedIndex < this._subtitles.length) return; // Will need to re-query anki as tokens are processed.
        let refreshNewOnly = true;
        if (this.ankiStatisticsRefreshAll) {
            this.ankiStatisticsRefreshAll = false;
            this.ankiStatisticsRefreshNew = false;
            refreshNewOnly = false;
        } else if (this.ankiStatisticsRefreshNew) {
            this.ankiStatisticsRefreshNew = false;
        }
        if (!this.generateStatistics) return;

        const getCardsInfo = async (cardIds: number[]) => {
            const cardsInfoArr = await this.anki!.cardsInfo(cardIds);
            const cardsInfo: DictionaryStatisticsAnkiSnapshot['cardsInfo'] = {};
            for (const cardInfo of cardsInfoArr) cardsInfo[cardInfo.cardId] = cardInfo;
            for (const cardId of cardIds) cardIdsMap.set(cardId, true);
            for (const ts of this.trackStates) {
                for (const tokenCardIds of ts.tokenCardIds.values()) {
                    for (const cardId of cardIds) {
                        if (tokenCardIds.has(cardId)) tokenCardIds.set(cardId, true);
                    }
                }
            }
            return cardsInfo;
        };

        const startedAt = Date.now();
        try {
            if (!this.anki) throw new Error('Anki not initialized');

            const cardIds: number[] = [];
            if (refreshNewOnly) {
                for (const [cardId, queried] of cardIdsMap) {
                    if (!queried) cardIds.push(cardId);
                }
                if (!cardIds.length) return;

                const cardsInfo = await getCardsInfo(cardIds);
                this.dictionaryStatistics.updateAnkiSnapshot({
                    available: true,
                    progress: {
                        current: Array.from(cardIdsMap.values()).filter((queried) => queried).length,
                        total: cardIdsMap.size,
                        startedAt,
                    },
                    cardsInfo,
                });
            } else {
                for (const cardId of cardIdsMap.keys()) cardIds.push(cardId);
                if (!cardIds.length) {
                    this.dictionaryStatistics.replaceAnkiSnapshot({
                        available: true,
                        cardsInfo: {},
                        dueCards: {},
                    });
                    return;
                }

                const cardsInfo = await getCardsInfo(cardIds);
                const dueCards: DictionaryStatisticsAnkiDueCardsSnapshot = {};
                for (const due of ANKI_DUES) dueCards[due] = await this.anki.findCardsDueBy(due, fields, decks);
                this.dictionaryStatistics.replaceAnkiSnapshot({
                    available: true,
                    progress: {
                        current: Array.from(cardIdsMap.values()).filter((queried) => queried).length,
                        total: cardIdsMap.size,
                        startedAt,
                    },
                    cardsInfo,
                    dueCards,
                });
            }
        } catch (e) {
            console.error('Error refreshing Anki for statistics:', e);
            this.anki = undefined;
            this.dictionaryStatistics.replaceAnkiSnapshot({
                available: false,
                cardsInfo: {},
                dueCards: {},
            });
            for (const ts of this.trackStates) {
                for (const tokenCardIds of ts.tokenCardIds.values()) {
                    for (const cardId of tokenCardIds.keys()) tokenCardIds.set(cardId, false);
                }
            }
        }
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
                (this.ankiRefreshTrigger || Date.now() - this.ankiLastRefresh >= ANKI_REFRESH_INTERVAL) &&
                !this.ankiRefreshing
            ) {
                void this._refreshAnki();
                this.ankiLastRefresh = Date.now();
                this.ankiRefreshTrigger = false;
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
        let buildWasCancelled = false;
        let updateThresholds = false;
        let statisticsBatching = false;
        try {
            this.annotationsBuilding = true;
            if (this.profile === null) {
                const profile = (await this.settingsProvider.activeProfile())?.name;
                if (this.profile === null) {
                    this.profile = profile;
                    this.ankiRefreshTrigger = true;
                }
            }
            const profile = this.profile;
            if (!this.trackStates.length) {
                this.trackStates = (await this.settingsProvider.getSingle('dictionaryTracks')).map((dt, track) => ({
                    track,
                    dt,
                    yt: undefined,
                    collectedExactForm: new Map(),
                    collectedLemmaForm: new Map(),
                    collectedAnyForm: new Map(),
                    tokenCardIds: new Map(),
                    tokenStates: new Map(),
                }));
                if (this.generateStatistics === undefined) {
                    this.generateStatistics = this._shouldAutoGenerateStatistics(this.trackStates.map((ts) => ts.dt));
                }
            }
            if (this.trackStates.every((t) => !dictionaryTrackEnabled(t.dt))) return true;
            if (this.shouldCancelBuild) return false;

            for (const ts of this.trackStates) {
                if (!dictionaryTrackEnabled(ts.dt) || ts.yt) continue;
                try {
                    const yt = new Yomitan(ts.dt, this.fetcher, {
                        lemmaTokenFallback: true,
                        tokensWereModified: (token) => {
                            for (const index of this.tokenToIndexesCache.get(token) ?? []) this.refreshCache.add(index);
                        },
                    });
                    await yt.version();
                    ts.yt = yt;
                } catch (e) {
                    console.error(`YomitanTrack${ts.track + 1} version request failed:`, e);
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
                    this.ankiRefreshTrigger = true;
                    this.ankiStatisticsRefreshAll = true;
                    tokenCacheRefreshInterval = TOKEN_CACHE_STATISTICS_REFRESH_INTERVAL;
                }
            }
            const subtitles = this.subtitles.slice(annotationsStartIndex, annotationsEndIndex);
            if (!subtitles.length) return true;

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

            if (this.shouldCancelBuild) {
                buildWasCancelled = true;
                tokensRefreshed = [];
                updateThresholds = false;
            }
        } finally {
            if (this.tokenRequestFailedForTracks.size) {
                tokensRefreshed = [];
                updateThresholds = false;
                for (const track of this.tokenRequestFailedForTracks) resetYomitan(this.trackStates[track]);
                this.tokenRequestFailedForTracks.clear();
            } else if (!this.shouldCancelBuild) {
                this.initialized = true;
                if (statisticsBatching) {
                    this.statisticsBatchProcessedIndex = annotationsEndIndex;
                    if (annotationsEndIndex >= this.subtitles.length) {
                        this.generateStatisticsRequested = false;
                        this.ankiRefreshTrigger = true;
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
                this.ankiStatisticsRefreshAll = true;
            }
            this.shouldCancelBuild = false;
            this.annotationsBuilding = false;
        }
        return !buildWasCancelled;
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

                const shouldQueryExactForm =
                    shouldUseExactForm(ts.dt.dictionaryTokenMatchStrategy) ||
                    shouldUseExactForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy);
                const shouldQueryLemmaForm =
                    shouldUseLemmaForm(ts.dt.dictionaryTokenMatchStrategy) ||
                    shouldUseLemmaForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy);
                const shouldQueryAnyForm =
                    shouldUseAnyForm(ts.dt.dictionaryTokenMatchStrategy) ||
                    shouldUseAnyForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy);

                for (const token of this.tokensForRefresh) {
                    ts.collectedExactForm.delete(token);
                    ts.collectedLemmaForm.delete(token);
                    ts.collectedAnyForm.delete(token);
                    ts.tokenCardIds.delete(token);
                    ts.tokenStates.delete(token);
                }

                const forExactFormQuery = new Set<string>();
                const forLemmaFormQuery = new Set<string>();
                const forAnyFormQuery = new Set<string>();
                for (const tokenParts of tokenizeBulkRes) {
                    const token = tokenParts
                        .map((p) => p.text)
                        .join('')
                        .trim();
                    if (shouldQueryExactForm && !ts.collectedExactForm.has(token)) forExactFormQuery.add(token);
                    if (shouldQueryLemmaForm) {
                        for (const lemma of (await ts.yt.lemmatize(token)) ?? []) {
                            if (!ts.collectedLemmaForm.has(lemma)) forLemmaFormQuery.add(lemma);
                        }
                    }
                    if (shouldQueryAnyForm) {
                        for (const lemma of (await ts.yt.lemmatize(token)) ?? []) {
                            if (!ts.collectedAnyForm.has(lemma)) forAnyFormQuery.add(lemma);
                        }
                    }
                }
                if (this.shouldCancelBuild) return;

                const [exactFormResultMap, lemmaFormResultMap, anyFormResultsMap] = await Promise.all([
                    forExactFormQuery.size
                        ? this.dictionaryProvider.getBulk(profile, track, Array.from(forExactFormQuery))
                        : ({} as TokenResults),
                    forLemmaFormQuery.size
                        ? this.dictionaryProvider.getBulk(profile, track, Array.from(forLemmaFormQuery))
                        : ({} as TokenResults),
                    forAnyFormQuery.size
                        ? this.dictionaryProvider.getByLemmaBulk(profile, track, Array.from(forAnyFormQuery))
                        : ({} as LemmaResults),
                ]);
                if (this.shouldCancelBuild) return;

                for (const [token, { states, statuses, source }] of Object.entries(exactFormResultMap)) {
                    for (const status of statuses) {
                        if (status.cardId === undefined) continue;
                        let tokenCardIds = ts.tokenCardIds.get(token);
                        if (!tokenCardIds) {
                            tokenCardIds = new Map();
                            ts.tokenCardIds.set(token, tokenCardIds);
                        }
                        tokenCardIds.set(status.cardId, false);
                    }
                    const status = getCardTokenStatus(statuses, ts.dt.dictionaryAnkiTreatSuspended);
                    ts.collectedExactForm.set(token, { status, source });
                    if (states.length) ts.tokenStates.set(token, states);
                }
                for (const [lemma, { states, statuses, source }] of Object.entries(lemmaFormResultMap)) {
                    for (const status of statuses) {
                        if (status.cardId === undefined) continue;
                        let tokenCardIds = ts.tokenCardIds.get(lemma);
                        if (!tokenCardIds) {
                            tokenCardIds = new Map();
                            ts.tokenCardIds.set(lemma, tokenCardIds);
                        }
                        tokenCardIds.set(status.cardId, false);
                    }
                    const status = getCardTokenStatus(statuses, ts.dt.dictionaryAnkiTreatSuspended);
                    ts.collectedLemmaForm.set(lemma, { status, source });
                    if (!states.length) continue;
                    const tokenStates = ts.tokenStates.get(lemma);
                    if (tokenStates) {
                        for (const state of states) {
                            if (!tokenStates.includes(state)) tokenStates.push(state);
                        }
                    } else {
                        ts.tokenStates.set(lemma, states);
                    }
                }
                for (const [lemma, lemmaResults] of Object.entries(anyFormResultsMap)) {
                    for (const { states, statuses, source, token } of lemmaResults) {
                        for (const status of statuses) {
                            if (status.cardId === undefined) continue;
                            let tokenCardIds = ts.tokenCardIds.get(token);
                            if (!tokenCardIds) {
                                tokenCardIds = new Map();
                                ts.tokenCardIds.set(token, tokenCardIds);
                            }
                            tokenCardIds.set(status.cardId, false);
                        }
                        const status = getCardTokenStatus(statuses, ts.dt.dictionaryAnkiTreatSuspended);
                        const lemmaCollected = ts.collectedAnyForm.get(lemma);
                        if (lemmaCollected) lemmaCollected.push({ status, source, token });
                        else ts.collectedAnyForm.set(lemma, [{ status, source, token }]);
                        if (!states.length) continue;
                        const tokenStates = ts.tokenStates.get(token);
                        if (tokenStates) {
                            for (const state of states) {
                                if (!tokenStates.includes(state)) tokenStates.push(state);
                            }
                        } else {
                            ts.tokenStates.set(token, states);
                        }
                    }
                }
                if (forExactFormQuery.size || forLemmaFormQuery.size || forAnyFormQuery.size) {
                    this.ankiStatisticsRefreshNew = true;
                }
            } catch (e) {
                console.error(`Error building token and lemma map for track ${track}:`, e);
                resetYomitan(ts);
                this.ankiStatisticsRefreshNew = true; // In case of partial updates
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

                        const tokenToIndexes = this.tokenToIndexesCache.get(trimmedToken);
                        if (tokenToIndexes) tokenToIndexes.add(index);
                        else this.tokenToIndexesCache.set(trimmedToken, new Set([index]));
                        const lemmas = await ts.yt!.lemmatize(trimmedToken);
                        if (this.shouldCancelBuild) return;
                        if (!lemmas) {
                            error = true;
                            this.erroredCache.add(index);
                            return;
                        }
                        for (const lemma of lemmas) {
                            const lemmaToIndexes = this.tokenToIndexesCache.get(lemma);
                            if (lemmaToIndexes) lemmaToIndexes.add(index);
                            else this.tokenToIndexesCache.set(lemma, new Set([index]));
                        }

                        const states = ts.tokenStates.get(trimmedToken) ?? [];
                        const { status, source } =
                            states.includes(TokenState.IGNORED) || !HAS_LETTER_REGEX.test(trimmedToken)
                                ? { status: getFullyKnownTokenStatus() }
                                : ((await this._tokenStatus(trimmedToken, ts)) ?? { status: null });
                        const token: Token = {
                            pos: [existingToken.pos[0], existingToken.pos[1]],
                            readings: existingToken.readings.map((r) => ({
                                pos: [r.pos[0], r.pos[1]],
                                reading: r.reading,
                            })),
                            status,
                            states,
                            groupingKey: groupingKeyForToken(trimmedToken, lemmas, source, ts.dt),
                        };
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
            const tokens: Token[] = [];
            let currentOffset = 0;
            let reconstructedTextParts = [];
            for (const tokenParts of tokenizeRes) {
                const tokenText = tokenParts.map((p) => p.text).join('');
                reconstructedTextParts.push(tokenText);
                const trimmedToken = tokenText.trim();

                // Build token
                const token: InternalToken = {
                    pos: [baseIndex + currentOffset, baseIndex + currentOffset + tokenText.length],
                    states: ts.tokenStates.get(trimmedToken) ?? [],
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

                const tokenToIndexes = this.tokenToIndexesCache.get(trimmedToken);
                if (tokenToIndexes) tokenToIndexes.add(index);
                else this.tokenToIndexesCache.set(trimmedToken, new Set([index]));
                const lemmas = await ts.yt.lemmatize(trimmedToken);
                if (this.shouldCancelBuild) return;
                if (!lemmas) {
                    this.erroredCache.add(index);
                    token.status = null;
                    continue;
                }
                for (const lemma of lemmas) {
                    const lemmaToIndexes = this.tokenToIndexesCache.get(lemma);
                    if (lemmaToIndexes) lemmaToIndexes.add(index);
                    else this.tokenToIndexesCache.set(lemma, new Set([index]));
                }

                // Build token status
                if (token.states.includes(TokenState.IGNORED) || !HAS_LETTER_REGEX.test(trimmedToken)) {
                    token.status = getFullyKnownTokenStatus();
                    token.groupingKey = groupingKeyForToken(trimmedToken, lemmas, undefined, ts.dt);
                    continue;
                }
                const { status, source } = (await this._tokenStatus(trimmedToken, ts)) ?? { status: null };
                token.status = status;
                token.groupingKey = groupingKeyForToken(trimmedToken, lemmas, source, ts.dt);
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

    private async _tokenStatus(trimmedToken: string, ts: TrackState): Promise<ResolvedTokenStatusResult | null> {
        if (!ts.yt) throw new Error('Yomitan uninitialized - cannot calculate token status');
        switch (ts.dt.dictionaryTokenMatchStrategyPriority) {
            case TokenMatchStrategyPriority.EXACT:
                return await this._handlePriorityExact(trimmedToken, ts);
            case TokenMatchStrategyPriority.LEMMA:
                return await this._handlePriorityLemma(trimmedToken, ts);
            case TokenMatchStrategyPriority.BEST_KNOWN:
                return await this._handlePriorityKnown(trimmedToken, ts, (tokenStatuses) => Math.max(...tokenStatuses));
            case TokenMatchStrategyPriority.LEAST_KNOWN:
                return await this._handlePriorityKnown(trimmedToken, ts, (tokenStatuses) => Math.min(...tokenStatuses));
            default:
                throw new Error(`Unknown strategy priority: ${ts.dt.dictionaryTokenMatchStrategyPriority}`);
        }
    }

    private async _handlePriorityExact(
        trimmedToken: string,
        ts: TrackState
    ): Promise<ResolvedTokenStatusResult | null> {
        if (shouldUseExactForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult && tokenStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                return tokenStatusResult;
            }
        }
        if (shouldUseLemmaForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            const lemmaStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult && lemmaStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                    lemmaStatusResults.push(lemmaStatusResult);
                }
            }
            if (lemmaStatusResults.length) {
                return {
                    status: Math.max(...lemmaStatusResults.map((r) => r.status)),
                    source: lemmaStatusResults[0].source,
                };
            }
        }
        if (shouldUseAnyForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            const anyFormStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const statusResults = ts.collectedAnyForm.get(lemma);
                if (!statusResults) continue;
                for (const statusResult of statusResults) {
                    if (statusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                        anyFormStatusResults.push(statusResult);
                    }
                }
            }
            if (anyFormStatusResults.length) {
                const exactMatches = anyFormStatusResults.filter((r) => r.token === trimmedToken);
                if (exactMatches.length) {
                    return {
                        status: Math.max(...exactMatches.map((r) => r.status)),
                        source: exactMatches[0].source,
                    };
                }
                const lemmaMatches = anyFormStatusResults.filter((r) => lemmas.includes(r.token!));
                if (lemmaMatches.length) {
                    return {
                        status: Math.max(...lemmaMatches.map((r) => r.status)),
                        source: lemmaMatches[0].source,
                    };
                }
                return {
                    status: Math.max(...anyFormStatusResults.map((r) => r.status)),
                    source: anyFormStatusResults[0].source,
                };
            }
        }
        if (shouldUseExactForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult?.source === DictionaryTokenSource.ANKI_SENTENCE) return tokenStatusResult;
        }
        if (shouldUseLemmaForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            const lemmaStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult?.source === DictionaryTokenSource.ANKI_SENTENCE) {
                    lemmaStatusResults.push(lemmaStatusResult);
                }
            }
            if (lemmaStatusResults.length) {
                return {
                    status: Math.max(...lemmaStatusResults.map((r) => r.status)),
                    source: lemmaStatusResults[0].source,
                };
            }
        }
        if (shouldUseAnyForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            const anyFormStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const anyFormStatusResult = ts.collectedAnyForm.get(lemma);
                if (!anyFormStatusResult) continue;
                for (const statusResult of anyFormStatusResult) {
                    if (statusResult.source === DictionaryTokenSource.ANKI_SENTENCE) {
                        anyFormStatusResults.push(statusResult);
                    }
                }
            }
            if (anyFormStatusResults.length) {
                const exactMatches = anyFormStatusResults.filter((r) => r.token === trimmedToken);
                if (exactMatches.length) {
                    return {
                        status: Math.max(...exactMatches.map((r) => r.status)),
                        source: exactMatches[0].source,
                    };
                }
                const lemmaMatches = anyFormStatusResults.filter((r) => lemmas.includes(r.token!));
                if (lemmaMatches.length) {
                    return {
                        status: Math.max(...lemmaMatches.map((r) => r.status)),
                        source: lemmaMatches[0].source,
                    };
                }
                return {
                    status: Math.max(...anyFormStatusResults.map((r) => r.status)),
                    source: anyFormStatusResults[0].source,
                };
            }
        }
        return { status: TokenStatus.UNCOLLECTED };
    }

    private async _handlePriorityLemma(
        trimmedToken: string,
        ts: TrackState
    ): Promise<ResolvedTokenStatusResult | null> {
        if (shouldUseLemmaForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            const lemmaStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult && lemmaStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                    lemmaStatusResults.push(lemmaStatusResult);
                }
            }
            if (lemmaStatusResults.length) {
                return {
                    status: Math.max(...lemmaStatusResults.map((r) => r.status)),
                    source: lemmaStatusResults[0].source,
                };
            }
        }
        if (shouldUseExactForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult && tokenStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                return tokenStatusResult;
            }
        }
        if (shouldUseAnyForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            const anyFormStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const statusResults = ts.collectedAnyForm.get(lemma);
                if (!statusResults) continue;
                for (const statusResult of statusResults) {
                    if (statusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                        anyFormStatusResults.push(statusResult);
                    }
                }
            }
            if (anyFormStatusResults.length) {
                const lemmaMatches = anyFormStatusResults.filter((r) => lemmas.includes(r.token!));
                if (lemmaMatches.length) {
                    return {
                        status: Math.max(...lemmaMatches.map((r) => r.status)),
                        source: lemmaMatches[0].source,
                    };
                }
                const exactMatches = anyFormStatusResults.filter((r) => r.token === trimmedToken);
                if (exactMatches.length) {
                    return {
                        status: Math.max(...exactMatches.map((r) => r.status)),
                        source: exactMatches[0].source,
                    };
                }
                return {
                    status: Math.max(...anyFormStatusResults.map((r) => r.status)),
                    source: anyFormStatusResults[0].source,
                };
            }
        }
        if (shouldUseLemmaForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            const lemmaStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult?.source === DictionaryTokenSource.ANKI_SENTENCE) {
                    lemmaStatusResults.push(lemmaStatusResult);
                }
            }
            if (lemmaStatusResults.length) {
                return {
                    status: Math.max(...lemmaStatusResults.map((r) => r.status)),
                    source: lemmaStatusResults[0].source,
                };
            }
        }
        if (shouldUseExactForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult?.source === DictionaryTokenSource.ANKI_SENTENCE) return tokenStatusResult;
        }
        if (shouldUseAnyForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            const anyFormStatusResults: TokenStatusResult[] = [];
            for (const lemma of lemmas) {
                const anyFormStatusResult = ts.collectedAnyForm.get(lemma);
                if (!anyFormStatusResult) continue;
                for (const statusResult of anyFormStatusResult) {
                    if (statusResult.source === DictionaryTokenSource.ANKI_SENTENCE) {
                        anyFormStatusResults.push(statusResult);
                    }
                }
            }
            if (anyFormStatusResults.length) {
                const lemmaMatches = anyFormStatusResults.filter((r) => lemmas.includes(r.token!));
                if (lemmaMatches.length) {
                    return {
                        status: Math.max(...lemmaMatches.map((r) => r.status)),
                        source: lemmaMatches[0].source,
                    };
                }
                const exactMatches = anyFormStatusResults.filter((r) => r.token === trimmedToken);
                if (exactMatches.length) {
                    return {
                        status: Math.max(...exactMatches.map((r) => r.status)),
                        source: exactMatches[0].source,
                    };
                }
                return {
                    status: Math.max(...anyFormStatusResults.map((r) => r.status)),
                    source: anyFormStatusResults[0].source,
                };
            }
        }
        return { status: TokenStatus.UNCOLLECTED };
    }

    private async _handlePriorityKnown(
        trimmedToken: string,
        ts: TrackState,
        cmp: (tokenStatuses: TokenStatus[]) => TokenStatus
    ): Promise<ResolvedTokenStatusResult | null> {
        const tokenStatusResults: TokenStatusResult[] = [];

        if (shouldUseExactForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult && tokenStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                tokenStatusResults.push(tokenStatusResult);
            }
        }
        if (shouldUseLemmaForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult && lemmaStatusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                    tokenStatusResults.push(lemmaStatusResult);
                }
            }
        }
        if (shouldUseAnyForm(ts.dt.dictionaryTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            for (const lemma of lemmas) {
                const statusResults = ts.collectedAnyForm.get(lemma);
                if (!statusResults) continue;
                for (const statusResult of statusResults) {
                    if (statusResult.source !== DictionaryTokenSource.ANKI_SENTENCE) {
                        tokenStatusResults.push(statusResult);
                    }
                }
            }
        }
        if (tokenStatusResults.length) {
            return {
                status: cmp(tokenStatusResults.map((r) => r.status)),
                source: tokenStatusResults[0].source,
            };
        }

        if (shouldUseExactForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const tokenStatusResult = ts.collectedExactForm.get(trimmedToken);
            if (tokenStatusResult?.source === DictionaryTokenSource.ANKI_SENTENCE) {
                tokenStatusResults.push(tokenStatusResult);
            }
        }
        if (shouldUseLemmaForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            for (const lemma of lemmas) {
                const lemmaStatusResult = ts.collectedLemmaForm.get(lemma);
                if (lemmaStatusResult?.source === DictionaryTokenSource.ANKI_SENTENCE) {
                    tokenStatusResults.push(lemmaStatusResult);
                }
            }
        }
        if (shouldUseAnyForm(ts.dt.dictionaryAnkiSentenceTokenMatchStrategy)) {
            const lemmas = await ts.yt!.lemmatize(trimmedToken);
            if (this.shouldCancelBuild) return null;
            if (!lemmas) return null;
            for (const lemma of lemmas) {
                const anyFormStatusResult = ts.collectedAnyForm.get(lemma);
                if (!anyFormStatusResult) continue;
                for (const statusResult of anyFormStatusResult) {
                    if (statusResult.source === DictionaryTokenSource.ANKI_SENTENCE) {
                        tokenStatusResults.push(statusResult);
                    }
                }
            }
        }
        if (tokenStatusResults.length) {
            return {
                status: cmp(tokenStatusResults.map((r) => r.status)),
                source: tokenStatusResults[0].source,
            };
        }

        return { status: TokenStatus.UNCOLLECTED };
    }

    unbind() {
        this.reset();
        if (this.removeBuildAnkiCacheStateChangeCB) {
            this.removeBuildAnkiCacheStateChangeCB();
            this.removeBuildAnkiCacheStateChangeCB = undefined;
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
