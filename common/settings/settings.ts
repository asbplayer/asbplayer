import {
    AnkiExportMode,
    AutoPausePreference,
    PostMineAction,
    PostMinePlayback,
    SeekableTracks,
    SubtitleHtml,
} from '../src/model';
import { arrayEquals } from '../util';

export enum PauseOnHoverMode {
    disabled = 0,
    inAndOut = 1,
    inNotOut = 2,
}

export enum VideoSubtitleSplitBehavior {
    rememberSplitPosition = 'rememberSplitPosition',
    autoMaximizeVideo = 'autoMaximizeVideo',
}

export interface MiscSettings {
    readonly themeType: 'dark' | 'light';
    readonly videoSubtitleSplitBehavior: VideoSubtitleSplitBehavior;
    readonly copyToClipboardOnMine: boolean;
    readonly autoPausePreference: AutoPausePreference;
    readonly seekableTracks: SeekableTracks;
    readonly seekDuration: number;
    readonly speedChangeStep: number;
    readonly fastForwardModePlaybackRate: number;
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
}

export const isTrackSeekable = (seekable: SeekableTracks, track: number) => {
    return ((seekable >> track) & 1) > 0;
};

export const calculateSeekableTracksValue = (trackIndices: number[]): SeekableTracks => {
    let val: SeekableTracks = 0;
    for (const i of trackIndices) {
        val |= 1 << i;
    }
    return val;
};

export const updateSeekableTracksValue = (seekableTracks: SeekableTracks, trackIndex: number, add: boolean) => {
    if (add) {
        return seekableTracks | (1 << trackIndex);
    }
    return seekableTracks & ~(1 << trackIndex);
};

export enum DictionaryTokenSource {
    LOCAL = 0,
    ANKI_WORD = 1,
    ANKI_SENTENCE = 2,
}

/*
These are all the possible scenarios which can result in a match. We don't need to support every possible combination,
as some are not useful or inconsistent. Inconsistent meaning the order the user collects forms affects what future forms
are considered collected (e.g collecting the lemma will match all forms but user needs to collect every inflection if
they don't ever collect the lemma).

Lemma In Subtitle
-----------------------------------------------------------------
| User Collection | LEMMA_FORM_COLLECTED | EXACT_FORM_COLLECTED |
-----------------------------------------------------------------
| Lemma           |         MATCH        |         MATCH        |
| Inflection      |          NO          |          NO          |
-----------------------------------------------------------------

Inflection In Subtitle
-----------------------------------------------------------------
| User Collection | LEMMA_FORM_COLLECTED | EXACT_FORM_COLLECTED |
-----------------------------------------------------------------
| Lemma           |         MATCH        |          NO          |
| Same Inflection |          NO          |         MATCH        |
| Diff Inflection |          NO          |          NO          |
-----------------------------------------------------------------
*/
export enum TokenMatchStrategy {
    ANY_FORM_COLLECTED = 'ANY_FORM_COLLECTED', // All scenarios above result in MATCH
    LEMMA_OR_EXACT_FORM_COLLECTED = 'LEMMA_OR_EXACT_FORM_COLLECTED', // See LEMMA_FORM_COLLECTED and EXACT_FORM_COLLECTED columns above
    LEMMA_FORM_COLLECTED = 'LEMMA_FORM_COLLECTED', // See LEMMA_FORM_COLLECTED column above
    EXACT_FORM_COLLECTED = 'EXACT_FORM_COLLECTED', // See EXACT_FORM_COLLECTED column above
}

export enum TokenMatchStrategyPriority {
    EXACT = 'EXACT',
    LEMMA = 'LEMMA',
    BEST_KNOWN = 'BEST_KNOWN',
    LEAST_KNOWN = 'LEAST_KNOWN',
}

export enum TokenStyling {
    TEXT = 'TEXT',
    BACKGROUND = 'BACKGROUND',
    UNDERLINE = 'UNDERLINE',
    OVERLINE = 'OVERLINE',
    OUTLINE = 'OUTLINE',
}

export enum TokenStatus {
    UNCOLLECTED = 0,
    UNKNOWN = 1,
    LEARNING = 2,
    GRADUATED = 3,
    YOUNG = 4,
    MATURE = 5, // If ever adding more statuses, they should go last and getFullyKnownTokenStatus should be updated
}

export function getFullyKnownTokenStatus(): TokenStatus {
    return TokenStatus.MATURE; // If future statuses are optional, this logic may need to change
}

export function isTokenStatusKnown(status: TokenStatus): boolean {
    return status >= TokenStatus.LEARNING;
}

// Any future field added will likely need to be optional for app/extension version mismatch
export interface TokenStatusConfig {
    readonly display: boolean;
    readonly color: string;
    readonly alpha: string;
}

const tokenStatusConfigComparators: {
    [K in keyof TokenStatusConfig]: (a: TokenStatusConfig[K], b: TokenStatusConfig[K]) => boolean;
} = {
    display: (a, b) => a === b,
    color: (a, b) => a === b,
    alpha: (a, b) => a === b,
};

export function compareTokenStatusConfigField<K extends keyof TokenStatusConfig>(
    key: K,
    a: TokenStatusConfig,
    b: TokenStatusConfig
): boolean {
    return tokenStatusConfigComparators[key](a[key], b[key]);
}

export function areTokenStatusConfigsEqual(a: TokenStatusConfig, b: TokenStatusConfig): boolean {
    if (a === b) return true;
    for (const key in tokenStatusConfigComparators) {
        if (!compareTokenStatusConfigField(key as keyof TokenStatusConfig, a, b)) {
            return false;
        }
    }
    return true;
}

export enum TokenState {
    IGNORED = 0, // If ever adding more states, they should go last (if adding colors for states, use a separate array from dictionaryTokenStatusColors indexed by TokenState)
}

export enum ApplyStrategy {
    ADD = 'ADD',
    REMOVE = 'REMOVE',
    REPLACE = 'REPLACE',
    TOGGLE = 'TOGGLE',
}

export enum TokenReadingAnnotation {
    ALWAYS = 'ALWAYS',
    LEARNING_OR_BELOW = 'LEARNING_OR_BELOW',
    UNKNOWN_OR_BELOW = 'UNKNOWN_OR_BELOW',
    NEVER = 'NEVER',
}

export enum TokenFrequencyAnnotation {
    ALWAYS = 'ALWAYS',
    UNCOLLECTED_ONLY = 'UNCOLLECTED_ONLY',
    NEVER = 'NEVER',
}

export function dictionaryTrackEnabled(dt: DictionaryTrack): boolean {
    return (
        dt.dictionaryColorizeSubtitles ||
        dt.dictionaryAutoGenerateStatistics ||
        dt.dictionaryTokenReadingAnnotation !== TokenReadingAnnotation.NEVER ||
        dt.dictionaryDisplayIgnoredTokenReadings ||
        dt.dictionaryTokenFrequencyAnnotation !== TokenFrequencyAnnotation.NEVER
    );
}

export function dictionaryStatusCollectionEnabled(dt: DictionaryTrack): boolean {
    return (
        dt.dictionaryColorizeSubtitles ||
        dt.dictionaryAutoGenerateStatistics ||
        dt.dictionaryTokenReadingAnnotation === TokenReadingAnnotation.LEARNING_OR_BELOW ||
        dt.dictionaryTokenReadingAnnotation === TokenReadingAnnotation.UNKNOWN_OR_BELOW ||
        dt.dictionaryTokenFrequencyAnnotation === TokenFrequencyAnnotation.UNCOLLECTED_ONLY
    );
}

export interface DictionaryTrack {
    readonly dictionaryColorizeSubtitles: boolean;
    readonly dictionaryAutoGenerateStatistics: boolean;
    readonly dictionaryColorizeOnHoverOnly: boolean; // Currently applies to both colorization and reading annotations, named in case we want to separate later
    readonly dictionaryHighlightOnHover: boolean;
    readonly dictionaryTokenMatchStrategy: TokenMatchStrategy;
    readonly dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority;
    readonly dictionaryYomitanUrl: string;
    readonly dictionaryYomitanParser: 'scanning-parser' | 'mecab';
    readonly dictionaryYomitanScanLength: number;
    readonly dictionaryTokenReadingAnnotation: TokenReadingAnnotation;
    readonly dictionaryDisplayIgnoredTokenReadings: boolean;
    readonly dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation;
    readonly dictionaryAnkiDecks: string[];
    readonly dictionaryAnkiWordFields: string[];
    readonly dictionaryAnkiSentenceFields: string[];
    readonly dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy;
    readonly dictionaryAnkiMatureCutoff: number;
    readonly dictionaryAnkiTreatSuspended: TokenStatus | 'NORMAL';
    readonly dictionaryTokenStyling: TokenStyling;
    readonly dictionaryTokenStylingThickness: number;
    readonly dictionaryColorizeFullyKnownTokens: boolean; // Deprecated in favor of dictionaryTokenStatusConfig
    readonly dictionaryTokenStatusColors: string[]; // Deprecated in favor of dictionaryTokenStatusConfig
    readonly dictionaryTokenStatusConfig: TokenStatusConfig[]; // Indexed by TokenStatus (if adding config for states, use a separate array indexed by TokenState)
}

export interface DictionarySettings {
    readonly dictionaryTracks: DictionaryTrack[];
}

const dictionaryTrackComparators: {
    [K in keyof DictionaryTrack]: (a: DictionaryTrack[K], b: DictionaryTrack[K]) => boolean;
} = {
    dictionaryColorizeSubtitles: (a, b) => a === b,
    dictionaryAutoGenerateStatistics: (a, b) => a === b,
    dictionaryColorizeOnHoverOnly: (a, b) => a === b,
    dictionaryHighlightOnHover: (a, b) => a === b,
    dictionaryTokenMatchStrategy: (a, b) => a === b,
    dictionaryTokenMatchStrategyPriority: (a, b) => a === b,
    dictionaryYomitanUrl: (a, b) => a === b,
    dictionaryYomitanParser: (a, b) => a === b,
    dictionaryYomitanScanLength: (a, b) => a === b,
    dictionaryTokenReadingAnnotation: (a, b) => a === b,
    dictionaryDisplayIgnoredTokenReadings: (a, b) => a === b,
    dictionaryTokenFrequencyAnnotation: (a, b) => a === b,
    dictionaryAnkiDecks: (a, b) => arrayEquals(a, b),
    dictionaryAnkiWordFields: (a, b) => arrayEquals(a, b),
    dictionaryAnkiSentenceFields: (a, b) => arrayEquals(a, b),
    dictionaryAnkiSentenceTokenMatchStrategy: (a, b) => a === b,
    dictionaryAnkiMatureCutoff: (a, b) => a === b,
    dictionaryAnkiTreatSuspended: (a, b) => a === b,
    dictionaryTokenStyling: (a, b) => a === b,
    dictionaryTokenStylingThickness: (a, b) => a === b,
    dictionaryColorizeFullyKnownTokens: (a, b) => a === b,
    dictionaryTokenStatusColors: (a, b) => arrayEquals(a, b),
    dictionaryTokenStatusConfig: (a, b) => arrayEquals(a, b, areTokenStatusConfigsEqual),
};

export function compareDTField<K extends keyof DictionaryTrack>(
    key: K,
    a: DictionaryTrack,
    b: DictionaryTrack
): boolean {
    return dictionaryTrackComparators[key](a[key], b[key]);
}

export function areDictionaryTracksEqual(dt1: DictionaryTrack, dt2: DictionaryTrack): boolean {
    if (dt1 === dt2) return true;
    for (const key in dictionaryTrackComparators) {
        if (!compareDTField(key as keyof DictionaryTrack, dt1, dt2)) {
            return false;
        }
    }
    return true;
}

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
    readonly moveBottomSubtitlesUp: KeyBind;
    readonly moveBottomSubtitlesDown: KeyBind;
    readonly moveTopSubtitlesUp: KeyBind;
    readonly moveTopSubtitlesDown: KeyBind;
    readonly markHoveredToken5: KeyBind;
    readonly markHoveredToken4: KeyBind;
    readonly markHoveredToken3: KeyBind;
    readonly markHoveredToken2: KeyBind;
    readonly markHoveredToken1: KeyBind;
    readonly markHoveredToken0: KeyBind;
    readonly toggleHoveredTokenIgnored: KeyBind;
    readonly openStatistics: KeyBind;

    // Bound from Chrome if extension is installed
    readonly copySubtitle: KeyBind;
    readonly ankiExport: KeyBind;
    readonly updateLastCard: KeyBind;
    readonly exportCard: KeyBind;
    readonly takeScreenshot: KeyBind;
    readonly toggleRecording: KeyBind;
}

export interface WebSocketClientSettings {
    readonly webSocketServerUrl: string;
    readonly webSocketClientEnabled: boolean;
}

export type ChromeBoundKeyBindName = 'copySubtitle' | 'ankiExport' | 'updateLastCard' | 'exportCard' | 'takeScreenshot';
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
    readonly streamingCondensedPlaybackMinimumSkipIntervalMs: number;
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
