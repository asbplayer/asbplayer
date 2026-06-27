import { Fetcher } from '@project/common';
import { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import App from './App';
import { AppSettingsStorage } from '../services/app-settings-storage';
import { useSettingsProfileContext } from '../../hooks/use-settings-profile-context';
import ChromeExtension from '../services/chrome-extension';
import { GlobalState, GlobalStateProvider } from '../../global-state';
import { DictionaryProvider, DictionaryStorage } from '../../dictionary-db';

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
        settingsProvider.getAll().then(setSettings);
    }, [settingsProvider]);

    const handleSettingsChanged = useCallback(
        async (settings: Partial<AsbplayerSettings>) => {
            setSettings((s) => ({ ...s!, ...settings }));

            await settingsProvider.set(settings);
        },
        [settingsProvider]
    );

    const handleProfileChanged = useCallback(() => {
        settingsProvider.getAll().then(setSettings);
    }, [settingsProvider]);
    const { refreshProfileContext, ...profilesContext } = useSettingsProfileContext({
        dictionaryProvider,
        settingsProvider,
        onProfileChanged: handleProfileChanged,
    });

    useEffect(() => {
        return settingsStorage.onSettingsUpdated(() => {
            settingsProvider.getAll().then(setSettings);
            refreshProfileContext();
        });
    }, [extension, settingsProvider, settingsStorage, refreshProfileContext]);

    useEffect(() => {
        globalStateProvider.getAll().then(setGlobalState);
    }, [globalStateProvider]);

    const handleGlobalStateChanged = useCallback(
        (state: Partial<GlobalState>) => {
            setGlobalState((s) => {
                if (s === undefined) {
                    return undefined;
                }

                return { ...s, ...state };
            });
            globalStateProvider.set(state);
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
            onGlobalStateChanged={handleGlobalStateChanged}
            {...profilesContext}
        />
    );
};

export default RootApp;
