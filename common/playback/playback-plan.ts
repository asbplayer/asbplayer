import { AutoPausePreference, PlayMode, type SubtitleModel } from '@project/common';
import type {
    PlaybackTimelineBlock,
    PlaybackTimelineEndAction,
    PlaybackTimelineRepeatAction,
    PlaybackTimelineSnapshot,
    PlaybackTimelineState,
} from '@project/common/playback/playback-timeline';
import { compilePlaybackTimeline } from '@project/common/playback/playback-timeline-compiler';
import {
    areSubtitleModelsEqual,
    arrayEquals,
    normalizeFinite,
    normalizeNonNegative,
    normalizeNonPositive,
} from '@project/common/util';

export const playbackPlanCorrectionToleranceMs = 0.5;

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
    readonly timeline: PlaybackTimelineSnapshot<T>;
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
    const startOffset = normalizeFinite(subtitleTriggerStartOffset);
    const gapEndOffset = normalizeNonPositive(subtitleTriggerGapEndOffset);
    const condensedMinimumSkipIntervalMs = normalizeNonNegative(condensedPlaybackMinimumSkipIntervalMs);
    const fastForwardMinimumSkipIntervalMs = normalizeNonNegative(fastForwardPlaybackMinimumSkipIntervalMs);
    const timeline = compilePlaybackTimeline({
        subtitles,
        displaySubtitles,
        durationMs,
        subtitleTriggerStartOffset,
        subtitleTriggerEndOffset,
        subtitleTriggerGapStartOffset,
        subtitleTriggerGapEndOffset,
    });

    const blocks = timeline.blocks.map<PlaybackTimelineBlock>((block) => ({
        ...block,
        ...(autoPauseAtStart ? { startAction: true as const } : {}),
        ...(autoPauseAtEnd || repeat
            ? {
                  endAction: {
                      pause: autoPauseAtEnd,
                      ...(repeat
                          ? {
                                repeat: {
                                    count: normalizeNonNegative(Math.floor(repeatCountPreference)),
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
                      minimumSkipIntervalMs: condensedMinimumSkipIntervalMs,
                      pauseAtStart:
                          autoPauseAtStart && startOffset <= 0 && Math.abs(gapEndOffset) <= Math.abs(startOffset),
                  },
              }
            : {}),
        ...(playModes.has(PlayMode.fastForward)
            ? {
                  fastForward: {
                      playbackRate: fastForwardModePlaybackRate,
                      minimumSkipIntervalMs: fastForwardMinimumSkipIntervalMs,
                  },
              }
            : {}),
    };
};

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
        gapDurationMs = nextGapEdge! + 1;
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

const playbackTimelineRepeatActionComparators: ObjectComparators<PlaybackTimelineRepeatAction> = {
    count: (left, right) => left.count === right.count,
};

function arePlaybackTimelineRepeatActionsEqual(
    left: PlaybackTimelineRepeatAction | undefined,
    right: PlaybackTimelineRepeatAction | undefined
): boolean {
    if (left === right) return true;
    if (!left || !right) return false;

    for (const key in playbackTimelineRepeatActionComparators) {
        if (!playbackTimelineRepeatActionComparators[key as keyof PlaybackTimelineRepeatAction](left, right))
            return false;
    }
    return true;
}

const playbackTimelineEndActionComparators: ObjectComparators<PlaybackTimelineEndAction> = {
    pause: (left, right) => left.pause === right.pause,
    repeat: (left, right) => arePlaybackTimelineRepeatActionsEqual(left.repeat, right.repeat),
};

function arePlaybackTimelineEndActionsEqual(
    left: PlaybackTimelineEndAction | undefined,
    right: PlaybackTimelineEndAction | undefined
): boolean {
    if (left === right) return true;
    if (!left || !right) return false;

    for (const key in playbackTimelineEndActionComparators) {
        if (!playbackTimelineEndActionComparators[key as keyof PlaybackTimelineEndAction](left, right)) return false;
    }
    return true;
}

const playbackTimelineBlockComparators: ObjectComparators<PlaybackTimelineBlock> = {
    id: (left, right) => left.id === right.id,
    playbackModeStartMs: (left, right) => left.playbackModeStartMs === right.playbackModeStartMs,
    playbackModeEndMs: (left, right) => left.playbackModeEndMs === right.playbackModeEndMs,
    playbackModeEndExclusiveMs: (left, right) => left.playbackModeEndExclusiveMs === right.playbackModeEndExclusiveMs,
    subtitleTriggerGapEndOffsetMs: (left, right) =>
        left.subtitleTriggerGapEndOffsetMs === right.subtitleTriggerGapEndOffsetMs,
    subtitleTriggerGapStartOffsetMs: (left, right) =>
        left.subtitleTriggerGapStartOffsetMs === right.subtitleTriggerGapStartOffsetMs,
    startAction: (left, right) => left.startAction === right.startAction,
    endAction: (left, right) => arePlaybackTimelineEndActionsEqual(left.endAction, right.endAction),
};

function arePlaybackTimelineBlocksEqual(left: PlaybackTimelineBlock, right: PlaybackTimelineBlock): boolean {
    if (left === right) return true;

    for (const key in playbackTimelineBlockComparators) {
        if (!playbackTimelineBlockComparators[key as keyof PlaybackTimelineBlock](left, right)) return false;
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

const playbackTimelineSnapshotComparators: ObjectComparators<PlaybackTimelineSnapshot<SubtitleModel>> = {
    durationMs: (left, right) => left.durationMs === right.durationMs,
    blocks: (left, right) => arrayEquals(left.blocks, right.blocks, arePlaybackTimelineBlocksEqual),
    displaySubtitles: (left, right) =>
        arrayEquals(left.displaySubtitles, right.displaySubtitles, areSubtitleModelsEqual),
};

function arePlaybackTimelineSnapshotsEqual(
    left: PlaybackTimelineSnapshot<SubtitleModel>,
    right: PlaybackTimelineSnapshot<SubtitleModel>
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
