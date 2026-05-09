import { Progress, Tokenization } from '@project/common';
import { CardInfo } from '@project/common/anki';
import { DictionaryProvider, TokenResults } from '@project/common/dictionary-db';
import {
    AsbplayerSettings,
    defaultSettings,
    dictionaryTrackEnabled,
    NUM_TOKEN_STATUSES,
    SettingsProvider,
    TokenStatusConfig,
    TokenStatus,
} from '@project/common/settings';

export interface DictionaryStatisticsSentence {
    text: string;
    start: number;
    end: number;
    track: number;
    index: number;
    richText?: string;
    tokenization?: Tokenization;
}

export type DictionaryStatisticsAnkiDueCardsSnapshot = Record<number, number[]>; // [0, [...]] due today, [7, [...]] due within a week

export interface DictionaryStatisticsAnkiSnapshot {
    available?: boolean;
    progress?: Progress;
    cardsInfo: Record<number, CardInfo>;
    dueCards: DictionaryStatisticsAnkiDueCardsSnapshot;
}

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
    settings: AsbplayerSettings;
    anki: DictionaryStatisticsAnkiSnapshot;
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
    private settings: AsbplayerSettings;
    private anki: DictionaryStatisticsAnkiSnapshot;
    private lastCancelledAt: number;

    constructor(settingsProvider: SettingsProvider, dictionaryProvider: DictionaryProvider, mediaId: string) {
        this.settingsProvider = settingsProvider;
        this.dictionaryProvider = dictionaryProvider;
        this.mediaId = mediaId;
        this.rawTrackSnapshots = new Map();
        this.settings = defaultSettings;
        this.anki = { cardsInfo: {}, dueCards: {} };
        this.lastCancelledAt = 0;
    }

    hasStatistics(): boolean {
        return this.rawTrackSnapshots.size > 0;
    }

    reset(): void {
        const startTime = Date.now();
        this.rawTrackSnapshots.clear();
        this.anki = { cardsInfo: {}, dueCards: {} };
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

    updateAnkiSnapshot(anki: Partial<DictionaryStatisticsAnkiSnapshot>): void {
        const startTime = Date.now();
        const startedAt = this.anki.progress?.startedAt ?? anki.progress?.startedAt ?? Date.now();
        const progress = anki.progress ? { ...anki.progress, startedAt } : this.anki.progress;
        const cardsInfo = anki.cardsInfo ? { ...this.anki.cardsInfo, ...anki.cardsInfo } : this.anki.cardsInfo;
        this.anki = { ...this.anki, ...anki, progress, cardsInfo };
        if (!this.hasStatistics()) return;
        void this._publish(this._snapshot(), startTime);
    }

    async refreshDictionaryTokens(profile: string | undefined): Promise<void> {
        const startTime = Date.now();
        const settings = await this.settingsProvider.getAll();
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
        };
    }

    private async _publish(snapshot: DictionaryStatisticsSnapshot | undefined, startTime: number): Promise<void> {
        if (startTime <= this.lastCancelledAt) return;
        return this.dictionaryProvider.publishStatisticsSnapshot(this.mediaId, snapshot);
    }
}
