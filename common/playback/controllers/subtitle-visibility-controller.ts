import { SubtitleVisibility } from '@project/common/settings';
import { asbTrace } from '@project/common/util/log';

export const subtitleVisibilityNotificationKey = 'subtitle-visibility';

export interface SubtitleVisibilityNotification {
    readonly key: typeof subtitleVisibilityNotificationKey;
    readonly locKey: 'info.subtitleVisibility';
    readonly valueLocKey: string;
}

export const nextSubtitleVisibility = (visibility: SubtitleVisibility): SubtitleVisibility =>
    visibility === SubtitleVisibility.whenDue
        ? SubtitleVisibility.whilePaused
        : visibility === SubtitleVisibility.whilePaused
          ? SubtitleVisibility.whileManuallyPaused
          : SubtitleVisibility.whenDue;

export const subtitleVisibilityLocKey = (visibility: SubtitleVisibility): string =>
    visibility === SubtitleVisibility.whilePaused
        ? 'settings.subtitleVisibilityWhilePaused'
        : visibility === SubtitleVisibility.whileManuallyPaused
          ? 'settings.subtitleVisibilityWhileManuallyPaused'
          : 'settings.subtitleVisibilityWhenDue';

export const formatSubtitleVisibilityNotification = (
    visibility: SubtitleVisibility
): SubtitleVisibilityNotification => ({
    key: subtitleVisibilityNotificationKey,
    locKey: 'info.subtitleVisibility',
    valueLocKey: subtitleVisibilityLocKey(visibility),
});

export interface SubtitleVisibilityControllerCallbacks {
    readonly automaticallyPaused: () => boolean;
    readonly visibilityChanged: () => void;
}

/**
 * Decides whether timeline subtitles are exposed for rendering by managing the external inputs from PlaybackEngine or the user.
 */
export default class SubtitleVisibilityController {
    private readonly callbacks: SubtitleVisibilityControllerCallbacks;
    private visibility = SubtitleVisibility.whenDue;
    private _subtitlesVisible = true;
    private planInitialized = false;

    constructor(callbacks: SubtitleVisibilityControllerCallbacks) {
        this.callbacks = callbacks;
    }

    get subtitlesVisible(): boolean {
        return this._subtitlesVisible;
    }

    replacePlan(visibility: SubtitleVisibility, { paused }: { readonly paused: boolean }): void {
        if (this.planInitialized && visibility === this.visibility) return;
        this.mutate(() => {
            this.planInitialized = true;
            this.visibility = visibility;
            this._subtitlesVisible = this.visibleWhen({ paused });
        }, 'plan-replaced');
    }

    autoPaused(): void {
        this.mutate(() => {
            this._subtitlesVisible = this.visibility !== SubtitleVisibility.whileManuallyPaused;
        }, 'auto-paused');
    }

    autoPauseResumeDelayStarted(): void {
        this.mutate(() => {
            this._subtitlesVisible = this.visibleWhen({ paused: false });
        }, 'auto-pause-resume-delay-started');
    }

    playbackPaused(): void {
        if (this.callbacks.automaticallyPaused()) return;
        this.mutate(() => {
            this._subtitlesVisible = true;
        }, 'playback-paused');
    }

    playbackStarted(): void {
        this.mutate(() => {
            this._subtitlesVisible = this.visibleWhen({ paused: false });
        }, 'playback-started');
    }

    userSeeked({ paused }: { readonly paused: boolean }): void {
        this.mutate(() => {
            this._subtitlesVisible = this.visibleWhen({ paused });
        }, 'user-seeked');
    }

    autoPauseCancelled({ paused }: { readonly paused: boolean }): void {
        this.mutate(() => {
            this._subtitlesVisible = this.visibleWhen({ paused });
        }, 'auto-pause-cancelled');
    }

    cancel(): void {
        this.mutate(() => {
            this._subtitlesVisible = this.visibleWhen({ paused: false });
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

    private visibleWhen({ paused }: { readonly paused: boolean }): boolean {
        return (
            this.visibility === SubtitleVisibility.whenDue ||
            (paused && (this.visibility === SubtitleVisibility.whilePaused || !this.callbacks.automaticallyPaused()))
        );
    }
}
