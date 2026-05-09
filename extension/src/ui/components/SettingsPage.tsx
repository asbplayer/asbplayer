import { CardModel, HttpFetcher } from '@project/common';
import { useCallback, useEffect, useMemo } from 'react';
import { makeStyles } from '@mui/styles';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import SettingsForm from '@project/common/components/SettingsForm';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import { useCommandKeyBinds } from '../hooks/use-command-key-binds';
import { useLocalFontFamilies } from '@project/common/hooks';
import { useI18n } from '../hooks/use-i18n';
import Paper from '@mui/material/Paper';
import { Anki } from '@project/common/anki';
import { useSupportedLanguages } from '../hooks/use-supported-languages';
import SettingsProfileSelectMenu from '@project/common/components/SettingsProfileSelectMenu';
import { AsbplayerSettings, Profile, testCard } from '@project/common/settings';
import { useTheme, type Theme } from '@mui/material/styles';
import { settingsPageConfigs } from '@/services/pages';
import { DictionaryProvider } from '@project/common/dictionary-db';
import { useLocationHash } from '@project/common/hooks/use-location-hash';

const useStyles = makeStyles<Theme>((theme) => ({
    root: {
        '& .MuiPaper-root': {
            height: '100vh',
        },
    },
    content: {
        maxHeight: '100%',
    },
    profilesContainer: {
        paddingLeft: theme.spacing(4),
        paddingRight: theme.spacing(4),
    },
}));

interface Props {
    dictionaryProvider: DictionaryProvider;
    settings: AsbplayerSettings;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    profiles: Profile[];
    activeProfile?: string;
    inTutorial?: boolean;
    inAnnotationTutorial?: boolean;
    onAnnotationTutorialSeen?: () => void;
    onNewProfile: (name: string) => void;
    onRemoveProfile: (name: string) => void;
    onSetActiveProfile: (name: string | undefined) => void;
}

const extensionTestCard: () => Promise<CardModel> = () => {
    return testCard({
        imageUrl: browser.runtime.getURL('/assets/test-card.jpeg'),
        audioUrl: browser.runtime.getURL('/assets/test-card.mp3'),
    });
};

const SettingsPage = ({
    dictionaryProvider,
    settings,
    inTutorial,
    inAnnotationTutorial,
    onAnnotationTutorialSeen,
    onSettingsChanged,
    ...profileContext
}: Props) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const anki = useMemo(
        () => (settings === undefined ? undefined : new Anki(settings, new HttpFetcher())),
        [settings]
    );
    const classes = useStyles();

    const {
        updateLocalFontsPermission,
        updateLocalFonts,
        localFontsAvailable,
        localFontsPermission,
        localFontFamilies,
    } = useLocalFontFamilies();
    const handleUnlockLocalFonts = useCallback(() => {
        updateLocalFontsPermission();
        updateLocalFonts();
    }, [updateLocalFontsPermission, updateLocalFonts]);

    const commands = useCommandKeyBinds();

    const handleOpenExtensionShortcuts = useCallback(() => {
        browser.tabs.create({ active: true, url: 'chrome://extensions/shortcuts' });
    }, []);

    const { initialized: i18nInitialized } = useI18n({ language: settings?.language ?? 'en' });
    const { supportedLanguages } = useSupportedLanguages();

    const { hash: scrollToId } = useLocationHash();

    if (!settings || !anki || !commands || !i18nInitialized) {
        return null;
    }

    return (
        <Paper square style={{ height: '100vh' }}>
            <Dialog open={true} maxWidth="md" fullWidth className={classes.root} onClose={() => {}}>
                <DialogTitle>{t('settings.title')}</DialogTitle>
                <DialogContent className={classes.content}>
                    <SettingsForm
                        anki={anki}
                        extensionInstalled
                        extensionVersion={browser.runtime.getManifest().version}
                        extensionSupportsAppIntegration
                        extensionSupportsOverlay
                        extensionSupportsSidePanel
                        extensionSupportsOrderableAnkiFields
                        extensionSupportsTrackSpecificSettings
                        extensionSupportsSubtitlesWidthSetting
                        extensionSupportsPauseOnHover
                        extensionSupportsExportCardBind
                        extensionSupportsPageSettings
                        extensionSupportsDictionary
                        extensionSupportsDictionaryBrowser
                        extensionSupportsDictionaryTokenStatusDisplayAlpha
                        extensionSupportsDictionaryYomitanMecab
                        chromeKeyBinds={commands}
                        onOpenChromeExtensionShortcuts={handleOpenExtensionShortcuts}
                        onSettingsChanged={onSettingsChanged}
                        dictionaryProvider={dictionaryProvider}
                        settings={settings}
                        profiles={profileContext.profiles}
                        activeProfile={profileContext.activeProfile}
                        pageConfigs={settingsPageConfigs}
                        localFontsAvailable={localFontsAvailable}
                        localFontsPermission={localFontsPermission}
                        localFontFamilies={localFontFamilies}
                        supportedLanguages={supportedLanguages}
                        onUnlockLocalFonts={handleUnlockLocalFonts}
                        inTutorial={inTutorial}
                        inAnnotationTutorial={inAnnotationTutorial}
                        onAnnotationTutorialSeen={onAnnotationTutorialSeen}
                        testCard={extensionTestCard}
                        scrollToId={scrollToId}
                    />
                </DialogContent>
                <Box style={{ marginBottom: theme.spacing(2) }} className={classes.profilesContainer}>
                    <SettingsProfileSelectMenu {...profileContext} />
                </Box>
            </Dialog>
        </Paper>
    );
};

export default SettingsPage;
