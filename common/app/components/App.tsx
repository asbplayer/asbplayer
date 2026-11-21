import type { SubtitleHost } from '@project/common/embedded-subtitles/subtitle-source';
import { useLocalSubtitlePicker } from '@project/common/app/hooks/use-local-subtitle-picker';
import { useSubtitleSelection } from '@project/common/app/hooks/use-subtitle-selection';
import { SubtitleImportController } from '@project/common/app/services/subtitle-import-controller';
import type {
    SubtitleImportState,
    SubtitleImportOptions,
} from '@project/common/app/services/subtitle-import-controller';
import project from '@project/common/project';
import { asbError, asbWarn } from '@project/common/util/log';
import type { AudioTranscodeHost } from '@project/common/audio-transcode';
import { humanReadableTime, download, extractText, timeDurationDisplay } from '@project/common/util';
import type { ComponentProps } from 'react';
import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { makeStyles } from '@mui/styles';
import type { Theme } from '@mui/material/styles';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import { useWindowSize } from '@project/common/app/hooks/use-window-size';
import { useLocationHash } from '@project/common/hooks/use-location-hash';
import type {
    FileModel,
    OpenStatisticsOverlayMessage,
    RequestLocalSubtitlesMessage,
    SubtitleModel,
    DisplaySubtitleModel,
    VideoTabModel,
    LegacyPlayerSyncMessage,
    PlayerSyncMessage,
    CopyHistoryItem,
    Fetcher,
    CardModel,
    ShowAnkiUiMessage,
    JumpToSubtitleMessage,
    DownloadImageMessage,
    DownloadAudioMessage,
    CardTextFieldValues,
    RequestSubtitlesResponse,
    ConfirmedVideoDataSubtitleTrack,
} from '@project/common';
import { MediaFragment, PostMineAction, MediaFragmentErrorCode, VideoDataUiOpenReason } from '@project/common';
import { createTheme } from '@project/common/theme';
import type { AsbplayerSettings, DictionaryTrack, Profile, SettingsProvider } from '@project/common/settings';
import { AudioClip, Mp3Encoder } from '@project/common/audio-clip';
import type { ExportParams } from '@project/common/anki';
import { SubtitleReader } from '@project/common/subtitle-reader';
import { subtitleSourceNames, subtitleSourceStatus } from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceState } from '@project/common/subtitle-reader/subtitle-stream';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import Alert from '@project/common/app/components/Alert';
import AnkiDialog from '@project/common/components/AnkiDialog';
import Paper from '@mui/material/Paper';
import DragOverlay from '@project/common/app/components/DragOverlay';
import Bar from '@project/common/app/components/Bar';
import type { ExtensionMessage } from '@project/common/app/services/chrome-extension';
import type ChromeExtension from '@project/common/app/services/chrome-extension';
import CopyHistory from '@project/common/app/components/CopyHistory';
import StatisticsDrawer from '@project/common/components/StatisticsDrawer';
import LandingPage from '@project/common/app/components/LandingPage';
import type { PlayerRef } from '@project/common/app/components/Player';
import Player from '@project/common/app/components/Player';
import SettingsDialog from '@project/common/app/components/SettingsDialog';
import type { SeekRequest } from '@project/common/app/components/VideoPlayer';
import VideoPlayer from '@project/common/app/components/VideoPlayer';
import type { AlertColor } from '@mui/material/Alert';
import type VideoChannel from '@project/common/app/services/video-channel';
import { addBlobUrl, createBlobUrl, revokeBlobUrl } from '@project/common/blob-url';
import { useTranslation } from 'react-i18next';
import { LocalizedError } from '@project/common/app/components/localized-error';
import { useCopyHistory } from '@project/common/app/hooks/use-copy-history';
import { useCardAudioSources } from '@project/common/app/hooks/use-card-audio-sources';
import { useFileSession } from '@project/common/app/hooks/use-file-session';
import { useI18n } from '@project/common/app/hooks/use-i18n';
import { useAppKeyBinder } from '@project/common/app/hooks/use-app-key-binder';
import { useAnki } from '@project/common/app/hooks/use-anki';
import { usePlaybackPreferences } from '@project/common/app/hooks/use-playback-preferences';
import { MiningContext } from '@project/common/app/services/mining-context';
import { useAppExternalCommands } from '@project/common/app/hooks/use-app-external-commands';
import { appExternalCommandHandlers } from '@project/common/app/services/app-external-command-handlers';
import type { LoadSubtitlesCommand } from '@project/common/external-commands';
import { localMediaId } from '@project/common/external-commands/media';
import { ExtensionBridgedCopyHistoryRepository } from '@project/common/app/services/extension-bridged-copy-history-repository';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';
import { supportsFileSystemAccess, showFilePicker, resolveFiles } from '@project/common/file-system-access';
import { isMobile } from 'react-device-detect';
import type { GlobalState } from '@project/common/global-state';
import mp3WorkerFactory from '@project/common/audio-clip/mp3-encoder-worker.ts?worker';
import pgsParserWorkerFactory from '@project/common/subtitle-reader/pgs-parser-worker.ts?worker';
import CssBaseline from '@mui/material/CssBaseline';
import { StyledEngineProvider } from '@mui/material/styles';
import { useServiceWorker } from '@project/common/app/hooks/use-service-worker';
import NeedRefreshDialog from '@project/common/app/components/NeedRefreshDialog';
import type { DictionaryProvider } from '@project/common/dictionary-db';
import type { LogProvider } from '@project/common/util/log';
import { isFirefox } from '@project/common/browser-detection';
import type { StatisticsOverlayProps } from '@project/common/components/StatisticsOverlay';
import StatisticsOverlay from '@project/common/components/StatisticsOverlay';
import OneUncollectedSentenceDetailsDialog from '@project/common/components/OneUncollectedSentenceDetailsDialog';
import VideoDataSyncDialog from '@project/common/components/VideoDataSyncDialog';
import type { FileWithId } from '@project/common/file-selector';
import { DefaultFileSelector } from '@project/common/file-selector';
import type { MediaSourceFile } from '@project/common/app/services/media-sources';
import {
    MediaSources,
    decodeSubtitleSourceFiles,
    audioExtensions,
    videoExtensions,
    subtitleExtensions,
} from '@project/common/app/services/media-sources';

const extensionUrl = project.extension.chrome.storeUrl;
const fileExtensionPattern = /\.[^.]+$/;

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

const inputAcceptFileExtensions = [...subtitleExtensions, ...audioExtensions, ...videoExtensions].join(',');

async function extractDropFileHandles(items: DataTransferItemList): Promise<FileSystemFileHandle[] | undefined> {
    if (!window.isSecureContext) return; // Chromium error due to getAsFileSystemHandle: RESULT_CODE_KILLED_BAD_MESSAGE
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
            asbWarn('app/files', 'Failed to read dropped file handle:', e);
            return undefined;
        }
    }

    return handles;
}

interface RenderVideoProps {
    searchParams: URLSearchParams;
    supportsDictionaryPlayback: boolean;
    settingsProvider: SettingsProvider;
    settings: AsbplayerSettings;
    extension: ChromeExtension;
    miningContext: MiningContext;
    ankiDialogOpen: boolean;
    seekRequest?: SeekRequest;
    onAnkiDialogRequest: (
        videoFileUrl: string,
        videoFileName: string,
        transcodedAudio: FileModel['transcodedAudio'],
        selectedAudioTrack: string | undefined,
        playbackRate: number,
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        cardTextFieldValues: CardTextFieldValues,
        timestamp: number
    ) => void;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    profile?: string;
    onAnkiDialogRewind: () => void;
    onError: (error: string) => void;
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

function AppStatisticsOverlay({
    dictionaryProvider,
    mediaId,
    dictionaryTracks,
    ...rest
}: StatisticsOverlayProps & { mediaId: string; dictionaryTracks: DictionaryTrack[] }) {
    const [position, setPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (rest.open) {
            setPosition({ x: 0, y: 0 });
        }
    }, [rest.open]);

    const handleMoveBy = useCallback((deltaX: number, deltaY: number) => {
        setPosition((current) => ({
            x: current.x + deltaX,
            y: Math.max(0, current.y + deltaY),
        }));
    }, []);

    const [oneUncollectedSentenceDetailsDialogState, setOneUncollectedSentenceDetailsDialogState] = useState<
        Omit<ComponentProps<typeof OneUncollectedSentenceDetailsDialog>, 'dictionaryTracks' | 'onClose'>
    >({
        open: false,
        entries: [],
        totalSentences: 0,
        miningEnabled: true,
        dictionaryProvider,
    });
    return (
        <>
            <StatisticsOverlay
                {...rest}
                dictionaryProvider={dictionaryProvider}
                onMoveBy={handleMoveBy}
                sx={{
                    position: 'absolute',
                    top: 8,
                    left: '50%',
                    transform: `translateX(calc(-50% + ${position.x}px)) translateY(${position.y}px)`,
                }}
                onOpenSentenceDetails={(entries, totalSentences) =>
                    setOneUncollectedSentenceDetailsDialogState((s) => ({ ...s, open: true, entries, totalSentences }))
                }
            />
            <OneUncollectedSentenceDetailsDialog
                {...oneUncollectedSentenceDetailsDialogState}
                mediaId={mediaId}
                dictionaryProvider={dictionaryProvider}
                dictionaryTracks={dictionaryTracks}
                onClose={() => setOneUncollectedSentenceDetailsDialogState((s) => ({ ...s, open: false }))}
            />
        </>
    );
}

interface Props {
    origin: string;
    logoUrl: string;
    settingsProvider: SettingsProvider;
    dictionaryProvider: DictionaryProvider;
    logProvider: LogProvider;
    settings: AsbplayerSettings;
    globalState?: GlobalState;
    extension: ChromeExtension;
    fetcher: Fetcher;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    audioTranscodeHost: AudioTranscodeHost;
    subtitleHost: SubtitleHost;
    profile?: string;
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
    logProvider,
    settingsProvider,
    settings,
    globalState,
    extension,
    fetcher,
    audioTranscodeHost,
    subtitleHost,
    onSettingsChanged,
    profile,
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
    const supportsDictionaryPlayback = !extension.installed || extension.supportsDictionaryPlayback;
    const supportsDictionaryStatistics = !extension.installed || extension.supportsDictionaryStatistics;
    const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[]>([]);
    const playbackPreferences = usePlaybackPreferences();
    const theme = useMemo<Theme>(() => createTheme(settings.themeType), [settings.themeType]);
    const anki = useAnki({ settings, fetcher });
    const searchParams = useMemo(() => new URLSearchParams(location.search), []);
    const inVideoPlayer = useMemo(() => searchParams.get('video') !== null, [searchParams]);
    const externalCommands = useAppExternalCommands({ settings, extension, inVideoPlayer });
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
        pendingCopyHistoryItems,
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
    const [sources, setSources] = useState(() => new MediaSources());
    const [importState, setImportState] = useState<SubtitleImportState>({
        embeddedSelection: undefined,
        discoveryKey: undefined,
    });
    const { subtitleSourceFiles, firstSubtitleSourceFiles, subtitleFileNames } = sources;
    const fileName = subtitleFileNames.map((name) => name.replace(fileExtensionPattern, '')).find(Boolean);
    useEffect(() => {
        if (!sources.videoFile) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = true;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [sources.videoFile]);
    const subtitlePicker = useLocalSubtitlePicker({
        source: sources.videoFile,
        host: subtitleHost,
        subtitleFiles: subtitleSourceFiles,
        initialFiles: firstSubtitleSourceFiles,
        discoveryKey: importState.discoveryKey,
    });
    const {
        subtitleTrackSelectorOpen,
        openSubtitleTrackSelector,
        subtitleTrackSelectorSelectedTrackIds,
        setSubtitleTrackSelectorSelectedTrackIds,
        subtitleTrackSelectorTracks,
        setSubtitleTrackSelectorTracks,
        audioTracks: localAudioTracks,
        embedded: { service: subtitleService, loading: embeddedLoading, error: embeddedError },
    } = subtitlePicker;
    const subtitleSelection = useSubtitleSelection({
        source: sources.videoFile,
        service: subtitleService,
        selectedTrackIds: subtitleTrackSelectorSelectedTrackIds,
        sources,
    });
    const { busy: selectorBusy, error: selectorError, embeddedError: embeddedSelectionError } = subtitleSelection;
    const selectorErrorMessage =
        selectorError && !embeddedSelectionError
            ? t('info.error', { message: selectorError.message })
            : embeddedSelectionError || embeddedError
              ? t('error.embeddedSubtitlesLoadFailed')
              : '';
    useEffect(() => {
        subtitleService.retain(sources.videoFile ? [sources.videoFile] : []);
    }, [subtitleService, sources.videoFile]);
    const [loadingSources, setLoadingSources] = useState<FileWithId[]>([]);
    const [dragging, setDragging] = useState<boolean>(false);
    const dragEnterRef = useRef<Element | null>(null);
    const [ankiDialogOpen, setAnkiDialogOpen] = useState<boolean>(false);
    const [ankiDialogDisabled, setAnkiDialogDisabled] = useState<boolean>(false);
    const [ankiDialogCard, setAnkiDialogCard] = useState<CardModel>();
    const [exportingCards, setExportingCards] = useState<CardModel[]>([]);
    const retainCardAudioSource = useCardAudioSources([
        ...copyHistoryItems,
        ...pendingCopyHistoryItems,
        ...exportingCards,
        ...(ankiDialogOpen && ankiDialogCard ? [ankiDialogCard] : []),
    ]);
    const miningContext = useMemo(() => new MiningContext(), []);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState<boolean>(false);
    const [settingsDialogScrollToId, setSettingsDialogScrollToId] = useState<string>();
    const [disableKeyEvents, setDisableKeyEvents] = useState<boolean>(false);
    const [tab, setTab] = useState<VideoTabModel>();
    const [availableTabs, setAvailableTabs] = useState<VideoTabModel[]>();
    const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(false);
    const [statisticsOverlayOpen, setStatisticsOverlayOpen] = useState<boolean>(false);
    const [statisticsOverlayDismissed, setStatisticsOverlayDismissed] = useState<boolean>(false);
    const fileSession = useFileSession();
    const { canRestoreLastSession: canRestoreLastFileSession, retainSourcesInSession: retainSourcesInFileSession } =
        fileSession;
    const importOptions: SubtitleImportOptions = {
        sources,
        picker: subtitlePicker,
        selection: subtitleSelection,
        session: fileSession,
        restoreError: t('error.restoreSessionFailed'),
        onSources: (incoming, options) => applySources(incoming, options),
        onAudioTrackChanged: (audioTrackIndex) =>
            setSources((previous) => previous.withAudioTrackIndex(audioTrackIndex)),
        getSubtitleSourceStatus: () => playerRef.current?.getSubtitleSourceStatus() ?? 'complete',
        onCompleted: (video, completed, signal) => {
            setSources((previous) => {
                if (signal.aborted || previous.videoFile?.file !== video.file) return previous;
                return new MediaSources(
                    {
                        kind: 'files',
                        pendingEmbedded: false,
                        tracks: completed.map(({ fileParts }, track) => ({
                            fileParts: fileParts.map((file) => ({ ...file, track })),
                        })),
                    },
                    previous.videoFile,
                    previous.videoFileUrl,
                    previous.audioTrackIndex
                );
            });
        },
        onError: (error) => handleError(error),
    };
    const [subtitleImport] = useState(() => new SubtitleImportController(importOptions, setImportState));
    subtitleImport.options = importOptions;
    useEffect(() => () => subtitleImport.dispose(), [subtitleImport]);
    useEffect(() => subtitleImport.resetPickerDraft(), [subtitleImport, subtitleTrackSelectorOpen]);
    const subtitleProducer = useMemo(
        () =>
            subtitleImport.createProducer(importState.embeddedSelection, {
                reader: subtitleReader,
                service: subtitleService,
                errorMessage: t('error.embeddedSubtitlesLoadFailed'),
            }),
        [subtitleImport, importState.embeddedSelection, subtitleService, subtitleReader, t]
    );

    const [lastError, setLastError] = useState<any>();
    const playerRef = useRef<PlayerRef>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const draftFileInputRef = useRef<HTMLInputElement>(null);

    const handleError = useCallback(
        (message: any) => {
            asbError('app/errors', message);
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

            setAlert(t('info.copiedSubtitle', { text: truncatedError }));
            setAlertOpen(true);
        },
        [t]
    );

    const handleAnkiDialogRequest = useCallback(
        (ankiDialogItem?: CopyHistoryItem) => {
            if (!ankiDialogItem && copyHistoryItemsRef.current.length === 0) {
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
        (
            videoFileUrl: string,
            videoFileName: string,
            transcodedAudio: FileModel['transcodedAudio'],
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
                    transcodedAudio,
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
                        setAlert(t('info.exportedCard', { result }));
                        setAlertOpen(true);
                    } else if (params.mode === 'updateLast') {
                        setAlertSeverity('success');
                        setAlert(t('info.updatedCard', { result }));
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
                void navigator.clipboard.writeText(card.subtitle.text);
            }

            const newCard = {
                ...card,
                subtitleFileName: card.subtitleFileName || card.file?.name || '',
                timestamp: Date.now(),
                id: id || uuidv4(),
            };

            retainCardAudioSource(newCard);
            void saveCopyHistoryItem(newCard).catch(handleError);

            switch (postMineAction ?? PostMineAction.none) {
                case PostMineAction.none:
                    setAlertSeverity('success');
                    setAlert(
                        card.subtitle.text === ''
                            ? t('info.savedTimestamp', { timestamp: humanReadableTime(card.subtitle.start) })
                            : t('info.copiedSubtitle2', { result: card.subtitle.text })
                    );
                    setAlertOpen(true);
                    break;
                case PostMineAction.showAnkiDialog:
                    handleAnkiDialogRequest(newCard);
                    break;
                case PostMineAction.showUpdateCardDialog:
                    handleAnkiDialogRequest(newCard);
                    break;
                case PostMineAction.exportCard:
                case PostMineAction.updateLastCard: {
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

                    setExportingCards((cards) => [...cards, newCard]);
                    void handleAnkiDialogProceed({
                        text: extractText(card.subtitle, card.surroundingSubtitles),
                        track1: extractText(card.subtitle, card.surroundingSubtitles, 0),
                        track2: extractText(card.subtitle, card.surroundingSubtitles, 1),
                        track3: extractText(card.subtitle, card.surroundingSubtitles, 2),
                        definition: newCard.definition ?? '',
                        audioClip: audioClip,
                        image: MediaFragment.fromCard(
                            newCard,
                            settingsRef.current.maxImageWidth,
                            settingsRef.current.maxImageHeight,
                            settingsRef.current.mediaFragmentFormat,
                            settingsRef.current.mediaFragmentTrimStart,
                            settingsRef.current.mediaFragmentTrimEnd,
                            settingsRef.current.mediaFragmentMaxClipLength,
                            settingsRef.current.trimBlackBars
                        ),
                        word: newCard.word ?? '',
                        source: `${newCard.subtitleFileName} (${humanReadableTime(card.mediaTimestamp)})`,
                        url: '',
                        customFieldValues: newCard.customFieldValues ?? {},
                        tags: settingsRef.current.tags,
                        mode: postMineAction === PostMineAction.updateLastCard ? 'updateLast' : 'default',
                    }).finally(() => setExportingCards((cards) => cards.filter((card) => card !== newCard)));
                    break;
                }
                default:
                    throw new Error('Unknown post mine action: ' + postMineAction);
            }
        },
        [
            miningContext,
            retainCardAudioSource,
            handleError,
            saveCopyHistoryItem,
            handleAnkiDialogProceed,
            handleAnkiDialogRequest,
            t,
        ]
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
                void document.documentElement.requestFullscreen();
            }
        } else if (document.fullscreenElement) {
            void document.exitFullscreen();
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
            const pendingTrackIndexes = subtitleImport.unloadVideo();

            void dictionaryProvider.publishStatisticsSnapshot(extension.id, undefined);
            setStatisticsOverlayOpen(false);

            setSources((previous) => {
                revokeBlobUrl(videoFileUrl);
                return previous.withoutVideo(pendingTrackIndexes);
            });
            setVideoFullscreen(false);
        },
        [dictionaryProvider, extension.id, sources, subtitleImport]
    );

    const handleDownloadAudio = useCallback(
        async (card: CardModel) => {
            try {
                const clip = AudioClip.fromCard(card, settings.audioPaddingStart, settings.audioPaddingEnd, false);

                if (clip?.error === undefined) {
                    if (settings.preferMp3) {
                        void clip!.toMp3(() => new mp3WorkerFactory()).download();
                    } else {
                        void clip!.download();
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
                const image = MediaFragment.fromCard(
                    item,
                    settings.maxImageWidth,
                    settings.maxImageHeight,
                    settings.mediaFragmentFormat,
                    settings.mediaFragmentTrimStart,
                    settings.mediaFragmentTrimEnd,
                    settings.mediaFragmentMaxClipLength,
                    settings.trimBlackBars
                )!;

                if (image.error === undefined) {
                    void image.download();
                } else if (image.error === MediaFragmentErrorCode.fileLinkLost) {
                    handleError(t('ankiDialog.imageFileLinkLost'));
                } else if (image.error === MediaFragmentErrorCode.captureFailed) {
                    handleError(t('ankiDialog.imageCaptureFailed'));
                }
            } catch (e) {
                handleError(e);
            }
        },
        [
            handleError,
            settings.maxImageWidth,
            settings.maxImageHeight,
            settings.mediaFragmentFormat,
            settings.mediaFragmentTrimStart,
            settings.mediaFragmentTrimEnd,
            settings.mediaFragmentMaxClipLength,
            settings.trimBlackBars,
            t,
        ]
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
            if (!sources.hasSubtitleFile(subtitleFileName)) {
                handleError(t('error.subtitleFileNotOpen', { fileName: subtitleFileName }));
                return;
            }

            setJumpToSubtitle({ ...subtitle });
        },
        [sources, handleError, t]
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

        if (!sources.hasSubtitleFile(ankiDialogCard.subtitleFileName)) {
            handleError(t('error.subtitleFileNotOpen', { fileName: ankiDialogCard.subtitleFileName }));
            return;
        }

        setRewindSubtitle(ankiDialogCard.subtitle);
        handleAnkiDialogCancel();
    }, [ankiDialogCard, sources, handleAnkiDialogCancel, handleError, t]);

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

            const selectedTabMissing = tab && tabs.filter((t) => t.id === tab.id && t.src === tab.src).length === 0;

            if (selectedTabMissing) {
                setTab(undefined);
                handleError(t('error.lostTabConnection', { tabName: tab.id + ' ' + tab.title }));
            }

            const isSidePanelOpen = extension.asbplayers?.find((a) => a.sidePanel) !== undefined;
            setIsSidePanelOpen(isSidePanelOpen);
        }

        return extension.subscribeTabs(onTabs);
    }, [availableTabs, tab, extension, handleError, t]);
    const handleTabSelected = useCallback((tab: VideoTabModel) => {
        setTab(tab);
    }, []);

    const applySources = useCallback(
        (mediaSources: MediaSources, { applyAudioSelection }: { applyAudioSelection: boolean }) => {
            const remoteSubtitles = mediaSources.subtitleSource.kind === 'remote';
            if (remoteSubtitles || mediaSources.videoFile || mediaSources.subtitleFileNames.length > 0) {
                setJumpToSubtitle(undefined);
            }

            setSources((previous) => {
                let videoFile = mediaSources.videoFile;
                let videoFileUrl: string | undefined;
                const newVideo = videoFile !== undefined && videoFile.file !== previous.videoFile?.file;

                if (videoFile && !newVideo) {
                    videoFile = previous.videoFile;
                    videoFileUrl = previous.videoFileUrl;
                } else if (videoFile) {
                    if (previous.videoFileUrl) revokeBlobUrl(previous.videoFileUrl);
                    videoFileUrl = createBlobUrl(videoFile.file);
                    setTab(undefined);
                } else if (!remoteSubtitles) {
                    videoFile = previous.videoFile;
                    videoFileUrl = previous.videoFileUrl;
                }

                // A video-only selection retains file-backed subtitles, while a new video drops embedded tracks.
                let subtitleSource = mediaSources.subtitleSource;
                if (
                    mediaSources.videoFile &&
                    !mediaSources.subtitleSourceFiles.length &&
                    previous.subtitleSource.kind === 'files'
                ) {
                    subtitleSource = newVideo
                        ? {
                              kind: 'files',
                              pendingEmbedded: false,
                              tracks: previous.subtitleTracks.map(({ fileParts }) => ({
                                  fileParts: fileParts.filter((file) => !file.embedded),
                              })),
                          }
                        : previous.subtitleSource;
                }
                let audioTrackIndex: number | undefined;
                if (!remoteSubtitles) {
                    audioTrackIndex =
                        newVideo || applyAudioSelection ? mediaSources.audioTrackIndex : previous.audioTrackIndex;
                }
                const sources = new MediaSources(subtitleSource, videoFile, videoFileUrl, audioTrackIndex);

                const previousLoadingSources = previous.allSourceFiles;
                const loadingSources = sources.allSourceFiles.filter(
                    (source) => !previousLoadingSources.some((previousSource) => source.file === previousSource.file)
                );
                setLoadingSources(loadingSources);

                void retainSourcesInFileSession({
                    subtitleTrackIds: sources.subtitleTracks.map(({ fileParts }) => fileParts.map(({ id }) => id)),
                    videoId: sources.videoFile?.id,
                    audioTrackIndex: sources.audioTrackIndex,
                });

                return sources;
            });
        },
        [retainSourcesInFileSession]
    );

    const handleSources = useCallback(
        (incoming: MediaSources) => subtitleImport.loadSources(incoming, { keepDraftHandles: false }),
        [subtitleImport]
    );
    const handleFiles = useCallback(
        (files: MediaSourceFile[]) => subtitleImport.loadSourceFiles(files),
        [subtitleImport]
    );
    const handleManualFiles = useCallback(
        (files: FileWithId[]) => subtitleImport.importManualFiles(files),
        [subtitleImport]
    );
    const handleRestoreLastSession = useCallback(() => subtitleImport.restoreSession(), [subtitleImport]);

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
                const files: FileWithId[] = [];

                for (const f of filePromises) {
                    files.push({ file: await f, id: uuidv4() });
                }

                handleManualFiles(files);
            } catch (e) {
                handleError(e);
            }
        },
        [handleError, handleManualFiles, t]
    );

    useEffect(
        () =>
            externalCommands.setHandlers({
                onLoadSubtitles: async ({ body: { files, mediaId } }: LoadSubtitlesCommand) => {
                    if (mediaId !== undefined && mediaId !== localMediaId(extension.id)) {
                        return;
                    }

                    handleFiles(decodeSubtitleSourceFiles(files ?? []));
                },
            }),
        [externalCommands, extension, handleFiles]
    );

    useEffect(
        () =>
            externalCommands.setHandlers(
                appExternalCommandHandlers({
                    appId: extension.id,
                    subtitles,
                    subtitleFileNames,
                    isActive: () => document.visibilityState === 'visible',
                })
            ),
        [externalCommands, extension, subtitles, subtitleFileNames]
    );

    useEffect(() => {
        if (inVideoPlayer) {
            extension.videoPlayer = true;
            extension.loadedSubtitles = false;
            extension.setSubtitleTracks([], []);
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
                        asbError(
                            'app/messages',
                            'Received sync request but the requesting tab ID ' +
                                message.tabId +
                                ' with src ' +
                                message.src +
                                ' was not found'
                        );
                    } else {
                        asbError(
                            'app/messages',
                            'Received sync request but the requesting tab ID ' + message.tabId + ' was not found'
                        );
                    }

                    return;
                }

                const tab = tabs[0];
                const mediaSources = MediaSources.fromSync(message.data as LegacyPlayerSyncMessage | PlayerSyncMessage);

                if (sources.videoFileUrl) {
                    handleUnloadVideo(sources.videoFileUrl);
                }

                handleSources(mediaSources);
                setTab((previous) => (previous?.id === tab.id && previous.src === tab.src ? previous : tab));
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
            } else if (message.data.command === 'request-local-subtitles') {
                const requestMessage = message.data as RequestLocalSubtitlesMessage;
                extension.sendSubtitles(requestMessage.messageId, {
                    subtitles,
                    subtitleFileNames,
                });
            }
        }

        const unsubscribe = extension.subscribe((message) => {
            void onMessage(message);
        });
        extension.videoPlayer = false;
        extension.loadedSubtitles = subtitles.length > 0;
        extension.setSubtitleTracks(subtitles, subtitleFileNames);
        extension.syncedVideoElement = tab;
        extension.startHeartbeat();
        return unsubscribe;
    }, [
        extension,
        subtitles,
        supportsDictionaryStatistics,
        inVideoPlayer,
        sources.videoFileUrl,
        subtitleFileNames,
        statisticsOverlayOpen,
        tab,
        handleSources,
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
                void handleDownloadAudio(message.data as DownloadAudioMessage);
            }
        });
    }, [extension, inVideoPlayer, handleDownloadAudio]);

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
                void handleDirectory(dataTransfer.items);
            } else if (dataTransfer.files && dataTransfer.files.length > 0) {
                // Copy files synchronously; DataTransfer may be cleared after this handler returns.
                const files = [...dataTransfer.files].map((file) => ({ file, id: uuidv4() }));

                if (!handleManualFiles(files)) {
                    return;
                }

                if (dataTransfer.items && dataTransfer.items.length > 0) {
                    void subtitleImport.rememberDroppedHandles(files, extractDropFileHandles(dataTransfer.items));
                }
            }
        },
        [inVideoPlayer, handleError, handleManualFiles, handleDirectory, ankiDialogOpen, t, subtitleImport]
    );

    const handleFileSelector = useCallback(
        async ({ forDraft }: { forDraft: boolean }) => {
            if (!supportsFileSystemAccess()) {
                if (forDraft) {
                    subtitleImport.beginDraftFileInputRequest();
                    draftFileInputRef.current?.click();
                } else {
                    fileInputRef.current?.click();
                }
                return;
            }

            const signal = subtitleImport.fileRequestSignal({ forDraft });
            try {
                const handles = await showFilePicker({
                    videoExtensions: [...videoExtensions],
                    audioExtensions: [...audioExtensions],
                    subtitleExtensions: [...subtitleExtensions],
                });
                if (!handles || handles.length === 0) return;

                const { files } = await resolveFiles(handles);

                return await subtitleImport.acceptFileRequest(files, handles, { forDraft, signal });
            } catch (e) {
                asbError('app/files', 'Failed to pick files via File System Access API:', e);
                handleError(e);
            }
        },
        [subtitleImport, handleError]
    );

    const handleOpenFiles = useCallback(() => handleFileSelector({ forDraft: false }), [handleFileSelector]);

    const fileSelector = useMemo(
        () => new DefaultFileSelector(() => handleFileSelector({ forDraft: true })),
        [handleFileSelector]
    );

    const handleFileInputChange = useCallback(() => {
        const files = fileInputRef.current?.files;

        if (files && files.length > 0) {
            handleManualFiles([...files].map((file) => ({ file, id: uuidv4() })));
            fileInputRef.current!.value = '';
        }
    }, [handleManualFiles]);

    const handleDraftFileInputChange = useCallback(() => {
        if (!subtitleImport.draftFileInputIsCurrent()) {
            if (draftFileInputRef.current) draftFileInputRef.current.value = '';
            return;
        }
        const files = draftFileInputRef.current?.files;

        if (files && files.length) {
            const filesWithId = [...files].map((file) => ({ file, id: uuidv4() }));
            if (subtitleImport.validateFiles(filesWithId)) fileSelector.publishFiles(filesWithId);
            draftFileInputRef.current!.value = '';
        }
    }, [subtitleImport, fileSelector]);

    const handleVideoElementSelected = useCallback(
        async (videoElement: VideoTabModel) => {
            const { id: tabId, synced, src } = videoElement;

            if (!synced) {
                extension.loadSubtitles(tabId, src);
                return;
            }

            let subtitleFileNames: string[] = [];
            if (!extension.supportsProgressiveSubtitles) {
                const response = (await extension.requestSubtitles(tabId, src)) as RequestSubtitlesResponse | undefined;
                if (response === undefined || response.subtitleFileNames.length === 0) return;
                subtitleFileNames = response.subtitleFileNames;
                const { subtitles } = response;
                const length = subtitles.length > 0 ? subtitles[subtitles.length - 1].end : 0;
                setSubtitles(
                    subtitles.map((s, i) => ({
                        ...s,
                        displayTime: timeDurationDisplay(s.start, length),
                        displayEndTime: timeDurationDisplay(s.end, length),
                        index: i,
                    }))
                );
            }

            if (sources.videoFileUrl) handleUnloadVideo(sources.videoFileUrl);
            handleSources(
                new MediaSources({
                    kind: 'remote',
                    names: subtitleFileNames,
                    status: extension.supportsProgressiveSubtitles ? 'loading' : 'complete',
                })
            );
            setTab((previous) =>
                previous?.id === videoElement.id && previous.src === videoElement.src ? previous : videoElement
            );
        },
        [extension, sources.videoFileUrl, handleUnloadVideo, handleSources]
    );

    const handleSubtitleSourcesChanged = useCallback(
        (sourceStates: readonly SubtitleSourceState[]) => {
            if (sources.subtitleSource.kind !== 'remote') return;
            const names = subtitleSourceNames(sourceStates);
            const status = subtitleSourceStatus(sourceStates);
            if (
                status === sources.subtitleSource.status &&
                names.length === sources.subtitleFileNames.length &&
                names.every((name, track) => name === sources.subtitleFileNames[track])
            ) {
                return;
            }
            setSources(new MediaSources({ kind: 'remote', names, status }));
        },
        [sources]
    );

    const handleDownloadSubtitleFilesAsSrt = useCallback(async () => {
        try {
            const tracks = await sources.subtitleTracksForExport(subtitleReader, subtitles);
            const result = subtitleReader.createSrtDownload(
                tracks,
                sources.videoFile?.file.name ?? sources.subtitleFileNames.find((name) => name) ?? 'subtitles'
            );
            if (result !== undefined) download(result.blob, result.name);
        } catch (error) {
            handleError(error);
        }
    }, [sources, subtitles, subtitleReader, handleError]);

    const handleDownloadSubtitleTimeline = useCallback(() => {
        playerRef.current?.downloadSubtitleTimeline();
    }, []);

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
                    if (loadedFile === loadingFile.file) {
                        return false;
                    }
                }

                return true;
            })
        );
    }, []);

    const { hash: settingsHash, url: settingsUrl } = useLocationHash({ view: 'settings' });
    useEffect(() => {
        if (settingsHash === undefined) {
            return;
        }

        setSettingsDialogScrollToId(settingsHash);
        setSettingsDialogOpen(true);
    }, [settingsHash, settingsUrl]);

    useEffect(() => {
        if (sources.videoFile && alertOpen && alert && alertSeverity) {
            videoChannelRef.current?.alert(alert, alertSeverity);
            setAlertOpen(false);
        }
    }, [sources.videoFile, alert, alertSeverity, alertOpen]);

    const handleCopyToClipboard = useCallback((blob: Blob) => {
        navigator.clipboard
            .write([new ClipboardItem({ [blob.type]: blob })])
            .catch((error) => asbError('app/clipboard', error));
    }, []);

    useEffect(() => {
        return keyBinder?.bindToggleSidePanel(
            () => {
                if (extension.supportsSidePanel) {
                    extension.toggleSidePanel();
                } else if (copyHistoryOpen) {
                    void handleOpenCopyHistory();
                } else if (statisticsOpen) {
                    handleOpenStatistics();
                } else {
                    void handleOpenCopyHistory();
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

    const fetchStatisticsMediaInfo = useCallback(async () => {
        // In-app statistics can only show the current media - no need to display redundant information like the source string
        return { sourceString: '' };
    }, []);

    const mp3Encoder = useCallback(async (blob: Blob) => {
        return Mp3Encoder.encode(blob, () => new mp3WorkerFactory());
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

    const handleCloseSubtitleTrackSelector = useCallback(() => subtitleImport.closePicker(), [subtitleImport]);
    const handleConfirmSubtitleTrackSelection = useCallback(
        (tracks: ConfirmedVideoDataSubtitleTrack[], _remember: boolean, audioTrackIndex?: number) =>
            subtitleImport.confirm(tracks, audioTrackIndex),
        [subtitleImport]
    );
    const handleOpenSubtitleTrackSelection = useCallback(
        (files: FileWithId[]) => subtitleImport.stagePickerFiles(files),
        [subtitleImport]
    );

    useEffect(() => {
        return keyBinder.bindSelectSubtitleTrack(
            () => {
                openSubtitleTrackSelector();
            },
            () => ankiDialogOpen,
            false
        );
    }, [keyBinder, ankiDialogOpen, openSubtitleTrackSelector]);

    if (!i18nInitialized) {
        return null;
    }

    const loading = loadingSources.length !== 0;
    const nothingLoaded =
        tab === undefined &&
        ((loading && !videoFrameRef.current) || (sources.subtitleTracks.length === 0 && !sources.videoFile));
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
                    {!sources.videoFile && !inVideoPlayer && (
                        <Alert open={alertOpen} useAppLogo={false} onClose={handleAlertClosed} severity={alertSeverity}>
                            {alert}
                        </Alert>
                    )}
                    {inVideoPlayer ? (
                        <>
                            <RenderVideo
                                supportsDictionaryPlayback={supportsDictionaryPlayback}
                                searchParams={searchParams}
                                settingsProvider={settingsProvider}
                                settings={settings}
                                extension={extension}
                                miningContext={miningContext}
                                ankiDialogOpen={ankiDialogOpen}
                                seekRequest={videoPlayerSeekRequest}
                                onSettingsChanged={onSettingsChanged}
                                profile={profile}
                                onAnkiDialogRequest={handleAnkiDialogRequestFromVideoPlayer}
                                onAnkiDialogRewind={handleAnkiDialogRewindFromVideoPlayer}
                                onError={handleError}
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
                                sources={sources}
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
                                mediaId={extension.id}
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
                                supportsDictionaryPlayback={supportsDictionaryPlayback}
                                anki={anki}
                                extension={extension}
                                open={settingsDialogOpen}
                                onSettingsChanged={onSettingsChanged}
                                onClose={handleCloseSettings}
                                dictionaryProvider={dictionaryProvider}
                                logProvider={logProvider}
                                settings={settings}
                                activeProfile={profilesContext.activeProfile}
                                scrollToId={settingsDialogScrollToId}
                                {...profilesContext}
                            />
                            {globalState && (
                                <VideoDataSyncDialog
                                    open={subtitleTrackSelectorOpen}
                                    disabled={selectorBusy}
                                    isLoading={selectorBusy}
                                    discovering={embeddedLoading}
                                    suggestedName={sources.videoFile?.file.name ?? ''}
                                    audioTracks={localAudioTracks}
                                    audioTrackIndex={sources.audioTrackIndex}
                                    subtitleTracks={subtitleTrackSelectorTracks}
                                    selectedSubtitleTrackIds={subtitleTrackSelectorSelectedTrackIds}
                                    onSelectedSubtitleTrackIds={setSubtitleTrackSelectorSelectedTrackIds}
                                    defaultCheckboxState={false}
                                    error={selectorErrorMessage}
                                    openReason={VideoDataUiOpenReason.userRequested}
                                    profiles={profilesContext.profiles}
                                    activeProfile={profilesContext.activeProfile}
                                    onlineSubtitleSourceConfig={globalState.onlineSubtitleSourceConfig}
                                    clientId="asbplayer-app"
                                    hasSeenFtue={true}
                                    hideRememberTrackPreferenceToggle={true}
                                    hideVideoNameTextField={true}
                                    fileSelector={fileSelector}
                                    onCancel={handleCloseSubtitleTrackSelector}
                                    onOpenFiles={handleOpenSubtitleTrackSelection}
                                    onOpenSettings={handleOpenSettings}
                                    onConfirm={handleConfirmSubtitleTrackSelection}
                                    onDismissFtue={() => {}}
                                    onOnlineSourceConfigChanged={(state) =>
                                        onGlobalStateChanged({
                                            onlineSubtitleSourceConfig: {
                                                ...globalState.onlineSubtitleSourceConfig,
                                                ...state,
                                            },
                                        })
                                    }
                                    onSubtitleTracks={setSubtitleTrackSelectorTracks}
                                    onSetActiveProfile={profilesContext.onSetActiveProfile}
                                />
                            )}
                            <NeedRefreshDialog
                                open={needRefreshDialogOpen}
                                onRefresh={updateFromServiceWorker}
                                onClose={handleCloseNeedRefreshDialog}
                            />
                            <Bar
                                title={fileName || project.names.short}
                                drawerWidth={drawerWidth}
                                drawerOpen={effectiveDrawerOpen}
                                hidden={appBarHidden}
                                canDownloadSubtitles={sources.canDownloadSubtitles}
                                onOpenCopyHistory={handleOpenCopyHistory}
                                onOpenStatistics={supportsDictionaryStatistics ? handleOpenStatistics : undefined}
                                onDownloadSubtitleFilesAsSrt={handleDownloadSubtitleFilesAsSrt}
                                onDownloadSubtitleTimeline={handleDownloadSubtitleTimeline}
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
                            <input
                                ref={draftFileInputRef}
                                onChange={handleDraftFileInputChange}
                                type="file"
                                accept={inputAcceptFileExtensions}
                                multiple
                                hidden
                            />
                            <Content drawerWidth={drawerWidth} drawerOpen={effectiveDrawerOpen}>
                                <Paper square style={{ width: '100%', height: '100%', position: 'relative' }}>
                                    {nothingLoaded && (
                                        <LandingPage
                                            latestExtensionVersion={project.releases.extension.publishedVersion}
                                            extensionUrl={extensionUrl}
                                            extension={extension}
                                            loading={loading}
                                            dragging={dragging}
                                            appBarHidden={appBarHidden}
                                            videoElements={availableTabs ?? []}
                                            canRestoreLastSession={canRestoreLastFileSession}
                                            onFileSelector={handleOpenFiles}
                                            onVideoElementSelected={handleVideoElementSelected}
                                            onRestoreLastSession={handleRestoreLastSession}
                                            onOpenSubtitleTrackSelector={openSubtitleTrackSelector}
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
                                    supportsDictionaryPlayback={supportsDictionaryPlayback}
                                    audioTranscodeHost={audioTranscodeHost}
                                    subtitlePickerOpen={subtitleTrackSelectorOpen}
                                    ref={playerRef}
                                    origin={origin}
                                    subtitleReader={subtitleReader}
                                    subtitleProducer={subtitleProducer}
                                    subtitles={subtitles}
                                    mediaId={extension.id}
                                    settings={settings}
                                    dictionaryProvider={dictionaryProvider}
                                    settingsProvider={settingsProvider}
                                    onSettingsChanged={onSettingsChanged}
                                    profile={profile}
                                    playbackPreferences={playbackPreferences}
                                    onCopy={handleCopy}
                                    onError={handleError}
                                    onUnloadVideo={handleUnloadVideo}
                                    onLoaded={handleFilesLoaded}
                                    onSubtitleSourcesChanged={handleSubtitleSourcesChanged}
                                    onTabSelected={handleTabSelected}
                                    onAnkiDialogRequest={handleAnkiDialogRequest}
                                    onAnkiDialogRewind={handleAnkiDialogRewind}
                                    onAppBarToggle={handleAppBarToggle}
                                    onHideSubtitlePlayer={handleHideSubtitlePlayer}
                                    onVideoPopOut={handleVideoPopOut}
                                    onSubtitles={
                                        setSubtitles as React.Dispatch<
                                            React.SetStateAction<DisplaySubtitleModel[] | undefined>
                                        >
                                    }
                                    statisticsOverlay={
                                        <AppStatisticsOverlay
                                            open={statisticsOverlayOpen}
                                            mediaId={extension.id}
                                            dictionaryProvider={dictionaryProvider}
                                            dictionaryTracks={settings.dictionaryTracks}
                                            onOpenStatistics={handleOpenStatistics}
                                            onReceivedSnapshot={handleReceivedStatisticsSnapshot}
                                            onSnapshotCleared={handleStatisticsOverlaySnapshotCleared}
                                            onClose={handleCloseStatisticsOverlay}
                                        />
                                    }
                                    onLoadFiles={handleOpenFiles}
                                    onLoadSubtitles={openSubtitleTrackSelector}
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
                                    externalCommands={externalCommands}
                                    playbackTimelineFileName={fileName}
                                    playbackTimelineModeLabels={{
                                        normal: t('controls.normalMode'),
                                        fastForward: t('controls.fastForwardMode'),
                                        condensed: t('controls.condensedMode'),
                                        autoPauseAtStart: t('settings.autoPauseAtSubtitleStart'),
                                        autoPauseAtEnd: t('settings.autoPauseAtSubtitleEnd'),
                                        repeat: t('controls.repeatMode'),
                                    }}
                                    playbackTimelineOptionLabels={{
                                        title: t('settings.playbackModes'),
                                        subtitleTrack: (trackNumber) =>
                                            t('settings.subtitleTrackChoice', { trackNumber }),
                                        subtitleTriggerStartOffset: t('settings.subtitleTriggerStartOffset'),
                                        subtitleTriggerEndOffset: t('settings.subtitleTriggerEndOffset'),
                                        subtitleTriggerGapEndOffset: t('settings.subtitleTriggerGapEndOffset'),
                                        subtitleTriggerGapStartOffset: t('settings.subtitleTriggerGapStartOffset'),
                                        condensedPlaybackMinimumSkipInterval: t(
                                            'settings.condensedPlaybackMinimumSkipInterval'
                                        ),
                                        fastForwardPlaybackMinimumSkipInterval: t(
                                            'settings.fastForwardPlaybackMinimumSkipInterval'
                                        ),
                                    }}
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
