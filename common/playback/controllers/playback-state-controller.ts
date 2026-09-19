import type { IndexedSubtitleModel, PlaybackState } from '@project/common';
import { arrayEquals } from '@project/common/util';

export interface PlaybackStateNotificationOptions {
    readonly force: boolean;
}

export interface PlaybackStateLock {
    readonly bindGeneration: number;
}

export interface PlaybackStateControllerOptions<T extends IndexedSubtitleModel> {
    readonly paused: () => boolean;
    readonly showingSubtitlesAt: (timestampMs: number) => readonly T[];
    readonly subtitlesVisible: () => boolean;
    readonly invisibleSubtitlesAt: (timestampMs: number) => readonly T[];
    readonly playbackStateChanged: (state: PlaybackState) => void;
    readonly now: () => number;
}

/** Publishes coherent playback snapshots and suppresses them during playback reconciliation. */
export default class PlaybackStateController<T extends IndexedSubtitleModel> {
    private readonly paused: () => boolean;
    private readonly showingSubtitlesAt: (timestampMs: number) => readonly T[];
    private readonly subtitlesVisible: () => boolean;
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
        showingSubtitlesAt,
        subtitlesVisible,
        invisibleSubtitlesAt,
        playbackStateChanged,
        now,
    }: PlaybackStateControllerOptions<T>) {
        this.paused = paused;
        this.showingSubtitlesAt = showingSubtitlesAt;
        this.subtitlesVisible = subtitlesVisible;
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
        const hiddenSubtitleIndexes =
            !subtitlesVisible && (showingSubtitleIndexes.length || invisibleSubtitleIndexes.length)
                ? [...showingSubtitleIndexes, ...invisibleSubtitleIndexes].sort((left, right) => left - right)
                : undefined;

        const state: PlaybackState = {
            timestampMs,
            showingSubtitleIndexes,
            ...(invisibleSubtitleIndexes.length ? { invisibleSubtitleIndexes } : {}),
            ...(hiddenSubtitleIndexes !== undefined ? { hiddenSubtitleIndexes } : {}),
            paused: this.paused(),
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
