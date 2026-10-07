import { asbError, asbTrace, asbWarn } from '@project/common/util/log';
import type { DictionaryBuildAnkiCacheState, DictionaryBuildAnkiCacheStateError, Fetcher } from '@project/common';
import { DictionaryBuildAnkiCacheStateErrorCode, DictionaryBuildAnkiCacheStateType } from '@project/common';
import { Anki } from '@project/common/anki';
import type { AsbplayerSettings, DictionaryTrack, SettingsProvider } from '@project/common/settings';
import { dictionaryStatusCollectionEnabled } from '@project/common/settings';
import type { DictionaryProvider } from '@project/common/dictionary-db';
import type {
    DictionaryStatisticsAnkiDueCardsSnapshot,
    DictionaryStatisticsAnkiSnapshot,
} from '@project/common/dictionary-statistics';
import { REVIEW_DUES } from '@project/common/dictionary-statistics';

const ANKI_REFRESH_INTERVAL = 10000; // We need to poll in-case the user mines to Anki outside of asbplayer (e.g directly from Yomitan), local requests so no rate concerns

export interface AnkiAnnotationsOptions {
    dictionaryProvider: DictionaryProvider;
    settingsProvider: SettingsProvider;
    fetcher?: Fetcher;
    getProfile: () => string | undefined | null;
    getTracks: () => readonly { track: number; dt: DictionaryTrack }[];
    generateStatistics: () => boolean | undefined;
    tokensWereModified: (tokens: string[]) => void;
    replaceStatisticsSnapshot: (snapshot: DictionaryStatisticsAnkiSnapshot) => void;
}

export class AnkiAnnotations {
    private readonly options: AnkiAnnotationsOptions;
    private anki: Anki | undefined;
    private lastSettings?: { url: string; apiKey: string };
    private connectionError = false;
    private recentlyModifiedCardIds = new Set<number>();
    private recentlyModifiedFirstCheck = true;
    private refreshing = false;
    private refreshed = false;
    private lastRefresh = Date.now();
    private triggerRefresh = false;
    private statisticsRefreshed = false;

    constructor(options: AnkiAnnotationsOptions) {
        this.options = options;
    }

    reset(): void {
        this.anki = undefined;
        this.recentlyModifiedCardIds.clear();
        this.recentlyModifiedFirstCheck = true;
        this.refreshed = false;
        this.lastRefresh = Date.now();
        this.triggerRefresh = false;
        this.statisticsRefreshed = false;
    }

    updateSettings(settings: AsbplayerSettings): boolean {
        const changed =
            this.lastSettings === undefined ||
            this.lastSettings.url !== settings.ankiConnectUrl ||
            this.lastSettings.apiKey !== settings.ankiConnectApiKey;
        this.lastSettings = { url: settings.ankiConnectUrl, apiKey: settings.ankiConnectApiKey };
        return changed;
    }

    requestRefresh(): void {
        this.triggerRefresh = true;
    }

    cacheStateChanged(state: DictionaryBuildAnkiCacheState): void {
        const modifiedTokens = state.body?.modifiedTokens ?? [];
        asbTrace('annotations/anki', 'Anki cache state changed', {
            modifiedTokenCount: modifiedTokens.length,
            type: state.type,
        });
        this.options.tokensWereModified(modifiedTokens);
        if (state.type === DictionaryBuildAnkiCacheStateType.error) {
            const body = state.body as DictionaryBuildAnkiCacheStateError;
            if (
                body?.code === DictionaryBuildAnkiCacheStateErrorCode.noAnki ||
                body?.code === DictionaryBuildAnkiCacheStateErrorCode.noYomitan
            ) {
                this.statisticsRefreshed = false;
            }
            if (body) {
                asbError(
                    'annotations/anki',
                    `Dictionary Anki cache build error (${body.code} - ${body.msg}): ${JSON.stringify(body.data ?? {})}`
                );
            } else {
                asbError('annotations/anki', 'Dictionary Anki cache build error: Unknown error');
            }
            if (body?.code !== DictionaryBuildAnkiCacheStateErrorCode.concurrentBuild) {
                this.recentlyModifiedCardIds.clear();
                this.recentlyModifiedFirstCheck = false;
            }
        } else if (state.type === DictionaryBuildAnkiCacheStateType.stats) {
            this.statisticsRefreshed = false;
        }
    }

    cardWasModified(): void {
        asbTrace('annotations/anki', 'Anki card modification scheduled an annotation refresh');
        this.triggerRefresh = true;
        this.statisticsRefreshed = false;
    }

    refreshIfDue(): void {
        if ((this.triggerRefresh || Date.now() - this.lastRefresh >= ANKI_REFRESH_INTERVAL) && !this.refreshing) {
            void this.refresh();
            this.lastRefresh = Date.now();
            this.triggerRefresh = false;
        }
    }

    async refresh(): Promise<void> {
        const profile = this.options.getProfile();
        if (profile === null || !this.options.getTracks().length || this.refreshing) return;
        const startedAt = Date.now();
        asbTrace('annotations/anki', 'Starting Anki refresh', {
            generateStatistics: this.options.generateStatistics() === true,
            trackCount: this.options.getTracks().length,
        });
        try {
            this.refreshing = true;
            if (!this.anki) {
                try {
                    const settings = await this.options.settingsProvider.getAll();
                    if (this.lastSettings === undefined) this.updateSettings(settings);
                    this.anki = new Anki(settings, this.options.fetcher);
                    const permission = (await this.anki.requestPermission()).permission;
                    if (permission !== 'granted') throw new Error(`permission ${permission}`);
                    this.connectionError = false;
                } catch (e) {
                    if (!this.connectionError) {
                        asbWarn('annotations/anki', 'Anki permission request failed:', e);
                        this.connectionError = true;
                    }
                    this.anki = undefined;
                }
            }
            const allFieldsSet = new Set<string>();
            for (const ts of this.options.getTracks()) {
                if (!dictionaryStatusCollectionEnabled(ts.dt, { includeStates: false })) continue;
                for (const field of ts.dt.dictionaryAnkiWordFields.concat(ts.dt.dictionaryAnkiSentenceFields)) {
                    allFieldsSet.add(field);
                }
            }
            const fields = Array.from(allFieldsSet);
            const allDecksSet = new Set<string>();
            for (const ts of this.options.getTracks()) {
                if (!dictionaryStatusCollectionEnabled(ts.dt, { includeStates: false })) continue;
                if (!ts.dt.dictionaryAnkiDecks.length) {
                    allDecksSet.clear(); // Query all decks
                    break;
                }
                for (const deck of ts.dt.dictionaryAnkiDecks) allDecksSet.add(deck);
            }
            const decks = Array.from(allDecksSet);
            if (this.anki && !this.refreshed) {
                // Keep cache updated without user action
                await this.options.dictionaryProvider.buildAnkiCache(
                    profile,
                    await this.options.settingsProvider.getAll()
                );
                this.refreshed = true;
            }
            await this.checkRecentlyModifiedCards(profile, fields, decks);
            await this.refreshStatistics(profile, fields, decks);
        } catch (e) {
            if (!this.connectionError) {
                asbWarn('annotations/anki', 'Anki refresh failed:', e);
                this.connectionError = true;
            }
            this.refreshed = false;
        } finally {
            this.refreshing = false;
            asbTrace('annotations/anki', 'Finished Anki refresh', {
                durationMs: Date.now() - startedAt,
                refreshed: this.refreshed,
                statisticsRefreshed: this.statisticsRefreshed,
            });
        }
    }

    private async checkRecentlyModifiedCards(profile: string | undefined, fields: string[], decks: string[]) {
        try {
            if (!this.anki) throw new Error('Anki not initialized');
            const cardIds = await this.anki.findRecentlyEditedOrReviewedCards(1, fields, decks); // Can't efficiently poll suspended status
            this.connectionError = false;
            if (
                cardIds.length === this.recentlyModifiedCardIds.size &&
                cardIds.every((cardId) => this.recentlyModifiedCardIds.has(cardId))
            ) {
                if (this.recentlyModifiedFirstCheck) this.recentlyModifiedFirstCheck = false;
                return;
            }
            this.recentlyModifiedCardIds = new Set(cardIds);
            if (this.recentlyModifiedFirstCheck) {
                this.recentlyModifiedFirstCheck = false;
                return;
            }
            await this.options.dictionaryProvider.buildAnkiCache(profile, await this.options.settingsProvider.getAll());
            this.triggerRefresh = true;
            this.statisticsRefreshed = false;
        } catch (e) {
            if (!this.connectionError) {
                asbError('annotations/anki', 'Error checking Anki recently modified cards:', e);
                this.connectionError = true;
            }
            this.anki = undefined;
            this.recentlyModifiedCardIds.clear();
            this.recentlyModifiedFirstCheck = false;
        }
    }

    private async refreshStatistics(profile: string | undefined, fields: string[], decks: string[]) {
        if (!this.options.generateStatistics() || this.statisticsRefreshed) return;
        const startedAt = Date.now();
        try {
            if (!this.anki) throw new Error('Anki not initialized');
            const ankiCardRecords = (await this.options.dictionaryProvider.getRecords(profile, undefined))
                .ankiCardRecords;
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
            this.options.replaceStatisticsSnapshot({
                available: true,
                progress: { current: totalCards, total: totalCards, startedAt },
                cardsInfo,
                cardsStatus,
                dueCards,
            });
            this.statisticsRefreshed = true;
            this.connectionError = false;
        } catch (e) {
            if (!this.connectionError) {
                asbError('annotations/anki', 'Error refreshing Anki for statistics:', e);
                this.connectionError = true;
            }
            this.anki = undefined;
            this.options.replaceStatisticsSnapshot({
                available: false,
                cardsInfo: {},
                cardsStatus: {},
                dueCards: {},
            });
        }
    }
}
