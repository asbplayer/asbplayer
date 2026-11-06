import type { AudioSeekableRange } from '@project/common/audio-transcode/streaming-audio';

/** Browser-independent media state; all positions and durations are milliseconds. */
export interface VideoPlaybackState {
    readonly currentTimeMs: number;
    readonly paused: boolean;
    readonly ready: boolean;
    readonly playbackRate: number;
    readonly preservesPitch: boolean;
    readonly volume: number;
    readonly muted: boolean;
}

export type AudioPlaybackSettings = Pick<VideoPlaybackState, 'playbackRate' | 'preservesPitch' | 'volume'>;

export interface AudioPlaybackState {
    readonly attached: boolean;
    readonly currentTimeMs: number;
    readonly durationMs: number;
    readonly paused: boolean;
    readonly ended: boolean;
    readonly hasMetadata: boolean;
    readonly ready: boolean;
    readonly buffered: AudioSeekableRange;
}

export type VideoPlaybackEvent =
    | 'play'
    | 'playing'
    | 'pause'
    | 'seeking'
    | 'seeked'
    | 'waiting'
    | 'canplay'
    | 'ended'
    | 'ratechange'
    | 'volumechange'
    | 'play-requested'
    | 'pause-requested';

export type AudioPlaybackEvent = 'waiting' | 'ended' | 'canplay' | 'progress';
