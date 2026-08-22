import { AutoPausePreference, PlayMode } from '@project/common';
import type { IndexedSubtitleModel } from '@project/common';
import type {
    PlaybackTimelineBlock,
    PlaybackTimelineEndAction,
    PlaybackTimelineRepeatAction,
    PlaybackTimelineState,
} from '@project/common/playback/timeline/playback-timeline';
import { AutoPauseResumeMode, SubtitleVisibility } from '@project/common/settings';
import { compilePlaybackTimelineSubtitles } from '@project/common/playback/timeline/playback-timeline-compiler';
import type { PlaybackTimelineSubtitles } from '@project/common/playback/timeline/playback-timeline-compiler';
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

/**
 * How an automatic pause ends on its own. Which edges pause is already encoded in the timeline
 * blocks, so only the policy that the blocks cannot express lives here.
 */
export interface PlaybackPlanAutoPauseResume {
    readonly mode: AutoPauseResumeMode.fixed | AutoPauseResumeMode.subtitleLength;
    readonly fixedDurationMs: number;
    readonly minimumDurationMs: number;
    /** Zero means no upper bound. */
    readonly maximumDurationMs: number;
    readonly timePerCharacterMs: number;
    /** Silence between hiding the subtitle and resuming, so the audio is heard on its own. */
    readonly delayMs: number;
}

/** Playback policy compiled and applied beside its owning media element. */
export interface PlaybackPlan<T extends IndexedSubtitleModel> {
    readonly timelineSubtitles: PlaybackTimelineSubtitles<T>;
    readonly playbackRate: number;
    readonly condensed?: PlaybackPlanCondensed;
    readonly fastForward?: PlaybackPlanFastForward;
    readonly autoPauseResume?: PlaybackPlanAutoPauseResume;
    /** Subtitles are only allowed on screen while playback is paused for them. */
    readonly subtitlesWhilePausedOnly: boolean;
}

export interface PlaybackPlanInput<T extends IndexedSubtitleModel> {
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
    readonly autoPauseResumeMode: AutoPauseResumeMode;
    readonly autoPauseResumeDelayMs: number;
    readonly autoPauseFixedDurationMs: number;
    readonly autoPauseMinimumDurationMs: number;
    readonly autoPauseMaximumDurationMs: number;
    readonly autoPauseTimePerCharacterMs: number;
    readonly subtitleVisibility: SubtitleVisibility;
}

const autoPausePreferenceIncludes = (
    preference: AutoPausePreference,
    edge: AutoPausePreference.atStart | AutoPausePreference.atEnd
) => preference === edge || preference === AutoPausePreference.atStartAndEnd;

export const timestampComparisonToleranceMs = 1e-6;

export const buildPlaybackPlan = <T extends IndexedSubtitleModel>({
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
    autoPauseResumeMode,
    autoPauseResumeDelayMs,
    autoPauseFixedDurationMs,
    autoPauseMinimumDurationMs,
    autoPauseMaximumDurationMs,
    autoPauseTimePerCharacterMs,
    subtitleVisibility,
}: PlaybackPlanInput<T>): PlaybackPlan<T> => {
    const autoPause = playModes.has(PlayMode.autoPause);
    const autoPauseAtStart = autoPause && autoPausePreferenceIncludes(autoPausePreference, AutoPausePreference.atStart);
    const autoPauseAtEnd = autoPause && autoPausePreferenceIncludes(autoPausePreference, AutoPausePreference.atEnd);
    const repeat = playModes.has(PlayMode.repeat);
    const startOffset = normalizeFinite(subtitleTriggerStartOffset);
    const gapEndOffset = normalizeNonPositive(subtitleTriggerGapEndOffset);
    const condensedMinimumSkipIntervalMs = normalizeNonNegative(condensedPlaybackMinimumSkipIntervalMs);
    const fastForwardMinimumSkipIntervalMs = normalizeNonNegative(fastForwardPlaybackMinimumSkipIntervalMs);
    const minimumDurationMs = normalizeNonNegative(autoPauseMinimumDurationMs);
    const maximumDurationMs = normalizeNonNegative(autoPauseMaximumDurationMs);
    const autoPauseResume =
        autoPause && autoPauseResumeMode !== AutoPauseResumeMode.manual
            ? {
                  mode: autoPauseResumeMode,
                  fixedDurationMs: normalizeNonNegative(autoPauseFixedDurationMs),
                  minimumDurationMs,
                  // Zero keeps its "no upper bound" meaning instead of clamping every pause away.
                  maximumDurationMs: maximumDurationMs === 0 ? 0 : Math.max(minimumDurationMs, maximumDurationMs),
                  timePerCharacterMs: normalizeNonNegative(autoPauseTimePerCharacterMs),
                  delayMs: normalizeNonNegative(autoPauseResumeDelayMs),
              }
            : undefined;
    const timeline = compilePlaybackTimelineSubtitles({
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
        timelineSubtitles: {
            ...timeline,
            blocks,
        },
        playbackRate,
        subtitlesWhilePausedOnly: subtitleVisibility === SubtitleVisibility.whilePaused,
        ...(autoPauseResume === undefined ? {} : { autoPauseResume }),
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

export const fastForwardingForPlanState = <T extends IndexedSubtitleModel>(
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
        gapDurationMs = plan.timelineSubtitles.durationMs - previousGapEdge;
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

const playbackPlanAutoPauseResumeComparators: ObjectComparators<PlaybackPlanAutoPauseResume> = {
    mode: (left, right) => left.mode === right.mode,
    fixedDurationMs: (left, right) => left.fixedDurationMs === right.fixedDurationMs,
    minimumDurationMs: (left, right) => left.minimumDurationMs === right.minimumDurationMs,
    maximumDurationMs: (left, right) => left.maximumDurationMs === right.maximumDurationMs,
    timePerCharacterMs: (left, right) => left.timePerCharacterMs === right.timePerCharacterMs,
    delayMs: (left, right) => left.delayMs === right.delayMs,
};

function arePlaybackPlanAutoPauseResumesEqual(
    left: PlaybackPlanAutoPauseResume | undefined,
    right: PlaybackPlanAutoPauseResume | undefined
): boolean {
    if (left === right) return true;
    if (!left || !right) return false;

    for (const key in playbackPlanAutoPauseResumeComparators) {
        if (!playbackPlanAutoPauseResumeComparators[key as keyof PlaybackPlanAutoPauseResume](left, right)) {
            return false;
        }
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

const playbackTimelineSubtitlesComparators: ObjectComparators<PlaybackTimelineSubtitles<IndexedSubtitleModel>> = {
    durationMs: (left, right) => left.durationMs === right.durationMs,
    blocks: (left, right) => arrayEquals(left.blocks, right.blocks, arePlaybackTimelineBlocksEqual),
    displaySubtitles: (left, right) =>
        arrayEquals(left.displaySubtitles, right.displaySubtitles, areSubtitleModelsEqual),
};

function arePlaybackTimelineSubtitlesEqual(
    left: PlaybackTimelineSubtitles<IndexedSubtitleModel>,
    right: PlaybackTimelineSubtitles<IndexedSubtitleModel>
): boolean {
    if (left === right) return true;

    for (const key in playbackTimelineSubtitlesComparators) {
        if (
            !playbackTimelineSubtitlesComparators[key as keyof typeof playbackTimelineSubtitlesComparators](left, right)
        ) {
            return false;
        }
    }
    return true;
}

type PlaybackPlanComparators = {
    [K in keyof PlaybackPlan<IndexedSubtitleModel>]-?: (
        left: PlaybackPlan<IndexedSubtitleModel>[K],
        right: PlaybackPlan<IndexedSubtitleModel>[K]
    ) => boolean;
};

const playbackPlanComparators: PlaybackPlanComparators = {
    timelineSubtitles: (left, right) => arePlaybackTimelineSubtitlesEqual(left, right),
    playbackRate: (left, right) => left === right,
    condensed: (left, right) => arePlaybackPlanCondensedEqual(left, right),
    fastForward: (left, right) => arePlaybackPlanFastForwardsEqual(left, right),
    autoPauseResume: (left, right) => arePlaybackPlanAutoPauseResumesEqual(left, right),
    subtitlesWhilePausedOnly: (left, right) => left === right,
};

export const playbackPlansEqual = <T extends IndexedSubtitleModel>(
    left: PlaybackPlan<T>,
    right: PlaybackPlan<T>
): boolean =>
    left === right ||
    (playbackPlanComparators.timelineSubtitles(left.timelineSubtitles, right.timelineSubtitles) &&
        playbackPlanComparators.playbackRate(left.playbackRate, right.playbackRate) &&
        playbackPlanComparators.condensed(left.condensed, right.condensed) &&
        playbackPlanComparators.fastForward(left.fastForward, right.fastForward) &&
        playbackPlanComparators.autoPauseResume(left.autoPauseResume, right.autoPauseResume) &&
        playbackPlanComparators.subtitlesWhilePausedOnly(
            left.subtitlesWhilePausedOnly,
            right.subtitlesWhilePausedOnly
        ));
