import { asbError } from '@project/common/util/log';
import type { Fetcher } from '@project/common';
import type { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import { isSaveOnlySettings } from '@project/common/settings';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import App from '@project/common/app/components/App';
import type { AppSettingsStorage } from '@project/common/app/services/app-settings-storage';
import { useSettingsProfileContext } from '@project/common/hooks/use-settings-profile-context';
import type ChromeExtension from '@project/common/app/services/chrome-extension';
import type { GlobalState, GlobalStateProvider } from '@project/common/global-state';
import type { DictionaryStorage } from '@project/common/dictionary-db';
import { DictionaryProvider } from '@project/common/dictionary-db';
import type { LogProvider } from '@project/common/util/log';

interface Props {
    origin: string;
    logoUrl: string;
    fetcher: Fetcher;
    dictionaryStorage: DictionaryStorage;
    settingsStorage: AppSettingsStorage;
    settingsProvider: SettingsProvider;
    globalStateProvider: GlobalStateProvider;
    extension: ChromeExtension;
    logProvider: LogProvider;
}

const RootApp = ({
    extension,
    origin,
    logoUrl,
    dictionaryStorage,
    settingsStorage,
    settingsProvider,
    globalStateProvider,
    fetcher,
    logProvider,
}: Props) => {
    const dictionaryProvider = useMemo(() => new DictionaryProvider(dictionaryStorage), [dictionaryStorage]);
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const [globalState, setGlobalState] = useState<GlobalState>();

    const refreshSettings = useCallback(() => {
        void settingsProvider
            .getAll()
            .then(setSettings)
            .catch((error) => {
                asbError('app/settings', 'Failed to load settings:', error);
            });
    }, [settingsProvider]);

    useEffect(() => {
        refreshSettings();
    }, [refreshSettings]);

    const handleSettingsChanged = useCallback(
        async (settings: Partial<AsbplayerSettings>) => {
            if (!isSaveOnlySettings(settings)) setSettings((s) => ({ ...s!, ...settings }));
            await settingsProvider.set(settings);
        },
        [settingsProvider]
    );

    const handleProfileChanged = useCallback(() => {
        refreshSettings();
    }, [refreshSettings]);
    const { refreshProfileContext, ...profilesContext } = useSettingsProfileContext({
        dictionaryProvider,
        settingsProvider,
        onProfileChanged: handleProfileChanged,
    });

    useEffect(() => {
        return settingsStorage.onSettingsUpdated(() => {
            refreshSettings();
            refreshProfileContext();
        });
    }, [extension, refreshProfileContext, refreshSettings, settingsStorage]);

    useEffect(() => {
        void globalStateProvider
            .getAll()
            .then(setGlobalState)
            .catch((error) => {
                asbError('app/state', 'Failed to load global state:', error);
            });
    }, [globalStateProvider]);

    const handleGlobalStateChanged = useCallback(
        (state: Partial<GlobalState>) => {
            setGlobalState((s) => {
                if (s === undefined) {
                    return undefined;
                }

                return { ...s, ...state };
            });
            void globalStateProvider.set(state).catch((error) => {
                asbError('app/state', 'Failed to save global state:', error);
            });
        },
        [globalStateProvider]
    );

    if (settings === undefined) {
        return null;
    }

    return (
        <App
            origin={origin}
            logoUrl={logoUrl}
            dictionaryProvider={dictionaryProvider}
            logProvider={logProvider}
            settingsProvider={settingsProvider}
            settings={settings}
            globalState={globalState}
            extension={extension}
            fetcher={fetcher}
            onSettingsChanged={handleSettingsChanged}
            profile={profilesContext.activeProfile}
            onGlobalStateChanged={handleGlobalStateChanged}
            {...profilesContext}
        />
    );
};

export default RootApp;
