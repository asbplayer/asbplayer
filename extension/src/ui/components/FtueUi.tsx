import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Trans, useTranslation } from 'react-i18next';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import Paper from '@mui/material/Paper';
import { useI18n } from '../hooks/use-i18n';
import { createTheme } from '@project/common/theme';
import { makeStyles } from '@mui/styles';
import CenteredGridContainer from './CenteredGridContainer';
import CenteredGridItem from './CenteredGridItem';
import React, { useEffect, useState } from 'react';
import Tutorial from './Tutorial';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { SettingsProvider } from '@project/common/settings';
import { type PaletteMode } from '@mui/material';

const useStyles = makeStyles({
    container: {
        scrollSnapType: 'y mandatory',
        width: '100dvw',
        height: '100dvh',
        overflowY: 'scroll',
    },
    child: {
        scrollSnapAlign: 'center',
        width: '100dvw',
        height: '100dvh',
    },
});

const WelcomeMessage: React.FC<{ className: string }> = ({ className }) => {
    const { t } = useTranslation();

    return (
        <CenteredGridContainer className={className} direction="column">
            <CenteredGridItem>
                <img style={{ width: 75 }} src={browser.runtime.getURL('/icon/image.png')} />
            </CenteredGridItem>
            <CenteredGridItem>
                <Typography variant="h5">{t('ftue.welcome')}</Typography>
            </CenteredGridItem>
            <CenteredGridItem>
                <Typography variant="h6">
                    <Trans
                        i18nKey="ftue.welcomeBody2"
                        components={[
                            <Link
                                key={0}
                                color="primary"
                                target="_blank"
                                rel="noreferrer"
                                href={'https://docs.asbplayer.dev/docs/intro/'}
                            >
                                readme
                            </Link>,
                        ]}
                    />
                </Typography>
            </CenteredGridItem>
        </CenteredGridContainer>
    );
};

const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());

const useLangParam = () => {
    const [lang, setLang] = useState<string>();
    useEffect(() => setLang(new URLSearchParams(window.location.search).get('lang') ?? undefined), []);
    return lang;
};

const FtueUi = () => {
    const [themeType, setThemeType] = useState<PaletteMode>('dark');
    const theme = createTheme(themeType);
    const langParam = useLangParam();
    const { initialized: i18Initialized } = useI18n({ language: langParam ?? browser.i18n.getUILanguage() });
    const classes = useStyles();
    const [showTutorial, setShowTutorial] = useState<boolean>(false);
    const [hideWelcomePanel, setHideWelcomePanel] = useState<boolean>(false);

    const handleContainerRef = (elm: HTMLDivElement | null) => {
        if (!elm) {
            return;
        }

        elm.onscrollend = () => {
            if (elm.scrollTop > (window.innerHeight * 3) / 4) {
                setHideWelcomePanel(true);
                setShowTutorial(true);
            }
        };
    };

    useEffect(() => {
        settingsProvider.getSingle('themeType').then(setThemeType);
    }, []);

    if (!i18Initialized) {
        return null;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Paper ref={handleContainerRef} className={classes.container} square>
                {!hideWelcomePanel && <WelcomeMessage className={classes.child} />}
                <Tutorial show={showTutorial} className={classes.child} />
            </Paper>
        </ThemeProvider>
    );
};

export default FtueUi;
