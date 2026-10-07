import { asbError, asbTrace, asbWarn } from '@project/common/util/log';
import type { DictionaryBuildWaniKaniCacheState, DictionaryBuildWaniKaniCacheStateError } from '@project/common';
import { DictionaryBuildWaniKaniCacheStateErrorCode, DictionaryBuildWaniKaniCacheStateType } from '@project/common';
import type { DictionaryTrack } from '@project/common/settings';
import { dictionaryStatusCollectionEnabled } from '@project/common/settings';
import type { DictionaryProvider } from '@project/common/dictionary-db';
import type {
    DictionaryStatisticsWaniKaniSnapshot,
    DictionaryStatisticsWaniKaniSnapshots,
} from '@project/common/dictionary-statistics';

const WANIKANI_REFRESH_INTERVAL = 10000; // Only until the first successful refresh since users can't mine to it and it's an external server

export interface WaniKaniAnnotationsOptions {
    dictionaryProvider: DictionaryProvider;
    getProfile: () => string | undefined | null;
    getTracks: () => readonly { track: number; dt: DictionaryTrack }[];
    generateStatistics: () => boolean | undefined;
    tokensWereModified: (tokens: string[]) => void;
    replaceStatisticsSnapshots: (snapshots: DictionaryStatisticsWaniKaniSnapshots) => void;
}

export class WaniKaniAnnotations {
    private readonly options: WaniKaniAnnotationsOptions;
    private refreshing = false;
    private refreshed = false;
    private lastRefresh = Date.now();
    private triggerRefresh = false;
    private statisticsRefreshed = false;

    constructor(options: WaniKaniAnnotationsOptions) {
        this.options = options;
    }

    reset(): void {
        this.refreshed = false;
        this.lastRefresh = Date.now();
        this.triggerRefresh = false;
        this.statisticsRefreshed = false;
    }

    requestRefresh(): void {
        this.triggerRefresh = true;
    }

    cacheStateChanged(state: DictionaryBuildWaniKaniCacheState): void {
        const modifiedTokens = state.body.modifiedTokens ?? [];
        asbTrace('annotations/wanikani', 'WaniKani cache state changed', {
            modifiedTokenCount: modifiedTokens.length,
            type: state.type,
        });
        this.options.tokensWereModified(modifiedTokens);
        if (state.type === DictionaryBuildWaniKaniCacheStateType.error) {
            const body = state.body as DictionaryBuildWaniKaniCacheStateError;
            if (
                body?.code === DictionaryBuildWaniKaniCacheStateErrorCode.invalidWaniKaniToken ||
                body?.code === DictionaryBuildWaniKaniCacheStateErrorCode.noYomitan
            ) {
                this.statisticsRefreshed = false;
            }
            asbError(
                'annotations/wanikani',
                `Dictionary WaniKani cache build error (${body.code} - ${body.msg}): ${JSON.stringify(body.data ?? {})}`
            );
        } else if (state.type === DictionaryBuildWaniKaniCacheStateType.stats) {
            this.statisticsRefreshed = false;
        }
    }

    refreshIfDue(): void {
        if ((this.triggerRefresh || Date.now() - this.lastRefresh >= WANIKANI_REFRESH_INTERVAL) && !this.refreshing) {
            void this.refresh();
            this.lastRefresh = Date.now();
            this.triggerRefresh = false;
        }
    }

    async refresh(): Promise<void> {
        const profile = this.options.getProfile();
        if (profile === null || !this.options.getTracks().length || this.refreshing) return;
        const startedAt = Date.now();
        asbTrace('annotations/wanikani', 'Starting WaniKani refresh', {
            generateStatistics: this.options.generateStatistics() === true,
            trackCount: this.options.getTracks().length,
        });
        try {
            this.refreshing = true;
            const hasWaniKaniTrack = this.options
                .getTracks()
                .some(
                    (ts) =>
                        dictionaryStatusCollectionEnabled(ts.dt, { includeStates: false }) &&
                        ts.dt.dictionaryWaniKaniApiToken.trim()
                );
            if (!hasWaniKaniTrack) return;
            if (!this.refreshed) {
                await this.options.dictionaryProvider.buildWaniKaniCache(profile); // Don't need to poll on tokensModified since users can't mine to it unlike Anki
                this.refreshed = true;
            }
            await this.refreshStatistics(profile);
        } catch (e) {
            this.refreshed = false;
            asbWarn('annotations/wanikani', 'WaniKani refresh failed:', e);
        } finally {
            this.refreshing = false;
            asbTrace('annotations/wanikani', 'Finished WaniKani refresh', {
                durationMs: Date.now() - startedAt,
                refreshed: this.refreshed,
                statisticsRefreshed: this.statisticsRefreshed,
            });
        }
    }

    private async refreshStatistics(profile: string | undefined): Promise<void> {
        if (!this.options.generateStatistics() || this.statisticsRefreshed) return;
        const waniKaniSnapshots: Record<number, DictionaryStatisticsWaniKaniSnapshot> = {};
        for (const ts of this.options.getTracks()) {
            if (!dictionaryStatusCollectionEnabled(ts.dt, { includeStates: false })) continue;
            try {
                const records = await this.options.dictionaryProvider.getRecords(profile, ts.track);
                waniKaniSnapshots[ts.track] = {
                    available: true,
                    assignments: Object.values(records.waniKaniAssignmentRecords?.[ts.track] ?? {}),
                    subjects: records.waniKaniSubjectRecords?.[ts.track] ?? {},
                };
            } catch (e) {
                asbError('annotations/wanikani', `Error refreshing WaniKani for Track${ts.track + 1} statistics:`, e);
                waniKaniSnapshots[ts.track] = { available: false, assignments: [], subjects: {} };
            }
        }
        this.statisticsRefreshed = true;
        if (Object.keys(waniKaniSnapshots).length) this.options.replaceStatisticsSnapshots(waniKaniSnapshots);
    }
}
