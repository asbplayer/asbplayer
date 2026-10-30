import type { IndexedSubtitleModel } from '@project/common';
import type { TokenSelectionLocation } from '@project/common/annotations/token-navigation';
import type { SelectTokenInRootOptions } from '@project/common/annotations';
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
    readonly selectToken: (
        target: Readonly<TokenSelectionLocation>,
        options?: Pick<SelectTokenInRootOptions, 'onlyIfUnselected'>
    ) => boolean;
    readonly clearPauseTokenSelection: () => void;
}

interface PendingSelection {
    readonly targets: readonly TokenSelectionLocation[];
    readonly onlyIfUnselected: boolean;
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

    reevaluatePausedSelection(timestampMs: number): void {
        if (this.callbacks.paused()) {
            this.selectOnPause(
                timestampMs,
                this.callbacks.automaticallyPaused() ? (this.plan.onAutoPause ?? this.plan.onPause) : this.plan.onPause,
                true
            );
        }
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

    private selectOnPause(
        timestampMs: number,
        tokenStarts: ReadonlyMap<number, number>,
        onlyIfUnselected = false
    ): void {
        this.cancel();
        const targets = this.callbacks
            .showingSubtitlesAt(timestampMs)
            .filter(({ index }) => tokenStarts.has(index))
            .map(({ index }) => ({ subtitleIndex: index, tokenStart: tokenStarts.get(index)! }));
        if (!targets.length) return;

        const selection: PendingSelection = {
            targets,
            onlyIfUnselected,
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
        for (const target of selection.targets) {
            const selected = this.callbacks.selectToken(target, {
                onlyIfUnselected: selection.onlyIfUnselected,
            });
            if (this.pendingSelection !== selection) return;
            if (selected) {
                this.finish(selection, 'selected', undefined, target);
                return;
            }
        }
        if (selection.attempts >= maximumSelectionAttempts) {
            this.finish(selection, 'exhausted');
            return;
        }
        selection.timeout = setTimeout(() => this.selectWhenRendered(selection), selectionRetryDelayMs);
    }

    private finish(selection: PendingSelection, outcome: string, reason?: string, target = selection.targets[0]): void {
        clearTimeout(selection.timeout);
        if (this.pendingSelection === selection) this.pendingSelection = undefined;
        asbTrace('playback/selection', 'Pause token selection finished', {
            ...target,
            attempts: selection.attempts,
            outcome,
            ...(reason === undefined ? {} : { reason }),
            timestampMs: selection.timestampMs,
        });
    }
}
