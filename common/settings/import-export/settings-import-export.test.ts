import { PauseOnHoverMode, VideoSubtitleSplitBehavior } from '@project/common/settings/settings';
import {
    TokenMatchStrategyPriority,
    TokenMatchStrategy,
    TokenStyling,
    TokenReadingAnnotation,
    TokenFrequencyAnnotation,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import {
    mergeImportedSettings,
    omitPath,
    settingsForExport,
    validateSettings,
} from '@project/common/settings/import-export';
import { defaultSettings } from '@project/common/settings/settings-provider';
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PlayMode } from '@project/common';

it('validates the default settings', () => {
    validateSettings(defaultSettings);
});

it('imports a file old enough to exercise the consistency migration paths', () => {
    // Hand-built export from before annotation configs, playback settings,
    // recipes, and newer key binds.
    const imported = validateSettings({
        ankiConnectUrl: 'http://127.0.0.1:8765',
        deck: 'Sentences',
        themeType: 'dark',
        language: 'en',
        subtitleAlignment: 'top',
        subtitleSize: 36,
        subtitleColor: '#ffffff',
        subtitleTracksV2: [
            {
                subtitleColor: '#ffffff',
                subtitleSize: 36,
                subtitleThickness: 700,
                subtitleCustomStyles: [],
                subtitleBlur: false,
            },
        ],
        ankiFieldSettings: {
            sentence: { order: 1, display: true },
            definition: { order: 2, display: true },
            word: { order: 3, display: true },
            audio: { order: 4, display: true },
            image: { order: 5, display: true },
            source: { order: 6, display: true },
            url: { order: 7, display: true },
        },
        keyBindSet: {
            togglePlay: { keys: 'space' },
            toggleAutoPause: { keys: '⇧+P' },
        },
        recipes: [
            { name: 'Test recipe', playbackModes: [PlayMode.normal], settings: { playbackRate: 1.5 } },
            'garbage',
        ],
        activeRecipeId: 1,
        dictionaryTracks: [
            {
                dictionaryColorizeSubtitles: true,
                dictionaryColorizeOnHoverOnly: true,
                dictionaryHighlightOnHover: true,
                dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
                dictionaryYomitanUrl: 'http://127.0.0.1:19633',
                dictionaryYomitanScanLength: 16,
                dictionaryTokenReadingAnnotation: TokenReadingAnnotation.ALWAYS,
                dictionaryDisplayIgnoredTokenReadings: true,
                dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.ALWAYS,
                dictionaryAnkiDecks: [],
                dictionaryAnkiWordFields: [],
                dictionaryAnkiSentenceFields: [],
                dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                dictionaryAnkiMatureCutoff: 21,
                dictionaryAnkiTreatSuspended: 'NORMAL',
                dictionaryTokenStyling: TokenStyling.UNDERLINE,
                dictionaryTokenStylingThickness: 3,
                dictionaryColorizeFullyKnownTokens: true,
            },
        ],
    });

    // Track count padded to the current number of tracks.
    expect(imported.dictionaryTracks).toHaveLength(3);
    const track = imported.dictionaryTracks![0];

    // Per-track keys the old version could not have written are filled from
    // the fill source; this direct call has no current settings, so defaults.
    expect(imported.subtitleTracksV2).toHaveLength(1);
    const trackEntry = imported.subtitleTracksV2![0];
    expect(trackEntry.subtitleAlignment).toBe(defaultSettings.subtitleAlignment);
    expect(trackEntry.subtitleOutlineColor).toBe(defaultSettings.subtitleOutlineColor);
    expect(trackEntry.subtitleShadowThickness).toBe(defaultSettings.subtitleShadowThickness);

    // Token colors/config absent from the file are created and padded.
    expect(track.dictionaryTokenStatusColors).toEqual([
        '#FF0000',
        '#FFA500',
        '#FFFF00',
        '#00FF00',
        '#0000FF',
        '#FFFFFF',
    ]);
    expect(track.dictionaryTokenStatusConfig).toHaveLength(6);
    expect(track.dictionaryTokenStatusConfig[TokenStatus.MATURE].display).toBe(true);

    // The flat deprecated fields migrate into the annotation config.
    const annotation = track.dictionaryTokenAnnotationConfig;
    expect(annotation.colorizeEnabled).toBe(true);
    expect(annotation.video.color.onHoverEnabled).toBe(true);
    expect(annotation.video.gloss).toEqual({ onHoverEnabled: true, size: 0.5 });
    expect(annotation.onStates[TokenState.IGNORED].reading).toBe(true);
    expect(annotation.onStatuses.every((s) => s.reading && s.frequency && !s.gloss && !s.pitchAccent)).toBe(true);

    // Playback settings absent from the file are synthesized.
    expect(track.dictionaryPlaybackConfig.autoPause.onStatuses).toHaveLength(6);
    expect(track.dictionaryPlaybackConfig.autoPause.rules).toEqual({
        minWords: 0,
        maxWords: 0,
        minFrequency: 0,
        maxFrequency: 0,
    });

    // Later per-track settings are filled from defaults.
    expect(track.dictionaryYomitanParser).toBe('scanning-parser');
    expect(track.dictionaryWaniKaniApiToken).toBe('');
    expect(track.dictionaryMatchAcrossScripts).toBe(true);
    expect(track.dictionaryAutoGenerateStatistics).toBe(false);

    // Key binds added after the file's era are filled; provided ones survive.
    for (const key of Object.keys(defaultSettings.keyBindSet)) {
        expect(imported.keyBindSet).toHaveProperty(key);
    }
    expect(imported.keyBindSet!.togglePlay).toEqual({ keys: 'space' });
    expect(imported.keyBindSet!.toggleRecipe1).toEqual(defaultSettings.keyBindSet.toggleRecipe1);

    // Anki field settings added after the file's era are filled.
    expect(imported.ankiFieldSettings!.track1).toEqual(defaultSettings.ankiFieldSettings.track1);
    expect(imported.ankiFieldSettings!.sentence).toEqual({ order: 1, display: true });

    // Malformed recipes are dropped and the dangling selection is cleared.
    expect(imported.recipes).toHaveLength(1);
    expect(imported.recipes![0].name).toBe('Test recipe');
    expect(imported.activeRecipeId).toBeNull();

    // Keys absent from the file stay absent (imports are patches over current
    // settings), and `streamingPages` is never part of an import.
    expect(imported.subtitlePreview).toBeUndefined();
    expect(imported.streamingPages).toBeUndefined();
});

it('imports a real v1.22.0 export through the settings dialog path', () => {
    // Produced by the v1.22.0 release. Catches key removals and renames that
    // were not added to `deprecatedPaths`, which hand-built fixtures miss.
    const legacyExport = JSON.parse(
        readFileSync(join(__dirname, '__fixtures__', 'v1.22.0-settings-export.json'), 'utf-8')
    );

    const imported = validateSettings(mergeImportedSettings(legacyExport, defaultSettings), defaultSettings);

    expect(imported.customAnkiFieldSettings).toEqual({ MyCustomField: { order: 99, display: true } });
    expect(imported.customAnkiFields).toEqual({ MyCustomField: 'カスタム' });
});

it('fails validation when an unknown key is encountered', () => {
    expect(() => validateSettings({ ...defaultSettings, asdf: 'jkl;' })).toThrow('Unrecognized key: "asdf"');
});

it('fails validation when an unknown key bind key is encountered', () => {
    expect(() =>
        validateSettings({ ...defaultSettings, keyBindSet: { ...defaultSettings.keyBindSet, asdf: { keys: 'a' } } })
    ).toThrow('Unrecognized key: "asdf"\n  → at keyBindSet');
});

it('fails validation when an unknown key is encountered inside an Anki field setting', () => {
    expect(() =>
        validateSettings({
            ...defaultSettings,
            ankiFieldSettings: { ...defaultSettings.ankiFieldSettings, sentence: { order: 0, display: true, asdf: 1 } },
        })
    ).toThrow('Unrecognized key: "asdf"\n  → at ankiFieldSettings.sentence');
});

it('rejects unknown keys inside dictionary track settings', () => {
    // Strict schemas treat unrecognized keys as typos everywhere, including
    // inside array items; legacy keys must be listed in `deprecatedPaths`.
    const settings = {
        ...defaultSettings,
        dictionaryTracks: defaultSettings.dictionaryTracks.map((track) => ({ ...track, newKeyFromNewerVersion: 1 })),
    };
    expect(() => validateSettings(settings)).toThrow('Unrecognized key: "newKeyFromNewerVersion"');
});

it('imports files containing settings that were later removed from the model', () => {
    // v1.9.1 and earlier exported `preCacheSubtitleDom`, the hosted app briefly
    // exported `keyBindSet.updateSelectedCard`, and earlier versions accepted
    // `_schema`. Removing them from the model must not make those files
    // unimportable.
    const imported = validateSettings({
        ...defaultSettings,
        preCacheSubtitleDom: true,
        _schema: 1,
        keyBindSet: { ...defaultSettings.keyBindSet, updateSelectedCard: { keys: 'Q+U' } },
    });

    expect(imported).not.toHaveProperty('preCacheSubtitleDom');
    expect(imported).not.toHaveProperty('_schema');
    expect(imported.keyBindSet).not.toHaveProperty('updateSelectedCard');
    expect(imported.keyBindSet!.togglePlay).toEqual(defaultSettings.keyBindSet.togglePlay);
});

it('rejects null values where an object is expected instead of repairing them', () => {
    // No legitimate export contains these. Consistency throws on them; the
    // catch falls back to validating the raw copy, which must still reject.
    expect(() => validateSettings({ ...defaultSettings, keyBindSet: null })).toThrow('Settings validation failed');
    expect(() =>
        validateSettings({ ...defaultSettings, dictionaryTracks: [null, ...defaultSettings.dictionaryTracks.slice(1)] })
    ).toThrow('Settings validation failed');
});

it('validates custom Anki field settings', () => {
    const settings = {
        ...defaultSettings,
        customAnkiFieldSettings: { myCustomField: { order: 99, display: false } },
    };
    const imported = validateSettings(settings);
    expect(imported.customAnkiFieldSettings).toEqual({ myCustomField: { order: 99, display: false } });
});

it('fails validation when a custom Anki field setting is malformed', () => {
    const settings = {
        ...defaultSettings,
        customAnkiFieldSettings: { myCustomField: { order: 'not-a-number', display: true } },
    };
    expect(() => validateSettings(settings)).toThrow('Settings validation failed');
});

it('validates last languages synced', () => {
    validateSettings({ ...defaultSettings, streamingLastLanguagesSynced: { 'domain.com': ['en', 'ja'] } });
});

describe('omitPath', () => {
    it('removes a top-level key', () => {
        const value = { keep: 'value', remove: 'secret' };

        expect(omitPath(value, ['remove'])).toEqual({ keep: 'value' });
    });

    it('removes a nested key', () => {
        const value = { outer: { keep: 'value', remove: 'secret' } };

        expect(omitPath(value, ['outer', 'remove'])).toEqual({ outer: { keep: 'value' } });
    });

    it('applies a wildcard to every array item', () => {
        const value = {
            tracks: [
                { keep: 'first', remove: 'first-secret' },
                { keep: 'second', remove: 'second-secret' },
            ],
        };

        expect(omitPath(value, ['tracks', '*', 'remove'])).toEqual({
            tracks: [{ keep: 'first' }, { keep: 'second' }],
        });
    });

    it('handles empty arrays and out-of-range indexes', () => {
        const empty = { tracks: [] };
        const populated = { tracks: [{ keep: 'value' }] };

        expect(omitPath(empty, ['tracks', '*', 'remove'])).toEqual({ tracks: [] });
        expect(omitPath(populated, ['tracks', '1', 'remove'])).toEqual(populated);
    });

    it('applies a path to one array index', () => {
        const value = {
            tracks: [
                { keep: 'first', remove: 'first-secret' },
                { keep: 'second', remove: 'second-secret' },
                { keep: 'third', remove: 'third-secret' },
            ],
        };

        expect(omitPath(value, ['tracks', '1', 'remove'])).toEqual({
            tracks: [
                { keep: 'first', remove: 'first-secret' },
                { keep: 'second' },
                { keep: 'third', remove: 'third-secret' },
            ],
        });
    });

    it('applies a wildcard to object values', () => {
        const value = {
            profiles: {
                first: { keep: 'first', remove: 'first-secret' },
                second: { keep: 'second', remove: 'second-secret' },
            },
        };

        expect(omitPath(value, ['profiles', '*', 'remove'])).toEqual({
            profiles: { first: { keep: 'first' }, second: { keep: 'second' } },
        });
    });

    it('does not mutate the input', () => {
        const value = { nested: { remove: 'secret' } };

        omitPath(value, ['nested', 'remove']);

        expect(value).toEqual({ nested: { remove: 'secret' } });
    });

    it('leaves values unchanged when the path cannot be traversed', () => {
        const value = { nested: null, primitive: 'value' };

        expect(omitPath(value, ['missing', 'key'])).toEqual(value);
        expect(omitPath(value, ['nested', 'key'])).toEqual(value);
        expect(omitPath(value, ['primitive', 'key'])).toEqual(value);
        expect(omitPath(value, [])).toBe(value);
    });
});

it('preserves dictionary playback rules through settings export and import', () => {
    const playback = JSON.parse(JSON.stringify(defaultSettings.dictionaryTracks[0].dictionaryPlaybackConfig));
    playback.autoPause.onStatuses[1].enabled = true;
    playback.autoPause.rules.minWords = 1;
    playback.autoPause.rules.maxWords = 2;
    playback.autoPause.rules.minFrequency = 100001;
    playback.autoPause.rules.maxFrequency = 200000;
    playback.fastForward.rateByComprehension.enabled = true;
    playback.fastForward.rateByComprehension.minimumPercent = 80;
    const settings = {
        ...defaultSettings,
        dictionaryTracks: defaultSettings.dictionaryTracks.map((track, index) =>
            index === 0 ? { ...track, dictionaryPlaybackConfig: playback } : track
        ),
    };
    const imported = validateSettings(mergeImportedSettings(settingsForExport(settings), defaultSettings));
    expect(imported.dictionaryTracks?.[0].dictionaryPlaybackConfig).toEqual(playback);
});

it('fills missing playback fields from defaults instead of rejecting them', () => {
    // A file whose playback config predates a field is indistinguishable from
    // a corrupt one, so missing fields are synthesized; corruption that is
    // distinguishable (wrong types, unknown keys, out-of-range values) still
    // fails, as asserted by the tests below.
    const legacy = JSON.parse(JSON.stringify(defaultSettings));
    delete legacy.dictionaryTracks[0].dictionaryPlaybackConfig;
    const imported = validateSettings(legacy);
    expect(imported.dictionaryTracks![0].dictionaryPlaybackConfig).toEqual(
        defaultSettings.dictionaryTracks[0].dictionaryPlaybackConfig
    );

    const missingFields = [
        (config: any) => delete config.selectOnPause,
        (config: any) => delete config.selectOnPause.onStatuses,
        (config: any) => delete config.selectOnPause.onStates,
        (config: any) => delete config.autoPause.onStatuses,
        (config: any) => delete config.autoPause.onStatuses[0].enabled,
        (config: any) => delete config.repeat.onStates[0].enabled,
        (config: any) => delete config.autoPause,
        (config: any) => delete config.autoPause.rules,
        (config: any) => delete config.autoPause.rules.minWords,
        (config: any) => delete config.autoPause.rules.maxWords,
        (config: any) => delete config.autoPause.rules.minFrequency,
        (config: any) => delete config.autoPause.rules.maxFrequency,
        (config: any) => delete config.wordVisibility.hideWordsIndividuallyUntilThreshold,
        (config: any) => delete config.wordVisibility.wholeSubtitleMatchThreshold,
        (config: any) => delete config.fastForward.rateByComprehension,
        (config: any) => delete config.fastForward.rateByComprehension.enabled,
        (config: any) => delete config.fastForward.rateByComprehension.minimumPercent,
    ];
    for (const removeField of missingFields) {
        const settings = JSON.parse(JSON.stringify(defaultSettings));
        removeField(settings.dictionaryTracks[0].dictionaryPlaybackConfig);
        const imported = validateSettings(settings);
        expect(imported.dictionaryTracks![0].dictionaryPlaybackConfig).toEqual(
            defaultSettings.dictionaryTracks[0].dictionaryPlaybackConfig
        );
    }
});

it('fills playback features and subkeys an older version could not have written', () => {
    // Mirrors a real pre-selectOnPause, pre-minimumPercent export.
    const settings = JSON.parse(JSON.stringify(defaultSettings));
    const playback = settings.dictionaryTracks[0].dictionaryPlaybackConfig;
    delete playback.selectOnPause;
    playback.fastForward.rateByComprehension = { enabled: true };

    const imported = validateSettings(settings);
    const config = imported.dictionaryTracks![0].dictionaryPlaybackConfig;
    expect(config.selectOnPause).toEqual({
        onStatuses: Array.from({ length: 6 }, () => ({ enabled: false })),
        onStates: [{ enabled: false }],
    });
    // Values the file did write are preserved, not reset.
    expect(config.fastForward.rateByComprehension).toEqual({ enabled: true, minimumPercent: 60 });
});

it('accepts only whole-number minimum comprehension percentages from zero through ninety-nine', () => {
    for (const minimumPercent of [0, 60, 99]) {
        const settings = JSON.parse(JSON.stringify(defaultSettings));
        settings.dictionaryTracks[0].dictionaryPlaybackConfig.fastForward.rateByComprehension.minimumPercent =
            minimumPercent;
        expect(() => validateSettings(settings)).not.toThrow();
    }
    for (const minimumPercent of [-1, 100, 60.5, true]) {
        const settings = JSON.parse(JSON.stringify(defaultSettings));
        settings.dictionaryTracks[0].dictionaryPlaybackConfig.fastForward.rateByComprehension.minimumPercent =
            minimumPercent;
        expect(() => validateSettings(settings)).toThrow('Settings validation failed');
    }
});

it('validates and round trips pause-selection playback triggers without rules', () => {
    const settings = JSON.parse(JSON.stringify(defaultSettings));
    const config = settings.dictionaryTracks[0].dictionaryPlaybackConfig.selectOnPause;
    config.onStatuses[1].enabled = true;
    config.onStates[0].enabled = true;
    const imported = validateSettings(settingsForExport(settings));
    expect(imported.dictionaryTracks![0].dictionaryPlaybackConfig.selectOnPause).toEqual(config);
    expect(config).not.toHaveProperty('rules');
    for (const trigger of [config.onStatuses[1], config.onStates[0]]) {
        for (const invalid of ['true', 1, null]) {
            trigger.enabled = invalid;
            expect(() => validateSettings(settings)).toThrow('Settings validation failed');
        }
        // A deleted `enabled` field is filled from defaults; it is
        // indistinguishable from a version that predates the field.
        delete trigger.enabled;
        expect(() => validateSettings(settings)).not.toThrow();
        trigger.enabled = true;
    }
});

it('accepts only whole-subtitle match thresholds from one through one hundred percent', () => {
    for (const threshold of [0.01, 0.5, 1]) {
        const settings = JSON.parse(JSON.stringify(defaultSettings));
        settings.dictionaryTracks[0].dictionaryPlaybackConfig.wordVisibility.wholeSubtitleMatchThreshold = threshold;
        expect(() => validateSettings(settings)).not.toThrow();
    }
    for (const threshold of [0, 0.009, -0.1, 1.1, true]) {
        const settings = JSON.parse(JSON.stringify(defaultSettings));
        settings.dictionaryTracks[0].dictionaryPlaybackConfig.wordVisibility.wholeSubtitleMatchThreshold = threshold;
        expect(() => validateSettings(settings)).toThrow('Settings validation failed');
    }
});

it('requires a boolean for individual word hiding before the threshold', () => {
    for (const value of [true, false]) {
        const settings = JSON.parse(JSON.stringify(defaultSettings));
        settings.dictionaryTracks[0].dictionaryPlaybackConfig.wordVisibility.hideWordsIndividuallyUntilThreshold =
            value;
        expect(() => validateSettings(settings)).not.toThrow();
    }
    for (const value of [0, 1, 'true', null]) {
        const settings = JSON.parse(JSON.stringify(defaultSettings));
        settings.dictionaryTracks[0].dictionaryPlaybackConfig.wordVisibility.hideWordsIndividuallyUntilThreshold =
            value;
        expect(() => validateSettings(settings)).toThrow('Settings validation failed');
    }
});

it('excludes ignored keys from settings exports without mutating the settings', () => {
    const settings = {
        ...defaultSettings,
        ankiConnectApiKey: 'anki-secret',
        lastPlaybackPositions: [{ fileName: 'video.mp4', position: 1234 }],
        dictionaryTracks: defaultSettings.dictionaryTracks.map((track, index) => ({
            ...track,
            dictionaryWaniKaniApiToken: `wanikani-secret-${index}`,
        })),
    };

    const exportedSettings = settingsForExport(settings);

    expect(exportedSettings).not.toHaveProperty('ankiConnectApiKey');
    expect(exportedSettings).not.toHaveProperty('streamingPages');
    expect(exportedSettings).not.toHaveProperty('lastPlaybackPositions');
    expect(exportedSettings.dictionaryTracks).toHaveLength(3);
    expect(exportedSettings.dictionaryTracks).toEqual([
        expect.not.objectContaining({ dictionaryWaniKaniApiToken: expect.any(String) }),
        expect.not.objectContaining({ dictionaryWaniKaniApiToken: expect.any(String) }),
        expect.not.objectContaining({ dictionaryWaniKaniApiToken: expect.any(String) }),
    ]);
    expect(settings.ankiConnectApiKey).toBe('anki-secret');
    expect(settings.dictionaryTracks[0].dictionaryWaniKaniApiToken).toBe('wanikani-secret-0');
});

it('restores omitted credentials when importing a redacted export', () => {
    const currentSettings = {
        ...defaultSettings,
        ankiConnectApiKey: 'anki-secret',
        dictionaryTracks: defaultSettings.dictionaryTracks.map((track, index) => ({
            ...track,
            dictionaryWaniKaniApiToken: `wanikani-secret-${index}`,
        })),
    };
    const exportedSettings = settingsForExport(currentSettings);

    const importedSettings = mergeImportedSettings(exportedSettings, currentSettings);
    const validatedSettings = validateSettings(importedSettings);

    expect(validatedSettings.ankiConnectApiKey).toBe('anki-secret');
    expect(validatedSettings.dictionaryTracks?.map((track) => track.dictionaryWaniKaniApiToken)).toEqual([
        'wanikani-secret-0',
        'wanikani-secret-1',
        'wanikani-secret-2',
    ]);
    expect(importedSettings.streamingPages).toEqual(currentSettings.streamingPages);
});

it('preserves current ignored values when they are explicitly present in an import', () => {
    const currentSettings = {
        ...defaultSettings,
        ankiConnectApiKey: 'existing-anki-secret',
        dictionaryTracks: defaultSettings.dictionaryTracks.map((track) => ({
            ...track,
            dictionaryWaniKaniApiToken: 'existing-wanikani-secret',
        })),
    };
    const importedSettings = {
        ...settingsForExport(currentSettings),
        ankiConnectApiKey: '',
        dictionaryTracks: currentSettings.dictionaryTracks.map((track) => ({
            ...track,
            dictionaryWaniKaniApiToken: '',
        })),
        streamingPages: {
            ...currentSettings.streamingPages,
            netflix: { overrides: { autoSyncEnabled: true } },
        },
    };

    const mergedSettings = mergeImportedSettings(importedSettings, currentSettings);

    expect(mergedSettings.ankiConnectApiKey).toBe('existing-anki-secret');
    expect(mergedSettings.dictionaryTracks?.map((track) => track.dictionaryWaniKaniApiToken)).toEqual([
        'existing-wanikani-secret',
        'existing-wanikani-secret',
        'existing-wanikani-secret',
    ]);
    expect(mergedSettings.streamingPages?.netflix).toEqual(currentSettings.streamingPages.netflix);
});

it('merges current settings under an import for containers the file may predate', () => {
    // The file models an older export: keys added since are absent, so the
    // current settings fill them instead of defaults. Keys the file did write
    // win over current values.
    const currentSettings = JSON.parse(JSON.stringify(defaultSettings));
    currentSettings.subtitleAlignment = 'top';
    currentSettings.keyBindSet.toggleRecipe1 = { keys: 'R+1' };
    currentSettings.ankiFieldSettings.track1 = { order: 77, display: true };
    currentSettings.dictionaryTracks[0].dictionaryPlaybackConfig.fastForward.rateByComprehension.minimumPercent = 80;

    const file = JSON.parse(JSON.stringify(currentSettings));
    delete file.keyBindSet.toggleRecipe1;
    delete file.ankiFieldSettings.track1;
    delete file.dictionaryTracks[0].dictionaryPlaybackConfig.selectOnPause;
    delete file.dictionaryTracks[0].dictionaryPlaybackConfig.fastForward.rateByComprehension.minimumPercent;
    file.dictionaryTracks[0].dictionaryTokenMatchStrategy = TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED;
    file.subtitleTracksV2 = [
        {
            subtitleColor: '#ffffff',
            subtitleSize: 40,
            subtitleThickness: 700,
            subtitleCustomStyles: [],
            subtitleBlur: false,
        },
    ];

    const imported = validateSettings(mergeImportedSettings(file, currentSettings), currentSettings);

    expect(imported.keyBindSet!.toggleRecipe1).toEqual({ keys: 'R+1' });
    expect(imported.keyBindSet!.togglePlay).toEqual({ keys: 'space' });
    expect(imported.ankiFieldSettings!.track1).toEqual({ order: 77, display: true });
    expect(imported.dictionaryTracks![0].dictionaryPlaybackConfig.selectOnPause).toEqual(
        currentSettings.dictionaryTracks[0].dictionaryPlaybackConfig.selectOnPause
    );
    expect(imported.dictionaryTracks![0].dictionaryPlaybackConfig.fastForward.rateByComprehension).toEqual({
        enabled: false,
        minimumPercent: 80,
    });
    expect(imported.dictionaryTracks![0].dictionaryTokenMatchStrategy).toBe(
        TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED
    );
    // Per-track keys the file predates are filled from the current settings;
    // keys the file wrote are kept.
    expect(imported.subtitleTracksV2![0].subtitleAlignment).toBe('top');
    expect(imported.subtitleTracksV2![0].subtitleSize).toBe(40);
    expect(() => validateSettings(mergeImportedSettings(file, currentSettings), currentSettings)).not.toThrow();
});

it('validates exported settings', () => {
    validateSettings({
        ankiConnectUrl: 'http://127.0.0.1:8765',
        ankiConnectApiKey: '',
        deck: 'Sentences',
        noteType: 'Sentence',
        sentenceField: '表面',
        definitionField: 'Definition',
        audioField: 'Audio',
        imageField: 'Image',
        wordField: 'Word',
        sourceField: 'Source',
        urlField: '',
        subtitleSize: 36,
        subtitleColor: '#ffffff',
        subtitleThickness: 700,
        subtitleOutlineThickness: 0,
        subtitleOutlineColor: '#000000',
        subtitleShadowThickness: 2,
        subtitleShadowColor: '#000000',
        subtitleBackgroundColor: '#000000',
        subtitleBackgroundOpacity: 0,
        subtitleFontFamily: 'ToppanBunkyuMidashiGothicStdN-ExtraBold',
        subtitleBlur: false,
        subtitleCustomStyles: [],
        subtitleTracksV2: [
            {
                subtitleSize: 36,
                subtitleColor: '#ffffff',
                subtitleThickness: 700,
                subtitleOutlineThickness: 0,
                subtitleOutlineColor: '#000000',
                subtitleShadowThickness: 2,
                subtitleShadowColor: '#000000',
                subtitleBackgroundColor: '#000000',
                subtitleBackgroundOpacity: 0,
                subtitleFontFamily: 'ToppanBunkyuMidashiGothicStdN-ExtraBold',
                subtitleBlur: true,
                subtitleAlignment: 'bottom',
                subtitleCustomStyles: [],
            },
        ],
        subtitlePreview: 'アあ安Aa',
        subtitlePositionOffset: 71,
        topSubtitlePositionOffset: 71,
        audioPaddingStart: 0,
        audioPaddingEnd: 500,
        maxImageWidth: 480,
        maxImageHeight: 0,
        mediaFragmentMaxClipLength: 10000,
        trimBlackBars: false,
        surroundingSubtitlesCountRadius: 2,
        surroundingSubtitlesTimeRadius: 10000,
        autoPausePreference: 2,
        seekableTracks: 1,
        autoCopyableTracks: 1,
        seekDuration: 4,
        speedChangeStep: 0.2,
        playbackRate: 1.2,
        playbackRateNotificationEnabled: false,
        rememberPlaybackRate: true,
        subtitleTriggerStartOffset: 50,
        subtitleTriggerEndOffset: 100,
        subtitleTriggerGapEndOffset: -150,
        subtitleTriggerGapStartOffset: 200,
        fastForwardModePlaybackRate: 3,
        fastForwardPlaybackMinimumSkipIntervalMs: 800,
        repeatCountPreference: 2,
        rememberPlaybackModes: true,
        lastPlaybackModes: [PlayMode.autoPause, PlayMode.repeat],
        keyBindSet: {
            adjustOffsetToNextSubtitle: { keys: '⇧+right' },
            adjustOffsetToPreviousSubtitle: { keys: '⇧+left' },
            ankiExport: { keys: '⇧+⌃+X' },
            copySubtitle: { keys: '⇧+⌃+Z' },
            decreaseOffset: { keys: '⇧+⌃+right' },
            decreasePlaybackRate: { keys: '⇧+⌃+[' },
            increaseOffset: { keys: '⇧+⌃+left' },
            increasePlaybackRate: { keys: '⇧+⌃+]' },
            resetOffset: { keys: '⇧+⌃+down' },
            seekBackward: { keys: 'A' },
            seekForward: { keys: 'D' },
            seekToBeginningOfCurrentSubtitle: { keys: 'up' },
            seekToNextSubtitle: { keys: 'right' },
            seekToPreviousSubtitle: { keys: 'left' },
            takeScreenshot: { keys: '⇧+⌃+V' },
            toggleRecording: { keys: '⇧+⌃+R' },
            toggleAsbplayerSubtitleTrack1: { keys: 'W+1' },
            toggleAsbplayerSubtitleTrack2: { keys: 'W+2' },
            unblurAsbplayerTrack1: { keys: 'B+1' },
            unblurAsbplayerTrack2: { keys: 'B+2' },
            toggleAutoPause: { keys: '⇧+P' },
            toggleCondensedPlayback: { keys: '⇧+O' },
            toggleFastForwardPlayback: { keys: '⇧+F' },
            togglePlay: { keys: 'space' },
            toggleRepeat: { keys: '⇧+R' },
            toggleSidePanel: { keys: '`' },
            toggleSubtitles: { keys: 'down' },
            toggleVideoSubtitleTrack1: { keys: '1' },
            toggleVideoSubtitleTrack2: { keys: '2' },
            updateLastCard: { keys: '⇧+⌃+U' },
            openStatistics: { keys: 'Q+S' },
            jumpToNextToken: { keys: 'Q+E' },
            jumpToPreviousToken: { keys: 'Q+W' },
            markHoveredToken5: { keys: 'Q+5' },
            jumpToNextTokenStatus5: { keys: '' },
            jumpToPreviousTokenStatus5: { keys: '' },
            markHoveredToken4: { keys: 'Q+4' },
            jumpToNextTokenStatus4: { keys: '' },
            jumpToPreviousTokenStatus4: { keys: '' },
            markHoveredToken3: { keys: 'Q+3' },
            jumpToNextTokenStatus3: { keys: '' },
            jumpToPreviousTokenStatus3: { keys: '' },
            markHoveredToken2: { keys: 'Q+2' },
            jumpToNextTokenStatus2: { keys: '' },
            jumpToPreviousTokenStatus2: { keys: '' },
            markHoveredToken1: { keys: 'Q+1' },
            jumpToNextTokenStatus1: { keys: '' },
            jumpToPreviousTokenStatus1: { keys: '' },
            markHoveredToken0: { keys: 'Q+0' },
            jumpToNextTokenStatus0: { keys: '' },
            jumpToPreviousTokenStatus0: { keys: '' },
            toggleHoveredTokenIgnored: { keys: 'Q+I' },
            jumpToNextTokenState0: { keys: '' },
            jumpToPreviousTokenState0: { keys: '' },
        },
        recordWithAudioPlayback: true,
        preferMp3: true,
        tabName: 'asbplayer',
        miningHistoryStorageLimit: 25,
        clickToMineDefaultAction: 1,
        postMiningPlaybackState: 0,
        themeType: 'dark',
        videoSubtitleSplitBehavior: VideoSubtitleSplitBehavior.rememberSplitPosition,
        showSubtitleListMiningButton: true,
        subtitleListTimestampDisplay: 'startAndEnd',
        copyToClipboardOnMine: false,
        lastPlaybackPositions: [{ fileName: 'example.mp4', position: 1200 }],
        rememberSubtitleOffset: true,
        lastSubtitleOffset: 0,
        autoCopyCurrentSubtitle: false,
        alwaysPlayOnSubtitleRepeat: true,
        subtitleRegexFilter: '',
        subtitleRegexFilterTextReplacement: '',
        convertNetflixRuby: false,
        subtitleHtml: 1,
        language: 'en',
        customAnkiFields: {},
        tags: [],
        imageBasedSubtitleScaleFactor: 1,
        streamingAppUrl: 'http://localhost:3000/asbplayer',
        streamingDisplaySubtitles: false,
        streamingRecordMedia: true,
        streamingTakeScreenshot: true,
        streamingCleanScreenshot: true,
        streamingCropScreenshot: true,
        streamingSubsDragAndDrop: true,
        streamingAutoSync: true,
        streamingLastLanguagesSynced: { 'www.youtube.com': ['ja', '', ''] },
        streamingCondensedPlaybackMinimumSkipIntervalMs: 1000,
        streamingScreenshotDelay: 1000,
        streamingSubtitleListPreference: 'app',
        pauseOnHoverMode: PauseOnHoverMode.disabled,
        lastSelectedAnkiExportMode: 'gui',
        dictionaryTracks: [
            {
                dictionaryColorizeSubtitles: true,
                dictionaryAutoGenerateStatistics: true,
                dictionaryColorizeOnHoverOnly: true,
                dictionaryHighlightOnHover: true,
                dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
                dictionaryMatchAcrossScripts: false,
                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
                dictionaryYomitanUrl: 'http://127.0.0.1:19633',
                dictionaryYomitanParser: 'scanning-parser',
                dictionaryYomitanScanLength: 16,
                dictionaryTokenReadingAnnotation: TokenReadingAnnotation.UNKNOWN_OR_BELOW,
                dictionaryDisplayIgnoredTokenReadings: true,
                dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.ALWAYS,
                dictionaryAnkiDecks: ['Default'],
                dictionaryAnkiWordFields: ['Word', 'Expression'],
                dictionaryAnkiSentenceFields: ['Sentence'],
                dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                dictionaryAnkiMatureCutoff: 21,
                dictionaryAnkiTreatSuspended: 'NORMAL',
                dictionaryWaniKaniApiToken: '',
                dictionaryTokenStyling: TokenStyling.UNDERLINE,
                dictionaryTokenStylingThickness: 1,
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
                dictionaryTokenAnnotationConfig: {
                    colorizeEnabled: true,
                    video: {
                        color: { onHoverEnabled: false, size: 1 },
                        reading: { onHoverEnabled: false, size: 0.5 },
                        frequency: { onHoverEnabled: false, size: 0.3 },
                        pitchAccent: { onHoverEnabled: true, size: 0.1 },
                    },
                    subtitlePlayer: {
                        color: { onHoverEnabled: false, size: 1 },
                        reading: { onHoverEnabled: false, size: 0.5 },
                        frequency: { onHoverEnabled: false, size: 0.5 },
                        pitchAccent: { onHoverEnabled: true, size: 0.1 },
                    },
                    onStatuses: [
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                    ],
                    onStates: [
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                    ],
                },
            },
            {
                dictionaryColorizeSubtitles: false,
                dictionaryAutoGenerateStatistics: false,
                dictionaryColorizeOnHoverOnly: true,
                dictionaryHighlightOnHover: false,
                dictionaryTokenMatchStrategy: TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED,
                dictionaryMatchAcrossScripts: true,
                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.LEMMA,
                dictionaryYomitanUrl: 'http://127.0.0.1:19634',
                dictionaryYomitanParser: 'mecab',
                dictionaryYomitanScanLength: 12,
                dictionaryTokenReadingAnnotation: TokenReadingAnnotation.ALWAYS,
                dictionaryDisplayIgnoredTokenReadings: false,
                dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.UNCOLLECTED_ONLY,
                dictionaryAnkiDecks: [],
                dictionaryAnkiWordFields: [],
                dictionaryAnkiSentenceFields: [],
                dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                dictionaryAnkiMatureCutoff: 30,
                dictionaryAnkiTreatSuspended: 1,
                dictionaryWaniKaniApiToken: '',
                dictionaryTokenStyling: TokenStyling.UNDERLINE,
                dictionaryTokenStylingThickness: 1,
                dictionaryColorizeFullyKnownTokens: true,
                dictionaryTokenStatusColors: ['#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#0000FF', '#FFFFFF'],
                dictionaryTokenStatusConfig: [
                    { display: true, color: '#FF0000', alpha: 'FF' },
                    { display: true, color: '#FFA500', alpha: 'FF' },
                    { display: true, color: '#FFFF00', alpha: 'FF' },
                    { display: true, color: '#00FF00', alpha: 'FF' },
                    { display: true, color: '#0000FF', alpha: 'FF' },
                    { display: true, color: '#FFFFFF', alpha: 'FF' },
                ],
                dictionaryTokenAnnotationConfig: {
                    colorizeEnabled: false,
                    video: {
                        color: { onHoverEnabled: true, size: 1 },
                        reading: { onHoverEnabled: true, size: 0.5 },
                        frequency: { onHoverEnabled: true, size: 0.3 },
                        pitchAccent: { onHoverEnabled: true, size: 0.1 },
                    },
                    subtitlePlayer: {
                        color: { onHoverEnabled: false, size: 1 },
                        reading: { onHoverEnabled: false, size: 0.5 },
                        frequency: { onHoverEnabled: false, size: 0.5 },
                        pitchAccent: { onHoverEnabled: false, size: 0.1 },
                    },
                    onStatuses: [
                        {
                            reading: true,
                            frequency: true,
                            pitchAccent: true,
                        },
                        {
                            reading: true,
                            frequency: true,
                            pitchAccent: true,
                        },
                        {
                            reading: true,
                            frequency: true,
                            pitchAccent: true,
                        },
                        {
                            reading: true,
                            frequency: true,
                            pitchAccent: true,
                        },
                        {
                            reading: true,
                            frequency: true,
                            pitchAccent: true,
                        },
                        {
                            reading: true,
                            frequency: true,
                            pitchAccent: true,
                        },
                    ],
                    onStates: [
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                    ],
                },
            },
            {
                dictionaryColorizeSubtitles: false,
                dictionaryAutoGenerateStatistics: false,
                dictionaryColorizeOnHoverOnly: false,
                dictionaryHighlightOnHover: true,
                dictionaryTokenMatchStrategy: TokenMatchStrategy.LEMMA_FORM_COLLECTED,
                dictionaryMatchAcrossScripts: false,
                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.BEST_KNOWN,
                dictionaryYomitanUrl: 'http://127.0.0.1:19635',
                dictionaryYomitanParser: 'scanning-parser',
                dictionaryYomitanScanLength: 8,
                dictionaryTokenReadingAnnotation: TokenReadingAnnotation.NEVER,
                dictionaryDisplayIgnoredTokenReadings: true,
                dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.NEVER,
                dictionaryAnkiDecks: [],
                dictionaryAnkiWordFields: [],
                dictionaryAnkiSentenceFields: [],
                dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                dictionaryAnkiMatureCutoff: 30,
                dictionaryAnkiTreatSuspended: 2,
                dictionaryWaniKaniApiToken: '',
                dictionaryTokenStyling: TokenStyling.UNDERLINE,
                dictionaryTokenStylingThickness: 1,
                dictionaryColorizeFullyKnownTokens: false,
                dictionaryTokenStatusColors: ['#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000', '#FFFF00'],
                dictionaryTokenStatusConfig: [
                    { display: true, color: '#00FF00', alpha: '00' },
                    { display: true, color: '#00FFFF', alpha: 'FF' },
                    { display: true, color: '#0000FF', alpha: '00' },
                    { display: true, color: '#FF00FF', alpha: 'FF' },
                    { display: true, color: '#FF0000', alpha: 'FF' },
                    { display: false, color: '#FFFF00', alpha: '00' },
                ],
                dictionaryTokenAnnotationConfig: {
                    colorizeEnabled: false,
                    video: {
                        color: { onHoverEnabled: false, size: 1 },
                        reading: { onHoverEnabled: false, size: 0.5 },
                        frequency: { onHoverEnabled: false, size: 0.3 },
                        pitchAccent: { onHoverEnabled: false, size: 0.1 },
                    },
                    subtitlePlayer: {
                        color: { onHoverEnabled: true, size: 1 },
                        reading: { onHoverEnabled: true, size: 0.5 },
                        frequency: { onHoverEnabled: true, size: 0.5 },
                        pitchAccent: { onHoverEnabled: true, size: 0.1 },
                    },
                    onStatuses: [
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                        {
                            reading: false,
                            frequency: false,
                            pitchAccent: false,
                        },
                    ],
                    onStates: [
                        {
                            reading: true,
                            frequency: true,
                            pitchAccent: true,
                        },
                    ],
                },
            },
        ],
    });
});
