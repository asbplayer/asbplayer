import { SubtitleVisibility } from '@project/common/settings';
import { asbTrace } from '@project/common/util/log';

export const subtitleVisibilityNotificationKey = 'subtitle-visibility';

export interface SubtitleVisibilityNotification {
    readonly key: typeof subtitleVisibilityNotificationKey;
    readonly locKey: 'info.subtitleVisibility';
    readonly valueLocKey: string;
}

export const nextSubtitleVisibility = (visibility: SubtitleVisibility): SubtitleVisibility =>
    visibility === SubtitleVisibility.whenDue ? SubtitleVisibility.whilePaused : SubtitleVisibility.whenDue;

export const subtitleVisibilityLocKey = (visibility: SubtitleVisibility): string =>
    visibility === SubtitleVisibility.whilePaused
        ? 'settings.subtitleVisibilityWhilePaused'
        : 'settings.subtitleVisibilityWhenDue';

export const formatSubtitleVisibilityNotification = (
    visibility: SubtitleVisibility
): SubtitleVisibilityNotification => ({
    key: subtitleVisibilityNotificationKey,
    locKey: 'info.subtitleVisibility',
    valueLocKey: subtitleVisibilityLocKey(visibility),
});

export interface SubtitleVisibilityControllerCallbacks {
    readonly visibilityChanged: () => void;
}

/**
 * Decides whether timeline subtitles are exposed for rendering by managing the external inputs from PlaybackEngine or the user.
 */
export default class SubtitleVisibilityController {
    private readonly callbacks: SubtitleVisibilityControllerCallbacks;
    private visibility = SubtitleVisibility.whenDue;
    private _subtitlesVisible = true;
    private automaticPauseActive = false;
    private planInitialized = false;

    constructor(callbacks: SubtitleVisibilityControllerCallbacks) {
        this.callbacks = callbacks;
    }

    get subtitlesVisible(): boolean {
        return this._subtitlesVisible;
    }

    replacePlan(visibility: SubtitleVisibility, paused: boolean): void {
        if (this.planInitialized && visibility === this.visibility) return;
        this.mutate(() => {
            this.planInitialized = true;
            this.visibility = visibility;
            this.automaticPauseActive = false;
            this._subtitlesVisible = this.visibleWhen(paused);
        }, 'plan-replaced');
    }

    autoPaused(): void {
        this.mutate(() => {
            this.automaticPauseActive = true;
            this._subtitlesVisible = true;
        }, 'auto-paused');
    }

    autoPauseResumeDelayStarted(): void {
        this.mutate(() => {
            this._subtitlesVisible = this.visibleWhen(false);
        }, 'auto-pause-resume-delay-started');
    }

    playbackPaused(): void {
        if (this.automaticPauseActive) return;
        this.mutate(() => {
            this._subtitlesVisible = true;
        }, 'playback-paused');
    }

    playbackStarted(): void {
        this.mutate(() => {
            this.automaticPauseActive = false;
            this._subtitlesVisible = this.visibleWhen(false);
        }, 'playback-started');
    }

    userSeeked(paused: boolean): void {
        this.mutate(() => {
            this.automaticPauseActive = false;
            this._subtitlesVisible = this.visibleWhen(paused);
        }, 'user-seeked');
    }

    autoPauseCancelled(paused: boolean): void {
        this.mutate(() => {
            this.automaticPauseActive = false;
            this._subtitlesVisible = this.visibleWhen(paused);
        }, 'auto-pause-cancelled');
    }

    cancel(): void {
        this.mutate(() => {
            this.automaticPauseActive = false;
            this._subtitlesVisible = this.visibleWhen(false);
        }, 'cancelled');
    }

    private mutate(mutation: () => void, reason: string): void {
        const visibleBefore = this.subtitlesVisible;
        mutation();
        if (visibleBefore === this.subtitlesVisible) return;
        asbTrace('playback/subtitles', 'Changed subtitle visibility', {
            reason,
            subtitlesVisible: this.subtitlesVisible,
            subtitlesVisibleBefore: visibleBefore,
        });
        this.callbacks.visibilityChanged();
    }

    private visibleWhen(paused: boolean): boolean {
        return this.visibility === SubtitleVisibility.whenDue || paused;
    }
}
