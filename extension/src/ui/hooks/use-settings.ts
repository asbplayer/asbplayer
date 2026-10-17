import { asbError } from '@project/common/util/log';
import type { Command, SettingsUpdatedMessage } from '@project/common';
import type { AsbplayerSettings } from '@project/common/settings';
import { SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    // Skip reloads that may be older than the local state: ones started before a later local change,
    // or that finish while a save is still in flight. Each save triggers its own reload afterwards.
    const localChangeCountRef = useRef(0);
    const pendingSavesRef = useRef(0);
    const refreshSettings = useCallback(() => {
        const localChangeCount = localChangeCountRef.current;
        return settingsProvider
            .getAll()
            .then((loaded) => {
                if (localChangeCount === localChangeCountRef.current && pendingSavesRef.current === 0) {
                    setSettings(loaded);
                }
            })
            .catch((error) => {
                asbError('settings', 'Failed to load settings:', error);
            });
    }, [settingsProvider]);

    useEffect(() => {
        void refreshSettings();
    }, [refreshSettings]);

    useEffect(() => {
        browser.runtime.onMessage.addListener((request) => {
            if (request.message?.command === 'settings-updated') {
                void refreshSettings();
            }
        });
    }, [refreshSettings]);

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
            localChangeCountRef.current++;
            pendingSavesRef.current++;
            setSettings((s) => ({ ...s!, ...settings }));
            void settingsProvider
                .set(settings)
                .then(() => {
                    pendingSavesRef.current--;
                    notifySettingsUpdated();
                })
                .catch((error) => {
                    pendingSavesRef.current--;
                    asbError('settings', 'Failed to save settings:', error);
                });
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
