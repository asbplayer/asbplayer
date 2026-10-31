import { clampAudioSeekMs } from '@project/common/audio-transcode/streaming-audio';
import type { PlaybackSeekOptions } from '@project/common/playback/playback-engine';
import type {
    AudioPlaybackEvent,
    AudioPlaybackSettings,
    AudioPlaybackState,
    VideoPlaybackEvent,
    VideoPlaybackState,
} from '@project/common/playback/media/media';
import { asbError, asbWarn } from '@project/common/util/log';

const driftToleranceMs = 150;
const resyncThresholdMs = 500;
const driftCheckIntervalMs = 250;

export interface ExternalAudioTrack {
    readonly active: boolean;
    readonly streaming: boolean;
}

interface ExternalAudioControllerCallbacks {
    readonly videoState: () => VideoPlaybackState;
    readonly audioState: () => AudioPlaybackState;
    readonly play: () => Promise<void>;
    readonly pause: () => void;
    readonly seek: (timestampMs: number) => Promise<void>;
    readonly playAudio: () => Promise<boolean>;
    readonly pauseAudio: () => void;
    readonly seekAudio: (timestampMs: number) => void;
    readonly audioSettingsChanged: (settings: AudioPlaybackSettings) => void;
    readonly onError: (error: unknown) => void;
}

/** Coordinates external audio using media state and engine callbacks, without browser elements or events. */
export default class ExternalAudioController {
    private track: ExternalAudioTrack = { active: false, streaming: false };
    private bound = false;
    private resumeAfterBuffering = false;
    private internallyPausing = false;
    private pendingPositionMs?: number;
    private videoWaiting = false;
    private playbackFailureLogged = false;
    private generation = 0;
    private interval?: ReturnType<typeof setInterval>;

    constructor(private readonly callbacks: ExternalAudioControllerCallbacks) {}

    bind(): void {
        if (this.bound) return;
        this.bound = true;
        this.attach();
    }

    unbind(): void {
        this.bound = false;
        ++this.generation;
        clearInterval(this.interval);
        this.interval = undefined;
        this.callbacks.pauseAudio();
        this.resumeAfterBuffering = false;
        this.internallyPausing = false;
    }

    trackChanged(track: ExternalAudioTrack): void {
        ++this.generation;
        this.track = track;
        this.playbackFailureLogged = false;
        this.videoWaiting = false;
        clearInterval(this.interval);
        this.interval = undefined;
        if (!track.active) {
            this.resumeAfterBuffering = false;
            this.internallyPausing = false;
        }
        if (this.bound) this.attach();
    }

    pauseRequested(): void {
        this.resumeAfterBuffering = false;
    }

    clampSeekMs(timestampMs: number, { restorePlaybackPosition = false }: PlaybackSeekOptions = {}): number {
        if (this.track.active && this.track.streaming) {
            if (restorePlaybackPosition) {
                this.pendingPositionMs = timestampMs;
            } else {
                timestampMs = clampAudioSeekMs(timestampMs, this.callbacks.audioState().buffered);
                this.pendingPositionMs = undefined;
            }
        }
        return timestampMs;
    }

    videoEvent(event: VideoPlaybackEvent): void {
        if (!this.bound || !this.track.active) return;
        switch (event) {
            case 'play':
            case 'playing':
                this.play();
                break;
            case 'pause':
            case 'ended':
                this.callbacks.pauseAudio();
                if (this.internallyPausing) this.internallyPausing = false;
                else this.resumeAfterBuffering = false;
                break;
            case 'seeking': {
                const timestampMs = this.callbacks.videoState().currentTimeMs;
                if (this.track.streaming && this.pendingPositionMs !== timestampMs) {
                    const targetMs = clampAudioSeekMs(timestampMs, this.callbacks.audioState().buffered);
                    if (Math.abs(targetMs - timestampMs) > 25) {
                        void this.callbacks.seek(targetMs).catch((error: unknown) => this.callbacks.onError(error));
                    }
                    this.pendingPositionMs = undefined;
                }
                this.synchronizeTime();
                break;
            }
            case 'seeked':
                this.synchronizeTime();
                if (!this.callbacks.videoState().paused) this.play();
                break;
            case 'waiting':
                this.videoWaiting = true;
                this.callbacks.pauseAudio();
                break;
            case 'canplay':
                this.videoWaiting = false;
                this.canPlay();
                break;
            case 'ratechange':
            case 'volumechange':
                this.callbacks.audioSettingsChanged(this.callbacks.videoState());
                break;
        }
    }

    audioEvent(event: AudioPlaybackEvent): void {
        if (!this.bound || !this.track.active) return;
        if (event === 'waiting') {
            if (!this.audioFinished()) this.pauseForAudio();
        } else {
            this.canPlay();
        }
    }

    audioError(error: unknown): void {
        if (!this.bound || !this.track.active) return;
        this.pauseForAudio();
        this.resumeAfterBuffering = false;
        asbError('audio/playback', 'Converted audio media error', { error });
        this.callbacks.onError(error);
    }

    private attach(): void {
        if (!this.track.active) return;
        this.pendingPositionMs = this.track.streaming ? this.callbacks.videoState().currentTimeMs : undefined;
        this.callbacks.audioSettingsChanged(this.callbacks.videoState());
        this.synchronizeTime();
        if (!this.callbacks.videoState().paused) this.play();
        else if (this.resumeAfterBuffering) this.canPlay();
        this.interval = setInterval(() => this.correctDrift(), driftCheckIntervalMs);
    }

    private audioFinished(): boolean {
        const audio = this.callbacks.audioState();
        const timestampMs = this.callbacks.videoState().currentTimeMs;
        return (
            !this.track.streaming &&
            audio.attached &&
            Number.isFinite(audio.durationMs) &&
            (timestampMs >= audio.durationMs || (audio.ended && timestampMs >= audio.durationMs - driftToleranceMs))
        );
    }

    private playable(): boolean {
        if (this.audioFinished()) return true;
        const audio = this.callbacks.audioState();
        if (!audio.attached || !audio.ready) return false;
        if (!this.track.streaming) return true;
        const timestampMs = this.callbacks.videoState().currentTimeMs;
        return audio.buffered.end > timestampMs + 50 && audio.buffered.start <= timestampMs + 20;
    }

    private synchronizeTime(): void {
        const audio = this.callbacks.audioState();
        const timestampMs = this.callbacks.videoState().currentTimeMs;
        if (this.audioFinished()) {
            this.callbacks.pauseAudio();
            return;
        }
        if (this.track.streaming) {
            if (audio.buffered.start > timestampMs || audio.buffered.end <= timestampMs) return;
            this.pendingPositionMs = undefined;
        }
        if (audio.hasMetadata && Math.abs(audio.currentTimeMs - timestampMs) > driftToleranceMs) {
            this.callbacks.seekAudio(timestampMs);
        }
    }

    private pauseForAudio(): void {
        if (!this.callbacks.videoState().paused) {
            this.resumeAfterBuffering = true;
            this.internallyPausing = true;
            this.callbacks.pause();
        }
        this.callbacks.pauseAudio();
    }

    private playAudio(): void {
        if (this.audioFinished()) return;
        const generation = this.generation;
        void this.callbacks.playAudio().then(
            (played) => {
                if (generation === this.generation && played) this.playbackFailureLogged = false;
            },
            (error: unknown) => {
                if (generation !== this.generation) return;
                this.pauseForAudio();
                this.resumeAfterBuffering = false;
                if (this.playbackFailureLogged) return;
                this.playbackFailureLogged = true;
                asbWarn('audio/playback', 'Could not play converted audio', { error });
                this.callbacks.onError(error);
            }
        );
    }

    private play(): void {
        this.videoWaiting = false;
        this.synchronizeTime();
        if (!this.playable()) {
            this.pauseForAudio();
            return;
        }
        this.resumeAfterBuffering = false;
        this.playAudio();
    }

    private canPlay(): void {
        if (this.callbacks.videoState().ready) this.videoWaiting = false;
        this.synchronizeTime();
        if (this.resumeAfterBuffering && this.playable() && !this.videoWaiting) {
            this.resumeAfterBuffering = false;
            void this.callbacks
                .play()
                .catch((error: unknown) => asbWarn('audio/playback', 'Could not resume video', { error }));
        } else if (!this.callbacks.videoState().paused && this.playable() && !this.videoWaiting) {
            this.playAudio();
        }
    }

    private correctDrift(): void {
        this.callbacks.audioSettingsChanged(this.callbacks.videoState());
        if (this.resumeAfterBuffering) {
            this.canPlay();
            return;
        }
        if (this.callbacks.videoState().paused || this.videoWaiting) return;
        if (!this.playable()) {
            this.pauseForAudio();
            return;
        }
        const driftMs = Math.abs(this.callbacks.audioState().currentTimeMs - this.callbacks.videoState().currentTimeMs);
        if (driftMs > driftToleranceMs) this.synchronizeTime();
        if (driftMs > resyncThresholdMs || this.callbacks.audioState().paused) this.playAudio();
    }
}
