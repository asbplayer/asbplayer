import type { AnkiSettings, TokenState, TokenStatus } from '../settings/settings';
import type { OnlineSubtitleSourceConfig } from '../global-state';

type Profile = { name: string };

export interface RectModel {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}

export interface DimensionsModel {
    readonly width: number;
    readonly height: number;
}

export interface SubtitleTextImage {
    readonly dataUrl: string;
    readonly screen: DimensionsModel;
    readonly image: DimensionsModel;
}

export interface TokenReading {
    pos: [number, number]; // Start/end relative position inside parent token
    reading: string;
}

export interface Token {
    pos: [number, number]; // Start/end relative position inside parent text
    states: TokenState[];
    status?: TokenStatus | null; // null means "error"
    readings: TokenReading[];
    frequency?: number | null; // null means no frequency data
    groupingKey?: string; // Stable key for equivalence aggregation
}

export interface Tokenization {
    tokens: Token[];
    error?: boolean;
}

export interface SubtitleModel {
    readonly text: string;
    readonly textImage?: SubtitleTextImage;
    readonly start: number;
    readonly end: number;
    readonly originalStart: number;
    readonly originalEnd: number;
    readonly track: number;
    readonly index?: number;
    readonly tokenization?: Tokenization;
    readonly richText?: string;
}

export interface IndexedSubtitleModel extends SubtitleModel {
    readonly index: number;
}

export interface RichSubtitleModel extends IndexedSubtitleModel {
    richText?: string;
}

export interface TokenizedSubtitleModel extends RichSubtitleModel {
    originalText?: string;
    tokenization?: Tokenization;
}

export interface CardTextFieldValues {
    readonly word?: string;
    readonly definition?: string;
    readonly text?: string;
    readonly customFieldValues?: { [fieldName: string]: string };
}

export interface CardModel extends CardTextFieldValues {
    readonly id?: string;
    readonly subtitle: SubtitleModel;
    readonly surroundingSubtitles: SubtitleModel[];
    readonly subtitleFileName: string;
    readonly url?: string;
    readonly image?: ImageModel;
    readonly audio?: AudioModel;
    readonly file?: FileModel;
    readonly mediaTimestamp: number;
}

export interface FileModel {
    readonly name: string;
    readonly blobUrl: string;
    readonly playbackRate?: number;
    readonly audioTrack?: string;
}

export interface CopyHistoryItem extends CardModel {
    readonly id: string;
    readonly timestamp: number;
}

export enum MediaFragmentErrorCode {
    captureFailed = 1,
    fileLinkLost = 2,
}

export interface MediaFragmentModel {
    readonly base64: string;
    readonly extension: 'jpeg' | 'webm';
    readonly error?: MediaFragmentErrorCode;
}

export const ImageErrorCode = MediaFragmentErrorCode;
export type ImageErrorCode = MediaFragmentErrorCode;
export type ImageModel = MediaFragmentModel;

export enum AudioErrorCode {
    drmProtected = 1,
    fileLinkLost = 2,
}

export interface AudioModel {
    readonly base64: string;
    readonly extension: 'webm' | 'mp3';
    readonly paddingStart: number;
    readonly paddingEnd: number;
    readonly start?: number;
    readonly end?: number;
    readonly playbackRate?: number;
    readonly error?: AudioErrorCode;
}

export type AnkiExportMode = 'gui' | 'updateLast' | 'default';

export interface AnkiDialogSettings extends AnkiSettings {
    themeType: string;
    lastSelectedAnkiExportMode: AnkiExportMode;
}

export interface AnkiUiState extends CardTextFieldValues {
    readonly type: 'initial' | 'resume';
    readonly open: boolean;
    readonly canRerecord: boolean;
    readonly settings: AnkiDialogSettings;
    readonly profiles: Profile[];
    readonly activeProfile?: string;
    readonly ftueHasSeenAnkiDialogQuickSelect: boolean;
    readonly subtitle: SubtitleModel;
    readonly surroundingSubtitles: SubtitleModel[];
    readonly url?: string;
    readonly source: string;
    readonly image?: ImageModel;
    readonly audio?: AudioModel;
    readonly file?: FileModel;
    readonly dialogRequestedTimestamp: number;
    readonly inTutorial: boolean;
}

export interface AnkiUiInitialState extends AnkiUiState {
    readonly type: 'initial';
}

export interface AnkiUiResumeState extends AnkiUiState {
    readonly type: 'resume';
    readonly text: string;
    readonly initialTimestampInterval: number[];
    readonly timestampInterval: number[];
    readonly timestampBoundaryInterval?: number[];
    readonly definition: string;
    readonly word: string;
    readonly customFieldValues: { [key: string]: string };
    readonly lastAppliedTimestampIntervalToText: number[];
    readonly lastAppliedTimestampIntervalToAudio?: number[];
}

export interface AnkiUiSavedState {
    subtitle: SubtitleModel;
    surroundingSubtitles: SubtitleModel[];
    text: string;
    definition: string;
    image?: ImageModel;
    audio?: AudioModel;
    file?: FileModel;
    word: string;
    source: string;
    url: string;
    customFieldValues: { [key: string]: string };
    timestampInterval: number[];
    initialTimestampInterval: number[];
    timestampBoundaryInterval?: number[];
    lastAppliedTimestampIntervalToText: number[];
    lastAppliedTimestampIntervalToAudio?: number[];
    dialogRequestedTimestamp: number;
}

export interface VideoDataSubtitleTrackDef {
    label: string;
    language?: string;
    url: string | string[];
    extension: string;
    localFile?: boolean;
}

export interface VideoDataSubtitleTrack extends VideoDataSubtitleTrackDef {
    id: string;
}

export interface ConfirmedVideoDataSubtitleTrack extends VideoDataSubtitleTrack {
    name: string;
}

export interface VideoData {
    basename: string;
    error?: string;
    subtitles?: VideoDataSubtitleTrack[];
}

export enum VideoDataUiOpenReason {
    miningCommand = 1,
    failedToAutoLoadPreferredTrack = 2,
    userRequested = 3,
}

export interface VideoDataUiSettings {
    themeType?: string;
    profiles: Profile[];
    activeProfile?: string;
}

export interface VideoDataUiModel {
    open?: boolean;
    isLoading?: boolean;
    suggestedName?: string;
    subtitles?: VideoDataSubtitleTrack[];
    error?: string;
    selectedSubtitle?: string[];
    showSubSelect?: boolean;
    openReason?: VideoDataUiOpenReason;
    openedFromAsbplayerId?: string;
    defaultCheckboxState?: boolean;
    onlineSubtitleSourceConfig?: OnlineSubtitleSourceConfig;
    settings: VideoDataUiSettings;
    hasSeenFtue: boolean;
    hideRememberTrackPreferenceToggle: boolean;
}

export interface VideoTabModel {
    id: number; // Actually the tab ID
    title?: string;
    src: string; // Video src
    subscribed: boolean; // Whether the video element is subscribed to extension messages
    synced: boolean; // Whether the video element has received subtitles
    loadedSubtitles: boolean; // Whether a non-empty subtitle track is loaded
    syncedTimestamp?: number;
    faviconUrl?: string;
}

export interface Rgb {
    r: number;
    g: number;
    b: number;
}

export interface AudioTrackModel {
    id: string;
    label: string;
    language: string;
}

export enum PostMineAction {
    none = 0,
    showAnkiDialog = 1,
    updateLastCard = 2,
    exportCard = 3,
}

export enum PostMinePlayback {
    remember = 0,
    play = 1,
    pause = 2,
}

export enum AutoPausePreference {
    atStart = 1,
    atEnd = 2,
}

export enum SubtitleHtml {
    remove = 0,
    render = 1,
}

export enum PlayMode {
    normal = 1,
    condensed = 2,
    autoPause = 3,
    fastForward = 4,
    repeat = 5,
}

export interface MobileOverlayModel {
    offset: number;
    playbackRate: number;
    emptySubtitleTrack: boolean;
    recordingEnabled: boolean;
    recording: boolean;
    previousSubtitleTimestamp?: number;
    nextSubtitleTimestamp?: number;
    currentTimestamp: number;
    language?: string;
    postMineAction: PostMineAction;
    subtitleDisplaying: boolean;
    subtitlesAreVisible: boolean;
    themeType: 'dark' | 'light';
    playModes: PlayMode[];
}

export enum ControlType {
    timeDisplay = 0,
    subtitleOffset = 1,
    playbackRate = 2,
}

export interface BrowserFeatures {
    sidePanel: boolean;
}
