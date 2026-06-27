import { Fetcher } from '@project/common';
import { useChromeExtension } from '@project/common/app';
import RootApp from '@project/common/app/components/RootApp';
import { useMemo } from 'react';
import { AppExtensionDictionaryStorage } from '@project/common/app/services/app-extension-dictionary-storage';
import { AppExtensionSettingsStorage } from '@project/common/app/services/app-extension-settings-storage';
import { AppExtensionGlobalStateProvider } from '@project/common/app/services/app-extension-global-state-provider';
import { SettingsProvider } from '@project/common/settings';
import { LocalDictionaryStorage } from '../local-dictionary-storage';
import { LocalSettingsStorage } from '../local-settings-storage';

interface Props {
    origin: string;
    logoUrl: string;
    fetcher: Fetcher;
}

const WebsiteApp = (props: Props) => {
    const extension = useChromeExtension({ component: 'application' });
    const settingsStorage = useMemo(() => {
        if (extension.supportsAppIntegration) return new AppExtensionSettingsStorage(extension);
        return new LocalSettingsStorage();
    }, [extension]);
    const settingsProvider = useMemo(() => new SettingsProvider(settingsStorage), [settingsStorage]);
    const dictionaryStorage = useMemo(() => {
        if (extension.supportsDictionary) return new AppExtensionDictionaryStorage(extension);
        return new LocalDictionaryStorage(settingsProvider);
    }, [extension, settingsProvider]);
    const globalStateProvider = useMemo(() => new AppExtensionGlobalStateProvider(extension), [extension]);
    return (
        <RootApp
            {...props}
            extension={extension}
            dictionaryStorage={dictionaryStorage}
            settingsStorage={settingsStorage}
            settingsProvider={settingsProvider}
            globalStateProvider={globalStateProvider}
        />
    );
};

export default WebsiteApp;
