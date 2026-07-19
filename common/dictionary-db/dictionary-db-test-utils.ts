import {
    AsbplayerSettings,
    defaultSettings,
    DictionaryTokenSource,
    DictionaryTrack,
    TokenFrequencyAnnotation,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenReadingAnnotation,
    TokenState,
    TokenStatus,
    TokenStyling,
} from '@project/common/settings';
import {
    DictionaryAnkiCardRecord,
    DictionaryDB,
    DictionaryTokenKey,
    DictionaryTokenRecord,
    DictionaryWaniKaniAssignmentRecord,
    DictionaryWaniKaniSubjectRecord,
    LOCAL_TOKEN_TRACK,
} from './dictionary-db';
import { WaniKaniSpacedRepetitionSystem } from '@project/common/wanikani';

export const profile = 'Profile';
export const otherProfile = 'Other Profile';
export const track = 0;
export const otherTrack = 1;

export const tokenKey = (
    token: string,
    source: DictionaryTokenSource = DictionaryTokenSource.LOCAL,
    recordTrack = LOCAL_TOKEN_TRACK,
    recordProfile = profile
): DictionaryTokenKey => [token, source, recordTrack, recordProfile];

export const makeTokenRecord = (overrides: Partial<DictionaryTokenRecord> = {}): DictionaryTokenRecord => ({
    profile,
    track: LOCAL_TOKEN_TRACK,
    source: DictionaryTokenSource.LOCAL,
    token: 'alpha',
    status: TokenStatus.UNKNOWN,
    lemmas: ['alpha'],
    states: [],
    cardIds: [],
    ...overrides,
});

export const makeAnkiCardRecord = (overrides: Partial<DictionaryAnkiCardRecord> = {}): DictionaryAnkiCardRecord => ({
    profile,
    track,
    cardId: 1,
    noteId: 10,
    modifiedAt: 100,
    status: TokenStatus.UNKNOWN,
    suspended: false,
    ...overrides,
});

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
    const track: DictionaryTrack = {
        ...defaultSettings.dictionaryTracks[0],
        dictionaryTokenStatusColors: [...defaultSettings.dictionaryTracks[0].dictionaryTokenStatusColors],
        dictionaryTokenStatusConfig: defaultSettings.dictionaryTracks[0].dictionaryTokenStatusConfig.map((config) => ({
            ...config,
        })),
        dictionaryColorizeSubtitles: false,
        dictionaryAutoGenerateStatistics: false,
        dictionaryColorizeOnHoverOnly: false,
        dictionaryHighlightOnHover: false,
        dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
        dictionaryMatchAcrossScripts: true,
        dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
        dictionaryYomitanUrl: 'http://127.0.0.1:50500',
        dictionaryYomitanParser: 'scanning-parser',
        dictionaryYomitanScanLength: 25,
        dictionaryTokenReadingAnnotation: TokenReadingAnnotation.NEVER,
        dictionaryDisplayIgnoredTokenReadings: false,
        dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.NEVER,
        dictionaryAnkiDecks: [],
        dictionaryAnkiWordFields: [],
        dictionaryAnkiSentenceFields: [],
        dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
        dictionaryAnkiMatureCutoff: 21,
        dictionaryAnkiTreatSuspended: 'NORMAL',
        dictionaryTokenStyling: TokenStyling.TEXT,
        dictionaryTokenStylingThickness: 1,
        dictionaryColorizeFullyKnownTokens: false,
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
        track.dictionaryDisplayIgnoredTokenReadings ||
        dictionaryTokenAnnotationConfig.onStates[TokenState.IGNORED].reading;

    return { ...track, dictionaryTokenAnnotationConfig };
};

export const makeSettings = (dictionaryTracks: DictionaryTrack[]): AsbplayerSettings => ({
    ...defaultSettings,
    dictionaryTracks,
});

export const makeModifiedCard = (overrides: Record<string, unknown> = {}) => {
    const deckName = (overrides.deckName as string | undefined) ?? 'Japanese';
    const data = {
        deckName,
        modelName: 'Model',
        due: 0,
        ...((overrides.data as Record<string, unknown> | undefined) ?? {}),
    };

    return {
        noteId: 10,
        deckName,
        fields: new Map<string, string>([['Word', 'alpha']]),
        modifiedAt: 100,
        statuses: new Map<number, TokenStatus>([[track, TokenStatus.UNKNOWN]]),
        suspended: false,
        ...overrides,
        data,
    };
};

export const makeNoteInfo = (overrides: Record<string, unknown> = {}) => ({
    noteId: 10,
    profile: 'User',
    modelName: 'Model',
    tags: [],
    fields: {
        Word: { value: ' alpha ', order: 0 },
    },
    mod: 100,
    cards: [1],
    ...overrides,
});

export const makeMetaRecord = (overrides: Record<string, unknown> = {}) => ({
    profile,
    track,
    ankiMeta: {
        lastBuildStartedAt: 0,
        lastBuildExpiresAt: 0,
        buildId: null,
        settings: null,
    },
    waniKaniMeta: {
        lastBuildStartedAt: 0,
        lastBuildExpiresAt: 0,
        buildId: null,
        settings: null,
        dataUpdatedAt: {},
        spacedRepetitionSystems: [],
    },
    ...overrides,
});

export const makeWaniKaniSubjectRecord = (
    overrides: Partial<DictionaryWaniKaniSubjectRecord> = {}
): DictionaryWaniKaniSubjectRecord => ({
    profile,
    track,
    subjectId: 1,
    data: {
        characters: '単語',
        hidden_at: null,
        level: 1,
        spaced_repetition_system_id: 1,
    },
    ...overrides,
});

export const makeWaniKaniAssignmentRecord = (
    overrides: Partial<DictionaryWaniKaniAssignmentRecord> = {}
): DictionaryWaniKaniAssignmentRecord => ({
    profile,
    track,
    assignmentId: 1,
    subjectId: 1,
    data: {
        srs_stage: 1,
        hidden: false,
        available_at: null,
    },
    ...overrides,
});

export const makeWaniKaniSpacedRepetitionSystem = (
    overrides: Partial<WaniKaniSpacedRepetitionSystem> = {}
): WaniKaniSpacedRepetitionSystem => ({
    id: 1,
    object: 'spaced_repetition_system',
    url: 'https://api.wanikani.com/v2/spaced_repetition_systems/1',
    data_updated_at: '2024-01-01T00:00:00.000000Z',
    data: {
        created_at: '2024-01-01T00:00:00.000000Z',
        name: 'Default',
        description: 'Default',
        unlocking_stage_position: 0,
        starting_stage_position: 1,
        passing_stage_position: 5,
        burning_stage_position: 9,
        stages: [],
    },
    ...overrides,
});

export const privateDb = (dictionaryDB: DictionaryDB) => (dictionaryDB as any).db;
