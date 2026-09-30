import { arrayEquals } from '@project/common/util/array-equals';

export enum DictionaryTokenSource {
    LOCAL = 0,
    ANKI_WORD = 1,
    ANKI_SENTENCE = 2,
    WANIKANI = 3,
}

export function dictionaryTokenSourcePriority(source: DictionaryTokenSource): number {
    switch (source) {
        case DictionaryTokenSource.LOCAL:
            return 3;
        case DictionaryTokenSource.ANKI_WORD:
        case DictionaryTokenSource.WANIKANI:
            return 2;
        case DictionaryTokenSource.ANKI_SENTENCE:
            return 1;
        default:
            throw new Error(`Unsupported DictionaryTokenSource: ${source}`);
    }
}

export type AnkiSource = DictionaryTokenSource.ANKI_WORD | DictionaryTokenSource.ANKI_SENTENCE;
export function isAnkiSource(source: DictionaryTokenSource): source is AnkiSource {
    return source === DictionaryTokenSource.ANKI_WORD || source === DictionaryTokenSource.ANKI_SENTENCE;
}

export type WaniKaniSource = DictionaryTokenSource.WANIKANI;
export function isWaniKaniSource(source: DictionaryTokenSource): source is WaniKaniSource {
    return source === DictionaryTokenSource.WANIKANI;
}

export type ExternalWordSource = DictionaryTokenSource.ANKI_WORD | DictionaryTokenSource.WANIKANI;
export function isExternalWordSource(source: DictionaryTokenSource): source is ExternalWordSource {
    return source === DictionaryTokenSource.ANKI_WORD || source === DictionaryTokenSource.WANIKANI;
}

export function externalWordSourcePriority(source: ExternalWordSource): number {
    switch (source) {
        case DictionaryTokenSource.ANKI_WORD:
            return 2;
        case DictionaryTokenSource.WANIKANI:
            return 1;
        default:
            throw new Error(`Unsupported DictionaryTokenSource: ${source}`);
    }
}

export type WordSource = DictionaryTokenSource.LOCAL | ExternalWordSource;
export function isWordSource(source: DictionaryTokenSource): source is WordSource {
    return source === DictionaryTokenSource.LOCAL || isExternalWordSource(source);
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
    return TokenStatus.MATURE; // If future statuses are optional, they should be updated here
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

const tokenStatusConfigRenderOnlyComparators: {
    [K in keyof TokenStatusConfig]: (a: TokenStatusConfig[K], b: TokenStatusConfig[K]) => boolean;
} = {
    display: () => true,
    color: () => true,
    alpha: () => true,
};

function compareRenderOnlyField<T, K extends keyof T>(
    comparators: { [P in keyof T]: (a: T[P], b: T[P]) => boolean },
    key: K,
    a: T,
    b: T
): boolean {
    return comparators[key](a[key], b[key]);
}

export function areTokenStatusConfigsRenderOnly(a: TokenStatusConfig, b: TokenStatusConfig): boolean {
    if (a === b) return true;
    for (const key in tokenStatusConfigComparators) {
        const typedKey = key as keyof TokenStatusConfig;
        if (
            !compareTokenStatusConfigField(typedKey, a, b) &&
            !compareRenderOnlyField(tokenStatusConfigRenderOnlyComparators, typedKey, a, b)
        ) {
            return false;
        }
    }
    return true;
}

export interface TokenAnnotationTriggerOptions {
    reading: boolean;
    frequency: boolean;
    gloss: boolean;
    pitchAccent: boolean;
}

export interface TokenAnnotationConfigOptions {
    onHoverEnabled: boolean;
    size: number;
}

export interface TokenAnnotationConfig {
    color: TokenAnnotationConfigOptions;
    reading: TokenAnnotationConfigOptions;
    frequency: TokenAnnotationConfigOptions;
    gloss: TokenAnnotationConfigOptions;
    pitchAccent: TokenAnnotationConfigOptions;
}

export type TokenAnnotationStyleValues = Record<string, string>;

export function tokenAnnotationStyleValues(config: TokenAnnotationConfig | undefined): TokenAnnotationStyleValues {
    return {
        '--asb-reading-size': `${config?.reading.size ?? 0.5}em`,
        '--asb-frequency-size': `${config?.frequency.size ?? 0.3}em`,
        '--asb-gloss-size': `${config?.gloss.size ?? 0.5}em`,
        '--asb-pitch-accent-size': `${config?.pitchAccent.size ?? 0.1}em`,
    };
}

export interface TokenAnnotationConfigs {
    colorizeEnabled: boolean;
    video: TokenAnnotationConfig;
    subtitlePlayer: TokenAnnotationConfig;
    onStatuses: TokenAnnotationTriggerOptions[];
    onStates: TokenAnnotationTriggerOptions[];
}

export type TokenAnnotationConfigTarget = keyof Pick<TokenAnnotationConfigs, 'video' | 'subtitlePlayer'>;

const tokenAnnotationTriggerOptionsComparators: {
    [K in keyof TokenAnnotationTriggerOptions]: (
        a: TokenAnnotationTriggerOptions[K],
        b: TokenAnnotationTriggerOptions[K]
    ) => boolean;
} = {
    reading: (a, b) => a === b,
    frequency: (a, b) => a === b,
    gloss: (a, b) => a === b,
    pitchAccent: (a, b) => a === b,
};

export function compareTokenAnnotationTriggerOptionsField<K extends keyof TokenAnnotationTriggerOptions>(
    key: K,
    a: TokenAnnotationTriggerOptions,
    b: TokenAnnotationTriggerOptions
): boolean {
    return tokenAnnotationTriggerOptionsComparators[key](a[key], b[key]);
}

export function areTokenAnnotationTriggerOptionsEqual(
    a: TokenAnnotationTriggerOptions,
    b: TokenAnnotationTriggerOptions
): boolean {
    if (a === b) return true;
    for (const key in tokenAnnotationTriggerOptionsComparators) {
        if (!compareTokenAnnotationTriggerOptionsField(key as keyof TokenAnnotationTriggerOptions, a, b)) {
            return false;
        }
    }
    return true;
}

const tokenAnnotationConfigOptionsComparators: {
    [K in keyof TokenAnnotationConfigOptions]: (
        a: TokenAnnotationConfigOptions[K],
        b: TokenAnnotationConfigOptions[K]
    ) => boolean;
} = {
    onHoverEnabled: (a, b) => a === b,
    size: (a, b) => a === b,
};

export function compareTokenAnnotationConfigOptionsField<K extends keyof TokenAnnotationConfigOptions>(
    key: K,
    a: TokenAnnotationConfigOptions,
    b: TokenAnnotationConfigOptions
): boolean {
    return tokenAnnotationConfigOptionsComparators[key](a[key], b[key]);
}

export function areTokenAnnotationConfigOptionsEqual(
    a: TokenAnnotationConfigOptions,
    b: TokenAnnotationConfigOptions
): boolean {
    if (a === b) return true;
    for (const key in tokenAnnotationConfigOptionsComparators) {
        if (!compareTokenAnnotationConfigOptionsField(key as keyof TokenAnnotationConfigOptions, a, b)) return false;
    }
    return true;
}

const tokenAnnotationConfigOptionsRenderOnlyComparators: {
    [K in keyof TokenAnnotationConfigOptions]: (
        a: TokenAnnotationConfigOptions[K],
        b: TokenAnnotationConfigOptions[K]
    ) => boolean;
} = {
    onHoverEnabled: () => true,
    size: () => true,
};

function areTokenAnnotationConfigOptionsRenderOnly(
    a: TokenAnnotationConfigOptions,
    b: TokenAnnotationConfigOptions
): boolean {
    if (a === b) return true;
    for (const key in tokenAnnotationConfigOptionsComparators) {
        const typedKey = key as keyof TokenAnnotationConfigOptions;
        if (
            !compareTokenAnnotationConfigOptionsField(typedKey, a, b) &&
            !compareRenderOnlyField(tokenAnnotationConfigOptionsRenderOnlyComparators, typedKey, a, b)
        ) {
            return false;
        }
    }
    return true;
}

const tokenAnnotationConfigComparators: {
    [K in keyof TokenAnnotationConfig]: (a: TokenAnnotationConfig[K], b: TokenAnnotationConfig[K]) => boolean;
} = {
    color: (a, b) => areTokenAnnotationConfigOptionsEqual(a, b),
    reading: (a, b) => areTokenAnnotationConfigOptionsEqual(a, b),
    frequency: (a, b) => areTokenAnnotationConfigOptionsEqual(a, b),
    gloss: (a, b) => areTokenAnnotationConfigOptionsEqual(a, b),
    pitchAccent: (a, b) => areTokenAnnotationConfigOptionsEqual(a, b),
};

export function compareTokenAnnotationConfigField<K extends keyof TokenAnnotationConfig>(
    key: K,
    a: TokenAnnotationConfig,
    b: TokenAnnotationConfig
): boolean {
    return tokenAnnotationConfigComparators[key](a[key], b[key]);
}

export function areTokenAnnotationConfigEqual(a: TokenAnnotationConfig, b: TokenAnnotationConfig): boolean {
    if (a === b) return true;
    for (const key in tokenAnnotationConfigComparators) {
        if (!compareTokenAnnotationConfigField(key as keyof TokenAnnotationConfig, a, b)) return false;
    }
    return true;
}

const tokenAnnotationConfigRenderOnlyComparators: {
    [K in keyof TokenAnnotationConfig]: (a: TokenAnnotationConfig[K], b: TokenAnnotationConfig[K]) => boolean;
} = {
    color: (a, b) => areTokenAnnotationConfigOptionsRenderOnly(a, b),
    reading: (a, b) => areTokenAnnotationConfigOptionsRenderOnly(a, b),
    frequency: (a, b) => areTokenAnnotationConfigOptionsRenderOnly(a, b),
    gloss: (a, b) => areTokenAnnotationConfigOptionsRenderOnly(a, b),
    pitchAccent: (a, b) => areTokenAnnotationConfigOptionsRenderOnly(a, b),
};

function areTokenAnnotationConfigRenderOnly(a: TokenAnnotationConfig, b: TokenAnnotationConfig): boolean {
    if (a === b) return true;
    for (const key in tokenAnnotationConfigComparators) {
        const typedKey = key as keyof TokenAnnotationConfig;
        if (
            !compareTokenAnnotationConfigField(typedKey, a, b) &&
            !compareRenderOnlyField(tokenAnnotationConfigRenderOnlyComparators, typedKey, a, b)
        ) {
            return false;
        }
    }
    return true;
}

const tokenAnnotationConfigsComparators: {
    [K in keyof TokenAnnotationConfigs]: (a: TokenAnnotationConfigs[K], b: TokenAnnotationConfigs[K]) => boolean;
} = {
    colorizeEnabled: (a, b) => a === b,
    video: (a, b) => areTokenAnnotationConfigEqual(a, b),
    subtitlePlayer: (a, b) => areTokenAnnotationConfigEqual(a, b),
    onStatuses: (a, b) => arrayEquals(a, b, areTokenAnnotationTriggerOptionsEqual),
    onStates: (a, b) => arrayEquals(a, b, areTokenAnnotationTriggerOptionsEqual),
};

export function compareTokenAnnotationConfigsField<K extends keyof TokenAnnotationConfigs>(
    key: K,
    a: TokenAnnotationConfigs,
    b: TokenAnnotationConfigs
): boolean {
    return tokenAnnotationConfigsComparators[key](a[key], b[key]);
}

export function areTokenAnnotationConfigsEqual(a: TokenAnnotationConfigs, b: TokenAnnotationConfigs): boolean {
    if (a === b) return true;
    for (const key in tokenAnnotationConfigsComparators) {
        if (!compareTokenAnnotationConfigsField(key as keyof TokenAnnotationConfigs, a, b)) return false;
    }
    return true;
}

const tokenAnnotationTriggerOptionsRenderOnlyComparators: {
    [K in keyof TokenAnnotationTriggerOptions]: (
        a: TokenAnnotationTriggerOptions[K],
        b: TokenAnnotationTriggerOptions[K]
    ) => boolean;
} = {
    reading: () => true,
    frequency: () => true,
    gloss: () => false,
    pitchAccent: () => true,
};

function areTokenAnnotationTriggerOptionsRenderOnly(
    a: TokenAnnotationTriggerOptions,
    b: TokenAnnotationTriggerOptions
): boolean {
    if (a === b) return true;
    for (const key in tokenAnnotationTriggerOptionsComparators) {
        const typedKey = key as keyof TokenAnnotationTriggerOptions;
        if (
            !compareTokenAnnotationTriggerOptionsField(typedKey, a, b) &&
            !tokenAnnotationTriggerOptionsRenderOnlyComparators[typedKey](a[typedKey], b[typedKey])
        ) {
            return false;
        }
    }
    return true;
}

const tokenAnnotationConfigsRenderOnlyComparators: {
    [K in keyof TokenAnnotationConfigs]: (a: TokenAnnotationConfigs[K], b: TokenAnnotationConfigs[K]) => boolean;
} = {
    colorizeEnabled: () => true,
    video: (a, b) => areTokenAnnotationConfigRenderOnly(a, b),
    subtitlePlayer: (a, b) => areTokenAnnotationConfigRenderOnly(a, b),
    onStatuses: (a, b) => arrayEquals(a, b, areTokenAnnotationTriggerOptionsRenderOnly),
    onStates: (a, b) => arrayEquals(a, b, areTokenAnnotationTriggerOptionsRenderOnly),
};

export function areTokenAnnotationConfigsRenderOnly(a: TokenAnnotationConfigs, b: TokenAnnotationConfigs): boolean {
    if (a === b) return true;
    for (const key in tokenAnnotationConfigsComparators) {
        const typedKey = key as keyof TokenAnnotationConfigs;
        if (
            !compareTokenAnnotationConfigsField(typedKey, a, b) &&
            !compareRenderOnlyField(tokenAnnotationConfigsRenderOnlyComparators, typedKey, a, b)
        ) {
            return false;
        }
    }
    return true;
}

export enum TokenState {
    IGNORED = 0, // If ever adding more states, they should go last (if adding colors for states, use a separate array from dictionaryTokenStatusColors indexed by TokenState)
}

export type TokenJumpTarget =
    | { kind: 'any' }
    | { kind: 'status'; value: TokenStatus }
    | { kind: 'state'; value: TokenState };

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
        dt.dictionaryTokenAnnotationConfig.colorizeEnabled ||
        dt.dictionaryTokenAnnotationConfig.onStatuses.some((s) => Object.values(s).some((v) => v)) ||
        dt.dictionaryTokenAnnotationConfig.onStates.some((s) => Object.values(s).some((v) => v)) ||
        dt.dictionaryAutoGenerateStatistics
    );
}

export function dictionaryStatusCollectionEnabled(dt: DictionaryTrack, options: { includeStates: boolean }): boolean {
    const { includeStates } = options;
    if (dt.dictionaryTokenAnnotationConfig.colorizeEnabled || dt.dictionaryAutoGenerateStatistics) return true;
    const { onStatuses, onStates } = dt.dictionaryTokenAnnotationConfig;
    for (const annotation of Object.keys(onStatuses[0]) as (keyof TokenAnnotationTriggerOptions)[]) {
        const numStatusEnabled = onStatuses.filter((s) => s[annotation]).length;
        if (numStatusEnabled > 0 && numStatusEnabled < onStatuses.length) return true;
        if (includeStates && onStates.some((s) => s[annotation])) return true; // Check states for lookups but not building
    }
    return false;
}

export function getEnabledAnnotations(dt: DictionaryTrack): EnabledAnnotations {
    const { colorizeEnabled, onStatuses, onStates } = dt.dictionaryTokenAnnotationConfig;
    const annotationTriggerValues: { [K in keyof TokenAnnotationTriggerOptions]: boolean } = {} as any;
    for (const ano of Object.keys(onStatuses[0]) as (keyof TokenAnnotationTriggerOptions)[]) {
        annotationTriggerValues[ano] = onStatuses.some((s) => s[ano]) || onStates.some((s) => s[ano]);
    }
    return { color: colorizeEnabled, ...annotationTriggerValues };
}

export interface EnabledAnnotations {
    color: boolean;
    reading: boolean;
    frequency: boolean;
    gloss: boolean;
    pitchAccent: boolean;
}

export function getEnabledAnnotationsForHover(
    enabledAnnotations: EnabledAnnotations,
    dt: DictionaryTrack,
    target: TokenAnnotationConfigTarget,
    onHoverEnabled: boolean
): EnabledAnnotations {
    const config = dt.dictionaryTokenAnnotationConfig[target];
    const enabledAnnotationsForHover: EnabledAnnotations = {} as any;
    for (const ano of Object.keys(enabledAnnotations) as (keyof EnabledAnnotations)[]) {
        enabledAnnotationsForHover[ano] = enabledAnnotations[ano] && config[ano].onHoverEnabled === onHoverEnabled;
    }
    return enabledAnnotationsForHover;
}

export function shouldUseAnnotation(
    annotation: keyof TokenAnnotationTriggerOptions,
    tokenStatus: TokenStatus,
    tokenStates: TokenState[],
    dt: DictionaryTrack
): boolean {
    if (tokenStates.includes(TokenState.IGNORED)) {
        return dt.dictionaryTokenAnnotationConfig.onStates[TokenState.IGNORED][annotation]; // Ignored state gets treated like mature, don't fallback if marked ignored
    }
    if (dt.dictionaryTokenAnnotationConfig.onStatuses[tokenStatus][annotation]) return true;
    return false;
}

export enum ApplyStrategy {
    ADD = 'ADD',
    REMOVE = 'REMOVE',
    REPLACE = 'REPLACE',
    TOGGLE = 'TOGGLE',
}

export interface DictionaryTrack {
    /** @deprecated Use dictionaryTokenAnnotationConfig.colorizeEnabled */
    readonly dictionaryColorizeSubtitles: boolean;
    readonly dictionaryAutoGenerateStatistics: boolean;
    /** @deprecated Use dictionaryTokenAnnotationConfig.target.annotation.onHoverEnabled */
    readonly dictionaryColorizeOnHoverOnly: boolean;
    readonly dictionaryHighlightOnHover: boolean;
    readonly dictionaryTokenMatchStrategy: TokenMatchStrategy;
    readonly dictionaryMatchAcrossScripts: boolean;
    readonly dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority;
    readonly dictionaryYomitanUrl: string;
    readonly dictionaryYomitanParser: 'scanning-parser' | 'mecab';
    readonly dictionaryYomitanScanLength: number;
    /** @deprecated Use dictionaryTokenAnnotationConfig.onStatuses[].reading */
    readonly dictionaryTokenReadingAnnotation: TokenReadingAnnotation;
    /** @deprecated Use dictionaryTokenAnnotationConfig.onStates[TokenState.IGNORED].reading */
    readonly dictionaryDisplayIgnoredTokenReadings: boolean;
    /** @deprecated Use dictionaryTokenAnnotationConfig.onStatuses[].frequency */
    readonly dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation;
    readonly dictionaryAnkiDecks: string[];
    readonly dictionaryAnkiWordFields: string[];
    readonly dictionaryAnkiSentenceFields: string[];
    readonly dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy;
    readonly dictionaryAnkiMatureCutoff: number;
    readonly dictionaryAnkiTreatSuspended: TokenStatus | 'NORMAL';
    readonly dictionaryWaniKaniApiToken: string;
    readonly dictionaryTokenStyling: TokenStyling;
    readonly dictionaryTokenStylingThickness: number;
    /** @deprecated Use dictionaryTokenStatusConfig[].display */
    readonly dictionaryColorizeFullyKnownTokens: boolean;
    /** @deprecated Use dictionaryTokenStatusConfig[].colors */
    readonly dictionaryTokenStatusColors: string[];
    readonly dictionaryTokenStatusConfig: TokenStatusConfig[]; // Indexed by TokenStatus (if adding config for states, use a separate array indexed by TokenState)
    readonly dictionaryTokenAnnotationConfig: TokenAnnotationConfigs;
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
    dictionaryMatchAcrossScripts: (a, b) => a === b,
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
    dictionaryWaniKaniApiToken: (a, b) => a === b,
    dictionaryTokenStyling: (a, b) => a === b,
    dictionaryTokenStylingThickness: (a, b) => a === b,
    dictionaryColorizeFullyKnownTokens: (a, b) => a === b,
    dictionaryTokenStatusColors: (a, b) => arrayEquals(a, b),
    dictionaryTokenStatusConfig: (a, b) => arrayEquals(a, b, areTokenStatusConfigsEqual),
    dictionaryTokenAnnotationConfig: (a, b) => areTokenAnnotationConfigsEqual(a, b),
};

export function compareDTField<K extends keyof DictionaryTrack>(
    key: K,
    a: DictionaryTrack,
    b: DictionaryTrack
): boolean {
    return dictionaryTrackComparators[key](a[key], b[key]);
}

export function areDictionaryTracksEqual(dt1: DictionaryTrack | undefined, dt2: DictionaryTrack | undefined): boolean {
    if (dt1 === dt2) return true;
    if (!dt1 || !dt2) return false;

    for (const key in dictionaryTrackComparators) {
        if (!compareDTField(key as keyof DictionaryTrack, dt1, dt2)) {
            return false;
        }
    }
    return true;
}

const dictionaryTrackRenderOnlyComparators: {
    [K in keyof DictionaryTrack]: (a: DictionaryTrack[K], b: DictionaryTrack[K]) => boolean;
} = {
    dictionaryColorizeSubtitles: () => true,
    dictionaryAutoGenerateStatistics: () => false,
    dictionaryColorizeOnHoverOnly: () => true,
    dictionaryHighlightOnHover: () => true,
    dictionaryTokenMatchStrategy: () => false,
    dictionaryMatchAcrossScripts: () => false,
    dictionaryTokenMatchStrategyPriority: () => false,
    dictionaryYomitanUrl: () => false,
    dictionaryYomitanParser: () => false,
    dictionaryYomitanScanLength: () => false,
    dictionaryTokenReadingAnnotation: () => true,
    dictionaryDisplayIgnoredTokenReadings: () => true,
    dictionaryTokenFrequencyAnnotation: () => true,
    dictionaryAnkiDecks: () => false,
    dictionaryAnkiWordFields: () => false,
    dictionaryAnkiSentenceFields: () => false,
    dictionaryAnkiSentenceTokenMatchStrategy: () => false,
    dictionaryAnkiMatureCutoff: () => false,
    dictionaryAnkiTreatSuspended: () => false,
    dictionaryWaniKaniApiToken: () => false,
    dictionaryTokenStyling: () => true,
    dictionaryTokenStylingThickness: () => true,
    dictionaryColorizeFullyKnownTokens: () => true,
    dictionaryTokenStatusColors: () => true,
    dictionaryTokenStatusConfig: (a, b) => arrayEquals(a, b, areTokenStatusConfigsRenderOnly),
    dictionaryTokenAnnotationConfig: (a, b) => areTokenAnnotationConfigsRenderOnly(a, b),
};

export function areDictionaryTracksRenderOnly(
    dt1: DictionaryTrack | undefined,
    dt2: DictionaryTrack | undefined
): boolean {
    if (dt1 === dt2) return true;
    if (!dt1 || !dt2) return false;

    if (dictionaryTrackEnabled(dt1) !== dictionaryTrackEnabled(dt2)) return false;
    for (const includeStates of [false, true]) {
        if (
            dictionaryStatusCollectionEnabled(dt1, { includeStates }) !==
            dictionaryStatusCollectionEnabled(dt2, { includeStates })
        ) {
            return false;
        }
    }

    for (const key in dictionaryTrackComparators) {
        const typedKey = key as keyof DictionaryTrack;
        if (
            !compareDTField(typedKey, dt1, dt2) &&
            !compareRenderOnlyField(dictionaryTrackRenderOnlyComparators, typedKey, dt1, dt2)
        ) {
            return false;
        }
    }
    return true;
}
