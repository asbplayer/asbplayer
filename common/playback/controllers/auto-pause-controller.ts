import type { SubtitleModel } from '@project/common';
import { AutoPauseResumeMode } from '@project/common/settings';
import type { PlaybackPlanAutoPauseResume } from '@project/common/playback/plan/playback-plan';

export interface AutoPauseControllerCallbacks {
    readonly play: () => Promise<void>;
    readonly showingSubtitlesChanged: () => void;
    readonly onError: (error: unknown) => void;
}

export interface AutoPausePolicy {
    readonly resume?: PlaybackPlanAutoPauseResume;
    readonly subtitlesWhilePausedOnly: boolean;
}

/** How long a pause lasts before its subtitle is hidden. */
export const autoPauseDurationMs = (
    resume: PlaybackPlanAutoPauseResume,
    subtitles: readonly SubtitleModel[]
): number => {
    if (resume.mode === AutoPauseResumeMode.fixed) return resume.fixedDurationMs;

    const characters = subtitles.reduce((total, { text }) => total + text.length, 0);
    const durationMs = Math.max(resume.minimumDurationMs, characters * resume.timePerCharacterMs);
    return resume.maximumDurationMs === 0 ? durationMs : Math.min(resume.maximumDurationMs, durationMs);
};

/**
 * Ends automatic pauses on their own and decides when subtitles may be on screen.
 *
 * A resuming pause runs in two phases: its subtitle is shown for the pause duration, then hidden
 * while playback stays paused for the resume delay. The silent, subtitle-free gap that leaves is
 * what lets the audio be heard with the meaning already in mind, so visibility follows the pause
 * duration rather than whether the media happens to be paused.
 */
export default class AutoPauseController {
    private readonly callbacks: AutoPauseControllerCallbacks;
    private resume?: PlaybackPlanAutoPauseResume;
    private subtitlesWhilePausedOnly = false;
    private timeout?: ReturnType<typeof setTimeout>;
    private subtitlesVisible = false;

    constructor(callbacks: AutoPauseControllerCallbacks) {
        this.callbacks = callbacks;
    }

    /** Subtitles are withheld outside of a pause that is showing them. */
    get subtitlesSuppressed(): boolean {
        return this.subtitlesWhilePausedOnly && !this.subtitlesVisible;
    }

    setPolicy({ resume, subtitlesWhilePausedOnly }: AutoPausePolicy): void {
        this.cancel();
        this.resume = resume;
        this.subtitlesWhilePausedOnly = subtitlesWhilePausedOnly;
    }

    /**
     * Reports a pause issued by playback itself. Every automatic pause opens a window, including
     * pauses with nothing to read such as negatively offset subtitle starts, so that playback is
     * never left waiting on a subtitle that is not shown.
     */
    autoPaused(subtitles: readonly SubtitleModel[]): void {
        this.clearTimeout();
        this.showSubtitles();

        const resume = this.resume;
        if (resume === undefined) return;

        this.timeout = setTimeout(
            () => {
                this.hideSubtitles();
                this.timeout = setTimeout(() => {
                    this.timeout = undefined;
                    this.callbacks.play().catch(this.callbacks.onError);
                }, resume.delayMs);
            },
            autoPauseDurationMs(resume, subtitles)
        );
    }

    /** Reports a pause that playback did not ask for, which shows subtitles without resuming. */
    userPaused(): void {
        if (this.timeout !== undefined) return; // An automatic pause is already running its phases
        this.showSubtitles();
    }

    playbackStarted(): void {
        this.clearTimeout();
        this.hideSubtitles();
    }

    /**
     * Reports a seek the viewer made. It ends any pause in progress, but a viewer who seeks while
     * paused is still looking at a paused frame and should keep its subtitle.
     */
    userSeeked(paused: boolean): void {
        this.clearTimeout();
        if (paused) this.showSubtitles();
        else this.hideSubtitles();
    }

    cancel(): void {
        this.clearTimeout();
        this.hideSubtitles();
    }

    private clearTimeout(): void {
        if (this.timeout === undefined) return;
        clearTimeout(this.timeout);
        this.timeout = undefined;
    }

    private showSubtitles(): void {
        if (this.subtitlesVisible) return;
        this.subtitlesVisible = true;
        if (this.subtitlesWhilePausedOnly) this.callbacks.showingSubtitlesChanged();
    }

    private hideSubtitles(): void {
        if (!this.subtitlesVisible) return;
        this.subtitlesVisible = false;
        if (this.subtitlesWhilePausedOnly) this.callbacks.showingSubtitlesChanged();
    }
}
