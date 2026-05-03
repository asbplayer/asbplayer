import type {
    AnkiSettings,
    ApplyStrategy,
    AsbplayerSettings,
    MiscSettings,
    PageSettings,
    SettingsFormPageConfig,
    SubtitleSettings,
    TokenState,
    TokenStatus,
} from '../settings/settings';
import type { GlobalState, OnlineSubtitleSourceConfig } from '../global-state';
import type { DictionaryStatisticsSnapshot } from '../dictionary-statistics';
import {
    RectModel,
    SubtitleModel,
    AudioTrackModel,
    AnkiUiSavedState,
    ConfirmedVideoDataSubtitleTrack,
    PostMineAction,
    PlayMode,
    CardModel,
    CardTextFieldValues,
    MobileOverlayModel,
    VideoTabModel,
    CopyHistoryItem,
    AnkiDialogSettings,
    AnkiExportMode,
    RichSubtitleModel,
    BrowserFeatures,
} from './model';
import { AsbPlayerToVideoCommandV2 } from './command';
import {
    DictionaryLocalTokenInput,
    DictionaryTokenKey,
    DictionaryTokenRecord,
    DictionaryRecordUpdateInput,
} from '../dictionary-db/dictionary-db';

export interface Message {
    readonly command: string;
}

export interface MessageWithId extends Message {
    readonly messageId: string;
}

export interface AsbplayerInstance {
    id: string;
    tabId?: number;
    sidePanel: boolean;
    timestamp: number;
    videoPlayer: boolean;
    loadedSubtitles: boolean;
}

export interface AsbplayerHeartbeatMessage extends Message {
    readonly command: 'heartbeat';
    readonly id: string;
    readonly receivedTabs?: VideoTabModel[];
    readonly videoPlayer: boolean;
    readonly sidePanel?: boolean;
    readonly sidePanelAppRequestedLocation?: SidePanelLocation;
    readonly loadedSubtitles?: boolean;
    readonly syncedVideoElement?: VideoTabModel;
}

export interface AckTabsMessage extends Message {
    readonly command: 'ackTabs';
    readonly id: string;
    readonly receivedTabs: VideoTabModel[];
    readonly videoPlayer: boolean;
    readonly sidePanel?: boolean;
    readonly sidePanelAppRequestedLocation?: SidePanelLocation;
    readonly loadedSubtitles?: boolean;
    readonly syncedVideoElement?: VideoTabModel;
}

export interface TabsMessage extends Message {
    readonly command: 'tabs';
    readonly tabs: VideoTabModel[];
    readonly asbplayers: AsbplayerInstance[];
    readonly ackRequested: boolean;
}

export interface VideoHeartbeatMessage extends Message {
    readonly command: 'heartbeat';
    readonly subscribed: boolean;
    readonly synced: boolean;
    readonly syncedTimestamp?: number;
    readonly loadedSubtitles: boolean;
}

export interface VideoDisappearedMessage extends Message {
    readonly command: 'video-disappeared';
}

export interface HttpPostMessage extends MessageWithId {
    readonly command: 'http-post';
    readonly messageId: string;
    readonly url: string;
    readonly body: any;
}

export interface EncodeMp3Message extends MessageWithId {
    readonly command: 'encode-mp3';
    readonly messageId: string;
    readonly base64: string;
    readonly extension: string;
}

export interface EncodeMp3InServiceWorkerMessage extends Message {
    readonly command: 'encode-mp3';
    readonly base64: string;
    readonly extension: string;
}

export interface SettingsUpdatedMessage extends Message {
    readonly command: 'settings-updated';
}

export interface ImageCaptureParams {
    readonly maxWidth: number;
    readonly maxHeight: number;
    readonly rect: RectModel;
    readonly frameId?: string;
}

export interface RecordMediaAndForwardSubtitleMessage extends Message, CardTextFieldValues, ImageCaptureParams {
    readonly command: 'record-media-and-forward-subtitle';
    readonly subtitle: SubtitleModel;
    readonly surroundingSubtitles: SubtitleModel[];
    readonly url?: string;
    readonly subtitleFileName: string;
    readonly record: boolean;
    readonly screenshot: boolean;
    readonly postMineAction: PostMineAction;
    readonly audioPaddingStart: number;
    readonly audioPaddingEnd: number;
    readonly imageDelay: number;
    readonly playbackRate: number;
    readonly mediaTimestamp: number;
    readonly isBulkExport?: boolean;
}

export interface StartRecordingMediaMessage extends Message, ImageCaptureParams {
    readonly command: 'start-recording-media';
    readonly record: boolean;
    readonly mediaTimestamp: number;
    readonly screenshot: boolean;
    readonly postMineAction: PostMineAction;
    readonly imageDelay: number;
    readonly url?: string;
    readonly subtitleFileName: string;
}

export interface StopRecordingMediaMessage extends Message, ImageCaptureParams {
    readonly command: 'stop-recording-media';
    readonly postMineAction: PostMineAction;
    readonly startTimestamp: number;
    readonly endTimestamp: number;
    readonly playbackRate: number;
    readonly screenshot: boolean;
    readonly videoDuration: number;
    readonly url?: string;
    readonly subtitleFileName: string;
    readonly subtitle?: SubtitleModel;
    readonly surroundingSubtitles?: SubtitleModel[];
}

export interface CopyMessage extends Message, CardModel {
    readonly command: 'copy';
    readonly postMineAction?: PostMineAction;
}

export interface PublishCardMessage extends Message, CardModel {
    readonly command: 'publish-card';
}

export interface CopyToVideoMessage extends Message, CardTextFieldValues {
    readonly command: 'copy';
    readonly postMineAction: PostMineAction;
    readonly subtitle?: SubtitleModel;
    readonly surroundingSubtitles?: SubtitleModel[];
}

export interface CopySubtitleMessage extends Message, CardTextFieldValues {
    readonly command: 'copy-subtitle';
    readonly postMineAction: PostMineAction;
    readonly subtitle?: SubtitleModel;
    readonly surroundingSubtitles?: SubtitleModel[];
    readonly isBulkExport?: boolean;
}

export interface CopySubtitleWithAdditionalFieldsMessage extends Message, CardTextFieldValues {
    readonly command: 'copy-subtitle-with-additional-fields';
    readonly postMineAction: PostMineAction;
}

export interface TakeScreenshotMessage extends Message {
    readonly command: 'take-screenshot';
}

export interface TakeScreenshotFromExtensionMessage extends Message, ImageCaptureParams {
    readonly command: 'take-screenshot';
    readonly ankiUiState?: AnkiUiSavedState;
    readonly subtitleFileName: string;
    readonly mediaTimestamp: number;
}

export interface TakeScreenshotToVideoPlayerMessage extends Message {
    readonly command: 'takeScreenshot';
}

export interface CardUpdatedMessage extends Message, CardModel {
    readonly command: 'card-updated';
    readonly cardName: string;
}

export interface CardUpdatedDialogMessage extends Message {
    readonly command: 'card-updated-dialog';
}

export interface CardExportedMessage extends Message, CardModel {
    readonly command: 'card-exported';
    readonly cardName: string;
    readonly isBulkExport?: boolean;
    readonly skippedDuplicate?: boolean;
    readonly exportError?: string;
}

export interface CardExportedDialogMessage extends Message {
    readonly command: 'card-exported-dialog';
}

export interface CardSavedMessage extends Message, CardModel {
    readonly command: 'card-saved';
    readonly cardName: string;
}

export interface ScreenshotTakenMessage extends Message {
    readonly command: 'screenshot-taken';
    readonly ankiUiState?: AnkiUiSavedState;
}

export interface ShowAnkiUiMessage extends Message, CardModel {
    readonly command: 'show-anki-ui';
    readonly id: string;
}

export interface RecordingStartedMessage extends Message {
    readonly command: 'recording-started';
}

export interface RecordingFinishedMessage extends Message {
    readonly command: 'recording-finished';
}

export interface RerecordMediaMessage extends Message {
    readonly command: 'rerecord-media';
    readonly duration: number;
    readonly uiState: AnkiUiSavedState;
    readonly audioPaddingStart: number;
    readonly audioPaddingEnd: number;
    readonly playbackRate: number;
    readonly timestamp: number;
    readonly subtitleFileName: string;
}

export interface ToggleRecordingMessage extends Message {
    readonly command: 'toggle-recording';
}

export interface SubtitleFile {
    base64: string;
    name: string;
}

export interface ToggleVideoSelectMessage extends Message {
    readonly command: 'toggle-video-select';
    readonly fromAsbplayerId?: string;
    readonly subtitleFiles?: SubtitleFile[];
}

export interface ShowAnkiUiAfterRerecordMessage extends Message {
    readonly command: 'show-anki-ui-after-rerecord';
    readonly uiState: AnkiUiSavedState;
}

export interface SerializedSubtitleFile {
    name: string;
    base64: string;
}

export interface LegacyPlayerSyncMessage extends Message {
    readonly command: 'sync';
    readonly subtitles: SerializedSubtitleFile;
}

export interface PlayerSyncMessage extends Message {
    readonly command: 'syncv2';
    readonly subtitles: SerializedSubtitleFile[];
    readonly flatten?: boolean;
}

export interface ExtensionSyncMessage extends Message {
    readonly command: 'sync';
    readonly subtitles: SerializedSubtitleFile[];
    readonly flatten?: boolean;
    readonly withSyncedAsbplayerOnly: boolean;
    readonly withAsbplayerId?: string;
}

export interface OffsetFromVideoMessage extends Message {
    readonly command: 'offset';
    readonly value: number;
}

export interface OffsetToVideoMessage extends Message {
    readonly command: 'offset';
    readonly value: number;
    readonly echo?: boolean;
}

export interface PlaybackRateToVideoMessage extends Message {
    readonly command: 'playbackRate';
    readonly value: number;
}

export interface ToggleSubtitlesMessage extends Message {
    readonly command: 'toggle-subtitles';
}

export interface ToggleSubtitlesInListFromVideoMessage extends Message {
    readonly command: 'toggleSubtitleTrackInList';
    readonly track: number;
}

export interface ReadyStateFromVideoMessage extends Message {
    readonly command: 'readyState';
    readonly value: number;
}

export interface ReadyFromVideoMessage extends Message {
    readonly command: 'ready';
    readonly duration: number;
    readonly currentTime: number;
    readonly paused: boolean;
    readonly audioTracks?: AudioTrackModel[];
    readonly selectedAudioTrack?: string;
    readonly playbackRate: number;
}

export interface ReadyToVideoMessage extends Message {
    readonly command: 'ready';
    readonly duration: number;
    readonly videoFileName?: string;
}

export interface PlayFromVideoMessage extends Message {
    readonly command: 'play';
    readonly echo: boolean;
}

export interface PauseFromVideoMessage extends Message {
    readonly command: 'pause';
    readonly echo: boolean;
}

export interface CurrentTimeFromVideoMessage extends Message {
    readonly command: 'currentTime';
    readonly value: number;
    readonly echo: boolean;
}

export interface CurrentTimeToVideoMessage extends Message {
    readonly command: 'currentTime';
    readonly value: number;
}

export interface PlaybackRateFromVideoMessage extends Message {
    readonly command: 'playbackRate';
    readonly value: number;
    readonly echo: boolean;
}

export interface AudioTrackSelectedFromVideoMessage extends Message {
    readonly command: 'audioTrackSelected';
    readonly id: string;
}

export interface AudioTrackSelectedToVideoMessage extends Message {
    readonly command: 'audioTrackSelected';
    readonly id: string;
}

export interface ToggleSubtitleTrackInListFromVideoMessage extends Message {
    readonly command: 'toggleSubtitleTrackInList';
    readonly track: number;
}

export interface SubtitlesToVideoMessage extends Message {
    readonly command: 'subtitles';
    readonly value: SubtitleModel[];
    readonly name?: string;
    readonly names: string[];
}

export interface SubtitlesUpdatedToVideoMessage extends Message {
    readonly command: 'subtitlesUpdated';
    readonly subtitles: RichSubtitleModel[];
}

export interface RequestCurrentSubtitleMessage extends Message {
    readonly command: 'request-current-subtitle';
}

export interface RequestSubtitlesMessage extends Message {
    readonly command: 'request-subtitles';
}

export interface SubtitlesUpdatedFromVideoMessage extends Message {
    readonly command: 'subtitlesUpdated';
    readonly updatedSubtitles: RichSubtitleModel[];
}

export interface RequestSubtitlesFromAppMessage extends MessageWithId {
    readonly command: 'request-subtitles';
}

export interface SubtitleSettingsToVideoMessage extends Message {
    readonly command: 'subtitleSettings';
    readonly value: SubtitleSettings;
}

export interface PlayModeMessage extends Message {
    readonly command: 'playMode';
    readonly playMode: PlayMode;
}

export interface PlayModesMessage extends Message {
    readonly command: 'playModes';
    readonly playModes: PlayMode[];
}

export interface HideSubtitlePlayerToggleToVideoMessage extends Message {
    readonly command: 'hideSubtitlePlayerToggle';
    readonly value: boolean;
}

export interface AppBarToggleMessageToVideoMessage extends Message {
    readonly command: 'appBarToggle';
    readonly value: boolean;
}

export interface FullscreenToggleMessageToVideoMessage extends Message {
    readonly command: 'fullscreenToggle';
    readonly value: boolean;
}

export interface FinishedAnkiDialogRequestToVideoMessage extends Message {
    readonly command: 'finishedAnkiDialogRequest';
    readonly resume: boolean;
}

export interface AnkiSettingsToVideoMessage extends Message {
    readonly command: 'ankiSettings';
    readonly value: AnkiSettings;
}

export interface AnkiDialogSettingsMessage extends Message {
    readonly command: 'settings';
    readonly settings: AnkiDialogSettings;
    readonly activeProfile?: string;
    readonly profiles?: { name: string }[];
}

export interface ActiveProfileMessage extends Message {
    readonly command: 'activeProfile';
    readonly profile?: string;
}

export interface AnkiDialogDismissedQuickSelectFtueMessage extends Message {
    readonly command: 'dismissedQuickSelectFtue';
}

export interface MiscSettingsToVideoMessage extends Message {
    readonly command: 'miscSettings';
    readonly value: MiscSettings;
}

export interface AnkiUiBridgeRewindMessage extends Message {
    readonly command: 'rewind';
    readonly uiState: AnkiUiSavedState;
}

export interface AnkiUiBridgeResumeMessage extends Message {
    readonly command: 'resume';
    readonly uiState: AnkiUiSavedState;
    readonly cardExported: boolean;
}

export interface AnkiUiBridgeRerecordMessage extends Message {
    readonly command: 'rerecord';
    readonly uiState: AnkiUiSavedState;
    readonly recordStart: number;
    readonly recordEnd: number;
}

export interface AnkiUiBridgeExportedMessage extends Message {
    readonly command: 'exported';
    readonly mode: AnkiExportMode;
}

export interface VideoDataUiBridgeConfirmMessage extends Message {
    readonly command: 'confirm';
    readonly data: ConfirmedVideoDataSubtitleTrack[];
    readonly shouldRememberTrackChoices: boolean;
    readonly syncWithAsbplayerId?: string;
}

export interface VideoDataUiBridgeOpenFileMessage extends Message {
    readonly command: 'openFile';
    readonly subtitles: SerializedSubtitleFile[];
}

export interface VideoDataUiBridgeSetOnlineSubtitleSourceConfigMessage extends Message {
    readonly command: 'setOnlineSubtitleSourceConfig';
    readonly state: Partial<OnlineSubtitleSourceConfig>;
}

export interface CropAndResizeMessage extends Message, ImageCaptureParams {
    readonly command: 'crop-and-resize';
    readonly dataUrl: string;
}

export interface StartRecordingAudioWithTimeoutMessage extends Message {
    readonly command: 'start-recording-audio-with-timeout';
    readonly timeout: number;
    readonly streamId: string;
    readonly requestId: string;
    readonly encodeAsMp3: boolean;
}

export interface StartRecordingAudioWithTimeoutViaCaptureStreamMessage extends Message {
    readonly command: 'start-recording-audio-with-timeout';
    readonly timeout: number;
    readonly requestId: string;
    readonly encodeAsMp3: boolean;
}

export interface StartRecordingAudioMessage extends Message {
    readonly command: 'start-recording-audio';
    readonly streamId: string;
    readonly requestId: string;
}

export interface StartRecordingAudioViaCaptureStreamMessage extends Message {
    readonly command: 'start-recording-audio';
    readonly requestId: string;
}

export interface StopRecordingAudioMessage extends Message {
    readonly command: 'stop-recording-audio';
    readonly encodeAsMp3: boolean;
}

export enum StartRecordingErrorCode {
    noActiveTabPermission = 1,
    drmProtected = 2,
    other = 3,
}

export interface StartRecordingResponse {
    started: boolean;
    error?: {
        code: StartRecordingErrorCode;
        message: string;
    };
}

export enum StopRecordingErrorCode {
    timedAudioRecordingInProgress = 1,
    other = 2,
}

export interface StopRecordingResponse {
    stopped: boolean;
    error?: {
        code: StopRecordingErrorCode;
        message: string;
    };
}

export interface BackgroundPageReadyMessage extends Message {
    readonly command: 'background-page-ready';
}

export interface AudioBase64Message extends Message {
    readonly command: 'audio-base64';
    readonly base64: string;
    readonly requestId: string;
}

export interface EditKeyboardShortcutsMessage extends Message {
    readonly command: 'edit-keyboard-shortcuts';
}

export interface OpenAsbplayerSettingsMessage extends Message {
    readonly command: 'open-asbplayer-settings';
    readonly tutorial?: boolean;
    readonly scrollToId?: string;
}

export interface ExtensionVersionMessage extends Message {
    readonly command: 'version';
    version: string;
    extensionCommands?: { [key: string]: string | undefined };
    pageConfig?: { [K in keyof PageSettings]: SettingsFormPageConfig };
    browserFeatures?: BrowserFeatures;
}

export interface AlertMessage extends Message {
    readonly command: 'alert';
    readonly severity: string;
    readonly message: string;
}

export interface VideoSelectModeConfirmMessage extends Message {
    readonly command: 'confirm';
    readonly selectedVideoElementSrc: string;
}

export interface VideoSelectModeCancelMessage extends Message {
    readonly command: 'cancel';
}

export interface CaptureVisibleTabMessage extends Message {
    readonly command: 'capture-visible-tab';
}

export interface CopyToClipboardMessage extends Message {
    readonly command: 'copy-to-clipboard';
    readonly dataUrl: string;
}

export interface LoadSubtitlesMessage extends Message {
    readonly command: 'load-subtitles';
    readonly fromAsbplayerId?: string;
}

export interface RequestActiveTabPermissionMessage extends Message {
    readonly command: 'request-active-tab-permission';
}

export interface RequestingActiveTabPermsisionMessage extends Message {
    readonly command: 'requesting-active-tab-permission';
    readonly requesting: boolean;
}

export interface GrantedActiveTabPermissionMessage extends Message {
    readonly command: 'granted-active-tab-permission';
}

export type SidePanelLocation = 'mining-history' | 'statistics';

export interface ToggleSidePanelMessage extends Message {
    readonly command: 'toggle-side-panel';
    readonly location?: SidePanelLocation;
}

export interface OpenSidePanelLocationMessage extends Message {
    readonly command: 'open-side-panel-location';
    readonly location: SidePanelLocation;
}

export interface OpenStatisticsMessage extends Message {
    readonly command: 'open-statistics';
}

export interface CloseSidePanelMessage extends Message {
    readonly command: 'close-side-panel';
}

export interface GetSettingsMessage extends MessageWithId {
    readonly command: 'get-settings';
    readonly keysAndDefaults: Partial<AsbplayerSettings>;
}

export interface SetSettingsMessage extends MessageWithId {
    readonly command: 'set-settings';
    readonly settings: Partial<AsbplayerSettings>;
}

export interface GetActiveProfileMessage extends MessageWithId {
    readonly command: 'get-active-profile';
}

export interface SetActiveProfileMessage extends MessageWithId {
    readonly command: 'set-active-profile';
    readonly name: string | undefined;
}

export interface GetProfilesMessage extends MessageWithId {
    readonly command: 'get-profiles';
}

export interface AddProfileMessage extends MessageWithId {
    readonly command: 'add-profile';
    readonly name: string;
}

export interface RemoveProfileMessage extends MessageWithId {
    readonly command: 'remove-profile';
    readonly name: string;
}

export interface GetGlobalStateMessage extends MessageWithId {
    readonly command: 'get-global-state';
    readonly keys?: (keyof GlobalState)[];
}

export interface SetGlobalStateMessage extends MessageWithId {
    readonly command: 'set-global-state';
    readonly state: Partial<GlobalState>;
}

export interface ForwardCommandMessage extends Message {
    readonly command: 'forward-command';
    readonly commandToForward: AsbPlayerToVideoCommandV2<Message>;
}

export interface UpdateStateMessage extends Message {
    readonly command: 'updateState';
    readonly state: any;
}

export interface AckMessage extends MessageWithId {
    readonly command: 'ack-message';
}

export interface RequestSubtitlesResponse {
    subtitles: RichSubtitleModel[];
    subtitleFileNames: string[];
}

export interface RequestCurrentSubtitleResponse {
    readonly currentSubtitle: SubtitleModel | null;
    readonly currentSubtitleIndex: number | null;
}

export interface JumpToSubtitleMessage extends Message {
    readonly command: 'jump-to-subtitle';
    readonly subtitle: SubtitleModel;
    readonly subtitleFileName: string;
}

export interface DownloadImageMessage extends Message, CardModel {
    readonly command: 'download-image';
}

export interface DownloadAudioMessage extends Message, CardModel {
    readonly command: 'download-audio';
}

export interface NotifyErrorMessage extends Message {
    readonly command: 'notify-error';
    readonly message: string;
}

export interface RequestMobileOverlayModelMessage extends Message {
    readonly command: 'request-mobile-overlay-model';
}

export interface UpdateMobileOverlayModelMessage extends Message {
    readonly command: 'update-mobile-overlay-model';
    readonly model: MobileOverlayModel;
}

export interface CurrentTabMessage extends Message {
    readonly command: 'current-tab';
}

export interface NotificationDialogMessage extends Message {
    readonly command: 'notification-dialog';
    readonly titleLocKey: string;
    readonly messageLocKey: string;
}

export interface HiddenMessage extends Message {
    readonly command: 'hidden';
}

export interface RequestCopyHistoryMessage extends MessageWithId {
    readonly command: 'request-copy-history';
    readonly count: number;
}

export interface RequestCopyHistoryResponse {
    readonly copyHistoryItems: CopyHistoryItem[];
}

export interface SaveCopyHistoryMessage extends MessageWithId {
    readonly command: 'save-copy-history';
    readonly copyHistoryItems: CopyHistoryItem[];
}

export interface DeleteCopyHistoryMessage extends MessageWithId {
    readonly command: 'delete-copy-history';
    readonly ids: string[];
}

export interface ClearCopyHistoryMessage extends MessageWithId {
    readonly command: 'clear-copy-history';
}

export interface DictionaryGetBulkMessage extends MessageWithId {
    readonly command: 'dictionary-get-bulk';
    readonly profile: string | undefined;
    readonly track: number;
    readonly tokens: string[];
}

export interface DictionaryGetByLemmaBulkMessage extends MessageWithId {
    readonly command: 'dictionary-get-by-lemma-bulk';
    readonly profile: string | undefined;
    readonly track: number;
    readonly lemmas: string[];
}

export interface DictionarySaveRecordLocalBulkMessage extends MessageWithId {
    readonly command: 'dictionary-save-record-local-bulk';
    readonly profile: string | undefined;
    readonly localTokenInputs: DictionaryLocalTokenInput[];
    readonly applyStates: ApplyStrategy;
}

export interface DictionaryDeleteRecordLocalBulkMessage extends MessageWithId {
    readonly command: 'dictionary-delete-record-local-bulk';
    readonly profile: string | undefined;
    readonly tokens: string[];
}

export interface DictionaryDeleteProfileMessage extends MessageWithId {
    readonly command: 'dictionary-delete-profile';
    readonly profile: string;
}

export interface DictionaryExportRecordLocalBulkMessage extends MessageWithId {
    readonly command: 'dictionary-export-record-local-bulk';
}

export interface DictionaryImportRecordLocalBulkMessage extends MessageWithId {
    readonly command: 'dictionary-import-record-local-bulk';
    readonly records: Partial<DictionaryTokenRecord>[];
    readonly profiles: string[];
}

export interface DictionaryGetRecordsMessage extends MessageWithId {
    readonly command: 'dictionary-get-records';
    readonly profile: string | undefined;
    readonly track: number | undefined;
}

export interface DictionaryUpdateRecordsMessage extends MessageWithId {
    readonly command: 'dictionary-update-records';
    readonly profile: string | undefined;
    readonly updates: DictionaryRecordUpdateInput[];
    readonly applyStates: ApplyStrategy;
}

export interface DictionaryDeleteRecordsMessage extends MessageWithId {
    readonly command: 'dictionary-delete-records';
    readonly profile: string | undefined;
    readonly tokenKeys: DictionaryTokenKey[];
}

export interface DictionaryBuildAnkiCacheMessage extends MessageWithId {
    readonly command: 'dictionary-build-anki-cache';
    readonly profile: string | undefined;
    readonly settings: AsbplayerSettings;
}

export interface DictionaryBuildAnkiCacheStateBody {
    modifiedTokens?: string[];
}

export interface DictionaryBuildAnkiCacheState {
    body?: DictionaryBuildAnkiCacheStateBody;
    type: DictionaryBuildAnkiCacheStateType;
}

export interface DictionaryBuildAnkiCacheStateMessage extends DictionaryBuildAnkiCacheState, Message {
    readonly command: 'dictionary-build-anki-cache-state';
}

export enum DictionaryBuildAnkiCacheStateType {
    start = 0,
    unknown = 1,
    error = 2,
    stats = 3,
    progress = 4,
}

export interface DictionaryBuildAnkiCacheStart extends DictionaryBuildAnkiCacheStateBody {
    buildTimestamp: number;
}

export interface Progress {
    current: number;
    total: number;
    startedAt: number;
}

export interface DictionaryBuildAnkiCacheProgress extends DictionaryBuildAnkiCacheStateBody {
    current: number;
    total: number;
    buildTimestamp: number;
    forAnkiSync?: boolean;
}

export interface DictionaryBuildAnkiCacheStats extends DictionaryBuildAnkiCacheStateBody {
    buildTimestamp: number;
    tracksToBuild?: number[];
    tracksToClear?: number[];
    orphanedCards?: number;
    modifiedCards?: number;
}

export enum DictionaryBuildAnkiCacheStateErrorCode {
    concurrentBuild = 1,
    noAnki = 2,
    noYomitan = 3,
    failedToSyncTrackStates = 4,
    failedToBuild = 5,
}

export interface DictionaryBuildAnkiCacheStateErrorTrackNumberData {
    track: number;
}

export interface DictionaryBuildAnkiCacheStateErrorBuildExpirationData {
    expiration: number;
}

export type DictionaryBuildAnkiCacheStateErrorData =
    | DictionaryBuildAnkiCacheStateErrorTrackNumberData
    | DictionaryBuildAnkiCacheStateErrorBuildExpirationData;

export interface DictionaryBuildAnkiCacheStateError extends DictionaryBuildAnkiCacheStateBody {
    code: DictionaryBuildAnkiCacheStateErrorCode;
    msg?: string;
    data?: DictionaryBuildAnkiCacheStateErrorData;
}

export interface SaveTokenLocalMessage extends Message {
    readonly command: 'save-token-local';
    readonly track: number;
    readonly token: string;
    readonly status: TokenStatus | null;
    readonly states: TokenState[];
    readonly applyStates: ApplyStrategy;
}

export interface SaveTokenLocalFromAppMessage extends MessageWithId {
    readonly command: 'save-token-local';
    readonly track: number;
    readonly token: string;
    readonly status: TokenStatus | null;
    readonly states: TokenState[];
    readonly applyStates: ApplyStrategy;
}

export interface SaveTokenLocalFromVideoMessage extends Message {
    readonly command: 'saveTokenLocal';
    readonly track: number;
    readonly token: string;
    readonly status: TokenStatus | null;
    readonly states: TokenState[];
    readonly applyStates: ApplyStrategy;
}

export interface SaveTokenLocalToVideoMessage extends Message {
    readonly command: 'saveTokenLocal';
    readonly track: number;
    readonly token: string;
    readonly status: TokenStatus | null;
    readonly states: TokenState[];
    readonly applyStates: ApplyStrategy;
}

export interface DictionaryGetAllTokensMessage extends MessageWithId {
    readonly command: 'dictionary-get-all-tokens';
    readonly profile: string | undefined;
    readonly track: number;
}

export interface DictionaryStatisticsMessage extends Message {
    readonly command: 'dictionary-statistics';
    readonly mediaId: string;
    readonly snapshot?: DictionaryStatisticsSnapshot;
}

export interface DictionaryRequestStatisticsGenerationMessage extends Message {
    readonly command: 'dictionary-request-statistics-generation';
    readonly mediaId?: string;
}

export interface DictionaryRequestStatisticsSnapshotMessage extends Message {
    readonly command: 'dictionary-request-statistics-snapshot';
    readonly mediaId?: string;
}

export interface DictionaryRequestStatisticsSeekMessage extends Message {
    readonly command: 'dictionary-request-statistics-seek';
    readonly mediaId: string;
    readonly timestamp: number;
}

export interface DictionaryRequestStatisticsMineSentencesMessage extends Message {
    readonly command: 'dictionary-request-statistics-mine-sentences';
    readonly mediaId: string;
    readonly indexes: number[];
}

export interface OpenStatisticsOverlayMessage extends Message {
    readonly command: 'open-statistics-overlay';
    readonly mediaId: string;
    readonly force: boolean;
}

export interface ResizeStatisticsOverlayMessage extends Message {
    readonly command: 'resize-statistics-overlay';
    readonly width: number;
    readonly height: number;
}

export interface MoveStatisticsOverlayMessage extends Message {
    readonly command: 'move-statistics-overlay';
    readonly deltaX: number;
    readonly deltaY: number;
}

export interface CloseStatisticsOverlayMessage extends Message {
    readonly command: 'close-statistics-overlay';
    readonly mediaId: string;
}

export interface FullscreenStatisticsOverlayMessage extends Message {
    readonly command: 'fullscreen-statistics-overlay';
}

export interface RestoreStatisticsOverlayMessage extends Message {
    readonly command: 'restore-statistics-overlay';
}
