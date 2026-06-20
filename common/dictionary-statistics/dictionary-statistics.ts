import { Progress, Tokenization } from '@project/common';
import type {
    CardInfoForDB,
    DictionaryProvider,
    DictionaryWaniKaniAssignmentRecordWithStatus,
    DictionaryWaniKaniSubjectRecord,
    TokenResults,
} from '@project/common/dictionary-db';
import {
    defaultSettings,
    dictionaryTrackEnabled,
    DictionarySettings,
    NUM_TOKEN_STATUSES,
    SettingsProvider,
    TokenStatusConfig,
    TokenStatus,
} from '@project/common/settings';

export const REVIEW_DUES = [0, 1, 7] as const; // 0 = due today, 1 = due within a day, 7 = due within a week

export interface DictionaryStatisticsSentence {
    text: string;
    start: number;
    end: number;
    track: number;
    index: number;
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
    private lastCancelledAt: number;

    constructor(settingsProvider: SettingsProvider, dictionaryProvider: DictionaryProvider, mediaId: string) {
        this.settingsProvider = settingsProvider;
        this.dictionaryProvider = dictionaryProvider;
        this.mediaId = mediaId;
        this.rawTrackSnapshots = new Map();
        this.settings = { dictionaryTracks: defaultSettings.dictionaryTracks };
        this.anki = { cardsInfo: {}, dueCards: {}, cardsStatus: {} };
        this.waniKani = {};
        this.lastCancelledAt = 0;
    }

    hasStatistics(): boolean {
        return this.rawTrackSnapshots.size > 0;
    }

    reset(): void {
        const startTime = Date.now();
        this.rawTrackSnapshots.clear();
        this.anki = { cardsInfo: {}, dueCards: {}, cardsStatus: {} };
        this.waniKani = {};
        void this._publish(undefined, startTime);
        this.lastCancelledAt = Date.now();
    }

    publishSnapshot(): void {
        const startTime = Date.now();
        void this._publish(this.hasStatistics() ? this._snapshot() : undefined, startTime);
    }

    init(track: number, total: number): void {
        this.rawTrackSnapshots.set(track, {
            track,
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

    updateProgress(track: number, current: number): void {
        const startTime = Date.now();
        const ts = this.rawTrackSnapshots.get(track);
        if (!ts) throw new Error(`Track ${track} not initialized for dictionary statistics`);
        ts.progress.current = current;
        void this._publish(this._snapshot(), startTime);
    }

    replaceAnkiSnapshot(anki: DictionaryStatisticsAnkiSnapshot): void {
        const startTime = Date.now();
        this.anki = anki;
        if (!this.hasStatistics()) return;
        void this._publish(this._snapshot(), startTime);
    }

    replaceWaniKaniSnapshots(waniKani: DictionaryStatisticsWaniKaniSnapshots): void {
        const startTime = Date.now();
        this.waniKani = { ...waniKani };
        if (!this.hasStatistics()) return;
        void this._publish(this._snapshot(), startTime);
    }

    async refreshDictionaryTokens(profile: string | undefined): Promise<void> {
        const startTime = Date.now();
        const dictionaryTracks = await this.settingsProvider.getSingle('dictionaryTracks');
        const settings = { dictionaryTracks };
        this.settings = settings;
        await Promise.all(
            settings.dictionaryTracks.map(async (dt, track) => {
                if (!dictionaryTrackEnabled(dt)) return;
                const ts = this.rawTrackSnapshots.get(track);
                if (!ts) throw new Error(`Track ${track} not initialized for dictionary statistics`);
                ts.stats.dictionary.tokens = await this.dictionaryProvider.getAllTokens(profile, track);
                ts.statusColors = statusColorsFromConfig(dt.dictionaryTokenStatusConfig);
                await this._publish(this._snapshot(), startTime);
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

    private async _publish(snapshot: DictionaryStatisticsSnapshot | undefined, startTime: number): Promise<void> {
        if (startTime <= this.lastCancelledAt) return;
        return this.dictionaryProvider.publishStatisticsSnapshot(this.mediaId, snapshot);
    }
}
