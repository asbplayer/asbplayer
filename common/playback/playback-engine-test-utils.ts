import { AutoPausePreference, PlayMode, type IndexedSubtitleModel, type SubtitleModel } from '@project/common';
import type { PlaybackPlanInput } from '@project/common/playback/playback-plan';
import PlaybackTimeline from '@project/common/playback/playback-timeline';
import {
    compilePlaybackTimeline,
    type PlaybackTimelineOptions,
} from '@project/common/playback/playback-timeline-compiler';
import type { TimingDriverCallbacks } from '@project/common/playback/timing-driver';

export const emptyTimingDriverCallbacks: TimingDriverCallbacks = {
    onTime: async () => {},
    onPlaybackStarted: async () => {},
    onDiscontinuity: () => {},
    onCancel: () => {},
    onError: () => {},
};

export function makeSubtitle(overrides?: Partial<SubtitleModel>): SubtitleModel;
export function makeSubtitle(
    start: number,
    end: number,
    index: number,
    overrides?: Partial<SubtitleModel>
): SubtitleModel;
export function makeSubtitle(
    startOrOverrides: number | Partial<SubtitleModel> = 1000,
    end = 2000,
    index = 0,
    overrides: Partial<SubtitleModel> = {}
): SubtitleModel {
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

export function makeIndexedSubtitle(overrides?: Partial<IndexedSubtitleModel>): IndexedSubtitleModel;
export function makeIndexedSubtitle(
    start: number,
    end: number,
    index: number,
    overrides?: Partial<IndexedSubtitleModel>
): IndexedSubtitleModel;
export function makeIndexedSubtitle(
    startOrOverrides: number | Partial<IndexedSubtitleModel> = 1000,
    end = 2000,
    index = 0,
    overrides: Partial<IndexedSubtitleModel> = {}
): IndexedSubtitleModel {
    if (typeof startOrOverrides !== 'number') {
        return {
            ...makeSubtitle(),
            ...startOrOverrides,
            index: startOrOverrides.index ?? 0,
        };
    }

    return {
        ...makeSubtitle(startOrOverrides, end, index, overrides),
        index,
        ...overrides,
    };
}

export const makeTextSubtitle = (start: number, end: number, text: string, index: number, track = 0): SubtitleModel =>
    makeSubtitle(start, end, index, { text, track });

export const makeTimelineOptions = (
    subtitles: readonly SubtitleModel[],
    options: Partial<PlaybackTimelineOptions<SubtitleModel>> = {}
): PlaybackTimelineOptions<SubtitleModel> => ({
    subtitles,
    durationMs: 10_000,
    playbackModeStartOffset: 0,
    playbackModeEndOffset: 0,
    playbackModesStartGap: 0,
    playbackModesEndGap: 0,
    ...options,
});

export const makeTimeline = (
    subtitles: readonly SubtitleModel[],
    options: Partial<PlaybackTimelineOptions<SubtitleModel>> = {}
): PlaybackTimeline<SubtitleModel> =>
    PlaybackTimeline.fromSnapshot(compilePlaybackTimeline(makeTimelineOptions(subtitles, options)));

export const makePlaybackPlanInput = <T extends SubtitleModel>(
    subtitles: readonly T[],
    options: Partial<PlaybackPlanInput<T>> = {}
): PlaybackPlanInput<T> => ({
    subtitles,
    durationMs: 6000,
    playModes: new Set([PlayMode.normal]),
    autoPausePreference: AutoPausePreference.atEnd,
    playbackModeStartOffset: 0,
    playbackModeEndOffset: 0,
    playbackModesStartGap: 0,
    playbackModesEndGap: 0,
    repeatCountPreference: 0,
    condensedPlaybackMinimumSkipIntervalMs: 500,
    playbackRate: 1.25,
    fastForwardModePlaybackRate: 2.5,
    fastForwardPlaybackMinimumSkipIntervalMs: 250,
    ...options,
});
