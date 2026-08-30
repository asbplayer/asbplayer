import type { KeyBinder } from '@project/common/key-binder';
import {
    autoPauseResumeModeLocKey,
    nextAutoPauseResumeMode,
    nextSubtitleVisibility,
    subtitleVisibilityLocKey,
} from '@project/common/settings';
import type { AsbplayerSettings } from '@project/common/settings';

export interface PlaybackSettingKeyBindingNotification {
    readonly locKey: 'info.autoPauseResumeMode' | 'info.subtitleVisibility';
    readonly valueLocKey: string;
}

export interface PlaybackSettingKeyBindingOptions {
    readonly keyBinder: Pick<KeyBinder, 'bindCycleAutoPauseResumeMode' | 'bindToggleSubtitleVisibility'>;
    readonly autoPauseResumeMode: AsbplayerSettings['autoPauseResumeMode'];
    readonly subtitleVisibility: AsbplayerSettings['subtitleVisibility'];
    readonly disabled: () => boolean;
    readonly saveSettings: (settings: Partial<AsbplayerSettings>) => void;
    readonly notify: (notification: PlaybackSettingKeyBindingNotification) => void;
}

export const bindPlaybackSettingKeyBindings = ({
    keyBinder,
    autoPauseResumeMode,
    subtitleVisibility,
    disabled,
    saveSettings,
    notify,
}: PlaybackSettingKeyBindingOptions): (() => void) => {
    let currentAutoPauseResumeMode = autoPauseResumeMode;
    let currentSubtitleVisibility = subtitleVisibility;

    const unbindCycleAutoPauseResumeMode = keyBinder.bindCycleAutoPauseResumeMode((event) => {
        event.preventDefault();
        currentAutoPauseResumeMode = nextAutoPauseResumeMode(currentAutoPauseResumeMode);
        saveSettings({ autoPauseResumeMode: currentAutoPauseResumeMode });
        notify({
            locKey: 'info.autoPauseResumeMode',
            valueLocKey: autoPauseResumeModeLocKey(currentAutoPauseResumeMode),
        });
    }, disabled);
    const unbindToggleSubtitleVisibility = keyBinder.bindToggleSubtitleVisibility((event) => {
        event.preventDefault();
        currentSubtitleVisibility = nextSubtitleVisibility(currentSubtitleVisibility);
        saveSettings({ subtitleVisibility: currentSubtitleVisibility });
        notify({
            locKey: 'info.subtitleVisibility',
            valueLocKey: subtitleVisibilityLocKey(currentSubtitleVisibility),
        });
    }, disabled);

    return () => {
        unbindCycleAutoPauseResumeMode();
        unbindToggleSubtitleVisibility();
    };
};
