import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Command, SettingsUpdatedMessage } from '@project/common';
import type { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import { asbError } from '@project/common/util/log';

export const notifySettingsUpdated = () => {
    const command: Command<SettingsUpdatedMessage> = {
        sender: 'asbplayer-settings',
        message: { command: 'settings-updated' },
    };
    return browser.runtime.sendMessage(command);
};

export const useSettingsUpdates = (
    settingsProvider: SettingsProvider,
    setSettings: Dispatch<SetStateAction<AsbplayerSettings | undefined>>
) =>
    useCallback(
        (change: Partial<AsbplayerSettings>) => {
            setSettings((previous) => previous && { ...previous, ...change });
            void settingsProvider
                .set(change)
                .then(notifySettingsUpdated)
                .catch((error) => asbError('settings', 'Failed to save settings:', error));
        },
        [settingsProvider, setSettings]
    );
