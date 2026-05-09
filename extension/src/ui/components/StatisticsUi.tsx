import { ExtensionDictionaryStorage } from '@/services/extension-dictionary-storage';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { ExtensionMessage } from '@project/common/app';
import { useChromeExtension } from '@project/common/app/hooks/use-chrome-extension';
import Statistics from '@project/common/components/Statistics';
import { DictionaryProvider } from '@project/common/dictionary-db';
import { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import { createTheme } from '@project/common/theme';
import { useI18n } from '../hooks/use-i18n';
import Paper from '@mui/material/Paper';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import { useEffect, useCallback, useMemo } from 'react';
import { uiTabRegistry } from '../hooks/use-has-subtitles';
import { Command, OpenStatisticsOverlayMessage } from '@project/common';

const dictionaryProvider = new DictionaryProvider(new ExtensionDictionaryStorage());
const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());

const StatisticsUi = () => {
    const [settings, setSettings] = useState<AsbplayerSettings>();
    const theme = useMemo(() => settings && createTheme(settings.themeType), [settings]);
    const extension = useChromeExtension({ component: 'statisticsPopup' });

    useEffect(() => {
        settingsProvider.getAll().then(setSettings);
    }, []);

    useEffect(() => {
        return extension.subscribe((message: ExtensionMessage) => {
            if (message.data.command === 'settings-updated') {
                settingsProvider.getAll().then(setSettings);
            }
        });
    }, [extension]);

    const handleViewAnnotationSettings = useCallback(async () => {
        await browser.tabs.create({
            url: `${browser.runtime.getURL('/options.html')}#annotation`,
            active: true,
        });
        window.close();
    }, []);
    const handleOpenStatisticsOverlay = useCallback((mediaId: string) => {
        const command: Command<OpenStatisticsOverlayMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'open-statistics-overlay',
                mediaId,
                force: true,
            },
        };
        browser.runtime.sendMessage(command);
    }, []);

    const { initialized: i18nInitialized } = useI18n({ language: settings?.language ?? 'en' });

    if (!settings || theme === undefined || !i18nInitialized) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper square sx={{ display: 'flex', width: '100vw', height: '100vh', overflowY: 'scroll' }}>
                <Statistics
                    dictionaryProvider={dictionaryProvider}
                    settings={settings}
                    hasSubtitles
                    onSeekWasRequested={uiTabRegistry.focusTabForMediaId}
                    onMineWasRequested={uiTabRegistry.focusTabForMediaId}
                    onViewAnnotationSettings={handleViewAnnotationSettings}
                    onOpenOverlay={handleOpenStatisticsOverlay}
                    sx={{ m: 2, width: '100%', flexGrow: 1 }}
                />
            </Paper>
        </ThemeProvider>
    );
};

export default StatisticsUi;
