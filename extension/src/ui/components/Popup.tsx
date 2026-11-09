import type { Command, HttpPostMessage, OpenStatisticsOverlayMessage, PopupToExtensionCommand } from '@project/common';
import type { AsbplayerSettings, Profile } from '@project/common/settings';
import { chromeCommandBindsToKeyBinds, dictionaryTrackEnabled } from '@project/common/settings';
import SettingsForm from '@project/common/components/SettingsForm';
import PanelIcon from '@project/common/components/PanelIcon';
import LaunchIcon from '@mui/icons-material/Launch';
import SettingsIcon from '@mui/icons-material/Settings';
import { useCallback, useMemo } from 'react';
import Button from '@mui/material/Button';
import type { ButtonProps } from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import { useTranslation } from 'react-i18next';
import type { Fetcher } from '@project/common/src/fetcher';
import { useLocalFontFamilies } from '@project/common/hooks';
import { Anki } from '@project/common/anki';
import { useSupportedLanguages } from '@project/extension/src/ui/hooks/use-supported-languages';
import { useI18n } from '@project/extension/src/ui/hooks/use-i18n';
import { isFirefoxBuild } from '@/services/build-flags';
import { isMobile } from 'react-device-detect';
import SettingsProfileSelectMenu from '@project/common/components/SettingsProfileSelectMenu';
import { settingsPageConfigs } from '@/services/pages';
import Stack from '@mui/material/Stack';
import TutorialIcon from '@project/common/components/TutorialIcon';
import BarChartIcon from '@mui/icons-material/BarChart';
import Paper from '@mui/material/Paper';
import type { DictionaryProvider } from '@project/common/dictionary-db';
import type { LogProvider } from '@project/common/util/log';
import { useAnnotationTutorial } from '@project/common/hooks/use-annotation-tutorial';
import { ExtensionGlobalStateProvider } from '@/services/extension-global-state-provider';
import { uiTabRegistry, useMediaId } from '@project/extension/src/ui/hooks/use-media-id';
import { useExternalConnections } from '@project/extension/src/ui/hooks/use-external-connections';
import Statistics from '@project/common/components/Statistics';
import Box from '@mui/material/Box';
import { createStatisticsPopup } from '@/services/statistics-util';
import Tooltip from '@project/common/components/Tooltip';
import { useCurrentTabId } from '@project/extension/src/ui/hooks/use-current-tab-id';
import ExternalConnections from '@/ui/components/ExternalConnections';
import { activePendingExternalConnections } from '@project/common/global-state';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import type { ToggleButtonProps } from '@mui/material/ToggleButton';
import ExtensionIcon from '@mui/icons-material/Extension';
import Badge from '@mui/material/Badge';
import { createForegroundYomitanFetcher } from '@/services/extension-yomitan-fetcher';

const globalStateProvider = new ExtensionGlobalStateProvider();

type SubView = 'settings' | 'statistics' | 'external-extensions';

interface Props {
    dictionaryProvider: DictionaryProvider;
    logProvider: LogProvider;
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

const handleUnlockLocalFonts = () => {
    void browser.tabs.create({
        url: `${browser.runtime.getURL('/options.html')}#subtitle-appearance`,
        active: true,
    });
};

// Firefox closes the popup when a file picker opens (https://bugzilla.mozilla.org/show_bug.cgi?id=1292701),
// so importing must happen in the options page instead
const handleFirefoxImportSettings = () => {
    void browser.tabs.create({
        url: `${browser.runtime.getURL('/options.html')}#misc-settings`,
        active: true,
    });
    window.close();
};

const SubViewButton: React.FC<
    Omit<ToggleButtonProps, 'value' | 'selected'> & {
        subView: SubView;
        label: string;
    }
> = ({ subView, label, children, ...buttonProps }) => {
    return (
        <Tooltip title={label}>
            <ToggleButton {...buttonProps} value={subView} size="small" aria-label={label}>
                {children}
            </ToggleButton>
        </Tooltip>
    );
};

const NavButton: React.FC<ButtonProps & { label: string }> = ({ label, ...buttonProps }) => {
    return (
        <Tooltip title={label}>
            <Button
                size="small"
                variant="text"
                color="inherit"
                fullWidth={false}
                aria-label={label}
                sx={{
                    flex: '0 0 auto',
                    px: 1,
                    '& .MuiButton-startIcon': { m: 0 },
                }}
                {...buttonProps}
            />
        </Tooltip>
    );
};

const Popup = ({
    dictionaryProvider,
    logProvider,
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
    const { supportedLanguages } = useSupportedLanguages();
    const { localFontsAvailable, localFontsPermission, localFontFamilies } = useLocalFontFamilies();
    const { handleAnnotationTutorialSeen, inAnnotationTutorial } = useAnnotationTutorial({ globalStateProvider });
    const [scrollToId, setScrollToId] = useState<string>();
    const [subView, setSubView] = useState<SubView>('settings');

    const handleViewAnnotationSettings = useCallback(() => {
        setScrollToId('annotation');
        setSubView('settings');
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
        void browser.runtime.sendMessage(command);
    }, []);
    const settingsRef = useRef<AsbplayerSettings>(settings);
    settingsRef.current = settings;

    const currentTabId = useCurrentTabId();
    const { externalConnections } = useExternalConnections();
    const currentMediaIdWithSubtitles = useMediaId({
        whereAsbplayer: (a) => a.tab?.id === currentTabId,
        whereVideoElement: (v) => v.id === currentTabId,
    });
    const hasPendingExternalConnection =
        Object.values(activePendingExternalConnections(externalConnections, Date.now())).length > 0;
    const autoSelectedPendingRef = useRef(false);
    const autoSelectedMediaIdRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (hasPendingExternalConnection && !autoSelectedPendingRef.current) {
            autoSelectedPendingRef.current = true;
            setSubView('external-extensions');
            return;
        }
        if (!hasPendingExternalConnection) {
            autoSelectedPendingRef.current = false;
        }

        const autoGenerateStatistics =
            settingsRef.current?.dictionaryTracks.some(
                (dt) => dictionaryTrackEnabled(dt) && dt.dictionaryAutoGenerateStatistics
            ) ?? false;
        if (
            currentMediaIdWithSubtitles !== undefined &&
            autoGenerateStatistics &&
            autoSelectedMediaIdRef.current !== currentMediaIdWithSubtitles
        ) {
            autoSelectedMediaIdRef.current = currentMediaIdWithSubtitles;
            setSubView('statistics');
        }
    }, [currentMediaIdWithSubtitles, hasPendingExternalConnection]);

    const yomitanFetcher = useMemo(() => createForegroundYomitanFetcher('asbplayer-popup'), []);

    if (!i18nInitialized) {
        return null;
    }

    return (
        <Paper>
            <Stack direction="column" spacing={1.5} sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <ToggleButtonGroup
                        value={subView}
                        exclusive
                        size="small"
                        orientation="horizontal"
                        onChange={(_, value: SubView | null) => {
                            if (value !== null) setSubView(value);
                        }}
                        sx={{
                            // Match the look of the other ButtonGroup on the right side
                            '& .MuiToggleButtonGroup-grouped': {
                                border: 0,
                                margin: 0,
                                minWidth: 0,
                                py: 0.5,
                                px: 1,
                                color: 'text.secondary',
                                '& .MuiSvgIcon-root': { fontSize: 18 },
                                '&:hover': {
                                    color: 'text.primary',
                                    backgroundColor: 'action.hover',
                                },
                            },
                        }}
                    >
                        <SubViewButton subView="settings" label={t('bar.settings')}>
                            <SettingsIcon />
                        </SubViewButton>
                        {currentMediaIdWithSubtitles !== undefined && (
                            <SubViewButton subView="statistics" label={t('statistics.title')}>
                                <BarChartIcon />
                            </SubViewButton>
                        )}
                        <SubViewButton subView="external-extensions" label={t('externalConnections.title')}>
                            <Badge
                                color="warning"
                                variant="dot"
                                overlap="circular"
                                invisible={!hasPendingExternalConnection}
                            >
                                <ExtensionIcon />
                            </Badge>
                        </SubViewButton>
                    </ToggleButtonGroup>
                    <ButtonGroup
                        size="small"
                        variant="text"
                        color="inherit"
                        orientation="horizontal"
                        sx={{ '& .MuiButtonGroup-grouped': { border: 0 } }}
                    >
                        <NavButton startIcon={<LaunchIcon />} onClick={onOpenApp} label={t('action.openApp')} />
                        {!isMobile && (
                            <NavButton
                                startIcon={<PanelIcon />}
                                onClick={onOpenSidePanel}
                                label={t('action.openSidePanel')}
                            />
                        )}
                        <NavButton
                            startIcon={<TutorialIcon />}
                            onClick={onOpenUserGuide}
                            label={t('action.userGuide')}
                        />
                    </ButtonGroup>
                </Stack>

                <Box
                    sx={{
                        height: isMobile ? 'auto' : 390,
                    }}
                >
                    {subView === 'settings' && (
                        <SettingsForm
                            onImportSettings={isFirefoxBuild ? handleFirefoxImportSettings : undefined}
                            heightConstrained
                            extensionInstalled
                            extensionVersion={browser.runtime.getManifest().version}
                            extensionSupportsAppIntegration
                            extensionSupportsOverlay
                            extensionSupportsSidePanel
                            extensionSupportsOrderableAnkiFields
                            extensionSupportsTrackSpecificSettings
                            extensionSupportsSubtitlesWidthSetting
                            extensionSupportsSubtitlesWidthInPixels
                            extensionSupportsPauseOnHover
                            extensionSupportsPlaybackEngine
                            extensionSupportsAutoPauseResume
                            extensionSupportsExportCardBind
                            extensionSupportsPageSettings
                            extensionSupportsDictionary
                            extensionSupportsDictionaryBrowser
                            extensionSupportsDictionaryWaniKani
                            extensionSupportsDictionaryMatchAcrossScripts
                            extensionSupportsSeekableTrackSetting
                            extensionSupportsAutoCopyableTrackSetting
                            extensionSupportsDictionaryTokenStatusDisplayAlpha
                            supportsDictionaryPlayback
                            extensionSupportsDictionaryYomitanMecab
                            extensionSupportsYomitanExtensionMessaging
                            extensionSupportsSubtitleTrackSelectorInWebApp
                            extensionSupportsSubtitleListCustomization
                            extensionSupportsUpdateLastWithSameSubtitleText
                            extensionSupportsAnimatedImageCapture={!isFirefoxBuild}
                            forceVerticalTabs={false}
                            anki={anki}
                            yomitanFetcher={yomitanFetcher}
                            chromeKeyBinds={chromeCommandBindsToKeyBinds(commands)}
                            dictionaryProvider={dictionaryProvider}
                            logProvider={logProvider}
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
                    {subView === 'statistics' && (
                        <Box sx={{ display: 'flex', width: '100%', height: '100%', overflowY: 'scroll' }}>
                            <Statistics
                                contentPadding={1}
                                mediaId={currentMediaIdWithSubtitles}
                                dictionaryProvider={dictionaryProvider}
                                settings={settings}
                                hasSubtitles={currentMediaIdWithSubtitles !== undefined}
                                onViewAnnotationSettings={handleViewAnnotationSettings}
                                onOpenOverlay={handleOpenStatisticsOverlay}
                                onSeekWasRequested={uiTabRegistry.focusTabForMediaId}
                                onMineWasRequested={uiTabRegistry.focusTabForMediaId}
                                onOpenInNewWindow={createStatisticsPopup}
                            />
                        </Box>
                    )}
                    {subView === 'external-extensions' && <ExternalConnections />}
                </Box>
                {subView === 'settings' && (
                    <Box>
                        <SettingsProfileSelectMenu {...profilesContext} />
                    </Box>
                )}
            </Stack>
        </Paper>
    );
};

export default Popup;
