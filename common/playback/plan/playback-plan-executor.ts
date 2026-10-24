import type { IndexedSubtitleModel } from '@project/common';
import type { TokenSelectionLocation } from '@project/common/annotations/token-navigation';
import { asbTrace } from '@project/common/util/log';
import PlaybackTimeline from '@project/common/playback/timeline/playback-timeline';
import type {
    PlaybackTimelineBlock,
    PlaybackTimelineEvent,
    PlaybackTimelineState,
} from '@project/common/playback/timeline/playback-timeline';
import {
    fastForwardingForPlanState,
    timestampComparisonToleranceMs,
} from '@project/common/playback/plan/playback-plan';
import type { PlaybackPlan } from '@project/common/playback/plan/playback-plan';
import PlaybackTimelineRunner from '@project/common/playback/timeline/playback-timeline-runner';
import PlaybackTimelineLookaheadCursor from '@project/common/playback/timeline/playback-timeline-lookahead-cursor';

export type PlaybackTimelineTransitionCause = 'user-seek' | 'internal-seek' | 'failed-internal-seek';

export const maximumInternalSeekMismatchMs = 3000;

export interface PlaybackPlanPause<T extends IndexedSubtitleModel> {
    readonly timestampMs: number;
    readonly playbackModeSubtitlesAtPause: readonly T[];
    readonly autoPauseToken?: Readonly<TokenSelectionLocation>;
}

export interface PlaybackPlanExecutorCallbacks<T extends IndexedSubtitleModel> {
    readonly play: () => Promise<void>;
    readonly paused: () => boolean;
    readonly pause: (pause: PlaybackPlanPause<T>) => void;
    readonly seek: (timestampMs: number) => Promise<void>;
    readonly setPlaybackRate: (playbackRate: number) => void;
    readonly correctAutoPause: (timestampMs: number) => Promise<{ readonly seekIssued: boolean }>;
}

type RepeatedBlock = {
    readonly id: string;
    repeats: number;
};

type PendingTarget =
    | {
          readonly kind: 'condensed';
          readonly timestampMs: number;
      }
    | {
          readonly kind: 'repeat';
          readonly timestampMs: number;
          readonly repeatBlockId: string;
          readonly startPauseSuppressionBlockId?: string;
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
    /** Actual timestamp reported by the media, used to reconcile continuous playback state. */
    readonly timestampMs: number;
    /** Timestamp used to reset timeline cursors: the requested target for an internal seek, otherwise the actual timestamp. */
    readonly timelineTimestampMs: number;
    readonly cause: PlaybackTimelineTransitionCause;
    readonly includeAtTimestamp: boolean;
};

type PlaybackRateReconciliationOptions = {
    readonly forcePlaybackRate: boolean;
};

const playbackPlanTraceDetails = <T extends IndexedSubtitleModel>(plan: PlaybackPlan<T>) => ({
    durationMs: plan.timelineSubtitles.durationMs,
    displaySubtitleCount: plan.timelineSubtitles.displaySubtitles.length,
    timelineBlockCount: plan.timelineSubtitles.blocks.length,
    actionBlockCount: plan.timelineSubtitles.actionBlocks.length,
    adaptiveRateBlockCount: plan.timelineSubtitles.blocks.filter((block) => block.adaptiveRate !== undefined).length,
    condensedBlockCount: plan.timelineSubtitles.condensedBlocks?.length,
    hiddenSubtitleCount: plan.timelineSubtitles.hiddenSubtitleIndexes.length,
    playbackRate: plan.playbackRate,
    condensed: plan.condensed !== undefined,
    fastForwardPlaybackRate: plan.fastForward?.playbackRate,
    autoPauseResumeMode: plan.autoPause?.resume.mode,
});

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
    private currentPlaybackRate: number;
    private currentFastForwardRateFraction = 0;
    private currentComprehensionControlled = false;
    private expectedDiscontinuity?: ExpectedDiscontinuity;
    private updateInProgress = false;
    private deferredDiscontinuity?: DeferredDiscontinuity;

    constructor(plan: PlaybackPlan<T>, timestampMs: number, callbacks: PlaybackPlanExecutorCallbacks<T>) {
        asbTrace('playback/executor', 'Creating playback plan executor', {
            plan: playbackPlanTraceDetails(plan),
            timestampMs,
        });
        this.plan = plan;
        this.currentPlaybackRate = plan.playbackRate;
        this.timeline = PlaybackTimeline.fromSubtitles(plan.timelineSubtitles);
        this.callbacks = callbacks;
        this.runner = new PlaybackTimelineRunner(this.timeline, timestampMs, {
            onStart: (event) => this.onStart(event),
            onEnd: (event, options) => this.onEnd(event, options),
            correctAutoPause: async (targetTimestampMs) => {
                await this.correctAutoPause(targetTimestampMs);
            },
            onState: async (state) => {
                this.reconcilePlaybackRate(state, { forcePlaybackRate: false });
            },
            onAfterState: (currentTimestampMs) => this.onAfterState(currentTimestampMs),
        });
        this.lookaheadCursor = new PlaybackTimelineLookaheadCursor(this.timeline, timestampMs);
    }

    get isFastForwarding(): boolean {
        return this.currentFastForwardRateFraction > 0;
    }

    get playbackRate(): number {
        return this.currentPlaybackRate;
    }

    get comprehensionControlled(): boolean {
        return this.currentComprehensionControlled;
    }

    showingSubtitlesAt(timestampMs: number): readonly T[] {
        return this.timeline.showingSubtitlesAt(timestampMs);
    }

    invisibleSubtitlesAt(timestampMs: number): readonly T[] {
        return this.timeline.invisibleSubtitlesAt(timestampMs);
    }

    hiddenSubtitleIndexesAt(timestampMs: number): readonly number[] {
        return this.timeline.hiddenSubtitleIndexesAt(timestampMs);
    }

    hideSubtitlesForRepeatAt(timestampMs: number): boolean {
        const block = this.timeline.repeatBlockAt(timestampMs);
        const revealAfter = block?.endAction?.repeat?.repeatsBeforeShowingSubtitles ?? 0;
        if (revealAfter === 0) return false;
        const repeats = block !== undefined && this.repeatedBlock?.id === block.id ? this.repeatedBlock.repeats : 0;
        return repeats < revealAfter;
    }

    replacePlan(plan: PlaybackPlan<T>, timestampMs: number, options: { readonly forcePlaybackRate?: boolean }): void {
        asbTrace('playback/executor', 'Replacing playback plan in executor', {
            forcePlaybackRate: options.forcePlaybackRate === true,
            plan: playbackPlanTraceDetails(plan),
            timestampMs,
        });
        const previousPendingTarget = this.pendingTarget;
        const previousPendingRepeatBlock =
            previousPendingTarget?.kind === 'repeat'
                ? this.timeline.blockById(previousPendingTarget.repeatBlockId)
                : undefined;
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
        const pendingRepeatBlock =
            previousPendingRepeatBlock === undefined
                ? undefined
                : this.timeline.blockById(previousPendingRepeatBlock.id);
        const pendingRepeatAction = pendingRepeatBlock?.endAction?.repeat;
        // Annotation updates may change other blocks while this paused repeat remains valid.
        this.pendingTarget =
            pendingRepeatBlock !== undefined &&
            pendingRepeatAction !== undefined &&
            pendingRepeatBlock.playbackModeStartMs === previousPendingRepeatBlock?.playbackModeStartMs &&
            pendingRepeatBlock.playbackModeEndMs === previousPendingRepeatBlock?.playbackModeEndMs &&
            (pendingRepeatAction.count === 0 || (this.repeatedBlock?.repeats ?? 0) < pendingRepeatAction.count)
                ? this.repeatTarget(pendingRepeatBlock)
                : undefined;
        if (previousPendingTarget?.kind === 'repeat') {
            asbTrace('playback/executor', 'Reconciled pending repeat while replacing plan', {
                blockId: previousPendingTarget.repeatBlockId,
                outcome: this.pendingTarget === undefined ? 'discarded' : 'preserved',
                repeatCount: pendingRepeatAction?.count,
                repeats: this.repeatedBlock?.repeats ?? 0,
                timestampMs,
            });
        }

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
            this.currentFastForwardRateFraction = 0;
            this.currentComprehensionControlled = false;
            this.currentPlaybackRate = plan.playbackRate;
            asbTrace('playback/executor', 'Reset playback rate while replacing plan', {
                playbackRate: plan.playbackRate,
            });
        }
        this.reconcileAt(timestampMs, {
            forcePlaybackRate: !resetPlaybackRate && (playbackRateChanged || options.forcePlaybackRate === true),
        });
    }

    async update(timestampMs: number, options: { lookaheadTimestampMs?: number }): Promise<void> {
        this.updateOperationGeneration = this.operationGeneration;
        this.updateInProgress = true;
        try {
            await this.runner.update(this.nextPlaybackActionTimestamp(timestampMs, options));
        } finally {
            this.updateInProgress = false;
            const deferredDiscontinuity = this.deferredDiscontinuity;
            this.deferredDiscontinuity = undefined;
            if (deferredDiscontinuity !== undefined) {
                this.reset(deferredDiscontinuity.timestampMs, deferredDiscontinuity.timelineTimestampMs, {
                    includeAtTimestamp: deferredDiscontinuity.includeAtTimestamp,
                    cause: deferredDiscontinuity.cause,
                });
            }
        }
    }

    private reset(
        timestampMs: number,
        timelineTimestampMs: number,
        options: {
            includeAtTimestamp: boolean;
            cause: PlaybackTimelineTransitionCause;
        }
    ): void {
        asbTrace('playback/executor', 'Resetting playback timeline', {
            cause: options.cause,
            includeAtTimestamp: options.includeAtTimestamp,
            timestampMs,
            timelineTimestampMs,
        });
        if (options.cause !== 'internal-seek') {
            this.cancelPendingOperations({ preserveExpectedDiscontinuity: false });
            this.pendingTarget = undefined;
            this.repeatedBlock = undefined;
            this.startPauseSuppression = undefined;
        }
        this.runner.reset(timelineTimestampMs, {
            includeAtTimestamp: options.cause === 'internal-seek' ? options.includeAtTimestamp : false,
        });
        this.lookaheadCursor.reset(timelineTimestampMs);
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

    /** Returns the cause so callers can tell a user seek from one playback issued itself. */
    handleDiscontinuity(timestampMs: number): { readonly cause: PlaybackTimelineTransitionCause } {
        const discontinuity = this.consumeDiscontinuity(timestampMs);
        if (discontinuity.cause !== 'internal-seek') {
            this.cancelPendingOperations({ preserveExpectedDiscontinuity: false });
        }
        if (this.updateInProgress) {
            this.deferredDiscontinuity = {
                timestampMs,
                timelineTimestampMs: discontinuity.timelineTimestampMs,
                cause: discontinuity.cause,
                includeAtTimestamp: discontinuity.includeAtTimestamp,
            };
            asbTrace('playback/executor', 'Deferred discontinuity until timeline update completed', {
                cause: discontinuity.cause,
                timestampMs,
                timelineTimestampMs: discontinuity.timelineTimestampMs,
            });
            return { cause: discontinuity.cause };
        }
        this.reset(timestampMs, discontinuity.timelineTimestampMs, {
            includeAtTimestamp: discontinuity.includeAtTimestamp,
            cause: discontinuity.cause,
        });
        return { cause: discontinuity.cause };
    }

    private consumeDiscontinuity(timestampMs: number): {
        cause: PlaybackTimelineTransitionCause;
        includeAtTimestamp: boolean;
        timelineTimestampMs: number;
    } {
        const expected = this.expectedDiscontinuity;
        this.expectedDiscontinuity = undefined;
        if (expected !== undefined) {
            if (Math.abs(timestampMs - expected.timestampMs) > maximumInternalSeekMismatchMs) {
                return {
                    cause: 'failed-internal-seek',
                    includeAtTimestamp: false,
                    timelineTimestampMs: timestampMs,
                };
            }
            return {
                cause: 'internal-seek',
                includeAtTimestamp: expected.includeAtTimestamp,
                timelineTimestampMs: expected.timestampMs,
            };
        }
        return { cause: 'user-seek', includeAtTimestamp: false, timelineTimestampMs: timestampMs };
    }

    async playbackStarted(): Promise<void> {
        const target = this.pendingTarget;
        this.pendingTarget = undefined;
        if (target === undefined) return;

        asbTrace('playback/executor', 'Resuming playback at pending timeline target', target);

        const suppressionBlockId = target.kind === 'repeat' ? target.startPauseSuppressionBlockId : undefined;
        if (suppressionBlockId !== undefined) {
            this.startPauseSuppression = {
                blockId: suppressionBlockId,
            };
        }
        this.operationGeneration++;
        try {
            if (target.kind === 'repeat') {
                await this.seekRepeat(target.timestampMs, target.repeatBlockId);
            } else {
                await this.seek(target.timestampMs, { includeAtTimestamp: true });
            }
        } catch (error) {
            asbTrace('playback/error', 'Pending playback target seek failed', { error, target });
            if (this.startPauseSuppression?.blockId === suppressionBlockId) this.startPauseSuppression = undefined;
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

        this.callbacks.pause({
            timestampMs: event.timestampMs,
            playbackModeSubtitlesAtPause: this.pauseSubtitlesFor([block]),
            autoPauseToken: block.autoPauseToken,
        });
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

        if (action.pause && !options.alreadyAutoPaused) {
            this.callbacks.pause({
                timestampMs: event.timestampMs,
                playbackModeSubtitlesAtPause: this.pauseSubtitlesFor([block]),
                autoPauseToken: block.autoPauseEndToken,
            });
        }
        if (repeat) {
            if (action.pause || options.alreadyAutoPaused) {
                this.pendingTarget = this.repeatTarget(block);
            } else {
                const operation = ++this.operationGeneration;
                await this.seekRepeat(block.playbackModeStartMs, block.id);
                seeked = this.isCurrentOperation(operation);
            }
        } else if (action.pause) {
            const target = this.nextCondensedTarget(block.playbackModeEndExclusiveMs);
            if (target !== undefined) {
                this.pendingTarget = {
                    kind: 'condensed',
                    timestampMs: target,
                };
            }
        }

        return { autoPaused: action.pause, seeked };
    }

    private repeatTarget(block: PlaybackTimelineBlock): PendingTarget {
        const startPauseBlock = this.timeline
            .startActionsAt(block.playbackModeStartMs)
            .find(
                (candidate) =>
                    candidate.endAction?.pause === true && candidate.playbackModeEndMs === block.playbackModeEndMs
            );
        const suppressionBlockId = block.startAction !== undefined ? block.id : startPauseBlock?.id;
        return {
            kind: 'repeat',
            timestampMs: block.playbackModeStartMs,
            repeatBlockId: block.id,
            ...(suppressionBlockId === undefined ? {} : { startPauseSuppressionBlockId: suppressionBlockId }),
        };
    }

    reconcileAt(timestampMs: number, options: PlaybackRateReconciliationOptions): void {
        const lookup = this.timeline.lookupAt(timestampMs);
        this.reconcilePlaybackRate(lookup.state, options);
    }

    private reconcilePlaybackRate(state: PlaybackTimelineState, options: PlaybackRateReconciliationOptions): void {
        const fastForwarding = fastForwardingForPlanState(this.plan, state);
        const playbackRate =
            state.current?.adaptiveRate?.playbackRate ??
            (fastForwarding ? this.plan.fastForward!.playbackRate : this.plan.playbackRate);
        const modeChanged = fastForwarding !== this.isFastForwarding;
        const previousPlaybackRate = this.currentPlaybackRate;
        const previousFraction = this.currentFastForwardRateFraction;
        const previousComprehensionControlled = this.currentComprehensionControlled;
        this.currentFastForwardRateFraction = state.current?.adaptiveRate?.fraction ?? (fastForwarding ? 1 : 0);
        this.currentComprehensionControlled = state.current?.adaptiveRate?.comprehensionControlled ?? false;
        const controlChanged =
            previousFraction !== this.currentFastForwardRateFraction ||
            previousComprehensionControlled !== this.currentComprehensionControlled;
        const rateCommandNeeded = modeChanged || options.forcePlaybackRate || previousPlaybackRate !== playbackRate;
        if (rateCommandNeeded || controlChanged) {
            asbTrace('playback/executor', 'Reconciled playback rate', {
                blockId: state.current?.id,
                comprehensionControlled: this.currentComprehensionControlled,
                controlChanged,
                fastForwarding,
                forcePlaybackRate: options.forcePlaybackRate,
                fraction: this.currentFastForwardRateFraction,
                modeChanged,
                playbackRate,
                previousPlaybackRate,
            });
        }
        if (rateCommandNeeded) {
            this.callbacks.setPlaybackRate(playbackRate);
            this.currentPlaybackRate = playbackRate;
        }
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
            const startActions = this.timeline.startActionsAt(target);
            const pause = {
                timestampMs: target,
                playbackModeSubtitlesAtPause: this.pauseSubtitlesFor(startActions),
                autoPauseToken: startActions.find((block) => block.autoPauseToken)?.autoPauseToken,
            };
            if (shouldPause) this.callbacks.pause(pause);
            await seek;
            if (!this.isCurrentOperation(operation)) return { stateChangedTimestampMs: undefined };
            if (shouldPause && !this.callbacks.paused()) {
                this.callbacks.pause(pause); // Just in case the pause wasn't delivered asynchronously
            }
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

    private pauseSubtitlesFor(blocks: readonly PlaybackTimelineBlock[]): readonly T[] {
        const subtitleIndexes = new Set(blocks.flatMap((block) => block.subtitleIndexes));
        return this.plan.timelineSubtitles.displaySubtitles.filter((subtitle) => subtitleIndexes.has(subtitle.index));
    }

    private nextCondensedTarget(timestampMs: number): number | undefined {
        const condensed = this.plan.condensed;
        if (condensed === undefined) return;

        const lookup = this.timeline.lookupAt(timestampMs);
        const condensedTarget = lookup.segment.condensedTarget;
        if (condensedTarget === undefined) return;
        const autoPauseStartTarget = lookup.segment.nextStartActionTimestamp;
        const nextActionTarget = lookup.segment.nextPlaybackActionTimestamp;
        const target = Math.min(condensedTarget, autoPauseStartTarget ?? Infinity, nextActionTarget ?? Infinity);
        if (target - timestampMs + 1 + timestampComparisonToleranceMs < condensed.minimumSkipIntervalMs) {
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

    private nextPlaybackActionTimestamp(
        timestampMs: number,
        { lookaheadTimestampMs }: { readonly lookaheadTimestampMs?: number }
    ): number {
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
        return repeatCount === 0 || this.repeatedBlock.repeats < repeatCount;
    }

    private async seekRepeat(timestampMs: number, blockId: string): Promise<void> {
        if (this.repeatedBlock?.id !== blockId) this.repeatedBlock = { id: blockId, repeats: 0 };
        const repeatedBlock = this.repeatedBlock;
        repeatedBlock.repeats++; // Queuing a repeat during an end pause does not start the next pass.
        try {
            await this.seek(timestampMs, { includeAtTimestamp: true });
        } catch (error) {
            if (this.repeatedBlock === repeatedBlock) repeatedBlock.repeats--;
            throw error;
        }
    }

    private async seek(timestampMs: number, options: { includeAtTimestamp: boolean }): Promise<void> {
        const expectedDiscontinuity = { timestampMs, includeAtTimestamp: options.includeAtTimestamp };
        this.expectedDiscontinuity = expectedDiscontinuity;
        try {
            await this.callbacks.seek(timestampMs);
        } catch (error) {
            asbTrace('playback/error', 'Executor seek failed', { error, timestampMs });
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
            asbTrace('playback/error', 'Auto-pause correction failed', { error, timestampMs });
            if (this.expectedDiscontinuity === expectedDiscontinuity) this.expectedDiscontinuity = undefined;
            throw error;
        }
    }
}
