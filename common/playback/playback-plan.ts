import { AutoPausePreference, PlayMode, type SubtitleModel } from '@project/common';
import type {
    PlaybackTimelineBlock,
    PlaybackTimelineSnapshot,
    PlaybackTimelineState,
} from '@project/common/playback/playback-timeline';
import { compilePlaybackTimeline } from '@project/common/playback/playback-timeline-compiler';
import { areSubtitleModelsEqual, arrayEquals } from '@project/common/util';

export interface PlaybackPlanRepeatAction {
    /** Zero means repeat indefinitely. */
    readonly count: number;
}

export interface PlaybackPlanEndAction {
    readonly pause: boolean;
    readonly repeat?: PlaybackPlanRepeatAction;
}

export interface PlaybackPlanBlock extends PlaybackTimelineBlock {
    readonly startAction?: true;
    readonly endAction?: PlaybackPlanEndAction;
}

export interface PlaybackPlanFastForward {
    readonly playbackRate: number;
    readonly minimumSkipIntervalMs: number;
}

export interface PlaybackPlanCondensed {
    readonly minimumSkipIntervalMs: number;
    readonly pauseAtStart: boolean;
}

/** Playback policy compiled and applied beside its owning media element. */
export interface PlaybackPlan<T extends SubtitleModel = SubtitleModel> {
    readonly timeline: PlaybackTimelineSnapshot<T, PlaybackPlanBlock>;
    readonly playbackRate: number;
    readonly condensed?: PlaybackPlanCondensed;
    readonly fastForward?: PlaybackPlanFastForward;
}

export interface PlaybackPlanInput<T extends SubtitleModel> {
    /** Subtitles eligible to influence playback modes. */
    readonly subtitles: readonly T[];
    /** All subtitles eligible for display. Defaults to subtitles. */
    readonly displaySubtitles?: readonly T[];
    readonly durationMs: number;
    readonly playModes: ReadonlySet<PlayMode>;
    readonly autoPausePreference: AutoPausePreference;
    readonly subtitleTriggerStartOffset: number;
    readonly subtitleTriggerEndOffset: number;
    readonly subtitleTriggerGapStartOffset: number;
    readonly subtitleTriggerGapEndOffset: number;
    readonly repeatCountPreference: number;
    readonly condensedPlaybackMinimumSkipIntervalMs: number;
    readonly playbackRate: number;
    readonly fastForwardModePlaybackRate: number;
    readonly fastForwardPlaybackMinimumSkipIntervalMs: number;
}

const autoPausePreferenceIncludes = (
    preference: AutoPausePreference,
    edge: AutoPausePreference.atStart | AutoPausePreference.atEnd
) => preference === edge || preference === AutoPausePreference.atStartAndEnd;

const normalizedRepeatCount = (repeatCount: number): number => Math.max(0, Math.floor(repeatCount));
const finiteOrZero = (value: number): number => (Number.isFinite(value) ? value : 0);
export const timestampComparisonToleranceMs = 1e-6;

export const buildPlaybackPlan = <T extends SubtitleModel>({
    subtitles,
    displaySubtitles,
    durationMs,
    playModes,
    autoPausePreference,
    subtitleTriggerStartOffset,
    subtitleTriggerEndOffset,
    subtitleTriggerGapStartOffset,
    subtitleTriggerGapEndOffset,
    repeatCountPreference,
    condensedPlaybackMinimumSkipIntervalMs,
    playbackRate,
    fastForwardModePlaybackRate,
    fastForwardPlaybackMinimumSkipIntervalMs,
}: PlaybackPlanInput<T>): PlaybackPlan<T> => {
    const autoPause = playModes.has(PlayMode.autoPause);
    const autoPauseAtStart = autoPause && autoPausePreferenceIncludes(autoPausePreference, AutoPausePreference.atStart);
    const autoPauseAtEnd = autoPause && autoPausePreferenceIncludes(autoPausePreference, AutoPausePreference.atEnd);
    const repeat = playModes.has(PlayMode.repeat);
    const startOffset = finiteOrZero(subtitleTriggerStartOffset);
    const gapEndOffset = Math.min(0, finiteOrZero(subtitleTriggerGapEndOffset));
    const timeline = compilePlaybackTimeline({
        subtitles,
        displaySubtitles,
        durationMs,
        subtitleTriggerStartOffset,
        subtitleTriggerEndOffset,
        subtitleTriggerGapStartOffset,
        subtitleTriggerGapEndOffset,
    });

    const blocks = timeline.blocks.map<PlaybackPlanBlock>((block) => ({
        ...block,
        ...(autoPauseAtStart ? { startAction: true as const } : {}),
        ...(autoPauseAtEnd || repeat
            ? {
                  endAction: {
                      pause: autoPauseAtEnd,
                      ...(repeat
                          ? {
                                repeat: {
                                    count: normalizedRepeatCount(repeatCountPreference),
                                },
                            }
                          : {}),
                  },
              }
            : {}),
    }));

    return {
        timeline: {
            ...timeline,
            blocks,
        },
        playbackRate,
        ...(playModes.has(PlayMode.condensed)
            ? {
                  condensed: {
                      minimumSkipIntervalMs: condensedPlaybackMinimumSkipIntervalMs,
                      pauseAtStart:
                          autoPauseAtStart && startOffset <= 0 && Math.abs(gapEndOffset) <= Math.abs(startOffset),
                  },
              }
            : {}),
        ...(playModes.has(PlayMode.fastForward)
            ? {
                  fastForward: {
                      playbackRate: fastForwardModePlaybackRate,
                      minimumSkipIntervalMs: fastForwardPlaybackMinimumSkipIntervalMs,
                  },
              }
            : {}),
    };
};

export const playbackPlanIsActive = (plan: PlaybackPlan): boolean =>
    plan.timeline.displaySubtitles.length > 0 ||
    plan.condensed !== undefined ||
    plan.fastForward !== undefined ||
    plan.timeline.blocks.some((block) => block.startAction !== undefined || block.endAction !== undefined);

export const fastForwardingForPlanState = <T extends SubtitleModel>(
    plan: PlaybackPlan<T>,
    state: PlaybackTimelineState
): boolean => {
    if (plan.fastForward === undefined || state.current !== undefined) return false;

    const previousGapEdge = state.previous?.subtitleTriggerGapStartOffsetMs;
    const nextGapEdge = state.next?.subtitleTriggerGapEndOffsetMs;
    if (previousGapEdge === undefined && nextGapEdge === undefined) return true;

    let gapDurationMs: number;
    if (previousGapEdge === undefined) {
        gapDurationMs = (nextGapEdge ?? 0) + 1;
    } else if (nextGapEdge === undefined) {
        gapDurationMs = plan.timeline.durationMs - previousGapEdge;
    } else {
        gapDurationMs = nextGapEdge - previousGapEdge + 1;
    }
    return gapDurationMs + timestampComparisonToleranceMs >= plan.fastForward.minimumSkipIntervalMs;
};

type ObjectComparators<T extends object> = {
    [K in keyof T]-?: (left: T, right: T) => boolean;
};

const playbackPlanRepeatActionComparators: ObjectComparators<PlaybackPlanRepeatAction> = {
    count: (left, right) => left.count === right.count,
};

function arePlaybackPlanRepeatActionsEqual(
    left: PlaybackPlanRepeatAction | undefined,
    right: PlaybackPlanRepeatAction | undefined
): boolean {
    if (left === right) return true;
    if (!left || !right) return false;

    for (const key in playbackPlanRepeatActionComparators) {
        if (!playbackPlanRepeatActionComparators[key as keyof PlaybackPlanRepeatAction](left, right)) return false;
    }
    return true;
}

const playbackPlanEndActionComparators: ObjectComparators<PlaybackPlanEndAction> = {
    pause: (left, right) => left.pause === right.pause,
    repeat: (left, right) => arePlaybackPlanRepeatActionsEqual(left.repeat, right.repeat),
};

function arePlaybackPlanEndActionsEqual(
    left: PlaybackPlanEndAction | undefined,
    right: PlaybackPlanEndAction | undefined
): boolean {
    if (left === right) return true;
    if (!left || !right) return false;

    for (const key in playbackPlanEndActionComparators) {
        if (!playbackPlanEndActionComparators[key as keyof PlaybackPlanEndAction](left, right)) return false;
    }
    return true;
}

const playbackPlanBlockComparators: ObjectComparators<PlaybackPlanBlock> = {
    id: (left, right) => left.id === right.id,
    playbackModeStartMs: (left, right) => left.playbackModeStartMs === right.playbackModeStartMs,
    playbackModeEndMs: (left, right) => left.playbackModeEndMs === right.playbackModeEndMs,
    playbackModeEndExclusiveMs: (left, right) => left.playbackModeEndExclusiveMs === right.playbackModeEndExclusiveMs,
    subtitleTriggerGapEndOffsetMs: (left, right) =>
        left.subtitleTriggerGapEndOffsetMs === right.subtitleTriggerGapEndOffsetMs,
    subtitleTriggerGapStartOffsetMs: (left, right) =>
        left.subtitleTriggerGapStartOffsetMs === right.subtitleTriggerGapStartOffsetMs,
    startAction: (left, right) => left.startAction === right.startAction,
    endAction: (left, right) => arePlaybackPlanEndActionsEqual(left.endAction, right.endAction),
};

function arePlaybackPlanBlocksEqual(left: PlaybackPlanBlock, right: PlaybackPlanBlock): boolean {
    if (left === right) return true;

    for (const key in playbackPlanBlockComparators) {
        if (!playbackPlanBlockComparators[key as keyof PlaybackPlanBlock](left, right)) return false;
    }
    return true;
}

const playbackPlanCondensedComparators: ObjectComparators<PlaybackPlanCondensed> = {
    minimumSkipIntervalMs: (left, right) => left.minimumSkipIntervalMs === right.minimumSkipIntervalMs,
    pauseAtStart: (left, right) => left.pauseAtStart === right.pauseAtStart,
};

function arePlaybackPlanCondensedEqual(
    left: PlaybackPlanCondensed | undefined,
    right: PlaybackPlanCondensed | undefined
): boolean {
    if (left === right) return true;
    if (!left || !right) return false;

    for (const key in playbackPlanCondensedComparators) {
        if (!playbackPlanCondensedComparators[key as keyof PlaybackPlanCondensed](left, right)) return false;
    }
    return true;
}

const playbackPlanFastForwardComparators: ObjectComparators<PlaybackPlanFastForward> = {
    playbackRate: (left, right) => left.playbackRate === right.playbackRate,
    minimumSkipIntervalMs: (left, right) => left.minimumSkipIntervalMs === right.minimumSkipIntervalMs,
};

function arePlaybackPlanFastForwardsEqual(
    left: PlaybackPlanFastForward | undefined,
    right: PlaybackPlanFastForward | undefined
): boolean {
    if (left === right) return true;
    if (!left || !right) return false;

    for (const key in playbackPlanFastForwardComparators) {
        if (!playbackPlanFastForwardComparators[key as keyof PlaybackPlanFastForward](left, right)) return false;
    }
    return true;
}

const playbackTimelineSnapshotComparators: ObjectComparators<
    PlaybackTimelineSnapshot<SubtitleModel, PlaybackPlanBlock>
> = {
    durationMs: (left, right) => left.durationMs === right.durationMs,
    blocks: (left, right) => arrayEquals(left.blocks, right.blocks, arePlaybackPlanBlocksEqual),
    displaySubtitles: (left, right) =>
        arrayEquals(left.displaySubtitles, right.displaySubtitles, areSubtitleModelsEqual),
};

function arePlaybackTimelineSnapshotsEqual(
    left: PlaybackTimelineSnapshot<SubtitleModel, PlaybackPlanBlock>,
    right: PlaybackTimelineSnapshot<SubtitleModel, PlaybackPlanBlock>
): boolean {
    if (left === right) return true;

    for (const key in playbackTimelineSnapshotComparators) {
        if (
            !playbackTimelineSnapshotComparators[key as keyof typeof playbackTimelineSnapshotComparators](left, right)
        ) {
            return false;
        }
    }
    return true;
}

type PlaybackPlanComparators = {
    [K in keyof PlaybackPlan]-?: (left: PlaybackPlan[K], right: PlaybackPlan[K]) => boolean;
};

const playbackPlanComparators: PlaybackPlanComparators = {
    timeline: (left, right) => arePlaybackTimelineSnapshotsEqual(left, right),
    playbackRate: (left, right) => left === right,
    condensed: (left, right) => arePlaybackPlanCondensedEqual(left, right),
    fastForward: (left, right) => arePlaybackPlanFastForwardsEqual(left, right),
};

export const playbackPlansEqual = <T extends SubtitleModel>(left: PlaybackPlan<T>, right: PlaybackPlan<T>): boolean =>
    left === right ||
    (playbackPlanComparators.timeline(left.timeline, right.timeline) &&
        playbackPlanComparators.playbackRate(left.playbackRate, right.playbackRate) &&
        playbackPlanComparators.condensed(left.condensed, right.condensed) &&
        playbackPlanComparators.fastForward(left.fastForward, right.fastForward));
