import { AutoPausePreference, PlayMode } from '@project/common';
import { AutoPauseResumeMode, SubtitleVisibility } from '@project/common/settings';
import type { IndexedSubtitleModel } from '@project/common';
import type { PlaybackPlanInput } from '@project/common/playback/plan/playback-plan';
import PlaybackTimeline from '@project/common/playback/timeline/playback-timeline';
import { compilePlaybackTimelineSubtitles } from '@project/common/playback/timeline/playback-timeline-compiler';
import type { PlaybackTimelineOptions } from '@project/common/playback/timeline/playback-timeline-compiler';
import type { TimingDriverCallbacks } from '@project/common/playback/timing/timing-driver';

export const emptyTimingDriverCallbacks: TimingDriverCallbacks = {
    onTime: async () => {},
    onPlaybackStarted: async () => {},
    onPlaybackPaused: () => {},
    onDiscontinuity: () => {},
    onCancel: () => {},
    onError: () => {},
};

export function makeSubtitle(overrides?: Partial<IndexedSubtitleModel>): IndexedSubtitleModel;
export function makeSubtitle(
    start: number,
    end: number,
    index: number,
    overrides?: Partial<IndexedSubtitleModel>
): IndexedSubtitleModel;
export function makeSubtitle(
    startOrOverrides: number | Partial<IndexedSubtitleModel> = 1000,
    end = 2000,
    index = 0,
    overrides: Partial<IndexedSubtitleModel> = {}
): IndexedSubtitleModel {
    if (typeof startOrOverrides !== 'number') {
        return {
            text: 'subtitle',
            start: 1000,
            end: 2000,
            originalStart: 1000,
            originalEnd: 2000,
            track: 0,
            index: 0,
            ...startOrOverrides,
        };
    }

    return {
        text: `subtitle ${index}`,
        start: startOrOverrides,
        end,
        originalStart: startOrOverrides,
        originalEnd: end,
        track: 0,
        index,
        ...overrides,
    };
}

export const makeTextSubtitle = (
    start: number,
    end: number,
    text: string,
    index: number,
    track = 0
): IndexedSubtitleModel => makeSubtitle(start, end, index, { text, track });

export const makeTimelineOptions = (
    subtitles: readonly IndexedSubtitleModel[],
    options: Partial<PlaybackTimelineOptions<IndexedSubtitleModel>> = {}
): PlaybackTimelineOptions<IndexedSubtitleModel> => ({
    subtitles,
    durationMs: 10_000,
    subtitleTriggerStartOffset: 0,
    subtitleTriggerEndOffset: 0,
    subtitleTriggerGapEndOffset: 0,
    subtitleTriggerGapStartOffset: 0,
    ...options,
});

export const makeTimeline = (
    subtitles: readonly IndexedSubtitleModel[],
    options: Partial<PlaybackTimelineOptions<IndexedSubtitleModel>> = {}
): PlaybackTimeline<IndexedSubtitleModel> =>
    PlaybackTimeline.fromSubtitles(compilePlaybackTimelineSubtitles(makeTimelineOptions(subtitles, options)));

export const makePlaybackPlanInput = <T extends IndexedSubtitleModel>(
    subtitles: readonly T[],
    options: Partial<PlaybackPlanInput<T>> = {}
): PlaybackPlanInput<T> => ({
    subtitles,
    durationMs: 6000,
    playModes: new Set([PlayMode.normal]),
    autoPausePreference: AutoPausePreference.atEnd,
    subtitleTriggerStartOffset: 0,
    subtitleTriggerEndOffset: 0,
    subtitleTriggerGapEndOffset: 0,
    subtitleTriggerGapStartOffset: 0,
    repeatCountPreference: 0,
    condensedPlaybackMinimumSkipIntervalMs: 500,
    playbackRate: 1.25,
    fastForwardModePlaybackRate: 2.5,
    fastForwardPlaybackMinimumSkipIntervalMs: 250,
    autoPauseResumeMode: AutoPauseResumeMode.manual,
    autoPauseResumeDelayMs: 300,
    autoPauseFixedDurationMs: 2000,
    autoPauseMinimumDurationMs: 500,
    autoPauseMaximumDurationMs: 2000,
    autoPauseTimePerCharacterMs: 100,
    subtitleVisibility: SubtitleVisibility.always,
    ...options,
});
