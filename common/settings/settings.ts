import type {
    AnkiExportMode,
    PlayMode,
    PostMineAction,
    PostMinePlayback,
    SubtitleHtml,
} from '@project/common/src/model';
import { AutoPausePreference } from '@project/common/src/model';
import { arrayEquals } from '@project/common/util/array-equals';
import type { DictionarySettings } from '@project/common/settings/settings-dictionary';

export const activeProfileKey = 'activeSettingsProfile';
export const profilesKey = 'settingsProfiles';

// Settings visible in UI probably shouldn't ever be here to prevent user confusion.
export const saveOnlySettings: readonly (keyof AsbplayerSettings)[] = [
    'lastSubtitleOffset',
    'lastPlaybackModes',
    'lastPlaybackPositions',
];

export const isSaveOnlySettings = (settings: Partial<AsbplayerSettings>): boolean => {
    const changedKeys = Object.keys(settings) as (keyof AsbplayerSettings)[];
    return changedKeys.every((key) => saveOnlySettings.includes(key));
};

export enum PauseOnHoverMode {
    disabled = 0,
    inAndOut = 1,
    inNotOut = 2,
}

export enum AutoPauseResumeMode {
    manual = 'manual',
    fixed = 'fixed',
    subtitleLength = 'subtitleLength',
}

export enum SubtitleVisibility {
    whenDue = 'whenDue',
    whilePaused = 'whilePaused',
}

export enum VideoSubtitleSplitBehavior {
    rememberSplitPosition = 'rememberSplitPosition',
    autoMaximizeVideo = 'autoMaximizeVideo',
}

export enum SubtitleListTimestampDisplay {
    hidden = 'hidden',
    start = 'start',
    startAndEnd = 'startAndEnd',
}

export interface SubtitleListCustomization {
    readonly showMiningButton: boolean;
    readonly timestampDisplay: SubtitleListTimestampDisplay;
}

export const effectiveSubtitleListCustomization = (
    settings: Pick<MiscSettings, 'showSubtitleListMiningButton' | 'subtitleListTimestampDisplay'>,
    supported: boolean
): SubtitleListCustomization =>
    supported
        ? {
              showMiningButton: settings.showSubtitleListMiningButton,
              timestampDisplay: settings.subtitleListTimestampDisplay,
          }
        : {
              showMiningButton: true,
              timestampDisplay: SubtitleListTimestampDisplay.start,
          };

// Bitsets - if the nth bit is 1 then the nth track is "seekable" where "seekable"
// means that the track is eligible for seeking, and automatic play mode behaviors
export type SeekableTracks = number;
// Bitset - same as above
export type AutoCopyableTracks = number;

export interface PlaybackPosition {
    readonly fileName: string;
    readonly position: number;
}

export interface MiscSettings {
    readonly themeType: 'dark' | 'light';
    readonly videoSubtitleSplitBehavior: VideoSubtitleSplitBehavior;
    readonly showSubtitleListMiningButton: boolean;
    readonly subtitleListTimestampDisplay: SubtitleListTimestampDisplay;
    readonly copyToClipboardOnMine: boolean;
    readonly autoPausePreference: AutoPausePreference;
    readonly autoPauseResumeMode: AutoPauseResumeMode;
    readonly autoPauseResumeDelayMs: number;
    readonly autoPauseFixedDurationMs: number;
    readonly autoPauseMinimumDurationMs: number;
    readonly autoPauseMaximumDurationMs: number;
    readonly autoPauseTimePerCharacterMs: number;
    readonly subtitleVisibility: SubtitleVisibility;
    readonly subtitleTriggerStartOffset: number;
    readonly subtitleTriggerEndOffset: number;
    readonly subtitleTriggerGapEndOffset: number;
    readonly subtitleTriggerGapStartOffset: number;
    readonly seekableTracks: SeekableTracks;
    readonly autoCopyableTracks: AutoCopyableTracks;
    readonly seekDuration: number;
    readonly speedChangeStep: number;
    readonly playbackRate: number;
    readonly playbackRateNotificationEnabled: boolean;
    readonly rememberPlaybackRate: boolean;
    readonly fastForwardModePlaybackRate: number;
    readonly fastForwardPlaybackMinimumSkipIntervalMs: number;
    readonly streamingCondensedPlaybackMinimumSkipIntervalMs: number;
    readonly repeatCountPreference: number;
    readonly rememberPlaybackModes: boolean;
    readonly lastPlaybackModes: PlayMode[];
    readonly lastPlaybackPositions: PlaybackPosition[];
    readonly keyBindSet: KeyBindSet;
    readonly rememberSubtitleOffset: boolean;
    readonly autoCopyCurrentSubtitle: boolean;
    readonly alwaysPlayOnSubtitleRepeat: boolean;
    readonly subtitleHtml: SubtitleHtml;
    readonly subtitleRegexFilter: string;
    readonly subtitleRegexFilterTextReplacement: string;
    readonly convertNetflixRuby: boolean;
    readonly miningHistoryStorageLimit: number;
    readonly language: string;
    readonly clickToMineDefaultAction: PostMineAction;
    readonly postMiningPlaybackState: PostMinePlayback;
    readonly lastSubtitleOffset: number;
    readonly lastSelectedAnkiExportMode: AnkiExportMode;
    readonly tabName: string;
    readonly pauseOnHoverMode: PauseOnHoverMode;
    readonly subtitleAboveThumbnail: boolean;
    readonly thumbnailPreview: boolean;
}

export type AutoPausePreferenceEdge = AutoPausePreference.atStart | AutoPausePreference.atEnd;

export const autoPausePreferenceForCheckboxChange = (
    preference: AutoPausePreference,
    edge: AutoPausePreferenceEdge,
    checked: boolean
): AutoPausePreference => {
    let pauseAtStart = preference !== AutoPausePreference.atEnd;
    let pauseAtEnd = preference !== AutoPausePreference.atStart;

    if (edge === AutoPausePreference.atStart) {
        pauseAtStart = checked;
    } else {
        pauseAtEnd = checked;
    }

    if (!pauseAtStart && !pauseAtEnd) {
        return edge === AutoPausePreference.atStart ? AutoPausePreference.atEnd : AutoPausePreference.atStart;
    }

    return pauseAtStart
        ? pauseAtEnd
            ? AutoPausePreference.atStartAndEnd
            : AutoPausePreference.atStart
        : AutoPausePreference.atEnd;
};

const isIncludedInBitset = (bitset: number, value: number) => ((bitset >> value) & 1) > 0;
const newBitset = (values: number[]) => {
    let val: number = 0;
    for (const i of values) {
        val |= 1 << i;
    }
    return val;
};
const updateBitset = (bitset: number, value: number, add: boolean) => {
    if (add) {
        return bitset | (1 << value);
    }
    return bitset & ~(1 << value);
};

export const isTrackSeekable = (seekable: SeekableTracks, track: number) => isIncludedInBitset(seekable, track);
export const calculateSeekableTracksValue = (trackIndices: number[]): SeekableTracks => newBitset(trackIndices);
export const updateSeekableTracksValue = (seekableTracks: SeekableTracks, trackIndex: number, add: boolean) =>
    updateBitset(seekableTracks, trackIndex, add);

export const isTrackAutoCopyable = (autoCopyableTracks: AutoCopyableTracks, track: number) =>
    isIncludedInBitset(autoCopyableTracks, track);
export const calculateAutoCopyableTracksValue = (trackIndices: number[]): AutoCopyableTracks => newBitset(trackIndices);
export const updateAutoCopyableTracksValue = (
    autoCopyableTracks: AutoCopyableTracks,
    trackIndex: number,
    add: boolean
) => updateBitset(autoCopyableTracks, trackIndex, add);

export type AnkiSettingsFieldKey =
    | 'sentenceField'
    | 'definitionField'
    | 'audioField'
    | 'imageField'
    | 'wordField'
    | 'sourceField'
    | 'urlField'
    | 'track1Field'
    | 'track2Field'
    | 'track3Field';

export type MediaFragmentFormatSetting = 'jpeg' | 'webm';

export interface AnkiSettings {
    readonly ankiConnectUrl: string;
    readonly ankiConnectApiKey: string;
    readonly ankiRefreshBrowserAfterUpdate: boolean;
    readonly deck: string;
    readonly noteType: string;
    readonly sentenceField: string;
    readonly definitionField: string;
    readonly audioField: string;
    readonly imageField: string;
    readonly wordField: string;
    readonly sourceField: string;
    readonly urlField: string;
    readonly track1Field: string;
    readonly track2Field: string;
    readonly track3Field: string;
    readonly customAnkiFields: { [key: string]: string };
    readonly tags: string[];
    readonly recordWithAudioPlayback: boolean;
    readonly preferMp3: boolean;
    readonly audioPaddingStart: number;
    readonly audioPaddingEnd: number;
    readonly maxImageWidth: number;
    readonly maxImageHeight: number;
    readonly mediaFragmentFormat: MediaFragmentFormatSetting;
    readonly mediaFragmentTrimStart: number;
    readonly mediaFragmentTrimEnd: number;
    readonly mediaFragmentMaxClipLength: number;
    readonly surroundingSubtitlesCountRadius: number;
    readonly surroundingSubtitlesTimeRadius: number;
    readonly ankiFieldSettings: AnkiFieldSettings;
    readonly customAnkiFieldSettings: CustomAnkiFieldSettings;
}

export interface AnkiField {
    readonly order: number;
    readonly display: boolean;
}

export interface AnkiFieldSettings {
    readonly sentence: AnkiField;
    readonly definition: AnkiField;
    readonly audio: AnkiField;
    readonly image: AnkiField;
    readonly word: AnkiField;
    readonly source: AnkiField;
    readonly url: AnkiField;
    readonly track1: AnkiField;
    readonly track2: AnkiField;
    readonly track3: AnkiField;
}

export type CustomAnkiFieldSettings = { [key: string]: AnkiField };

const ankiSettingsKeysObject: { [key in keyof AnkiSettings]: boolean } = {
    ankiConnectUrl: true,
    ankiConnectApiKey: true,
    ankiRefreshBrowserAfterUpdate: true,
    deck: true,
    noteType: true,
    sentenceField: true,
    definitionField: true,
    audioField: true,
    imageField: true,
    wordField: true,
    sourceField: true,
    urlField: true,
    track1Field: true,
    track2Field: true,
    track3Field: true,
    customAnkiFields: true,
    tags: true,
    recordWithAudioPlayback: true,
    preferMp3: true,
    audioPaddingStart: true,
    audioPaddingEnd: true,
    maxImageWidth: true,
    maxImageHeight: true,
    mediaFragmentFormat: true,
    mediaFragmentTrimStart: true,
    mediaFragmentTrimEnd: true,
    mediaFragmentMaxClipLength: true,
    surroundingSubtitlesCountRadius: true,
    surroundingSubtitlesTimeRadius: true,
    ankiFieldSettings: true,
    customAnkiFieldSettings: true,
};

export const ankiSettingsKeys: (keyof AnkiSettings)[] = Object.keys(ankiSettingsKeysObject) as (keyof AnkiSettings)[];

const textSubtitleSettingsKeysObject: { [key in keyof TextSubtitleSettings]: boolean } = {
    subtitleColor: true,
    subtitleSize: true,
    subtitleThickness: true,
    subtitleOutlineThickness: true,
    subtitleOutlineColor: true,
    subtitleShadowThickness: true,
    subtitleShadowColor: true,
    subtitleBackgroundOpacity: true,
    subtitleBackgroundColor: true,
    subtitleFontFamily: true,
    subtitleCustomStyles: true,
    subtitleBlur: true,
    subtitleAlignment: true,
};

export const textSubtitleSettingsKeys: (keyof TextSubtitleSettings)[] = Object.keys(
    textSubtitleSettingsKeysObject
) as (keyof TextSubtitleSettings)[];

const subtitleSettingsKeysObject: { [key in keyof SubtitleSettings]: boolean } = {
    subtitleColor: true,
    subtitleSize: true,
    subtitleThickness: true,
    subtitleOutlineThickness: true,
    subtitleOutlineColor: true,
    subtitleShadowThickness: true,
    subtitleShadowColor: true,
    subtitleBackgroundOpacity: true,
    subtitleBackgroundColor: true,
    subtitleFontFamily: true,
    subtitleCustomStyles: true,
    subtitleBlur: true,
    imageBasedSubtitleScaleFactor: true,
    subtitlePositionOffset: true, // bottom offset; name kept for backwards compatibility
    topSubtitlePositionOffset: true,
    subtitleAlignment: true,
    subtitleTracksV2: true,
    subtitlesWidth: true,
};

export const subtitleSettingsKeys: (keyof SubtitleSettings)[] = Object.keys(
    subtitleSettingsKeysObject
) as (keyof SubtitleSettings)[];

export const extractAnkiSettings = <T extends AnkiSettings>(settings: T): AnkiSettings => {
    return Object.fromEntries(ankiSettingsKeys.map((k) => [k, settings[k]])) as unknown as AnkiSettings;
};

export interface CustomStyle {
    readonly key: string;
    readonly value: string;
}

export interface TextSubtitleSettings {
    readonly subtitleColor: string;
    readonly subtitleSize: number;
    readonly subtitleThickness: number;
    readonly subtitleOutlineThickness: number;
    readonly subtitleOutlineColor: string;
    readonly subtitleShadowThickness: number;
    readonly subtitleShadowColor: string;
    readonly subtitleBackgroundOpacity: number;
    readonly subtitleBackgroundColor: string;
    readonly subtitleFontFamily: string;
    readonly subtitleCustomStyles: CustomStyle[];
    readonly subtitleBlur: boolean;
    readonly subtitleAlignment: SubtitleAlignment;
}

export interface SubtitleSettings extends TextSubtitleSettings {
    readonly imageBasedSubtitleScaleFactor: number;
    readonly subtitlePositionOffset: number;
    readonly topSubtitlePositionOffset: number;

    // Settings for (0-based) tracks 1, 2,...
    // We don't configure track 0 here to avoid having to migrate old settings into this new data structure.
    // Track 0 continues to be configured from the top-level settings object.
    readonly subtitleTracksV2: TextSubtitleSettings[];

    // Percentage of containing video width; -1 means 'auto'
    readonly subtitlesWidth: number;
}

const textSubtitleSettingsComparators: {
    [K in keyof TextSubtitleSettings]: (a: TextSubtitleSettings[K], b: TextSubtitleSettings[K]) => boolean;
} = {
    subtitleColor: (a, b) => a === b,
    subtitleSize: (a, b) => a === b,
    subtitleThickness: (a, b) => a === b,
    subtitleOutlineThickness: (a, b) => a === b,
    subtitleOutlineColor: (a, b) => a === b,
    subtitleShadowThickness: (a, b) => a === b,
    subtitleShadowColor: (a, b) => a === b,
    subtitleBackgroundOpacity: (a, b) => a === b,
    subtitleBackgroundColor: (a, b) => a === b,
    subtitleFontFamily: (a, b) => a === b,
    subtitleCustomStyles: (a, b) =>
        arrayEquals(a, b, (left, right) => left.key === right.key && left.value === right.value),
    subtitleBlur: (a, b) => a === b,
    subtitleAlignment: (a, b) => a === b,
};

const subtitleSettingsComparators: {
    [K in keyof SubtitleSettings]: (a: SubtitleSettings[K], b: SubtitleSettings[K]) => boolean;
} = {
    ...textSubtitleSettingsComparators,
    imageBasedSubtitleScaleFactor: (a, b) => a === b,
    subtitlePositionOffset: (a, b) => a === b,
    topSubtitlePositionOffset: (a, b) => a === b,
    subtitleTracksV2: (a, b) => arrayEquals(a, b, areTextSubtitleSettingsEqual),
    subtitlesWidth: (a, b) => a === b,
};

function areTextSubtitleSettingsEqual(
    left: TextSubtitleSettings | undefined,
    right: TextSubtitleSettings | undefined
): boolean {
    if (left === right) return true;
    if (!left || !right) return false;

    for (const key of Object.keys(textSubtitleSettingsComparators) as (keyof TextSubtitleSettings)[]) {
        if (!compareTextSubtitleSettingsField(key, left, right)) {
            return false;
        }
    }
    return true;
}

function compareTextSubtitleSettingsField<K extends keyof TextSubtitleSettings>(
    key: K,
    left: TextSubtitleSettings,
    right: TextSubtitleSettings
): boolean {
    return textSubtitleSettingsComparators[key](left[key], right[key]);
}

export function compareSubtitleSettingsField<K extends keyof SubtitleSettings>(
    key: K,
    a: SubtitleSettings,
    b: SubtitleSettings
): boolean {
    return subtitleSettingsComparators[key](a[key], b[key]);
}

export function areSubtitleSettingsEqual(left: SubtitleSettings | undefined, right: SubtitleSettings | undefined) {
    if (left === right) return true;
    if (!left || !right) return false;

    for (const key in subtitleSettingsComparators) {
        if (!compareSubtitleSettingsField(key as keyof SubtitleSettings, left, right)) {
            return false;
        }
    }
    return true;
}

export interface KeyBind {
    readonly keys: string;
}

export interface KeyBindSet {
    readonly togglePlay: KeyBind;
    readonly toggleAutoPause: KeyBind;
    readonly toggleCondensedPlayback: KeyBind;
    readonly toggleFastForwardPlayback: KeyBind;
    readonly toggleSubtitles: KeyBind;
    readonly toggleVideoSubtitleTrack1: KeyBind;
    readonly toggleVideoSubtitleTrack2: KeyBind;
    readonly toggleVideoSubtitleTrack3: KeyBind;
    readonly toggleAsbplayerSubtitleTrack1: KeyBind;
    readonly toggleAsbplayerSubtitleTrack2: KeyBind;
    readonly toggleAsbplayerSubtitleTrack3: KeyBind;
    readonly unblurAsbplayerTrack1: KeyBind;
    readonly unblurAsbplayerTrack2: KeyBind;
    readonly unblurAsbplayerTrack3: KeyBind;
    readonly seekBackward: KeyBind;
    readonly seekForward: KeyBind;
    readonly seekToPreviousSubtitle: KeyBind;
    readonly seekToNextSubtitle: KeyBind;
    readonly seekToBeginningOfCurrentSubtitle: KeyBind;
    readonly adjustOffsetToPreviousSubtitle: KeyBind;
    readonly adjustOffsetToNextSubtitle: KeyBind;
    readonly decreaseOffset: KeyBind;
    readonly increaseOffset: KeyBind;
    readonly resetOffset: KeyBind;
    readonly decreasePlaybackRate: KeyBind;
    readonly increasePlaybackRate: KeyBind;
    readonly toggleSidePanel: KeyBind;
    readonly toggleRepeat: KeyBind;
    readonly toggleSubtitleVisibility: KeyBind;
    readonly cycleAutoPauseResumeMode: KeyBind;
    readonly moveBottomSubtitlesUp: KeyBind;
    readonly moveBottomSubtitlesDown: KeyBind;
    readonly moveTopSubtitlesUp: KeyBind;
    readonly moveTopSubtitlesDown: KeyBind;
    readonly openStatistics: KeyBind;
    readonly jumpToNextToken: KeyBind;
    readonly jumpToPreviousToken: KeyBind;
    readonly markHoveredToken5: KeyBind;
    readonly jumpToNextTokenStatus5: KeyBind;
    readonly jumpToPreviousTokenStatus5: KeyBind;
    readonly markHoveredToken4: KeyBind;
    readonly jumpToNextTokenStatus4: KeyBind;
    readonly jumpToPreviousTokenStatus4: KeyBind;
    readonly markHoveredToken3: KeyBind;
    readonly jumpToNextTokenStatus3: KeyBind;
    readonly jumpToPreviousTokenStatus3: KeyBind;
    readonly markHoveredToken2: KeyBind;
    readonly jumpToNextTokenStatus2: KeyBind;
    readonly jumpToPreviousTokenStatus2: KeyBind;
    readonly markHoveredToken1: KeyBind;
    readonly jumpToNextTokenStatus1: KeyBind;
    readonly jumpToPreviousTokenStatus1: KeyBind;
    readonly markHoveredToken0: KeyBind;
    readonly jumpToNextTokenStatus0: KeyBind;
    readonly jumpToPreviousTokenStatus0: KeyBind;
    readonly toggleHoveredTokenIgnored: KeyBind;
    readonly jumpToNextTokenState0: KeyBind;
    readonly jumpToPreviousTokenState0: KeyBind;

    // Bound from Chrome if extension is installed
    readonly copySubtitle: KeyBind;
    readonly ankiExport: KeyBind;
    readonly updateLastCard: KeyBind;
    readonly exportCard: KeyBind;
    readonly takeScreenshot: KeyBind;
    readonly toggleRecording: KeyBind;
    readonly selectSubtitleTrack: KeyBind;
}

export interface WebSocketClientSettings {
    readonly webSocketServerUrl: string;
    readonly webSocketClientEnabled: boolean;
}

export type ChromeBoundKeyBindName =
    | 'copySubtitle'
    | 'ankiExport'
    | 'updateLastCard'
    | 'updateSelectedCard'
    | 'exportCard'
    | 'takeScreenshot';
export type SubtitleAlignment = 'top' | 'bottom';
export enum SubtitleListPreference {
    noSubtitleList = 'noSubtitleList',
    app = 'app',
}

export interface PageConfig {
    hostRegex: string;
    syncAllowedAtPath?: string;
    syncAllowedAtHash?: string;
    searchShadowRootsForVideoElements?: boolean;
    allowVideoElementsWithBlankSrc?: boolean;
    autoSyncEnabled?: boolean;
    autoSyncVideoSrc?: string;
    autoSyncElementId?: string;
    ignoreVideoElementsClass?: string;
}

export interface SettingsFormPageConfig extends PageConfig {
    faviconUrl: string;
}

export type MutablePageConfig = Omit<PageConfig, 'hostRegex'>;

export interface Page {
    overrides?: Partial<MutablePageConfig>;
    additionalHosts?: string[];
}

export interface YoutubePage extends Page {
    targetLanguages?: string[];
}

export interface PageSettings {
    netflix: Page;
    youtube: YoutubePage;
    tver: Page;
    bandaiChannel: Page;
    amazonPrime: Page;
    hulu: Page;
    huluJp: Page;
    disneyPlus: Page;
    appsDisneyPlus: Page;
    unext: Page;
    viki: Page;
    embyJellyfin: Page;
    twitch: Page;
    osnPlus: Page;
    bilibili: Page;
    nrktv: Page;
    plex: Page;
    yleAreena: Page;
    hboMax: Page;
    stremio: Page;
    cijapanese: Page;
    iwanttfc: Page;
    svtplay: Page;
    urplay: Page;
    archive: Page;
    crunchyroll: Page;
}

export interface StreamingVideoSettings {
    readonly streamingAppUrl: string;
    readonly streamingDisplaySubtitles: boolean;
    readonly streamingRecordMedia: boolean;
    readonly streamingTakeScreenshot: boolean;
    readonly streamingCleanScreenshot: boolean;
    readonly streamingCropScreenshot: boolean;
    readonly streamingSubsDragAndDrop: boolean;
    readonly streamingAutoSync: boolean;
    readonly streamingAutoSyncPromptOnFailure: boolean;
    // Last language selected in subtitle track selector, keyed by domain
    // Used to auto-selecting a language in subtitle track selector, if it's available
    readonly streamingLastLanguagesSynced: { [key: string]: string[] };
    readonly streamingScreenshotDelay: number;
    readonly streamingSubtitleListPreference: SubtitleListPreference;
    readonly streamingEnableOverlay: boolean;
    readonly streamingPages: PageSettings;
}

export type KeyBindName = keyof KeyBindSet;

export interface AsbplayerSettings
    extends MiscSettings,
        AnkiSettings,
        SubtitleSettings,
        DictionarySettings,
        StreamingVideoSettings,
        WebSocketClientSettings {
    readonly subtitlePreview: string;
}

const keyBindNameMap: any = {
    'copy-subtitle': 'copySubtitle',
    'copy-subtitle-with-dialog': 'ankiExport',
    'update-last-card': 'updateLastCard',
    'update-selected-card': 'updateSelectedCard',
    'export-card': 'exportCard',
    'take-screenshot': 'takeScreenshot',
    'toggle-recording': 'toggleRecording',
    'toggle-video-select': 'selectSubtitleTrack',
};

export function chromeCommandBindsToKeyBinds(chromeCommands: { [key: string]: string | undefined }) {
    const keyBinds: { [key: string]: string | undefined } = {};

    for (const commandName of Object.keys(chromeCommands)) {
        keyBinds[keyBindNameMap[commandName]] = chromeCommands[commandName];
    }

    return keyBinds;
}
