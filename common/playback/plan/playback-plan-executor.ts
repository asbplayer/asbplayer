import type { IndexedSubtitleModel } from '@project/common';
import PlaybackTimeline, {
    type PlaybackTimelineBlock,
    type PlaybackTimelineEvent,
    type PlaybackTimelineSegment,
    type PlaybackTimelineState,
} from '@project/common/playback/timeline/playback-timeline';
import {
    type PlaybackPlan,
    fastForwardingForPlanState,
    timestampComparisonToleranceMs,
} from '@project/common/playback/plan/playback-plan';
import PlaybackTimelineRunner from '@project/common/playback/timeline/playback-timeline-runner';
import PlaybackTimelineLookaheadCursor from '@project/common/playback/timeline/playback-timeline-lookahead-cursor';
import { areSubtitleModelsEqual, arrayEquals } from '@project/common/util';

type PlaybackTimelineTransitionCause = 'user-seek' | 'internal-seek';

export interface PlaybackPlanExecutorCallbacks<T extends IndexedSubtitleModel> {
    readonly play: () => Promise<void>;
    readonly paused: () => boolean;
    readonly pause: () => void;
    readonly seek: (timestampMs: number) => Promise<void>;
    readonly setPlaybackRate: (playbackRate: number) => void;
    readonly correctAutoPause: (timestampMs: number) => Promise<{ readonly seekIssued: boolean }>;
    readonly showingSubtitlesChanged: (subtitles: readonly T[]) => void;
}

type RepeatedBlock = {
    readonly id: string;
    repeats: number;
};

type PendingTarget = {
    readonly timestampMs: number;
    readonly blockId?: string;
};

type StartPauseSuppression = {
    readonly blockId: string;
};

/**
 * Represents an expected discontinuity in the playback timeline such as internal
 * seek operations from repeat, condensed, or auto pause corrections.
 */
type ExpectedDiscontinuity = {
    readonly timestampMs: number;
    readonly includeAtTimestamp: boolean;
};

type DeferredDiscontinuity = {
    readonly timestampMs: number;
    readonly cause: PlaybackTimelineTransitionCause;
    readonly includeAtTimestamp: boolean;
};

type PlaybackRateReconciliationOptions = {
    readonly forcePlaybackRate: boolean;
};

const sameSubtitles = <T extends IndexedSubtitleModel>(left: readonly T[], right: readonly T[]): boolean =>
    arrayEquals(left, right, areSubtitleModelsEqual);

/**
 * Executes an already-resolved playback plan against a media adapter.
 */
export default class PlaybackPlanExecutor<T extends IndexedSubtitleModel> {
    private plan: PlaybackPlan<T>;
    private timeline: PlaybackTimeline<T>;
    private readonly runner: PlaybackTimelineRunner<T>;
    private readonly lookaheadCursor: PlaybackTimelineLookaheadCursor<T>;
    private readonly callbacks: PlaybackPlanExecutorCallbacks<T>;
    private repeatedBlock?: RepeatedBlock;
    private pendingTarget?: PendingTarget;
    private startPauseSuppression?: StartPauseSuppression;
    private condensedOperation?: number;
    private operationGeneration = 0;
    private updateOperationGeneration = 0;
    private showingSubtitles: readonly T[] = [];
    private _isFastForwarding: boolean;
    private expectedDiscontinuity?: ExpectedDiscontinuity;
    private updateInProgress = false;
    private deferredDiscontinuity?: DeferredDiscontinuity;

    constructor(plan: PlaybackPlan<T>, timestampMs: number, callbacks: PlaybackPlanExecutorCallbacks<T>) {
        this.plan = plan;
        this._isFastForwarding = false;
        this.timeline = PlaybackTimeline.fromSubtitles(plan.timelineSubtitles);
        this.callbacks = callbacks;
        this.runner = new PlaybackTimelineRunner(this.timeline, timestampMs, {
            onStart: (event) => this.onStart(event),
            onEnd: (event, options) => this.onEnd(event, options),
            correctAutoPause: async (targetTimestampMs) => {
                await this.correctAutoPause(targetTimestampMs);
            },
            onState: async (state, segment) => {
                this.reconcilePersistentState(state, segment, { forcePlaybackRate: false });
            },
            onAfterState: (currentTimestampMs) => this.onAfterState(currentTimestampMs),
        });
        this.lookaheadCursor = new PlaybackTimelineLookaheadCursor(this.timeline, timestampMs);
        this.showingSubtitles = this.timeline.showingSubtitlesAt(timestampMs);
        if (this.showingSubtitles.length) this.callbacks.showingSubtitlesChanged(this.showingSubtitles);
    }

    get isFastForwarding(): boolean {
        return this._isFastForwarding;
    }

    showingSubtitlesAt(timestampMs: number): readonly T[] {
        return this.timeline.showingSubtitlesAt(timestampMs);
    }

    replacePlan(plan: PlaybackPlan<T>, timestampMs: number): void {
        this.invalidatePendingOperations({ preserveExpectedDiscontinuity: true });
        const playbackRateChanged =
            this.plan.playbackRate !== plan.playbackRate ||
            this.plan.fastForward?.playbackRate !== plan.fastForward?.playbackRate;
        const resetPlaybackRate =
            (this.plan.fastForward !== undefined && plan.fastForward === undefined) ||
            (this.plan.playbackRate !== plan.playbackRate && plan.fastForward === undefined);
        this.plan = plan;
        this.timeline = PlaybackTimeline.fromSubtitles(plan.timelineSubtitles);
        this.runner.replaceTimeline(this.timeline, timestampMs);
        this.lookaheadCursor.replaceTimeline(this.timeline, timestampMs);
        this.pendingTarget = undefined;

        const repeatedBlockId = this.repeatedBlock?.id;
        const repeatedPlanBlock = repeatedBlockId === undefined ? undefined : this.timeline.blockById(repeatedBlockId);
        if (repeatedBlockId !== undefined && repeatedPlanBlock?.endAction?.repeat === undefined) {
            this.repeatedBlock = undefined;
        }
        const suppressedBlockId = this.startPauseSuppression?.blockId;
        const suppressedPlanBlock =
            suppressedBlockId === undefined ? undefined : this.timeline.blockById(suppressedBlockId);
        if (
            suppressedBlockId !== undefined &&
            (suppressedPlanBlock?.startAction === undefined || suppressedPlanBlock.endAction?.pause !== true)
        ) {
            this.startPauseSuppression = undefined;
        }
        if (resetPlaybackRate) {
            this.callbacks.setPlaybackRate(plan.playbackRate);
            this._isFastForwarding = false;
        }
        this.reconcileAt(timestampMs, { forcePlaybackRate: playbackRateChanged && !resetPlaybackRate });
    }

    async update(timestampMs: number, options: { lookaheadTimestampMs?: number }): Promise<void> {
        this.updateOperationGeneration = this.operationGeneration;
        this.updateInProgress = true;
        try {
            await this.runner.update(this.nextPlaybackActionTimestamp(timestampMs, options.lookaheadTimestampMs));
        } finally {
            this.updateInProgress = false;
            const deferredDiscontinuity = this.deferredDiscontinuity;
            this.deferredDiscontinuity = undefined;
            if (deferredDiscontinuity !== undefined) {
                this.reset(deferredDiscontinuity.timestampMs, {
                    includeAtTimestamp: deferredDiscontinuity.includeAtTimestamp,
                    cause: deferredDiscontinuity.cause,
                });
            }
        }
    }

    reset(timestampMs: number, options: { includeAtTimestamp: boolean; cause: PlaybackTimelineTransitionCause }): void {
        if (options.cause === 'user-seek') {
            this.cancelPendingOperations({ preserveExpectedDiscontinuity: false });
            this.pendingTarget = undefined;
            this.repeatedBlock = undefined;
            this.startPauseSuppression = undefined;
        }
        this.runner.reset(timestampMs, {
            includeAtTimestamp: options.cause === 'user-seek' ? false : options.includeAtTimestamp,
        });
        this.lookaheadCursor.reset(timestampMs);
        this.reconcileAt(timestampMs, { forcePlaybackRate: false });
    }

    initializePlaybackRate(timestampMs: number): void {
        this.reconcilePlaybackRate(this.timeline.lookupAt(timestampMs).state, { forcePlaybackRate: true });
    }

    cancelPendingOperations(options: { preserveExpectedDiscontinuity: boolean }): void {
        if (options.preserveExpectedDiscontinuity && this.expectedDiscontinuity !== undefined) return;
        this.invalidatePendingOperations(options);
    }

    private invalidatePendingOperations(options: { preserveExpectedDiscontinuity: boolean }): void {
        this.operationGeneration++;
        this.condensedOperation = undefined;
        if (!options.preserveExpectedDiscontinuity) this.expectedDiscontinuity = undefined;
    }

    handleDiscontinuity(timestampMs: number): void {
        const discontinuity = this.consumeDiscontinuity();
        if (discontinuity.cause === 'user-seek') {
            this.cancelPendingOperations({ preserveExpectedDiscontinuity: false });
        }
        if (this.updateInProgress) {
            this.deferredDiscontinuity = { timestampMs, ...discontinuity };
            return;
        }
        this.reset(timestampMs, {
            includeAtTimestamp: discontinuity.includeAtTimestamp,
            cause: discontinuity.cause,
        });
    }

    private consumeDiscontinuity(): {
        cause: PlaybackTimelineTransitionCause;
        includeAtTimestamp: boolean;
    } {
        const expected = this.expectedDiscontinuity;
        this.expectedDiscontinuity = undefined;
        if (expected !== undefined) {
            return { cause: 'internal-seek', includeAtTimestamp: expected.includeAtTimestamp };
        }
        return { cause: 'user-seek', includeAtTimestamp: false };
    }

    async playbackStarted(): Promise<void> {
        const target = this.pendingTarget;
        this.pendingTarget = undefined;
        if (target === undefined) return;

        if (target.blockId !== undefined) {
            this.startPauseSuppression = {
                blockId: target.blockId,
            };
        }
        this.operationGeneration++;
        try {
            await this.seek(target.timestampMs, { includeAtTimestamp: true });
        } catch (error) {
            if (this.startPauseSuppression?.blockId === target.blockId) this.startPauseSuppression = undefined;
            throw error;
        }
    }

    private async onStart(event: PlaybackTimelineEvent): Promise<{ autoPaused: boolean }> {
        const block: PlaybackTimelineBlock = event.block;
        const action = block.startAction;
        if (action === undefined) return { autoPaused: false };

        const blockId = block.id;
        const suppression = this.startPauseSuppression;
        if (suppression?.blockId === blockId) {
            this.startPauseSuppression = undefined;
            if (block.endAction?.pause === true) return { autoPaused: false };
        }

        this.callbacks.pause();
        return { autoPaused: true };
    }

    private async onEnd(
        event: PlaybackTimelineEvent,
        options: { readonly alreadyAutoPaused: boolean }
    ): Promise<{ autoPaused: boolean; seeked: boolean }> {
        const block: PlaybackTimelineBlock = event.block;
        const action = block.endAction;
        if (action === undefined) return { autoPaused: false, seeked: false };

        const repeat = action.repeat !== undefined && this.shouldRepeat(block, action.repeat.count);
        let seeked = false;

        if (action.pause && !options.alreadyAutoPaused) this.callbacks.pause();
        if (repeat) {
            const blockId = block.id;
            if (action.pause) {
                this.pendingTarget = {
                    timestampMs: block.playbackModeStartMs,
                    ...(block.startAction !== undefined ? { blockId } : {}),
                };
            } else {
                const operation = ++this.operationGeneration;
                await this.seek(block.playbackModeStartMs, { includeAtTimestamp: true });
                seeked = this.isCurrentOperation(operation);
            }
        } else if (action.pause) {
            const target = this.nextCondensedTarget(block.playbackModeEndExclusiveMs);
            if (target !== undefined) {
                this.pendingTarget = {
                    timestampMs: target,
                };
            }
        }

        return { autoPaused: action.pause, seeked };
    }

    private reconcileAt(timestampMs: number, options: PlaybackRateReconciliationOptions): void {
        const lookup = this.timeline.lookupAt(timestampMs);
        this.reconcilePersistentState(lookup.state, lookup.segment, options);
    }

    private reconcilePersistentState(
        state: PlaybackTimelineState,
        segment: PlaybackTimelineSegment<T>,
        options: PlaybackRateReconciliationOptions
    ): void {
        const showingSubtitles = segment.showingSubtitles;
        this.reconcileShowingSubtitles(showingSubtitles);
        this.reconcilePlaybackRate(state, options);
    }

    private reconcileShowingSubtitles(showingSubtitles: readonly T[]): void {
        if (sameSubtitles(showingSubtitles, this.showingSubtitles)) return;
        this.showingSubtitles = showingSubtitles;
        this.callbacks.showingSubtitlesChanged(showingSubtitles);
    }

    private reconcilePlaybackRate(state: PlaybackTimelineState, options: PlaybackRateReconciliationOptions): void {
        const fastForwarding = fastForwardingForPlanState(this.plan, state);
        const playbackRate = fastForwarding ? this.plan.fastForward!.playbackRate : this.plan.playbackRate;
        const modeChanged = fastForwarding !== this._isFastForwarding;
        this._isFastForwarding = fastForwarding;
        if (modeChanged || options.forcePlaybackRate) this.callbacks.setPlaybackRate(playbackRate);
    }

    private async onAfterState(timestampMs: number): Promise<{ stateChangedTimestampMs?: number }> {
        if (this.updateOperationGeneration !== this.operationGeneration) return { stateChangedTimestampMs: undefined };
        const target = this.nextCondensedTarget(timestampMs);
        if (
            target === undefined ||
            this.pendingTarget !== undefined ||
            this.condensedOperation !== undefined ||
            this.callbacks.paused()
        ) {
            return { stateChangedTimestampMs: undefined };
        }

        try {
            const operation = ++this.operationGeneration;
            this.condensedOperation = operation;
            const shouldPause = this.shouldPauseForCondensedSeek(target);
            const seek = this.seek(target, { includeAtTimestamp: !shouldPause });
            if (shouldPause) this.callbacks.pause();
            await seek;
            if (!this.isCurrentOperation(operation)) return { stateChangedTimestampMs: undefined };
            if (shouldPause && !this.callbacks.paused()) this.callbacks.pause(); // Just in case the pause wasn't delivered asynchronously
            if (this.callbacks.paused()) return { stateChangedTimestampMs: undefined };
            await this.callbacks.play();
            if (!this.isCurrentOperation(operation)) return { stateChangedTimestampMs: undefined };
            return { stateChangedTimestampMs: target };
        } finally {
            if (this.condensedOperation === this.operationGeneration) this.condensedOperation = undefined;
        }
    }

    private shouldPauseForCondensedSeek(timestampMs: number): boolean {
        if (!this.plan.condensed?.pauseAtStart) return false;
        return this.timeline.hasStartActionAt(timestampMs);
    }

    private nextCondensedTarget(timestampMs: number): number | undefined {
        const condensed = this.plan.condensed;
        if (condensed === undefined) return;

        const lookup = this.timeline.lookupAt(timestampMs);
        const condensedTarget = lookup.segment.condensedTarget;
        if (condensedTarget === undefined) return;
        const autoPauseStartTarget = lookup.segment.nextStartActionTimestamp;
        const target =
            autoPauseStartTarget === undefined ? condensedTarget : Math.min(condensedTarget, autoPauseStartTarget);
        if (
            target === undefined ||
            target - timestampMs + 1 + timestampComparisonToleranceMs < condensed.minimumSkipIntervalMs
        ) {
            return;
        }

        const previousBlock = lookup.state.previous;
        if (
            (previousBlock?.endAction?.pause === true || previousBlock?.endAction?.repeat !== undefined) &&
            timestampMs < previousBlock.playbackModeEndMs
        ) {
            return;
        }
        return target;
    }

    private nextPlaybackActionTimestamp(timestampMs: number, lookaheadTimestampMs?: number): number {
        const hasLookahead =
            lookaheadTimestampMs !== undefined &&
            Number.isFinite(lookaheadTimestampMs) &&
            lookaheadTimestampMs > timestampMs + timestampComparisonToleranceMs;
        const lookahead = this.lookaheadCursor.advance(timestampMs + timestampComparisonToleranceMs, {
            lookaheadTimestampMs: hasLookahead ? lookaheadTimestampMs + timestampComparisonToleranceMs : undefined,
            includeStateChanges: this.plan.fastForward !== undefined,
        });
        if (!hasLookahead) return timestampMs;

        const nextActionTimestamp = lookahead.actionTimestamp;
        const nextStateChangeTimestamp =
            this.plan.fastForward === undefined ? undefined : lookahead.stateChangeTimestamp;
        if (nextActionTimestamp === undefined) return nextStateChangeTimestamp ?? timestampMs;
        if (nextStateChangeTimestamp === undefined) return nextActionTimestamp;
        // A start action is commonly one millisecond after the gap-state boundary. Prefer the action in that case so
        // auto-pause can still be predicted on the current frame instead of stopping at the preceding state change.
        return nextActionTimestamp <= nextStateChangeTimestamp + 1 + timestampComparisonToleranceMs
            ? nextActionTimestamp
            : nextStateChangeTimestamp;
    }

    private shouldRepeat(block: PlaybackTimelineBlock, repeatCount: number): boolean {
        if (this.repeatedBlock?.id !== block.id) this.repeatedBlock = { id: block.id, repeats: 0 };
        if (repeatCount > 0 && this.repeatedBlock.repeats >= repeatCount) return false;
        this.repeatedBlock.repeats++;
        return true;
    }

    private async seek(timestampMs: number, options: { includeAtTimestamp: boolean }): Promise<void> {
        const expectedDiscontinuity = { timestampMs, includeAtTimestamp: options.includeAtTimestamp };
        this.expectedDiscontinuity = expectedDiscontinuity;
        try {
            await this.callbacks.seek(timestampMs);
        } catch (error) {
            if (this.expectedDiscontinuity === expectedDiscontinuity) this.expectedDiscontinuity = undefined;
            throw error;
        }
    }

    private isCurrentOperation(operation: number): boolean {
        return operation === this.operationGeneration;
    }

    private async correctAutoPause(timestampMs: number): Promise<void> {
        const expectedDiscontinuity = { timestampMs, includeAtTimestamp: false };
        this.expectedDiscontinuity = expectedDiscontinuity;
        try {
            const { seekIssued } = await this.callbacks.correctAutoPause(timestampMs);
            if (!seekIssued && this.expectedDiscontinuity === expectedDiscontinuity) {
                this.expectedDiscontinuity = undefined;
            }
        } catch (error) {
            if (this.expectedDiscontinuity === expectedDiscontinuity) this.expectedDiscontinuity = undefined;
            throw error;
        }
    }
}
