import { z } from 'zod';
import {
    maximumWholeSubtitleMatchThreshold,
    minimumWholeSubtitleMatchThreshold,
    TokenFrequencyAnnotation,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenReadingAnnotation,
    TokenStyling,
    TokenStatus,
} from '@project/common/settings/settings-dictionary';
import {
    AutoPauseResumeMode,
    PauseOnHoverMode,
    SubtitleListPreference,
    SubtitleListTimestampDisplay,
    SubtitleVisibility,
    VideoSubtitleSplitBehavior,
} from '@project/common/settings/settings';
import { SubtitleHtml } from '@project/common/src/model';
import type { AsbplayerSettings } from '@project/common/settings/settings';
import { ensureConsistencyOnRead } from '@project/common/settings/settings-provider';
import { download, getCurrentTimeString } from '@project/common/util';

// Settings exported by other asbplayer versions may carry unknown keys inside
// array items (e.g. `subtitleAlignment` inside `subtitleTracksV2` entries), so
// schemas reachable only through arrays must stay loose. Schemas for objects
// hung directly off the settings root are strict to reject typos.

const keyBindSchema = z.strictObject({
    keys: z.string(),
});
const ankiFieldSchema = z.strictObject({
    order: z.number(),
    display: z.boolean(),
});

const tokenAnnotationDisplaySchema = z.looseObject({
    onHoverEnabled: z.boolean(),
    size: z.number(),
});

// `gloss` is optional here, unlike the other annotations, so imports lacking it stay valid.
const tokenAnnotationDisplayConfigSchema = z.looseObject({
    color: tokenAnnotationDisplaySchema,
    reading: tokenAnnotationDisplaySchema,
    frequency: tokenAnnotationDisplaySchema,
    gloss: tokenAnnotationDisplaySchema.optional(),
    pitchAccent: tokenAnnotationDisplaySchema,
});

const playbackTriggerSchema = z.looseObject({
    enabled: z.boolean(),
});

const playbackRulesSchema = z.looseObject({
    minWords: z.number().int().min(0),
    maxWords: z.number().int().min(0),
    minFrequency: z.number().int().min(0),
    maxFrequency: z.number().int().min(0),
});

const playbackTriggersSchema = z.looseObject({
    onStatuses: z.array(playbackTriggerSchema),
    onStates: z.array(playbackTriggerSchema),
    rules: playbackRulesSchema,
});

const dictionaryPlaybackConfigSchema = z.looseObject({
    selectOnPause: z.looseObject({
        onStatuses: z.array(playbackTriggerSchema),
        onStates: z.array(playbackTriggerSchema),
    }),
    autoPause: playbackTriggersSchema,
    repeat: playbackTriggersSchema,
    condensed: playbackTriggersSchema,
    fastForward: z.looseObject({
        onStatuses: z.array(playbackTriggerSchema),
        onStates: z.array(playbackTriggerSchema),
        rules: playbackRulesSchema,
        rateByComprehension: z.looseObject({
            enabled: z.boolean(),
            minimumPercent: z.number().int().min(0).max(99),
        }),
    }),
    wordVisibility: z.looseObject({
        onStatuses: z.array(playbackTriggerSchema),
        onStates: z.array(playbackTriggerSchema),
        rules: playbackRulesSchema,
        hideWordsIndividuallyUntilThreshold: z.boolean(),
        wholeSubtitleMatchThreshold: z
            .number()
            .min(minimumWholeSubtitleMatchThreshold)
            .max(maximumWholeSubtitleMatchThreshold),
    }),
});

const tokenStatusConfigSchema = z.looseObject({
    display: z.boolean(),
    color: z.string(),
    alpha: z.string(),
});

// `gloss` is optional here, unlike the other annotations, so imports lacking it stay valid.
const tokenAnnotationStatusSchema = z.looseObject({
    reading: z.boolean(),
    frequency: z.boolean(),
    gloss: z.boolean().optional(),
    pitchAccent: z.boolean(),
});

const dictionaryTrackSchema = z.looseObject({
    dictionaryColorizeSubtitles: z.boolean(),
    dictionaryAutoGenerateStatistics: z.boolean().optional(),
    dictionaryColorizeOnHoverOnly: z.boolean(),
    dictionaryHighlightOnHover: z.boolean(),
    dictionaryTokenMatchStrategy: z.enum(TokenMatchStrategy),
    dictionaryMatchAcrossScripts: z.boolean().optional(),
    dictionaryTokenMatchStrategyPriority: z.enum(TokenMatchStrategyPriority),
    dictionaryYomitanUrl: z.string(),
    dictionaryYomitanParser: z.enum(['scanning-parser', 'mecab']),
    dictionaryYomitanScanLength: z.number(),
    dictionaryTokenReadingAnnotation: z.enum(TokenReadingAnnotation),
    dictionaryDisplayIgnoredTokenReadings: z.boolean(),
    dictionaryTokenFrequencyAnnotation: z.enum(TokenFrequencyAnnotation),
    dictionaryAnkiDecks: z.array(z.string()),
    dictionaryAnkiWordFields: z.array(z.string()),
    dictionaryAnkiSentenceFields: z.array(z.string()),
    dictionaryAnkiSentenceTokenMatchStrategy: z.enum(TokenMatchStrategy),
    dictionaryAnkiMatureCutoff: z.number(),
    dictionaryAnkiTreatSuspended: z.union([z.enum(TokenStatus), z.literal('NORMAL')]),
    dictionaryWaniKaniApiToken: z.string().optional(),
    dictionaryTokenStyling: z.enum(TokenStyling),
    dictionaryTokenStylingThickness: z.number(),
    dictionaryColorizeFullyKnownTokens: z.boolean(),
    dictionaryTokenStatusColors: z.array(z.string()),
    dictionaryTokenStatusConfig: z.array(tokenStatusConfigSchema).optional(),
    dictionaryPlaybackConfig: dictionaryPlaybackConfigSchema.optional(),
    dictionaryTokenAnnotationConfig: z
        .looseObject({
            colorizeEnabled: z.boolean(),
            video: tokenAnnotationDisplayConfigSchema,
            subtitlePlayer: tokenAnnotationDisplayConfigSchema,
            onStatuses: z.array(tokenAnnotationStatusSchema),
            onStates: z.array(tokenAnnotationStatusSchema),
        })
        .optional(),
});

const textSubtitleSettingsSchema = z.looseObject({
    subtitleColor: z.string(),
    subtitleSize: z.number(),
    subtitleThickness: z.number(),
    subtitleOutlineThickness: z.number(),
    subtitleShadowColor: z.string(),
    subtitleBackgroundOpacity: z.number(),
    subtitleBackgroundColor: z.string(),
    subtitleFontFamily: z.string(),
    subtitleCustomStyles: z.array(
        z.looseObject({
            key: z.string().optional(),
            value: z.string().optional(),
        })
    ),
    subtitleBlur: z.boolean(),
});

const subtitleCustomStylesSchema = z.array(
    z.looseObject({
        key: z.string().optional(),
        value: z.string().optional(),
    })
);

const lastPlaybackPositionSchema = z.looseObject({
    fileName: z.string(),
    position: z.number(),
});

const settingsSchema = z
    .strictObject({
        ankiConnectUrl: z.string(),
        ankiConnectApiKey: z.string(),
        ankiRefreshBrowserAfterUpdate: z.boolean(),
        deck: z.string(),
        noteType: z.string(),
        sentenceField: z.string(),
        definitionField: z.string(),
        audioField: z.string(),
        imageField: z.string(),
        wordField: z.string(),
        sourceField: z.string(),
        urlField: z.string(),
        track1Field: z.string(),
        track2Field: z.string(),
        track3Field: z.string(),
        ankiFieldSettings: z
            .strictObject({
                sentence: ankiFieldSchema,
                definition: ankiFieldSchema,
                audio: ankiFieldSchema,
                image: ankiFieldSchema,
                word: ankiFieldSchema,
                source: ankiFieldSchema,
                url: ankiFieldSchema,
                track1: ankiFieldSchema,
                track2: ankiFieldSchema,
                track3: ankiFieldSchema,
            })
            // Older settings files may omit entries.
            .partial(),
        customAnkiFieldSettings: z.record(z.string(), ankiFieldSchema),
        subtitleSize: z.number(),
        subtitleColor: z.string(),
        subtitleThickness: z.number(),
        subtitleOutlineThickness: z.number(),
        subtitleShadowThickness: z.number(),
        subtitleShadowColor: z.string(),
        subtitleOutlineColor: z.string(),
        subtitleBackgroundColor: z.string(),
        subtitleBackgroundOpacity: z.number(),
        subtitleFontFamily: z.string(),
        subtitleBlur: z.boolean(),
        subtitlePreview: z.string(),
        subtitlePositionOffset: z.number(),
        topSubtitlePositionOffset: z.number(),
        subtitleAlignment: z.enum(['top', 'bottom']),
        subtitleTracksV2: z.array(textSubtitleSettingsSchema),
        audioPaddingStart: z.number(),
        audioPaddingEnd: z.number(),
        maxImageWidth: z.number(),
        maxImageHeight: z.number(),
        mediaFragmentFormat: z.enum(['jpeg', 'webm']),
        mediaFragmentTrimStart: z.number(),
        mediaFragmentTrimEnd: z.number(),
        mediaFragmentMaxClipLength: z.number(),
        trimBlackBars: z.boolean(),
        surroundingSubtitlesCountRadius: z.number(),
        surroundingSubtitlesTimeRadius: z.number(),
        autoPausePreference: z.number(),
        subtitleTriggerStartOffset: z.number(),
        subtitleTriggerEndOffset: z.number(),
        subtitleTriggerGapEndOffset: z.number(),
        subtitleTriggerGapStartOffset: z.number(),
        seekableTracks: z.number(),
        autoCopyableTracks: z.number(),
        subtitleHtml: z.enum(SubtitleHtml),
        seekDuration: z.number(),
        speedChangeStep: z.number(),
        playbackRate: z.number(),
        playbackRateNotificationEnabled: z.boolean(),
        rememberPlaybackRate: z.boolean(),
        fastForwardModePlaybackRate: z.number(),
        fastForwardPlaybackMinimumSkipIntervalMs: z.number(),
        repeatCountPreference: z.number(),
        repeatsBeforeShowingSubtitles: z.number().int(),
        autoPauseResumeMode: z.enum(AutoPauseResumeMode),
        autoPauseResumeDelayMs: z.number(),
        autoPauseFixedDurationMs: z.number(),
        autoPauseMinimumDurationMs: z.number(),
        autoPauseMaximumDurationMs: z.number(),
        autoPauseTimePerCharacterMs: z.number(),
        subtitleVisibility: z.enum(SubtitleVisibility),
        rememberPlaybackModes: z.boolean(),
        recipes: z.array(z.unknown()),
        activeRecipeId: z.union([z.number().int(), z.null()]),
        lastPlaybackModes: z.array(z.number()),
        lastPlaybackPositions: z.array(lastPlaybackPositionSchema),
        keyBindSet: z
            .strictObject({
                cycleRecipesForward: keyBindSchema,
                cycleRecipesBackward: keyBindSchema,
                toggleRecipe1: keyBindSchema,
                toggleRecipe2: keyBindSchema,
                toggleRecipe3: keyBindSchema,
                toggleRecipe4: keyBindSchema,
                toggleRecipe5: keyBindSchema,
                toggleRecipe6: keyBindSchema,
                toggleRecipe7: keyBindSchema,
                toggleRecipe8: keyBindSchema,
                toggleRecipe9: keyBindSchema,
                toggleRecipe10: keyBindSchema,
                togglePlay: keyBindSchema,
                toggleAutoPause: keyBindSchema,
                toggleCondensedPlayback: keyBindSchema,
                toggleFastForwardPlayback: keyBindSchema,
                toggleSubtitles: keyBindSchema,
                toggleVideoSubtitleTrack1: keyBindSchema,
                toggleVideoSubtitleTrack2: keyBindSchema,
                toggleVideoSubtitleTrack3: keyBindSchema,
                toggleAsbplayerSubtitleTrack1: keyBindSchema,
                toggleAsbplayerSubtitleTrack2: keyBindSchema,
                toggleAsbplayerSubtitleTrack3: keyBindSchema,
                unblurAsbplayerTrack1: keyBindSchema,
                unblurAsbplayerTrack2: keyBindSchema,
                unblurAsbplayerTrack3: keyBindSchema,
                seekBackward: keyBindSchema,
                seekForward: keyBindSchema,
                seekToPreviousSubtitle: keyBindSchema,
                seekToNextSubtitle: keyBindSchema,
                seekToBeginningOfCurrentSubtitle: keyBindSchema,
                adjustOffsetToPreviousSubtitle: keyBindSchema,
                adjustOffsetToNextSubtitle: keyBindSchema,
                decreaseOffset: keyBindSchema,
                increaseOffset: keyBindSchema,
                resetOffset: keyBindSchema,
                copySubtitle: keyBindSchema,
                ankiExport: keyBindSchema,
                updateLastCard: keyBindSchema,
                updateSelectedCard: keyBindSchema,
                exportCard: keyBindSchema,
                takeScreenshot: keyBindSchema,
                toggleRecording: keyBindSchema,
                selectSubtitleTrack: keyBindSchema,
                decreasePlaybackRate: keyBindSchema,
                increasePlaybackRate: keyBindSchema,
                toggleSidePanel: keyBindSchema,
                toggleRepeat: keyBindSchema,
                toggleSubtitleVisibility: keyBindSchema,
                cycleAutoPauseResumeMode: keyBindSchema,
                moveBottomSubtitlesUp: keyBindSchema,
                moveBottomSubtitlesDown: keyBindSchema,
                moveTopSubtitlesUp: keyBindSchema,
                moveTopSubtitlesDown: keyBindSchema,
                openStatistics: keyBindSchema,
                jumpToNextToken: keyBindSchema,
                jumpToPreviousToken: keyBindSchema,
                markHoveredToken5: keyBindSchema,
                jumpToNextTokenStatus5: keyBindSchema,
                jumpToPreviousTokenStatus5: keyBindSchema,
                markHoveredToken4: keyBindSchema,
                jumpToNextTokenStatus4: keyBindSchema,
                jumpToPreviousTokenStatus4: keyBindSchema,
                markHoveredToken3: keyBindSchema,
                jumpToNextTokenStatus3: keyBindSchema,
                jumpToPreviousTokenStatus3: keyBindSchema,
                markHoveredToken2: keyBindSchema,
                jumpToNextTokenStatus2: keyBindSchema,
                jumpToPreviousTokenStatus2: keyBindSchema,
                markHoveredToken1: keyBindSchema,
                jumpToNextTokenStatus1: keyBindSchema,
                jumpToPreviousTokenStatus1: keyBindSchema,
                markHoveredToken0: keyBindSchema,
                jumpToNextTokenStatus0: keyBindSchema,
                jumpToPreviousTokenStatus0: keyBindSchema,
                toggleHoveredTokenIgnored: keyBindSchema,
                jumpToNextTokenState0: keyBindSchema,
                jumpToPreviousTokenState0: keyBindSchema,
            })
            // Older settings files may omit entries.
            .partial(),
        recordWithAudioPlayback: z.boolean(),
        preferMp3: z.boolean(),
        alwaysUseSubtitleForSentence: z.boolean(),
        tabName: z.string(),
        miningHistoryStorageLimit: z.number(),
        clickToMineDefaultAction: z.number(),
        postMiningPlaybackState: z.number(),
        themeType: z.enum(['dark', 'light']),
        videoSubtitleSplitBehavior: z.enum(VideoSubtitleSplitBehavior),
        showSubtitleListMiningButton: z.boolean(),
        subtitleListTimestampDisplay: z.enum(SubtitleListTimestampDisplay),
        copyToClipboardOnMine: z.boolean(),
        updateLastCardForSameSubtitle: z.boolean(),
        rememberSubtitleOffset: z.boolean(),
        lastSubtitleOffset: z.number(),
        autoCopyCurrentSubtitle: z.boolean(),
        alwaysPlayOnSubtitleRepeat: z.boolean(),
        subtitleRegexFilter: z.string(),
        subtitleRegexFilterTextReplacement: z.string(),
        convertNetflixRuby: z.boolean(),
        language: z.string(),
        customAnkiFields: z.record(z.string(), z.string()),
        tags: z.array(z.string()),
        imageBasedSubtitleScaleFactor: z.number(),
        subtitleCustomStyles: subtitleCustomStylesSchema,
        subtitlesWidth: z.number(),
        subtitlesWidthUnit: z.enum(['%', 'px']),
        streamingAppUrl: z.string(),
        streamingDisplaySubtitles: z.boolean(),
        streamingRecordMedia: z.boolean(),
        streamingTakeScreenshot: z.boolean(),
        streamingCleanScreenshot: z.boolean(),
        streamingCropScreenshot: z.boolean(),
        streamingSubsDragAndDrop: z.boolean(),
        streamingAutoSync: z.boolean(),
        streamingAutoSyncPromptOnFailure: z.boolean(),
        streamingLastLanguagesSynced: z.record(z.string(), z.array(z.string())),
        streamingCondensedPlaybackMinimumSkipIntervalMs: z.number(),
        streamingScreenshotDelay: z.number(),
        streamingMediaFragmentFormat: z.enum(['jpeg', 'webp']),
        streamingAnimatedImageFps: z.number(),
        streamingAnimatedImageQuality: z.number(),
        streamingSubtitleListPreference: z.enum(SubtitleListPreference),
        streamingEnableOverlay: z.boolean(),
        webSocketClientEnabled: z.boolean(),
        webSocketServerUrl: z.string(),
        pauseOnHoverMode: z.enum(PauseOnHoverMode),
        lastSelectedAnkiExportMode: z.enum(['gui', 'updateLast', 'updateSpecific', 'default']),
        dictionaryTracks: z.array(dictionaryTrackSchema),
        thumbnailPreview: z.boolean(),
        subtitleAboveThumbnail: z.boolean(),
    })
    // Any settings key may be absent in an imported file.
    .partial();

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

export const exportSettings = (settings: AsbplayerSettings) => {
    download(
        new Blob([JSON.stringify(settingsForExport(settings))], { type: 'application/json' }),
        `asbplayer-settings-${getCurrentTimeString()}.json`
    );
};

export const validateSettings = (settings: any) => {
    const copy = omitPaths(settings, validationIgnorePaths);
    const result = settingsSchema.safeParse(copy);

    if (!result.success) {
        throw new Error('Settings validation failed: ' + z.prettifyError(result.error));
    }

    // `streamingPages` is stripped before validation and absent from the
    // schema, so validate the input rather than zod's parsed output.
    return ensureConsistencyOnRead(copy as AsbplayerSettings);
};

// Compile-time drift guard: the import schema must track the settings model.
// Adding a setting (or key bind) without updating the schema, or vice versa, fails `tsc`.
// Assignability (not key lists) is checked so nested objects are covered too;
// required-vs-optional mismatches are covered by runtime tests.
type ParsedSettings = z.infer<typeof settingsSchema>;
type ImportableSettings = Omit<AsbplayerSettings, 'streamingPages'>;
// `recipes` items are intentionally untyped here: recipe data is sanitized
// item-by-item downstream by `normalizeRecipe`, which drops malformed recipes
// instead of rejecting the whole import the way schema validation would.
type ParsedSettingsExceptRecipes = Omit<ParsedSettings, 'recipes'>;
type ImportableSettingsExceptRecipes = Omit<ImportableSettings, 'recipes'>;
type Expect<T extends true> = T;
type KeySubset<A, B> = [Exclude<keyof A, keyof B>] extends [never] ? true : false;
// DeepPartial/DeepReadonly normalize optionality and readonly-ness, which the
// schema (all keys optional) and the settings model (readonly) express
// differently but which behave identically at runtime.
type DeepPartial<T> = T extends readonly (infer U)[]
    ? readonly DeepPartial<U>[]
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;
type DeepReadonly<T> = T extends (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;
// Strips the `[x: string]: unknown` passthrough index signature that loose
// objects add. The settings model's interfaces can never satisfy it.
type Plain<T> = T extends readonly (infer U)[]
    ? readonly Plain<U>[]
    : T extends object
      ? { [K in keyof T as string extends K ? never : K]: Plain<T[K]> }
      : T;

type DriftedSchemaField = {
    [K in keyof ParsedSettingsExceptRecipes]: ParsedSettingsExceptRecipes[K] extends DeepPartial<ImportableSettingsExceptRecipes>[K]
        ? never
        : K;
}[keyof ParsedSettingsExceptRecipes];
type DriftedSettingsField = {
    [K in keyof ImportableSettingsExceptRecipes]: ImportableSettingsExceptRecipes[K] extends DeepReadonly<
        Plain<ParsedSettingsExceptRecipes[K]>
    >
        ? never
        : K;
}[keyof ImportableSettingsExceptRecipes];

export type SettingsSchemaDriftGuard = [
    Expect<[KeySubset<ImportableSettings, ParsedSettings>] extends [true] ? true : 'settings keys missing from schema'>,
    Expect<[KeySubset<ParsedSettings, ImportableSettings>] extends [true] ? true : 'unknown schema keys'>,
    Expect<[DriftedSchemaField] extends [never] ? true : `${DriftedSchemaField & string} drifts from settings model`>,
    Expect<[DriftedSettingsField] extends [never] ? true : `${DriftedSettingsField & string} drifts from schema`>,
];
