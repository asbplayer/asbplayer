import type { IndexedSubtitleModel } from '@project/common';
import PlaybackTimeline, {
    type PlaybackTimelineEvent,
    type PlaybackTimelineSegment,
    type PlaybackTimelineState,
} from '@project/common/playback/playback-timeline';
import {
    type PlaybackPlan,
    type PlaybackPlanBlock,
    playbackRateForPlanState,
    timestampComparisonToleranceMs,
} from '@project/common/playback/playback-plan';
import PlaybackTimelineRunner, {
    type PlaybackTimelineTransitionCause,
} from '@project/common/playback/playback-timeline-runner';
import { areSubtitleModelsEqual, arrayEquals } from '@project/common/util';

export const playbackPlanCorrectionToleranceMs = 0.5;
export const playbackPlanExpectedDiscontinuityToleranceMs = 150;

export interface PlaybackRateChange {
    readonly playbackRate: number;
    readonly fastForwarding: boolean;
}

export interface PlaybackPlanExecutorCallbacks<T extends IndexedSubtitleModel = IndexedSubtitleModel> {
    readonly paused: () => boolean;
    readonly pause: () => void;
    readonly seek: (timestampMs: number) => Promise<void>;
    readonly setPlaybackRate: (change: PlaybackRateChange) => void;
    readonly correctTimestamp: (timestampMs: number) => Promise<void>;
    readonly showingSubtitlesChanged: (subtitles: readonly T[]) => void;
    readonly afterCondensedSeek: () => Promise<void>;
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

type ExpectedDiscontinuity = {
    readonly timestampMs: number;
    readonly includeAtTimestamp: boolean;
};

type DeferredDiscontinuity = {
    readonly timestampMs: number;
    readonly cause: PlaybackTimelineTransitionCause;
    readonly includeAtTimestamp: boolean;
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
    private appliedPlaybackRate?: number;
    private expectedDiscontinuity?: ExpectedDiscontinuity;
    private updateInProgress = false;
    private deferredDiscontinuity?: DeferredDiscontinuity;

    constructor(plan: PlaybackPlan<T>, timestampMs: number, callbacks: PlaybackPlanExecutorCallbacks<T>) {
        this.plan = plan;
        this.timeline = PlaybackTimeline.fromSnapshot(plan.timeline);
        this.callbacks = callbacks;
        this.runner = new PlaybackTimelineRunner(this.timeline, timestampMs, {
            onStart: (event) => this.onStart(event),
            onEnd: (event) => this.onEnd(event),
            correctAutoPause: async (targetTimestampMs) => {
                await this.correctTimestamp(targetTimestampMs);
            },
            onState: async (state, segment) => {
                this.reconcilePersistentState(state, segment);
            },
            onAfterState: (currentTimestampMs) => this.onAfterState(currentTimestampMs),
        });
        this.reconcileAt(timestampMs);
    }

    replacePlan(plan: PlaybackPlan<T>, timestampMs: number): void {
        this.cancelPendingOperations();
        const resetPlaybackRate =
            (this.plan.fastForward !== undefined && plan.fastForward === undefined) ||
            (this.plan.playbackRate !== plan.playbackRate && plan.fastForward === undefined);
        this.plan = plan;
        this.timeline = PlaybackTimeline.fromSnapshot(plan.timeline);
        this.runner.replaceTimeline(this.timeline, timestampMs, { applyContinuousState: true });
        this.pendingTarget = undefined;

        const repeatedBlockId = this.repeatedBlock?.id;
        if (
            repeatedBlockId !== undefined &&
            !plan.timeline.blocks.some((block) => block.id === repeatedBlockId && block.endAction?.repeat !== undefined)
        ) {
            this.repeatedBlock = undefined;
        }
        const suppressedBlockId = this.startPauseSuppression?.blockId;
        if (
            suppressedBlockId !== undefined &&
            !plan.timeline.blocks.some(
                (block) =>
                    block.id === suppressedBlockId && block.startAction !== undefined && block.endAction?.pause === true
            )
        ) {
            this.startPauseSuppression = undefined;
        }
        if (resetPlaybackRate) {
            this.applyPlaybackRate({ playbackRate: plan.playbackRate, fastForwarding: false });
            this.appliedPlaybackRate = plan.playbackRate;
        }
        this.reconcileAt(timestampMs);
    }

    async update(timestampMs: number, lookaheadTimestampMs = timestampMs): Promise<void> {
        this.updateOperationGeneration = this.operationGeneration;
        this.updateInProgress = true;
        try {
            await this.runner.update(this.nextPlaybackActionTimestamp(timestampMs, lookaheadTimestampMs));
        } finally {
            this.updateInProgress = false;
            const deferredDiscontinuity = this.deferredDiscontinuity;
            this.deferredDiscontinuity = undefined;
            if (deferredDiscontinuity !== undefined) {
                this.reset(
                    deferredDiscontinuity.timestampMs,
                    deferredDiscontinuity.includeAtTimestamp,
                    deferredDiscontinuity.cause
                );
            }
        }
    }

    reset(timestampMs: number, includeAtTimestamp = true, cause: PlaybackTimelineTransitionCause = 'user-seek'): void {
        if (cause === 'user-seek') {
            this.cancelPendingOperations();
            this.pendingTarget = undefined;
            this.repeatedBlock = undefined;
            this.startPauseSuppression = undefined;
        }
        this.runner.reset(timestampMs, cause === 'user-seek' ? false : includeAtTimestamp);
        this.reconcileAt(timestampMs);
    }

    shiftTimeline(deltaMs: number, timestampMs: number, plan: PlaybackPlan<T> = this.plan): void {
        if (deltaMs === 0) return;
        this.cancelPendingOperations();
        this.plan = plan;
        this.runner.shiftTimeline(deltaMs, timestampMs);
        if (this.pendingTarget !== undefined) {
            this.pendingTarget = {
                ...this.pendingTarget,
                timestampMs: this.pendingTarget.timestampMs + deltaMs,
            };
        }
        this.reconcileAt(timestampMs);
    }

    initializePlaybackRate(timestampMs: number): void {
        this.appliedPlaybackRate = undefined;
        this.reconcilePlaybackRate(this.timeline.stateAt(timestampMs));
    }

    fastForwardingAt(timestampMs: number): boolean {
        if (this.plan.fastForward === undefined) return false;
        const playbackRate = playbackRateForPlanState(this.plan, this.timeline.stateAt(timestampMs));
        if (playbackRate === this.plan.playbackRate) return false;
        return playbackRate === this.plan.fastForward.playbackRate;
    }

    cancelPendingOperations(preserveExpectedDiscontinuity = false): void {
        if (preserveExpectedDiscontinuity && this.expectedDiscontinuity !== undefined) return;
        this.operationGeneration++;
        this.condensedOperation = undefined;
        this.expectedDiscontinuity = undefined;
    }

    handleDiscontinuity(timestampMs: number): void {
        const discontinuity = this.consumeDiscontinuity(timestampMs);
        if (discontinuity.cause === 'user-seek') this.cancelPendingOperations();
        if (this.updateInProgress) {
            this.deferredDiscontinuity = { timestampMs, ...discontinuity };
            return;
        }
        this.reset(timestampMs, discontinuity.includeAtTimestamp, discontinuity.cause);
    }

    consumeDiscontinuity(timestampMs: number): {
        cause: PlaybackTimelineTransitionCause;
        includeAtTimestamp: boolean;
    } {
        const expected = this.expectedDiscontinuity;
        this.expectedDiscontinuity = undefined;
        if (
            expected !== undefined &&
            Math.abs(expected.timestampMs - timestampMs) < playbackPlanExpectedDiscontinuityToleranceMs
        ) {
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
        const operation = ++this.operationGeneration;
        try {
            await this.seek(target.timestampMs, true);
            if (!this.isCurrentOperation(operation)) return;
        } catch (error) {
            if (this.startPauseSuppression?.blockId === target.blockId) this.startPauseSuppression = undefined;
            throw error;
        }
    }

    private onStart(event: PlaybackTimelineEvent): boolean {
        const block: PlaybackPlanBlock = event.block;
        const action = block.startAction;
        if (action === undefined) return false;

        const blockId = block.id;
        const suppression = this.startPauseSuppression;
        if (suppression?.blockId === blockId) {
            this.startPauseSuppression = undefined;
            const showingSubtitlesAtStart = this.timeline.segmentAt(event.timestampMs).showingSubtitles;
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
        const block: PlaybackPlanBlock = event.block;
        const action = block.endAction;
        if (action === undefined) return { autoPaused: false, seeked: false };

        const repeat = action.repeat !== undefined && this.shouldRepeat(block, action.repeat.count);
        let seeked = false;

        if (action.pause) this.callbacks.pause();
        if (repeat && action.repeat !== undefined) {
            const blockId = block.id;
            const showingSubtitleIndexesBeforeRepeat =
                block.startAction !== undefined && action.pause
                    ? showingSubtitleIndexes(this.timeline.segmentAt(event.timestampMs).showingSubtitles)
                    : undefined;
            if (action.pause) {
                this.pendingTarget = {
                    timestampMs: this.timeline.toMediaTimestamp(block.playbackModeStartMs),
                    blockId,
                    showingSubtitleIndexesBeforeRepeat,
                };
            } else {
                if (showingSubtitleIndexesBeforeRepeat !== undefined) {
                    this.startPauseSuppression = { blockId, showingSubtitleIndexesBeforeRepeat };
                }
                const operation = ++this.operationGeneration;
                await this.seek(this.timeline.toMediaTimestamp(block.playbackModeStartMs), true);
                seeked = this.isCurrentOperation(operation);
            }
        } else if (action.pause) {
            const target = this.nextCondensedTarget(this.timeline.toMediaTimestamp(block.playbackModeEndExclusiveMs));
            if (target !== undefined) {
                this.pendingTarget = {
                    timestampMs: target,
                };
            }
        }

        return { autoPaused: action.pause, seeked };
    }

    private reconcileAt(timestampMs: number): void {
        this.reconcilePersistentState(this.timeline.stateAt(timestampMs), this.timeline.segmentAt(timestampMs));
    }

    private reconcilePersistentState(state: PlaybackTimelineState, segment: PlaybackTimelineSegment<T>): void {
        const showingSubtitles = segment.showingSubtitles;
        if (!sameSubtitles(showingSubtitles, this.showingSubtitles)) {
            this.showingSubtitles = showingSubtitles;
            this.callbacks.showingSubtitlesChanged(showingSubtitles);
        }

        this.reconcilePlaybackRate(state);
    }

    private reconcilePlaybackRate(state: PlaybackTimelineState): void {
        const playbackRate = playbackRateForPlanState(this.plan, state);
        if (playbackRate !== undefined && playbackRate !== this.appliedPlaybackRate) {
            this.applyPlaybackRate({
                playbackRate,
                fastForwarding:
                    this.plan.fastForward !== undefined && playbackRate === this.plan.fastForward.playbackRate,
            });
            this.appliedPlaybackRate = playbackRate;
        }
    }

    private applyPlaybackRate(change: PlaybackRateChange): void {
        this.callbacks.setPlaybackRate(change);
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
            await this.seek(target, true);
            if (!this.isCurrentOperation(operation) || this.callbacks.paused()) return false;
            await this.callbacks.afterCondensedSeek();
            if (!this.isCurrentOperation(operation)) return false;
            return true;
        } finally {
            if (this.condensedOperation === this.operationGeneration) this.condensedOperation = undefined;
        }
    }

    private nextCondensedTarget(timestampMs: number): number | undefined {
        const condensed = this.plan.condensed;
        if (condensed === undefined) return;

        const target = this.timeline.nextCondensedTarget(timestampMs);
        if (
            target === undefined ||
            target <= timestampMs ||
            target - timestampMs + 1 + timestampComparisonToleranceMs < condensed.minimumSkipIntervalMs
        ) {
            return;
        }
        return target;
    }

    private nextPlaybackActionTimestamp(timestampMs: number, lookaheadTimestampMs: number): number {
        if (
            !Number.isFinite(lookaheadTimestampMs) ||
            lookaheadTimestampMs <= timestampMs + timestampComparisonToleranceMs
        ) {
            return timestampMs;
        }

        return (
            this.timeline.nextActionTimestamp(
                timestampMs + timestampComparisonToleranceMs,
                lookaheadTimestampMs + timestampComparisonToleranceMs
            ) ?? timestampMs
        );
    }

    private shouldRepeat(block: PlaybackPlanBlock, repeatCount: number): boolean {
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
            await this.callbacks.correctTimestamp(timestampMs);
        } catch (error) {
            if (this.expectedDiscontinuity === expectedDiscontinuity) this.expectedDiscontinuity = undefined;
            throw error;
        }
    }
}
