import { useCallback, useMemo } from 'react';
import makeStyles from '@mui/styles/makeStyles';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import ChromeExtension from '../services/chrome-extension';
import SettingsForm from '../../components/SettingsForm';
import { useLocalFontFamilies } from '../../hooks';
import { Anki } from '../../anki';
import { AsbplayerSettings, Profile, supportedLanguages, testCard } from '../../settings';
import SettingsProfileSelectMenu from '../../components/SettingsProfileSelectMenu';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { type Theme } from '@mui/material';
import { DictionaryProvider } from '../../dictionary-db';
import { useAnnotationTutorial } from '@project/common/hooks/use-annotation-tutorial';
import { AppExtensionGlobalStateProvider } from '../services/app-extension-global-state-provider';

const appTestCard = () => {
    const basePath = window.location.pathname === '/' ? '' : window.location.pathname;
    return testCard({ imageUrl: `${basePath}/assets/test-card.jpeg`, audioUrl: `${basePath}/assets/test-card.mp3` });
};

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
        paddingBottom: theme.spacing(2),
    },
    title: {
        flexGrow: 1,
    },
}));

interface Props {
    anki: Anki;
    extension: ChromeExtension;
    open: boolean;
    dictionaryProvider: DictionaryProvider;
    settings: AsbplayerSettings;
    scrollToId?: string;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onClose: () => void;
    profiles: Profile[];
    activeProfile?: string;
    onNewProfile: (name: string) => void;
    onRemoveProfile: (name: string) => void;
    onSetActiveProfile: (name: string | undefined) => void;
}

export default function SettingsDialog({
    anki,
    extension,
    open,
    dictionaryProvider,
    settings,
    scrollToId,
    onSettingsChanged,
    onClose,
    ...profilesContext
}: Props) {
    const { t } = useTranslation();
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
    const globalStateProvider = useMemo(() => new AppExtensionGlobalStateProvider(extension), [extension]);
    const { inAnnotationTutorial, handleAnnotationTutorialSeen } = useAnnotationTutorial({ globalStateProvider });

    return (
        <Dialog open={open} maxWidth="md" fullWidth className={classes.root} onClose={onClose}>
            <Toolbar>
                <Typography variant="h6" className={classes.title}>
                    {t('settings.title')}
                </Typography>
                <IconButton edge="end" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>
            <DialogContent className={classes.content}>
                <SettingsForm
                    anki={anki}
                    extensionInstalled={extension.installed}
                    extensionVersion={extension.installed ? extension.version : undefined}
                    extensionSupportsAppIntegration={extension.supportsAppIntegration}
                    extensionSupportsOverlay={extension.supportsStreamingVideoOverlay}
                    extensionSupportsSidePanel={extension.supportsSidePanel}
                    extensionSupportsOrderableAnkiFields={extension.supportsOrderableAnkiFields}
                    extensionSupportsTrackSpecificSettings={extension.supportsTrackSpecificSettings}
                    extensionSupportsSubtitlesWidthSetting={extension.supportsSubtitlesWidthSetting}
                    extensionSupportsPauseOnHover={extension.supportsPauseOnHover}
                    extensionSupportsExportCardBind={extension.supportsExportCardBind}
                    extensionSupportsPageSettings={extension.supportsPageSettings}
                    extensionSupportsDictionary={extension.supportsDictionary}
                    extensionSupportsDictionaryBrowser={extension.supportsDictionaryBrowser}
                    extensionSupportsDictionaryTokenStatusDisplayAlpha={
                        extension.supportsDictionaryTokenStatusDisplayAlpha
                    }
                    extensionSupportsDictionaryYomitanMecab={extension.supportsDictionaryYomitanMecab}
                    pageConfigs={extension.pageConfig}
                    insideApp
                    appVersion={import.meta.env.VITE_APP_GIT_COMMIT}
                    chromeKeyBinds={extension.extensionCommands}
                    onOpenChromeExtensionShortcuts={extension.openShortcuts}
                    onSettingsChanged={onSettingsChanged}
                    dictionaryProvider={dictionaryProvider}
                    settings={settings}
                    profiles={profilesContext.profiles}
                    activeProfile={profilesContext.activeProfile}
                    scrollToId={scrollToId}
                    localFontsAvailable={localFontsAvailable}
                    localFontsPermission={localFontsPermission}
                    localFontFamilies={localFontFamilies}
                    supportedLanguages={supportedLanguages}
                    testCard={appTestCard}
                    onUnlockLocalFonts={handleUnlockLocalFonts}
                    inAnnotationTutorial={inAnnotationTutorial}
                    onAnnotationTutorialSeen={handleAnnotationTutorialSeen}
                />
            </DialogContent>
            {(!extension.installed || extension.supportsSettingsProfiles) && (
                <Box className={classes.profilesContainer}>
                    <SettingsProfileSelectMenu {...profilesContext} />
                </Box>
            )}
        </Dialog>
    );
}
