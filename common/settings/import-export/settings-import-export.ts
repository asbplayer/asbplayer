import { z } from 'zod';
import {
    dictionaryAnkiTreatSuspendedNormal,
    dictionaryYomitanParsers,
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
    mediaFragmentFormats,
    PauseOnHoverMode,
    streamingMediaFragmentFormats,
    SubtitleListPreference,
    SubtitleListTimestampDisplay,
    SubtitleVisibility,
    subtitleAlignments,
    subtitlesWidthUnits,
    themeTypes,
    VideoSubtitleSplitBehavior,
} from '@project/common/settings/settings';
import { ankiExportModes, SubtitleHtml } from '@project/common/src/model';
import type { AsbplayerSettings } from '@project/common/settings/settings';
import { defaultSettings, ensureConsistencyOnRead } from '@project/common/settings/settings-provider';
import { asbTrace } from '@project/common/util/log';
import { download, getCurrentTimeString } from '@project/common/util';

// All schemas are strict, including nested ones. `validateSettings`
// strips `deprecatedPaths` and runs `ensureConsistencyOnRead` before
// validation, filling what older exports lack. That keeps historical exports
// importable.
// `settings-schema-conformance.test.ts` keeps the schema in sync with the
// settings model key-for-key. Nested keys inside containers that consistency
// fills can stay required; containers without a fill source
// (`customAnkiFieldSettings` values, `lastPlaybackPositions`) must keep new
// keys optional.

const keyBindSchema = z.strictObject({
    keys: z.string(),
});
const ankiFieldSchema = z.strictObject({
    order: z.number(),
    display: z.boolean(),
});

const tokenAnnotationDisplaySchema = z.strictObject({
    onHoverEnabled: z.boolean(),
    hoverPerToken: z.boolean(),
    size: z.number(),
});

const tokenAnnotationDisplayConfigSchema = z.strictObject({
    color: tokenAnnotationDisplaySchema,
    reading: tokenAnnotationDisplaySchema,
    frequency: tokenAnnotationDisplaySchema,
    gloss: tokenAnnotationDisplaySchema,
    pitchAccent: tokenAnnotationDisplaySchema,
});

const playbackTriggerSchema = z.strictObject({
    enabled: z.boolean(),
});

const playbackRulesSchema = z.strictObject({
    minWords: z.number().int().min(0),
    maxWords: z.number().int().min(0),
    minFrequency: z.number().int().min(0),
    maxFrequency: z.number().int().min(0),
});

const playbackTriggersSchema = z.strictObject({
    onStatuses: z.array(playbackTriggerSchema),
    onStates: z.array(playbackTriggerSchema),
    rules: playbackRulesSchema,
});

const dictionaryPlaybackConfigSchema = z.strictObject({
    selectOnPause: z.strictObject({
        onStatuses: z.array(playbackTriggerSchema),
        onStates: z.array(playbackTriggerSchema),
    }),
    autoPause: playbackTriggersSchema,
    repeat: playbackTriggersSchema,
    condensed: playbackTriggersSchema,
    fastForward: z.strictObject({
        onStatuses: z.array(playbackTriggerSchema),
        onStates: z.array(playbackTriggerSchema),
        rules: playbackRulesSchema,
        rateByComprehension: z.strictObject({
            enabled: z.boolean(),
            minimumPercent: z.number().int().min(0).max(99),
        }),
    }),
    wordVisibility: z.strictObject({
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

const tokenStatusConfigSchema = z.strictObject({
    display: z.boolean(),
    color: z.string(),
    alpha: z.string(),
});

const tokenAnnotationStatusSchema = z.strictObject({
    reading: z.boolean(),
    frequency: z.boolean(),
    gloss: z.boolean(),
    pitchAccent: z.boolean(),
});

const dictionaryTrackSchema = z.strictObject({
    dictionaryColorizeSubtitles: z.boolean(),
    dictionaryAutoGenerateStatistics: z.boolean(),
    dictionaryColorizeOnHoverOnly: z.boolean(),
    dictionaryHighlightOnHover: z.boolean(),
    dictionaryTokenMatchStrategy: z.enum(TokenMatchStrategy),
    dictionaryMatchAcrossScripts: z.boolean(),
    dictionaryTokenMatchStrategyPriority: z.enum(TokenMatchStrategyPriority),
    dictionaryYomitanUrl: z.string(),
    dictionaryYomitanParser: z.enum(dictionaryYomitanParsers),
    dictionaryYomitanScanLength: z.number(),
    dictionaryTokenReadingAnnotation: z.enum(TokenReadingAnnotation),
    dictionaryDisplayIgnoredTokenReadings: z.boolean(),
    dictionaryTokenFrequencyAnnotation: z.enum(TokenFrequencyAnnotation),
    dictionaryAnkiDecks: z.array(z.string()),
    dictionaryAnkiWordFields: z.array(z.string()),
    dictionaryAnkiSentenceFields: z.array(z.string()),
    dictionaryAnkiSentenceTokenMatchStrategy: z.enum(TokenMatchStrategy),
    dictionaryAnkiMatureCutoff: z.number(),
    dictionaryAnkiTreatSuspended: z.union([z.enum(TokenStatus), z.literal(dictionaryAnkiTreatSuspendedNormal)]),
    dictionaryWaniKaniApiToken: z.string(),
    dictionaryTokenStyling: z.enum(TokenStyling),
    dictionaryTokenStylingThickness: z.number(),
    dictionaryColorizeFullyKnownTokens: z.boolean(),
    dictionaryTokenStatusColors: z.array(z.string()),
    dictionaryTokenStatusConfig: z.array(tokenStatusConfigSchema),
    dictionaryPlaybackConfig: dictionaryPlaybackConfigSchema,
    dictionaryTokenAnnotationConfig: z.strictObject({
        colorizeEnabled: z.boolean(),
        video: tokenAnnotationDisplayConfigSchema,
        subtitlePlayer: tokenAnnotationDisplayConfigSchema,
        onStatuses: z.array(tokenAnnotationStatusSchema),
        onStates: z.array(tokenAnnotationStatusSchema),
    }),
});

const subtitleCustomStylesSchema = z.array(
    z.strictObject({
        key: z.string().optional(),
        value: z.string().optional(),
    })
);

const textSubtitleSettingsSchema = z.strictObject({
    subtitleColor: z.string(),
    subtitleSize: z.number(),
    subtitleThickness: z.number(),
    subtitleOutlineThickness: z.number(),
    subtitleOutlineColor: z.string(),
    subtitleShadowThickness: z.number(),
    subtitleShadowColor: z.string(),
    subtitleBackgroundOpacity: z.number(),
    subtitleBackgroundColor: z.string(),
    subtitleFontFamily: z.string(),
    subtitleCustomStyles: subtitleCustomStylesSchema,
    subtitleBlur: z.boolean(),
    subtitleAlignment: z.enum(subtitleAlignments),
});

const lastPlaybackPositionSchema = z.strictObject({
    fileName: z.string(),
    position: z.number(),
});

export const settingsSchema = z
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
        ankiFieldSettings: z.strictObject({
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
        }),
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
        subtitleAlignment: z.enum(subtitleAlignments),
        subtitleTracksV2: z.array(textSubtitleSettingsSchema),
        audioPaddingStart: z.number(),
        audioPaddingEnd: z.number(),
        maxImageWidth: z.number(),
        maxImageHeight: z.number(),
        mediaFragmentFormat: z.enum(mediaFragmentFormats),
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
        keyBindSet: z.strictObject({
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
        }),
        recordWithAudioPlayback: z.boolean(),
        preferMp3: z.boolean(),
        alwaysUseSubtitleForSentence: z.boolean(),
        tabName: z.string(),
        miningHistoryStorageLimit: z.number(),
        clickToMineDefaultAction: z.number(),
        postMiningPlaybackState: z.number(),
        themeType: z.enum(themeTypes),
        videoSubtitleSplitBehavior: z.enum(VideoSubtitleSplitBehavior),
        showSubtitleListMiningButton: z.boolean(),
        subtitleListTimestampDisplay: z.enum(SubtitleListTimestampDisplay),
        copyToClipboardOnMine: z.boolean(),
        updateLastCardForSameSubtitle: z.boolean(),
        updateLastCardSentenceForSameSubtitle: z.boolean(),
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
        subtitlesWidthUnit: z.enum(subtitlesWidthUnits),
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
        streamingMediaFragmentFormat: z.enum(streamingMediaFragmentFormats),
        streamingAnimatedImageFps: z.number(),
        streamingAnimatedImageQuality: z.number(),
        streamingSubtitleListPreference: z.enum(SubtitleListPreference),
        streamingEnableOverlay: z.boolean(),
        webSocketClientEnabled: z.boolean(),
        webSocketServerUrl: z.string(),
        pauseOnHoverMode: z.enum(PauseOnHoverMode),
        lastSelectedAnkiExportMode: z.enum(ankiExportModes),
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
    ['lastPlaybackPositions'], // Ignored since it exposes browsing history
];
const validationIgnorePaths: readonly IgnorePath[] = [['streamingPages']];

// Keys older asbplayer versions wrote that no longer exist in the settings
// model. Strict schemas would reject them as typos, so they are stripped
// before validation. When removing a setting from the model, add its path
// here, or keep it as a deprecated model field if its value must migrate. A
// '*' segment applies to every array item. `settings-schema-conformance.test.ts`
// checks that each path points at a key the schema no longer knows.
export const deprecatedPaths: readonly IgnorePath[] = [
    // Exported up to v1.9.1, before the subtitle DOM was always pre-cached.
    ['preCacheSubtitleDom'],
    // Added and removed between releases; the hosted app deploys from main and
    // could have exported it in between.
    ['keyBindSet', 'updateSelectedCard'],
    // Accepted by the old validator despite never being a setting.
    ['_schema'],
];

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

export const validateSettings = (settings: any, fillSource: AsbplayerSettings = defaultSettings) => {
    const copy = omitPaths(settings, [...validationIgnorePaths, ...deprecatedPaths]);

    // ensureConsistencyOnRead migrates settings from old asbplayer versions.
    // It assumes the incoming data is valid, so it's possible for garbage data
    // to cause an exception to be thrown.
    // Even though the exception is swallowed, later validation would still reject
    // garbage data.
    let normalized = copy;
    try {
        normalized = ensureConsistencyOnRead(copy, fillSource);
    } catch (error) {
        // Also catches bugs in consistency itself; trace so a bug that rejects
        // valid imports stays diagnosable.
        asbTrace('settings/import', 'Consistency threw on imported settings; validating the partially migrated copy', {
            error,
        });
    }

    // `streamingPages` is stripped above and absent from the schema, so the
    // normalized input is validated, not zod's parsed output.
    const result = settingsSchema.safeParse(normalized);

    if (!result.success) {
        throw new Error('Settings validation failed: ' + z.prettifyError(result.error));
    }

    return normalized as Partial<AsbplayerSettings>;
};
