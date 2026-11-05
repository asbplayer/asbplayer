import type { IndexedSubtitleModel, PlaybackState } from '@project/common';
import { arrayEquals } from '@project/common/util';
import { asbTrace } from '@project/common/util/log';

export interface PlaybackStateNotificationOptions {
    readonly force: boolean;
}

export interface PlaybackStateLock {
    readonly bindGeneration: number;
}

export interface PlaybackStateControllerOptions<T extends IndexedSubtitleModel> {
    readonly paused: () => boolean;
    readonly automaticallyPaused: () => boolean;
    readonly showingSubtitlesAt: (timestampMs: number) => readonly T[];
    readonly subtitlesVisible: () => boolean;
    readonly hiddenSubtitleIndexesAt: (timestampMs: number) => readonly number[];
    readonly hideSubtitlesForRepeatAt: (timestampMs: number) => boolean;
    readonly invisibleSubtitlesAt: (timestampMs: number) => readonly T[];
    readonly playbackStateChanged: (state: PlaybackState) => void;
    readonly now: () => number;
}

/** Publishes coherent playback snapshots and suppresses them during playback reconciliation. */
export default class PlaybackStateController<T extends IndexedSubtitleModel> {
    private readonly paused: () => boolean;
    private readonly automaticallyPaused: () => boolean;
    private readonly showingSubtitlesAt: (timestampMs: number) => readonly T[];
    private readonly subtitlesVisible: () => boolean;
    private readonly hiddenSubtitleIndexesAt: (timestampMs: number) => readonly number[];
    private readonly hideSubtitlesForRepeatAt: (timestampMs: number) => boolean;
    private readonly invisibleSubtitlesAt: (timestampMs: number) => readonly T[];
    private readonly playbackStateChanged: (state: PlaybackState) => void;
    private readonly now: () => number;
    private bindGeneration = 0;
    private lockCount = 0;
    private pendingForce = false;
    private pendingReconcile?: (timestampMs: number) => void;
    private lastNotifiedAt?: number;
    private lastNotifiedState?: PlaybackState;

    constructor({
        paused,
        automaticallyPaused,
        showingSubtitlesAt,
        subtitlesVisible,
        hiddenSubtitleIndexesAt,
        hideSubtitlesForRepeatAt,
        invisibleSubtitlesAt,
        playbackStateChanged,
        now,
    }: PlaybackStateControllerOptions<T>) {
        this.paused = paused;
        this.automaticallyPaused = automaticallyPaused;
        this.showingSubtitlesAt = showingSubtitlesAt;
        this.subtitlesVisible = subtitlesVisible;
        this.hiddenSubtitleIndexesAt = hiddenSubtitleIndexesAt;
        this.hideSubtitlesForRepeatAt = hideSubtitlesForRepeatAt;
        this.invisibleSubtitlesAt = invisibleSubtitlesAt;
        this.playbackStateChanged = playbackStateChanged;
        this.now = now;
    }

    bind(): void {
        this.bindGeneration++;
        this.lockCount = 0;
        this.lastNotifiedAt = undefined;
        this.lastNotifiedState = undefined;
        this.pendingForce = false;
        this.pendingReconcile = undefined;
        asbTrace('playback/state', 'Bound playback state controller', { bindGeneration: this.bindGeneration });
    }

    lock(): PlaybackStateLock {
        this.lockCount++;
        return { bindGeneration: this.bindGeneration };
    }

    unlockAndNotify(lock: PlaybackStateLock, timestampMs: number, options: PlaybackStateNotificationOptions): void {
        if (lock.bindGeneration !== this.bindGeneration) return;
        if (this.lockCount === 0) throw new Error('Cannot unlock an unlocked PlaybackStateController');
        this.lockCount--;
        if (this.lockCount > 0) {
            if (options.force) this.pendingForce = true;
            return;
        }
        const force = options.force || this.pendingForce;
        this.pendingForce = false;
        const reconcile = this.pendingReconcile;
        this.pendingReconcile = undefined;
        reconcile?.(timestampMs);
        this.notify(timestampMs, { force });
    }

    reconcileAndNotify(
        timestampMs: number,
        reconcile: (timestampMs: number) => void,
        options: PlaybackStateNotificationOptions
    ): void {
        if (this.lockCount > 0) {
            this.pendingReconcile = reconcile;
            if (options.force) this.pendingForce = true;
            return;
        }
        reconcile(timestampMs);
        this.notify(timestampMs, options);
    }

    notify(timestampMs: number, options: PlaybackStateNotificationOptions): void {
        if (this.lockCount > 0) {
            if (options.force) this.pendingForce = true;
            return;
        }

        const showingSubtitleIndexes = this.showingSubtitlesAt(timestampMs).map(({ index }) => index);
        const invisibleSubtitleIndexes = this.invisibleSubtitlesAt(timestampMs).map(({ index }) => index);
        const subtitlesVisible = this.subtitlesVisible();
        const paused = this.paused();
        const hiddenSubtitleIndexes =
            paused && !this.automaticallyPaused()
                ? []
                : this.hideSubtitlesForRepeatAt(timestampMs) || !subtitlesVisible
                  ? [...showingSubtitleIndexes, ...invisibleSubtitleIndexes].sort((left, right) => left - right)
                  : paused
                    ? []
                    : this.hiddenSubtitleIndexesAt(timestampMs);

        const state: PlaybackState = {
            timestampMs,
            showingSubtitleIndexes,
            ...(invisibleSubtitleIndexes.length ? { invisibleSubtitleIndexes } : {}),
            ...(hiddenSubtitleIndexes.length ? { hiddenSubtitleIndexes } : {}),
            paused,
        };
        const previousState = this.lastNotifiedState;
        const stateChanged =
            previousState === undefined ||
            previousState.paused !== state.paused ||
            !arrayEquals(previousState.showingSubtitleIndexes, state.showingSubtitleIndexes) ||
            !arrayEquals(previousState.invisibleSubtitleIndexes, state.invisibleSubtitleIndexes) ||
            !arrayEquals(previousState.hiddenSubtitleIndexes, state.hiddenSubtitleIndexes);
        const now = this.now();
        if (!options.force && !stateChanged && this.lastNotifiedAt !== undefined && now - this.lastNotifiedAt < 1000) {
            return;
        }

        this.lastNotifiedAt = now;
        this.lastNotifiedState = state;
        this.playbackStateChanged(state);
    }
}
