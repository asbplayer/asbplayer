import { useCallback, useEffect, useMemo, useState } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import {
    ExtensionToVideoCommand,
    GrantedActiveTabPermissionMessage,
    PopupToExtensionCommand,
    SettingsUpdatedMessage,
} from '@project/common';
import { createTheme } from '@project/common/theme';
import { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { ExtensionSettingsStorage } from '../../services/extension-settings-storage';
import Popup from './Popup';
import { useRequestingActiveTabPermission } from '../hooks/use-requesting-active-tab-permission';
import { isMobile } from 'react-device-detect';
import { useSettingsProfileContext } from '@project/common/hooks/use-settings-profile-context';
import { StyledEngineProvider } from '@mui/material/styles';
import { DictionaryProvider } from '@project/common/dictionary-db';
import { ExtensionDictionaryStorage } from '@/services/extension-dictionary-storage';
import { isFirefoxBuild } from '@/services/build-flags';

interface Props {
    commands: any;
}

const notifySettingsUpdated = () => {
    const settingsUpdatedCommand: PopupToExtensionCommand<SettingsUpdatedMessage> = {
        sender: 'asbplayer-popup',
        message: {
            command: 'settings-updated',
        },
    };
    browser.runtime.sendMessage(settingsUpdatedCommand);
};

export function PopupUi({ commands }: Props) {
    const dictionaryProvider = useMemo(() => new DictionaryProvider(new ExtensionDictionaryStorage()), []);
    const settingsProvider = useMemo(() => new SettingsProvider(new ExtensionSettingsStorage()), []);
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const theme = useMemo(() => settings && createTheme(settings.themeType), [settings]);

    useEffect(() => {
        settingsProvider.getAll().then(setSettings);
    }, [settingsProvider]);

    const handleSettingsChanged = useCallback(
        async (changed: Partial<AsbplayerSettings>) => {
            setSettings((old: any) => ({ ...old, ...changed }));
            await settingsProvider.set(changed);
            notifySettingsUpdated();
        },
        [settingsProvider]
    );

    const handleOpenExtensionShortcuts = useCallback(() => {
        browser.tabs.create({ active: true, url: 'chrome://extensions/shortcuts' });
    }, []);

    const handleOpenApp = useCallback(async () => {
        if (settings?.streamingAppUrl) {
            browser.tabs.create({ active: true, url: settings.streamingAppUrl });
        }
    }, [settings]);

    const handleOpenSidePanel = useCallback(async () => {
        if (isFirefoxBuild) {
            // @ts-ignore
            browser.sidebarAction.open();
        } else {
            // @ts-ignore
            browser.windows.getLastFocused((window) => browser.sidePanel.open({ windowId: window.id }));
        }
    }, []);

    const handleOpenUserGuide = useCallback(() => {
        browser.tabs.create({ active: true, url: 'https://docs.asbplayer.dev/docs/intro' });
    }, []);

    const { requestingActiveTabPermission, tabRequestingActiveTabPermission } = useRequestingActiveTabPermission();

    useEffect(() => {
        if (!requestingActiveTabPermission || tabRequestingActiveTabPermission === undefined) {
            return;
        }

        const command: ExtensionToVideoCommand<GrantedActiveTabPermissionMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'granted-active-tab-permission',
            },
            src: tabRequestingActiveTabPermission.src,
        };
        browser.tabs.sendMessage(tabRequestingActiveTabPermission.tabId, command);
        window.close();
    }, [requestingActiveTabPermission, tabRequestingActiveTabPermission]);

    const handleProfileChanged = useCallback(() => {
        settingsProvider.getAll().then(setSettings);
        notifySettingsUpdated();
    }, [settingsProvider]);

    const profilesContext = useSettingsProfileContext({
        dictionaryProvider,
        settingsProvider,
        onProfileChanged: handleProfileChanged,
    });

    if (!settings || !theme || requestingActiveTabPermission === undefined) {
        return null;
    }

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Paper
                    square
                    style={{
                        backgroundImage:
                            settings.themeType === 'dark'
                                ? 'linear-gradient(rgba(255, 255, 255, 0.165), rgba(255, 255, 255, 0.165))'
                                : 'none',
                        width: isMobile ? '100%' : 600,
                    }}
                >
                    <Box>
                        <Popup
                            commands={commands}
                            dictionaryProvider={dictionaryProvider}
                            settings={settings}
                            onSettingsChanged={handleSettingsChanged}
                            onOpenApp={handleOpenApp}
                            onOpenSidePanel={handleOpenSidePanel}
                            onOpenExtensionShortcuts={handleOpenExtensionShortcuts}
                            onOpenUserGuide={handleOpenUserGuide}
                            {...profilesContext}
                        />
                    </Box>
                </Paper>
            </ThemeProvider>
        </StyledEngineProvider>
    );
}
