import { v4 as uuid } from 'uuid';
import type { DisplaySubtitleModel, IndexedSubtitleModel, SubtitleModel, Tokenization, Token } from '@project/common';
import { arrayEquals, timeDurationDisplay } from '@project/common/util';

export type SubtitleSourceStatus = 'loading' | 'complete' | 'failed';

export interface SubtitleSourceState {
    readonly track: number;
    readonly loadId: string;
    readonly name: string;
    readonly status: SubtitleSourceStatus;
    readonly error?: string;
}

/** Keeps file names aligned with track slots, including unselected slots. */
export const subtitleSourceNames = (sources: readonly Pick<SubtitleSourceState, 'track' | 'name'>[]): string[] => {
    const names: string[] = [];
    for (const { track, name } of sources) {
        while (names.length <= track) names.push('');
        names[track] = name;
    }
    return names;
};

/** A failed track marks the selection failed; otherwise it is loading until all tracks complete. */
export const subtitleSourceStatus = (sources: readonly SubtitleSourceState[]): SubtitleSourceStatus => {
    if (sources.some((source) => source.status === 'failed')) return 'failed';
    return sources.some((source) => source.status === 'loading') ? 'loading' : 'complete';
};

/**
 * Producers supply parsed, sanitized text and millisecond times on the original timeline, before subtitle offset.
 * cueId is stable within a track/load, unlike the index in the sorted combined snapshot.
 */
export interface SubtitleSourceCue
    extends Pick<SubtitleModel, 'start' | 'end' | 'text' | 'textImage' | 'tokenization'> {
    readonly cueId: number;
}

/**
 * Replaces the entire selected set, preserving load/cue IDs and source data without generated annotations.
 * An empty snapshot clears all tracks.
 */
export interface SubtitleSourceSnapshot {
    readonly tracks: readonly (SubtitleSourceState & { readonly cues: readonly SubtitleSourceCue[] })[];
}

/** Internal, sorted view with indexes and source identity restored for consumers. */
export interface SubtitleStreamSnapshot {
    readonly tracks: readonly SubtitleSourceState[];
    readonly subtitles: readonly IndexedSubtitleModel[];
}

/**
 * Deliver lifecycle updates in order: start (or a baseline snapshot), cue batches, then complete/failed.
 * Batches may contain cues in any order; consumers sort by original start, track, and cue ID.
 * Each track must supply a contiguous timeline prefix after each batch. Resume readiness relies on
 * a later cue establishing coverage of earlier times; sparse ranges are not represented here.
 * Replacement requires a fresh loadId; repeating a cueId corrects that cue within the current load.
 * Completion/failure seals the track and retains received cues. Producers must cancel their own I/O;
 * rejecting stale load IDs only prevents obsolete work from modifying the replacement.
 */
export type SubtitleSourceUpdate =
    | { readonly type: 'start'; readonly track: number; readonly loadId: string; readonly name: string }
    | {
          readonly type: 'cues';
          readonly track: number;
          readonly loadId: string;
          readonly cues: readonly SubtitleSourceCue[];
      }
    | { readonly type: 'complete'; readonly track: number; readonly loadId: string }
    | { readonly type: 'failed'; readonly track: number; readonly loadId: string; readonly error: string }
    | ({ readonly type: 'snapshot' } & SubtitleSourceSnapshot);

/**
 * Starts with a snapshot of the selected tracks, then delivers ordered updates until it settles.
 * The player aborts the signal on replacement or teardown; the producer owns stopping its I/O.
 */
export type SubtitleSourceProducer = (
    update: (update: SubtitleSourceUpdate) => void,
    signal: AbortSignal
) => Promise<void>;

export const subtitleKey = (cue: Pick<SubtitleModel, 'source' | 'index' | 'track'>): string =>
    cue.source ? `${cue.track}:${cue.source.loadId}:${cue.source.cueId}` : `legacy:${cue.index}`;

/** Numeric indexes are accepted from older extensions that do not send cue identities. */
export type SubtitleReference = number | Pick<IndexedSubtitleModel, 'index' | 'track' | 'source'>;

export const resolveSubtitleReference = <T extends IndexedSubtitleModel>(
    subtitles: readonly T[],
    reference: SubtitleReference
): T | undefined => {
    if (typeof reference === 'number') return subtitles[reference];
    if (!reference.source) return subtitles[reference.index];
    const key = subtitleKey(reference);
    return subtitles.find((subtitle) => subtitleKey(subtitle) === key);
};

/** Strip sentence text and annotations before sending mining requests. */
export const subtitleReference = ({
    index,
    track,
    source,
}: Pick<IndexedSubtitleModel, 'index' | 'track' | 'source'>): SubtitleReference => ({
    index,
    track,
    source,
});

export const sameSubtitleText = (a: SubtitleModel, b: SubtitleModel) =>
    (a.originalText ?? a.text) === (b.originalText ?? b.text);

export const indexCuesByKey = <T extends IndexedSubtitleModel>(cues: readonly T[]): Map<string, T> => {
    const byKey = new Map<string, T>();
    for (const cue of cues) byKey.set(subtitleKey(cue), cue);
    return byKey;
};

export interface CuePair<P, N> {
    readonly previous: P;
    readonly next: N;
}

export interface CueDiff<P, N> {
    readonly added: N[];
    readonly retained: CuePair<P, N>[];
    readonly changed: CuePair<P, N>[];
    readonly removedKeys: string[];
}

/** Matches cue identity; each consumer decides which changes invalidate its retained state. */
export const diffCues = <P extends IndexedSubtitleModel, N extends IndexedSubtitleModel>(
    previous: readonly P[],
    next: readonly N[],
    same: (previous: P, next: N) => boolean
): CueDiff<P, N> => {
    const previousByKey = indexCuesByKey(previous);
    const added: N[] = [];
    const retained: CuePair<P, N>[] = [];
    const changed: CuePair<P, N>[] = [];
    for (const cue of next) {
        const key = subtitleKey(cue);
        const old = previousByKey.get(key);
        if (old === undefined) {
            added.push(cue);
        } else {
            (same(old, cue) ? retained : changed).push({ previous: old, next: cue });
            previousByKey.delete(key);
        }
    }
    return { added, retained, changed, removedKeys: [...previousByKey.keys()] };
};

export const sameSubtitleAppearance = (a: SubtitleModel, b: SubtitleModel): boolean =>
    a.text === b.text && a.tokenization === b.tokenization && a.textImage === b.textImage;

const isOriginalToken = (token: Tokenization['tokens'][number]) => !(token as { __internal?: boolean }).__internal;

/** Compares only source-provided tokens (positions and readings) without copying them. */
export function originalTokenizationsEqual(a: Tokenization | undefined, b: Tokenization | undefined): boolean {
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

export const sameSubtitleSourceContent = (a: SubtitleModel, b: SubtitleModel): boolean =>
    sameSubtitleText(a, b) && originalTokenizationsEqual(a.tokenization, b.tokenization);

/** Reconcile asynchronous annotation results by identity and source text, rather than an obsolete array index. */
export const mergeSubtitleAnnotations = <T extends IndexedSubtitleModel>(
    subtitles: readonly T[],
    updates: readonly IndexedSubtitleModel[]
): T[] => {
    const byKey = indexCuesByKey(updates.filter((cue) => cue.source));
    const legacy = new Map(updates.filter((cue) => !cue.source).map((cue) => [cue.index, cue]));
    return subtitles.map((cue) => {
        const update = byKey.get(subtitleKey(cue)) ?? legacy.get(cue.index);
        return update && sameSubtitleSourceContent(cue, update)
            ? {
                  ...cue,
                  text: update.text,
                  originalText: update.originalText ?? cue.originalText,
                  tokenization: update.tokenization,
              }
            : cue;
    });
};

/** Applies source timing to the current offset while retaining annotations on unchanged cues. */
export const displaySubtitleSnapshot = (
    snapshot: SubtitleStreamSnapshot,
    previous: readonly IndexedSubtitleModel[],
    offset: number
): DisplaySubtitleModel[] => {
    const byKey = indexCuesByKey(previous);
    const length = snapshot.subtitles.reduce((end, cue) => Math.max(end, cue.originalEnd + offset), 0);
    return snapshot.subtitles.map((cue, index) => {
        const old = byKey.get(subtitleKey(cue));
        const retained = old && sameSubtitleSourceContent(cue, old) ? old : cue;
        return {
            ...retained,
            ...cue,
            text: retained.text,
            originalText: retained.originalText,
            tokenization:
                retained === cue && retained.tokenization
                    ? {
                          ...retained.tokenization,
                          tokens: retained.tokenization.tokens.map(
                              (token): Token => ({
                                  ...token,
                                  pos: [...token.pos],
                                  states: [...token.states],
                                  readings: token.readings.map((reading) => ({ ...reading, pos: [...reading.pos] })),
                              })
                          ),
                      }
                    : retained.tokenization,
            start: cue.originalStart + offset,
            end: cue.originalEnd + offset,
            index,
            displayTime: timeDurationDisplay(cue.originalStart + offset, length),
            displayEndTime: timeDurationDisplay(cue.originalEnd + offset, length),
        };
    });
};

/** Accumulates identified cues per track and exposes a chronologically sorted snapshot. */
export class SubtitleStream {
    private tracks = new Map<number, { state: SubtitleSourceState; cues: Map<number, IndexedSubtitleModel> }>();

    replace(subtitles: readonly SubtitleModel[], names: readonly string[]): void {
        this.tracks.clear();
        const count = subtitles.reduce((count, cue) => Math.max(count, cue.track + 1), names.length);
        for (let track = 0; track < count; track++) {
            const loadId = subtitles.find((cue) => cue.track === track)?.source?.loadId ?? uuid();
            const cues = new Map<number, IndexedSubtitleModel>();
            for (const cue of subtitles.filter((cue) => cue.track === track)) {
                const cueId = cue.source?.loadId === loadId ? cue.source.cueId : cues.size;
                cues.set(cueId, { ...cue, source: { loadId, cueId }, index: cueId });
            }
            this.tracks.set(track, { state: { track, loadId, name: names[track] ?? '', status: 'complete' }, cues });
        }
    }

    update(update: SubtitleSourceUpdate): boolean {
        if (update.type === 'snapshot') {
            const next = new SubtitleStream();
            const trackIndexes = new Set(update.tracks.map((state) => state.track));
            if (trackIndexes.size !== update.tracks.length) {
                throw new Error('Invalid subtitle snapshot');
            }
            for (const { cues, ...state } of update.tracks) {
                if (!['loading', 'complete', 'failed'].includes(state.status)) {
                    throw new Error('Invalid subtitle status');
                }
                next.update({ type: 'start', ...state });
                next.update({ type: 'cues', track: state.track, loadId: state.loadId, cues });
                if (state.status === 'complete') next.update({ type: 'complete', ...state });
                if (state.status === 'failed') next.update({ type: 'failed', ...state, error: state.error ?? '' });
            }
            this.tracks = next.tracks;
            return true;
        }
        if (!Number.isSafeInteger(update.track) || update.track < 0 || update.track > 2 || !update.loadId) {
            throw new Error('Invalid subtitle source');
        }
        if (update.type === 'start') {
            if (typeof update.name !== 'string') throw new Error('Invalid subtitle name');
            if (this.tracks.get(update.track)?.state.loadId === update.loadId) return false;
            this.tracks.set(update.track, {
                state: { track: update.track, loadId: update.loadId, name: update.name, status: 'loading' },
                cues: new Map(),
            });
            return true;
        }
        const track = this.tracks.get(update.track);
        if (!track || track.state.loadId !== update.loadId || track.state.status !== 'loading') return false;
        if (update.type === 'cues') {
            const cues = update.cues.map((cue): [number, IndexedSubtitleModel] => {
                if (
                    !Number.isSafeInteger(cue.cueId) ||
                    cue.cueId < 0 ||
                    !Number.isFinite(cue.start) ||
                    !Number.isFinite(cue.end) ||
                    cue.end < cue.start ||
                    typeof cue.text !== 'string'
                ) {
                    throw new Error('Invalid subtitle cue');
                }
                return [
                    cue.cueId,
                    {
                        start: cue.start,
                        end: cue.end,
                        tokenization: cue.tokenization,
                        textImage: cue.textImage,
                        source: { loadId: update.loadId, cueId: cue.cueId },
                        text: cue.text,
                        originalStart: cue.start,
                        originalEnd: cue.end,
                        track: update.track,
                        index: 0,
                    },
                ];
            });
            for (const [id, cue] of cues) track.cues.set(id, cue);
        } else {
            if (update.type !== 'complete' && update.type !== 'failed') throw new Error('Invalid subtitle update');
            if (update.type === 'failed' && typeof update.error !== 'string') throw new Error('Invalid subtitle error');
            track.state = {
                ...track.state,
                status: update.type === 'complete' ? 'complete' : 'failed',
                ...(update.type === 'failed' ? { error: update.error } : {}),
            };
        }
        return true;
    }

    get sourceStates(): readonly SubtitleSourceState[] {
        return [...this.tracks.values()].map(({ state }) => state).sort((a, b) => a.track - b.track);
    }

    get sourceSnapshot(): SubtitleSourceSnapshot {
        return {
            tracks: [...this.tracks.values()]
                .sort((a, b) => a.state.track - b.state.track)
                .map(({ state, cues }) => ({
                    ...state,
                    cues: Array.from(cues, ([cueId, cue]) => ({
                        cueId,
                        start: cue.originalStart,
                        end: cue.originalEnd,
                        text: cue.text,
                        textImage: cue.textImage,
                        tokenization: cue.tokenization,
                    })),
                })),
        };
    }

    get snapshot(): SubtitleStreamSnapshot {
        const tracks = [...this.tracks.values()].sort((a, b) => a.state.track - b.state.track);
        const subtitles = tracks
            .flatMap((track) => [...track.cues.values()])
            .sort((a, b) => a.originalStart - b.originalStart || a.track - b.track || a.source!.cueId - b.source!.cueId)
            .map((cue, index) => (cue.index === index ? cue : { ...cue, index }));
        return { tracks: this.sourceStates, subtitles };
    }
}
