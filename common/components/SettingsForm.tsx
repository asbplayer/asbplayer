import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { type CreateCSSProperties, makeStyles } from '@mui/styles';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { type Theme } from '@mui/material';
import { CardModel } from '@project/common';
import { AsbplayerSettings, PageConfig, PageSettings, Profile } from '@project/common/settings';
import { isNumeric } from '@project/common/util';
import { isMobile } from 'react-device-detect';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { Anki } from '../anki';
import useMediaQuery from '@mui/material/useMediaQuery';
import About from './About';
import { TutorialStep } from './settings-model';
import AnkiSettingsTab from './AnkiSettingsTab';
import MiningSettingsTab from './MiningSettingsTab';
import DictionarySettingsTab from './DictionarySettingsTab';
import SubtitleAppearanceSettingsTab from './SubtitleAppearanceSettingsTab';
import KeyboardShortcutsSettingsTab from './KeyboardShortcutsSettingsTab';
import StreamingVideoSettingsTab from './StreamingVideoSettingsTab';
import MiscSettingsTab from './MiscSettingsTab';
import { DictionaryProvider } from '../dictionary-db';
import TutorialBubble, { type TutorialBubbleProps } from './TutorialBubble';

interface AnnotationTutorialPosition {
    left: number;
    top: number;
    placement: TutorialBubbleProps['placement'];
}

interface StylesProps {
    smallScreen: boolean;
    heightConstrained?: boolean;
}

const useStyles = makeStyles<Theme, StylesProps>((theme) => ({
    root: ({ smallScreen }) => {
        let styles: any = {
            position: 'relative',
            maxHeight: '100%',
            height: 'calc(100% - 48px)',
        };

        if (!smallScreen) {
            styles = { ...styles, flexGrow: 1, display: 'flex', height: '100%' };
        }

        return styles;
    },
    tabs: ({ smallScreen, heightConstrained }) => {
        let buttonStyles: React.CSSProperties = {
            paddingLeft: 0,
            paddingRight: theme.spacing(1),
        };
        if (heightConstrained) {
            buttonStyles = { ...buttonStyles, minHeight: 38, fontSize: 12 };
        }
        let styles: CreateCSSProperties<StylesProps> = {
            '& .MuiButtonBase-root': buttonStyles,
            '& .MuiTab-root': {
                minWidth: 120,
                height: '100%',
            },
        };

        if (!smallScreen) {
            styles = { ...styles, minWidth: 120, width: 120 };
        }

        return styles;
    },
    formGroup: {
        '& .MuiTextField-root': {
            marginTop: theme.spacing(1),
            marginBottom: theme.spacing(1),
        },
    },
    subtitleSetting: {
        '& .MuiTextField-root': {
            marginTop: theme.spacing(1),
            marginBottom: theme.spacing(1),
        },
    },
    subtitlePreview: {
        backgroundImage: `linear-gradient(45deg, ${theme.palette.action.disabledBackground} 25%, transparent 25%), linear-gradient(-45deg, ${theme.palette.action.disabledBackground} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${theme.palette.action.disabledBackground} 75%), linear-gradient(-45deg, transparent 75%,${theme.palette.action.disabledBackground} 75%)`,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
        maxWidth: '100%',
        padding: 10,
    },
    subtitlePreviewInput: {
        border: 'none',
        width: '100%',
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0)',
        '&:focus': {
            outline: 'none',
        },
    },
    switchLabel: {
        justifyContent: 'space-between',
        marginLeft: 0,
        marginRight: -8,
    },
    verticallyCentered: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    },
}));

type TabsOrientation = 'horizontal' | 'vertical';

interface PanelStyleProps {
    tabsOrientation: TabsOrientation;
}

const usePanelStyles = makeStyles<Theme, PanelStyleProps>((theme: Theme) => ({
    panel: ({ tabsOrientation }) => ({
        paddingLeft: tabsOrientation === 'horizontal' ? theme.spacing(1) : theme.spacing(2),
        paddingRight: theme.spacing(1),
        paddingTop: tabsOrientation === 'horizontal' ? theme.spacing(1) : 0,
        overflowY: 'scroll',
        maxHeight: '100%',
        height: '100%',
        width: '100%',
    }),
}));

interface TabPanelProps {
    children?: React.ReactNode;
    index: any;
    value: any;
    tabsOrientation: TabsOrientation;
}

const TabPanel = React.forwardRef<HTMLDivElement, TabPanelProps>(function TabPanel(
    { children, value, index, tabsOrientation, ...other }: TabPanelProps,
    ref
) {
    const classes = usePanelStyles({ tabsOrientation });
    return (
        <Box ref={ref} className={classes.panel} hidden={value !== index} {...other}>
            {value === index && children}
        </Box>
    );
});

type TabName =
    | 'anki-settings'
    | 'mining-settings'
    | 'annotation'
    | 'subtitle-appearance'
    | 'keyboard-shortcuts'
    | 'streaming-video'
    | 'misc-settings';

interface SettingsFormPageConfig extends PageConfig {
    faviconUrl: string;
}

export type PageConfigMap = { [K in keyof PageSettings]: SettingsFormPageConfig };

interface Props {
    anki: Anki;
    extensionInstalled: boolean;
    extensionVersion?: string;
    extensionSupportsAppIntegration: boolean;
    extensionSupportsOverlay: boolean;
    extensionSupportsSidePanel: boolean;
    extensionSupportsOrderableAnkiFields: boolean;
    extensionSupportsTrackSpecificSettings: boolean;
    extensionSupportsSubtitlesWidthSetting: boolean;
    extensionSupportsPauseOnHover: boolean;
    extensionSupportsExportCardBind: boolean;
    extensionSupportsPageSettings: boolean;
    extensionSupportsDictionary: boolean;
    extensionSupportsDictionaryBrowser: boolean;
    extensionSupportsDictionaryTokenStatusDisplayAlpha: boolean;
    extensionSupportsDictionaryYomitanMecab: boolean;
    insideApp?: boolean;
    appVersion?: string;
    dictionaryProvider: DictionaryProvider;
    settings: AsbplayerSettings;
    profiles: Profile[];
    activeProfile?: string;
    pageConfigs?: PageConfigMap;
    scrollToId?: string;
    chromeKeyBinds: { [key: string]: string | undefined };
    localFontsAvailable: boolean;
    localFontsPermission?: PermissionState;
    localFontFamilies: string[];
    supportedLanguages: string[];
    forceVerticalTabs?: boolean;
    inTutorial?: boolean;
    inAnnotationTutorial?: boolean;
    onAnnotationTutorialSeen?: () => void;
    heightConstrained?: boolean;
    testCard?: () => Promise<CardModel>;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onOpenChromeExtensionShortcuts: () => void;
    onUnlockLocalFonts: () => void;
}

// Filter out keys that look like '0', '1', ... as those are invalid
const cssStyles = Object.keys(document.body.style).filter((s) => !isNumeric(s));

export default function SettingsForm({
    anki,
    dictionaryProvider,
    settings,
    profiles,
    activeProfile,
    pageConfigs,
    extensionInstalled,
    extensionVersion,
    extensionSupportsAppIntegration,
    extensionSupportsOverlay,
    extensionSupportsSidePanel,
    extensionSupportsOrderableAnkiFields,
    extensionSupportsTrackSpecificSettings,
    extensionSupportsSubtitlesWidthSetting,
    extensionSupportsPauseOnHover,
    extensionSupportsExportCardBind,
    extensionSupportsPageSettings,
    extensionSupportsDictionary,
    extensionSupportsDictionaryBrowser,
    extensionSupportsDictionaryTokenStatusDisplayAlpha,
    extensionSupportsDictionaryYomitanMecab,
    insideApp,
    appVersion,
    scrollToId,
    chromeKeyBinds,
    localFontsAvailable,
    localFontsPermission,
    localFontFamilies,
    supportedLanguages,
    forceVerticalTabs,
    inTutorial,
    inAnnotationTutorial,
    onAnnotationTutorialSeen,
    heightConstrained,
    testCard,
    onSettingsChanged,
    onOpenChromeExtensionShortcuts,
    onUnlockLocalFonts,
}: Props) {
    const supportsDictionary = !extensionInstalled || extensionSupportsDictionary;
    const supportsDictionaryBrowser = !extensionInstalled || extensionSupportsDictionaryBrowser;
    const supportsDictionaryTokenStatusDisplayAlpha =
        !extensionInstalled || extensionSupportsDictionaryTokenStatusDisplayAlpha;
    const supportsDictionaryYomitanMecab = !extensionInstalled || extensionSupportsDictionaryYomitanMecab;
    const theme = useTheme();
    const smallScreen = useMediaQuery(theme.breakpoints.down(500)) && !forceVerticalTabs;
    const classes = useStyles({ smallScreen, heightConstrained });
    const handleSettingChanged = useCallback(
        async <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => {
            onSettingsChanged({ [key]: value });
        },
        [onSettingsChanged]
    );
    const { t } = useTranslation();
    const { noteType } = settings;
    const tabIndicesById = useMemo(() => {
        const tabs = [
            'anki-settings',
            'mining-settings',
            'subtitle-appearance',
            'keyboard-shortcuts',
            'annotation',
            'streaming-video',
            'misc-settings',
            'about',
        ];

        if (!extensionSupportsAppIntegration) tabs.splice(tabs.indexOf('streaming-video'), 1);
        if (!supportsDictionary) tabs.splice(tabs.indexOf('annotation'), 1);

        return Object.fromEntries(tabs.map((tab, i) => [tab, i]));
    }, [extensionSupportsAppIntegration, supportsDictionary]);

    useEffect(() => {
        if (!scrollToId) {
            return;
        }

        if (scrollToId in tabIndicesById) {
            setTabIndex(tabIndicesById[scrollToId as TabName]);
        }
    }, [scrollToId, tabIndicesById]);

    const [tabIndex, setTabIndex] = useState<number>(0);
    const tabsOrientation = smallScreen ? 'horizontal' : 'vertical';
    const [tutorialStep, setTutorialStep] = useState<TutorialStep>(TutorialStep.ankiConnect);

    useEffect(() => {
        if (tutorialStep === TutorialStep.noteType && noteType) {
            setTutorialStep(TutorialStep.ankiFields);
        }
    }, [tutorialStep, noteType]);

    const handleAnnotationTutorialSeen = useCallback(() => {
        onAnnotationTutorialSeen?.();
    }, [onAnnotationTutorialSeen]);

    const ankiPanelRef = useRef<HTMLDivElement>(null);
    const keyboardShortcutsPanelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (tutorialStep === TutorialStep.testCard) {
            ankiPanelRef.current?.scrollBy({ behavior: 'smooth', top: 100000 });
        }
    }, [tutorialStep]);

    const rootRef = useRef<HTMLDivElement | null>(null);
    const annotationTabRef = useRef<HTMLDivElement | null>(null);

    const calculateAnnotationTutorialPosition = useCallback(() => {
        if (!rootRef.current || !annotationTabRef.current) {
            return;
        }

        const elm = annotationTabRef.current;
        const height = elm.getBoundingClientRect().height;
        const width = elm.getBoundingClientRect().width;

        if (smallScreen) {
            setAnnotationTutorialPosition({
                left: Math.min(elm.offsetLeft + width / 2, rootRef.current.clientWidth / 2),
                top: elm.offsetTop + height,
                placement: 'bottom',
            });
        } else {
            setAnnotationTutorialPosition({
                left: elm.offsetLeft + width,
                top: elm.offsetTop + height / 2,
                placement: 'right',
            });
        }
    }, [smallScreen]);

    const handleRootRef = useCallback(
        (ref: HTMLDivElement | null) => {
            if (!ref) {
                return;
            }
            rootRef.current = ref;
            calculateAnnotationTutorialPosition();
        },
        [calculateAnnotationTutorialPosition]
    );

    const handleAnnotationTabRef = useCallback(
        (ref: HTMLDivElement | null) => {
            if (!ref) {
                return;
            }
            annotationTabRef.current = ref;
            calculateAnnotationTutorialPosition();
        },
        [calculateAnnotationTutorialPosition]
    );

    const [annotationTutorialPosition, setAnnotationTutorialPosition] = useState<AnnotationTutorialPosition>();

    return (
        <div ref={handleRootRef} className={classes.root}>
            {annotationTutorialPosition && (
                <TutorialBubble
                    show={inAnnotationTutorial}
                    placement={annotationTutorialPosition.placement}
                    text={t('settings.ftueAnnotation')}
                    onConfirm={handleAnnotationTutorialSeen}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: annotationTutorialPosition.left,
                            top: annotationTutorialPosition.top,
                        }}
                    />
                </TutorialBubble>
            )}
            <Tabs
                orientation={tabsOrientation}
                variant="scrollable"
                value={tabIndex}
                className={classes.tabs}
                scrollButtons={false}
                onChange={(event, index) => {
                    setTabIndex(index);
                    if (supportsDictionary && inAnnotationTutorial && index === 4) {
                        onAnnotationTutorialSeen?.();
                    }
                }}
                sx={{
                    maxWidth: '100vw',
                    marginLeft: smallScreen ? 'auto' : 0,
                    marginRight: smallScreen ? 'auto' : 0,
                }}
            >
                <Tab tabIndex={0} label={t('settings.anki')} id="anki-settings" />
                <Tab tabIndex={1} label={t('settings.mining')} id="mining-settings" />
                <Tab tabIndex={2} label={t('settings.subtitleAppearance')} id="subtitle-appearance" />
                <Tab tabIndex={3} label={t('settings.keyboardShortcuts')} id="keyboard-shortcuts" />
                {supportsDictionary && (
                    <Tab ref={handleAnnotationTabRef} tabIndex={4} label={t('settings.annotation')} id="annotation" />
                )}
                {extensionSupportsAppIntegration && (
                    <Tab
                        tabIndex={4 + Number(supportsDictionary)}
                        label={t('settings.streamingVideo')}
                        id="streaming-video"
                    />
                )}
                <Tab
                    tabIndex={4 + Number(supportsDictionary) + Number(extensionSupportsAppIntegration)}
                    label={t('settings.misc')}
                    id="misc-settings"
                />
                <Tab
                    tabIndex={5 + Number(supportsDictionary) + Number(extensionSupportsAppIntegration)}
                    label={t('about.title')}
                    id="about"
                />
            </Tabs>
            <TabPanel
                ref={ankiPanelRef}
                value={tabIndex}
                index={tabIndicesById['anki-settings']}
                tabsOrientation={tabsOrientation}
            >
                <AnkiSettingsTab
                    settings={settings}
                    extensionInstalled={extensionInstalled}
                    extensionSupportsOrderableAnkiFields={extensionSupportsOrderableAnkiFields}
                    isMobile={isMobile}
                    insideApp={insideApp}
                    inTutorial={inTutorial}
                    onSettingChanged={handleSettingChanged}
                    onSettingsChanged={onSettingsChanged}
                    tutorialStep={tutorialStep}
                    onTutorialStepChanged={setTutorialStep}
                    anki={anki}
                    testCard={testCard}
                />
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['mining-settings']} tabsOrientation={tabsOrientation}>
                <MiningSettingsTab
                    settings={settings}
                    onSettingChanged={handleSettingChanged}
                    showWebmMediaFragmentSettings={Boolean(insideApp)}
                />
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['annotation']} tabsOrientation={tabsOrientation}>
                <DictionarySettingsTab
                    anki={anki}
                    dictionaryProvider={dictionaryProvider}
                    settings={settings}
                    profiles={profiles}
                    activeProfile={activeProfile}
                    extensionInstalled={extensionInstalled}
                    supportsDictionaryBrowser={supportsDictionaryBrowser}
                    supportsDictionaryTokenStatusDisplayAlpha={supportsDictionaryTokenStatusDisplayAlpha}
                    supportsDictionaryYomitanMecab={supportsDictionaryYomitanMecab}
                    onSettingChanged={handleSettingChanged}
                    onViewKeyboardShortcuts={() => {
                        setTabIndex(tabIndicesById['keyboard-shortcuts']);
                        setTimeout(
                            () => keyboardShortcutsPanelRef.current?.scrollBy({ top: 10000, behavior: 'smooth' }),
                            0
                        );
                    }}
                />
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['subtitle-appearance']} tabsOrientation={tabsOrientation}>
                <SubtitleAppearanceSettingsTab
                    settings={settings}
                    onSettingChanged={handleSettingChanged}
                    onSettingsChanged={onSettingsChanged}
                    extensionInstalled={extensionInstalled}
                    extensionSupportsTrackSpecificSettings={extensionSupportsTrackSpecificSettings}
                    extensionSupportsSubtitlesWidthSetting={extensionSupportsSubtitlesWidthSetting}
                    localFontsAvailable={localFontsAvailable}
                    localFontsPermission={localFontsPermission}
                    localFontFamilies={localFontFamilies}
                    onUnlockLocalFonts={onUnlockLocalFonts}
                />
            </TabPanel>
            <TabPanel
                ref={keyboardShortcutsPanelRef}
                value={tabIndex}
                index={tabIndicesById['keyboard-shortcuts']}
                tabsOrientation={tabsOrientation}
            >
                <KeyboardShortcutsSettingsTab
                    settings={settings}
                    onSettingChanged={handleSettingChanged}
                    chromeKeyBinds={chromeKeyBinds}
                    extensionInstalled={extensionInstalled}
                    extensionSupportsExportCardBind={extensionSupportsExportCardBind}
                    extensionSupportsSidePanel={extensionSupportsSidePanel}
                    onOpenChromeExtensionShortcuts={onOpenChromeExtensionShortcuts}
                />
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['streaming-video']} tabsOrientation={tabsOrientation}>
                <StreamingVideoSettingsTab
                    settings={settings}
                    onSettingChanged={handleSettingChanged}
                    onSettingsChanged={onSettingsChanged}
                    insideApp={insideApp}
                    extensionSupportsOverlay={extensionSupportsOverlay}
                    extensionSupportsPageSettings={extensionSupportsPageSettings}
                    pageConfigs={pageConfigs}
                />
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['misc-settings']} tabsOrientation={tabsOrientation}>
                <MiscSettingsTab
                    settings={settings}
                    onSettingChanged={handleSettingChanged}
                    onSettingsChanged={onSettingsChanged}
                    supportedLanguages={supportedLanguages}
                    insideApp={insideApp}
                    extensionInstalled={extensionInstalled}
                    extensionSupportsPauseOnHover={extensionSupportsPauseOnHover}
                />
            </TabPanel>
            <TabPanel value={tabIndex} index={tabIndicesById['about']} tabsOrientation={tabsOrientation}>
                <About
                    appVersion={insideApp ? appVersion : undefined}
                    extensionVersion={extensionInstalled ? extensionVersion : undefined}
                />
            </TabPanel>
        </div>
    );
}
