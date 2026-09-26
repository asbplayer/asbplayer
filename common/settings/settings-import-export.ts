import { Validator } from 'jsonschema';
import type { AsbplayerSettings } from '@project/common/settings/settings';
import type { SettingsProvider } from '@project/common/settings/settings-provider';
import { ensureConsistencyOnRead } from '@project/common/settings/settings-provider';
import { download, getCurrentTimeString } from '@project/common/util';

const keyBindSchema = {
    id: '/KeyBind',
    type: 'object',
    properties: {
        keys: {
            type: 'string',
        },
    },
    required: ['keys'],
};
const ankiFieldSchema = {
    id: '/AnkiField',
    type: 'object',
    properties: {
        order: {
            type: 'number',
        },
        display: {
            type: 'boolean',
        },
    },
    required: ['order', 'display'],
};
const dictionaryTrackSchema = {
    id: '/DictionaryTrack',
    type: 'object',
    properties: {
        dictionaryColorizeSubtitles: {
            type: 'boolean',
        },
        dictionaryAutoGenerateStatistics: {
            type: 'boolean',
        },
        dictionaryColorizeOnHoverOnly: {
            type: 'boolean',
        },
        dictionaryHighlightOnHover: {
            type: 'boolean',
        },
        dictionaryTokenMatchStrategy: {
            type: 'string',
        },
        dictionaryMatchAcrossScripts: {
            type: 'boolean',
        },
        dictionaryTokenMatchStrategyPriority: {
            type: 'string',
        },
        dictionaryYomitanUrl: {
            type: 'string',
        },
        dictionaryYomitanParser: {
            type: 'string',
        },
        dictionaryYomitanScanLength: {
            type: 'number',
        },
        dictionaryTokenReadingAnnotation: {
            type: 'string',
        },
        dictionaryDisplayIgnoredTokenReadings: {
            type: 'boolean',
        },
        dictionaryTokenFrequencyAnnotation: {
            type: 'string',
        },
        dictionaryAnkiDecks: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        dictionaryAnkiWordFields: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        dictionaryAnkiSentenceFields: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        dictionaryAnkiSentenceTokenMatchStrategy: {
            type: 'string',
        },
        dictionaryAnkiMatureCutoff: {
            type: 'number',
        },
        dictionaryAnkiTreatSuspended: {
            type: ['string', 'number'],
        },
        dictionaryWaniKaniApiToken: {
            type: 'string',
        },
        dictionaryTokenStyling: {
            type: 'string',
        },
        dictionaryTokenStylingThickness: {
            type: 'number',
        },
        dictionaryColorizeFullyKnownTokens: {
            type: 'boolean',
        },
        dictionaryTokenStatusColors: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        dictionaryTokenStatusConfig: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    display: { type: 'boolean' },
                    color: { type: 'string' },
                    alpha: { type: 'string' },
                },
                required: ['display', 'color', 'alpha'],
            },
        },
        dictionaryTokenAnnotationConfig: {
            type: 'object',
            properties: {
                colorizeEnabled: {
                    type: 'boolean',
                },
                video: {
                    type: 'object',
                    properties: {
                        color: {
                            type: 'object',
                            properties: { onHoverEnabled: { type: 'boolean' }, size: { type: 'number' } },
                            required: ['onHoverEnabled', 'size'],
                        },
                        reading: {
                            type: 'object',
                            properties: { onHoverEnabled: { type: 'boolean' }, size: { type: 'number' } },
                            required: ['onHoverEnabled', 'size'],
                        },
                        frequency: {
                            type: 'object',
                            properties: { onHoverEnabled: { type: 'boolean' }, size: { type: 'number' } },
                            required: ['onHoverEnabled', 'size'],
                        },
                        pitchAccent: {
                            type: 'object',
                            properties: { onHoverEnabled: { type: 'boolean' }, size: { type: 'number' } },
                            required: ['onHoverEnabled', 'size'],
                        },
                    },
                    required: ['color', 'reading', 'frequency', 'pitchAccent'],
                },
                subtitlePlayer: {
                    type: 'object',
                    properties: {
                        color: {
                            type: 'object',
                            properties: { onHoverEnabled: { type: 'boolean' }, size: { type: 'number' } },
                            required: ['onHoverEnabled', 'size'],
                        },
                        reading: {
                            type: 'object',
                            properties: { onHoverEnabled: { type: 'boolean' }, size: { type: 'number' } },
                            required: ['onHoverEnabled', 'size'],
                        },
                        frequency: {
                            type: 'object',
                            properties: { onHoverEnabled: { type: 'boolean' }, size: { type: 'number' } },
                            required: ['onHoverEnabled', 'size'],
                        },
                        pitchAccent: {
                            type: 'object',
                            properties: { onHoverEnabled: { type: 'boolean' }, size: { type: 'number' } },
                            required: ['onHoverEnabled', 'size'],
                        },
                    },
                    required: ['color', 'reading', 'frequency', 'pitchAccent'],
                },
                onStatuses: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            reading: { type: 'boolean' },
                            frequency: { type: 'boolean' },
                            pitchAccent: { type: 'boolean' },
                        },
                        required: ['reading', 'frequency', 'pitchAccent'],
                    },
                },
                onStates: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            reading: { type: 'boolean' },
                            frequency: { type: 'boolean' },
                            pitchAccent: { type: 'boolean' },
                        },
                        required: ['reading', 'frequency', 'pitchAccent'],
                    },
                },
            },
            required: ['colorizeEnabled', 'video', 'subtitlePlayer', 'onStatuses', 'onStates'],
        },
    },
    required: [
        'dictionaryColorizeSubtitles',
        'dictionaryColorizeOnHoverOnly',
        'dictionaryHighlightOnHover',
        'dictionaryTokenMatchStrategy',
        'dictionaryTokenMatchStrategyPriority',
        'dictionaryYomitanUrl',
        'dictionaryYomitanScanLength',
        'dictionaryTokenReadingAnnotation',
        'dictionaryDisplayIgnoredTokenReadings',
        'dictionaryTokenFrequencyAnnotation',
        'dictionaryAnkiDecks',
        'dictionaryAnkiWordFields',
        'dictionaryAnkiSentenceFields',
        'dictionaryAnkiSentenceTokenMatchStrategy',
        'dictionaryAnkiMatureCutoff',
        'dictionaryAnkiTreatSuspended',
        'dictionaryTokenStyling',
        'dictionaryTokenStylingThickness',
        'dictionaryColorizeFullyKnownTokens',
        'dictionaryTokenStatusColors',
    ],
};
const textSubtitleSettingsSchema = {
    id: '/TextSubtitleSettings',
    type: 'object',
    properties: {
        subtitleColor: {
            type: 'string',
        },
        subtitleSize: {
            type: 'number',
        },
        subtitleThickness: {
            type: 'number',
        },
        subtitleOutlineThickness: {
            type: 'number',
        },
        subtitleShadowColor: {
            type: 'string',
        },
        subtitleBackgroundOpacity: {
            type: 'number',
        },
        subtitleBackgroundColor: {
            type: 'string',
        },
        subtitleFontFamily: {
            type: 'string',
        },
        subtitleCustomStyles: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    key: {
                        type: 'string',
                    },
                    value: {
                        type: 'string',
                    },
                },
            },
        },
        subtitleBlur: {
            type: 'boolean',
        },
    },
    required: [
        'subtitleColor',
        'subtitleSize',
        'subtitleThickness',
        'subtitleOutlineThickness',
        'subtitleShadowColor',
        'subtitleBackgroundOpacity',
        'subtitleBackgroundColor',
        'subtitleFontFamily',
        'subtitleCustomStyles',
        'subtitleBlur',
    ],
};
const settingsSchema = {
    id: '/Settings',
    type: 'object',
    properties: {
        ankiConnectUrl: {
            type: 'string',
        },
        ankiConnectApiKey: {
            type: 'string',
        },
        ankiRefreshBrowserAfterUpdate: {
            type: 'boolean',
        },
        deck: {
            type: 'string',
        },
        noteType: {
            type: 'string',
        },
        sentenceField: {
            type: 'string',
        },
        definitionField: {
            type: 'string',
        },
        audioField: {
            type: 'string',
        },
        imageField: {
            type: 'string',
        },
        wordField: {
            type: 'string',
        },
        sourceField: {
            type: 'string',
        },
        urlField: {
            type: 'string',
        },
        track1Field: {
            type: 'string',
        },
        track2Field: {
            type: 'string',
        },
        track3Field: {
            type: 'string',
        },
        ankiFieldSettings: {
            type: 'object',
            properties: {
                sentence: { $ref: '/AnkiField' },
                definition: { $ref: '/AnkiField' },
                audio: { $ref: '/AnkiField' },
                image: { $ref: '/AnkiField' },
                word: { $ref: '/AnkiField' },
                source: { $ref: '/AnkiField' },
                url: { $ref: '/AnkiField' },
                track1: { $ref: '/AnkiField' },
                track2: { $ref: '/AnkiField' },
                track3: { $ref: '/AnkiField' },
            },
        },
        customAnkiFieldSettings: {
            type: 'object',
            additionalProperties: {
                type: '/AnkiField',
            },
        },
        subtitleSize: {
            type: 'number',
        },
        subtitleColor: {
            type: 'string',
        },
        subtitleThickness: {
            type: 'number',
        },
        subtitleOutlineThickness: {
            type: 'number',
        },
        subtitleShadowThickness: {
            type: 'number',
        },
        subtitleShadowColor: {
            type: 'string',
        },
        subtitleOutlineColor: {
            type: 'string',
        },
        subtitleBackgroundColor: {
            type: 'string',
        },
        subtitleBackgroundOpacity: {
            type: 'number',
        },
        subtitleFontFamily: {
            type: 'string',
        },
        subtitleBlur: {
            type: 'boolean',
        },
        subtitlePreview: {
            type: 'string',
        },
        subtitlePositionOffset: {
            type: 'number',
        },
        topSubtitlePositionOffset: {
            type: 'number',
        },
        subtitleAlignment: {
            type: 'string',
        },
        subtitleTracksV2: {
            type: 'array',
            items: {
                $ref: '/TextSubtitleSettings',
            },
        },
        audioPaddingStart: {
            type: 'number',
        },
        audioPaddingEnd: {
            type: 'number',
        },
        maxImageWidth: {
            type: 'number',
        },
        maxImageHeight: {
            type: 'number',
        },
        mediaFragmentFormat: {
            type: 'string',
        },
        mediaFragmentTrimStart: {
            type: 'number',
        },
        mediaFragmentTrimEnd: {
            type: 'number',
        },
        mediaFragmentMaxClipLength: {
            type: 'number',
        },
        surroundingSubtitlesCountRadius: {
            type: 'number',
        },
        surroundingSubtitlesTimeRadius: {
            type: 'number',
        },
        autoPausePreference: {
            type: 'number',
        },
        subtitleTriggerStartOffset: {
            type: 'number',
        },
        subtitleTriggerEndOffset: {
            type: 'number',
        },
        subtitleTriggerGapEndOffset: {
            type: 'number',
        },
        subtitleTriggerGapStartOffset: {
            type: 'number',
        },
        seekableTracks: {
            type: 'number',
        },
        autoCopyableTracks: {
            type: 'number',
        },
        subtitleHtml: {
            type: 'number',
        },
        seekDuration: {
            type: 'number',
        },
        speedChangeStep: {
            type: 'number',
        },
        playbackRate: {
            type: 'number',
        },
        playbackRateNotificationEnabled: {
            type: 'boolean',
        },
        rememberPlaybackRate: {
            type: 'boolean',
        },
        fastForwardModePlaybackRate: {
            type: 'number',
        },
        fastForwardPlaybackMinimumSkipIntervalMs: {
            type: 'number',
        },
        repeatCountPreference: {
            type: 'number',
        },
        autoPauseResumeMode: {
            type: 'string',
            enum: ['manual', 'fixed', 'subtitleLength'],
        },
        autoPauseResumeDelayMs: {
            type: 'number',
        },
        autoPauseFixedDurationMs: {
            type: 'number',
        },
        autoPauseMinimumDurationMs: {
            type: 'number',
        },
        autoPauseMaximumDurationMs: {
            type: 'number',
        },
        autoPauseTimePerCharacterMs: {
            type: 'number',
        },
        subtitleVisibility: {
            type: 'string',
            enum: ['whenDue', 'whilePaused'],
        },
        rememberPlaybackModes: {
            type: 'boolean',
        },
        lastPlaybackModes: {
            type: 'array',
            items: {
                type: 'number',
            },
        },
        lastPlaybackPositions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    fileName: { type: 'string' },
                    position: { type: 'number' },
                },
                required: ['fileName', 'position'],
            },
        },
        keyBindSet: {
            type: 'object',
            properties: {
                togglePlay: { $ref: '/KeyBind' },
                toggleAutoPause: { $ref: '/KeyBind' },
                toggleCondensedPlayback: { $ref: '/KeyBind' },
                toggleFastForwardPlayback: { $ref: '/KeyBind' },
                toggleSubtitles: { $ref: '/KeyBind' },
                toggleVideoSubtitleTrack1: { $ref: '/KeyBind' },
                toggleVideoSubtitleTrack2: { $ref: '/KeyBind' },
                toggleVideoSubtitleTrack3: { $ref: '/KeyBind' },
                toggleAsbplayerSubtitleTrack1: { $ref: '/KeyBind' },
                toggleAsbplayerSubtitleTrack2: { $ref: '/KeyBind' },
                toggleAsbplayerSubtitleTrack3: { $ref: '/KeyBind' },
                unblurAsbplayerTrack1: { $ref: '/KeyBind' },
                unblurAsbplayerTrack2: { $ref: '/KeyBind' },
                unblurAsbplayerTrack3: { $ref: '/KeyBind' },
                seekBackward: { $ref: '/KeyBind' },
                seekForward: { $ref: '/KeyBind' },
                seekToPreviousSubtitle: { $ref: '/KeyBind' },
                seekToNextSubtitle: { $ref: '/KeyBind' },
                seekToBeginningOfCurrentSubtitle: { $ref: '/KeyBind' },
                adjustOffsetToPreviousSubtitle: { $ref: '/KeyBind' },
                adjustOffsetToNextSubtitle: { $ref: '/KeyBind' },
                decreaseOffset: { $ref: '/KeyBind' },
                increaseOffset: { $ref: '/KeyBind' },
                resetOffset: { $ref: '/KeyBind' },
                copySubtitle: { $ref: '/KeyBind' },
                ankiExport: { $ref: '/KeyBind' },
                updateLastCard: { $ref: '/KeyBind' },
                updateSelectedCard: { $ref: '/KeyBind' },
                exportCard: { $ref: '/KeyBind' },
                takeScreenshot: { $ref: '/KeyBind' },
                toggleRecording: { $ref: '/KeyBind' },
                selectSubtitleTrack: { $ref: '/KeyBind' },
                decreasePlaybackRate: { $ref: '/KeyBind' },
                increasePlaybackRate: { $ref: '/KeyBind' },
                toggleSidePanel: { $ref: '/KeyBind' },
                toggleRepeat: { $ref: '/KeyBind' },
                toggleSubtitleVisibility: { $ref: '/KeyBind' },
                cycleAutoPauseResumeMode: { $ref: '/KeyBind' },
                moveBottomSubtitlesUp: { $ref: '/KeyBind' },
                moveBottomSubtitlesDown: { $ref: '/KeyBind' },
                moveTopSubtitlesUp: { $ref: '/KeyBind' },
                moveTopSubtitlesDown: { $ref: '/KeyBind' },
                markHoveredToken5: { $ref: '/KeyBind' },
                markHoveredToken4: { $ref: '/KeyBind' },
                markHoveredToken3: { $ref: '/KeyBind' },
                markHoveredToken2: { $ref: '/KeyBind' },
                markHoveredToken1: { $ref: '/KeyBind' },
                markHoveredToken0: { $ref: '/KeyBind' },
                toggleHoveredTokenIgnored: { $ref: '/KeyBind' },
                openStatistics: { $ref: '/KeyBind' },
            },
        },
        recordWithAudioPlayback: {
            type: 'boolean',
        },
        preferMp3: {
            type: 'boolean',
        },
        tabName: {
            type: 'string',
        },
        miningHistoryStorageLimit: {
            type: 'number',
        },
        preCacheSubtitleDom: {
            type: 'boolean',
        },
        clickToMineDefaultAction: {
            type: 'number',
        },
        postMiningPlaybackState: {
            type: 'number',
        },
        themeType: {
            type: 'string',
        },
        videoSubtitleSplitBehavior: {
            type: 'string',
        },
        showSubtitleListMiningButton: {
            type: 'boolean',
        },
        subtitleListTimestampDisplay: {
            type: 'string',
        },
        copyToClipboardOnMine: {
            type: 'boolean',
        },
        rememberSubtitleOffset: {
            type: 'boolean',
        },
        lastSubtitleOffset: {
            type: 'number',
        },
        autoCopyCurrentSubtitle: {
            type: 'boolean',
        },
        alwaysPlayOnSubtitleRepeat: {
            type: 'boolean',
        },
        subtitleRegexFilter: {
            type: 'string',
        },
        subtitleRegexFilterTextReplacement: {
            type: 'string',
        },
        convertNetflixRuby: {
            type: 'boolean',
        },
        language: {
            type: 'string',
        },
        customAnkiFields: {
            type: 'object',
            additionalProperties: {
                type: 'string',
            },
        },
        tags: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        imageBasedSubtitleScaleFactor: {
            type: 'number',
        },
        subtitleCustomStyles: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    key: {
                        type: 'string',
                    },
                    value: {
                        type: 'string',
                    },
                },
            },
        },
        subtitlesWidth: {
            type: 'number',
        },
        streamingAppUrl: {
            type: 'string',
        },
        streamingDisplaySubtitles: {
            type: 'boolean',
        },
        streamingRecordMedia: {
            type: 'boolean',
        },
        streamingTakeScreenshot: {
            type: 'boolean',
        },
        streamingCleanScreenshot: {
            type: 'boolean',
        },
        streamingCropScreenshot: {
            type: 'boolean',
        },
        streamingSubsDragAndDrop: {
            type: 'boolean',
        },
        streamingAutoSync: {
            type: 'boolean',
        },
        streamingAutoSyncPromptOnFailure: {
            type: 'boolean',
        },
        streamingLastLanguagesSynced: {
            type: 'object',
            additionalProperties: {
                type: 'array',
                items: {
                    type: 'string',
                },
            },
        },
        streamingCondensedPlaybackMinimumSkipIntervalMs: {
            type: 'number',
        },
        streamingScreenshotDelay: {
            type: 'number',
        },
        streamingSubtitleListPreference: {
            type: 'string',
        },
        streamingEnableOverlay: {
            type: 'boolean',
        },
        webSocketClientEnabled: {
            type: 'boolean',
        },
        webSocketServerUrl: {
            type: 'string',
        },
        pauseOnHoverMode: {
            type: 'number',
        },
        lastSelectedAnkiExportMode: {
            type: 'string',
        },
        dictionaryTracks: {
            type: 'array',
            items: {
                $ref: '/DictionaryTrack',
            },
        },
        thumbnailPreview: {
            type: 'boolean',
        },
        subtitleAboveThumbnail: {
            type: 'boolean',
        },
        _schema: {
            type: 'number',
        },
    },
};

export type IgnorePathSegment = string | '*';
export type IgnorePath = readonly IgnorePathSegment[];

const ignorePaths: readonly IgnorePath[] = [
    ['ankiConnectApiKey'],
    ['dictionaryTracks', '*', 'dictionaryWaniKaniApiToken'],
    ['streamingPages'], // Ignored due to security risk (e.g. disable CSP)
];
const validationIgnorePaths: readonly IgnorePath[] = [['streamingPages']];

export const omitPath = (value: any, path: IgnorePath): any => {
    if (value === null || typeof value !== 'object' || !path.length) return value;

    const [segment, ...remainingPath] = path;
    if (segment === '*') {
        if (Array.isArray(value)) return value.map((item) => omitPath(item, remainingPath));
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, omitPath(child, remainingPath)]));
    }

    const copy = Array.isArray(value) ? [...value] : { ...value };
    if (!remainingPath.length) {
        delete copy[segment];
    } else if (segment in copy) {
        copy[segment] = omitPath(copy[segment], remainingPath);
    }
    return copy;
};

const omitPaths = (settings: any, paths: readonly IgnorePath[]) =>
    paths.reduce((settingsCopy, ignorePath) => omitPath(settingsCopy, ignorePath), settings);

export const settingsForExport = (settings: AsbplayerSettings): Partial<AsbplayerSettings> => {
    return omitPaths(settings, ignorePaths);
};

const mergeIgnoredPath = (importedValue: any, currentValue: any, path: IgnorePath): any => {
    if (importedValue === null || typeof importedValue !== 'object' || !path.length) return importedValue;

    const [segment, ...remainingPath] = path;
    if (segment === '*') {
        if (Array.isArray(importedValue)) {
            return importedValue.map((item, index) => mergeIgnoredPath(item, currentValue?.[index], remainingPath));
        }
        return Object.fromEntries(
            Object.entries(importedValue).map(([key, value]) => [
                key,
                mergeIgnoredPath(value, currentValue?.[key], remainingPath),
            ])
        );
    }

    const mergedValue = Array.isArray(importedValue) ? [...importedValue] : { ...importedValue };
    if (remainingPath.length && segment in importedValue) {
        mergedValue[segment] = mergeIgnoredPath(importedValue[segment], currentValue?.[segment], remainingPath);
    } else if (currentValue !== null && typeof currentValue === 'object' && segment in currentValue) {
        mergedValue[segment] = currentValue[segment];
    }
    return mergedValue;
};

/**
 * Restore ignored values from the current settings, regardless of whether they are present in an import.
 */
export const mergeImportedSettings = (
    importedSettings: Partial<AsbplayerSettings>,
    currentSettings: AsbplayerSettings
): Partial<AsbplayerSettings> =>
    ignorePaths.reduce(
        (mergedSettings, ignorePath) => mergeIgnoredPath(mergedSettings, currentSettings, ignorePath),
        importedSettings
    );

export interface ExportedSettingsProfile {
    // Undefined for the default profile
    name?: string;
    // Complete when exported, but may be missing keys when read from a file written by an older version of asbplayer
    settings: Partial<AsbplayerSettings>;
}

export interface ExportedSettings {
    profiles: ExportedSettingsProfile[];
}

export interface ImportableSettings extends ExportedSettings {
    // Never written to a settings file: true when the file contained no profile information at all,
    // in which case its settings belong to whichever profile is active
    forActiveProfile?: boolean;
}

export const exportedSettings = async (
    settingsProvider: SettingsProvider,
    profiles: (string | undefined)[]
): Promise<ExportedSettings> => {
    const exportedProfiles: ExportedSettingsProfile[] = [];

    for (const name of profiles) {
        exportedProfiles.push({
            ...(name === undefined ? {} : { name }),
            settings: settingsForExport(await settingsProvider.targetingProfile(name).getAll()),
        });
    }

    return {
        profiles: exportedProfiles,
    };
};

export const exportSettings = async (settingsProvider: SettingsProvider, profiles: (string | undefined)[]) => {
    const exported = await exportedSettings(settingsProvider, profiles);
    download(
        new Blob([JSON.stringify(exported)], { type: 'application/json' }),
        `asbplayer-settings-${getCurrentTimeString()}.json`
    );
};

const isExportedSettings = (parsed: any): boolean => {
    return typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.profiles);
};

export const validateExportedSettings = (parsed: any): ImportableSettings => {
    if (!isExportedSettings(parsed)) {
        // Settings file from an older version of asbplayer containing only one profile's settings
        return { profiles: [{ settings: validateSettings(parsed) }], forActiveProfile: true };
    }

    const profiles = parsed.profiles.map((profile: any) => {
        // Profile names end up in storage keys, so make sure they are actually names
        if (profile.name !== undefined && typeof profile.name !== 'string') {
            throw new Error(`Invalid profile name '${profile.name}'`);
        }

        return { name: profile.name, settings: validateSettings(profile.settings) };
    });

    return { profiles };
};

export const importSettings = async (
    settingsProvider: SettingsProvider,
    imported: ImportableSettings,
    profiles: (string | undefined)[] | undefined
) => {
    const activeProfile = (await settingsProvider.activeProfile())?.name;

    if (profiles === undefined) {
        const profile =
            imported.profiles.find((p) => p.name === activeProfile) ??
            imported.profiles.find((p) => p.name === undefined) ??
            imported.profiles[0];

        if (profile !== undefined) {
            const currentSettings = await settingsProvider.getAll();
            await settingsProvider.set(mergeImportedSettings(profile.settings, currentSettings));
        }

        return;
    }

    const existingProfiles = new Set((await settingsProvider.profiles()).map((p) => p.name));

    for (const name of profiles) {
        const profile = imported.profiles.find((p) => p.name === name);

        if (profile === undefined) {
            continue;
        }

        if (name !== undefined && !existingProfiles.has(name)) {
            await settingsProvider.addProfile(name);
        }

        const targetedProvider = settingsProvider.targetingProfile(name);
        const currentSettings = await targetedProvider.getAll();
        await targetedProvider.set(mergeImportedSettings(profile.settings, currentSettings));
    }
};

export const validateSettings = (settings: any) => {
    const copy = omitPaths(settings, validationIgnorePaths);
    const validator = new Validator();
    validator.addSchema(keyBindSchema);
    validator.addSchema(ankiFieldSchema);
    validator.addSchema(dictionaryTrackSchema);
    validator.addSchema(textSubtitleSettingsSchema);
    const result = validator.validate(copy, settingsSchema);
    validateAllKnownKeys(copy, []);

    if (!result.valid) {
        throw new Error('Settings validation failed: ' + JSON.stringify(result.errors));
    }

    return ensureConsistencyOnRead(copy as AsbplayerSettings);
};

const validateAllKnownKeys = (object: any, path: string[]) => {
    for (const key of Object.keys(object)) {
        const schema = schemaAtPath(settingsSchema, path);

        // Empty string is sentinel value for 'additional properties' which can have any key
        if (schema === undefined || (schema !== '' && !(key in schema))) {
            throw new Error(`Unknown key '${[...path, key].join('.')}'`);
        }

        const value = object[key];

        if (typeof value === 'object' && !Array.isArray(value)) {
            validateAllKnownKeys(value, [...path, key]);
        }
    }
};

const schemaAtPath = (schema: any, path: string[]) => {
    let value = schema['properties'];

    for (const key of path) {
        if (typeof value[key] === 'object' && 'additionalProperties' in value[key]) {
            return '';
        }

        value = value[key]?.['properties'] ?? schemaForRef(value[key]?.['$ref'])?.['properties'];

        if (value === undefined) {
            return undefined;
        }
    }

    return value;
};

const schemaForRef = (ref: string) => {
    if (ref === '/KeyBind') {
        return keyBindSchema;
    }

    if (ref === '/AnkiField') {
        return ankiFieldSchema;
    }

    if (ref === '/DictionaryTrack') {
        return dictionaryTrackSchema;
    }

    if (ref === '/TextSubtitleSettings') {
        return textSubtitleSettingsSchema;
    }

    return undefined;
};
