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

interface Props {
    origin: string;
    logoUrl: string;
    fetcher: Fetcher;
    dictionaryStorage: DictionaryStorage;
    settingsStorage: AppSettingsStorage;
    settingsProvider: SettingsProvider;
    globalStateProvider: GlobalStateProvider;
    extension: ChromeExtension;
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
}: Props) => {
    const dictionaryProvider = useMemo(() => new DictionaryProvider(dictionaryStorage), [dictionaryStorage]);
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const [globalState, setGlobalState] = useState<GlobalState>();

    useEffect(() => {
        void settingsProvider.getAll().then(setSettings);
    }, [settingsProvider]);

    const handleSettingsChanged = useCallback(
        async (settings: Partial<AsbplayerSettings>) => {
            if (!isSaveOnlySettings(settings)) setSettings((s) => ({ ...s!, ...settings }));
            await settingsProvider.set(settings);
        },
        [settingsProvider]
    );

    const handleProfileChanged = useCallback(() => {
        void settingsProvider.getAll().then(setSettings);
    }, [settingsProvider]);
    const { refreshProfileContext, ...profilesContext } = useSettingsProfileContext({
        dictionaryProvider,
        settingsProvider,
        onProfileChanged: handleProfileChanged,
    });

    useEffect(() => {
        return settingsStorage.onSettingsUpdated(() => {
            void settingsProvider.getAll().then(setSettings);
            refreshProfileContext();
        });
    }, [extension, settingsProvider, settingsStorage, refreshProfileContext]);

    useEffect(() => {
        void globalStateProvider.getAll().then(setGlobalState);
    }, [globalStateProvider]);

    const handleGlobalStateChanged = useCallback(
        (state: Partial<GlobalState>) => {
            setGlobalState((s) => {
                if (s === undefined) {
                    return undefined;
                }

                return { ...s, ...state };
            });
            void globalStateProvider.set(state);
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
