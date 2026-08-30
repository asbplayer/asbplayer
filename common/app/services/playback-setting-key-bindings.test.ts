import { describe, expect, it, jest } from '@jest/globals';
import { AutoPauseResumeMode, SubtitleVisibility } from '@project/common/settings';
import { bindPlaybackSettingKeyBindings } from '@project/common/app/services/playback-setting-key-bindings';

describe('bindPlaybackSettingKeyBindings', () => {
    it('persists and reports each auto-pause resume mode in cycle order', () => {
        let cycle: ((event: KeyboardEvent) => void) | undefined;
        const saveSettings = jest.fn();
        const notify = jest.fn();
        const preventDefault = jest.fn();

        bindPlaybackSettingKeyBindings({
            keyBinder: {
                bindCycleAutoPauseResumeMode: (callback) => {
                    cycle = callback;
                    return jest.fn();
                },
                bindToggleSubtitleVisibility: () => jest.fn(),
            },
            autoPauseResumeMode: AutoPauseResumeMode.manual,
            subtitleVisibility: SubtitleVisibility.always,
            disabled: () => false,
            saveSettings,
            notify,
        });

        const event = { preventDefault } as unknown as KeyboardEvent;
        cycle?.(event);
        cycle?.(event);
        cycle?.(event);

        expect(preventDefault).toHaveBeenCalledTimes(3);
        expect(saveSettings.mock.calls).toEqual([
            [{ autoPauseResumeMode: AutoPauseResumeMode.fixed }],
            [{ autoPauseResumeMode: AutoPauseResumeMode.subtitleLength }],
            [{ autoPauseResumeMode: AutoPauseResumeMode.manual }],
        ]);
        expect(notify.mock.calls).toEqual([
            [{ locKey: 'info.autoPauseResumeMode', valueLocKey: 'settings.autoPauseResumeModeFixed' }],
            [{ locKey: 'info.autoPauseResumeMode', valueLocKey: 'settings.autoPauseResumeModeSubtitleLength' }],
            [{ locKey: 'info.autoPauseResumeMode', valueLocKey: 'settings.autoPauseResumeModeManual' }],
        ]);
    });

    it('persists and reports both subtitle visibility values', () => {
        let toggle: ((event: KeyboardEvent) => void) | undefined;
        const saveSettings = jest.fn();
        const notify = jest.fn();

        bindPlaybackSettingKeyBindings({
            keyBinder: {
                bindCycleAutoPauseResumeMode: () => jest.fn(),
                bindToggleSubtitleVisibility: (callback) => {
                    toggle = callback;
                    return jest.fn();
                },
            },
            autoPauseResumeMode: AutoPauseResumeMode.manual,
            subtitleVisibility: SubtitleVisibility.always,
            disabled: () => false,
            saveSettings,
            notify,
        });

        const event = { preventDefault: jest.fn() } as unknown as KeyboardEvent;
        toggle?.(event);
        toggle?.(event);

        expect(saveSettings.mock.calls).toEqual([
            [{ subtitleVisibility: SubtitleVisibility.whilePaused }],
            [{ subtitleVisibility: SubtitleVisibility.always }],
        ]);
        expect(notify.mock.calls).toEqual([
            [{ locKey: 'info.subtitleVisibility', valueLocKey: 'settings.subtitleVisibilityWhilePaused' }],
            [{ locKey: 'info.subtitleVisibility', valueLocKey: 'settings.subtitleVisibilityAlways' }],
        ]);
    });

    it('unbinds both shortcuts', () => {
        const unbindCycle = jest.fn();
        const unbindVisibility = jest.fn();
        const unbind = bindPlaybackSettingKeyBindings({
            keyBinder: {
                bindCycleAutoPauseResumeMode: () => unbindCycle,
                bindToggleSubtitleVisibility: () => unbindVisibility,
            },
            autoPauseResumeMode: AutoPauseResumeMode.manual,
            subtitleVisibility: SubtitleVisibility.always,
            disabled: () => false,
            saveSettings: jest.fn(),
            notify: jest.fn(),
        });

        unbind();

        expect(unbindCycle).toHaveBeenCalledTimes(1);
        expect(unbindVisibility).toHaveBeenCalledTimes(1);
    });
});
