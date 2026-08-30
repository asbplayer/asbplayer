import { SubtitleVisibility } from '@project/common/settings';

export const subtitleVisibilityNotificationKey = 'subtitle-visibility';

export interface SubtitleVisibilityNotification {
    readonly key: typeof subtitleVisibilityNotificationKey;
    readonly locKey: 'info.subtitleVisibility';
    readonly valueLocKey: string;
}

export const nextSubtitleVisibility = (visibility: SubtitleVisibility): SubtitleVisibility =>
    visibility === SubtitleVisibility.always ? SubtitleVisibility.whilePaused : SubtitleVisibility.always;

export const subtitleVisibilityLocKey = (visibility: SubtitleVisibility): string =>
    visibility === SubtitleVisibility.whilePaused
        ? 'settings.subtitleVisibilityWhilePaused'
        : 'settings.subtitleVisibilityAlways';

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
 * Decides whether timeline subtitles are exposed for rendering by managing the external inputs
 * from PlaybackEngine or the user.
 */
export default class SubtitleVisibilityController {
    private readonly callbacks: SubtitleVisibilityControllerCallbacks;
    private visibility = SubtitleVisibility.always;
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
        });
    }

    autoPaused(): void {
        this.mutate(() => {
            this.automaticPauseActive = true;
            this._subtitlesVisible = true;
        });
    }

    autoPauseReadingPeriodEnded(): void {
        this.mutate(() => {
            this._subtitlesVisible = this.visibleWhen(false);
        });
    }

    playbackPaused(): void {
        if (this.automaticPauseActive) return;
        this.mutate(() => {
            this._subtitlesVisible = true;
        });
    }

    playbackStarted(): void {
        this.mutate(() => {
            this.automaticPauseActive = false;
            this._subtitlesVisible = this.visibleWhen(false);
        });
    }

    userSeeked(paused: boolean): void {
        this.mutate(() => {
            this.automaticPauseActive = false;
            this._subtitlesVisible = this.visibleWhen(paused);
        });
    }

    cancel(): void {
        this.mutate(() => {
            this.automaticPauseActive = false;
            this._subtitlesVisible = this.visibleWhen(false);
        });
    }

    private mutate(mutation: () => void): void {
        const visibleBefore = this.subtitlesVisible;
        mutation();
        if (visibleBefore !== this.subtitlesVisible) this.callbacks.visibilityChanged();
    }

    private visibleWhen(visibleWhilePausedOnly: boolean): boolean {
        return this.visibility === SubtitleVisibility.always || visibleWhilePausedOnly;
    }
}
