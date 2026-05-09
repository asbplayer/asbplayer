import Grid from '@mui/material/Grid';
import { Command, HttpPostMessage, OpenStatisticsOverlayMessage, PopupToExtensionCommand } from '@project/common';
import {
    AsbplayerSettings,
    Profile,
    chromeCommandBindsToKeyBinds,
    dictionaryTrackEnabled,
} from '@project/common/settings';
import SettingsForm from '@project/common/components/SettingsForm';
import PanelIcon from '@project/common/components/PanelIcon';
import LaunchIcon from '@mui/icons-material/Launch';
import SettingsIcon from '@mui/icons-material/Settings';
import { useCallback, useMemo } from 'react';
import Button, { type ButtonProps } from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { useTranslation } from 'react-i18next';
import { Fetcher } from '@project/common/src/fetcher';
import { useLocalFontFamilies } from '@project/common/hooks';
import { Anki } from '@project/common/anki';
import { useSupportedLanguages } from '../hooks/use-supported-languages';
import { useI18n } from '../hooks/use-i18n';
import { isMobile } from 'react-device-detect';
import { useTheme } from '@mui/material/styles';
import SettingsProfileSelectMenu from '@project/common/components/SettingsProfileSelectMenu';
import { settingsPageConfigs } from '@/services/pages';
import Stack from '@mui/material/Stack';
import TutorialIcon from '@project/common/components/TutorialIcon';
import BarChartIcon from '@mui/icons-material/BarChart';
import Paper from '@mui/material/Paper';
import { DictionaryProvider } from '@project/common/dictionary-db';
import { useAnnotationTutorial } from '@project/common/hooks/use-annotation-tutorial';
import { ExtensionGlobalStateProvider } from '@/services/extension-global-state-provider';
import { uiTabRegistry, useHasSubtitles } from '../hooks/use-has-subtitles';
import Statistics from '@project/common/components/Statistics';
import Box from '@mui/material/Box';
import { createStatisticsPopup } from '@/services/statistics-util';
import Tooltip from '@project/common/components/Tooltip';

const globalStateProvider = new ExtensionGlobalStateProvider();

interface Props {
    dictionaryProvider: DictionaryProvider;
    settings: AsbplayerSettings;
    commands: any;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onOpenApp: () => void;
    onOpenSidePanel: () => void;
    onOpenExtensionShortcuts: () => void;
    onOpenUserGuide: () => void;
    profiles: Profile[];
    activeProfile?: string;
    onNewProfile: (name: string) => void;
    onRemoveProfile: (name: string) => void;
    onSetActiveProfile: (name: string | undefined) => void;
}

class ExtensionFetcher implements Fetcher {
    fetch(url: string, body: any) {
        const httpPostCommand: PopupToExtensionCommand<HttpPostMessage> = {
            sender: 'asbplayer-popup',
            message: {
                command: 'http-post',
                url,
                body,
                messageId: '',
            },
        };
        return browser.runtime.sendMessage(httpPostCommand);
    }
}

const NavButton: React.FC<ButtonProps & { label: string }> = ({ label, ...buttonProps }) => {
    const [isOverflowing, setIsOverflowing] = useState<boolean>();
    return (
        <Tooltip title={label} disabled={!isOverflowing}>
            <Button size="small" variant="contained" color="primary" {...buttonProps}>
                <span
                    ref={(ref) => {
                        setIsOverflowing(ref !== null && ref.scrollWidth > ref.clientWidth);
                    }}
                    style={{
                        display: 'block',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {label}
                </span>
            </Button>
        </Tooltip>
    );
};

const Popup = ({
    dictionaryProvider,
    settings,
    commands,
    onOpenApp,
    onOpenSidePanel,
    onSettingsChanged,
    onOpenExtensionShortcuts,
    onOpenUserGuide,
    ...profilesContext
}: Props) => {
    const { t } = useTranslation();
    const { initialized: i18nInitialized } = useI18n({ language: settings.language });
    const anki = useMemo(() => new Anki(settings, new ExtensionFetcher()), [settings]);
    const handleUnlockLocalFonts = useCallback(() => {
        browser.tabs.create({
            url: `${browser.runtime.getURL('/options.html')}#subtitle-appearance`,
            active: true,
        });
    }, []);
    const { supportedLanguages } = useSupportedLanguages();
    const { localFontsAvailable, localFontsPermission, localFontFamilies } = useLocalFontFamilies();
    const theme = useTheme();
    const { handleAnnotationTutorialSeen, inAnnotationTutorial } = useAnnotationTutorial({ globalStateProvider });
    const hasSubtitles = useHasSubtitles({ whereAsbplayer: (asbplayer) => !asbplayer.syncedVideoElement }); // Only care about owners
    const [scrollToId, setScrollToId] = useState<string>();
    const handleViewAnnotationSettings = useCallback(() => {
        setScrollToId('annotation');
        setStatisticsOpen(false);
    }, []);
    const handleOpenStatisticsOverlay = useCallback((mediaId: string) => {
        const command: Command<OpenStatisticsOverlayMessage> = {
            sender: 'asbplayer-popup',
            message: {
                command: 'open-statistics-overlay',
                mediaId,
                force: true,
            },
        };
        browser.runtime.sendMessage(command);
    }, []);

    const [statisticsOpen, setStatisticsOpen] = useState<boolean>(false);

    const settingsRef = useRef<AsbplayerSettings>(settings);
    settingsRef.current = settings;

    useEffect(() => {
        const annotationsEnabled =
            settingsRef.current?.dictionaryTracks.some((dt) => dictionaryTrackEnabled(dt)) ?? false;
        setStatisticsOpen(hasSubtitles && annotationsEnabled);
    }, [hasSubtitles]);

    const handleToggleStatistics = useCallback(() => setStatisticsOpen((v) => !v), []);
    const fetchStatisticsMediaInfo = useCallback(async (mediaId: string) => {
        const sourceString = (await uiTabRegistry.activeVideoElements()).find((v) => v.src === mediaId)?.title;
        return { sourceString: sourceString ?? '' };
    }, []);

    if (!i18nInitialized) {
        return null;
    }

    return (
        <Paper>
            <Stack direction="column" spacing={1.5} sx={{ padding: theme.spacing(1.5) }}>
                <ButtonGroup
                    fullWidth
                    size="small"
                    variant="contained"
                    color="primary"
                    orientation="horizontal"
                    sx={{
                        '& .MuiButton-root': {
                            height: '36px',
                        },
                    }}
                >
                    {hasSubtitles && (
                        <>
                            {statisticsOpen && (
                                <NavButton
                                    startIcon={<SettingsIcon />}
                                    onClick={handleToggleStatistics}
                                    label={t('bar.settings')}
                                />
                            )}
                            {!statisticsOpen && (
                                <NavButton
                                    startIcon={<BarChartIcon />}
                                    onClick={handleToggleStatistics}
                                    label={t('statistics.title')}
                                />
                            )}
                        </>
                    )}
                    <NavButton startIcon={<LaunchIcon />} onClick={onOpenApp} label={t('action.openApp')} />
                    {!isMobile && (
                        <NavButton
                            startIcon={<PanelIcon />}
                            onClick={onOpenSidePanel}
                            label={t('action.openSidePanel')}
                        />
                    )}
                    <NavButton startIcon={<TutorialIcon />} onClick={onOpenUserGuide} label={t('action.userGuide')} />
                </ButtonGroup>
                <Grid
                    item
                    style={{
                        height: isMobile ? 'auto' : 390,
                    }}
                >
                    {!statisticsOpen && (
                        <SettingsForm
                            heightConstrained
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
                            forceVerticalTabs={false}
                            anki={anki}
                            chromeKeyBinds={chromeCommandBindsToKeyBinds(commands)}
                            dictionaryProvider={dictionaryProvider}
                            settings={settings}
                            profiles={profilesContext.profiles}
                            activeProfile={profilesContext.activeProfile}
                            pageConfigs={settingsPageConfigs}
                            localFontsAvailable={localFontsAvailable}
                            localFontsPermission={localFontsPermission}
                            localFontFamilies={localFontFamilies}
                            supportedLanguages={supportedLanguages}
                            onSettingsChanged={onSettingsChanged}
                            onOpenChromeExtensionShortcuts={onOpenExtensionShortcuts}
                            onUnlockLocalFonts={handleUnlockLocalFonts}
                            inAnnotationTutorial={inAnnotationTutorial}
                            onAnnotationTutorialSeen={handleAnnotationTutorialSeen}
                            scrollToId={scrollToId}
                        />
                    )}
                    {statisticsOpen && (
                        <Box sx={{ display: 'flex', width: '100%', height: '100%', overflowY: 'scroll' }}>
                            <Statistics
                                dictionaryProvider={dictionaryProvider}
                                settings={settings}
                                hasSubtitles={hasSubtitles}
                                onViewAnnotationSettings={handleViewAnnotationSettings}
                                onOpenOverlay={handleOpenStatisticsOverlay}
                                onSeekWasRequested={uiTabRegistry.focusTabForMediaId}
                                onMineWasRequested={uiTabRegistry.focusTabForMediaId}
                                onOpenInNewWindow={createStatisticsPopup}
                                mediaInfoFetcher={fetchStatisticsMediaInfo}
                                sx={{ m: 1 }}
                            />
                        </Box>
                    )}
                </Grid>
                {!statisticsOpen && (
                    <Grid item>
                        <SettingsProfileSelectMenu {...profilesContext} />
                    </Grid>
                )}
            </Stack>
        </Paper>
    );
};

export default Popup;
