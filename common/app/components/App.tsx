import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { makeStyles } from '@mui/styles';
import { type Theme } from '@mui/material/styles';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import { useWindowSize } from '../hooks/use-window-size';
import { useLocationHash } from '@project/common/hooks/use-location-hash';
import {
    Image,
    OpenStatisticsOverlayMessage,
    SubtitleModel,
    VideoTabModel,
    LegacyPlayerSyncMessage,
    PlayerSyncMessage,
    PostMineAction,
    PlayMode,
    CopyHistoryItem,
    Fetcher,
    CardModel,
    ShowAnkiUiMessage,
    JumpToSubtitleMessage,
    DownloadImageMessage,
    DownloadAudioMessage,
    CardTextFieldValues,
    ImageErrorCode,
    RequestSubtitlesResponse,
} from '@project/common';
import { createTheme } from '@project/common/theme';
import { AsbplayerSettings, Profile, SettingsProvider } from '@project/common/settings';
import { humanReadableTime, download, extractText, timeDurationDisplay } from '@project/common/util';
import { AudioClip, Mp3Encoder } from '@project/common/audio-clip';
import { ExportParams } from '@project/common/anki';
import { SubtitleReader } from '@project/common/subtitle-reader';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import Alert from './Alert';
import AnkiDialog from '@project/common/components/AnkiDialog';
import Paper from '@mui/material/Paper';
import DragOverlay from './DragOverlay';
import Bar from './Bar';
import ChromeExtension, { ExtensionMessage } from '../services/chrome-extension';
import CopyHistory from './CopyHistory';
import StatisticsDrawer from '@project/common/components/StatisticsDrawer';
import LandingPage from './LandingPage';
import Player, { MediaSources } from './Player';
import SettingsDialog from './SettingsDialog';
import VideoPlayer, { SeekRequest } from './VideoPlayer';
import { type AlertColor } from '@mui/material/Alert';
import VideoChannel from '../services/video-channel';
import { addBlobUrl, createBlobUrl, revokeBlobUrl } from '../../blob-url';
import { useTranslation } from 'react-i18next';
import { LocalizedError } from './localized-error';
import { DisplaySubtitleModel } from './SubtitlePlayer';
import { useCopyHistory } from '../hooks/use-copy-history';
import { useFileSession } from '../hooks/use-file-session';
import { useI18n } from '../hooks/use-i18n';
import { useAppKeyBinder } from '../hooks/use-app-key-binder';
import { useAnki } from '../hooks/use-anki';
import { usePlaybackPreferences } from '../hooks/use-playback-preferences';
import { MiningContext } from '../services/mining-context';
import { useAppWebSocketClient } from '../hooks/use-app-web-socket-client';
import { LoadSubtitlesCommand } from '../../web-socket-client';
import { ExtensionBridgedCopyHistoryRepository } from '../services/extension-bridged-copy-history-repository';
import { IndexedDBCopyHistoryRepository } from '../../copy-history';
import { supportsFileSystemAccess, showFilePicker, requestPermissions, resolveFiles } from '../../file-system-access';
import { isMobile } from 'react-device-detect';
import { GlobalState } from '../../global-state';
import mp3WorkerFactory from '../../audio-clip/mp3-encoder-worker.ts?worker';
import pgsParserWorkerFactory from '../../subtitle-reader/pgs-parser-worker.ts?worker';
import CssBaseline from '@mui/material/CssBaseline';
import { StyledEngineProvider } from '@mui/material/styles';
import { useServiceWorker } from '../hooks/use-service-worker';
import NeedRefreshDialog from './NeedRefreshDialog';
import { DictionaryProvider } from '../../dictionary-db';
import { isFirefox } from '../../browser-detection';
import StatisticsOverlay, { StatisticsOverlayProps } from '../../components/StatisticsOverlay';

const latestExtensionVersion = '1.15.0';
const extensionUrl =
    'https://chromewebstore.google.com/detail/asbplayer-language-learni/hkledmpjpaehamkiehglnbelcpdflcab';

const useContentStyles = makeStyles<Theme, ContentProps>((theme) => ({
    content: {
        flexGrow: 1,
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        marginRight: 0,
    },
    contentShift: ({ drawerWidth }) => ({
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginRight: drawerWidth,
    }),
}));

const videoExtensions = ['.mkv', '.mp4', '.m4v', '.avi', '.webm'] as const;
const audioExtensions = ['.mp3', '.m4a', '.aac', '.flac', '.ogg', '.wav', '.opus', '.m4b'] as const;
const subtitleExtensions = [
    '.srt',
    '.ass',
    '.vtt',
    '.sup',
    '.nfvtt',
    '.ytxml',
    '.ytsrv3',
    '.dfxp',
    '.ttml2',
    '.bbjson',
] as const;
const inputAcceptFileExtensions = [...subtitleExtensions, ...audioExtensions, ...videoExtensions].join(',');

const VIDEO_EXT_SET = new Set<string>(videoExtensions);
const AUDIO_EXT_SET = new Set<string>(audioExtensions);
const SUBTITLE_EXT_SET = new Set<string>(subtitleExtensions);

const getExtension = (fileName: string) => {
    const index = fileName.lastIndexOf('.');
    return index === -1 ? '' : fileName.substring(index).toLowerCase();
};

async function extractDropFileHandles(items: DataTransferItemList): Promise<FileSystemFileHandle[] | undefined> {
    const handlePromises: Promise<any>[] = [];

    for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        if (item.kind !== 'file') {
            continue;
        }

        // Persist dropped handles only when the browser exposes getAsFileSystemHandle.
        const getAsFileSystemHandle = (item as any).getAsFileSystemHandle as (() => Promise<any>) | undefined;
        if (typeof getAsFileSystemHandle !== 'function') {
            return undefined;
        }

        // Capture handle promises synchronously before DataTransfer gets cleared.
        handlePromises.push(getAsFileSystemHandle.call(item));
    }

    const handles: FileSystemFileHandle[] = [];
    for (const handlePromise of handlePromises) {
        try {
            const handle = await handlePromise;
            if (handle?.kind === 'file') {
                handles.push(handle as FileSystemFileHandle);
            }
        } catch (e) {
            // Best-effort only; if handle access fails, keep loading dropped files normally.
            console.warn('Failed to read dropped file handle:', e);
            return undefined;
        }
    }

    return handles.length > 0 ? handles : undefined;
}

function extractSources(files: FileList | File[]): MediaSources {
    let subtitleFiles: File[] = [];
    let audioFile: File | undefined = undefined;
    let videoFile: File | undefined = undefined;

    for (let i = 0; i < files.length; ++i) {
        const f = files[i];
        const extension = getExtension(f.name);

        if (extension === '') {
            throw new LocalizedError('error.unknownExtension', { fileName: f.name });
        }

        if (SUBTITLE_EXT_SET.has(extension)) {
            subtitleFiles.push(f);
        } else if (VIDEO_EXT_SET.has(extension)) {
            if (videoFile) {
                throw new LocalizedError('error.onlyOneVideoFile');
            }
            videoFile = f;
        } else if (AUDIO_EXT_SET.has(extension)) {
            if (videoFile) {
                throw new LocalizedError('error.onlyOneAudioFile');
            }
            videoFile = f;
        } else {
            throw new LocalizedError('error.unsupportedExtension', {
                extension: extension.startsWith('.') ? extension.substring(1) : extension,
            });
        }
    }

    if (videoFile && audioFile) {
        throw new LocalizedError('error.bothAudioAndVideNotAllowed');
    }

    return { subtitleFiles: subtitleFiles, videoFile: videoFile };
}

interface RenderVideoProps {
    searchParams: URLSearchParams;
    settings: AsbplayerSettings;
    extension: ChromeExtension;
    miningContext: MiningContext;
    ankiDialogOpen: boolean;
    seekRequest?: SeekRequest;
    onAnkiDialogRequest: (
        videoFileUrl: string,
        videoFileName: string,
        selectedAudioTrack: string | undefined,
        playbackRate: number,
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        cardTextFieldValues: CardTextFieldValues,
        timestamp: number
    ) => void;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onAnkiDialogRewind: () => void;
    onError: (error: string) => void;
    onPlayModeChangedViaBind: (playModes: Set<PlayMode>, targetMode: PlayMode) => void;
}

function RenderVideo({ searchParams, ...props }: RenderVideoProps) {
    const videoFile = searchParams.get('video')!;
    const channel = searchParams.get('channel')!;
    const popOut = searchParams.get('popout')! === 'true';

    useEffect(() => {
        addBlobUrl(videoFile);
    }, [videoFile]);

    return <VideoPlayer videoFile={videoFile} channel={channel} popOut={popOut} {...props} />;
}

interface ContentProps {
    drawerOpen: boolean;
    drawerWidth: number;
    children: React.ReactNode[];
}

function Content(props: ContentProps) {
    const classes = useContentStyles(props);

    return (
        <main
            className={clsx(classes.content, {
                [classes.contentShift]: props.drawerOpen,
            })}
        >
            {props.children}
        </main>
    );
}

function AppStatisticsOverlay(props: StatisticsOverlayProps) {
    const [position, setPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (props.open) {
            setPosition({ x: 0, y: 0 });
        }
    }, [props.open]);

    const handleMoveBy = useCallback((deltaX: number, deltaY: number) => {
        setPosition((current) => ({
            x: current.x + deltaX,
            y: Math.max(0, current.y + deltaY),
        }));
    }, []);

    return (
        <StatisticsOverlay
            {...props}
            onMoveBy={handleMoveBy}
            sx={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: `translateX(calc(-50% + ${position.x}px)) translateY(${position.y}px)`,
            }}
        />
    );
}

interface Props {
    origin: string;
    logoUrl: string;
    settingsProvider: SettingsProvider;
    dictionaryProvider: DictionaryProvider;
    settings: AsbplayerSettings;
    globalState?: GlobalState;
    extension: ChromeExtension;
    fetcher: Fetcher;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    profiles: Profile[];
    activeProfile?: string;
    onNewProfile: (name: string) => void;
    onRemoveProfile: (name: string) => void;
    onSetActiveProfile: (name: string | undefined) => void;
    onGlobalStateChanged: (globalState: Partial<GlobalState>) => void;
}

function App({
    origin,
    logoUrl,
    dictionaryProvider,
    settingsProvider,
    settings,
    globalState,
    extension,
    fetcher,
    onSettingsChanged,
    onGlobalStateChanged,
    ...profilesContext
}: Props) {
    const { t } = useTranslation();
    const subtitleReader = useMemo<SubtitleReader>(() => {
        return new SubtitleReader({
            regexFilter: settings.subtitleRegexFilter,
            regexFilterTextReplacement: settings.subtitleRegexFilterTextReplacement,
            subtitleHtml: settings.subtitleHtml,
            convertNetflixRuby: settings.convertNetflixRuby,
            pgsParserWorkerFactory: async () => new pgsParserWorkerFactory(),
        });
    }, [
        settings.subtitleRegexFilter,
        settings.subtitleRegexFilterTextReplacement,
        settings.subtitleHtml,
        settings.convertNetflixRuby,
    ]);
    const webSocketClient = useAppWebSocketClient({ settings });
    const supportsDictionaryStatistics = !extension.installed || extension.supportsDictionaryStatistics;
    const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[]>([]);
    const playbackPreferences = usePlaybackPreferences(settings, extension);
    const theme = useMemo<Theme>(() => createTheme(settings.themeType), [settings.themeType]);
    const anki = useAnki({ settings, fetcher });
    const searchParams = useMemo(() => new URLSearchParams(location.search), []);
    const inVideoPlayer = useMemo(() => searchParams.get('video') !== null, [searchParams]);
    const [videoFullscreen, setVideoFullscreen] = useState<boolean>(false);
    const keyBinder = useAppKeyBinder(settings.keyBindSet, extension);
    const videoFrameRef = useRef<HTMLIFrameElement>(null);
    const videoChannelRef = useRef<VideoChannel>(null);
    const [videoPlayerSeekRequest, setVideoPlayerSeekRequest] = useState<SeekRequest>();
    const [width] = useWindowSize(!inVideoPlayer);
    const drawerRatio = videoFrameRef.current ? 0.2 : 0.3;
    const minDrawerSize = videoFrameRef.current ? 150 : 300;
    const drawerWidth = Math.max(minDrawerSize, width * drawerRatio);
    const copyHistoryRepository = useMemo(() => {
        if (extension.supportsCopyHistoryRequest) {
            return new ExtensionBridgedCopyHistoryRepository(extension);
        }

        return new IndexedDBCopyHistoryRepository(settings.miningHistoryStorageLimit);
    }, [extension, settings.miningHistoryStorageLimit]);
    const {
        copyHistoryItems,
        refreshCopyHistory,
        deleteCopyHistoryItem,
        saveCopyHistoryItem,
        deleteAllCopyHistoryItems,
    } = useCopyHistory(settings.miningHistoryStorageLimit, copyHistoryRepository);
    const copyHistoryItemsRef = useRef<CopyHistoryItem[]>([]);
    copyHistoryItemsRef.current = copyHistoryItems;
    const [copyHistoryOpen, setCopyHistoryOpen] = useState<boolean>(false);
    const [statisticsOpen, setStatisticsOpen] = useState<boolean>(false);
    const [theaterMode, setTheaterMode] = useState<boolean>(playbackPreferences.theaterMode);
    const [hideSubtitlePlayer, setHideSubtitlePlayer] = useState<boolean>(playbackPreferences.hideSubtitleList);
    const [videoPopOut, setVideoPopOut] = useState<boolean>(false);
    const [alert, setAlert] = useState<string>();
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alertSeverity, setAlertSeverity] = useState<AlertColor>();
    const [jumpToSubtitle, setJumpToSubtitle] = useState<SubtitleModel>();
    const [rewindSubtitle, setRewindSubtitle] = useState<SubtitleModel>();
    const [sources, setSources] = useState<MediaSources>({ subtitleFiles: [] });
    const [loadingSources, setLoadingSources] = useState<File[]>([]);
    const [dragging, setDragging] = useState<boolean>(false);
    const dragEnterRef = useRef<Element | null>(null);
    const [fileName, setFileName] = useState<string>();
    const [ankiDialogOpen, setAnkiDialogOpen] = useState<boolean>(false);
    const [ankiDialogDisabled, setAnkiDialogDisabled] = useState<boolean>(false);
    const [ankiDialogCard, setAnkiDialogCard] = useState<CardModel>();
    const miningContext = useMemo(() => new MiningContext(), []);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState<boolean>(false);
    const [settingsDialogScrollToId, setSettingsDialogScrollToId] = useState<string>();
    const [disableKeyEvents, setDisableKeyEvents] = useState<boolean>(false);
    const [tab, setTab] = useState<VideoTabModel>();
    const [availableTabs, setAvailableTabs] = useState<VideoTabModel[]>();
    const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(false);
    const [statisticsOverlayOpen, setStatisticsOverlayOpen] = useState<boolean>(false);
    const [statisticsOverlayDismissed, setStatisticsOverlayDismissed] = useState<boolean>(false);
    const { canRestoreLastSession, saveSession: saveFileSession, fetchSession, clearSession } = useFileSession();
    const [lastError, setLastError] = useState<any>();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { subtitleFiles } = sources;

    const handleError = useCallback(
        (message: any) => {
            console.error(message);
            setLastError(message);
            setAlertSeverity('error');

            if (message instanceof LocalizedError) {
                setAlert(t(message.locKey, message.locParams) ?? '<failed to localize error>');
            } else if (message instanceof Error) {
                setAlert(message.message);
            } else if (typeof message === 'string') {
                setAlert(message);
            } else {
                setAlert(String(message));
            }

            setAlertOpen(true);
        },
        [t]
    );

    const handleCopyLastError = useCallback(
        (error: string) => {
            setAlertSeverity('info');

            let truncatedError: string;
            const maxErrorLength = 32;

            if (error.length >= maxErrorLength) {
                truncatedError = `${error.substring(0, maxErrorLength)}...`;
            } else {
                truncatedError = error;
            }

            setAlert(t('info.copiedSubtitle', { text: truncatedError })!);
            setAlertOpen(true);
        },
        [t]
    );

    const handleAnkiDialogRequest = useCallback(
        (ankiDialogItem?: CopyHistoryItem) => {
            if (!ankiDialogItem && copyHistoryItemsRef.current!.length === 0) {
                return;
            }

            const item = ankiDialogItem ?? copyHistoryItemsRef.current[copyHistoryItemsRef.current.length - 1];
            setAnkiDialogCard(item);
            setAnkiDialogOpen(true);
            setAnkiDialogDisabled(false);
            setDisableKeyEvents(true);
            miningContext.started();
        },
        [miningContext]
    );

    const handleAnkiDialogRequestFromVideoPlayer = useCallback(
        async (
            videoFileUrl: string,
            videoFileName: string,
            audioTrack: string | undefined,
            playbackRate: number,
            subtitle: SubtitleModel,
            surroundingSubtitles: SubtitleModel[],
            cardTextFieldValues: CardTextFieldValues,
            timestamp: number
        ) => {
            const item = {
                subtitle,
                surroundingSubtitles,
                ...cardTextFieldValues,
                timestamp: Date.now(),
                id: uuidv4(),
                subtitleFileName: videoFileName,
                mediaTimestamp: timestamp,
                file: {
                    name: videoFileName,
                    blobUrl: videoFileUrl,
                    audioTrack,
                    playbackRate,
                },
            };
            handleAnkiDialogRequest(item);
        },
        [handleAnkiDialogRequest]
    );

    const handleAnkiDialogProceed = useCallback(
        async (params: ExportParams) => {
            setAnkiDialogDisabled(true);

            try {
                const result = await anki.export(params);

                if (params.mode !== 'gui') {
                    if (params.mode === 'default') {
                        setAlertSeverity('success');
                        setAlert(t('info.exportedCard', { result })!);
                        setAlertOpen(true);
                    } else if (params.mode === 'updateLast') {
                        setAlertSeverity('success');
                        setAlert(t('info.updatedCard', { result })!);
                        setAlertOpen(true);
                    }

                    setAnkiDialogOpen(false);

                    if (miningContext.mining) {
                        miningContext.stopped();
                    }
                }

                if (settings.lastSelectedAnkiExportMode !== params.mode) {
                    onSettingsChanged({ lastSelectedAnkiExportMode: params.mode });
                }

                dictionaryProvider.ankiCardWasModified();
            } catch (e) {
                handleError(e);
            } finally {
                setAnkiDialogDisabled(false);
                setDisableKeyEvents(false);
            }
        },
        [
            anki,
            miningContext,
            settings.lastSelectedAnkiExportMode,
            onSettingsChanged,
            handleError,
            t,
            dictionaryProvider,
        ]
    );

    // Avoid unnecessary re-renders by having handleCopy operate on a ref to settings
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const handleCopy = useCallback(
        async (card: CardModel, postMineAction?: PostMineAction, id?: string) => {
            if (card.subtitle && settingsRef.current.copyToClipboardOnMine) {
                navigator.clipboard.writeText(card.subtitle.text);
            }

            const newCard = {
                ...card,
                subtitleFileName: card.subtitleFileName || card.file?.name || '',
                timestamp: Date.now(),
                id: id || uuidv4(),
            };

            if (extension.supportsSidePanel) {
                extension.publishCard(newCard);
            } else {
                saveCopyHistoryItem(newCard);
            }

            switch (postMineAction ?? PostMineAction.none) {
                case PostMineAction.none:
                    setAlertSeverity('success');
                    setAlert(
                        card.subtitle.text === ''
                            ? t('info.savedTimestamp', { timestamp: humanReadableTime(card.subtitle.start) })!
                            : t('info.copiedSubtitle2', { result: card.subtitle.text })!
                    );
                    setAlertOpen(true);
                    break;
                case PostMineAction.showAnkiDialog:
                    handleAnkiDialogRequest(newCard);
                    break;
                case PostMineAction.exportCard:
                case PostMineAction.updateLastCard:
                    miningContext.started();
                    let audioClip = AudioClip.fromCard(
                        newCard,
                        settingsRef.current.audioPaddingStart,
                        settingsRef.current.audioPaddingEnd,
                        settingsRef.current.recordWithAudioPlayback
                    );

                    if (audioClip && settingsRef.current.preferMp3) {
                        audioClip = audioClip.toMp3(() => new mp3WorkerFactory());
                    }

                    handleAnkiDialogProceed({
                        text: extractText(card.subtitle, card.surroundingSubtitles),
                        track1: extractText(card.subtitle, card.surroundingSubtitles, 0),
                        track2: extractText(card.subtitle, card.surroundingSubtitles, 1),
                        track3: extractText(card.subtitle, card.surroundingSubtitles, 2),
                        definition: newCard.definition ?? '',
                        audioClip: audioClip,
                        image: Image.fromCard(
                            newCard,
                            settingsRef.current.maxImageWidth,
                            settingsRef.current.maxImageHeight
                        ),
                        word: newCard.word ?? '',
                        source: `${newCard.subtitleFileName} (${humanReadableTime(card.mediaTimestamp)})`,
                        url: '',
                        customFieldValues: newCard.customFieldValues ?? {},
                        tags: settingsRef.current.tags,
                        mode: postMineAction === PostMineAction.updateLastCard ? 'updateLast' : 'default',
                    });
                    break;
                default:
                    throw new Error('Unknown post mine action: ' + postMineAction);
            }
        },
        [extension, miningContext, saveCopyHistoryItem, handleAnkiDialogProceed, handleAnkiDialogRequest, t]
    );

    const handleOpenCopyHistory = useCallback(async () => {
        const toggleInAppCopyHistory = async () => {
            await refreshCopyHistory();
            setCopyHistoryOpen((copyHistoryOpen) => !copyHistoryOpen);
            setVideoFullscreen(false);
        };
        if (isFirefox) {
            // Firefox doesn't support opening the side panel with a button from the app.
            // So update the side panel state if it happens to be open,
            // otherwise open the in-app drawer.
            if (extension.supportsSidePanel && isSidePanelOpen) {
                extension.toggleSidePanel('mining-history');
            } else {
                await toggleInAppCopyHistory();
            }
        } else if (extension.supportsSidePanel) {
            extension.toggleSidePanel('mining-history');
        } else {
            await toggleInAppCopyHistory();
        }
    }, [extension, refreshCopyHistory, isSidePanelOpen]);
    const handleOpenStatistics = useCallback(() => {
        const toggleInAppStatistics = () => {
            setStatisticsOpen((statisticsOpen) => !statisticsOpen);
            setVideoFullscreen(false);
        };
        if (isFirefox) {
            // Firefox doesn't support opening the side panel with a button from the app.
            // So update the side panel state if it happens to be open,
            // otherwise open the in-app drawer.
            if (extension.supportsSidePanel && isSidePanelOpen) {
                extension.toggleSidePanel('statistics');
            } else {
                toggleInAppStatistics();
            }
        } else if (extension.supportsSidePanel) {
            extension.toggleSidePanel('statistics');
        } else {
            toggleInAppStatistics();
        }
    }, [extension, isSidePanelOpen]);
    const handleReceivedStatisticsSnapshot = useCallback(
        (mediaId: string, trackIndex: number) => {
            if (mediaId !== extension.id) {
                return;
            }

            if (settings.dictionaryTracks[trackIndex].dictionaryAutoGenerateStatistics && !statisticsOverlayDismissed) {
                setStatisticsOverlayOpen(true);
            }
        },
        [extension, settings.dictionaryTracks, statisticsOverlayDismissed]
    );
    const handleCloseStatisticsOverlay = useCallback(() => {
        setStatisticsOverlayOpen(false);
        setStatisticsOverlayDismissed(true);
    }, []);
    const handleStatisticsOverlaySnapshotCleared = useCallback(() => {
        setStatisticsOverlayOpen(false);
    }, []);
    const openStatisticsOverlay = useCallback(() => {
        setStatisticsOverlayDismissed(false);
        setStatisticsOverlayOpen(true);
    }, []);
    const handleOpenStatisticsOverlay = useCallback(() => {
        if (statisticsOverlayOpen) {
            handleCloseStatisticsOverlay();
            return;
        }

        openStatisticsOverlay();
    }, [handleCloseStatisticsOverlay, openStatisticsOverlay, statisticsOverlayOpen]);
    const handleCloseCopyHistory = useCallback(() => setCopyHistoryOpen(false), []);
    const handleAppBarToggle = useCallback(() => {
        const newValue = !playbackPreferences.theaterMode;
        playbackPreferences.theaterMode = newValue;
        setTheaterMode(newValue);
        setVideoFullscreen(false);
    }, [playbackPreferences]);
    useEffect(() => {
        if (videoFullscreen) {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            }
        } else if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    }, [videoFullscreen]);
    useEffect(() => {
        const listener = () => {
            if (!document.fullscreenElement) {
                setVideoFullscreen(false);
            }
        };
        document.addEventListener('fullscreenchange', listener);
        return () => document.removeEventListener('fullscreenchange', listener);
    }, []);
    const handleHideSubtitlePlayer = useCallback(() => {
        playbackPreferences.hideSubtitleList = !hideSubtitlePlayer;
        setHideSubtitlePlayer(!hideSubtitlePlayer);
    }, [hideSubtitlePlayer, playbackPreferences]);
    const handleVideoPopOut = useCallback(() => {
        setVideoPopOut((videoPopOut) => !videoPopOut);
        setHideSubtitlePlayer(false);
    }, []);
    const handleOpenSettings = useCallback(() => {
        setDisableKeyEvents(true);
        setSettingsDialogOpen(true);
    }, []);
    const handleAlertClosed = useCallback(() => setAlertOpen(false), []);
    const handleCloseSettings = useCallback(() => {
        setSettingsDialogOpen(false);
        setSettingsDialogScrollToId(undefined);

        // ATM only the Anki dialog may appear under the settings dialog,
        // so it's the only one we need to check to re-enable key events
        setDisableKeyEvents(ankiDialogOpen);
    }, [ankiDialogOpen]);

    const handleUnloadVideo = useCallback(
        (videoFileUrl: string) => {
            if (videoFileUrl !== sources.videoFileUrl) {
                return;
            }

            void dictionaryProvider.publishStatisticsSnapshot(extension.id, undefined);
            setStatisticsOverlayOpen(false);

            setSources((previous) => {
                revokeBlobUrl(videoFileUrl);

                return {
                    subtitleFiles: previous.subtitleFiles,
                    videoFile: undefined,
                    videoFileUrl: undefined,
                };
            });
            setVideoFullscreen(false);
        },
        [dictionaryProvider, extension.id, sources]
    );

    const handleDownloadAudio = useCallback(
        async (card: CardModel) => {
            try {
                const clip = AudioClip.fromCard(card, settings.audioPaddingStart, settings.audioPaddingEnd, false);

                if (clip?.error === undefined) {
                    if (settings.preferMp3) {
                        clip!.toMp3(() => new mp3WorkerFactory()).download();
                    } else {
                        clip!.download();
                    }
                } else {
                    handleError(t(clip.errorLocKey!));
                }
            } catch (e) {
                handleError(e);
            }
        },
        [handleError, settings.audioPaddingStart, settings.audioPaddingEnd, settings.preferMp3, t]
    );

    const handleDownloadImage = useCallback(
        (item: CardModel) => {
            try {
                const image = Image.fromCard(item, settings.maxImageWidth, settings.maxImageHeight)!;

                if (image.error === undefined) {
                    image.download();
                } else if (image.error === ImageErrorCode.fileLinkLost) {
                    handleError(t('ankiDialog.imageFileLinkLost'));
                } else if (image.error === ImageErrorCode.captureFailed) {
                    handleError(t('ankiDialog.imageCaptureFailed'));
                }
            } catch (e) {
                handleError(e);
            }
        },
        [handleError, settings.maxImageWidth, settings.maxImageHeight, t]
    );

    const handleDownloadCopyHistorySectionAsSrt = useCallback(
        (name: string, items: CopyHistoryItem[]) => {
            const deduplicated: SubtitleModel[] = [];

            for (const item of items) {
                if (
                    deduplicated.find(
                        (i) =>
                            i.start === item.subtitle.start &&
                            i.end === item.subtitle.end &&
                            i.text === item.subtitle.text
                    ) === undefined
                ) {
                    deduplicated.push(item.subtitle);
                }
            }

            download(
                new Blob([subtitleReader.subtitlesToSrt(deduplicated)], { type: 'text/plain' }),
                `${name}_MiningHistory_${new Date().toISOString()}.srt`
            );
        },
        [subtitleReader]
    );

    const handleJumpToSubtitle = useCallback(
        (subtitle: SubtitleModel, subtitleFileName: string) => {
            if (!subtitleFiles.find((f) => f.name === subtitleFileName)) {
                handleError(t('error.subtitleFileNotOpen', { fileName: subtitleFileName }));
                return;
            }

            setJumpToSubtitle({ ...subtitle });
        },
        [subtitleFiles, handleError, t]
    );

    const handleSelectCopyHistoryItem = useCallback(
        (item: CopyHistoryItem) => {
            handleJumpToSubtitle(item.subtitle, item.subtitleFileName);
        },
        [handleJumpToSubtitle]
    );
    const handleJumpToSubtitleHandled = useCallback(() => {
        setJumpToSubtitle(undefined);
    }, []);

    const handleAnki = useCallback((card: CardModel) => {
        setAnkiDialogCard(card);
        setAnkiDialogOpen(true);
        setAnkiDialogDisabled(false);
        setDisableKeyEvents(true);
    }, []);

    const handleAnkiDialogCancel = useCallback(() => {
        setAnkiDialogOpen(false);
        setAnkiDialogDisabled(false);
        setDisableKeyEvents(false);

        if (miningContext.mining) {
            miningContext.stopped();
        }
    }, [miningContext]);

    const handleAnkiDialogRewind = useCallback(() => {
        if (!ankiDialogCard) {
            return;
        }

        if (!subtitleFiles.find((f) => f.name === ankiDialogCard.subtitleFileName)) {
            handleError(t('error.subtitleFileNotOpen', { fileName: ankiDialogCard.subtitleFileName }));
            return;
        }

        setRewindSubtitle(ankiDialogCard.subtitle);
        handleAnkiDialogCancel();
    }, [ankiDialogCard, subtitleFiles, handleAnkiDialogCancel, handleError, t]);

    const handleAnkiDialogRewindFromVideoPlayer = useCallback(() => {
        if (!ankiDialogCard) {
            return;
        }

        setVideoPlayerSeekRequest({ timestamp: ankiDialogCard.subtitle.start });
        handleAnkiDialogCancel();
    }, [ankiDialogCard, handleAnkiDialogCancel]);

    useEffect(() => {
        function onTabs(tabs: VideoTabModel[]) {
            if (availableTabs === undefined || tabs.length !== availableTabs.length) {
                setAvailableTabs(tabs);
            } else {
                let update = false;

                for (let i = 0; i < availableTabs.length; ++i) {
                    const t1 = availableTabs[i];
                    const t2 = tabs[i];
                    if (
                        t1.id !== t2.id ||
                        t1.title !== t2.title ||
                        t1.src !== t2.src ||
                        t1.faviconUrl !== t2.faviconUrl ||
                        t1.subscribed !== t2.subscribed ||
                        t1.synced !== t2.synced ||
                        t1.syncedTimestamp !== t2.syncedTimestamp ||
                        t1.faviconUrl !== t2.faviconUrl
                    ) {
                        update = true;
                        break;
                    }
                }

                if (update) {
                    setAvailableTabs(tabs);
                }
            }

            let selectedTabMissing = tab && tabs.filter((t) => t.id === tab.id && t.src === tab.src).length === 0;

            if (selectedTabMissing) {
                setTab(undefined);
                handleError(t('error.lostTabConnection', { tabName: tab!.id + ' ' + tab!.title }));
            }

            const isSidePanelOpen = extension.asbplayers?.find((a) => a.sidePanel) !== undefined;
            setIsSidePanelOpen(isSidePanelOpen);
        }

        return extension.subscribeTabs(onTabs);
    }, [availableTabs, tab, extension, handleError, t]);
    const handleTabSelected = useCallback((tab: VideoTabModel) => {
        setTab(tab);
    }, []);

    const handleFiles = useCallback(
        ({ files, flattenSubtitleFiles }: { files: FileList | File[]; flattenSubtitleFiles?: boolean }): boolean => {
            try {
                let { subtitleFiles, videoFile } = extractSources(files);

                if (videoFile || subtitleFiles.length > 0) {
                    setJumpToSubtitle(undefined);
                }

                setSources((previous) => {
                    let videoFileUrl: string | undefined = undefined;

                    if (videoFile) {
                        if (previous.videoFileUrl) {
                            revokeBlobUrl(previous.videoFileUrl);
                        }

                        if (videoFile) {
                            videoFileUrl = createBlobUrl(videoFile);
                        }

                        setTab(undefined);
                    } else {
                        videoFile = previous.videoFile;
                        videoFileUrl = previous.videoFileUrl;
                    }

                    const sources = {
                        subtitleFiles: subtitleFiles.length === 0 ? previous.subtitleFiles : subtitleFiles,
                        videoFile: videoFile,
                        videoFileUrl: videoFileUrl,
                        flattenSubtitleFiles,
                    };

                    const sourcesToList = (s: MediaSources) =>
                        [...s.subtitleFiles, s.videoFile].filter((f) => f !== undefined) as File[];

                    const previousLoadingSources = sourcesToList(previous);
                    const loadingSources = sourcesToList(sources).filter((f) => {
                        for (const previousLoadingSource of previousLoadingSources) {
                            if (f === previousLoadingSource) {
                                return false;
                            }
                        }

                        return true;
                    });
                    setLoadingSources(loadingSources);
                    return sources;
                });

                if (subtitleFiles.length > 0) {
                    const subtitleFileName = subtitleFiles[0].name;
                    setFileName(subtitleFileName.substring(0, subtitleFileName.lastIndexOf('.')));
                }
                return true;
            } catch (e) {
                console.error(e);
                handleError(e);
                return false;
            }
        },
        [handleError]
    );

    const persistFileSessionHandles = useCallback(
        (handles: FileSystemFileHandle[] | undefined) => {
            if (!handles || handles.length === 0) {
                return;
            }

            let videoHandle: FileSystemFileHandle | undefined;
            const subtitleHandles: FileSystemFileHandle[] = [];
            for (const handle of handles) {
                const extension = getExtension(handle.name);
                if (VIDEO_EXT_SET.has(extension) || AUDIO_EXT_SET.has(extension)) {
                    videoHandle = handle;
                } else if (SUBTITLE_EXT_SET.has(extension)) {
                    subtitleHandles.push(handle);
                }
            }

            if (!videoHandle && subtitleHandles.length === 0) {
                return;
            }

            // Persist in background so session saving never blocks current file loading.
            void saveFileSession({ videoHandle, subtitleHandles }).catch((e) => {
                console.error('Failed to save file session:', e);
                handleError(e);
            });
        },
        [handleError, saveFileSession]
    );

    const handleRestoreLastSession = useCallback(async () => {
        try {
            const record = await fetchSession();
            if (!record) return;

            const allHandles = [...(record.videoHandle ? [record.videoHandle] : []), ...record.subtitleHandles];

            const { granted, denied } = await requestPermissions(allHandles);
            if (denied.length > 0) {
                handleError(t('error.restoreSessionPermissionDenied'));
                return;
            }

            const { files, errors } = await resolveFiles(granted);
            if (errors.length > 0) {
                handleError(t('error.restoreSessionFailed'));
                await clearSession();
                return;
            }

            if (!handleFiles({ files })) {
                await clearSession();
            }
        } catch (e) {
            console.error('Failed to restore last session:', e);
            handleError(e);
        }
    }, [fetchSession, clearSession, handleFiles, handleError, t]);

    const handleDirectory = useCallback(
        async (items: DataTransferItemList) => {
            if (items.length !== 1) {
                handleError(t('error.onlyOneDirectoryAllowed'));
                return;
            }

            const fileSystemEntry = items[0].webkitGetAsEntry();

            if (!fileSystemEntry || !fileSystemEntry.isDirectory) {
                handleError(t('error.failedToLoadDirectory'));
                return;
            }

            const fileSystemDirectoryEntry = fileSystemEntry as FileSystemDirectoryEntry;

            try {
                const entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
                    fileSystemDirectoryEntry.createReader().readEntries(resolve, reject)
                );

                if (entries.find((e) => e.isDirectory)) {
                    handleError(t('error.subdirectoriesNotAllowed'));
                    return;
                }

                const filePromises = entries.map(
                    (e) => new Promise<File>((resolve, reject) => (e as FileSystemFileEntry).file(resolve, reject))
                );
                const files: File[] = [];

                for (const f of filePromises) {
                    files.push(await f);
                }

                handleFiles({ files });
            } catch (e) {
                handleError(e);
            }
        },
        [handleError, handleFiles, t]
    );

    useEffect(() => {
        if (!webSocketClient) {
            return;
        }

        webSocketClient.onLoadSubtitles = async (command: LoadSubtitlesCommand) => {
            const { files } = command.body;
            const filePromises = (files ?? []).map(
                async (f) => new File([await (await fetch('data:text/plain;base64,' + f.base64)).blob()], f.name)
            );
            handleFiles({ files: await Promise.all(filePromises) });
        };
    }, [webSocketClient, handleFiles]);

    useEffect(() => {
        if (inVideoPlayer) {
            extension.videoPlayer = true;
            extension.loadedSubtitles = false;
            extension.syncedVideoElement = undefined;
            extension.startHeartbeat();
            return undefined;
        }

        async function onMessage(message: ExtensionMessage) {
            if (message.data.command === 'sync' || message.data.command === 'syncv2') {
                const tabs = (extension.tabs ?? []).filter((t) => {
                    if (t.id !== message.tabId) {
                        return false;
                    }

                    return !message.src || t.src === message.src;
                });

                if (tabs.length === 0) {
                    if (message.src) {
                        console.error(
                            'Received sync request but the requesting tab ID ' +
                                message.tabId +
                                ' with src ' +
                                message.src +
                                ' was not found'
                        );
                    } else {
                        console.error(
                            'Received sync request but the requesting tab ID ' + message.tabId + ' was not found'
                        );
                    }

                    return;
                }

                const tab = tabs[0];
                let subtitleFiles: File[];
                let flatten = false;

                if (message.data.command === 'sync') {
                    const syncMessage = message.data as LegacyPlayerSyncMessage;
                    subtitleFiles = [
                        new File(
                            [await (await fetch('data:text/plain;base64,' + syncMessage.subtitles.base64)).blob()],
                            syncMessage.subtitles.name
                        ),
                    ];
                } else if (message.data.command === 'syncv2') {
                    const syncMessage = message.data as PlayerSyncMessage;
                    subtitleFiles = await Promise.all(
                        syncMessage.subtitles.map(
                            async (s) =>
                                new File([await (await fetch('data:text/plain;base64,' + s.base64)).blob()], s.name)
                        )
                    );
                    flatten = syncMessage.flatten ?? false;
                } else {
                    console.error('Unknown message ' + message.data.command);
                    return;
                }

                if (sources.videoFileUrl) {
                    handleUnloadVideo(sources.videoFileUrl);
                }

                handleFiles({ files: subtitleFiles, flattenSubtitleFiles: flatten });
                setTab(tab);
            } else if (message.data.command === 'edit-keyboard-shortcuts') {
                setSettingsDialogOpen(true);
                setSettingsDialogScrollToId('keyboard-shortcuts');
            } else if (message.data.command === 'open-asbplayer-settings') {
                setSettingsDialogOpen(true);
            } else if (message.data.command === 'show-anki-ui') {
                handleAnki(message.data as ShowAnkiUiMessage);
            } else if (message.data.command === 'open-statistics-overlay') {
                const openMessage = message.data as OpenStatisticsOverlayMessage;

                if (openMessage.force && statisticsOverlayOpen) {
                    handleCloseStatisticsOverlay();
                } else {
                    openStatisticsOverlay();
                }
            }
        }

        const unsubscribe = extension.subscribe(onMessage);
        extension.videoPlayer = false;
        extension.loadedSubtitles = subtitles.length > 0;
        extension.syncedVideoElement = tab;
        extension.startHeartbeat();
        return unsubscribe;
    }, [
        extension,
        subtitles,
        supportsDictionaryStatistics,
        inVideoPlayer,
        sources.videoFileUrl,
        statisticsOverlayOpen,
        tab,
        handleFiles,
        handleAnki,
        handleCloseStatisticsOverlay,
        handleUnloadVideo,
        openStatisticsOverlay,
    ]);

    useEffect(() => {
        if (inVideoPlayer) {
            return;
        }

        return extension.subscribe((message: ExtensionMessage) => {
            if (message.data.command === 'jump-to-subtitle') {
                const jumpToSubtitleMessage = message.data as JumpToSubtitleMessage;
                handleJumpToSubtitle(jumpToSubtitleMessage.subtitle, jumpToSubtitleMessage.subtitleFileName);
            }
        });
    }, [extension, inVideoPlayer, handleJumpToSubtitle]);

    useEffect(() => {
        if (inVideoPlayer) {
            return;
        }

        return extension.subscribe((message: ExtensionMessage) => {
            if (message.data.command === 'download-image') {
                handleDownloadImage(message.data as DownloadImageMessage);
            }
        });
    }, [extension, inVideoPlayer, handleDownloadImage]);

    useEffect(() => {
        if (inVideoPlayer) {
            return;
        }

        return extension.subscribe((message: ExtensionMessage) => {
            if (message.data.command === 'download-audio') {
                handleDownloadAudio(message.data as DownloadAudioMessage);
            }
        });
    }, [extension, inVideoPlayer, handleDownloadAudio]);

    const handlePlayModeChangedViaBind = useCallback(
        (playModes: Set<PlayMode>, targetMode: PlayMode) => {
            if (targetMode === PlayMode.normal) {
                if (playModes.size === 1 && playModes.has(PlayMode.normal)) {
                    return;
                }

                setAlert(t('info.disabledAllPlayModes')!);
            } else {
                const enabling = !playModes.has(targetMode);
                switch (targetMode) {
                    case PlayMode.autoPause:
                        setAlert(t(enabling ? 'info.enabledAutoPause' : 'info.disabledAutoPause')!);
                        break;
                    case PlayMode.condensed:
                        setAlert(t(enabling ? 'info.enabledCondensedPlayback' : 'info.disabledCondensedPlayback')!);
                        break;
                    case PlayMode.fastForward:
                        setAlert(t(enabling ? 'info.enabledFastForwardPlayback' : 'info.disabledFastForwardPlayback')!);
                        break;
                    case PlayMode.repeat:
                        setAlert(t(enabling ? 'info.enabledRepeatPlayback' : 'info.disabledRepeatPlayback')!);
                        break;
                }

                setAlertSeverity('info');
                setAlertOpen(true);
            }
        },
        [t]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            if (ankiDialogOpen) {
                return;
            }

            e.preventDefault();

            if (inVideoPlayer) {
                handleError(t('error.videoPlayerDragAndDropNotAllowed'));
                return;
            }

            setDragging(false);
            dragEnterRef.current = null;
            const dataTransfer = e.dataTransfer;

            function allDirectories(items: DataTransferItemList) {
                for (let i = 0; i < items.length; ++i) {
                    if (!items[i].webkitGetAsEntry()?.isDirectory) {
                        return false;
                    }
                }

                return true;
            }

            if (dataTransfer.items && dataTransfer.items.length > 0 && allDirectories(dataTransfer.items)) {
                handleDirectory(dataTransfer.items);
            } else if (dataTransfer.files && dataTransfer.files.length > 0) {
                // Copy files synchronously; DataTransfer may be cleared after this handler returns.
                const droppedFiles = Array.from(dataTransfer.files);
                if (!handleFiles({ files: droppedFiles })) {
                    return;
                }

                if (dataTransfer.items && dataTransfer.items.length > 0) {
                    void extractDropFileHandles(dataTransfer.items)
                        .then((fileHandles) => persistFileSessionHandles(fileHandles))
                        .catch((e) => {
                            console.warn('Failed to collect dropped file handles:', e);
                        });
                }
            }
        },
        [inVideoPlayer, handleError, handleFiles, handleDirectory, ankiDialogOpen, t, persistFileSessionHandles]
    );

    const handleFileInputChange = useCallback(() => {
        const files = fileInputRef.current?.files;

        if (files && files.length > 0) {
            handleFiles({ files });
            fileInputRef.current!.value = '';
        }
    }, [handleFiles]);

    const handleFileSelector = useCallback(async () => {
        if (supportsFileSystemAccess()) {
            try {
                const handles = await showFilePicker({
                    videoExtensions: [...videoExtensions],
                    audioExtensions: [...audioExtensions],
                    subtitleExtensions: [...subtitleExtensions],
                });
                if (!handles || handles.length === 0) return;
                const { files } = await resolveFiles(handles);
                if (files.length === 0) return;
                if (handleFiles({ files })) {
                    persistFileSessionHandles(handles);
                }
            } catch (e) {
                console.error('Failed to pick files via File System Access API:', e);
                handleError(e);
            }
        } else {
            fileInputRef.current?.click();
        }
    }, [handleFiles, handleError, persistFileSessionHandles]);

    const handleVideoElementSelected = useCallback(
        async (videoElement: VideoTabModel) => {
            const { id: tabId, synced, src } = videoElement;

            if (synced) {
                const response = (await extension.requestSubtitles(tabId, src)) as RequestSubtitlesResponse | undefined;

                if (response !== undefined) {
                    const { subtitles, subtitleFileNames } = response;

                    if (subtitleFileNames.length > 0) {
                        const subtitleFileName = subtitleFileNames[0];
                        setFileName(subtitleFileName.substring(0, subtitleFileName.lastIndexOf('.')));
                        const length = subtitles.length > 0 ? subtitles[subtitles.length - 1].end : 0;
                        setSubtitles(
                            subtitles.map((s, i) => ({
                                ...s,
                                displayTime: timeDurationDisplay(s.start, length),
                                index: i,
                            }))
                        );
                        setTab(videoElement);
                    }
                }
            } else {
                extension.loadSubtitles(tabId, src);
            }
        },
        [extension]
    );

    const handleDownloadSubtitleFilesAsSrt = useCallback(async () => {
        if (sources.subtitleFiles === undefined) {
            return;
        }

        const nonSupSubtitleFiles = sources.subtitleFiles.filter((f) => !f.name.endsWith('.sup'));

        if (nonSupSubtitleFiles.length === 0) {
            return;
        }

        download(
            new Blob([await subtitleReader.filesToSrt(nonSupSubtitleFiles)], {
                type: 'text/plain',
            }),
            `${fileName}.srt`
        );
    }, [fileName, sources.subtitleFiles, subtitleReader]);

    const handleDragOver = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (ankiDialogOpen) {
                return;
            }

            e.preventDefault();
        },
        [ankiDialogOpen]
    );

    const handleDragEnter = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (ankiDialogOpen) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (!inVideoPlayer) {
                dragEnterRef.current = e.target as Element;
                setDragging(true);
            }
        },
        [inVideoPlayer, ankiDialogOpen]
    );

    const handleDragLeave = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.nativeEvent.preventDefault();
            e.nativeEvent.stopPropagation();

            if (!inVideoPlayer && dragEnterRef.current === e.target) {
                setDragging(false);
            }
        },
        [inVideoPlayer]
    );

    const handleFilesLoaded = useCallback((loadedFiles: File[]) => {
        setLoadingSources((loadingFiles) =>
            loadingFiles?.filter((loadingFile) => {
                for (const loadedFile of loadedFiles) {
                    if (loadedFile === loadingFile) {
                        return false;
                    }
                }

                return true;
            })
        );
    }, []);

    const { hash: settingsHash } = useLocationHash({ view: 'settings' });
    useEffect(() => {
        if (!settingsHash) {
            return;
        }

        setSettingsDialogScrollToId(settingsHash);
        setSettingsDialogOpen(true);
    }, [settingsHash]);

    useEffect(() => {
        if (sources.videoFile && alertOpen && alert && alertSeverity) {
            videoChannelRef.current?.alert(alert, alertSeverity);
            setAlertOpen(false);
        }
    }, [sources.videoFile, alert, alertSeverity, alertOpen]);

    const handleCopyToClipboard = useCallback((blob: Blob) => {
        navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]).catch(console.error);
    }, []);

    useEffect(() => {
        return keyBinder?.bindToggleSidePanel(
            () => {
                if (extension.supportsSidePanel) {
                    extension.toggleSidePanel();
                } else if (copyHistoryOpen) {
                    handleOpenCopyHistory();
                } else if (statisticsOpen) {
                    handleOpenStatistics();
                } else {
                    handleOpenCopyHistory();
                }
            },
            () => ankiDialogOpen || !extension.supportsSidePanel,
            false
        );
    }, [
        extension,
        keyBinder,
        copyHistoryOpen,
        statisticsOpen,
        handleOpenCopyHistory,
        handleOpenStatistics,
        ankiDialogOpen,
    ]);

    useEffect(() => {
        return keyBinder?.bindOpenStatistics(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                setDisableKeyEvents(true);
                handleOpenStatistics();
            },
            () => ankiDialogOpen || !supportsDictionaryStatistics,
            false
        );
    }, [keyBinder, ankiDialogOpen, supportsDictionaryStatistics, handleOpenStatistics]);

    const fetchStatisticsMediaInfo = useCallback(async (_: string) => {
        // In-app statistics can only show the current media - no need to display redundant information like the source string
        return { sourceString: '' };
    }, []);

    const mp3Encoder = useCallback(async (blob: Blob, extension: string) => {
        return await Mp3Encoder.encode(blob, () => new mp3WorkerFactory());
    }, []);

    useEffect(() => {
        document.title = settings.tabName;
    }, [settings.tabName]);

    const { initialized: i18nInitialized } = useI18n({ language: settings.language });

    const handleDismissShowAnkiDialogQuickSelectFtue = useCallback(() => {
        onGlobalStateChanged({ ftueHasSeenAnkiDialogQuickSelectV2: true });
    }, [onGlobalStateChanged]);

    const showAnkiDialogQuickSelectFtue = !isMobile && globalState?.ftueHasSeenAnkiDialogQuickSelectV2 === false;

    const [needRefreshDialogOpen, setNeedRefreshDialogOpen] = useState<boolean>(false);
    const handleOpenNeedRefreshDialog = useCallback(() => setNeedRefreshDialogOpen(true), []);
    const handleCloseNeedRefreshDialog = useCallback(() => setNeedRefreshDialogOpen(false), []);
    const handleOfflineReady = useCallback(() => {}, []);
    const { doUpdate: updateFromServiceWorker } = useServiceWorker({
        onNeedRefresh: handleOpenNeedRefreshDialog,
        onOfflineReady: handleOfflineReady,
    });
    const handleCloseStatistics = useCallback(() => setStatisticsOpen(false), []);
    const handleViewAnnotationSettings = useCallback(() => {
        setSettingsDialogScrollToId('annotation');
        setSettingsDialogOpen(true);
    }, []);

    if (!i18nInitialized) {
        return null;
    }

    const loading = loadingSources.length !== 0;
    const nothingLoaded =
        tab === undefined &&
        ((loading && !videoFrameRef.current) || (sources.subtitleFiles.length === 0 && !sources.videoFile));
    const appBarHidden = sources.videoFile !== undefined && ((theaterMode && !videoPopOut) || videoFullscreen);
    const effectiveDrawerOpen = (copyHistoryOpen || statisticsOpen) && !videoFullscreen;
    const lastSelectedAnkiExportMode =
        !extension.installed || extension.supportsLastSelectedAnkiExportModeSetting
            ? settings.lastSelectedAnkiExportMode
            : 'default';

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                >
                    {!sources.videoFile && (
                        <Alert
                            open={alertOpen}
                            onClose={handleAlertClosed}
                            autoHideDuration={3000}
                            severity={alertSeverity}
                        >
                            {alert}
                        </Alert>
                    )}
                    {inVideoPlayer ? (
                        <>
                            <RenderVideo
                                searchParams={searchParams}
                                settings={settings}
                                extension={extension}
                                miningContext={miningContext}
                                ankiDialogOpen={ankiDialogOpen}
                                seekRequest={videoPlayerSeekRequest}
                                onSettingsChanged={onSettingsChanged}
                                onAnkiDialogRequest={handleAnkiDialogRequestFromVideoPlayer}
                                onAnkiDialogRewind={handleAnkiDialogRewindFromVideoPlayer}
                                onError={handleError}
                                onPlayModeChangedViaBind={handlePlayModeChangedViaBind}
                            />
                            {ankiDialogCard && (
                                <AnkiDialog
                                    open={ankiDialogOpen}
                                    disabled={ankiDialogDisabled}
                                    card={ankiDialogCard}
                                    anki={anki}
                                    settings={settings}
                                    lastSelectedExportMode={lastSelectedAnkiExportMode}
                                    onCancel={handleAnkiDialogCancel}
                                    onProceed={handleAnkiDialogProceed}
                                    onCopyToClipboard={handleCopyToClipboard}
                                    mp3Encoder={mp3Encoder}
                                    showQuickSelectFtue={showAnkiDialogQuickSelectFtue}
                                    onDismissShowQuickSelectFtue={handleDismissShowAnkiDialogQuickSelectFtue}
                                    {...profilesContext}
                                />
                            )}
                        </>
                    ) : (
                        <Paper square>
                            <CopyHistory
                                items={copyHistoryItems}
                                open={effectiveDrawerOpen}
                                drawerWidth={drawerWidth}
                                onClose={handleCloseCopyHistory}
                                onDelete={deleteCopyHistoryItem}
                                onDeleteAll={deleteAllCopyHistoryItems}
                                onClipAudio={handleDownloadAudio}
                                onDownloadImage={handleDownloadImage}
                                onDownloadSectionAsSrt={handleDownloadCopyHistorySectionAsSrt}
                                onSelect={handleSelectCopyHistoryItem}
                                onAnki={handleAnki}
                            />
                            <StatisticsDrawer
                                open={statisticsOpen}
                                settings={settings}
                                dictionaryProvider={dictionaryProvider}
                                hasSubtitles={subtitles !== undefined && subtitles.length > 0}
                                showBackButton
                                drawerWidth={drawerWidth}
                                onViewAnnotationSettings={handleViewAnnotationSettings}
                                onOpenOverlay={handleOpenStatisticsOverlay}
                                onClose={handleCloseStatistics}
                                mediaInfoFetcher={fetchStatisticsMediaInfo}
                                sx={{ p: 2 }}
                            />
                            {ankiDialogCard && (
                                <AnkiDialog
                                    open={ankiDialogOpen}
                                    disabled={ankiDialogDisabled}
                                    card={ankiDialogCard}
                                    anki={anki}
                                    settings={settings}
                                    lastSelectedExportMode={lastSelectedAnkiExportMode}
                                    onCancel={handleAnkiDialogCancel}
                                    onProceed={handleAnkiDialogProceed}
                                    onOpenSettings={handleOpenSettings}
                                    onCopyToClipboard={handleCopyToClipboard}
                                    mp3Encoder={mp3Encoder}
                                    showQuickSelectFtue={showAnkiDialogQuickSelectFtue}
                                    onDismissShowQuickSelectFtue={handleDismissShowAnkiDialogQuickSelectFtue}
                                    {...profilesContext}
                                />
                            )}
                            <SettingsDialog
                                anki={anki}
                                extension={extension}
                                open={settingsDialogOpen}
                                onSettingsChanged={onSettingsChanged}
                                onClose={handleCloseSettings}
                                dictionaryProvider={dictionaryProvider}
                                settings={settings}
                                activeProfile={profilesContext.activeProfile}
                                scrollToId={settingsDialogScrollToId}
                                {...profilesContext}
                            />
                            <NeedRefreshDialog
                                open={needRefreshDialogOpen}
                                onRefresh={updateFromServiceWorker}
                                onClose={handleCloseNeedRefreshDialog}
                            />
                            <Bar
                                title={fileName || 'asbplayer'}
                                drawerWidth={drawerWidth}
                                drawerOpen={effectiveDrawerOpen}
                                hidden={appBarHidden}
                                subtitleFiles={sources.subtitleFiles}
                                onOpenCopyHistory={handleOpenCopyHistory}
                                onOpenStatistics={supportsDictionaryStatistics ? handleOpenStatistics : undefined}
                                onDownloadSubtitleFilesAsSrt={handleDownloadSubtitleFilesAsSrt}
                                onOpenSettings={handleOpenSettings}
                                lastError={lastError}
                                onCopyLastError={handleCopyLastError}
                            />
                            <input
                                ref={fileInputRef}
                                onChange={handleFileInputChange}
                                type="file"
                                accept={inputAcceptFileExtensions}
                                multiple
                                hidden
                            />
                            <Content drawerWidth={drawerWidth} drawerOpen={effectiveDrawerOpen}>
                                <Paper square style={{ width: '100%', height: '100%', position: 'relative' }}>
                                    {nothingLoaded && (
                                        <LandingPage
                                            latestExtensionVersion={latestExtensionVersion}
                                            extensionUrl={extensionUrl}
                                            extension={extension}
                                            loading={loading}
                                            dragging={dragging}
                                            appBarHidden={appBarHidden}
                                            videoElements={availableTabs ?? []}
                                            canRestoreLastSession={canRestoreLastSession}
                                            onFileSelector={handleFileSelector}
                                            onVideoElementSelected={handleVideoElementSelected}
                                            onRestoreLastSession={handleRestoreLastSession}
                                        />
                                    )}
                                    <DragOverlay
                                        dragging={dragging}
                                        appBarHidden={appBarHidden}
                                        logoUrl={logoUrl}
                                        loading={loading}
                                    />
                                </Paper>
                                <Player
                                    origin={origin}
                                    subtitleReader={subtitleReader}
                                    subtitles={subtitles}
                                    mediaId={extension.id}
                                    settings={settings}
                                    dictionaryProvider={dictionaryProvider}
                                    settingsProvider={settingsProvider}
                                    playbackPreferences={playbackPreferences}
                                    onCopy={handleCopy}
                                    onError={handleError}
                                    onUnloadVideo={handleUnloadVideo}
                                    onLoaded={handleFilesLoaded}
                                    onTabSelected={handleTabSelected}
                                    onAnkiDialogRequest={handleAnkiDialogRequest}
                                    onAnkiDialogRewind={handleAnkiDialogRewind}
                                    onAppBarToggle={handleAppBarToggle}
                                    onHideSubtitlePlayer={handleHideSubtitlePlayer}
                                    onVideoPopOut={handleVideoPopOut}
                                    onPlayModeChangedViaBind={handlePlayModeChangedViaBind}
                                    onSubtitles={
                                        setSubtitles as React.Dispatch<
                                            React.SetStateAction<DisplaySubtitleModel[] | undefined>
                                        >
                                    }
                                    statisticsOverlay={
                                        <AppStatisticsOverlay
                                            open={statisticsOverlayOpen}
                                            dictionaryProvider={dictionaryProvider}
                                            onOpenStatistics={handleOpenStatistics}
                                            onReceivedSnapshot={handleReceivedStatisticsSnapshot}
                                            onSnapshotCleared={handleStatisticsOverlaySnapshotCleared}
                                            onClose={handleCloseStatisticsOverlay}
                                        />
                                    }
                                    onLoadFiles={handleFileSelector}
                                    tab={tab}
                                    availableTabs={availableTabs ?? []}
                                    sources={sources}
                                    jumpToSubtitle={jumpToSubtitle}
                                    onJumpToSubtitleHandled={handleJumpToSubtitleHandled}
                                    rewindSubtitle={rewindSubtitle}
                                    videoFrameRef={videoFrameRef}
                                    videoChannelRef={videoChannelRef}
                                    extension={extension}
                                    drawerOpen={effectiveDrawerOpen}
                                    appBarHidden={appBarHidden}
                                    showCopyButton={tab === undefined}
                                    videoFullscreen={videoFullscreen}
                                    hideSubtitlePlayer={hideSubtitlePlayer || videoFullscreen}
                                    videoPopOut={videoPopOut}
                                    disableKeyEvents={disableKeyEvents}
                                    miningContext={miningContext}
                                    keyBinder={keyBinder}
                                    webSocketClient={webSocketClient}
                                />
                            </Content>
                        </Paper>
                    )}
                </div>
            </ThemeProvider>
        </StyledEngineProvider>
    );
}

export default App;
