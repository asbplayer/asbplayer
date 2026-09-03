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
    readonly playbackStateChanged: (state: PlaybackState) => void;
    readonly now: () => number;
}

/** Publishes coherent playback snapshots and suppresses them during playback reconciliation. */
export default class PlaybackStateController<T extends IndexedSubtitleModel> {
    private readonly paused: () => boolean;
    private readonly showingSubtitlesAt: (timestampMs: number) => readonly T[];
    private readonly subtitlesVisible: () => boolean;
    private readonly playbackStateChanged: (state: PlaybackState) => void;
    private readonly now: () => number;
    private bindGeneration = 0;
    private lockCount = 0;
    private pendingForce = false;
    private pendingReconcile?: (timestampMs: number) => void;
    private lastNotifiedAt?: number;
    private lastNotifiedState?: {
        readonly paused: boolean;
        readonly showingSubtitleIndexes: readonly number[];
        readonly hiddenSubtitleIndexes: readonly number[];
    };

    constructor({
        paused,
        showingSubtitlesAt,
        subtitlesVisible,
        playbackStateChanged,
        now,
    }: PlaybackStateControllerOptions<T>) {
        this.paused = paused;
        this.showingSubtitlesAt = showingSubtitlesAt;
        this.subtitlesVisible = subtitlesVisible;
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
        const hiddenSubtitleIndexes = this.subtitlesVisible() ? [] : showingSubtitleIndexes;
        const previousState = this.lastNotifiedState;
        const stateChanged =
            previousState === undefined ||
            previousState.paused !== this.paused() ||
            !arrayEquals(previousState.showingSubtitleIndexes, showingSubtitleIndexes) ||
            !arrayEquals(previousState.hiddenSubtitleIndexes, hiddenSubtitleIndexes);
        const now = this.now();
        if (!options.force && !stateChanged && this.lastNotifiedAt !== undefined && now - this.lastNotifiedAt < 1000) {
            return;
        }

        const state: PlaybackState = {
            timestampMs,
            showingSubtitleIndexes,
            ...(hiddenSubtitleIndexes.length ? { hiddenSubtitleIndexes } : {}),
            paused: this.paused(),
        };
        this.lastNotifiedAt = now;
        this.lastNotifiedState = {
            paused: state.paused,
            showingSubtitleIndexes,
            hiddenSubtitleIndexes,
        };
        this.playbackStateChanged(state);
    }
}
