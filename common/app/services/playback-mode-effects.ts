import { AutoPausePreference, PlayMode, SubtitleModel } from '@project/common';
import { isTrackSeekable } from '@project/common/settings';
import { type SubtitleCollection, SubtitleSlice } from '@project/common/subtitle-collection';

export interface SubtitleStopPlaybackModeEffect {
    resetPendingAutoRepeatTargetTimestamp: boolean;
    pause: boolean;
    seekTimestamp?: number;
    pendingAutoRepeatTargetTimestamp?: number;
    preservePlaybackStateWhileSeeking: boolean;
    recordSeekDuration: boolean;
}

export interface PlaybackModeEffectClock {
    readonly running: boolean;
    stop(): void;
    start(): void;
}

const noSubtitleStopPlaybackModeEffect: SubtitleStopPlaybackModeEffect = {
    resetPendingAutoRepeatTargetTimestamp: false,
    pause: false,
    preservePlaybackStateWhileSeeking: false,
    recordSeekDuration: false,
};

export function shouldAutoPauseAtSubtitleStart({
    playModes,
    autoPausePreference,
    seekableTracks,
    subtitle,
    delegatedToVideoPlayer,
}: {
    playModes: Set<PlayMode>;
    autoPausePreference: AutoPausePreference;
    seekableTracks: number;
    subtitle: SubtitleModel;
    delegatedToVideoPlayer: boolean;
}) {
    return (
        playModes.has(PlayMode.autoPause) &&
        autoPausePreference === AutoPausePreference.atStart &&
        isTrackSeekable(seekableTracks, subtitle.track) &&
        !delegatedToVideoPlayer
    );
}

export function shouldAutoPauseAtSubtitleEnd({
    playModes,
    autoPausePreference,
    seekableTracks,
    subtitle,
    delegatedToVideoPlayer,
}: {
    playModes: Set<PlayMode>;
    autoPausePreference: AutoPausePreference;
    seekableTracks: number;
    subtitle: SubtitleModel;
    delegatedToVideoPlayer: boolean;
}) {
    return (
        playModes.has(PlayMode.autoPause) &&
        autoPausePreference === AutoPausePreference.atEnd &&
        isTrackSeekable(seekableTracks, subtitle.track) &&
        !delegatedToVideoPlayer
    );
}

export function pendingPlaybackModeSeekTimestamp(playModes: Set<PlayMode>, pendingTimestamp: number) {
    if (pendingTimestamp <= 0) return;
    if (playModes.has(PlayMode.repeat) || playModes.has(PlayMode.autoPause)) return pendingTimestamp;
}

export async function applySubtitleStopPlaybackModeEffect({
    effect,
    clock,
    pause,
    seek,
    resetPendingAutoRepeatTargetTimestamp,
    setPendingAutoRepeatTargetTimestamp,
    setLastSeekDuration,
    now = Date.now,
}: {
    effect: SubtitleStopPlaybackModeEffect;
    clock: PlaybackModeEffectClock;
    pause: () => void;
    seek: (timestamp: number) => Promise<void>;
    resetPendingAutoRepeatTargetTimestamp: () => void;
    setPendingAutoRepeatTargetTimestamp: (timestamp: number) => void;
    setLastSeekDuration: (duration: number) => void;
    now?: () => number;
}) {
    if (!effect.resetPendingAutoRepeatTargetTimestamp) return;

    resetPendingAutoRepeatTargetTimestamp();

    if (effect.pause) pause();

    if (effect.pendingAutoRepeatTargetTimestamp !== undefined) {
        setPendingAutoRepeatTargetTimestamp(effect.pendingAutoRepeatTargetTimestamp);
        return;
    }

    if (effect.seekTimestamp === undefined) return;

    const wasPlaying = clock.running;
    if (effect.preservePlaybackStateWhileSeeking && wasPlaying) clock.stop();

    const startedAt = now();
    await seek(effect.seekTimestamp);
    if (effect.recordSeekDuration) setLastSeekDuration(now() - startedAt);

    if (effect.preservePlaybackStateWhileSeeking && wasPlaying) clock.start();
}

export function selectSubtitleStopPlaybackModeEffect({
    playModes,
    autoPausePreference,
    seekableTracks,
    subtitle,
    subtitleCollection,
    delegatedToVideoPlayer,
    lastSeekDuration,
}: {
    playModes: Set<PlayMode>;
    autoPausePreference: AutoPausePreference;
    seekableTracks: number;
    subtitle: SubtitleModel;
    subtitleCollection: Pick<SubtitleCollection<SubtitleModel>, 'subtitlesAt'>;
    delegatedToVideoPlayer: boolean;
    lastSeekDuration: number;
}): SubtitleStopPlaybackModeEffect {
    if (!isTrackSeekable(seekableTracks, subtitle.track)) return noSubtitleStopPlaybackModeEffect;

    const effect: SubtitleStopPlaybackModeEffect = {
        resetPendingAutoRepeatTargetTimestamp: true,
        pause: false,
        preservePlaybackStateWhileSeeking: false,
        recordSeekDuration: false,
    };
    const isAutoPauseAtEndEnabled =
        playModes.has(PlayMode.autoPause) && autoPausePreference === AutoPausePreference.atEnd;
    const isAutoPauseAtStartEnabled =
        playModes.has(PlayMode.autoPause) && autoPausePreference === AutoPausePreference.atStart;
    const isRepeatEnabled = playModes.has(PlayMode.repeat);
    const isCondensedEnabled = playModes.has(PlayMode.condensed);

    if (!isAutoPauseAtEndEnabled && !isRepeatEnabled && !isAutoPauseAtStartEnabled) return effect;

    if (isAutoPauseAtEndEnabled && !delegatedToVideoPlayer) effect.pause = true;

    if (isRepeatEnabled) {
        if (isAutoPauseAtEndEnabled) {
            effect.pendingAutoRepeatTargetTimestamp = subtitle.start;
        } else {
            effect.seekTimestamp = subtitle.start;
        }
        return effect;
    }

    if (isCondensedEnabled) {
        const seekTimestamp = selectCondensedPlaybackSeekTimestamp({
            slice: subtitleCollection.subtitlesAt(subtitle.end + 1),
            timestamp: subtitle.end,
            expectedSeekTime: lastSeekDuration || 1000,
            pendingAutoRepeatTargetTimestamp: 0,
        });

        if (seekTimestamp !== undefined) {
            if (isAutoPauseAtEndEnabled) {
                effect.pendingAutoRepeatTargetTimestamp = seekTimestamp;
            } else {
                effect.seekTimestamp = seekTimestamp;
                effect.preservePlaybackStateWhileSeeking = true;
                effect.recordSeekDuration = true;
            }
        }
    }

    return effect;
}

export function selectCondensedPlaybackSeekTimestamp<T extends SubtitleModel>({
    slice,
    timestamp,
    expectedSeekTime,
    pendingAutoRepeatTargetTimestamp,
}: {
    slice: SubtitleSlice<T>;
    timestamp: number;
    expectedSeekTime: number;
    pendingAutoRepeatTargetTimestamp: number;
}) {
    if (pendingAutoRepeatTargetTimestamp > 0 || !slice.nextToShow || slice.nextToShow.length === 0) return;
    const nextSubtitle = slice.nextToShow[0];
    if (nextSubtitle.start - timestamp < expectedSeekTime + 500) return;
    return nextSubtitle.start;
}

export function selectFastForwardPlaybackRate<T extends SubtitleModel>({
    slice,
    timestamp,
    fastForwardModePlaybackRate,
}: {
    slice: SubtitleSlice<T>;
    timestamp: number;
    fastForwardModePlaybackRate: number;
}) {
    if (
        slice.showing.length === 0 &&
        (slice.nextToShow === undefined ||
            (slice.nextToShow.length > 0 && slice.nextToShow[0].start - timestamp > 1000))
    ) {
        return fastForwardModePlaybackRate;
    }

    return 1;
}
