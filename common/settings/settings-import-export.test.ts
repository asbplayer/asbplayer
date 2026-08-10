import {
    PauseOnHoverMode,
    TokenMatchStrategyPriority,
    TokenMatchStrategy,
    TokenStyling,
    TokenReadingAnnotation,
    TokenFrequencyAnnotation,
    VideoSubtitleSplitBehavior,
} from './settings';
import { exportedSettings, importSettings, validateExportedSettings, validateSettings } from './settings-import-export';
import { defaultSettings, SettingsProvider } from './settings-provider';
import { MockSettingsStorage } from './mock-settings-storage';
import { expect, it } from '@jest/globals';
import { PlayMode } from '@project/common';

it('validates the default settings', () => {
    validateSettings(defaultSettings);
});

it('fails validation when an unknown key is encountered', () => {
    expect(() => validateSettings({ ...defaultSettings, asdf: 'jkl;' })).toThrow("Unknown key 'asdf'");
});

it('fails validation when an unknown key bind key is encountered', () => {
    expect(() =>
        validateSettings({ ...defaultSettings, keyBindSet: { ...defaultSettings.keyBindSet, asdf: { keys: 'a' } } })
    ).toThrow("Unknown key 'keyBindSet.asdf'");
});

it('validates last languages synced', () => {
    validateSettings({ ...defaultSettings, streamingLastLanguagesSynced: { 'domain.com': ['en', 'ja'] } });
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
        preCacheSubtitleDom: true,
        clickToMineDefaultAction: 1,
        postMiningPlaybackState: 0,
        themeType: 'dark',
        videoSubtitleSplitBehavior: VideoSubtitleSplitBehavior.rememberSplitPosition,
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

const providerWithProfiles = async () => {
    const provider = new SettingsProvider(new MockSettingsStorage());
    await provider.set({ tabName: 'default-tab' });
    await provider.addProfile('profile a');
    await provider.setActiveProfile('profile a');
    await provider.set({ tabName: 'a-tab' });
    await provider.addProfile('profile b');
    await provider.setActiveProfile('profile b');
    await provider.set({ tabName: 'b-tab' });
    return provider;
};

it('exports the settings of every profile', async () => {
    const provider = await providerWithProfiles();
    const exported = await exportedSettings(provider, true);

    expect(exported.activeProfile).toBe('profile b');
    expect(exported.profiles.map((p) => p.name)).toEqual([undefined, 'profile a', 'profile b']);
    expect(exported.profiles.map((p) => p.settings.tabName)).toEqual(['default-tab', 'a-tab', 'b-tab']);
});

it('exports only the active profile when all-profile export is unsupported', async () => {
    const provider = await providerWithProfiles();
    const exported = await exportedSettings(provider, false);

    expect(exported.activeProfile).toBe('profile b');
    expect(exported.profiles.map((p) => p.name)).toEqual(['profile b']);
    expect(exported.profiles[0].settings.tabName).toBe('b-tab');
});

it('does not export ignored keys', async () => {
    const provider = await providerWithProfiles();
    const exported = await exportedSettings(provider, true);

    for (const profile of exported.profiles) {
        expect('streamingPages' in profile.settings).toBe(false);
    }
});

it('validates exported settings from all profiles', () => {
    const validated = validateExportedSettings({
        activeProfile: 'profile a',
        profiles: [{ settings: { tabName: 'default-tab' } }, { name: 'profile a', settings: { tabName: 'a-tab' } }],
    });

    expect(validated.profiles.map((p) => p.name)).toEqual([undefined, 'profile a']);
});

it('validates settings exported by an older version of asbplayer as belonging to the active profile', () => {
    const validated = validateExportedSettings({ ...defaultSettings, tabName: 'legacy-tab' });

    expect(validated.forActiveProfile).toBe(true);
    expect(validated.activeProfile).toBeUndefined();
    expect(validated.profiles).toHaveLength(1);
    expect(validated.profiles[0].name).toBeUndefined();
    expect(validated.profiles[0].settings.tabName).toBe('legacy-tab');
});

it('fails validation when a profile contains an unknown key', () => {
    expect(() => validateExportedSettings({ profiles: [{ settings: { asdf: 'jkl;' } }] })).toThrow(
        "Unknown key 'asdf'"
    );
});

it('fails validation when a profile name is not a name', () => {
    expect(() => validateExportedSettings({ profiles: [{ name: 5, settings: {} }] })).toThrow(
        "Invalid profile name '5'"
    );
});

it('imports the settings of every profile, creating profiles that do not exist yet', async () => {
    const provider = new SettingsProvider(new MockSettingsStorage());
    const exported = validateExportedSettings({
        activeProfile: 'profile a',
        profiles: [{ settings: { tabName: 'default-tab' } }, { name: 'profile a', settings: { tabName: 'a-tab' } }],
    });
    await importSettings(provider, exported, true);

    expect((await provider.profiles()).map((p) => p.name)).toEqual(['profile a']);
    expect((await provider.activeProfile())?.name).toBe('profile a');
    expect((await provider.getAllForProfile(undefined)).tabName).toBe('default-tab');
    expect((await provider.getAllForProfile('profile a')).tabName).toBe('a-tab');
});

it('leaves profiles that are absent from the imported settings alone', async () => {
    const provider = await providerWithProfiles();
    const exported = validateExportedSettings({
        profiles: [{ name: 'profile a', settings: { tabName: 'imported-a-tab' } }],
    });
    await importSettings(provider, exported, true);

    expect((await provider.profiles()).map((p) => p.name)).toEqual(['profile a', 'profile b']);
    expect((await provider.getAllForProfile('profile a')).tabName).toBe('imported-a-tab');
    expect((await provider.getAllForProfile('profile b')).tabName).toBe('b-tab');
    // Active profile was restored to the default profile
    expect(await provider.activeProfile()).toBeUndefined();
});

it('imports only the active profile when all-profile import is unsupported', async () => {
    const provider = await providerWithProfiles();
    const exported = validateExportedSettings({
        activeProfile: 'profile a',
        profiles: [
            { settings: { tabName: 'imported-default-tab' } },
            { name: 'profile a', settings: { tabName: 'imported-a-tab' } },
        ],
    });
    await importSettings(provider, exported, false);

    // Still on 'profile b', which received the settings of the default profile
    expect((await provider.activeProfile())?.name).toBe('profile b');
    expect((await provider.getAllForProfile('profile b')).tabName).toBe('imported-default-tab');
    expect((await provider.getAllForProfile('profile a')).tabName).toBe('a-tab');
    expect((await provider.getAllForProfile(undefined)).tabName).toBe('default-tab');
});

it('imports settings exported by an older version of asbplayer into the active profile', async () => {
    const provider = await providerWithProfiles();
    const exported = validateExportedSettings({ ...defaultSettings, tabName: 'legacy-tab' });
    await importSettings(provider, exported, true);

    expect((await provider.activeProfile())?.name).toBe('profile b');
    expect((await provider.getAllForProfile('profile b')).tabName).toBe('legacy-tab');
    expect((await provider.getAllForProfile(undefined)).tabName).toBe('default-tab');
});

it('round trips the settings of every profile', async () => {
    const provider = await providerWithProfiles();
    const exported = await exportedSettings(provider, true);

    const otherProvider = new SettingsProvider(new MockSettingsStorage());
    await importSettings(otherProvider, validateExportedSettings(JSON.parse(JSON.stringify(exported))), true);

    expect(await exportedSettings(otherProvider, true)).toEqual(exported);
});
