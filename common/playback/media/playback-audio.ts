import { audioBufferedRange } from '@project/common/audio-transcode/streaming-audio';
import type {
    AudioPlaybackEvent,
    AudioPlaybackSettings,
    AudioPlaybackState,
} from '@project/common/playback/media/media';

export interface PlaybackAudioSource {
    readonly element: HTMLAudioElement | null;
    readonly source: string | undefined;
}

interface PlaybackAudioCallbacks {
    readonly onEvent: (event: AudioPlaybackEvent) => void;
    readonly onError: (error: unknown) => void;
}

const events: AudioPlaybackEvent[] = ['waiting', 'ended', 'canplay', 'progress'];

/** Owns the browser audio element and translates it into state, operations and events for the engine. */
export default class PlaybackAudio {
    private source?: PlaybackAudioSource;
    private bound = false;
    private generation = 0;
    private cleanup?: () => void;

    constructor(private readonly callbacks: PlaybackAudioCallbacks) {}

    sourceChanged(source: PlaybackAudioSource): void {
        if (this.source?.element === source.element && this.source?.source === source.source) return;
        this.detach();
        this.source = source;
        if (this.bound) this.attach();
    }

    bind(): void {
        if (this.bound) return;
        this.bound = true;
        this.attach();
    }

    unbind(): void {
        this.bound = false;
        this.detach();
    }

    state(): AudioPlaybackState {
        const element = this.bound ? this.source?.element : undefined;
        return {
            attached: Boolean(element && this.source?.source),
            currentTimeMs: (element?.currentTime ?? 0) * 1000,
            durationMs: (element?.duration ?? NaN) * 1000,
            paused: element?.paused ?? true,
            ended: element?.ended ?? false,
            hasMetadata: (element?.readyState ?? 0) >= HTMLMediaElement.HAVE_METADATA,
            ready: (element?.readyState ?? 0) >= HTMLMediaElement.HAVE_FUTURE_DATA,
            buffered: element ? audioBufferedRange(element.buffered) : { start: 0, end: 0 },
        };
    }

    /** False means a replaced source or a benign interrupted play; actual playback failures reject. */
    async play(): Promise<boolean> {
        const element = this.bound ? this.source?.element : undefined;
        if (!element || !this.source?.source) return false;
        const generation = this.generation;
        try {
            await element.play();
            return generation === this.generation;
        } catch (error) {
            if (generation !== this.generation || (error instanceof Error && error.name === 'AbortError')) return false;
            throw error;
        }
    }

    pause(): void {
        this.source?.element?.pause();
    }

    seek(timestampMs: number): void {
        if (this.source?.element) this.source.element.currentTime = timestampMs / 1000;
    }

    settingsChanged({ playbackRate, preservesPitch, volume }: AudioPlaybackSettings): void {
        const element = this.source?.element;
        if (!element) return;
        if (element.playbackRate !== playbackRate) element.playbackRate = playbackRate;
        if (element.preservesPitch !== preservesPitch) element.preservesPitch = preservesPitch;
        if (element.volume !== volume) element.volume = volume;
    }

    private attach(): void {
        const element = this.source?.element;
        if (!element) return;
        const event = (event: Event) => this.callbacks.onEvent(event.type as AudioPlaybackEvent);
        const error = () => this.callbacks.onError(element.error ?? new Error('Converted audio media error'));
        for (const type of events) element.addEventListener(type, event);
        element.addEventListener('error', error);
        if (this.source?.source) element.src = this.source.source;
        else element.removeAttribute('src');
        this.cleanup = () => {
            for (const type of events) element.removeEventListener(type, event);
            element.removeEventListener('error', error);
            element.pause();
            element.removeAttribute('src');
        };
    }

    private detach(): void {
        ++this.generation;
        this.cleanup?.();
        this.cleanup = undefined;
    }
}
