import {
    diffCues,
    indexCuesByKey,
    subtitleKey,
    sameSubtitleSourceContent,
    originalTokenizationsEqual,
} from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceState } from '@project/common/subtitle-reader/subtitle-stream';
import { asbTrace } from '@project/common/util/log';
import { areTokenizationsEqual } from '@project/common/util';
import type { InternalToken } from '@project/common/annotations/render-annotations';
import type {
    DictionaryBuildAnkiCacheState,
    DictionaryBuildWaniKaniCacheState,
    Fetcher,
    IndexedSubtitleModel,
    TokenizedSubtitleModel,
    Tokenization,
} from '@project/common';
import type {
    ApplyStrategy,
    AsbplayerSettings,
    DictionaryTrack,
    SettingsProvider,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import type { DictionaryProvider } from '@project/common/dictionary-db';
import type { SubtitleCollectionOptions } from '@project/common/subtitle-collection';
import { SubtitleCollection } from '@project/common/subtitle-collection';
import { BuildAnnotations } from '@project/common/annotations/build-annotations';
import type { InternalSubtitleModel } from '@project/common/annotations/build-annotations';

export function needsReset(subtitles: TokenizedSubtitleModel[], previousSubtitles: TokenizedSubtitleModel[]) {
    return (
        subtitles.length !== previousSubtitles.length ||
        subtitles.some((s) => {
            const prev = previousSubtitles[s.index];
            if (prev === undefined) return true;
            if (s === prev) return false;
            if ((s.originalText ?? s.text) !== (prev.originalText ?? prev.text)) return true;
            return !originalTokenizationsEqual(s.tokenization, prev.tokenization);
        })
    );
}

const annotationTokenizationsEqual = (a: Tokenization | undefined, b: Tokenization | undefined): boolean => {
    if (!areTokenizationsEqual(a, b)) return false;
    if (a === b || !a || !b) return true;
    return a.tokens.every((token: InternalToken, index) => {
        const other: InternalToken = b.tokens[index];
        return token.__internal === other.__internal && token.__usingExternalReadings === other.__usingExternalReadings;
    });
};

/** UI snapshots must not share mutable token data with the annotation builder. */
const copyTokenization = (tokenization: Tokenization | undefined): Tokenization | undefined =>
    tokenization && {
        ...tokenization,
        tokens: tokenization.tokens.map((token) => ({
            ...token,
            pos: [...token.pos],
            states: [...token.states],
            readings: token.readings.map((reading) => ({ ...reading, pos: [...reading.pos] })),
            externalCandidateStatuses: token.externalCandidateStatuses?.map((status) => ({
                ...status,
                waniKani: status.waniKani && { ...status.waniKani },
            })),
        })),
    };

/** Reconcile annotation results by source identity and retain references when nothing changed. */
export function mergeSubtitleAnnotations<T extends IndexedSubtitleModel>(
    subtitles: T[],
    updates: readonly IndexedSubtitleModel[]
): T[];
export function mergeSubtitleAnnotations<T extends IndexedSubtitleModel>(
    subtitles: readonly T[],
    updates: readonly IndexedSubtitleModel[]
): readonly T[];
export function mergeSubtitleAnnotations<T extends IndexedSubtitleModel>(
    subtitles: readonly T[],
    updates: readonly IndexedSubtitleModel[]
): readonly T[] {
    if (!subtitles.length || !updates.length) return subtitles;
    const byKey = indexCuesByKey(updates.filter((cue) => cue.source));
    const legacy = new Map(updates.filter((cue) => !cue.source).map((cue) => [cue.index, cue]));
    let merged: T[] | undefined;
    for (const [index, cue] of subtitles.entries()) {
        const update = cue.source ? byKey.get(subtitleKey(cue)) : legacy.get(cue.index);
        if (!update || !sameSubtitleSourceContent(cue, update)) continue;
        const originalText = update.originalText ?? cue.originalText;
        const sameTokenization = annotationTokenizationsEqual(cue.tokenization, update.tokenization);
        if (cue.text === update.text && cue.originalText === originalText && sameTokenization) continue;
        merged ??= subtitles.slice();
        merged[index] = {
            ...cue,
            text: update.text,
            originalText,
            tokenization: sameTokenization ? cue.tokenization : copyTokenization(update.tokenization),
        };
    }
    return merged ?? subtitles;
}

export class SubtitleAnnotations {
    private _subtitles: InternalSubtitleModel[] = [];
    private readonly collection: SubtitleCollection<IndexedSubtitleModel>;
    private readonly dictionaryProvider: DictionaryProvider;
    private readonly buildAnnotations: BuildAnnotations;
    private subtitlesInterval?: ReturnType<typeof setInterval>;
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
        subtitleAnnotationsUpdated: (
            updatedSubtitles: readonly IndexedSubtitleModel[],
            dt: readonly DictionaryTrack[]
        ) => void,
        getMediaTimeMs?: () => number,
        fetcher?: Fetcher
    ) {
        this.collection = new SubtitleCollection({ ...options, returnNextToShow: true });
        this.dictionaryProvider = dictionaryProvider;
        this.buildAnnotations = new BuildAnnotations({
            dictionaryProvider,
            settingsProvider,
            mediaId,
            subtitlesAt: (timestamp) => this.subtitlesAt(timestamp),
            subtitleAnnotationsUpdated,
            getMediaTimeMs,
            fetcher,
        });
    }

    get subtitles() {
        return this._subtitles;
    }

    subtitlesAt(timestamp: number) {
        return this.collection.subtitlesAt(timestamp);
    }

    subtitlesIn(startTimestamp: number, endTimestamp: number) {
        return this.collection.subtitlesIn(startTimestamp, endTimestamp);
    }

    setSubtitles(subtitles: TokenizedSubtitleModel[], sources: readonly SubtitleSourceState[]) {
        const previousSubtitleCount = this._subtitles.length;
        for (const s of subtitles) {
            if (s.originalText === undefined) s.originalText = s.text;
        }
        const diff = diffCues(this._subtitles, subtitles, sameSubtitleSourceContent);
        const identified = subtitles.length > 0 && subtitles.every((cue) => cue.source !== undefined);
        const continuation = identified && (diff.retained.length > 0 || diff.changed.length > 0);
        const shouldReset = identified ? !continuation : needsReset(subtitles, this._subtitles);
        if (!shouldReset) {
            for (const { previous, next } of diff.retained) {
                (next as InternalSubtitleModel).text = previous.text;
                next.tokenization = previous.tokenization;
                (next as InternalSubtitleModel).__tokenized = previous.__tokenized;
            }
        }
        this._subtitles = subtitles.map((s) => ({ ...s })); // Separate internals from react state changes
        this.collection.setSubtitles(this._subtitles);
        asbTrace('annotations/subtitles', 'Subtitle collection updated', {
            previousSubtitleCount,
            subtitleCount: subtitles.length,
            trackCount: new Set(subtitles.map((subtitle) => subtitle.track)).size,
            shouldReset,
        });
        if (shouldReset) {
            asbTrace('annotations/subtitles', 'Resetting annotation cache for new subtitle source', {
                subtitleCount: this._subtitles.length,
            });
        }
        this.buildAnnotations.setSubtitles(this._subtitles, { shouldReset, sources });
        if (shouldReset) void this.buildAnnotations.buildInitial();
    }

    reset() {
        this.setSubtitles([], []);
    }

    profileChanged(settings?: AsbplayerSettings): void {
        this.buildAnnotations.profileChanged(settings);
    }

    settingsUpdated(settings: AsbplayerSettings, options: { readonly force: boolean } = { force: false }): void {
        this.buildAnnotations.updateSettings(settings, options);
    }

    tokensWereModified(modifiedTokens: string[]) {
        this.buildAnnotations.tokensWereModified(modifiedTokens);
    }

    buildAnkiCacheStateChange(state: DictionaryBuildAnkiCacheState) {
        this.buildAnnotations.buildAnkiCacheStateChange(state);
    }

    buildWaniKaniCacheStateChange(state: DictionaryBuildWaniKaniCacheState) {
        this.buildAnnotations.buildWaniKaniCacheStateChange(state);
    }

    ankiCardWasModified() {
        this.buildAnnotations.ankiCardWasModified();
    }

    saveTokenLocal(
        track: number,
        token: string,
        status: TokenStatus | null,
        states: TokenState[],
        applyStates: ApplyStrategy
    ): Promise<void> {
        return this.buildAnnotations.saveTokenLocal(track, token, status, states, applyStates);
    }

    requestStatisticsGeneration() {
        this.buildAnnotations.requestStatisticsGeneration();
    }

    bind() {
        asbTrace('annotations/lifecycle', 'Binding annotation pipeline');
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
        this.removeRequestStatisticsSnapshotCB = this.dictionaryProvider.onRequestStatisticsSnapshot(() =>
            this.buildAnnotations.publishStatisticsSnapshot()
        );
        if (this.removeRequestStatisticsGenerationCB) this.removeRequestStatisticsGenerationCB();
        this.removeRequestStatisticsGenerationCB = this.dictionaryProvider.onRequestStatisticsGeneration(() =>
            this.requestStatisticsGeneration()
        );
        this.subtitlesInterval = setInterval(() => void this.buildAnnotations.refresh(), 100);
    }

    unbind() {
        asbTrace('annotations/lifecycle', 'Unbinding annotation pipeline');
        this.reset();
        for (const remove of [
            this.removeBuildAnkiCacheStateChangeCB,
            this.removeBuildWaniKaniCacheStateChangeCB,
            this.removeAnkiCardModifiedCB,
            this.removeRequestStatisticsSnapshotCB,
            this.removeRequestStatisticsGenerationCB,
        ]) {
            remove?.();
        }
        this.removeBuildAnkiCacheStateChangeCB = undefined;
        this.removeBuildWaniKaniCacheStateChangeCB = undefined;
        this.removeAnkiCardModifiedCB = undefined;
        this.removeRequestStatisticsSnapshotCB = undefined;
        this.removeRequestStatisticsGenerationCB = undefined;
        if (this.subtitlesInterval) clearInterval(this.subtitlesInterval);
        this.subtitlesInterval = undefined;
    }
}
