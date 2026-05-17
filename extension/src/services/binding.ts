import {
    AckMessage,
    AnkiUiSavedState,
    AudioBase64Message,
    AutoPausePreference,
    CardExportedMessage,
    CardSavedMessage,
    CardUpdatedMessage,
    CopySubtitleMessage,
    cropAndResize,
    CurrentTimeFromVideoMessage,
    CurrentTimeToVideoMessage,
    EncodeMp3InServiceWorkerMessage,
    ExtensionSyncMessage,
    ImageCaptureParams,
    NotificationDialogMessage,
    NotifyErrorMessage,
    OffsetToVideoMessage,
    PauseFromVideoMessage,
    PlaybackRateFromVideoMessage,
    PlaybackRateToVideoMessage,
    PlayFromVideoMessage,
    PlayMode,
    PostMineAction,
    PostMinePlayback,
    ReadyFromVideoMessage,
    ReadyStateFromVideoMessage,
    RecordMediaAndForwardSubtitleMessage,
    RequestingActiveTabPermsisionMessage,
    RerecordMediaMessage,
    ScreenshotTakenMessage,
    ShowAnkiUiAfterRerecordMessage,
    ShowAnkiUiMessage,
    StartRecordingAudioViaCaptureStreamMessage,
    StartRecordingAudioWithTimeoutViaCaptureStreamMessage,
    StartRecordingErrorCode,
    StartRecordingMediaMessage,
    StartRecordingResponse,
    StopRecordingAudioMessage,
    StopRecordingErrorCode,
    StopRecordingMediaMessage,
    StopRecordingResponse,
    SubtitleModel,
    SubtitlesToVideoMessage,
    TakeScreenshotFromExtensionMessage,
    VideoDataUiOpenReason,
    VideoDisappearedMessage,
    VideoHeartbeatMessage,
    VideoToExtensionCommand,
    IndexedSubtitleModel,
    SaveTokenLocalMessage,
    DictionaryBuildAnkiCacheStateMessage,
    DictionaryBuildWaniKaniCacheStateMessage,
} from '@project/common';
import { adjacentSubtitle } from '@project/common/key-binder';
import PlayModeManager from '@project/common/app/services/play-mode-manager';
import {
    AutoCopyableTracks,
    calculateAutoCopyableTracksValue,
    calculateSeekableTracksValue,
    extractAnkiSettings,
    isTrackSeekable,
    PauseOnHoverMode,
    SeekableTracks,
    SettingsProvider,
    SubtitleListPreference,
} from '@project/common/settings';
import { SubtitleSlice } from '@project/common/subtitle-collection';
import { SubtitleReader } from '@project/common/subtitle-reader';
import {
    extractText,
    seekWithNudge,
    sourceString,
    subtitleTimestampWithDelay,
    surroundingSubtitlesAroundInterval,
} from '@project/common/util';
import AnkiUiController from '../controllers/anki-ui-controller';
import ControlsController from '../controllers/controls-controller';
import DragController from '../controllers/drag-controller';
import { MobileGestureController } from '../controllers/mobile-gesture-controller';
import { MobileVideoOverlayController } from '../controllers/mobile-video-overlay-controller';
import NotificationController from '../controllers/notification-controller';
import SubtitleController from '../controllers/subtitle-controller';
import BulkExportController from '../controllers/bulk-export-controller';
import VideoDataSyncController from '../controllers/video-data-sync-controller';
import AudioRecorder, { TimedRecordingInProgressError } from './audio-recorder';
import { isMobile } from '@project/common/device-detection/mobile';
import { OffsetAnchor } from './element-overlay';
import { ExtensionSettingsStorage } from './extension-settings-storage';
import { i18nInit } from './i18n';
import KeyBindings from './key-bindings';
import { shouldShowUpdateAlert } from './update-alert';
import { bufferToBase64 } from '@project/common/base64';
import { pgsParserWorkerFactory } from './pgs-parser-worker-factory';
import { DictionaryProvider } from '@project/common/dictionary-db/dictionary-provider';
import { ExtensionDictionaryStorage } from './extension-dictionary-storage';
import { HoveredToken } from '@project/common/subtitle-annotations';

let netflix = false;
document.addEventListener('asbplayer-netflix-enabled', (e) => {
    netflix = (e as CustomEvent).detail;
});
document.dispatchEvent(new CustomEvent('asbplayer-query-netflix'));

const youtube = /(m|www)\.youtube\.com/.test(window.location.host);

enum RecordingState {
    requested,
    started,
    notRecording,
}

const startAudioRecordingErrorResponse: (e: any) => StartRecordingResponse = (e: any) => {
    let errorCode: StartRecordingErrorCode;

    if (e.name === 'NS_ERROR_FAILURE') {
        errorCode = StartRecordingErrorCode.drmProtected;
    } else {
        console.error(e);
        errorCode = StartRecordingErrorCode.other;
    }

    const errorResponse: StartRecordingResponse = {
        started: false,
        error: { code: errorCode, message: e.message },
    };
    return errorResponse;
};

export default class Binding {
    subscribed: boolean = false;

    ankiUiSavedState?: AnkiUiSavedState;
    alwaysPlayOnSubtitleRepeat: boolean;

    private _synced: boolean;
    private _syncedTimestamp?: number;

    recordingState: RecordingState = RecordingState.notRecording;
    recordingPostMineAction?: PostMineAction;
    wasPlayingBeforeRecordingMedia?: boolean;
    postMinePlayback: PostMinePlayback = PostMinePlayback.remember;
    seekableTracks: SeekableTracks = calculateSeekableTracksValue([0]);
    private recordingMediaStartedTimestamp?: number;
    private recordingMediaWithScreenshot: boolean;
    private pausedDueToHover = false;
    private _playModes: Set<PlayMode> = new Set([PlayMode.normal]);
    private _seekDuration = 3;
    private _speedChangeStep = 0.1;
    private _pendingAutoRepeatTargetTimestamp = 0;

    private _resetPendingAutoRepeatTargetTimestamp() {
        this._pendingAutoRepeatTargetTimestamp = 0;
    }

    readonly video: HTMLMediaElement;
    readonly hasPageScript: boolean;
    readonly subtitleController: SubtitleController;
    readonly videoDataSyncController: VideoDataSyncController;
    readonly controlsController: ControlsController;
    readonly dragController: DragController;
    readonly ankiUiController: AnkiUiController;
    readonly notificationController: NotificationController;
    readonly mobileVideoOverlayController: MobileVideoOverlayController;
    readonly mobileGestureController: MobileGestureController;
    readonly keyBindings: KeyBindings;
    readonly dictionary: DictionaryProvider;
    readonly settings: SettingsProvider;
    private readonly _audioRecorder = new AudioRecorder();
    readonly bulkExportController: BulkExportController;

    private copyToClipboardOnMine: boolean;
    private clickToMineDefaultAction: PostMineAction;
    private takeScreenshot: boolean;
    private cleanScreenshot: boolean;
    private audioPaddingStart: number;
    private audioPaddingEnd: number;
    private maxImageWidth: number;
    private maxImageHeight: number;
    private autoPausePreference: AutoPausePreference;
    private condensedPlaybackMinimumSkipIntervalMs = 1000;
    private fastForwardPlaybackMinimumGapMs = 600;
    private fastForwardModePlaybackRate = 2.7;
    private imageDelay = 0;
    private pauseOnHoverMode: PauseOnHoverMode = PauseOnHoverMode.disabled;
    hoveredToken: HoveredToken;
    recordMedia: boolean;

    private playListener?: EventListener;
    private pauseListener?: EventListener;
    private seekedListener?: EventListener;
    private playbackRateListener?: EventListener;
    private videoChangeListener?: EventListener;
    private canPlayListener?: EventListener;
    private mouseMoveListener?: (event: MouseEvent) => void;
    private listener?: (
        message: any,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;
    private heartbeatInterval?: NodeJS.Timeout;
    private registeredVideoSrc?: string;

    // In the case of firefox, we need to avoid capturing the audio stream more than once,
    // so we keep a reference to the first one we capture here.
    private audioStream?: MediaStream;
    private audioContext?: AudioContext;
    private audioVolumeChangeListener?: () => void;
    private currentAudioRecordingRequestId?: string;
    private unsubscribeStatisticsSeek?: () => void;
    private unsubscribeStatisticsSubtitleMine?: () => void;

    private readonly frameId?: string;

    constructor(video: HTMLMediaElement, hasPageScript: boolean, frameId?: string) {
        this.video = video;
        this.hasPageScript = hasPageScript;
        this.dictionary = new DictionaryProvider(new ExtensionDictionaryStorage());
        this.settings = new SettingsProvider(new ExtensionSettingsStorage());
        this.subtitleController = new SubtitleController(video, this.dictionary, this.settings);
        this.videoDataSyncController = new VideoDataSyncController(this, this.settings);
        this.controlsController = new ControlsController(video);
        this.dragController = new DragController(video);
        this.keyBindings = new KeyBindings();
        this.ankiUiController = new AnkiUiController();
        this.notificationController = new NotificationController(this);
        this.mobileVideoOverlayController = new MobileVideoOverlayController(this, OffsetAnchor.top);
        this.subtitleController.onOffsetChange = () => this.mobileVideoOverlayController.updateModel();
        this.mobileGestureController = new MobileGestureController(this);
        this.bulkExportController = new BulkExportController(this);
        this.hoveredToken = new HoveredToken();
        this.recordMedia = true;
        this.takeScreenshot = true;
        this.cleanScreenshot = true;
        this.clickToMineDefaultAction = PostMineAction.showAnkiDialog;
        this.audioPaddingStart = 0;
        this.audioPaddingEnd = 500;
        this.maxImageWidth = 0;
        this.maxImageHeight = 0;
        this.autoPausePreference = AutoPausePreference.atEnd;
        this.copyToClipboardOnMine = false;
        this.alwaysPlayOnSubtitleRepeat = true;
        this.postMinePlayback = PostMinePlayback.remember;
        this._synced = false;
        this.recordingMediaWithScreenshot = false;
        this.registeredVideoSrc = video.src || undefined;
        this.frameId = frameId;
    }

    get recordingMedia() {
        return this.recordingState !== RecordingState.notRecording;
    }

    get synced() {
        return this._synced;
    }

    get speedChangeStep() {
        return this._speedChangeStep;
    }

    get seekDuration() {
        return this._seekDuration;
    }

    get playModes() {
        return this._playModes;
    }

    togglePlayMode(targetMode: PlayMode) {
        const manager = new PlayModeManager(this._playModes);
        const newModes = manager.toggle(targetMode);
        const { added, removed } = PlayModeManager.getModeChanges(this._playModes, newModes);

        for (const mode of removed) {
            const showNotif = mode === targetMode && targetMode !== PlayMode.normal;
            this._disablePlayMode(mode, newModes, showNotif);
        }

        for (const mode of added) {
            this._enablePlayMode(mode);
        }

        this._playModes = newModes;
        this.mobileVideoOverlayController.updateModel();
    }

    private _disablePlayMode(mode: PlayMode, newModes: Set<PlayMode>, showNotif: boolean) {
        switch (mode) {
            case PlayMode.autoPause:
                this.subtitleController.autoPauseContext.onStartedShowing = undefined;
                if (newModes.has(PlayMode.repeat)) {
                    this.subtitleController.autoPauseContext.onWillStopShowing = (subtitle) => {
                        if (!isTrackSeekable(this.seekableTracks, subtitle.track)) {
                            return;
                        }
                        this._resetPendingAutoRepeatTargetTimestamp();
                        this.seek(subtitle.start / 1000);
                    };
                } else {
                    this.subtitleController.autoPauseContext.onWillStopShowing = undefined;
                }

                if (showNotif) this.subtitleController.notification('info.disabledAutoPause');
                break;
            case PlayMode.condensed:
                this.subtitleController.onNextSeekableToShow = undefined;

                if (showNotif) this.subtitleController.notification('info.disabledCondensedPlayback');
                break;
            case PlayMode.fastForward:
                this.subtitleController.onSeekableSlice = undefined;
                this.video.playbackRate = 1;

                if (showNotif) this.subtitleController.notification('info.disabledFastForwardPlayback');
                break;
            case PlayMode.repeat:
                if (newModes.has(PlayMode.autoPause)) {
                    this.subtitleController.autoPauseContext.onWillStopShowing = () => {
                        if (this.recordingMedia || this.autoPausePreference !== AutoPausePreference.atEnd) {
                            return;
                        }

                        this.pause();
                    };
                } else {
                    this.subtitleController.autoPauseContext.onWillStopShowing = undefined;
                }

                if (showNotif) this.subtitleController.notification('info.disabledRepeatPlayback');
                break;
        }
    }

    private _enablePlayMode(mode: PlayMode) {
        switch (mode) {
            case PlayMode.autoPause:
                this.subtitleController.autoPauseContext.onStartedShowing = (subtitle) => {
                    if (
                        this.recordingMedia ||
                        this.autoPausePreference !== AutoPausePreference.atStart ||
                        !isTrackSeekable(this.seekableTracks, subtitle.track)
                    ) {
                        return;
                    }

                    this.pause();
                };
                this.subtitleController.autoPauseContext.onWillStopShowing = (subtitle) => {
                    if (!isTrackSeekable(this.seekableTracks, subtitle.track)) {
                        return;
                    }

                    const shouldRepeat = this._playModes.has(PlayMode.repeat);

                    if (this.autoPausePreference === AutoPausePreference.atEnd) {
                        if (!this.recordingMedia) {
                            this.pause();
                        }

                        this._resetPendingAutoRepeatTargetTimestamp();
                        if (shouldRepeat) {
                            this._pendingAutoRepeatTargetTimestamp = subtitle.start / 1000;
                        }
                    } else if (shouldRepeat) {
                        this.seek(subtitle.start / 1000);
                    }
                };
                this.subtitleController.notification('info.enabledAutoPause');
                break;
            case PlayMode.condensed:
                let seeking = false;
                this.subtitleController.onNextSeekableToShow = async (subtitle) => {
                    try {
                        if (
                            this.recordingMedia ||
                            seeking ||
                            !isTrackSeekable(this.seekableTracks, subtitle.track) ||
                            this.video.paused ||
                            subtitle.start - this.video.currentTime * 1000 <=
                                this.condensedPlaybackMinimumSkipIntervalMs
                        ) {
                            return;
                        }

                        seeking = true;
                        this.seek(subtitle.start / 1000);
                        await this.play();
                        seeking = false;
                    } finally {
                        seeking = false;
                    }
                };
                this.subtitleController.notification('info.enabledCondensedPlayback');
                break;
            case PlayMode.fastForward:
                this.subtitleController.onSeekableSlice = async (slice: SubtitleSlice<IndexedSubtitleModel>) => {
                    const subtitlesAreSufficientlyOffsetFromNow = (subtitleEdgeTime: number | undefined) => {
                        return (
                            subtitleEdgeTime &&
                            Math.abs(subtitleEdgeTime - this.video.currentTime * 1000) >
                                this.fastForwardPlaybackMinimumGapMs
                        );
                    };
                    if (
                        slice.showing.length === 0 &&
                        // Find latest ending subtitle among the shown last ones
                        subtitlesAreSufficientlyOffsetFromNow(
                            Math.max.apply(
                                undefined,
                                (slice?.lastShown || []).map((e) => e.end)
                            )
                        ) &&
                        // Find earliest starting subtitle among the next ones to be shown
                        subtitlesAreSufficientlyOffsetFromNow(
                            Math.min.apply(
                                undefined,
                                (slice?.nextToShow || []).map((e) => e.start)
                            )
                        )
                    ) {
                        this.video.playbackRate = this.fastForwardModePlaybackRate;
                    } else {
                        this.video.playbackRate = 1;
                    }
                };
                this.subtitleController.notification('info.enabledFastForwardPlayback');
                break;
            case PlayMode.repeat:
                this.subtitleController.autoPauseContext.onWillStopShowing = (subtitle) => {
                    if (!isTrackSeekable(this.seekableTracks, subtitle.track)) {
                        return;
                    }

                    const shouldAutoPause =
                        this._playModes.has(PlayMode.autoPause) &&
                        this.autoPausePreference === AutoPausePreference.atEnd &&
                        !this.recordingMedia;

                    this._resetPendingAutoRepeatTargetTimestamp();

                    if (shouldAutoPause) {
                        this.pause();
                        this._pendingAutoRepeatTargetTimestamp = subtitle.start / 1000;
                    } else {
                        this.seek(subtitle.start / 1000);
                    }
                };

                this.subtitleController.notification('info.enabledRepeatPlayback');
                break;
            case PlayMode.normal:
                this.subtitleController.notification('info.disabledAllPlayModes');
                break;
            default:
                console.error('Unknown play mode ' + mode);
        }
    }

    subtitleFileName(track: number = 0) {
        return this.subtitleController.subtitleFileNames?.[track] ?? '';
    }

    private get _imageCaptureParams(): ImageCaptureParams {
        const rect = this.video.getBoundingClientRect();

        return {
            maxWidth: this.maxImageWidth,
            maxHeight: this.maxImageHeight,
            rect: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            },
            frameId: this.frameId,
        };
    }

    private get _shouldAutoResumeOnSubtitlesMouseOut() {
        return this.pauseOnHoverMode === PauseOnHoverMode.inAndOut && this.pausedDueToHover && this.video.paused;
    }

    bind() {
        let bound = false;

        if (this.video.readyState === 4) {
            this._bind();
            bound = true;
        } else {
            this.canPlayListener = (event) => {
                if (!bound) {
                    this._bind();
                    bound = true;
                }

                const command: VideoToExtensionCommand<ReadyStateFromVideoMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'readyState',
                        value: 4,
                    },
                    src: this.video.src,
                };

                browser.runtime.sendMessage(command);
            };
            this.video.addEventListener('canplay', this.canPlayListener);
        }
    }

    _bind() {
        this._notifyReady();
        this._subscribe();
        this._refreshSettings().then(() => {
            this.videoDataSyncController.requestSubtitles();
        });
        this.subtitleController.bind();
        this.dragController.bind(this);
        this.mobileGestureController.bind();
        this.bulkExportController.bind();

        const seek = (forward: boolean) => {
            const subtitle = adjacentSubtitle(
                forward,
                this.video.currentTime * 1000,
                this.subtitleController.subtitles,
                this.seekableTracks
            );

            if (subtitle !== null) {
                this.seek(subtitle.start / 1000);
            }
        };

        this.mobileGestureController.onSwipeLeft = () => seek(false);
        this.mobileGestureController.onSwipeRight = () => seek(true);
    }

    _notifyReady() {
        const command: VideoToExtensionCommand<ReadyFromVideoMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'ready',
                duration: this.video.duration,
                currentTime: this.video.currentTime,
                paused: this.video.paused,
                audioTracks: undefined,
                selectedAudioTrack: undefined,
                playbackRate: this.video.playbackRate,
            },
            src: this.video.src,
        };

        browser.runtime.sendMessage(command);
    }

    _subscribe() {
        this.playListener = (event) => {
            const command: VideoToExtensionCommand<PlayFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'play',
                    echo: false,
                },
                src: this.video.src,
            };

            browser.runtime.sendMessage(command);
            this.pausedDueToHover = false;

            if (this._playModes.has(PlayMode.repeat) && this._pendingAutoRepeatTargetTimestamp > 0) {
                this.seek(this._pendingAutoRepeatTargetTimestamp);
                this._resetPendingAutoRepeatTargetTimestamp();
            }
        };

        this.pauseListener = (event) => {
            const command: VideoToExtensionCommand<PauseFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'pause',
                    echo: false,
                },
                src: this.video.src,
            };

            browser.runtime.sendMessage(command);

            if (this.recordingMedia && this.recordingPostMineAction !== undefined) {
                this._toggleRecordingMedia(this.recordingPostMineAction);
            }
        };

        this.seekedListener = (event) => {
            this._resetPendingAutoRepeatTargetTimestamp();

            const currentTimeCommand: VideoToExtensionCommand<CurrentTimeFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'currentTime',
                    value: this.video.currentTime,
                    echo: false,
                },
                src: this.video.src,
            };
            const readyStateCommand: VideoToExtensionCommand<ReadyStateFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'readyState',
                    value: this.video.readyState,
                },
                src: this.video.src,
            };

            browser.runtime.sendMessage(currentTimeCommand);
            browser.runtime.sendMessage(readyStateCommand);

            this.subtitleController.autoPauseContext.clear();
        };

        this.playbackRateListener = (event) => {
            const command: VideoToExtensionCommand<PlaybackRateFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'playbackRate',
                    value: this.video.playbackRate,
                    echo: false,
                },
                src: this.video.src,
            };

            browser.runtime.sendMessage(command);

            if (this._synced && !this._playModes.has(PlayMode.fastForward)) {
                this.subtitleController.notification('info.playbackRate', {
                    rate: this.video.playbackRate.toFixed(1),
                });
            }
            this.mobileVideoOverlayController.updateModel();
        };

        this.video.addEventListener('play', this.playListener);
        this.video.addEventListener('pause', this.pauseListener);
        this.video.addEventListener('seeked', this.seekedListener);
        this.video.addEventListener('ratechange', this.playbackRateListener);

        this.subtitleController.onMouseOver = (mouseEvent: MouseEvent) => {
            if (this.pauseOnHoverMode !== PauseOnHoverMode.disabled && !this.video.paused) {
                this.video.pause();
                this.pausedDueToHover = true;

                if (this.mouseMoveListener) {
                    document.removeEventListener('mousemove', this.mouseMoveListener);
                    this.mouseMoveListener = undefined;
                }

                this.mouseMoveListener = (e: MouseEvent) => {
                    if (
                        this._shouldAutoResumeOnSubtitlesMouseOut &&
                        !this.subtitleController.intersects(e.clientX, e.clientY)
                    ) {
                        this.play();
                        this.pausedDueToHover = false;
                    }
                };

                document.addEventListener('mousemove', this.mouseMoveListener);
            }
            this.hoveredToken.handleMouseOver(mouseEvent);
        };
        this.subtitleController.onMouseOut = (mouseEvent: MouseEvent) => this.hoveredToken.handleMouseOut(mouseEvent);

        if (this.hasPageScript) {
            this.videoChangeListener = () => {
                this._updateRegisteredVideoSrc(this.video.src || undefined);
                this.videoDataSyncController.requestSubtitles();
                this._resetSubtitles();
            };
            this.video.addEventListener('loadedmetadata', this.videoChangeListener);
        }

        this.heartbeatInterval = setInterval(() => {
            const src = this.video.src || undefined;
            this._updateRegisteredVideoSrc(src);
            if (!src) return;

            const command: VideoToExtensionCommand<VideoHeartbeatMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'heartbeat',
                    subscribed: this.subscribed,
                    synced: this._synced,
                    syncedTimestamp: this._syncedTimestamp,
                    loadedSubtitles: this.subtitleController.subtitles.length > 0,
                },
                src,
            };

            browser.runtime.sendMessage(command);
        }, 1000);

        window.addEventListener('beforeunload', (event) => {
            this.heartbeatInterval && clearInterval(this.heartbeatInterval);
        });

        this.listener = (
            request: any,
            sender: Browser.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (request.sender === 'asbplayer-extension-to-video' && request.src === this.video.src) {
                switch (request.message.command) {
                    case 'init':
                        this._notifyReady();
                        break;
                    case 'ready':
                        // ignore
                        break;
                    case 'play':
                        this.play();
                        break;
                    case 'pause':
                        this.pause();
                        break;
                    case 'currentTime':
                        const currentTimeMessage = request.message as CurrentTimeToVideoMessage;
                        this.seek(currentTimeMessage.value);
                        break;
                    case 'close':
                        // ignore
                        break;
                    case 'subtitles': {
                        const subtitlesMessage = request.message as SubtitlesToVideoMessage;
                        const subtitles: SubtitleModel[] = subtitlesMessage.value;
                        this._updateSubtitles(
                            subtitles.map((s, index) => ({ ...s, index })),
                            subtitlesMessage.names || [subtitlesMessage.name]
                        );
                        break;
                    }
                    case 'request-subtitles': {
                        sendResponse({
                            subtitles: this.subtitleController.subtitles,
                            subtitleFileNames: this.subtitleController.subtitleFileNames ?? [],
                        });
                        break;
                    }
                    // This is useful because when we kick off bulk export the side panel needs to know
                    // what subtitle to start from.
                    case 'request-current-subtitle':
                        const [currentSubtitle] = this.subtitleController.currentSubtitle();
                        sendResponse({
                            currentSubtitle: currentSubtitle,
                            currentSubtitleIndex: currentSubtitle?.index ?? null,
                        });
                        break;
                    case 'start-bulk-export':
                        this.bulkExportController.start();
                        break;
                    case 'cancel-bulk-export':
                        this.bulkExportController.cancel();
                        break;
                    case 'offset':
                        const offsetMessage = request.message as OffsetToVideoMessage;
                        this.subtitleController.offset(offsetMessage.value, !offsetMessage.echo);
                        break;
                    case 'playbackRate':
                        const playbackRateMessage = request.message as PlaybackRateToVideoMessage;
                        this.video.playbackRate = playbackRateMessage.value;
                        break;
                    case 'subtitleSettings':
                        // ignore
                        break;
                    case 'ankiSettings':
                        // ignore
                        break;
                    case 'miscSettings':
                        // ignore
                        break;
                    case 'settings-updated':
                        this._refreshSettings();
                        break;
                    case 'copy-subtitle':
                        const copySubtitleMessage = request.message as CopySubtitleMessage;

                        if (this._synced) {
                            if (
                                copySubtitleMessage.subtitle !== undefined &&
                                copySubtitleMessage.surroundingSubtitles !== undefined
                            ) {
                                this._copySubtitle(copySubtitleMessage);
                            } else if (this.subtitleController.subtitles.length > 0) {
                                const [subtitle, surroundingSubtitles] = this.subtitleController.currentSubtitle();
                                if (subtitle !== null && surroundingSubtitles !== null) {
                                    this._copySubtitle({ ...copySubtitleMessage, subtitle, surroundingSubtitles });
                                }
                            } else {
                                this._toggleRecordingMedia(copySubtitleMessage.postMineAction);
                            }

                            this.mobileVideoOverlayController.updateModel();
                        }
                        break;
                    case 'toggle-recording':
                        if (this._synced) {
                            this._toggleRecordingMedia(PostMineAction.showAnkiDialog);
                            this.mobileVideoOverlayController.updateModel();
                        }
                        break;
                    case 'card-updated':
                    case 'card-exported':
                    case 'card-saved':
                        const cardMessage = request.message as
                            | CardUpdatedMessage
                            | CardExportedMessage
                            | CardSavedMessage;
                        let locKey: string;
                        switch (cardMessage.command) {
                            case 'card-updated':
                                locKey = 'info.updatedCard';
                                this.subtitleController.subtitleAnnotations.ankiCardWasModified();
                                break;
                            case 'card-exported':
                                locKey = 'info.exportedCard';
                                this.subtitleController.subtitleAnnotations.ankiCardWasModified();
                                break;
                            case 'card-saved':
                                locKey = 'info.copiedSubtitle2';
                                break;
                        }
                        this.subtitleController.notification(locKey, { result: request.message.cardName });
                        this.ankiUiSavedState = {
                            ...cardMessage,
                            text: cardMessage.text ?? '',
                            definition: cardMessage.definition ?? '',
                            word: cardMessage.word ?? cardMessage.cardName,
                            source: sourceString(this.subtitleFileName(), cardMessage.subtitle.start),
                            url: cardMessage.url ?? '',
                            customFieldValues: cardMessage.customFieldValues ?? {},
                            timestampInterval: [cardMessage.subtitle.start, cardMessage.subtitle.end],
                            initialTimestampInterval: [cardMessage.subtitle.start, cardMessage.subtitle.end],
                            lastAppliedTimestampIntervalToText: [cardMessage.subtitle.start, cardMessage.subtitle.end],
                            lastAppliedTimestampIntervalToAudio: [cardMessage.subtitle.start, cardMessage.subtitle.end],
                            dialogRequestedTimestamp: this.video.currentTime * 1000,
                        };
                        this.mobileVideoOverlayController.updateModel();
                        break;
                    case 'card-updated-dialog':
                    case 'card-exported-dialog':
                        this.subtitleController.subtitleAnnotations.ankiCardWasModified();
                        break;
                    case 'save-token-local':
                        const { track, token, status, states, applyStates } = request.message as SaveTokenLocalMessage;
                        this.subtitleController.subtitleAnnotations.saveTokenLocal(
                            track,
                            token,
                            status,
                            states,
                            applyStates
                        );
                        break;
                    case 'dictionary-build-anki-cache-state':
                        const state = request.message as DictionaryBuildAnkiCacheStateMessage;
                        this.subtitleController.subtitleAnnotations.buildAnkiCacheStateChange(state);
                        break;
                    case 'dictionary-build-wanikani-cache-state': {
                        const state = request.message as DictionaryBuildWaniKaniCacheStateMessage;
                        this.subtitleController.subtitleAnnotations.buildWaniKaniCacheStateChange(state);
                        break;
                    }
                    case 'notify-error':
                        const notifyErrorMessage = request.message as NotifyErrorMessage;
                        this.subtitleController.notification('info.error', { message: notifyErrorMessage.message });
                        break;
                    case 'recording-started':
                        this.recordingState = RecordingState.started;
                        break;
                    case 'recording-finished':
                        this.recordingState = RecordingState.notRecording;
                        this.recordingMediaStartedTimestamp = undefined;

                        switch (this.postMinePlayback) {
                            case PostMinePlayback.remember:
                                if (!this.wasPlayingBeforeRecordingMedia) {
                                    this.video.pause();
                                } else if (!this.video.paused) {
                                    this.mobileVideoOverlayController.hide();
                                }
                                break;
                            case PostMinePlayback.play:
                                // already playing, don't need to do anything
                                this.mobileVideoOverlayController.hide();
                                break;
                            case PostMinePlayback.pause:
                                this.video.pause();
                                break;
                        }
                        break;
                    case 'show-anki-ui':
                        const showAnkiUiMessage = request.message as ShowAnkiUiMessage;
                        this.ankiUiController.show(this, showAnkiUiMessage);
                        break;
                    case 'show-anki-ui-after-rerecord':
                        const showAnkiUiAfterRerecordMessage = request.message as ShowAnkiUiAfterRerecordMessage;
                        this.ankiUiController.showAfterRerecord(this, showAnkiUiAfterRerecordMessage.uiState);
                        break;
                    case 'take-screenshot':
                        if (this._synced) {
                            if (this.ankiUiController.showing) {
                                this.ankiUiController.requestRewind(this);
                            } else {
                                this._takeScreenshot();
                            }
                        }
                        break;
                    case 'screenshot-taken':
                        const screenshotTakenMessage = request.message as ScreenshotTakenMessage;
                        this.subtitleController.forceHideSubtitles = false;
                        this.mobileVideoOverlayController.forceHide = false;
                        this.controlsController.show();

                        if (!this.recordingMedia && screenshotTakenMessage.ankiUiState) {
                            this.ankiUiController.showAfterRetakingScreenshot(this, screenshotTakenMessage.ankiUiState);
                        }
                        break;
                    case 'alert':
                        // ignore
                        break;
                    case 'request-active-tab-permission':
                        this.notificationController.onClose = () => {
                            this._notifyRequestingActiveTabPermission(false);
                        };
                        this.notificationController.show(
                            'activeTabPermissionRequest.title',
                            'activeTabPermissionRequest.prompt'
                        );
                        this._notifyRequestingActiveTabPermission(true);
                        break;
                    case 'granted-active-tab-permission':
                        if (this.notificationController.showing) {
                            this.notificationController.show(
                                'activeTabPermissionRequest.grantedTitle',
                                'activeTabPermissionRequest.grantedPrompt'
                            );
                        }
                        break;
                    case 'load-subtitles':
                        this.showVideoDataDialog(false);
                        break;
                    case 'start-recording-audio-with-timeout':
                        const startRecordingAudioWithTimeoutMessage =
                            request.message as StartRecordingAudioWithTimeoutViaCaptureStreamMessage;

                        this._captureStream()
                            .then((stream) =>
                                this._audioRecorder
                                    .stopSafely(true)
                                    .then(() =>
                                        this._audioRecorder.startWithTimeout(
                                            stream,
                                            startRecordingAudioWithTimeoutMessage.timeout,
                                            () => sendResponse({ started: true }),
                                            true
                                        )
                                    )
                            )
                            .then((audioBase64) =>
                                this._sendAudioBase64(
                                    audioBase64,
                                    startRecordingAudioWithTimeoutMessage.requestId,
                                    startRecordingAudioWithTimeoutMessage.encodeAsMp3
                                )
                            )
                            .catch((e) => {
                                sendResponse(startAudioRecordingErrorResponse(e));
                            });
                        return true;
                    case 'start-recording-audio':
                        this.currentAudioRecordingRequestId = (
                            request.message as StartRecordingAudioViaCaptureStreamMessage
                        ).requestId;
                        this._captureStream()
                            .then((stream) =>
                                this._audioRecorder.stopSafely(true).then(() => this._audioRecorder.start(stream, true))
                            )
                            .then(() => sendResponse({ started: true }))
                            .catch((e) => {
                                sendResponse(startAudioRecordingErrorResponse(e));
                            });
                        return true;
                    case 'stop-recording-audio':
                        const stopRecordingAudioMessage = request.message as StopRecordingAudioMessage;
                        this._audioRecorder
                            .stop(true)
                            .then((audioBase64) => {
                                sendResponse({ stopped: true });
                                this._sendAudioBase64(
                                    audioBase64,
                                    this.currentAudioRecordingRequestId!,
                                    stopRecordingAudioMessage.encodeAsMp3
                                );
                            })
                            .catch((e) => {
                                let errorCode: StopRecordingErrorCode;

                                if (e instanceof TimedRecordingInProgressError) {
                                    errorCode = StopRecordingErrorCode.timedAudioRecordingInProgress;
                                } else {
                                    console.error(e);
                                    errorCode = StopRecordingErrorCode.other;
                                }

                                const errorResponse: StopRecordingResponse = {
                                    stopped: false,
                                    error: {
                                        code: errorCode,
                                        message: e.message,
                                    },
                                };
                                sendResponse(errorResponse);
                            });
                        return true;
                    case 'notification-dialog':
                        const notificationDialogMessage = request.message as NotificationDialogMessage;
                        this.notificationController.show(
                            notificationDialogMessage.titleLocKey,
                            notificationDialogMessage.messageLocKey
                        );
                        break;
                }

                if ('messageId' in request.message) {
                    const ackCommand: VideoToExtensionCommand<AckMessage> = {
                        sender: 'asbplayer-video',
                        message: {
                            command: 'ack-message',
                            messageId: request.message['messageId'],
                        },
                        src: this.video.src,
                    };
                    browser.runtime.sendMessage(ackCommand);
                }
            }
        };

        browser.runtime.onMessage.addListener(this.listener);
        this.unsubscribeStatisticsSeek = this.dictionary.onRequestStatisticsSeek((timestamp) => {
            this.seek(timestamp / 1000);
        });
        this.unsubscribeStatisticsSubtitleMine = this.dictionary.onRequestStatisticsMineSentences(
            (_mediaId, indexes) => {
                const index = indexes[0];
                if (index === undefined) return;
                const [resolvedSubtitle, resolvedSurroundingSubtitles] = this.subtitleController.subtitleAtIndex(index);
                if (resolvedSubtitle === null || resolvedSurroundingSubtitles === null) return;
                void this._copySubtitle({
                    command: 'copy-subtitle',
                    postMineAction: this.clickToMineDefaultAction,
                    subtitle: resolvedSubtitle,
                    surroundingSubtitles: resolvedSurroundingSubtitles,
                });
            }
        );
        this.subscribed = true;
    }

    async _refreshSettings() {
        const currentSettings = await this.settings.getAll();
        this._seekDuration = currentSettings.seekDuration;
        this._speedChangeStep = currentSettings.speedChangeStep;
        this.seekableTracks = currentSettings.seekableTracks;
        this.recordMedia = currentSettings.streamingRecordMedia;
        this.takeScreenshot = currentSettings.streamingTakeScreenshot;
        this.cleanScreenshot = currentSettings.streamingTakeScreenshot && currentSettings.streamingCleanScreenshot;
        this.condensedPlaybackMinimumSkipIntervalMs = currentSettings.streamingCondensedPlaybackMinimumSkipIntervalMs;
        this.fastForwardModePlaybackRate = currentSettings.fastForwardModePlaybackRate;
        this.imageDelay = currentSettings.streamingScreenshotDelay;
        this.audioPaddingStart = currentSettings.audioPaddingStart;
        this.audioPaddingEnd = currentSettings.audioPaddingEnd;
        this.clickToMineDefaultAction = currentSettings.clickToMineDefaultAction;
        this.maxImageWidth = currentSettings.maxImageWidth;
        this.maxImageHeight = currentSettings.maxImageHeight;
        this.copyToClipboardOnMine = currentSettings.copyToClipboardOnMine;
        this.autoPausePreference = currentSettings.autoPausePreference;
        this.alwaysPlayOnSubtitleRepeat = currentSettings.alwaysPlayOnSubtitleRepeat;
        this.pauseOnHoverMode = currentSettings.pauseOnHoverMode;

        this.subtitleController.displaySubtitles = currentSettings.streamingDisplaySubtitles;
        this.subtitleController.bottomSubtitlePositionOffset = currentSettings.subtitlePositionOffset;
        this.subtitleController.topSubtitlePositionOffset = currentSettings.topSubtitlePositionOffset;
        this.subtitleController.subtitlesWidth = currentSettings.subtitlesWidth;
        this.subtitleController.surroundingSubtitlesCountRadius = currentSettings.surroundingSubtitlesCountRadius;
        this.subtitleController.surroundingSubtitlesTimeRadius = currentSettings.surroundingSubtitlesTimeRadius;
        this.subtitleController.autoCopyCurrentSubtitle = currentSettings.autoCopyCurrentSubtitle;
        this.subtitleController.dictionaryTrackSettings = currentSettings.dictionaryTracks;
        this.subtitleController.seekableTracks = currentSettings.seekableTracks;
        this.subtitleController.autoCopyableTracks = currentSettings.autoCopyableTracks;

        const convertNetflixRubyChanged =
            this.subtitleController.convertNetflixRuby !== currentSettings.convertNetflixRuby;
        this.subtitleController.convertNetflixRuby = currentSettings.convertNetflixRuby;

        const subtitleHtmlChanged = this.subtitleController.subtitleHtml !== currentSettings.subtitleHtml;
        this.subtitleController.subtitleHtml = currentSettings.subtitleHtml;

        this.subtitleController.subtitleAnnotations.settingsUpdated(currentSettings);
        this.subtitleController.setSubtitleSettings(currentSettings);

        if (convertNetflixRubyChanged || subtitleHtmlChanged) {
            this.subtitleController.cacheHtml();
        }

        this.subtitleController.refresh();

        this.videoDataSyncController.updateSettings(currentSettings);
        this.ankiUiController.updateSettings(
            {
                ...extractAnkiSettings(currentSettings),
                themeType: currentSettings.themeType,
                lastSelectedAnkiExportMode: currentSettings.lastSelectedAnkiExportMode,
            },
            this.settings
        );
        this.postMinePlayback = currentSettings.postMiningPlaybackState;
        this.keyBindings.setKeyBindSet(this, currentSettings.keyBindSet);

        if (currentSettings.streamingSubsDragAndDrop) {
            this.dragController.bind(this);
        } else {
            this.dragController.unbind();
        }

        if (currentSettings.streamingEnableOverlay) {
            this.mobileVideoOverlayController.offsetAnchor =
                currentSettings.subtitleAlignment === 'bottom' ? OffsetAnchor.top : OffsetAnchor.bottom;
            this.mobileVideoOverlayController.bind();
            this.mobileVideoOverlayController.updateModel();
        } else {
            this.mobileVideoOverlayController.unbind();
        }

        await i18nInit(currentSettings.language);
    }

    unbind() {
        if (this.canPlayListener) {
            this.video.removeEventListener('canplay', this.canPlayListener);
            this.canPlayListener = undefined;
        }

        if (this.playListener) {
            this.video.removeEventListener('play', this.playListener);
            this.playListener = undefined;
        }

        if (this.pauseListener) {
            this.video.removeEventListener('pause', this.pauseListener);
            this.pauseListener = undefined;
        }

        if (this.seekedListener) {
            this.video.removeEventListener('seeked', this.seekedListener);
            this.seekedListener = undefined;
        }

        if (this.playbackRateListener) {
            this.video.removeEventListener('ratechange', this.playbackRateListener);
            this.playbackRateListener = undefined;
        }

        if (this.videoChangeListener) {
            this.video.removeEventListener('loadedmetadata', this.videoChangeListener);
            this.videoChangeListener = undefined;
        }

        if (this.mouseMoveListener) {
            document.removeEventListener('mousemove', this.mouseMoveListener);
            this.mouseMoveListener = undefined;
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }

        if (this.audioVolumeChangeListener) {
            this.video.removeEventListener('volumechange', this.audioVolumeChangeListener);
            this.audioVolumeChangeListener = undefined;
        }

        this.audioContext?.close();
        this.audioContext = undefined;

        if (this.listener) {
            browser.runtime.onMessage.removeListener(this.listener);
            this.listener = undefined;
        }

        this.unsubscribeStatisticsSeek?.();
        this.unsubscribeStatisticsSeek = undefined;
        this.unsubscribeStatisticsSubtitleMine?.();
        this.unsubscribeStatisticsSubtitleMine = undefined;

        this.subtitleController.unbind();
        this.dragController.unbind();
        this.keyBindings.unbind();
        this.videoDataSyncController.unbind();
        this.mobileVideoOverlayController.unbind();
        this.mobileGestureController.unbind();
        this.notificationController.unbind();
        this.bulkExportController.unbind();
        this.subscribed = false;

        this._notifyVideoDisappeared(this.registeredVideoSrc ?? (this.video.src || undefined));
        this.registeredVideoSrc = undefined;
    }

    async _takeScreenshot() {
        if (!this.takeScreenshot) {
            return;
        }

        await this._prepareScreenshot();

        const command: VideoToExtensionCommand<TakeScreenshotFromExtensionMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'take-screenshot',
                ankiUiState: this.ankiUiSavedState,
                ...this._imageCaptureParams,
                subtitleFileName: this.subtitleFileName(),
                mediaTimestamp: this.video.currentTime * 1000,
            },
            src: this.video.src,
        };

        browser.runtime.sendMessage(command);
        this.ankiUiSavedState = undefined;
    }

    async _copySubtitle({
        postMineAction,
        subtitle,
        surroundingSubtitles,
        text,
        definition,
        word,
        customFieldValues,
        isBulkExport,
    }: CopySubtitleMessage) {
        if (!subtitle || !surroundingSubtitles) {
            return;
        }

        if (this.recordMedia && this.recordingMedia) {
            return;
        }

        if (this.copyToClipboardOnMine) {
            navigator.clipboard.writeText(subtitle.text);
        }

        const mediaTimestamp = subtitleTimestampWithDelay(subtitle, this.imageDelay);

        if (this.takeScreenshot) {
            await this._prepareScreenshot();
        }

        if (this.recordMedia && this.recordingMedia) {
            // In case recording state changed during the await above
            return;
        }

        if (this.recordMedia) {
            this.recordingState = RecordingState.requested;
            this.recordingPostMineAction = postMineAction;
            this.wasPlayingBeforeRecordingMedia = !this.video.paused;
            this.recordingMediaStartedTimestamp = this.video.currentTime * 1000;
            this.recordingMediaWithScreenshot = this.takeScreenshot;
            const start = Math.max(0, subtitle.start - this.audioPaddingStart);
            this.seek(start / 1000);
            await this.play();
        }

        if (!text || subtitle.text.includes(text.trim())) {
            text = extractText(subtitle, surroundingSubtitles);
        }

        const imageDelay = Math.max(0, mediaTimestamp - this.video.currentTime * 1000);

        const command: VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'record-media-and-forward-subtitle',
                subtitle: subtitle,
                surroundingSubtitles: surroundingSubtitles,
                record: this.recordMedia,
                screenshot: this.takeScreenshot,
                url: this.url(subtitle.start, subtitle.end),
                mediaTimestamp,
                subtitleFileName: this.subtitleFileName(subtitle.track),
                postMineAction: postMineAction,
                audioPaddingStart: this.audioPaddingStart,
                audioPaddingEnd: this.audioPaddingEnd,
                imageDelay,
                playbackRate: this.video.playbackRate,
                text,
                definition,
                word,
                customFieldValues,
                isBulkExport,
                ...this._imageCaptureParams,
            },
            src: this.video.src,
        };

        browser.runtime.sendMessage(command);
    }

    // Public helper for controllers to reuse copy-subtitle flow (e.g., bulk export)
    async copySubtitleForBulk(message: CopySubtitleMessage) {
        await this._copySubtitle(message);
    }

    async _toggleRecordingMedia(postMineAction: PostMineAction) {
        if (this.recordingState === RecordingState.requested) {
            return;
        }

        if (this.recordingState === RecordingState.started) {
            const currentTimestamp = this.video.currentTime * 1000;
            const command: VideoToExtensionCommand<StopRecordingMediaMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'stop-recording-media',
                    postMineAction: postMineAction,
                    startTimestamp: this.recordingMediaStartedTimestamp!,
                    endTimestamp: currentTimestamp,
                    playbackRate: this.video.playbackRate,
                    screenshot: this.recordingMediaWithScreenshot,
                    videoDuration: this.video.duration * 1000,
                    url: this.url(this.recordingMediaStartedTimestamp!, currentTimestamp),
                    subtitleFileName: this.subtitleFileName(),
                    ...this._imageCaptureParams,
                    ...this._surroundingSubtitlesAroundInterval(this.recordingMediaStartedTimestamp!, currentTimestamp),
                },
                src: this.video.src,
            };

            browser.runtime.sendMessage(command);
        } else {
            this.ankiUiSavedState = undefined;

            if (this.takeScreenshot) {
                await this._prepareScreenshot();
            }

            const timestamp = this.video.currentTime * 1000;

            if (this.recordMedia) {
                this.recordingState = RecordingState.requested;
                this.wasPlayingBeforeRecordingMedia = !this.video.paused;
                this.recordingMediaStartedTimestamp = timestamp;
                this.recordingMediaWithScreenshot = this.takeScreenshot;
                this.recordingPostMineAction = postMineAction;

                if (this.video.paused) {
                    await this.play();
                }
            }

            const command: VideoToExtensionCommand<StartRecordingMediaMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'start-recording-media',
                    mediaTimestamp: timestamp,
                    record: this.recordMedia,
                    postMineAction: postMineAction,
                    screenshot: this.takeScreenshot,
                    url: this.url(timestamp),
                    subtitleFileName: this.subtitleFileName(),
                    imageDelay: this.imageDelay,
                    ...this._imageCaptureParams,
                },
                src: this.video.src,
            };

            browser.runtime.sendMessage(command);
        }
    }

    private _surroundingSubtitlesAroundInterval(start: number, end: number) {
        return surroundingSubtitlesAroundInterval(
            this.subtitleController.subtitles,
            start,
            end,
            this.ankiUiController.settings!.surroundingSubtitlesCountRadius,
            this.ankiUiController.settings!.surroundingSubtitlesTimeRadius
        );
    }

    async _prepareScreenshot() {
        if (this.cleanScreenshot) {
            this.notificationController.hide();
            this.subtitleController.forceHideSubtitles = true;
            this.mobileVideoOverlayController.forceHide = true;
            await this.controlsController.hide();
        }
    }

    async rerecord(start: number, end: number, uiState: AnkiUiSavedState) {
        if (this.recordingMedia) {
            return;
        }

        const noSubtitles = this.subtitleController.subtitles.length === 0;
        const audioPaddingStart = noSubtitles ? 0 : this.audioPaddingStart;
        const audioPaddingEnd = noSubtitles ? 0 : this.audioPaddingEnd;
        this.recordingState = RecordingState.requested;
        this.recordingMediaStartedTimestamp = this.video.currentTime * 1000;
        this.seek(Math.max(0, start - audioPaddingStart) / 1000);
        await this.play();

        const command: VideoToExtensionCommand<RerecordMediaMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'rerecord-media',
                duration: end - start,
                uiState: uiState,
                audioPaddingStart: audioPaddingStart,
                audioPaddingEnd: audioPaddingEnd,
                playbackRate: this.video.playbackRate,
                timestamp: start,
                subtitleFileName: this.subtitleFileName(),
            },
            src: this.video.src,
        };

        browser.runtime.sendMessage(command);
    }

    seek(timestamp: number) {
        if (netflix) {
            document.dispatchEvent(
                new CustomEvent('asbplayer-netflix-seek', {
                    detail: timestamp * 1000,
                })
            );
        } else {
            seekWithNudge(this.video, timestamp);
        }
    }

    async play() {
        if (netflix) {
            await this._playNetflix();
            return;
        }

        try {
            await this.video.play();
        } catch (ex) {
            // Ignore exception

            if (this.video.readyState !== 4) {
                // Deal with Amazon Prime player pausing in the middle of play, without loss of generality
                return new Promise((resolve, reject) => {
                    const listener = async (evt: Event) => {
                        let retries = 3;

                        for (let i = 0; i < retries; ++i) {
                            try {
                                await this.video.play();
                                break;
                            } catch (ex2) {
                                console.error(ex2);
                            }
                        }

                        resolve(undefined);
                        this.video.removeEventListener('canplay', listener);
                    };

                    this.video.addEventListener('canplay', listener);
                });
            }
        }
    }

    _playNetflix() {
        return new Promise((resolve, reject) => {
            const listener = async (evt: Event) => {
                this.video.removeEventListener('play', listener);
                this.video.removeEventListener('playing', listener);
                resolve(undefined);
            };

            this.video.addEventListener('play', listener);
            this.video.addEventListener('playing', listener);
            document.dispatchEvent(new CustomEvent('asbplayer-netflix-play'));
        });
    }

    pause() {
        if (netflix) {
            document.dispatchEvent(new CustomEvent('asbplayer-netflix-pause'));
            return;
        }

        this.video.pause();
    }

    showVideoDataDialog(openedFromMiningCommand: boolean, fromAsbplayerId?: string) {
        this.videoDataSyncController.show({
            reason: openedFromMiningCommand ? VideoDataUiOpenReason.miningCommand : VideoDataUiOpenReason.userRequested,
            fromAsbplayerId,
        });
    }

    async cropAndResize(tabImageDataUrl: string): Promise<string> {
        const rect = this.video.getBoundingClientRect();
        const maxWidth = this.maxImageWidth;
        const maxHeight = this.maxImageHeight;
        return await cropAndResize(maxWidth, maxHeight, rect, tabImageDataUrl);
    }

    async loadSubtitles(files: File[], flatten: boolean, syncWithAsbplayerId?: string) {
        const {
            streamingSubtitleListPreference,
            subtitleRegexFilter,
            subtitleRegexFilterTextReplacement,
            rememberSubtitleOffset,
            lastSubtitleOffset,
            subtitleHtml,
            convertNetflixRuby: convertNetflixRuby,
        } = await this.settings.get([
            'streamingSubtitleListPreference',
            'subtitleRegexFilter',
            'subtitleRegexFilterTextReplacement',
            'rememberSubtitleOffset',
            'lastSubtitleOffset',
            'subtitleHtml',
            'convertNetflixRuby',
        ]);
        const syncWithAsbplayerTab = async (withSyncedAsbplayerOnly: boolean, withAsbplayerId: string | undefined) => {
            const syncMessage: VideoToExtensionCommand<ExtensionSyncMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'sync',
                    subtitles: await Promise.all(
                        files.map(async (f) => {
                            const base64 = await bufferToBase64(await f.arrayBuffer());

                            return {
                                name: f.name,
                                base64: base64,
                            };
                        })
                    ),
                    withSyncedAsbplayerOnly,
                    withAsbplayerId,
                },
                src: this.video.src,
            };
            browser.runtime.sendMessage(syncMessage);
        };

        switch (streamingSubtitleListPreference) {
            case SubtitleListPreference.noSubtitleList:
                const reader = new SubtitleReader({
                    regexFilter: subtitleRegexFilter,
                    regexFilterTextReplacement: subtitleRegexFilterTextReplacement,
                    subtitleHtml: subtitleHtml,
                    convertNetflixRuby: convertNetflixRuby,
                    pgsParserWorkerFactory: pgsParserWorkerFactory,
                });
                const offset = rememberSubtitleOffset ? lastSubtitleOffset : 0;
                const subtitles = await reader.subtitles(files, flatten);

                // Order is important: sync with tab first, then update our subtitle controller
                // since the subtitle controller may send coloring messages as soon as it gets
                // the new subtitles, and the tab needs to have the new subtitles loaded before
                // receiving their colors.

                // If target asbplayer is not specified, then sync with any already-synced asbplayer
                // Otherwise, sync with the target asbplayer.

                const withSyncedAsbplayerOnly = syncWithAsbplayerId === undefined;
                syncWithAsbplayerTab(withSyncedAsbplayerOnly, syncWithAsbplayerId);

                this._updateSubtitles(
                    subtitles.map((s, index) => ({
                        start: s.start + offset,
                        end: s.end + offset,
                        text: s.text,
                        textImage: s.textImage,
                        track: s.track,
                        index,
                        originalStart: s.start,
                        originalEnd: s.end,
                        tokenization: s.tokenization,
                    })),
                    flatten ? [files[0].name] : files.map((f) => f.name)
                );
                break;
            case SubtitleListPreference.app:
                syncWithAsbplayerTab(false, undefined);
                break;
        }
    }

    private _updateSubtitles(subtitles: IndexedSubtitleModel[], subtitleFileNames: string[]) {
        this.subtitleController.subtitles = subtitles;
        this.subtitleController.subtitleFileNames = subtitleFileNames;
        this.subtitleController.cacheHtml();

        if (!this._playModes.has(PlayMode.normal) && (!subtitles || subtitles.length === 0)) {
            this.togglePlayMode(PlayMode.normal);
        }

        let nonEmptyTrackIndex: number[] = [];
        for (let i = 0; i < subtitles.length; i++) {
            if (!nonEmptyTrackIndex.includes(subtitles[i].track)) {
                nonEmptyTrackIndex.push(subtitles[i].track);
            }
        }
        this.subtitleController.showLoadedMessage(nonEmptyTrackIndex);
        this.ankiUiSavedState = undefined;
        this._synced = true;
        this._syncedTimestamp = Date.now();

        if (this.video.paused) {
            this.mobileVideoOverlayController.show();
        }

        this.mobileVideoOverlayController.updateModel();

        if (!isMobile && subtitles.length > 0) {
            this.settings
                .get(['streamingDisplaySubtitles', 'keyBindSet'])
                .then(({ streamingDisplaySubtitles, keyBindSet }) => {
                    if (!streamingDisplaySubtitles && keyBindSet.toggleSubtitles.keys) {
                        this.subtitleController.notification('info.toggleSubtitlesShortcut', {
                            keys: keyBindSet.toggleSubtitles.keys,
                        });
                    }
                });
        }

        shouldShowUpdateAlert().then((shouldShowUpdateAlert) => {
            if (shouldShowUpdateAlert) {
                this.notificationController.updateAlert(browser.runtime.getManifest().version);
            }
        });
    }

    private _resetSubtitles() {
        this.subtitleController.reset();
        this.ankiUiSavedState = undefined;
        this._synced = false;
        this._syncedTimestamp = undefined;
        this.mobileVideoOverlayController.disposeOverlay();
    }

    private _updateRegisteredVideoSrc(src: string | undefined) {
        if (src === this.registeredVideoSrc) return;
        this._notifyVideoDisappeared(this.registeredVideoSrc);
        this.registeredVideoSrc = src;
    }

    private _notifyVideoDisappeared(src: string | undefined) {
        if (!src) return;
        const command: VideoToExtensionCommand<VideoDisappearedMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'video-disappeared',
            },
            src,
        };
        browser.runtime.sendMessage(command);
    }

    private _captureStream(): Promise<MediaStream> {
        return new Promise((resolve, reject) => {
            const existingStream = this._existingActiveAudioStream();

            if (existingStream !== undefined) {
                resolve(existingStream);
                return;
            }

            try {
                let stream: MediaStream | undefined;

                let usedMozCapture = false;

                if (typeof (this.video as any).captureStream === 'function') {
                    // Introduced in Firefox 149
                    stream = (this.video as any).captureStream();
                } else if (typeof (this.video as any).mozCaptureStreamUntilEnded === 'function') {
                    stream = (this.video as any).mozCaptureStreamUntilEnded();
                    usedMozCapture = true;
                }

                if (stream === undefined) {
                    reject(new Error('Unable to capture stream from audio'));
                    return;
                }

                const audioStream = new MediaStream();

                for (const track of stream.getVideoTracks()) {
                    track.stop();
                }

                for (const track of stream.getAudioTracks()) {
                    if (track.enabled) {
                        audioStream.addTrack(track);
                    }
                }

                let recordingStream = audioStream;

                if (usedMozCapture) {
                    // mozCaptureStreamUntilEnded diverts audio away from speakers,
                    // so route it back via AudioContext to keep audio audible
                    const audioContext = new AudioContext();
                    const source = audioContext.createMediaStreamSource(audioStream);
                    source.connect(audioContext.destination);
                    this.audioContext = audioContext;
                } else {
                    // captureStream() captures at raw volume, independent of video.volume.
                    // Apply video.volume via a GainNode so the recording level matches what the user hears.
                    const audioContext = new AudioContext();
                    const source = audioContext.createMediaStreamSource(audioStream);
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = this.video.muted ? 0 : this.video.volume;
                    const destination = audioContext.createMediaStreamDestination();
                    source.connect(gainNode);
                    gainNode.connect(destination);

                    const volumeChangeListener = () => {
                        gainNode.gain.value = this.video.muted ? 0 : this.video.volume;
                    };
                    this.video.addEventListener('volumechange', volumeChangeListener);
                    this.audioContext = audioContext;
                    this.audioVolumeChangeListener = volumeChangeListener;
                    recordingStream = destination.stream;
                }

                this.audioStream = recordingStream;
                resolve(recordingStream);
            } catch (e) {
                reject(e);
            }
        });
    }

    private _existingActiveAudioStream() {
        if (this.audioStream === undefined) {
            return undefined;
        }

        return this.audioStream.active ? this.audioStream : undefined;
    }

    private async _sendAudioBase64(base64: string, requestId: string, encodeAsMp3: boolean) {
        if (encodeAsMp3) {
            const encodeMp3Command: VideoToExtensionCommand<EncodeMp3InServiceWorkerMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'encode-mp3',
                    base64,
                    extension: 'webm',
                },
                src: this.video.src,
            };
            base64 = await browser.runtime.sendMessage(encodeMp3Command);
        }

        const command: VideoToExtensionCommand<AudioBase64Message> = {
            sender: 'asbplayer-video',
            message: {
                command: 'audio-base64',
                base64,
                requestId,
            },
            src: this.video.src,
        };

        browser.runtime.sendMessage(command);
    }

    private _notifyRequestingActiveTabPermission(requesting: boolean) {
        const command: VideoToExtensionCommand<RequestingActiveTabPermsisionMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'requesting-active-tab-permission',
                requesting,
            },
            src: this.video.src,
        };

        browser.runtime.sendMessage(command);
    }

    url(start: number, end?: number) {
        if (youtube) {
            const toSeconds = (ms: number) => Math.floor(ms / 1000);
            const videoId = new URLSearchParams(window.location.search).get('v');

            if (videoId !== null) {
                const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${toSeconds(start)}&autoplay=1`;
                return end === undefined ? embedUrl : `${embedUrl}&end=${toSeconds(end)}`;
            }
        }

        return window.location !== window.parent.location ? document.referrer : document.location.href;
    }
}
