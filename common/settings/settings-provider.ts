import {
    AnkiField,
    AnkiFieldSettings,
    AnkiSettings,
    AsbplayerSettings,
    CustomAnkiFieldSettings,
    KeyBindName,
    SubtitleListPreference,
    SubtitleSettings,
    TextSubtitleSettings,
    textSubtitleSettingsKeys,
    VideoSubtitleSplitBehavior,
    TokenMatchStrategyPriority,
    TokenMatchStrategy,
    TokenStyling,
    DictionaryTrack,
    TokenReadingAnnotation,
    TokenFrequencyAnnotation,
    getFullyKnownTokenStatus,
} from '.';
import { AutoPausePreference, PostMineAction, PostMinePlayback, SubtitleHtml } from '..';

// @ts-ignore
const isMacOs = (navigator.userAgentData?.platform ?? navigator.platform)?.toUpperCase()?.indexOf('MAC') > -1;

const defaultSubtitleTextSettings = {
    subtitleSize: 36,
    subtitleColor: '#ffffff',
    subtitleThickness: 700,
    subtitleOutlineThickness: 0,
    subtitleOutlineColor: '#000000',
    subtitleShadowThickness: 3,
    subtitleShadowColor: '#000000',
    subtitleBackgroundColor: '#000000',
    subtitleBackgroundOpacity: 0,
    subtitleFontFamily: '',
    subtitlePreview: 'アあ安Aa',
    subtitleCustomStyles: [],
    subtitleBlur: false,
};

const defaultDictionaryTrackSettings: DictionaryTrack = {
    dictionaryColorizeSubtitles: false,
    dictionaryAutoGenerateStatistics: false,
    dictionaryColorizeOnHoverOnly: false,
    dictionaryHighlightOnHover: true,
    dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
    dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
    dictionaryYomitanUrl: 'http://127.0.0.1:19633',
    dictionaryYomitanParser: 'scanning-parser',
    dictionaryYomitanScanLength: 16,
    dictionaryTokenReadingAnnotation: TokenReadingAnnotation.NEVER,
    dictionaryDisplayIgnoredTokenReadings: false,
    dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.NEVER,
    dictionaryAnkiDecks: [],
    dictionaryAnkiWordFields: [],
    dictionaryAnkiSentenceFields: [],
    dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
    dictionaryAnkiMatureCutoff: 21,
    dictionaryAnkiTreatSuspended: 'NORMAL',
    dictionaryTokenStyling: TokenStyling.UNDERLINE,
    dictionaryTokenStylingThickness: 3,
    dictionaryColorizeFullyKnownTokens: false,
    dictionaryTokenStatusColors: ['#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#0000FF', '#FFFFFF'],
    dictionaryTokenStatusConfig: [
        { display: true, color: '#FF0000', alpha: 'FF' },
        { display: true, color: '#FFA500', alpha: 'FF' },
        { display: true, color: '#FFFF00', alpha: 'FF' },
        { display: true, color: '#00FF00', alpha: 'FF' },
        { display: true, color: '#0000FF', alpha: 'FF' },
        { display: false, color: '#FFFFFF', alpha: 'FF' },
    ],
};

export const defaultSettings: AsbplayerSettings = {
    ankiConnectUrl: 'http://127.0.0.1:8765',
    deck: '',
    noteType: '',
    sentenceField: '',
    definitionField: '',
    audioField: '',
    imageField: '',
    wordField: '',
    sourceField: '',
    urlField: '',
    track1Field: '',
    track2Field: '',
    track3Field: '',
    ankiFieldSettings: {
        sentence: { order: 1, display: true },
        definition: { order: 2, display: true },
        word: { order: 3, display: true },
        audio: { order: 4, display: true },
        image: { order: 5, display: true },
        source: { order: 6, display: true },
        url: { order: 7, display: true },
        track1: { order: 8, display: false },
        track2: { order: 9, display: false },
        track3: { order: 10, display: false },
    },
    customAnkiFieldSettings: {},
    ...defaultSubtitleTextSettings,
    subtitlePositionOffset: 75,
    topSubtitlePositionOffset: 75,
    subtitleAlignment: 'bottom',
    subtitleTracksV2: [],
    subtitlesWidth: -1,
    audioPaddingStart: 0,
    audioPaddingEnd: 500,
    maxImageWidth: 0,
    maxImageHeight: 0,
    mediaFragmentFormat: 'jpeg',
    mediaFragmentTrimStart: 200,
    mediaFragmentTrimEnd: 200,
    mediaFragmentMaxClipLength: 10000,
    surroundingSubtitlesCountRadius: 2,
    surroundingSubtitlesTimeRadius: 10000,
    autoPausePreference: AutoPausePreference.atEnd,
    seekableTracks: 1, // Bitset with first bit flipped i.e. first track
    autoCopyableTracks: 1, // Also bitset
    subtitleHtml: SubtitleHtml.remove,
    seekDuration: 3,
    speedChangeStep: 0.1,
    fastForwardModePlaybackRate: 2.7,
    keyBindSet: {
        togglePlay: { keys: 'space' },
        toggleAutoPause: { keys: isMacOs ? '⇧+P' : 'shift+P' },
        toggleCondensedPlayback: { keys: isMacOs ? '⇧+O' : 'shift+O' },
        toggleFastForwardPlayback: { keys: isMacOs ? '⇧+F' : 'shift+F' },
        toggleSubtitles: { keys: 'down' },
        toggleVideoSubtitleTrack1: { keys: '1' },
        toggleVideoSubtitleTrack2: { keys: '2' },
        toggleVideoSubtitleTrack3: { keys: '3' },
        toggleAsbplayerSubtitleTrack1: { keys: 'W+1' },
        toggleAsbplayerSubtitleTrack2: { keys: 'W+2' },
        toggleAsbplayerSubtitleTrack3: { keys: 'W+3' },
        unblurAsbplayerTrack1: { keys: 'B+1' },
        unblurAsbplayerTrack2: { keys: 'B+2' },
        unblurAsbplayerTrack3: { keys: 'B+3' },
        seekBackward: { keys: 'A' },
        seekForward: { keys: 'D' },
        seekToPreviousSubtitle: { keys: 'left' },
        seekToNextSubtitle: { keys: 'right' },
        seekToBeginningOfCurrentSubtitle: { keys: 'up' },
        adjustOffsetToPreviousSubtitle: { keys: isMacOs ? '⇧+left' : 'ctrl+left' },
        adjustOffsetToNextSubtitle: { keys: isMacOs ? '⇧+right' : 'ctrl+right' },
        decreaseOffset: { keys: isMacOs ? '⇧+⌃+right' : 'ctrl+shift+right' },
        increaseOffset: { keys: isMacOs ? '⇧+⌃+left' : 'ctrl+shift+left' },
        resetOffset: { keys: isMacOs ? '⇧+⌃+down' : 'ctrl+shift+down' },
        copySubtitle: { keys: isMacOs ? '⇧+⌃+Z' : 'ctrl+shift+Z' },
        ankiExport: { keys: isMacOs ? '⇧+⌃+X' : 'ctrl+shift+X' },
        updateLastCard: { keys: isMacOs ? '⇧+⌃+U' : 'ctrl+shift+U' },
        exportCard: { keys: '' },
        takeScreenshot: { keys: isMacOs ? '⇧+⌃+V' : 'ctrl+shift+V' },
        toggleRecording: { keys: isMacOs ? '⇧+⌃+R' : 'ctrl+shift+R' },
        decreasePlaybackRate: { keys: isMacOs ? '⇧+⌃+[' : 'ctrl+shift+[' },
        increasePlaybackRate: { keys: isMacOs ? '⇧+⌃+]' : 'ctrl+shift+]' },
        toggleSidePanel: { keys: '`' },
        toggleRepeat: { keys: isMacOs ? '⇧+R' : 'shift+R' },
        moveBottomSubtitlesUp: { keys: '' },
        moveBottomSubtitlesDown: { keys: '' },
        moveTopSubtitlesUp: { keys: '' },
        moveTopSubtitlesDown: { keys: '' },
        markHoveredToken5: { keys: 'Q+5' },
        markHoveredToken4: { keys: 'Q+4' },
        markHoveredToken3: { keys: 'Q+3' },
        markHoveredToken2: { keys: 'Q+2' },
        markHoveredToken1: { keys: 'Q+1' },
        markHoveredToken0: { keys: 'Q+0' },
        toggleHoveredTokenIgnored: { keys: 'Q+I' },
        openStatistics: { keys: 'Q+S' },
    },
    recordWithAudioPlayback: true,
    preferMp3: true,
    tabName: 'asbplayer',
    miningHistoryStorageLimit: 25,
    clickToMineDefaultAction: PostMineAction.showAnkiDialog,
    postMiningPlaybackState: PostMinePlayback.remember,
    themeType: 'dark',
    videoSubtitleSplitBehavior: VideoSubtitleSplitBehavior.rememberSplitPosition,
    copyToClipboardOnMine: false,
    rememberSubtitleOffset: true,
    lastSubtitleOffset: 0,
    autoCopyCurrentSubtitle: false,
    alwaysPlayOnSubtitleRepeat: true,
    subtitleRegexFilter: '',
    subtitleRegexFilterTextReplacement: '',
    convertNetflixRuby: false,
    language: 'en',
    customAnkiFields: {},
    tags: [],
    imageBasedSubtitleScaleFactor: 1,
    streamingAppUrl: 'https://app.asbplayer.dev',
    streamingDisplaySubtitles: true,
    streamingRecordMedia: true,
    streamingTakeScreenshot: true,
    streamingCleanScreenshot: true,
    streamingCropScreenshot: true,
    streamingSubsDragAndDrop: true,
    streamingAutoSync: false,
    streamingAutoSyncPromptOnFailure: false,
    streamingLastLanguagesSynced: {},
    streamingCondensedPlaybackMinimumSkipIntervalMs: 1000,
    streamingScreenshotDelay: 1000,
    streamingSubtitleListPreference: SubtitleListPreference.noSubtitleList,
    streamingEnableOverlay: true,
    streamingPages: {
        netflix: {},
        youtube: {},
        tver: {},
        bandaiChannel: {},
        amazonPrime: {},
        hulu: {},
        huluJp: {},
        disneyPlus: {},
        appsDisneyPlus: {},
        unext: {},
        viki: {},
        embyJellyfin: {},
        twitch: {},
        osnPlus: {},
        bilibili: {},
        nrktv: {},
        plex: {},
        yleAreena: {},
        hboMax: {},
        stremio: {},
        cijapanese: {},
        iwanttfc: {},
        svtplay: {},
        urplay: {},
        archive: {},
    },
    webSocketClientEnabled: false,
    webSocketServerUrl: 'ws://127.0.0.1:8766/ws',
    pauseOnHoverMode: 0,
    lastSelectedAnkiExportMode: 'default',
    dictionaryTracks: [defaultDictionaryTrackSettings, defaultDictionaryTrackSettings, defaultDictionaryTrackSettings],
};

export const NUM_DICTIONARY_TRACKS = defaultSettings.dictionaryTracks.length;
export const NUM_TOKEN_STATUSES = defaultDictionaryTrackSettings.dictionaryTokenStatusColors.length;

export interface AnkiFieldUiModel {
    key: string;
    field: AnkiField;
    custom: boolean;
}

const ankiFieldEntries = (
    fieldsMap: Record<string, AnkiField> | AnkiFieldSettings,
    custom: boolean
): AnkiFieldUiModel[] => {
    return Object.entries(fieldsMap).map(([key, value]) => ({
        key,
        field: value as AnkiField,
        custom,
    }));
};

const sortedAnkiFields = (models: AnkiFieldUiModel[]) => {
    return models.sort((a, b) => {
        const left = a.field;
        const right = b.field;

        if (left.order < right.order) {
            return -1;
        }

        if (left.order > right.order) {
            return 1;
        }

        return 0;
    });
};

export const sortedAnkiFieldModels = (settings: AnkiSettings): AnkiFieldUiModel[] => {
    let last = Math.max(
        ...Object.values({ ...settings.ankiFieldSettings, ...settings.customAnkiFieldSettings }).map((f) => f.order)
    );
    return sortedAnkiFields([
        ...ankiFieldEntries(settings.ankiFieldSettings, false),
        ...ankiFieldEntries(
            Object.fromEntries(
                Object.keys(settings.customAnkiFields).map((name) => [
                    name,
                    settings.customAnkiFieldSettings[name] ?? { order: ++last, display: true },
                ])
            ),
            true
        ),
    ]);
};

export const allTextSubtitleSettings = (subtitleSettings: SubtitleSettings) => {
    const textSettings: TextSubtitleSettings[] = [];

    for (let i = 0; i <= subtitleSettings.subtitleTracksV2.length; ++i) {
        textSettings.push(textSubtitleSettingsForTrack(subtitleSettings, i) as TextSubtitleSettings);
    }

    return textSettings;
};

export const textSubtitleSettingsForTrack = (
    subtitleSettings: SubtitleSettings,
    track?: number
): Partial<TextSubtitleSettings> | TextSubtitleSettings => {
    if (track === undefined) {
        const valuesAllSame = (k: keyof TextSubtitleSettings) => {
            const val = subtitleSettings[k];

            for (const track of subtitleSettings.subtitleTracksV2) {
                if (!deepEquals(track[k], val)) {
                    return false;
                }
            }

            return true;
        };

        let mergedSettings: any = {};

        for (const key of textSubtitleSettingsKeys) {
            if (valuesAllSame(key)) {
                mergedSettings[key] = subtitleSettings[key];
            } else {
                mergedSettings[key] = undefined;
            }
        }

        return mergedSettings as Partial<TextSubtitleSettings>;
    }

    if (track === 0 || track > subtitleSettings.subtitleTracksV2.length) {
        return Object.fromEntries(
            textSubtitleSettingsKeys.map((k) => [k, subtitleSettings[k]])
        ) as unknown as TextSubtitleSettings;
    }

    return subtitleSettings.subtitleTracksV2[track - 1] as TextSubtitleSettings;
};

export const changeForTextSubtitleSetting = (
    updates: Partial<TextSubtitleSettings>,
    subtitleSettings: SubtitleSettings,
    track?: number
) => {
    if (track === undefined) {
        // Change settings for all tracks
        const newSubtitleTracks = [];

        for (let i = 0; i < subtitleSettings.subtitleTracksV2.length; ++i) {
            newSubtitleTracks.push({ ...subtitleSettings.subtitleTracksV2[i], ...updates });
        }

        return {
            ...updates,
            subtitleTracksV2: newSubtitleTracks,
        };
    }

    if (track === 0) {
        // Change setting for track 0 (top-level settings object)
        return { ...updates };
    }

    // Change setting for track >= 1 (nested subtitleTracks setting)
    const newSubtitleTracks = [...subtitleSettings.subtitleTracksV2];
    const firstTrack = textSubtitleSettingsForTrack(subtitleSettings, 0) as TextSubtitleSettings;

    while (newSubtitleTracks.length < track) {
        newSubtitleTracks.push(firstTrack);
    }

    newSubtitleTracks[track - 1] = {
        ...newSubtitleTracks[track - 1],
        ...updates,
    };

    let removeFromEnd = 0;

    for (let i = newSubtitleTracks.length - 1; i >= 0; --i) {
        if (!deepEquals(firstTrack, newSubtitleTracks[i])) {
            break;
        }

        ++removeFromEnd;
    }

    if (removeFromEnd > 0) {
        newSubtitleTracks.splice(newSubtitleTracks.length - removeFromEnd);
    }

    return { subtitleTracksV2: newSubtitleTracks };
};

export const textSubtitleSettingsAreDirty = (settings: SubtitleSettings, track: number) => {
    return (
        track !== 0 &&
        !deepEquals(textSubtitleSettingsForTrack(settings, 0), textSubtitleSettingsForTrack(settings, track))
    );
};

type SettingsDeserializers = { [key in keyof AsbplayerSettings]: (serialized: string) => any };
export const settingsDeserializers: SettingsDeserializers = Object.fromEntries(
    Object.entries(defaultSettings).map(([key, value]) => {
        if (typeof value === 'string') {
            return [key, (s: string) => s];
        }

        if (typeof value === 'boolean') {
            return [key, (s: string) => s === 'true'];
        }

        if (typeof value === 'number') {
            return [key, (s: string) => Number(s)];
        }

        if (typeof value === 'object') {
            return [key, (s: string) => JSON.parse(s)];
        }

        throw new Error('Could not determine deserializer for setting');
    })
) as SettingsDeserializers;

const deepEquals = (a: any, b: any) => {
    if (typeof a !== typeof b) {
        return false;
    }

    if (typeof a !== 'object') {
        return a === b;
    }

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    if (a.length !== b.length) {
        return false;
    }

    for (const k of aKeys) {
        if (!deepEquals(a[k], b[k])) {
            return false;
        }
    }

    for (const k of bKeys) {
        if (!deepEquals(a[k], b[k])) {
            return false;
        }
    }

    return true;
};

const ensureDictionaryTracksConsistency = ({ dictionaryTracks }: Partial<AsbplayerSettings>) => {
    if (!dictionaryTracks) return;
    const defaultTrack = defaultSettings.dictionaryTracks[0];
    const fullyKnownStatus = getFullyKnownTokenStatus();
    for (const dt of dictionaryTracks) {
        if (!dt.dictionaryTokenStatusColors) (dt as any).dictionaryTokenStatusColors = [];
        while (dt.dictionaryTokenStatusColors.length < NUM_TOKEN_STATUSES) {
            const color = defaultTrack.dictionaryTokenStatusColors[dt.dictionaryTokenStatusColors.length];
            dt.dictionaryTokenStatusColors.push(color);
        }
        while (dt.dictionaryTokenStatusColors.length > NUM_TOKEN_STATUSES) {
            dt.dictionaryTokenStatusColors.pop();
        }

        if (!dt.dictionaryTokenStatusConfig) (dt as any).dictionaryTokenStatusConfig = [];
        while (dt.dictionaryTokenStatusConfig.length < NUM_TOKEN_STATUSES) {
            const config = {
                ...defaultTrack.dictionaryTokenStatusConfig[dt.dictionaryTokenStatusConfig.length],
                color: dt.dictionaryTokenStatusColors[dt.dictionaryTokenStatusConfig.length],
            };
            dt.dictionaryTokenStatusConfig.push(config);
        }
        while (dt.dictionaryTokenStatusConfig.length > NUM_TOKEN_STATUSES) {
            dt.dictionaryTokenStatusConfig.pop();
        }

        // Migrate to config, both are updated on settings change
        for (let i = 0; i < NUM_TOKEN_STATUSES; ++i) {
            if (dt.dictionaryTokenStatusConfig[i].color !== dt.dictionaryTokenStatusColors[i]) {
                dt.dictionaryTokenStatusConfig[i] = {
                    ...dt.dictionaryTokenStatusConfig[i],
                    color: dt.dictionaryTokenStatusColors[i],
                };
            }
        }
        if (dt.dictionaryTokenStatusConfig[fullyKnownStatus].display !== dt.dictionaryColorizeFullyKnownTokens) {
            dt.dictionaryTokenStatusConfig[fullyKnownStatus] = {
                ...dt.dictionaryTokenStatusConfig[fullyKnownStatus],
                display: dt.dictionaryColorizeFullyKnownTokens,
            };
        }

        // Default for new settings
        if (!dt.dictionaryYomitanParser) (dt as any).dictionaryYomitanParser = defaultTrack.dictionaryYomitanParser;
        if (dt.dictionaryAutoGenerateStatistics === undefined) {
            (dt as any).dictionaryAutoGenerateStatistics = defaultTrack.dictionaryAutoGenerateStatistics;
        }
    }
    while (dictionaryTracks.length < NUM_DICTIONARY_TRACKS) {
        dictionaryTracks.push(defaultTrack);
    }
    while (dictionaryTracks.length > NUM_DICTIONARY_TRACKS) {
        dictionaryTracks.pop();
    }
};

export const ensureConsistencyOnRead = (settings: Partial<AsbplayerSettings>) => {
    ensureDictionaryTracksConsistency(settings);

    let keyBindSetModified = false;
    let newKeyBindSet: any = {};
    let ankiFieldSettingsModified = false;
    let newAnkiFieldSettings: any = {};

    if (settings.keyBindSet !== undefined) {
        const keyBindSet = settings.keyBindSet;

        for (const key of Object.keys(defaultSettings.keyBindSet)) {
            const keyBindName = key as KeyBindName;

            if (keyBindSet[keyBindName] === undefined) {
                newKeyBindSet[keyBindName] = defaultSettings.keyBindSet[keyBindName];
                keyBindSetModified = true;
            } else {
                newKeyBindSet[keyBindName] = keyBindSet[keyBindName];
            }
        }
    }

    if (settings.ankiFieldSettings !== undefined) {
        const ankiFieldSettings = settings.ankiFieldSettings;

        for (const key of Object.keys(defaultSettings.ankiFieldSettings)) {
            const fieldName = key as keyof AnkiFieldSettings;

            if (ankiFieldSettings[fieldName] === undefined) {
                newAnkiFieldSettings[fieldName] = defaultSettings.ankiFieldSettings[fieldName];
                ankiFieldSettingsModified = true;
            } else {
                newAnkiFieldSettings[fieldName] = ankiFieldSettings[fieldName];
            }
        }
    }

    if (!ankiFieldSettingsModified && !keyBindSetModified) {
        return settings;
    }

    return { ...settings, ...{ ankiFieldSettings: newAnkiFieldSettings }, ...{ keyBindSet: newKeyBindSet } };
};

type SettingsKey = keyof AsbplayerSettings;

const complexValuedKeys = Object.fromEntries(
    Object.keys(defaultSettings)
        .filter((k) => typeof defaultSettings[k as SettingsKey] === 'object')
        .map((k) => [k, true])
);

export class SettingsProvider {
    private _storage: SettingsStorage;
    private _complexValues: { [key: string]: any } = {};

    constructor(storage: SettingsStorage) {
        this._storage = storage;
    }

    async getAll(): Promise<AsbplayerSettings> {
        return this.get(Object.keys(defaultSettings) as SettingsKey[]);
    }

    async getSingle<K extends keyof AsbplayerSettings>(key: K): Promise<AsbplayerSettings[K]> {
        const vals = (await this.get([key])) as Partial<AsbplayerSettings>;
        const val = vals[key];
        return val as AsbplayerSettings[K];
    }

    async get<K extends keyof AsbplayerSettings>(keys: K[]): Promise<Pick<AsbplayerSettings, K>> {
        let parameters: Partial<AsbplayerSettings> = {};

        for (const key of keys) {
            parameters[key] = defaultSettings[key];
        }

        const data = await this._storage.get(parameters);
        const result: any = {};

        for (const key in parameters) {
            const value = (data && data[key as SettingsKey]) ?? defaultSettings[key as SettingsKey];

            if (complexValuedKeys[key]) {
                const lastValue = this._complexValues[key as SettingsKey];

                if (lastValue !== undefined && deepEquals(lastValue, value)) {
                    result[key] = lastValue;
                } else {
                    this._complexValues[key as SettingsKey] = value;
                    result[key] = value;
                }
            } else {
                result[key] = value;
            }
        }

        return ensureConsistencyOnRead(result) as Pick<AsbplayerSettings, K>;
    }

    async set(settings: Partial<AsbplayerSettings>): Promise<void> {
        await this._storage.set(await this._ensureConsistencyOnWrite(settings));
    }

    private async _ensureConsistencyOnWrite(settings: Partial<AsbplayerSettings>) {
        ensureDictionaryTracksConsistency(settings);

        if (settings.customAnkiFields === undefined) {
            return settings;
        }
        const customAnkiFieldSettings =
            settings.customAnkiFieldSettings ??
            ((
                await this._storage.get({
                    customAnkiFieldSettings: defaultSettings.customAnkiFieldSettings,
                })
            ).customAnkiFieldSettings as CustomAnkiFieldSettings);

        let modifyCustomAnkiFieldSettings = false;

        for (const key of Object.keys(customAnkiFieldSettings)) {
            if (!(key in settings.customAnkiFields)) {
                delete customAnkiFieldSettings[key];
                modifyCustomAnkiFieldSettings = true;
            }
        }

        if (modifyCustomAnkiFieldSettings) {
            return { ...settings, customAnkiFieldSettings };
        }

        return settings;
    }

    async activeProfile() {
        return await this._storage.activeProfile();
    }

    async setActiveProfile(name: string | undefined) {
        await this._storage.setActiveProfile(name);
    }

    async profiles() {
        return await this._storage.profiles();
    }

    async addProfile(name: string) {
        await this._storage.addProfile(name);
    }

    async removeProfile(name: string) {
        await this._storage.removeProfile(name);
    }
}

export type AsbplayerSettingsProfile<P extends string> = {
    [K in keyof AsbplayerSettings as K extends string ? `_prof_${P}_${K}` : never]: AsbplayerSettings[K];
};

const keyPrefix = (profile: string) => {
    return `_prof_${profile}_`;
};

export const prefixKey = (key: string, profile: string) => {
    return `${keyPrefix(profile)}${key}`;
};

export const unprefixKey = (key: string, profile: string) => {
    return (key as string).substring(profile.length + 7);
};

export const prefixedSettings = <P extends string>(
    settings: Partial<AsbplayerSettings>,
    profile: P
): Partial<AsbplayerSettingsProfile<P>> => {
    const prefixed: any = {};

    for (const key of Object.keys(settings)) {
        prefixed[prefixKey(key as keyof AsbplayerSettings, profile)] = settings[key as keyof AsbplayerSettings];
    }

    return prefixed;
};

export const unprefixedSettings = <P extends string>(settings: Partial<AsbplayerSettingsProfile<P>>, profile: P) => {
    const unprefixed: any = {};

    for (const key of Object.keys(settings)) {
        const unprefixedKey = unprefixKey(key as keyof AsbplayerSettingsProfile<P>, profile);
        unprefixed[unprefixedKey] = settings[key as keyof AsbplayerSettingsProfile<P>];
    }

    return unprefixed;
};

export interface Profile {
    name: string;
}

export interface SettingsStorage {
    get: (keysAndDefaults: Partial<AsbplayerSettings>) => Promise<Partial<AsbplayerSettings>>;
    set: (settings: Partial<AsbplayerSettings>) => Promise<void>;

    activeProfile: () => Promise<Profile | undefined>;
    setActiveProfile: (name: string | undefined) => Promise<void>;
    profiles: () => Promise<Profile[]>;
    addProfile: (name: string) => Promise<void>;
    removeProfile: (name: string) => Promise<void>;
}
