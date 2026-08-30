import type { SubtitleModel } from '@project/common';
import { AutoPauseResumeMode } from '@project/common/settings';
import { playbackPlanAutoPauseResumesEqual } from '@project/common/playback/plan/playback-plan';
import type { PlaybackPlanAutoPauseResume } from '@project/common/playback/plan/playback-plan';

export const autoPauseResumeModeNotificationKey = 'auto-pause-resume-mode';

export interface AutoPauseResumeModeNotification {
    readonly key: typeof autoPauseResumeModeNotificationKey;
    readonly locKey: 'info.autoPauseResumeMode';
    readonly valueLocKey: string;
}

export const nextAutoPauseResumeMode = (mode: AutoPauseResumeMode): AutoPauseResumeMode => {
    switch (mode) {
        case AutoPauseResumeMode.manual:
            return AutoPauseResumeMode.fixed;
        case AutoPauseResumeMode.fixed:
            return AutoPauseResumeMode.subtitleLength;
        default:
            return AutoPauseResumeMode.manual;
    }
};

export const autoPauseResumeModeLocKey = (mode: AutoPauseResumeMode): string => {
    switch (mode) {
        case AutoPauseResumeMode.fixed:
            return 'settings.autoPauseResumeModeFixed';
        case AutoPauseResumeMode.subtitleLength:
            return 'settings.autoPauseResumeModeSubtitleLength';
        default:
            return 'settings.autoPauseResumeModeManual';
    }
};

export const formatAutoPauseResumeModeNotification = (mode: AutoPauseResumeMode): AutoPauseResumeModeNotification => ({
    key: autoPauseResumeModeNotificationKey,
    locKey: 'info.autoPauseResumeMode',
    valueLocKey: autoPauseResumeModeLocKey(mode),
});

export interface AutoPauseControllerCallbacks {
    readonly play: () => Promise<void>;
    readonly resumeDelayStarted: () => void;
    readonly onError: (error: unknown) => void;
}

export const autoPauseDurationMs = (
    resume: Exclude<PlaybackPlanAutoPauseResume, { readonly mode: AutoPauseResumeMode.manual }>,
    subtitles: readonly SubtitleModel[]
): number => {
    if (resume.mode === AutoPauseResumeMode.fixed) return resume.fixedDurationMs;

    const characters = subtitles.reduce((total, { text }) => total + text.length, 0);
    const durationMs = Math.max(resume.minimumDurationMs, characters * resume.timePerCharacterMs);
    return resume.maximumDurationMs === 0 ? durationMs : Math.min(resume.maximumDurationMs, durationMs);
};

/**
 * Handles automatic resume after a pause issued by the playback engine itself.
 */
export default class AutoPauseController {
    private readonly callbacks: AutoPauseControllerCallbacks;
    private resume?: PlaybackPlanAutoPauseResume;
    private timeout?: ReturnType<typeof setTimeout>;

    constructor(callbacks: AutoPauseControllerCallbacks) {
        this.callbacks = callbacks;
    }

    replacePlan(resume: PlaybackPlanAutoPauseResume | undefined): void {
        if (playbackPlanAutoPauseResumesEqual(this.resume, resume)) return;
        this.clearTimeout();
        this.resume = resume;
    }

    autoPaused(subtitles: readonly SubtitleModel[]): void {
        this.clearTimeout();
        const resume = this.resume;
        if (resume === undefined || resume.mode === AutoPauseResumeMode.manual) return;

        this.timeout = setTimeout(
            () => {
                this.callbacks.resumeDelayStarted();
                this.timeout = setTimeout(() => {
                    this.timeout = undefined;
                    this.callbacks.play().catch(this.callbacks.onError);
                }, resume.delayMs);
            },
            autoPauseDurationMs(resume, subtitles)
        );
    }

    playbackStarted(): void {
        this.clearTimeout();
    }

    userSeeked(): void {
        this.clearTimeout();
    }

    cancel(): void {
        this.clearTimeout();
    }

    private clearTimeout(): void {
        if (this.timeout === undefined) return;
        clearTimeout(this.timeout);
        this.timeout = undefined;
    }
}
