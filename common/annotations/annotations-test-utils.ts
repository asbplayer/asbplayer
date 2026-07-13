import { type IndexedSubtitleModel, type Token } from '@project/common';
import { jest } from '@jest/globals';
import { DictionaryProvider } from '@project/common/dictionary-db';
import {
    type AsbplayerSettings,
    defaultSettings,
    type DictionaryTrack,
    SettingsProvider,
    TokenFrequencyAnnotation,
    TokenReadingAnnotation,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import { MockSettingsStorage } from '@project/common/settings/mock-settings-storage';
import { SubtitleAnnotations } from './subtitle-annotations';

export const cloneAnnotationConfig = (track: DictionaryTrack) => ({
    ...track.dictionaryTokenAnnotationConfig,
    video: {
        color: { ...track.dictionaryTokenAnnotationConfig.video.color },
        reading: { ...track.dictionaryTokenAnnotationConfig.video.reading },
        frequency: { ...track.dictionaryTokenAnnotationConfig.video.frequency },
        pitchAccent: { ...track.dictionaryTokenAnnotationConfig.video.pitchAccent },
    },
    subtitlePlayer: {
        color: { ...track.dictionaryTokenAnnotationConfig.subtitlePlayer.color },
        reading: { ...track.dictionaryTokenAnnotationConfig.subtitlePlayer.reading },
        frequency: { ...track.dictionaryTokenAnnotationConfig.subtitlePlayer.frequency },
        pitchAccent: { ...track.dictionaryTokenAnnotationConfig.subtitlePlayer.pitchAccent },
    },
    onStatuses: track.dictionaryTokenAnnotationConfig.onStatuses.map((config) => ({ ...config })),
    onStates: track.dictionaryTokenAnnotationConfig.onStates.map((config) => ({ ...config })),
});

export const makeDictionaryTrack = (overrides: Partial<DictionaryTrack> = {}): DictionaryTrack => {
    const track = {
        ...defaultSettings.dictionaryTracks[0],
        dictionaryAnkiDecks: [...defaultSettings.dictionaryTracks[0].dictionaryAnkiDecks],
        dictionaryAnkiWordFields: [...defaultSettings.dictionaryTracks[0].dictionaryAnkiWordFields],
        dictionaryAnkiSentenceFields: [...defaultSettings.dictionaryTracks[0].dictionaryAnkiSentenceFields],
        dictionaryTokenStatusColors: [...defaultSettings.dictionaryTracks[0].dictionaryTokenStatusColors],
        dictionaryTokenStatusConfig: defaultSettings.dictionaryTracks[0].dictionaryTokenStatusConfig.map((config) => ({
            ...config,
        })),
        ...overrides,
    };
    const dictionaryTokenAnnotationConfig = cloneAnnotationConfig(track);
    dictionaryTokenAnnotationConfig.colorizeEnabled = track.dictionaryColorizeSubtitles;

    for (const target of [dictionaryTokenAnnotationConfig.video, dictionaryTokenAnnotationConfig.subtitlePlayer]) {
        target.color.onHoverEnabled = track.dictionaryColorizeOnHoverOnly;
        target.reading.onHoverEnabled = track.dictionaryColorizeOnHoverOnly;
        target.frequency.onHoverEnabled = track.dictionaryColorizeOnHoverOnly;
    }

    for (const [status, config] of dictionaryTokenAnnotationConfig.onStatuses.entries()) {
        config.reading =
            track.dictionaryTokenReadingAnnotation === TokenReadingAnnotation.ALWAYS ||
            (track.dictionaryTokenReadingAnnotation === TokenReadingAnnotation.LEARNING_OR_BELOW &&
                status <= TokenStatus.LEARNING) ||
            (track.dictionaryTokenReadingAnnotation === TokenReadingAnnotation.UNKNOWN_OR_BELOW &&
                status <= TokenStatus.UNKNOWN);
        config.frequency =
            track.dictionaryTokenFrequencyAnnotation === TokenFrequencyAnnotation.ALWAYS ||
            (track.dictionaryTokenFrequencyAnnotation === TokenFrequencyAnnotation.UNCOLLECTED_ONLY &&
                status === TokenStatus.UNCOLLECTED);
    }
    dictionaryTokenAnnotationConfig.onStates[TokenState.IGNORED].reading =
        track.dictionaryDisplayIgnoredTokenReadings &&
        track.dictionaryTokenReadingAnnotation !== TokenReadingAnnotation.NEVER;

    return { ...track, dictionaryTokenAnnotationConfig };
};

export const makeDictionaryTracks = (track = makeDictionaryTrack()) =>
    defaultSettings.dictionaryTracks.map((_, index) => (index === 0 ? track : makeDictionaryTrack()));

export const makeSettings = (dictionaryTracks = makeDictionaryTracks()): AsbplayerSettings => ({
    ...defaultSettings,
    dictionaryTracks,
});

export const makeSubtitle = (overrides: Record<string, unknown> = {}): IndexedSubtitleModel =>
    ({
        text: 'word',
        originalText: 'word',
        start: 0,
        originalStart: 0,
        end: 1000,
        originalEnd: 1000,
        track: 0,
        index: 0,
        ...overrides,
    }) as IndexedSubtitleModel;

export const makeToken = (overrides: Partial<Token> = {}): Token => ({
    pos: [0, 4],
    readings: [],
    states: [],
    status: TokenStatus.UNKNOWN,
    ...overrides,
});

export const makeStorage = () => ({
    getBulk: jest.fn(async () => ({})),
    getAllTokens: jest.fn(async () => ({})),
    getByLemmaBulk: jest.fn(async () => ({})),
    saveRecordLocalBulk: jest.fn(async () => ({ savedTokens: [] })),
    deleteRecordLocalBulk: jest.fn(async () => ({ deletedTokens: [] })),
    deleteProfile: jest.fn(async () => ({})),
    exportRecordLocalBulk: jest.fn(async () => ({ exportedRecords: [] })),
    importRecordLocalBulk: jest.fn(async () => ({ importedTokens: [] })),
    getRecords: jest.fn(async () => ({ tokenRecords: [], ankiCardRecords: {}, waniKaniSubjectRecords: {} })),
    updateRecords: jest.fn(async () => ({ savedTokens: [], deletedTokens: [] })),
    deleteRecords: jest.fn(async () => ({ deletedTokens: [] })),
    buildAnkiCache: jest.fn(async () => undefined),
    buildWaniKaniCache: jest.fn(async () => undefined),
    ankiCardWasModified: jest.fn(),
    onAnkiCardModified: jest.fn().mockReturnValue(jest.fn()),
    onBuildAnkiCacheStateChange: jest.fn().mockReturnValue(jest.fn()),
    onBuildWaniKaniCacheStateChange: jest.fn().mockReturnValue(jest.fn()),
    publishStatisticsSnapshot: jest.fn(),
    onStatisticsSnapshot: jest.fn().mockReturnValue(jest.fn()),
    requestStatisticsSnapshot: jest.fn(),
    onRequestStatisticsSnapshot: jest.fn().mockReturnValue(jest.fn()),
    requestStatisticsGeneration: jest.fn(),
    onRequestStatisticsGeneration: jest.fn().mockReturnValue(jest.fn()),
    requestStatisticsSeek: jest.fn(),
    onRequestStatisticsSeek: jest.fn().mockReturnValue(jest.fn()),
    requestStatisticsMineSentences: jest.fn(),
    onRequestStatisticsMineSentences: jest.fn().mockReturnValue(jest.fn()),
    _removeCallback: jest.fn(),
});

export const makeSubtitleAnnotations = (settings = makeSettings()) => {
    const storage = makeStorage();
    const provider = new DictionaryProvider(storage as any);
    const settingsStorage = new MockSettingsStorage();
    settingsStorage.setData(settings);
    const settingsProvider = new SettingsProvider(settingsStorage);
    const subtitleAnnotationsUpdated = jest.fn();
    const subtitleAnnotations = new SubtitleAnnotations(
        provider,
        settingsProvider,
        { showingCheckRadiusMs: 150 },
        'media-id',
        subtitleAnnotationsUpdated
    );

    return { subtitleAnnotations, storage, settingsProvider, subtitleAnnotationsUpdated };
};
