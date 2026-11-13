import type { IndexedSubtitleModel, Progress, Tokenization } from '@project/common';
import type { SubtitleSourceState, SubtitleSourceStatus } from '@project/common/subtitle-reader/subtitle-stream';
import type {
    CardInfoForDB,
    DictionaryProvider,
    DictionaryWaniKaniAssignmentRecordWithStatus,
    DictionaryWaniKaniSubjectRecord,
    TokenResults,
} from '@project/common/dictionary-db';
import type { DictionarySettings, SettingsProvider, TokenStatusConfig, TokenStatus } from '@project/common/settings';
import { defaultSettings, dictionaryTrackEnabled, NUM_TOKEN_STATUSES } from '@project/common/settings';
import { asbError } from '@project/common/util/log';

const publicationIntervalMs = 1000;

export const REVIEW_DUES = [0, 1, 7] as const; // 0 = due today, 1 = due within a day, 7 = due within a week

export interface DictionaryStatisticsSentence {
    text: string;
    start: number;
    end: number;
    track: number;
    index: number;
    source?: IndexedSubtitleModel['source'];
    tokenization?: Tokenization;
}

export type DictionaryStatisticsAnkiDueCardsSnapshot = Record<number, number[]>; // [0, [...]] due today, [7, [...]] due within a week

export interface DictionaryStatisticsAnkiSnapshot {
    available?: boolean;
    progress?: Progress;
    cardsInfo: Record<number, CardInfoForDB>;
    dueCards: DictionaryStatisticsAnkiDueCardsSnapshot;
    cardsStatus?: Record<number, TokenStatus>;
}

export interface DictionaryStatisticsWaniKaniSnapshot {
    available?: boolean;
    assignments: DictionaryWaniKaniAssignmentRecordWithStatus[];
    subjects: Record<number, DictionaryWaniKaniSubjectRecord>;
}

export type DictionaryStatisticsWaniKaniSnapshots = Record<number, DictionaryStatisticsWaniKaniSnapshot>;

export interface DictionaryStatisticsDictionarySnapshot {
    tokens: TokenResults;
}
export type DictionaryStatisticsSentences = Record<number, DictionaryStatisticsSentence>;

export interface DictionaryStatisticsStats {
    dictionary: DictionaryStatisticsDictionarySnapshot;
    sentences: DictionaryStatisticsSentences;
}

export interface DictionaryStatisticsRawTrackSnapshot {
    /** Processing all received cues does not imply source completion. */
    sourceStatus: SubtitleSourceStatus;
    track: number;
    progress: Progress;
    statusColors: Record<TokenStatus, string>;
    stats: DictionaryStatisticsStats;
}

export interface DictionaryStatisticsSnapshot {
    mediaId: string;
    snapshots: DictionaryStatisticsRawTrackSnapshot[];
    settings: DictionarySettings;
    anki: DictionaryStatisticsAnkiSnapshot;
    waniKani?: DictionaryStatisticsWaniKaniSnapshots;
}

function statusColorsFromConfig(tokenStatusConfig: readonly TokenStatusConfig[]): Record<TokenStatus, string> {
    const statusColors = {} as Record<TokenStatus, string>;
    for (let status: TokenStatus = 0; status < NUM_TOKEN_STATUSES; ++status) {
        let config = tokenStatusConfig[status];
        if (!config) config = { color: '#9E9E9E', alpha: 'FF', display: true };
        statusColors[status] = `${config.color}${config.alpha}`;
    }
    return statusColors;
}

export class DictionaryStatistics {
    private readonly settingsProvider: SettingsProvider;
    private readonly dictionaryProvider: DictionaryProvider;
    private readonly mediaId: string;
    private readonly rawTrackSnapshots: Map<number, DictionaryStatisticsRawTrackSnapshot>;
    private settings: DictionarySettings;
    private anki: DictionaryStatisticsAnkiSnapshot;
    private waniKani: DictionaryStatisticsWaniKaniSnapshots;
    private resetGeneration = 0;
    private publicationTimeout?: ReturnType<typeof setTimeout>;
    private lastPublishedAt = -Infinity;

    constructor(settingsProvider: SettingsProvider, dictionaryProvider: DictionaryProvider, mediaId: string) {
        this.settingsProvider = settingsProvider;
        this.dictionaryProvider = dictionaryProvider;
        this.mediaId = mediaId;
        this.rawTrackSnapshots = new Map();
        this.settings = { dictionaryTracks: defaultSettings.dictionaryTracks };
        this.anki = { cardsInfo: {}, dueCards: {}, cardsStatus: {} };
        this.waniKani = {};
    }

    hasStatistics(): boolean {
        return this.rawTrackSnapshots.size > 0;
    }

    reset(): void {
        clearTimeout(this.publicationTimeout);
        this.publicationTimeout = undefined;
        this.rawTrackSnapshots.clear();
        this.anki = { cardsInfo: {}, dueCards: {}, cardsStatus: {} };
        this.waniKani = {};
        ++this.resetGeneration;
        void this._publish();
    }

    publishSnapshot(): void {
        if (this.publicationTimeout !== undefined) return;
        const remainingMs = publicationIntervalMs - (performance.now() - this.lastPublishedAt);
        if (remainingMs <= 0) {
            this.lastPublishedAt = performance.now();
            void this._publish();
            return;
        }
        this.publicationTimeout = setTimeout(() => {
            this.publicationTimeout = undefined;
            this.publishSnapshot();
        }, remainingMs);
    }

    init(track: number, total: number): void {
        this.rawTrackSnapshots.set(track, {
            track,
            sourceStatus: 'complete',
            progress: { current: 0, total, startedAt: Date.now() },
            statusColors: statusColorsFromConfig([]),
            stats: {
                dictionary: {
                    tokens: {},
                },
                sentences: {},
            },
        });
    }

    setSourceStates(sources: readonly SubtitleSourceState[]): void {
        let changed = false;
        for (const snapshot of this.rawTrackSnapshots.values()) {
            const status = sources.find((source) => source.track === snapshot.track)?.status ?? 'complete';
            if (snapshot.sourceStatus !== status) changed = true;
            snapshot.sourceStatus = status;
        }
        if (changed) this.publishSnapshot();
    }

    reconcileSubtitles(
        subtitles: readonly IndexedSubtitleModel[],
        oldToNewIndexes: ReadonlyMap<number, number>,
        sources: readonly SubtitleSourceState[],
        processed: ReadonlyMap<number, ReadonlySet<number>>
    ): void {
        for (const snapshot of this.rawTrackSnapshots.values()) {
            const sentences: DictionaryStatisticsSentences = {};
            for (const sentence of Object.values(snapshot.stats.sentences)) {
                const index = oldToNewIndexes.get(sentence.index);
                if (index === undefined) continue;
                const cue = subtitles[index];
                if (cue) sentences[index] = { ...sentence, index, start: cue.start, end: cue.end };
            }
            snapshot.stats.sentences = sentences;
            snapshot.progress.total = subtitles.filter((cue) => cue.track === snapshot.track).length;
            snapshot.progress.current = processed.get(snapshot.track)?.size ?? 0;
        }
        this.setSourceStates(sources);
        this.publishSnapshot();
    }

    updateProgress(track: number, current: number): void {
        const ts = this.rawTrackSnapshots.get(track);
        if (!ts) throw new Error(`Track ${track} not initialized for dictionary statistics`);
        ts.progress.current = current;
        this.publishSnapshot();
    }

    replaceAnkiSnapshot(anki: DictionaryStatisticsAnkiSnapshot): void {
        this.anki = anki;
        if (!this.hasStatistics()) return;
        this.publishSnapshot();
    }

    replaceWaniKaniSnapshots(waniKani: DictionaryStatisticsWaniKaniSnapshots): void {
        this.waniKani = { ...waniKani };
        if (!this.hasStatistics()) return;
        this.publishSnapshot();
    }

    async refreshDictionaryTokens(profile: string | undefined): Promise<void> {
        const generation = this.resetGeneration;
        const dictionaryTracks = await this.settingsProvider.getSingle('dictionaryTracks');
        if (generation !== this.resetGeneration) return;
        const settings = { dictionaryTracks };
        this.settings = settings;
        await Promise.all(
            settings.dictionaryTracks.map(async (dt, track) => {
                if (!dictionaryTrackEnabled(dt)) return;
                const ts = this.rawTrackSnapshots.get(track);
                if (!ts) throw new Error(`Track ${track} not initialized for dictionary statistics`);
                const tokens = await this.dictionaryProvider.getAllTokens(profile, track);
                if (generation !== this.resetGeneration) return;
                ts.stats.dictionary.tokens = tokens;
                ts.statusColors = statusColorsFromConfig(dt.dictionaryTokenStatusConfig);
                this.publishSnapshot();
            })
        );
    }

    ingest(sentence: DictionaryStatisticsSentence): void {
        const ts = this.rawTrackSnapshots.get(sentence.track);
        if (!ts) throw new Error(`Track ${sentence.track} not initialized for dictionary statistics`);
        ts.stats.sentences[sentence.index] = sentence;
    }

    private _snapshot(): DictionaryStatisticsSnapshot {
        return {
            mediaId: this.mediaId,
            snapshots: Array.from(this.rawTrackSnapshots.entries())
                .sort(([left], [right]) => left - right)
                .map(([track, ts]) => ({
                    track,
                    sourceStatus: ts.sourceStatus,
                    progress: ts.progress,
                    statusColors: ts.statusColors,
                    stats: {
                        dictionary: {
                            tokens: ts.stats.dictionary.tokens,
                        },
                        sentences: ts.stats.sentences,
                    },
                })),
            settings: this.settings,
            anki: this.anki,
            waniKani: this.waniKani,
        };
    }

    private async _publish(): Promise<void> {
        try {
            await this.dictionaryProvider.publishStatisticsSnapshot(
                this.mediaId,
                this.hasStatistics() ? this._snapshot() : undefined
            );
        } catch (error) {
            asbError('statistics/publication', 'Failed to publish statistics snapshot:', error);
        }
    }
}
