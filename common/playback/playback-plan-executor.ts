import type { IndexedSubtitleModel } from '@project/common';
import PlaybackTimeline, {
    type PlaybackTimelineBlock,
    type PlaybackTimelineEvent,
    type PlaybackTimelineSegment,
    type PlaybackTimelineState,
} from '@project/common/playback/playback-timeline';
import {
    type PlaybackPlan,
    fastForwardingForPlanState,
    timestampComparisonToleranceMs,
} from '@project/common/playback/playback-plan';
import PlaybackTimelineRunner from '@project/common/playback/playback-timeline-runner';
import { areSubtitleModelsEqual, arrayEquals } from '@project/common/util';

export const playbackPlanCorrectionToleranceMs = 0.5;

type PlaybackTimelineTransitionCause = 'user-seek' | 'internal-seek';

export interface PlaybackPlanExecutorCallbacks<T extends IndexedSubtitleModel = IndexedSubtitleModel> {
    readonly play: () => Promise<void>;
    readonly paused: () => boolean;
    readonly pause: () => void;
    readonly seek: (timestampMs: number) => Promise<void>;
    readonly setPlaybackRate: (playbackRate: number) => void;
    readonly correctTimestamp: (timestampMs: number) => Promise<boolean>;
    readonly showingSubtitlesChanged: (subtitles: readonly T[]) => void;
}

type RepeatedBlock = {
    readonly id: string;
    repeats: number;
};

type PendingTarget = {
    readonly timestampMs: number;
    readonly blockId?: string;
    readonly showingSubtitleIndexesBeforeRepeat?: readonly number[];
};

type StartPauseSuppression = {
    readonly blockId: string;
    readonly showingSubtitleIndexesBeforeRepeat: readonly number[];
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

const sameSubtitleIndexes = (left: readonly number[], right: readonly number[]): boolean =>
    left.length === right.length && left.every((subtitleIndex, index) => subtitleIndex === right[index]);

const sameSubtitles = <T extends IndexedSubtitleModel>(left: readonly T[], right: readonly T[]): boolean =>
    arrayEquals(left, right, areSubtitleModelsEqual);

const showingSubtitleIndexes = (subtitles: readonly IndexedSubtitleModel[]): readonly number[] =>
    subtitles.map(({ index }) => index).sort((left, right) => left - right);

/**
 * Executes an already-resolved playback plan against a media adapter.
 */
export default class PlaybackPlanExecutor<T extends IndexedSubtitleModel> {
    private plan: PlaybackPlan<T>;
    private timeline: PlaybackTimeline<T>;
    private readonly runner: PlaybackTimelineRunner<T>;
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
        this.timeline = PlaybackTimeline.fromSnapshot(plan.timeline);
        this.callbacks = callbacks;
        this.runner = new PlaybackTimelineRunner(this.timeline, timestampMs, {
            onStart: (event) => this.onStart(event),
            onEnd: (event) => this.onEnd(event),
            correctAutoPause: async (targetTimestampMs) => {
                await this.correctTimestamp(targetTimestampMs);
            },
            onState: async (state, segment) => {
                this.reconcilePersistentState(state, segment, { forcePlaybackRate: false });
            },
            onAfterState: (currentTimestampMs) => this.onAfterState(currentTimestampMs),
        });
        const initialSegment = this.timeline.lookupAt(timestampMs).segment;
        this.showingSubtitles = initialSegment.showingSubtitles;
        if (initialSegment.showingSubtitles.length) {
            this.callbacks.showingSubtitlesChanged(initialSegment.showingSubtitles);
        }
    }

    get isFastForwarding(): boolean {
        return this._isFastForwarding;
    }

    replacePlan(plan: PlaybackPlan<T>, timestampMs: number): void {
        this.cancelPendingOperations({ preserveExpectedDiscontinuity: false });
        const playbackRateChanged =
            this.plan.playbackRate !== plan.playbackRate ||
            this.plan.fastForward?.playbackRate !== plan.fastForward?.playbackRate;
        const resetPlaybackRate =
            (this.plan.fastForward !== undefined && plan.fastForward === undefined) ||
            (this.plan.playbackRate !== plan.playbackRate && plan.fastForward === undefined);
        this.plan = plan;
        this.timeline = PlaybackTimeline.fromSnapshot(plan.timeline);
        this.runner.replaceTimeline(this.timeline, timestampMs);
        this.pendingTarget = undefined;

        const repeatedBlockId = this.repeatedBlock?.id;
        const repeatedPlanBlock =
            repeatedBlockId === undefined ? undefined : this.timeline.blocksById.get(repeatedBlockId);
        if (repeatedBlockId !== undefined && repeatedPlanBlock?.endAction?.repeat === undefined) {
            this.repeatedBlock = undefined;
        }
        const suppressedBlockId = this.startPauseSuppression?.blockId;
        const suppressedPlanBlock =
            suppressedBlockId === undefined ? undefined : this.timeline.blocksById.get(suppressedBlockId);
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
        this.reconcileAt(timestampMs, { forcePlaybackRate: false });
    }

    initializePlaybackRate(timestampMs: number): void {
        this.reconcilePlaybackRate(this.timeline.lookupAt(timestampMs).state, { forcePlaybackRate: true });
    }

    cancelPendingOperations(options: { preserveExpectedDiscontinuity: boolean }): void {
        if (options.preserveExpectedDiscontinuity && this.expectedDiscontinuity !== undefined) return;
        this.operationGeneration++;
        this.condensedOperation = undefined;
        this.expectedDiscontinuity = undefined;
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

        if (target.blockId !== undefined && target.showingSubtitleIndexesBeforeRepeat !== undefined) {
            this.startPauseSuppression = {
                blockId: target.blockId,
                showingSubtitleIndexesBeforeRepeat: target.showingSubtitleIndexesBeforeRepeat,
            };
        }
        this.operationGeneration++;
        try {
            await this.seek(target.timestampMs, true);
        } catch (error) {
            if (this.startPauseSuppression?.blockId === target.blockId) this.startPauseSuppression = undefined;
            throw error;
        }
    }

    private onStart(event: PlaybackTimelineEvent): boolean {
        const block: PlaybackTimelineBlock = event.block;
        const action = block.startAction;
        if (action === undefined) return false;

        const blockId = block.id;
        const suppression = this.startPauseSuppression;
        if (suppression?.blockId === blockId) {
            this.startPauseSuppression = undefined;
            const showingSubtitlesAtStart = this.timeline.lookupAt(event.timestampMs).segment.showingSubtitles;
            if (
                block.endAction?.pause === true &&
                sameSubtitleIndexes(
                    suppression.showingSubtitleIndexesBeforeRepeat,
                    showingSubtitleIndexes(showingSubtitlesAtStart)
                )
            ) {
                return false;
            }
        }

        this.callbacks.pause();
        return true;
    }

    private async onEnd(event: PlaybackTimelineEvent): Promise<{ autoPaused: boolean; seeked: boolean }> {
        const block: PlaybackTimelineBlock = event.block;
        const action = block.endAction;
        if (action === undefined) return { autoPaused: false, seeked: false };

        const repeat = action.repeat !== undefined && this.shouldRepeat(block, action.repeat.count);
        let seeked = false;

        if (action.pause) this.callbacks.pause();
        if (repeat) {
            const blockId = block.id;
            const showingSubtitleIndexesBeforeRepeat =
                block.startAction !== undefined && action.pause
                    ? showingSubtitleIndexes(this.timeline.lookupAt(event.timestampMs).segment.showingSubtitles)
                    : undefined;
            if (action.pause) {
                this.pendingTarget = {
                    timestampMs: block.playbackModeStartMs,
                    blockId,
                    showingSubtitleIndexesBeforeRepeat,
                };
            } else {
                if (showingSubtitleIndexesBeforeRepeat !== undefined) {
                    this.startPauseSuppression = { blockId, showingSubtitleIndexesBeforeRepeat };
                }
                const operation = ++this.operationGeneration;
                await this.seek(block.playbackModeStartMs, true);
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

    private async onAfterState(timestampMs: number): Promise<boolean> {
        if (this.updateOperationGeneration !== this.operationGeneration) return false;
        const target = this.nextCondensedTarget(timestampMs);
        if (
            target === undefined ||
            this.pendingTarget !== undefined ||
            this.condensedOperation !== undefined ||
            this.callbacks.paused()
        ) {
            return false;
        }

        try {
            const operation = ++this.operationGeneration;
            this.condensedOperation = operation;
            const seek = this.seek(target, true);
            const shouldPause = this.shouldPauseForCondensedSeek(target);
            if (shouldPause) this.callbacks.pause();
            await seek;
            if (!this.isCurrentOperation(operation)) return false;
            if (shouldPause && !this.callbacks.paused()) this.callbacks.pause(); // Just in case the pause wasn't delivered asynchronously
            if (this.callbacks.paused()) return false;
            await this.callbacks.play();
            if (!this.isCurrentOperation(operation)) return false;
            return true;
        } finally {
            if (this.condensedOperation === this.operationGeneration) this.condensedOperation = undefined;
        }
    }

    private shouldPauseForCondensedSeek(timestampMs: number): boolean {
        if (!this.plan.condensed?.pauseAtStart) return false;
        const block = this.timeline.lookupAt(timestampMs).state.current;
        if (block === undefined) return false;
        return block.startAction === true && timestampMs >= block.playbackModeStartMs;
    }

    private nextCondensedTarget(timestampMs: number): number | undefined {
        const condensed = this.plan.condensed;
        if (condensed === undefined) return;

        const target = this.timeline.nextCondensedTarget(timestampMs);
        if (
            target === undefined ||
            target - timestampMs + 1 + timestampComparisonToleranceMs < condensed.minimumSkipIntervalMs
        ) {
            return;
        }
        return target;
    }

    private nextPlaybackActionTimestamp(timestampMs: number, lookaheadTimestampMs?: number): number {
        if (
            lookaheadTimestampMs === undefined ||
            !Number.isFinite(lookaheadTimestampMs) ||
            lookaheadTimestampMs <= timestampMs + timestampComparisonToleranceMs
        ) {
            return timestampMs;
        }

        const nextActionTimestamp = this.timeline.nextActionTimestamp(
            timestampMs + timestampComparisonToleranceMs,
            lookaheadTimestampMs + timestampComparisonToleranceMs
        );
        const nextStateChangeTimestamp =
            this.plan.fastForward === undefined
                ? undefined
                : this.timeline.nextStateChangeTimestamp(
                      timestampMs + timestampComparisonToleranceMs,
                      lookaheadTimestampMs + timestampComparisonToleranceMs
                  );
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

    private async seek(timestampMs: number, includeAtTimestamp: boolean): Promise<void> {
        const expectedDiscontinuity = { timestampMs, includeAtTimestamp };
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

    private async correctTimestamp(timestampMs: number): Promise<void> {
        const expectedDiscontinuity = { timestampMs, includeAtTimestamp: false };
        this.expectedDiscontinuity = expectedDiscontinuity;
        try {
            const seekIssued = await this.callbacks.correctTimestamp(timestampMs);
            if (!seekIssued && this.expectedDiscontinuity === expectedDiscontinuity) {
                this.expectedDiscontinuity = undefined;
            }
        } catch (error) {
            if (this.expectedDiscontinuity === expectedDiscontinuity) this.expectedDiscontinuity = undefined;
            throw error;
        }
    }
}
