import type { SubtitleModel } from '@project/common';
import type { PlaybackPlanPrimedListening } from '@project/common/playback/plan/playback-plan';

export interface PlaybackPrimedListeningControllerCallbacks {
    readonly play: () => Promise<void>;
    readonly showingSubtitlesChanged: () => void;
    readonly onError: (error: unknown) => void;
}

/** Time needed to read the given subtitles, derived from their length and clamped by the plan. */
export const primedListeningReadingTimeMs = (
    { readingTimePerCharacterMs, minimumReadingTimeMs, maximumReadingTimeMs }: PlaybackPlanPrimedListening,
    subtitles: readonly SubtitleModel[]
): number => {
    const characters = subtitles.reduce((total, { text }) => total + text.length, 0);
    return Math.min(maximumReadingTimeMs, Math.max(minimumReadingTimeMs, characters * readingTimePerCharacterMs));
};

/**
 * Implements primed listening: every automatic pause shows its subtitle just long enough to be read,
 * hides it, and then resumes playback after a short silence so that only the target-language audio is
 * left to map onto the meaning that was just read. Subtitles stay hidden outside of reading windows.
 */
export default class PlaybackPrimedListeningController {
    private readonly callbacks: PlaybackPrimedListeningControllerCallbacks;
    private primedListening?: PlaybackPlanPrimedListening;
    private timeout?: ReturnType<typeof setTimeout>;
    private reading = false;

    constructor(callbacks: PlaybackPrimedListeningControllerCallbacks) {
        this.callbacks = callbacks;
    }

    /** Subtitles are only visible while the reader is being given time to read them. */
    get subtitlesSuppressed(): boolean {
        return this.primedListening !== undefined && !this.reading;
    }

    setPrimedListening(primedListening: PlaybackPlanPrimedListening | undefined): void {
        this.cancel();
        this.primedListening = primedListening;
    }

    /**
     * Opens a reading window for an automatic pause, after which playback resumes on its own. Every
     * automatic pause opens one, including pauses with nothing to read such as negatively offset
     * subtitle starts, so that playback is never left waiting on a subtitle that is not shown.
     */
    paused(subtitles: readonly SubtitleModel[]): void {
        this.cancel();
        const primedListening = this.primedListening;
        if (primedListening === undefined) return;

        this.reading = true;
        this.callbacks.showingSubtitlesChanged();
        this.timeout = setTimeout(
            () => {
                this.reading = false;
                this.callbacks.showingSubtitlesChanged();
                this.timeout = setTimeout(() => {
                    this.timeout = undefined;
                    this.callbacks.play().catch(this.callbacks.onError);
                }, primedListening.resumeDelayMs);
            },
            primedListeningReadingTimeMs(primedListening, subtitles)
        );
    }

    cancel(): void {
        if (this.timeout !== undefined) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        if (!this.reading) return;
        this.reading = false;
        this.callbacks.showingSubtitlesChanged();
    }
}
