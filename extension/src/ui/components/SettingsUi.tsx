import ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import { useSettings } from '../hooks/use-settings';
import { useMemo } from 'react';
import SettingsPage from './SettingsPage';
import { createTheme } from '@project/common/theme';
import { StyledEngineProvider } from '@mui/material/styles';
import { useAnnotationTutorial } from '@project/common/hooks/use-annotation-tutorial';
import { ExtensionGlobalStateProvider } from '@/services/extension-global-state-provider';

const searchParams = new URLSearchParams(window.location.search);
const inTutorial = searchParams.get('tutorial') === 'true';
const globalStateProvider = new ExtensionGlobalStateProvider();

const SettingsUi = () => {
    const { dictionaryProvider, settings, onSettingsChanged, profileContext } = useSettings();
    const theme = useMemo(() => settings && createTheme(settings.themeType), [settings]);
    const { handleAnnotationTutorialSeen, inAnnotationTutorial } = useAnnotationTutorial({ globalStateProvider });

    if (!settings || !theme) {
        return null;
    }

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <SettingsPage
                    dictionaryProvider={dictionaryProvider}
                    settings={settings}
                    onSettingsChanged={onSettingsChanged}
                    inTutorial={inTutorial}
                    inAnnotationTutorial={inAnnotationTutorial}
                    onAnnotationTutorialSeen={handleAnnotationTutorialSeen}
                    {...profileContext}
                />
            </ThemeProvider>
        </StyledEngineProvider>
    );
};

export default SettingsUi;
