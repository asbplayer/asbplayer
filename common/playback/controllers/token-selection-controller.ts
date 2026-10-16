import type { IndexedSubtitleModel } from '@project/common';
import type { TokenSelectionLocation } from '@project/common/annotations/token-navigation';
import type { PlaybackPlanTokenSelection } from '@project/common/playback/plan/playback-plan';
import { asbTrace } from '@project/common/util/log';

const maximumSelectionAttempts = 13;
const selectionRetryDelayMs = 16;

export interface TokenSelectionControllerCallbacks {
    readonly paused: () => boolean;
    readonly automaticallyPaused: () => boolean;
    readonly subtitlesVisible: () => boolean;
    readonly showingSubtitlesAt: (timestampMs: number) => readonly IndexedSubtitleModel[];
    readonly hideSubtitlesForRepeatAt: (timestampMs: number) => boolean;
    readonly selectToken: (target: Readonly<TokenSelectionLocation>) => boolean;
    readonly clearPauseTokenSelection: () => void;
}

interface PendingSelection {
    readonly target: TokenSelectionLocation;
    readonly timestampMs: number;
    attempts: number;
    timeout?: ReturnType<typeof setTimeout>;
}

/** Selects words for pauses and paused seeks, waiting briefly for their DOM to render. */
export default class TokenSelectionController {
    private plan: PlaybackPlanTokenSelection;
    private readonly callbacks: TokenSelectionControllerCallbacks;
    private pendingSelection?: PendingSelection;

    constructor(plan: PlaybackPlanTokenSelection, callbacks: TokenSelectionControllerCallbacks) {
        this.plan = plan;
        this.callbacks = callbacks;
    }

    replacePlan(plan: PlaybackPlanTokenSelection): void {
        this.cancel();
        this.plan = plan;
    }

    autoPaused(timestampMs: number): void {
        this.selectOnPause(timestampMs, this.plan.onAutoPause ?? this.plan.onPause);
    }

    playbackPaused(timestampMs: number): void {
        if (this.callbacks.automaticallyPaused()) return; // An automatic pause also emits a media pause event, sometimes synchronously.
        this.selectOnPause(timestampMs, this.plan.onPause);
    }

    seekStarted(): void {
        this.cancel();
        this.callbacks.clearPauseTokenSelection();
    }

    seeked(timestampMs: number): void {
        this.seekStarted();
        if (this.callbacks.paused()) this.playbackPaused(timestampMs);
    }

    playbackStarted(): void {
        this.cancel('playback-resumed');
        this.callbacks.clearPauseTokenSelection();
    }

    cancel(reason = 'superseded'): void {
        const selection = this.pendingSelection;
        if (selection) this.finish(selection, 'cancelled', reason);
    }

    private selectOnPause(timestampMs: number, tokenStarts: ReadonlyMap<number, number>): void {
        this.cancel();
        const subtitle = this.callbacks.showingSubtitlesAt(timestampMs).find(({ index }) => tokenStarts.has(index));
        if (!subtitle) return;

        const selection: PendingSelection = {
            target: { subtitleIndex: subtitle.index, tokenStart: tokenStarts.get(subtitle.index)! },
            timestampMs,
            attempts: 0,
        };
        const skipReason = !this.callbacks.subtitlesVisible()
            ? 'subtitles-hidden'
            : this.callbacks.automaticallyPaused() && this.callbacks.hideSubtitlesForRepeatAt(timestampMs)
              ? 'subtitles-hidden-for-repeat'
              : undefined;
        if (skipReason) {
            this.finish(selection, 'skipped', skipReason);
            return;
        }

        this.pendingSelection = selection;
        selection.timeout = setTimeout(() => this.selectWhenRendered(selection), 0);
    }

    private selectWhenRendered(selection: PendingSelection): void {
        if (this.pendingSelection !== selection) return;
        if (!this.callbacks.paused() || !this.callbacks.subtitlesVisible()) {
            this.finish(selection, 'cancelled', this.callbacks.paused() ? 'subtitles-hidden' : 'playback-resumed');
            return;
        }
        selection.attempts++;
        const selected = this.callbacks.selectToken(selection.target);
        if (this.pendingSelection !== selection) return;
        if (selected || selection.attempts >= maximumSelectionAttempts) {
            this.finish(selection, selected ? 'selected' : 'exhausted');
            return;
        }
        selection.timeout = setTimeout(() => this.selectWhenRendered(selection), selectionRetryDelayMs);
    }

    private finish(selection: PendingSelection, outcome: string, reason?: string): void {
        clearTimeout(selection.timeout);
        if (this.pendingSelection === selection) this.pendingSelection = undefined;
        asbTrace('playback/selection', 'Pause token selection finished', {
            ...selection.target,
            attempts: selection.attempts,
            outcome,
            ...(reason === undefined ? {} : { reason }),
            timestampMs: selection.timestampMs,
        });
    }
}
