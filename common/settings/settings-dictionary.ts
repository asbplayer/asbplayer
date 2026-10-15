import { arrayEquals } from '@project/common/util/array-equals';
import { compareField, fieldsEqual } from '@project/common/util';
import type { FieldComparators } from '@project/common/util';

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

const tokenStatusConfigComparators: FieldComparators<TokenStatusConfig> = {
    display: (a, b) => a === b,
    color: (a, b) => a === b,
    alpha: (a, b) => a === b,
};

export function compareTokenStatusConfigField<K extends keyof TokenStatusConfig>(
    key: K,
    a: TokenStatusConfig,
    b: TokenStatusConfig
): boolean {
    return compareField(key, a, b, tokenStatusConfigComparators);
}

export function areTokenStatusConfigsEqual(a: TokenStatusConfig, b: TokenStatusConfig): boolean {
    return fieldsEqual(a, b, tokenStatusConfigComparators);
}

const tokenStatusConfigRenderOnlyComparators: FieldComparators<TokenStatusConfig> = {
    display: () => true,
    color: () => true,
    alpha: () => true,
};

export function areTokenStatusConfigsRenderOnly(a: TokenStatusConfig, b: TokenStatusConfig): boolean {
    return fieldsEqual(a, b, tokenStatusConfigComparators, tokenStatusConfigRenderOnlyComparators);
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

export interface DictionaryPlaybackTriggerConfig {
    enabled: boolean; // May want each status/state to be able to override the base rules and add in specific rate/auto-pause/etc
}

export interface DictionaryPlaybackRules {
    /** Inclusive word-count bounds for each status or state; zero disables each bound. */
    minWords: number;
    maxWords: number;
    /** Inclusive frequency bounds; zero disables each bound and missing frequency is treated as one. */
    minFrequency: number;
    maxFrequency: number;
}

export interface DictionaryPlaybackFeatureConfig<Rules = DictionaryPlaybackRules> {
    rules: Rules;
    onStatuses: DictionaryPlaybackTriggerConfig[];
    onStates: DictionaryPlaybackTriggerConfig[];
}

export interface DictionaryPlaybackComprehensionConfig {
    enabled: boolean; // May want to expose the comprehension thresholds and use non-linear interpolation in the future
}

export interface DictionaryPlaybackFastForwardConfig extends DictionaryPlaybackFeatureConfig {
    rateByComprehension: DictionaryPlaybackComprehensionConfig;
}

export const minimumWholeSubtitleMatchThreshold = 0.01;
export const maximumWholeSubtitleMatchThreshold = 1;

export interface DictionaryPlaybackWordVisibilityConfig extends DictionaryPlaybackFeatureConfig {
    /** Whether words that do not match the visibility rule are hidden before the whole-subtitle threshold is met. */
    hideWordsIndividuallyUntilThreshold: boolean;
    /** Fraction of words that must be hidden before hiding the whole subtitle; one requires every word. */
    wholeSubtitleMatchThreshold: number;
}

export interface DictionaryPlaybackConfig {
    autoPause: DictionaryPlaybackFeatureConfig;
    condensed: DictionaryPlaybackFeatureConfig;
    fastForward: DictionaryPlaybackFastForwardConfig;
    repeat: DictionaryPlaybackFeatureConfig;
    wordVisibility: DictionaryPlaybackWordVisibilityConfig;
}

export type DictionaryPlaybackFeature = keyof DictionaryPlaybackConfig;

export const dictionaryPlaybackFeatures: readonly DictionaryPlaybackFeature[] = [
    'autoPause',
    'repeat',
    'condensed',
    'fastForward',
    'wordVisibility',
];

export const dictionaryPlaybackFeatureEnabled = (
    config: DictionaryPlaybackConfig,
    feature: DictionaryPlaybackFeature
) =>
    config[feature].onStatuses.some((status) => status.enabled) ||
    config[feature].onStates.some((state) => state.enabled);

export function dictionaryPlaybackGroupSettingsEnabled(
    config: DictionaryPlaybackConfig,
    feature: DictionaryPlaybackFeature
): boolean {
    return (
        dictionaryPlaybackFeatureEnabled(config, feature) ||
        (feature === 'fastForward' && config.fastForward.rateByComprehension.enabled)
    );
}

function areDictionaryPlaybackTriggersEqual(a: DictionaryPlaybackTriggerConfig, b: DictionaryPlaybackTriggerConfig) {
    return a.enabled === b.enabled;
}

const dictionaryPlaybackRulesComparators: FieldComparators<DictionaryPlaybackRules> = {
    minWords: (a, b) => a === b,
    maxWords: (a, b) => a === b,
    minFrequency: (a, b) => a === b,
    maxFrequency: (a, b) => a === b,
};

function areDictionaryPlaybackRulesEqual(a: DictionaryPlaybackRules, b: DictionaryPlaybackRules) {
    return fieldsEqual(a, b, dictionaryPlaybackRulesComparators);
}

const dictionaryPlaybackFeatureConfigComparators: FieldComparators<DictionaryPlaybackFeatureConfig> = {
    rules: areDictionaryPlaybackRulesEqual,
    onStatuses: (a, b) => arrayEquals(a, b, areDictionaryPlaybackTriggersEqual),
    onStates: (a, b) => arrayEquals(a, b, areDictionaryPlaybackTriggersEqual),
};

function areDictionaryPlaybackFeatureConfigsEqual(
    a: DictionaryPlaybackFeatureConfig,
    b: DictionaryPlaybackFeatureConfig
) {
    return fieldsEqual(a, b, dictionaryPlaybackFeatureConfigComparators);
}

function areDictionaryPlaybackFastForwardConfigsEqual(
    a: DictionaryPlaybackFastForwardConfig,
    b: DictionaryPlaybackFastForwardConfig
): boolean {
    return (
        areDictionaryPlaybackFeatureConfigsEqual(a, b) &&
        a.rateByComprehension.enabled === b.rateByComprehension.enabled
    );
}

function areDictionaryPlaybackWordVisibilityConfigsEqual(
    a: DictionaryPlaybackWordVisibilityConfig,
    b: DictionaryPlaybackWordVisibilityConfig
): boolean {
    return (
        areDictionaryPlaybackFeatureConfigsEqual(a, b) &&
        a.hideWordsIndividuallyUntilThreshold === b.hideWordsIndividuallyUntilThreshold &&
        a.wholeSubtitleMatchThreshold === b.wholeSubtitleMatchThreshold
    );
}

const dictionaryPlaybackConfigComparators: FieldComparators<DictionaryPlaybackConfig> = {
    autoPause: areDictionaryPlaybackFeatureConfigsEqual,
    condensed: areDictionaryPlaybackFeatureConfigsEqual,
    fastForward: areDictionaryPlaybackFastForwardConfigsEqual,
    repeat: areDictionaryPlaybackFeatureConfigsEqual,
    wordVisibility: areDictionaryPlaybackWordVisibilityConfigsEqual,
};

export function areDictionaryPlaybackConfigsEqual(a: DictionaryPlaybackConfig, b: DictionaryPlaybackConfig): boolean {
    return fieldsEqual(a, b, dictionaryPlaybackConfigComparators);
}

export type TokenAnnotationConfigTarget = keyof Pick<TokenAnnotationConfigs, 'video' | 'subtitlePlayer'>;

const tokenAnnotationTriggerOptionsComparators: FieldComparators<TokenAnnotationTriggerOptions> = {
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
    return compareField(key, a, b, tokenAnnotationTriggerOptionsComparators);
}

export function areTokenAnnotationTriggerOptionsEqual(
    a: TokenAnnotationTriggerOptions,
    b: TokenAnnotationTriggerOptions
): boolean {
    return fieldsEqual(a, b, tokenAnnotationTriggerOptionsComparators);
}

const tokenAnnotationConfigOptionsComparators: FieldComparators<TokenAnnotationConfigOptions> = {
    onHoverEnabled: (a, b) => a === b,
    size: (a, b) => a === b,
};

export function compareTokenAnnotationConfigOptionsField<K extends keyof TokenAnnotationConfigOptions>(
    key: K,
    a: TokenAnnotationConfigOptions,
    b: TokenAnnotationConfigOptions
): boolean {
    return compareField(key, a, b, tokenAnnotationConfigOptionsComparators);
}

export function areTokenAnnotationConfigOptionsEqual(
    a: TokenAnnotationConfigOptions,
    b: TokenAnnotationConfigOptions
): boolean {
    return fieldsEqual(a, b, tokenAnnotationConfigOptionsComparators);
}

const tokenAnnotationConfigOptionsRenderOnlyComparators: FieldComparators<TokenAnnotationConfigOptions> = {
    onHoverEnabled: () => true,
    size: () => true,
};

function areTokenAnnotationConfigOptionsRenderOnly(
    a: TokenAnnotationConfigOptions,
    b: TokenAnnotationConfigOptions
): boolean {
    return fieldsEqual(
        a,
        b,
        tokenAnnotationConfigOptionsComparators,
        tokenAnnotationConfigOptionsRenderOnlyComparators
    );
}

const tokenAnnotationConfigComparators: FieldComparators<TokenAnnotationConfig> = {
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
    return compareField(key, a, b, tokenAnnotationConfigComparators);
}

export function areTokenAnnotationConfigEqual(a: TokenAnnotationConfig, b: TokenAnnotationConfig): boolean {
    return fieldsEqual(a, b, tokenAnnotationConfigComparators);
}

const tokenAnnotationConfigRenderOnlyComparators: FieldComparators<TokenAnnotationConfig> = {
    color: (a, b) => areTokenAnnotationConfigOptionsRenderOnly(a, b),
    reading: (a, b) => areTokenAnnotationConfigOptionsRenderOnly(a, b),
    frequency: (a, b) => areTokenAnnotationConfigOptionsRenderOnly(a, b),
    gloss: (a, b) => areTokenAnnotationConfigOptionsRenderOnly(a, b),
    pitchAccent: (a, b) => areTokenAnnotationConfigOptionsRenderOnly(a, b),
};

function areTokenAnnotationConfigRenderOnly(a: TokenAnnotationConfig, b: TokenAnnotationConfig): boolean {
    return fieldsEqual(a, b, tokenAnnotationConfigComparators, tokenAnnotationConfigRenderOnlyComparators);
}

const tokenAnnotationConfigsComparators: FieldComparators<TokenAnnotationConfigs> = {
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
    return compareField(key, a, b, tokenAnnotationConfigsComparators);
}

export function areTokenAnnotationConfigsEqual(a: TokenAnnotationConfigs, b: TokenAnnotationConfigs): boolean {
    return fieldsEqual(a, b, tokenAnnotationConfigsComparators);
}

const tokenAnnotationTriggerOptionsRenderOnlyComparators: FieldComparators<TokenAnnotationTriggerOptions> = {
    reading: () => true,
    frequency: () => true,
    gloss: () => false,
    pitchAccent: () => true,
};

function areTokenAnnotationTriggerOptionsRenderOnly(
    a: TokenAnnotationTriggerOptions,
    b: TokenAnnotationTriggerOptions
): boolean {
    return fieldsEqual(
        a,
        b,
        tokenAnnotationTriggerOptionsComparators,
        tokenAnnotationTriggerOptionsRenderOnlyComparators
    );
}

const tokenAnnotationConfigsRenderOnlyComparators: FieldComparators<TokenAnnotationConfigs> = {
    colorizeEnabled: () => true,
    video: (a, b) => areTokenAnnotationConfigRenderOnly(a, b),
    subtitlePlayer: (a, b) => areTokenAnnotationConfigRenderOnly(a, b),
    onStatuses: (a, b) => arrayEquals(a, b, areTokenAnnotationTriggerOptionsRenderOnly),
    onStates: (a, b) => arrayEquals(a, b, areTokenAnnotationTriggerOptionsRenderOnly),
};

export function areTokenAnnotationConfigsRenderOnly(a: TokenAnnotationConfigs, b: TokenAnnotationConfigs): boolean {
    return fieldsEqual(a, b, tokenAnnotationConfigsComparators, tokenAnnotationConfigsRenderOnlyComparators);
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
        dictionaryPlaybackFeatures.some((feature) =>
            dictionaryPlaybackFeatureEnabled(dt.dictionaryPlaybackConfig, feature)
        ) ||
        dt.dictionaryPlaybackConfig.fastForward.rateByComprehension.enabled ||
        dt.dictionaryTokenAnnotationConfig.colorizeEnabled ||
        dt.dictionaryTokenAnnotationConfig.onStatuses.some((s) => Object.values(s).some((v) => v)) ||
        dt.dictionaryTokenAnnotationConfig.onStates.some((s) => Object.values(s).some((v) => v)) ||
        dt.dictionaryAutoGenerateStatistics
    );
}

export function dictionaryStatusCollectionEnabled(dt: DictionaryTrack, options: { includeStates: boolean }): boolean {
    const { includeStates } = options;
    if (dt.dictionaryPlaybackConfig.fastForward.rateByComprehension.enabled) return true;
    for (const feature of dictionaryPlaybackFeatures) {
        const { onStatuses, onStates } = dt.dictionaryPlaybackConfig[feature];
        if (onStatuses.some((status) => status.enabled)) return true;
        if (includeStates && onStates.some((state) => state.enabled)) return true;
    }
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
    readonly dictionaryPlaybackConfig: DictionaryPlaybackConfig;
}

export interface DictionarySettings {
    readonly dictionaryTracks: DictionaryTrack[];
}

const dictionaryTrackComparators: FieldComparators<DictionaryTrack> = {
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
    dictionaryPlaybackConfig: (a, b) => areDictionaryPlaybackConfigsEqual(a, b),
};

export function compareDTField<K extends keyof DictionaryTrack>(
    key: K,
    a: DictionaryTrack,
    b: DictionaryTrack
): boolean {
    return compareField(key, a, b, dictionaryTrackComparators);
}

export function areDictionaryTracksEqual(dt1: DictionaryTrack | undefined, dt2: DictionaryTrack | undefined): boolean {
    return fieldsEqual(dt1, dt2, dictionaryTrackComparators);
}

const dictionaryTrackRenderOnlyComparators: FieldComparators<DictionaryTrack> = {
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
    dictionaryPlaybackConfig: () => true,
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

    return fieldsEqual(dt1, dt2, dictionaryTrackComparators, dictionaryTrackRenderOnlyComparators);
}

function makeDefaultDictionaryTokenAnnotationConfigs() {
    return {
        colorizeEnabled: false,
        video: {
            color: { onHoverEnabled: false, size: 1 },
            reading: { onHoverEnabled: false, size: 0.5 },
            frequency: { onHoverEnabled: false, size: 0.3 },
            gloss: { onHoverEnabled: true, size: 0.5 },
            pitchAccent: { onHoverEnabled: true, size: 0.1 },
        },
        subtitlePlayer: {
            color: { onHoverEnabled: false, size: 1 },
            reading: { onHoverEnabled: false, size: 0.5 },
            frequency: { onHoverEnabled: false, size: 0.5 },
            gloss: { onHoverEnabled: true, size: 0.5 },
            pitchAccent: { onHoverEnabled: true, size: 0.1 },
        },
        onStatuses: [
            { reading: false, frequency: false, gloss: false, pitchAccent: false },
            { reading: false, frequency: false, gloss: false, pitchAccent: false },
            { reading: false, frequency: false, gloss: false, pitchAccent: false },
            { reading: false, frequency: false, gloss: false, pitchAccent: false },
            { reading: false, frequency: false, gloss: false, pitchAccent: false },
            { reading: false, frequency: false, gloss: false, pitchAccent: false },
        ],
        onStates: [{ reading: false, frequency: false, gloss: false, pitchAccent: false }],
    };
}

const defaultDictionaryTokenAnnotationConfig = makeDefaultDictionaryTokenAnnotationConfigs();
export const NUM_TOKEN_STATUSES = defaultDictionaryTokenAnnotationConfig.onStatuses.length;
export const NUM_TOKEN_STATES = defaultDictionaryTokenAnnotationConfig.onStates.length;

const makeDefaultDictionaryPlaybackConfig = (): DictionaryTrack['dictionaryPlaybackConfig'] => {
    const feature = () => ({
        rules: { minWords: 0, maxWords: 0, minFrequency: 0, maxFrequency: 0 },
        onStatuses: Array.from({ length: NUM_TOKEN_STATUSES }, () => ({ enabled: false })),
        onStates: Array.from({ length: NUM_TOKEN_STATES }, () => ({ enabled: false })),
    });
    return {
        autoPause: feature(),
        condensed: feature(),
        fastForward: { ...feature(), rateByComprehension: { enabled: false } },
        repeat: feature(),
        wordVisibility: {
            ...feature(),
            hideWordsIndividuallyUntilThreshold: true,
            wholeSubtitleMatchThreshold: maximumWholeSubtitleMatchThreshold,
        },
    };
};

const defaultDictionaryTrackSettings: DictionaryTrack = {
    dictionaryColorizeSubtitles: false,
    dictionaryAutoGenerateStatistics: false,
    dictionaryColorizeOnHoverOnly: false,
    dictionaryHighlightOnHover: true,
    dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
    dictionaryMatchAcrossScripts: true,
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
    dictionaryWaniKaniApiToken: '',
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
    dictionaryTokenAnnotationConfig: defaultDictionaryTokenAnnotationConfig,
    dictionaryPlaybackConfig: makeDefaultDictionaryPlaybackConfig(),
};

export const defaultDictionaryTracks = [
    defaultDictionaryTrackSettings,
    defaultDictionaryTrackSettings,
    defaultDictionaryTrackSettings,
];
export const NUM_DICTIONARY_TRACKS = defaultDictionaryTracks.length;

export const ensureDictionaryTracksConsistency = ({ dictionaryTracks }: Partial<DictionarySettings>) => {
    if (!dictionaryTracks) return;
    const defaultTrack = defaultDictionaryTracks[0];
    const fullyKnownStatus = getFullyKnownTokenStatus();
    for (const dt of dictionaryTracks) {
        // Ensure dictionaryTokenStatusColors exists and has the correct length
        if (!dt.dictionaryTokenStatusColors) (dt as any).dictionaryTokenStatusColors = [];
        while (dt.dictionaryTokenStatusColors.length < NUM_TOKEN_STATUSES) {
            const color = defaultTrack.dictionaryTokenStatusColors[dt.dictionaryTokenStatusColors.length];
            dt.dictionaryTokenStatusColors.push(color);
        }
        while (dt.dictionaryTokenStatusColors.length > NUM_TOKEN_STATUSES) {
            dt.dictionaryTokenStatusColors.pop();
        }

        // Ensure dictionaryTokenStatusConfig exists and has the correct length
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

        // Migrate dictionaryTokenStatusColors to dictionaryTokenStatusConfig, both are updated on settings change
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

        // Existing tracks predate playback settings; new statuses and states need a trigger row.
        if (!dt.dictionaryPlaybackConfig) (dt as any).dictionaryPlaybackConfig = makeDefaultDictionaryPlaybackConfig();
        for (const feature of dictionaryPlaybackFeatures) {
            const playback = dt.dictionaryPlaybackConfig[feature];
            for (const [triggers, count] of [
                [playback.onStatuses, NUM_TOKEN_STATUSES],
                [playback.onStates, NUM_TOKEN_STATES],
            ] as const) {
                while (triggers.length < count) triggers.push({ enabled: false });
                if (triggers.length > count) triggers.length = count;
            }
        }

        // Ensure dictionaryTokenAnnotationConfig exists
        if (!dt.dictionaryTokenAnnotationConfig) {
            const config = makeDefaultDictionaryTokenAnnotationConfigs();

            // Migrate dictionaryColorizeOnHoverOnly to dictionaryTokenAnnotationConfig
            config.video.color.onHoverEnabled = dt.dictionaryColorizeOnHoverOnly;
            config.video.reading.onHoverEnabled = dt.dictionaryColorizeOnHoverOnly;
            config.video.frequency.onHoverEnabled = dt.dictionaryColorizeOnHoverOnly;

            // Migrate dictionaryTokenReadingAnnotation to dictionaryTokenAnnotationConfig
            if (dt.dictionaryTokenReadingAnnotation === TokenReadingAnnotation.ALWAYS) {
                config.onStatuses.forEach((s) => (s.reading = true));
                config.onStates[TokenState.IGNORED].reading = true;
            } else if (dt.dictionaryTokenReadingAnnotation === TokenReadingAnnotation.LEARNING_OR_BELOW) {
                for (let tokenStatus: TokenStatus = 0; tokenStatus <= TokenStatus.LEARNING; ++tokenStatus) {
                    config.onStatuses[tokenStatus].reading = true;
                }
            } else if (dt.dictionaryTokenReadingAnnotation === TokenReadingAnnotation.UNKNOWN_OR_BELOW) {
                for (let tokenStatus: TokenStatus = 0; tokenStatus <= TokenStatus.UNKNOWN; ++tokenStatus) {
                    config.onStatuses[tokenStatus].reading = true;
                }
            }
            if (dt.dictionaryDisplayIgnoredTokenReadings) config.onStates[TokenState.IGNORED].reading = true;

            // Migrate dictionaryTokenFrequencyAnnotation to dictionaryTokenAnnotationConfig
            if (dt.dictionaryTokenFrequencyAnnotation === TokenFrequencyAnnotation.ALWAYS) {
                config.onStatuses.forEach((s) => (s.frequency = true));
                config.onStates[TokenState.IGNORED].frequency = true;
            } else if (dt.dictionaryTokenFrequencyAnnotation === TokenFrequencyAnnotation.UNCOLLECTED_ONLY) {
                config.onStatuses[TokenStatus.UNCOLLECTED].frequency = true;
            }

            (dt as any).dictionaryTokenAnnotationConfig = config;
        }
        if (dt.dictionaryTokenAnnotationConfig.colorizeEnabled !== dt.dictionaryColorizeSubtitles) {
            dt.dictionaryTokenAnnotationConfig.colorizeEnabled = dt.dictionaryColorizeSubtitles;
        }

        for (const [target, defaultTarget] of [
            [dt.dictionaryTokenAnnotationConfig.video, defaultTrack.dictionaryTokenAnnotationConfig.video],
            [
                dt.dictionaryTokenAnnotationConfig.subtitlePlayer,
                defaultTrack.dictionaryTokenAnnotationConfig.subtitlePlayer,
            ],
        ] as const) {
            if (target.gloss === undefined) (target as any).gloss = { ...defaultTarget.gloss };
        }
        for (const trigger of [
            ...dt.dictionaryTokenAnnotationConfig.onStatuses,
            ...dt.dictionaryTokenAnnotationConfig.onStates,
        ]) {
            if (trigger.gloss === undefined) (trigger as any).gloss = false;
        }

        // Ensure dictionaryTokenAnnotationConfig has the correct length
        while (dt.dictionaryTokenAnnotationConfig.onStatuses.length < NUM_TOKEN_STATUSES) {
            dt.dictionaryTokenAnnotationConfig.onStatuses.push({
                reading: false,
                frequency: false,
                gloss: false,
                pitchAccent: false,
            });
        }
        while (dt.dictionaryTokenAnnotationConfig.onStatuses.length > NUM_TOKEN_STATUSES) {
            dt.dictionaryTokenAnnotationConfig.onStatuses.pop();
        }
        while (dt.dictionaryTokenAnnotationConfig.onStates.length < NUM_TOKEN_STATES) {
            dt.dictionaryTokenAnnotationConfig.onStates.push({
                reading: false,
                frequency: false,
                gloss: false,
                pitchAccent: false,
            });
        }
        while (dt.dictionaryTokenAnnotationConfig.onStates.length > NUM_TOKEN_STATES) {
            dt.dictionaryTokenAnnotationConfig.onStates.pop();
        }

        // Default for new settings
        if (!dt.dictionaryYomitanParser) (dt as any).dictionaryYomitanParser = defaultTrack.dictionaryYomitanParser;
        if (dt.dictionaryAutoGenerateStatistics === undefined) {
            (dt as any).dictionaryAutoGenerateStatistics = defaultTrack.dictionaryAutoGenerateStatistics;
        }
        if (dt.dictionaryWaniKaniApiToken === undefined) {
            (dt as any).dictionaryWaniKaniApiToken = defaultTrack.dictionaryWaniKaniApiToken;
        }
        if (dt.dictionaryMatchAcrossScripts === undefined) {
            (dt as any).dictionaryMatchAcrossScripts = defaultTrack.dictionaryMatchAcrossScripts;
        }
    }
    while (dictionaryTracks.length < NUM_DICTIONARY_TRACKS) {
        dictionaryTracks.push(defaultTrack);
    }
    while (dictionaryTracks.length > NUM_DICTIONARY_TRACKS) {
        dictionaryTracks.pop();
    }
};
