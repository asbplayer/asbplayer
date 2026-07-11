import { Command, SettingsUpdatedMessage } from '@project/common';
import { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettingsProfileContext } from '@project/common/hooks/use-settings-profile-context';
import { DictionaryProvider } from '@project/common/dictionary-db';
import { ExtensionDictionaryStorage } from '@/services/extension-dictionary-storage';

export const useSettings = () => {
    const dictionaryProvider = useMemo<DictionaryProvider>(
        () => new DictionaryProvider(new ExtensionDictionaryStorage()),
        []
    );
    const settingsProvider = useMemo<SettingsProvider>(() => new SettingsProvider(new ExtensionSettingsStorage()), []);
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const refreshSettings = useCallback(() => settingsProvider.getAll().then(setSettings), [settingsProvider]);

    useEffect(() => {
        void refreshSettings();
    }, [refreshSettings]);

    useEffect(() => {
        browser.runtime.onMessage.addListener((request) => {
            if (request.message?.command === 'settings-updated') {
                void settingsProvider.getAll().then(setSettings);
            }
        });
    }, [settingsProvider]);

    const notifySettingsUpdated = useCallback(() => {
        const command: Command<SettingsUpdatedMessage> = {
            sender: 'asbplayer-settings',
            message: {
                command: 'settings-updated',
            },
        };
        void browser.runtime.sendMessage(command);
    }, []);

    const onSettingsChanged = useCallback(
        (settings: Partial<AsbplayerSettings>) => {
            setSettings((s) => ({ ...s!, ...settings }));
            void settingsProvider.set(settings).then(() => notifySettingsUpdated());
        },
        [settingsProvider, notifySettingsUpdated]
    );

    const handleProfileChanged = useCallback(() => {
        void refreshSettings();
        notifySettingsUpdated();
    }, [refreshSettings, notifySettingsUpdated]);

    const profileContext = useSettingsProfileContext({
        dictionaryProvider,
        settingsProvider,
        onProfileChanged: handleProfileChanged,
    });

    return { dictionaryProvider, settings, onSettingsChanged, profileContext };
};
