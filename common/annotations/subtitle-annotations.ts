import { arrayEquals } from '@project/common/util';
import { asbTrace } from '@project/common/util/log';
import type {
    DictionaryBuildAnkiCacheState,
    DictionaryBuildWaniKaniCacheState,
    Fetcher,
    IndexedSubtitleModel,
    Token,
    Tokenization,
    TokenizedSubtitleModel,
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
import type { InternalToken } from '@project/common/annotations/render-annotations';
import { BuildAnnotations } from '@project/common/annotations/build-annotations';
import type { InternalSubtitleModel } from '@project/common/annotations/build-annotations';

const isOriginalToken = (token: Token) => !(token as InternalToken).__internal;

/** Compares only source-provided tokens (positions and readings) without copying them. */
function originalTokenizationsEqual(a: Tokenization | undefined, b: Tokenization | undefined): boolean {
    if (a === b) return true;
    const left = a?.tokens ?? [];
    const right = b?.tokens ?? [];
    let leftIndex = 0;
    let rightIndex = 0;
    while (true) {
        while (leftIndex < left.length && !isOriginalToken(left[leftIndex])) leftIndex++;
        while (rightIndex < right.length && !isOriginalToken(right[rightIndex])) rightIndex++;
        const leftToken = left[leftIndex++];
        const rightToken = right[rightIndex++];
        if (leftToken === undefined || rightToken === undefined) return leftToken === rightToken;
        if (leftToken === rightToken) continue;
        if (!arrayEquals(leftToken.pos, rightToken.pos)) return false;
        if (
            !arrayEquals(
                leftToken.readings,
                rightToken.readings,
                (l, r) => l.reading === r.reading && arrayEquals(l.pos, r.pos)
            )
        ) {
            return false;
        }
    }
}

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

export class SubtitleAnnotations extends SubtitleCollection<IndexedSubtitleModel> {
    private _subtitles: InternalSubtitleModel[] = [];
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
        super({ ...options, returnNextToShow: true });
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

    override setSubtitles(subtitles: TokenizedSubtitleModel[]) {
        const previousSubtitleCount = this._subtitles.length;
        for (const s of subtitles) {
            if (s.originalText === undefined) s.originalText = s.text;
        }
        const shouldReset = needsReset(subtitles, this._subtitles);
        if (!shouldReset) {
            // Preserve the existing tokenization cache here so callers don't need to be aware of it.
            for (const s of subtitles) {
                (s as InternalSubtitleModel).text = this._subtitles[s.index].text;
                s.tokenization = this._subtitles[s.index].tokenization;
                (s as InternalSubtitleModel).__tokenized = this._subtitles[s.index].__tokenized;
            }
        }
        this._subtitles = subtitles.map((s) => ({ ...s })); // Separate internals from react state changes
        super.setSubtitles(this._subtitles);
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
        this.buildAnnotations.setSubtitles(this._subtitles, shouldReset);
        if (shouldReset) void this.buildAnnotations.buildInitial();
    }

    reset() {
        this.setSubtitles([]);
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
        ])
            remove?.();
        this.removeBuildAnkiCacheStateChangeCB = undefined;
        this.removeBuildWaniKaniCacheStateChangeCB = undefined;
        this.removeAnkiCardModifiedCB = undefined;
        this.removeRequestStatisticsSnapshotCB = undefined;
        this.removeRequestStatisticsGenerationCB = undefined;
        if (this.subtitlesInterval) clearInterval(this.subtitlesInterval);
        this.subtitlesInterval = undefined;
    }
}
