import { AutoPausePreference, PlayMode, type SubtitleModel } from '@project/common';
import type {
    PlaybackTimelineBlock,
    PlaybackTimelineSnapshot,
    PlaybackTimelineState,
} from '@project/common/playback/playback-timeline';
import { compilePlaybackTimeline } from '@project/common/playback/playback-timeline-compiler';

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
