import {
    AsbPlayerToTabCommand,
    AsbPlayerToVideoCommandV2,
    MediaFragment,
    CopyHistoryItem,
    ExtensionToVideoCommand,
    LoadSubtitlesMessage,
    RequestSubtitlesMessage,
    ShowAnkiUiMessage,
    VideoTabModel,
    ExtensionToAsbPlayerCommand,
    CopySubtitleMessage,
    CardModel,
    RequestSubtitlesResponse,
    JumpToSubtitleMessage,
    DownloadImageMessage,
    DownloadAudioMessage,
    CardExportedMessage,
} from '@project/common';
import type { Command, Message, OpenStatisticsOverlayMessage } from '@project/common';
import type { BulkExportStartedPayload } from '../../controllers/bulk-export-controller';
import { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import { AudioClip } from '@project/common/audio-clip';
import { ChromeExtension, useCopyHistory } from '@project/common/app';
import { useI18n } from '../hooks/use-i18n';
import { SubtitleReader } from '@project/common/subtitle-reader';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Player from '@project/common/app/components/Player';
import { PlaybackPreferences } from '@project/common/app';
import { AlertColor } from '@mui/material/Alert';
import Alert from '@project/common/app/components/Alert';
import { LocalizedError } from '@project/common/app';
import { useTranslation } from 'react-i18next';
import SidePanelHome from './SidePanelHome';
import { DisplaySubtitleModel } from '@project/common/app/components/SubtitlePlayer';
import { useCurrentTabId } from '../hooks/use-current-tab-id';
import { useVideoElementCount } from '../hooks/use-video-element-count';
import CenteredGridContainer from './CenteredGridContainer';
import CenteredGridItem from './CenteredGridItem';
import CircularProgress from '@mui/material/CircularProgress';
import SidePanelBottomControls from './SidePanelBottomControls';
import SidePanelRecordingOverlay from './SidePanelRecordingOverlay';
import SidePanelTopControls from './SidePanelTopControls';
import CopyHistory from '@project/common/app/components/CopyHistory';
import { useAppKeyBinder } from '@project/common/app/hooks/use-app-key-binder';
import { download, timeDurationDisplay } from '@project/common/util';
import { MiningContext } from '@project/common/app/services/mining-context';
import BulkExportModal from '@project/common/app/components/BulkExportModal';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';
import { mp3WorkerFactory } from '../../services/mp3-worker-factory';
import { pgsParserWorkerFactory } from '../../services/pgs-parser-worker-factory';
import { DictionaryProvider } from '@project/common/dictionary-db';
import StatisticsDrawer from '@project/common/components/StatisticsDrawer';
import { useSidePanelRequestedLocation } from '../hooks/use-side-panel-requested-location';
import { clearExtensionRequestedLocation } from '@/services/side-panel';
import { uiTabRegistry } from '../hooks/use-has-subtitles';
import { createStatisticsPopup } from '@/services/statistics-util';

interface Props {
    dictionaryProvider: DictionaryProvider;
    settingsProvider: SettingsProvider;
    settings: AsbplayerSettings;
    extension: ChromeExtension;
}

const sameVideoTab = (a: VideoTabModel, b: VideoTabModel) => {
    return a.id === b.id && a.src === b.src && a.synced === b.synced && a.syncedTimestamp === b.syncedTimestamp;
};

const emptyArray: VideoTabModel[] = [];
const miningContext = new MiningContext();

export default function SidePanel({ dictionaryProvider, settingsProvider, settings, extension }: Props) {
    const { t } = useTranslation();
    const playbackPreferences = useMemo(() => new PlaybackPreferences(settings, extension), [settings, extension]);
    const subtitleReader = useMemo(
        () =>
            new SubtitleReader({
                regexFilter: settings.subtitleRegexFilter,
                regexFilterTextReplacement: settings.subtitleRegexFilterTextReplacement,
                subtitleHtml: settings.subtitleHtml,
                convertNetflixRuby: settings.convertNetflixRuby,
                pgsParserWorkerFactory,
            }),
        [
            settings.subtitleRegexFilter,
            settings.subtitleRegexFilterTextReplacement,
            settings.subtitleHtml,
            settings.convertNetflixRuby,
        ]
    );
    const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[]>();
    const [subtitleFileNames, setSubtitleFileNames] = useState<string[]>();
    const [canDownloadSubtitles, setCanDownloadSubtitles] = useState<boolean>(true);
    const [alert, setAlert] = useState<string>();
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alertSeverity, setAlertSeverity] = useState<AlertColor>();
    const [initializing, setInitializing] = useState<boolean>(true);
    const [syncedVideoTab, setSyncedVideoElement] = useState<VideoTabModel>();
    const [recordingAudio, setRecordingAudio] = useState<boolean>(false);
    const [viewingAsbplayerId, setViewingAsbplayerId] = useState<string>();
    const [viewingAsbplayerHasSubtitles, setViewingAsbplayerHasSubtitles] = useState<boolean>(false);

    const keyBinder = useAppKeyBinder(settings.keyBindSet, extension);
    const currentTabId = useCurrentTabId();
    const videoElementCount = useVideoElementCount({ extension, currentTabId });

    useEffect(() => {
        extension.loadedSubtitles = subtitles !== undefined && subtitles.length > 0;
        extension.startHeartbeat();
    }, [extension, subtitles]);

    useEffect(() => {
        setCanDownloadSubtitles(subtitles?.some((s) => s.text !== '') ?? false);
    }, [subtitles]);

    useEffect(() => {
        if (currentTabId === undefined) {
            return;
        }

        return extension.subscribeTabs(async (tabs) => {
            const currentVideoTabs = tabs.filter((t) => t.id === currentTabId);

            if (currentVideoTabs.length > 0) {
                let lastSyncedVideoTab: VideoTabModel | undefined;

                for (const t of currentVideoTabs) {
                    if (!t.synced) {
                        continue;
                    }

                    if (lastSyncedVideoTab === undefined || t.syncedTimestamp! > lastSyncedVideoTab.syncedTimestamp!) {
                        lastSyncedVideoTab = t;
                    }
                }

                if (
                    lastSyncedVideoTab !== undefined &&
                    (syncedVideoTab === undefined || !sameVideoTab(lastSyncedVideoTab, syncedVideoTab))
                ) {
                    const message: ExtensionToVideoCommand<RequestSubtitlesMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'request-subtitles',
                        },
                        src: lastSyncedVideoTab.src,
                    };
                    const response = (await browser.tabs.sendMessage(lastSyncedVideoTab.id, message)) as
                        | RequestSubtitlesResponse
                        | undefined;

                    if (response !== undefined) {
                        const subs = response.subtitles;
                        const length = subs.length > 0 ? subs[subs.length - 1].end : 0;
                        setSyncedVideoElement(lastSyncedVideoTab);
                        setSubtitles(
                            subs.map((s, index) => ({
                                ...s,
                                index,
                                displayTime: timeDurationDisplay(s.start, length),
                            }))
                        );
                        setSubtitleFileNames(response.subtitleFileNames);
                    }
                }
            }

            setInitializing(false);
        });
    }, [extension, subtitles, initializing, currentTabId, syncedVideoTab]);

    useEffect(() => {
        return extension.subscribe((message) => {
            if (message.data.command === 'close-side-panel') {
                window.close();
            }
        });
    }, [extension]);

    useEffect(() => {
        // Allows background script to detect when the side panel has closed. See background.ts.
        browser.runtime.connect({ name: `asbplayer-side-panel-${extension.id}` });
    }, [extension]);

    const { appRequestedLocation, extensionRequestedLocation } = useSidePanelRequestedLocation();

    useEffect(() => {
        extension.sidePanelAppRequestedLocation = appRequestedLocation;
        // Force restarts the heartbeat so that the tab registry can immediately receive the new location
        extension.startHeartbeat();
    }, [extension, appRequestedLocation]);

    useEffect(() => {
        if (currentTabId === undefined || syncedVideoTab === undefined) {
            return;
        }

        return extension.subscribeTabs((tabs) => {
            const tabStillExists =
                tabs.find((t) => t.id === syncedVideoTab.id && t.src === syncedVideoTab.src && t.synced) !== undefined;

            if (!tabStillExists) {
                setSubtitles(undefined);
                setSyncedVideoElement(undefined);
            }
        });
    }, [extension, currentTabId, syncedVideoTab]);

    useEffect(() => {
        if (currentTabId === undefined) {
            setViewingAsbplayerId(undefined);
            setViewingAsbplayerHasSubtitles(false);
            return;
        }

        return extension.subscribeTabs(() => {
            const asbplayer = extension.asbplayers?.find((a) => a.tabId === currentTabId);
            if (asbplayer === undefined) {
                setViewingAsbplayerId(undefined);
                setViewingAsbplayerHasSubtitles(false);
                return;
            }

            setViewingAsbplayerId(asbplayer.id);
            setViewingAsbplayerHasSubtitles(asbplayer.loadedSubtitles);
        });
    }, [currentTabId, extension]);

    useEffect(() => {
        return extension.subscribe((message) => {
            if (message.data.command === 'recording-started') {
                setRecordingAudio(true);
            } else if (message.data.command === 'recording-finished') {
                setRecordingAudio(false);
            }
        });
    }, [extension]);

    useEffect(() => {
        return keyBinder.bindToggleSidePanel(
            () => window.close(),
            () => false
        );
    }, [keyBinder]);

    const handleError = useCallback(
        (message: any) => {
            console.error(message);

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

    const handleAlertClosed = useCallback(() => setAlertOpen(false), []);

    const handleMineSubtitle = useCallback(() => {
        if (syncedVideoTab === undefined) {
            return;
        }

        const message: AsbPlayerToVideoCommandV2<CopySubtitleMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'copy-subtitle', postMineAction: settings.clickToMineDefaultAction },
            tabId: syncedVideoTab.id,
            src: syncedVideoTab.src,
        };
        browser.runtime.sendMessage(message);
    }, [syncedVideoTab, settings.clickToMineDefaultAction]);

    const handleLoadSubtitles = useCallback(() => {
        if (currentTabId === undefined) {
            return;
        }

        const message: AsbPlayerToTabCommand<LoadSubtitlesMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'load-subtitles' },
            tabId: currentTabId,
        };
        browser.runtime.sendMessage(message);
    }, [currentTabId]);

    const handleDownloadSubtitles = useCallback(() => {
        if (subtitles) {
            const fileName =
                subtitleFileNames !== undefined && subtitleFileNames.length > 0
                    ? `${subtitleFileNames[0]}.srt`
                    : 'subtitles.srt';
            download(new Blob([subtitleReader.subtitlesToSrt(subtitles)], { type: 'text/plain' }), fileName);
        }
    }, [subtitles, subtitleFileNames, subtitleReader]);

    const handleBulkExportSubtitles = useCallback(async () => {
        if (!syncedVideoTab) return;
        const startCommand: AsbPlayerToVideoCommandV2<Message> = {
            sender: 'asbplayerv2',
            message: { command: 'start-bulk-export' } as Message,
            tabId: syncedVideoTab.id,
            src: syncedVideoTab.src,
        };
        browser.runtime.sendMessage(startCommand);
    }, [syncedVideoTab]);

    const handleBulkExportCancel = useCallback(async () => {
        if (!syncedVideoTab) return;
        const cancelCommand: AsbPlayerToVideoCommandV2<Message> = {
            sender: 'asbplayerv2',
            message: { command: 'cancel-bulk-export' } as Message,
            tabId: syncedVideoTab.id,
            src: syncedVideoTab.src,
        };
        browser.runtime.sendMessage(cancelCommand);
    }, [syncedVideoTab]);

    // Local bulk export UI state
    const [bulkOpen, setBulkOpen] = useState<boolean>(false);
    const [bulkCurrent, setBulkCurrent] = useState<number>(0);
    const [bulkTotal, setBulkTotal] = useState<number>(0);

    // Listen for bulk export lifecycle messages from background
    useEffect(() => {
        const listener = (message: any) => {
            if (message?.sender === 'asbplayerv2' && message?.message?.command === 'bulk-export-started') {
                const total = (message.message as BulkExportStartedPayload).total ?? 0;
                setBulkOpen(true);
                setBulkTotal(total);
                setBulkCurrent(0);
            } else if (
                message?.sender === 'asbplayer-extension-to-video' &&
                message?.message?.command === 'card-exported'
            ) {
                const exported = message.message as CardExportedMessage;
                if (exported.isBulkExport) {
                    setBulkCurrent((c) => c + 1);
                }
            } else if (
                message?.sender === 'asbplayerv2' &&
                (message?.message?.command === 'bulk-export-completed' ||
                    message?.message?.command === 'bulk-export-cancelled')
            ) {
                setBulkOpen(false);
            }
        };
        browser.runtime.onMessage.addListener(listener);
        return () => browser.runtime.onMessage.removeListener(listener);
    }, []);

    const topControlsRef = useRef<HTMLDivElement>(null);
    const [showTopControls, setShowTopControls] = useState<boolean>(false);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const bounds = topControlsRef.current?.getBoundingClientRect();

            if (!bounds) {
                return;
            }
            const xDistance = Math.min(
                Math.abs(e.clientX - bounds.left),
                Math.abs(e.clientX - bounds.left - bounds.width)
            );
            const yDistance = Math.min(
                Math.abs(e.clientY - bounds.top),
                Math.abs(e.clientY - bounds.top - bounds.height)
            );

            if (!showTopControls && xDistance < 100 && yDistance < 100) {
                setShowTopControls(true);
            } else if (showTopControls && (xDistance >= 100 || yDistance >= 100)) {
                setShowTopControls(false);
            }
        },
        [showTopControls]
    );

    const copyHistoryRepository = useMemo(
        () => new IndexedDBCopyHistoryRepository(settings.miningHistoryStorageLimit),
        [settings.miningHistoryStorageLimit]
    );
    const { copyHistoryItems, refreshCopyHistory, deleteCopyHistoryItem, deleteAllCopyHistoryItems } = useCopyHistory(
        settings.miningHistoryStorageLimit,
        copyHistoryRepository
    );
    useEffect(() => {
        if (viewingAsbplayerId) {
            refreshCopyHistory();
        }
    }, [refreshCopyHistory, viewingAsbplayerId]);
    const [showCopyHistory, setShowCopyHistory] = useState<boolean>(false);
    const handleShowCopyHistory = useCallback(async () => {
        await refreshCopyHistory();
        setShowCopyHistory(true);
    }, [refreshCopyHistory]);
    const handleCloseCopyHistory = useCallback(() => {
        setShowCopyHistory(false);
        void clearExtensionRequestedLocation();
    }, []);
    const handleClipAudio = useCallback(
        async (item: CopyHistoryItem) => {
            if (viewingAsbplayerId) {
                if (currentTabId) {
                    const downloadAudioCommand: ExtensionToAsbPlayerCommand<DownloadAudioMessage> = {
                        sender: 'asbplayer-extension-to-player',
                        message: {
                            command: 'download-audio',
                            ...item,
                        },
                    };
                    browser.tabs.sendMessage(currentTabId, downloadAudioCommand);
                }
            } else {
                const clip = AudioClip.fromCard(item, settings.audioPaddingStart, settings.audioPaddingEnd, false);

                if (clip) {
                    if (settings.preferMp3) {
                        const worker = await mp3WorkerFactory();
                        clip.toMp3(() => worker).download();
                    } else {
                        clip.download();
                    }
                }
            }
        },
        [settings, currentTabId, viewingAsbplayerId]
    );
    const handleDownloadImage = useCallback(
        (item: CopyHistoryItem) => {
            if (viewingAsbplayerId) {
                if (currentTabId) {
                    const downloadImageCommand: ExtensionToAsbPlayerCommand<DownloadImageMessage> = {
                        sender: 'asbplayer-extension-to-player',
                        message: {
                            command: 'download-image',
                            ...item,
                        },
                    };
                    browser.tabs.sendMessage(currentTabId, downloadImageCommand);
                }
            } else {
                const image = MediaFragment.fromCard(
                    item,
                    settings.maxImageWidth,
                    settings.maxImageHeight,
                    settings.mediaFragmentFormat,
                    settings.mediaFragmentTrimStart,
                    settings.mediaFragmentTrimEnd,
                    settings.mediaFragmentMaxClipLength
                );

                if (image) {
                    image.download();
                }
            }
        },
        [settings, currentTabId, viewingAsbplayerId]
    );
    const handleJumpToSubtitle = useCallback(
        (card: CardModel) => {
            if (!currentTabId || !viewingAsbplayerId) {
                return;
            }

            const asbplayerCommand: ExtensionToAsbPlayerCommand<JumpToSubtitleMessage> = {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'jump-to-subtitle',
                    subtitle: card.subtitle,
                    subtitleFileName: card.subtitleFileName,
                },
            };
            browser.tabs.sendMessage(currentTabId, asbplayerCommand);
        },
        [currentTabId, viewingAsbplayerId]
    );
    const handleAnki = useCallback(
        (copyHistoryItem: CopyHistoryItem) => {
            if (currentTabId === undefined) {
                return;
            }

            const message: ShowAnkiUiMessage = {
                ...copyHistoryItem,
                command: 'show-anki-ui',
            };
            const videoCommand: ExtensionToVideoCommand<ShowAnkiUiMessage> = {
                sender: 'asbplayer-extension-to-video',
                message,
            };
            const asbplayerCommand: ExtensionToAsbPlayerCommand<ShowAnkiUiMessage> = {
                sender: 'asbplayer-extension-to-player',
                message,
            };
            browser.tabs.sendMessage(currentTabId, videoCommand);
            browser.tabs.sendMessage(currentTabId, asbplayerCommand);
        },
        [currentTabId]
    );

    const recordingAudioRef = useRef(recordingAudio);
    recordingAudioRef.current = recordingAudio;

    const handleMineFromSubtitlePlayer = useCallback(
        (card: CardModel) => {
            if (syncedVideoTab === undefined) {
                return;
            }

            if (recordingAudioRef.current || currentTabId !== syncedVideoTab.id) {
                return;
            }

            const message: AsbPlayerToVideoCommandV2<CopySubtitleMessage> = {
                sender: 'asbplayerv2',
                message: {
                    command: 'copy-subtitle',
                    subtitle: card.subtitle,
                    surroundingSubtitles: card.surroundingSubtitles,
                    postMineAction: settings.clickToMineDefaultAction,
                },
                tabId: syncedVideoTab.id,
                src: syncedVideoTab.src,
            };
            browser.runtime.sendMessage(message);
        },
        [syncedVideoTab, settings.clickToMineDefaultAction, currentTabId]
    );

    const handleOpenUserGuide = useCallback(() => {
        browser.tabs.create({ active: true, url: 'https://docs.asbplayer.dev/docs/intro' });
    }, []);
    const noOp = useCallback(() => {}, []);

    const { initialized: i18nInitialized } = useI18n({ language: settings.language });

    const [statisticsOpen, setStatisticsOpen] = useState<boolean>(false);
    const handleShowStatistics = useCallback(() => setStatisticsOpen(true), []);
    const handleCloseStatistics = useCallback(() => {
        setStatisticsOpen(false);
        void clearExtensionRequestedLocation();
    }, []);
    const handleOpenStatisticsOverlay = useCallback(
        (mediaId: string) => {
            if (currentTabId === undefined) {
                return;
            }
            const command: Command<OpenStatisticsOverlayMessage> = {
                sender: 'asbplayerv2',
                message: {
                    command: 'open-statistics-overlay',
                    mediaId,
                    force: true,
                },
            };
            browser.runtime.sendMessage(command);
        },
        [currentTabId]
    );
    const handleViewAnnotationSettings = useCallback(() => {
        browser.tabs.create({
            url: `${browser.runtime.getURL('/options.html')}#annotation`,
            active: true,
        });
    }, []);

    if (!i18nInitialized) {
        return null;
    }

    if (initializing || currentTabId === undefined || videoElementCount === undefined) {
        return (
            <CenteredGridContainer>
                <CenteredGridItem>
                    <CircularProgress color="primary" />
                </CenteredGridItem>
            </CenteredGridContainer>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%' }} onMouseMove={handleMouseMove}>
            <Alert open={alertOpen} onClose={handleAlertClosed} autoHideDuration={3000} severity={alertSeverity}>
                {alert}
            </Alert>
            {viewingAsbplayerId &&
                (appRequestedLocation === 'mining-history' || appRequestedLocation === undefined) && (
                    <CopyHistory
                        open={true}
                        showBackButton={false}
                        items={copyHistoryItems}
                        forceShowDownloadOptions={true}
                        onClose={noOp}
                        onDelete={deleteCopyHistoryItem}
                        onDeleteAll={deleteAllCopyHistoryItems}
                        onAnki={handleAnki}
                        onClipAudio={handleClipAudio}
                        onDownloadImage={handleDownloadImage}
                        onSelect={handleJumpToSubtitle}
                    />
                )}
            {viewingAsbplayerId && appRequestedLocation === 'statistics' && (
                <StatisticsDrawer
                    open
                    hasSubtitles={viewingAsbplayerHasSubtitles}
                    settings={settings}
                    showBackButton={false}
                    dictionaryProvider={dictionaryProvider}
                    onClose={noOp} // Cannot close when in-app
                    onViewAnnotationSettings={handleViewAnnotationSettings}
                    onOpenOverlay={handleOpenStatisticsOverlay}
                    onOpenInNewWindow={createStatisticsPopup}
                    sx={{ p: 2 }}
                />
            )}
            {!viewingAsbplayerId && (
                <>
                    <CopyHistory
                        open={showCopyHistory || extensionRequestedLocation === 'mining-history'}
                        items={copyHistoryItems}
                        onClose={handleCloseCopyHistory}
                        onDelete={deleteCopyHistoryItem}
                        onDeleteAll={deleteAllCopyHistoryItems}
                        onAnki={handleAnki}
                        onClipAudio={handleClipAudio}
                        onDownloadImage={handleDownloadImage}
                    />
                    {subtitles === undefined ? (
                        <SidePanelHome
                            extension={extension}
                            videoElementCount={videoElementCount}
                            miningHistoryCount={copyHistoryItems.length}
                            onLoadSubtitles={handleLoadSubtitles}
                            onShowMiningHistory={handleShowCopyHistory}
                            onOpenUserGuide={handleOpenUserGuide}
                        />
                    ) : (
                        <>
                            <SidePanelRecordingOverlay show={recordingAudio} />
                            <Player
                                origin={browser.runtime.getURL('/sidepanel.html')}
                                subtitles={subtitles}
                                hideControls={true}
                                showCopyButton={true}
                                forceCompressedMode={true}
                                subtitleReader={subtitleReader}
                                dictionaryProvider={dictionaryProvider}
                                settingsProvider={settingsProvider}
                                settings={settings}
                                playbackPreferences={playbackPreferences}
                                onCopy={handleMineFromSubtitlePlayer}
                                onError={handleError}
                                onUnloadVideo={noOp}
                                onLoaded={noOp}
                                onTabSelected={noOp}
                                onAnkiDialogRequest={noOp}
                                onAnkiDialogRewind={noOp}
                                onAppBarToggle={noOp}
                                onHideSubtitlePlayer={noOp}
                                onVideoPopOut={noOp}
                                onPlayModeChangedViaBind={noOp}
                                onSubtitles={setSubtitles}
                                tab={syncedVideoTab}
                                availableTabs={emptyArray}
                                extension={extension}
                                drawerOpen={false}
                                appBarHidden={true}
                                videoFullscreen={false}
                                hideSubtitlePlayer={false}
                                videoPopOut={false}
                                disableKeyEvents={false}
                                miningContext={miningContext}
                                keyBinder={keyBinder}
                            />
                            <StatisticsDrawer
                                open={statisticsOpen || extensionRequestedLocation === 'statistics'}
                                settings={settings}
                                showBackButton
                                hasSubtitles={subtitles !== undefined && subtitles.length > 0}
                                dictionaryProvider={dictionaryProvider}
                                onClose={handleCloseStatistics}
                                onMineWasRequested={uiTabRegistry.focusTabForMediaId}
                                onViewAnnotationSettings={handleViewAnnotationSettings}
                                onOpenOverlay={handleOpenStatisticsOverlay}
                                onOpenInNewWindow={createStatisticsPopup}
                                sx={{ p: 2 }}
                            />
                            <SidePanelTopControls
                                ref={topControlsRef}
                                show={showTopControls}
                                onLoadSubtitles={handleLoadSubtitles}
                                canDownloadSubtitles={canDownloadSubtitles}
                                onDownloadSubtitles={handleDownloadSubtitles}
                                onBulkExportSubtitles={handleBulkExportSubtitles}
                                disableBulkExport={recordingAudio}
                                onShowMiningHistory={handleShowCopyHistory}
                                miningHistoryCount={copyHistoryItems.length}
                                onShowStatistics={handleShowStatistics}
                            />
                            <SidePanelBottomControls
                                disabled={currentTabId !== syncedVideoTab?.id}
                                onMineSubtitle={handleMineSubtitle}
                                postMineAction={settings.clickToMineDefaultAction}
                                emptySubtitleTrack={subtitles.length === 0}
                                audioRecordingEnabled={settings.streamingRecordMedia}
                                recordingAudio={recordingAudio}
                            />
                        </>
                    )}
                </>
            )}

            {/* Bulk Export Modal - rendered outside the main content to ensure it's always on top */}
            <BulkExportModal
                open={bulkOpen}
                currentIndex={bulkCurrent}
                totalItems={bulkTotal}
                onCancel={handleBulkExportCancel}
            />
        </div>
    );
}
