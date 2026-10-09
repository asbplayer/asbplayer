import { AutoPausePreference, PlayMode } from '@project/common';
import type { IndexedSubtitleModel, Token } from '@project/common';
import type {
    PlaybackTimelineBlock,
    PlaybackTimelineAdaptiveRate,
    PlaybackTimelineEndAction,
    PlaybackTimelineRepeatAction,
    PlaybackTimelineState,
} from '@project/common/playback/timeline/playback-timeline';
import {
    AutoPauseResumeMode,
    dictionaryPlaybackFeatureEnabled,
    dictionaryPlaybackFeatures,
    SubtitleVisibility,
} from '@project/common/settings';
import type { DictionaryTrack, DictionaryPlaybackConfig, DictionaryPlaybackFeature } from '@project/common/settings';
import {
    subtitleWordVisibility,
    matchingPlaybackTokens,
    wordTokens,
} from '@project/common/playback/plan/playback-dictionary';
import { sentenceComprehensionPercent } from '@project/common/dictionary-statistics/dictionary-statistics-view';
import { compilePlaybackTimelineSubtitles } from '@project/common/playback/timeline/playback-timeline-compiler';
import type { PlaybackTimelineSubtitles } from '@project/common/playback/timeline/playback-timeline-compiler';
import {
    areSubtitleModelsEqual,
    arrayEquals,
    fieldsEqual,
    normalizeFinite,
    normalizeNonNegative,
    normalizeNonPositive,
} from '@project/common/util';
import type { FieldComparators } from '@project/common/util';
import { asbTrace } from '@project/common/util/log';

export const playbackPlanCorrectionToleranceMs = 0.5;

export interface PlaybackPlanFastForward {
    readonly playbackRate: number;
    readonly minimumSkipIntervalMs: number;
}

export interface PlaybackPlanCondensed {
    readonly minimumSkipIntervalMs: number;
    readonly pauseAtStart: boolean;
}

export interface PlaybackPlanAutoPauseResumeManual {
    readonly mode: AutoPauseResumeMode.manual;
}

export interface PlaybackPlanAutoPauseResumeFixed {
    readonly mode: AutoPauseResumeMode.fixed;
    readonly fixedDurationMs: number;
    readonly delayMs: number;
}

export interface PlaybackPlanAutoPauseResumeSubtitleLength {
    readonly mode: AutoPauseResumeMode.subtitleLength;
    readonly minimumDurationMs: number;
    readonly maximumDurationMs: number;
    readonly timePerCharacterMs: number;
    readonly delayMs: number;
}

export type PlaybackPlanAutoPauseResume =
    | PlaybackPlanAutoPauseResumeManual
    | PlaybackPlanAutoPauseResumeFixed
    | PlaybackPlanAutoPauseResumeSubtitleLength;

export interface PlaybackPlanAutoPause {
    readonly resume: PlaybackPlanAutoPauseResume;
}

/** Playback policy compiled and applied beside its owning media element. */
export interface PlaybackPlan<T extends IndexedSubtitleModel> {
    readonly timelineSubtitles: PlaybackTimelineSubtitles<T>;
    readonly playbackRate: number;
    readonly condensed?: PlaybackPlanCondensed;
    readonly fastForward?: PlaybackPlanFastForward;
    readonly autoPause?: PlaybackPlanAutoPause;
    readonly subtitleVisibility: SubtitleVisibility;
}

export interface PlaybackPlanInput<T extends IndexedSubtitleModel> {
    /** Subtitles eligible to influence playback modes. */
    readonly subtitles: readonly T[];
    /** All subtitles eligible for display. Defaults to subtitles. */
    readonly displaySubtitles?: readonly T[];
    readonly durationMs: number;
    readonly playModes: ReadonlySet<PlayMode>;
    readonly autoPausePreference: AutoPausePreference;
    readonly subtitleTriggerStartOffset: number;
    readonly subtitleTriggerEndOffset: number;
    readonly subtitleTriggerGapStartOffset: number;
    readonly subtitleTriggerGapEndOffset: number;
    readonly repeatCountPreference: number;
    readonly repeatsBeforeShowingSubtitles: number;
    readonly condensedPlaybackMinimumSkipIntervalMs: number;
    readonly playbackRate: number;
    readonly fastForwardModePlaybackRate: number;
    readonly fastForwardPlaybackMinimumSkipIntervalMs: number;
    readonly autoPauseResumeMode: AutoPauseResumeMode;
    readonly autoPauseResumeDelayMs: number;
    readonly autoPauseFixedDurationMs: number;
    readonly autoPauseMinimumDurationMs: number;
    readonly autoPauseMaximumDurationMs: number;
    readonly autoPauseTimePerCharacterMs: number;
    readonly subtitleVisibility: SubtitleVisibility;
    readonly dictionaryTracks?: readonly DictionaryTrack[];
}

const autoPausePreferenceIncludes = (
    preference: AutoPausePreference,
    edge: AutoPausePreference.atStart | AutoPausePreference.atEnd
) => preference === edge || preference === AutoPausePreference.atStartAndEnd;

export const timestampComparisonToleranceMs = 1e-6;

export const normalizeAutoPauseDurationBounds = (minimumDurationMs: number, maximumDurationMs: number) => {
    const minimum = normalizeNonNegative(minimumDurationMs);
    const maximum = normalizeNonNegative(maximumDurationMs);

    return {
        minimumDurationMs: minimum,
        maximumDurationMs: maximum === 0 ? 0 : Math.max(minimum, maximum),
    };
};

interface DictionaryPlaybackContext {
    readonly playbackConfig: (track: number) => DictionaryPlaybackConfig | undefined;
    readonly ruled: (track: number, feature: DictionaryPlaybackFeature) => boolean;
    readonly configured: (feature: DictionaryPlaybackFeature) => boolean;
    readonly matches: (feature: DictionaryPlaybackFeature, index: number) => readonly Token[] | undefined;
}

const buildDictionaryPlaybackContext = <T extends IndexedSubtitleModel>({
    subtitles,
    playModes,
    dictionaryTracks = [],
}: PlaybackPlanInput<T>): DictionaryPlaybackContext => {
    const playbackTrackIndexes = new Set(subtitles.map((subtitle) => subtitle.track));
    const playbackConfig = (track: number) => dictionaryTracks[track]?.dictionaryPlaybackConfig;
    const trackFeatures = dictionaryTracks.map(
        (track) =>
            new Set(
                dictionaryPlaybackFeatures.filter((feature) =>
                    dictionaryPlaybackFeatureEnabled(track.dictionaryPlaybackConfig, feature)
                )
            )
    );
    /** Tracks without rules for a feature keep the normal playback-mode behavior for that feature. */
    const ruled = (track: number, feature: DictionaryPlaybackFeature) => trackFeatures[track]?.has(feature) ?? false;
    const configuredFeatures = new Set(
        dictionaryPlaybackFeatures.filter((feature) =>
            trackFeatures.some(
                (features, index) =>
                    (feature === 'wordVisibility' || playbackTrackIndexes.has(index)) && features.has(feature)
            )
        )
    );
    const configured = (feature: DictionaryPlaybackFeature) => configuredFeatures.has(feature);
    const featurePlayModes: Record<Exclude<DictionaryPlaybackFeature, 'wordVisibility'>, PlayMode> = {
        autoPause: PlayMode.autoPause,
        repeat: PlayMode.repeat,
        condensed: PlayMode.condensed,
        fastForward: PlayMode.fastForward,
    };
    const matchesByFeature = new Map<DictionaryPlaybackFeature, ReadonlyMap<number, readonly Token[]>>();
    for (const feature of dictionaryPlaybackFeatures) {
        if (feature === 'wordVisibility' || !configured(feature) || !playModes.has(featurePlayModes[feature])) continue;
        const featureMatches = new Map<number, readonly Token[]>();
        for (const subtitle of subtitles) {
            const config = playbackConfig(subtitle.track);
            if (config === undefined || !ruled(subtitle.track, feature)) continue;
            const tokens = matchingPlaybackTokens(subtitle, config, feature);
            if (tokens.length) featureMatches.set(subtitle.index, tokens);
        }
        matchesByFeature.set(feature, featureMatches);
    }
    return {
        playbackConfig,
        ruled,
        configured,
        matches: (feature, index) => matchesByFeature.get(feature)?.get(index),
    };
};

const buildSubtitleAdaptiveRates = <T extends IndexedSubtitleModel>(
    { subtitles, playModes, playbackRate, fastForwardModePlaybackRate }: PlaybackPlanInput<T>,
    { playbackConfig, matches, ruled }: DictionaryPlaybackContext
): ReadonlyMap<number, PlaybackTimelineAdaptiveRate> => {
    const subtitleRates = new Map<number, PlaybackTimelineAdaptiveRate>();
    if (!playModes.has(PlayMode.fastForward)) return subtitleRates;
    for (const subtitle of subtitles) {
        if (matches('fastForward', subtitle.index)) {
            subtitleRates.set(subtitle.index, { playbackRate, fraction: 0, comprehensionControlled: false });
        } else if (playbackConfig(subtitle.track)?.fastForward.rateByComprehension.enabled) {
            const fraction = Math.max(0, (sentenceComprehensionPercent(subtitle) - 60) / 40);
            subtitleRates.set(subtitle.index, {
                playbackRate: playbackRate + fraction * (fastForwardModePlaybackRate - playbackRate),
                fraction,
                comprehensionControlled: true,
            });
        } else if (ruled(subtitle.track, 'fastForward')) {
            subtitleRates.set(subtitle.index, {
                playbackRate: fastForwardModePlaybackRate,
                fraction: 1,
                comprehensionControlled: false,
            });
        }
    }
    return subtitleRates;
};

const adaptiveRateForBlock = (
    block: PlaybackTimelineBlock,
    subtitleRates: ReadonlyMap<number, PlaybackTimelineAdaptiveRate>,
    playbackRate: number
): PlaybackTimelineAdaptiveRate | undefined => {
    const normalSubtitleRate: PlaybackTimelineAdaptiveRate = {
        playbackRate,
        fraction: 0,
        comprehensionControlled: false,
    };
    let adaptive = false;
    let minimum: PlaybackTimelineAdaptiveRate | undefined;
    for (const index of block.subtitleIndexes) {
        const rate = subtitleRates.get(index);
        if (rate !== undefined) adaptive = true;
        // Subtitles without adaptive rules play at the normal rate, as they would without fast-forward rules.
        const effective = rate ?? normalSubtitleRate;
        // The least-understood subtitle stays in control when rates become equal or reverse order.
        if (minimum === undefined || effective.fraction < minimum.fraction) minimum = effective;
    }
    return adaptive ? minimum : undefined;
};

const createMatchingBlockCompiler = <T extends IndexedSubtitleModel>(
    input: PlaybackPlanInput<T>,
    timeline: PlaybackTimelineSubtitles<T>,
    { ruled, matches }: DictionaryPlaybackContext
) => {
    // Annotations load asynchronously in a buffer around playback. Keep unresolved subtitles so condensed
    // seeks cannot jump past the buffer before it is built.
    const unresolved = (subtitle: T) =>
        !subtitle.tokenization ||
        subtitle.tokenization.error === true ||
        wordTokens(subtitle).some((token) => token.status == null);
    const matchingBlocksBySubtitles = new Map<string, readonly PlaybackTimelineBlock[]>();
    return (feature: DictionaryPlaybackFeature): readonly PlaybackTimelineBlock[] => {
        const included = input.subtitles.filter(
            (subtitle) =>
                !ruled(subtitle.track, feature) ||
                matches(feature, subtitle.index) !== undefined ||
                (feature === 'condensed' && unresolved(subtitle))
        );
        // Features frequently share the same subtitles, such as auto-pause and repeat on the same statuses.
        const key = included.map((subtitle) => subtitle.index).join();
        const cached = matchingBlocksBySubtitles.get(key);
        if (cached) return cached;
        const blocks = compilePlaybackTimelineSubtitles({
            subtitles: included,
            displaySubtitles: timeline.displaySubtitles,
            durationMs: timeline.durationMs,
            subtitleTriggerStartOffset: input.subtitleTriggerStartOffset,
            subtitleTriggerEndOffset: input.subtitleTriggerEndOffset,
            subtitleTriggerGapStartOffset: input.subtitleTriggerGapStartOffset,
            subtitleTriggerGapEndOffset: input.subtitleTriggerGapEndOffset,
        }).blocks;
        matchingBlocksBySubtitles.set(key, blocks);
        return blocks;
    };
};

const buildDictionaryActionBlocks = <T extends IndexedSubtitleModel>(
    { subtitles, playModes }: PlaybackPlanInput<T>,
    { configured, matches }: DictionaryPlaybackContext,
    compileMatchingBlocks: (feature: DictionaryPlaybackFeature) => readonly PlaybackTimelineBlock[],
    {
        autoPauseAtStart,
        autoPauseAtEnd,
        repeatCount,
        revealAfterRepeats,
    }: {
        readonly autoPauseAtStart: boolean;
        readonly autoPauseAtEnd: boolean;
        readonly repeatCount: number;
        readonly revealAfterRepeats: number;
    }
): readonly PlaybackTimelineBlock[] => {
    const subtitlesByIndex = new Map(subtitles.map((subtitle) => [subtitle.index, subtitle]));
    // Tokens are only selected in subtitles displayed at the pause timestamp. Trigger offsets can move a pause
    // outside its subtitle's display interval, where there is no rendered token to select.
    const autoPauseToken = (block: PlaybackTimelineBlock, timestampMs: number) => {
        for (const index of block.subtitleIndexes) {
            const subtitle = subtitlesByIndex.get(index);
            if (!subtitle || timestampMs < subtitle.start || timestampMs >= subtitle.end) continue;
            const token = matches('autoPause', index)?.[0];
            if (token) return { subtitleIndex: index, tokenStart: token.pos[0] };
        }
        return undefined;
    };
    const actionBlocks: PlaybackTimelineBlock[] = [];
    if (playModes.has(PlayMode.autoPause) && configured('autoPause')) {
        for (const block of compileMatchingBlocks('autoPause')) {
            const pauseToken = autoPauseToken(block, block.playbackModeStartMs);
            const endPauseToken = autoPauseToken(block, block.playbackModeEndMs);
            actionBlocks.push({
                ...block,
                id: `autoPause:${block.id}`,
                ...(autoPauseAtStart ? { startAction: true as const } : {}),
                ...(autoPauseAtEnd ? { endAction: { pause: true } } : {}),
                ...(pauseToken === undefined ? {} : { autoPauseToken: pauseToken }),
                ...(endPauseToken === undefined ? {} : { autoPauseEndToken: endPauseToken }),
            });
        }
    }
    if (playModes.has(PlayMode.repeat) && configured('repeat')) {
        for (const block of compileMatchingBlocks('repeat')) {
            actionBlocks.push({
                ...block,
                id: `repeat:${block.id}`,
                endAction: {
                    pause: false,
                    repeat: { count: repeatCount, repeatsBeforeShowingSubtitles: revealAfterRepeats },
                },
            });
        }
    }
    return actionBlocks;
};

const hiddenSubtitleIndexesForPlan = <T extends IndexedSubtitleModel>(
    displaySubtitles: readonly T[],
    subtitleVisibility: SubtitleVisibility,
    { configured, playbackConfig }: DictionaryPlaybackContext
): readonly number[] => {
    if (subtitleVisibility !== SubtitleVisibility.whenDue || !configured('wordVisibility')) return [];
    return displaySubtitles
        .filter((subtitle) => {
            const config = playbackConfig(subtitle.track);
            return config !== undefined && subtitleWordVisibility(subtitle, config).hideWholeSubtitle;
        })
        .map((subtitle) => subtitle.index);
};

const buildAutoPauseResume = <T extends IndexedSubtitleModel>(
    input: PlaybackPlanInput<T>
): PlaybackPlanAutoPauseResume => {
    switch (input.autoPauseResumeMode) {
        case AutoPauseResumeMode.fixed:
            return {
                mode: AutoPauseResumeMode.fixed,
                fixedDurationMs: normalizeNonNegative(input.autoPauseFixedDurationMs),
                delayMs: normalizeNonNegative(input.autoPauseResumeDelayMs),
            };
        case AutoPauseResumeMode.subtitleLength: {
            const bounds = normalizeAutoPauseDurationBounds(
                input.autoPauseMinimumDurationMs,
                input.autoPauseMaximumDurationMs
            );
            return {
                mode: AutoPauseResumeMode.subtitleLength,
                ...bounds,
                timePerCharacterMs: normalizeNonNegative(input.autoPauseTimePerCharacterMs),
                delayMs: normalizeNonNegative(input.autoPauseResumeDelayMs),
            };
        }
        default:
            return { mode: AutoPauseResumeMode.manual };
    }
};

export const buildPlaybackPlan = <T extends IndexedSubtitleModel>(input: PlaybackPlanInput<T>): PlaybackPlan<T> => {
    const {
        subtitles,
        displaySubtitles,
        durationMs,
        playModes,
        autoPausePreference,
        subtitleTriggerStartOffset,
        subtitleTriggerEndOffset,
        subtitleTriggerGapStartOffset,
        subtitleTriggerGapEndOffset,
        repeatCountPreference,
        repeatsBeforeShowingSubtitles,
        condensedPlaybackMinimumSkipIntervalMs,
        playbackRate,
        fastForwardModePlaybackRate,
        fastForwardPlaybackMinimumSkipIntervalMs,
        subtitleVisibility,
    } = input;
    const autoPauseEnabled = playModes.has(PlayMode.autoPause);
    const autoPauseAtStart =
        autoPauseEnabled && autoPausePreferenceIncludes(autoPausePreference, AutoPausePreference.atStart);
    const autoPauseAtEnd =
        autoPauseEnabled && autoPausePreferenceIncludes(autoPausePreference, AutoPausePreference.atEnd);
    const repeat = playModes.has(PlayMode.repeat);
    const repeatCount = normalizeNonNegative(Math.floor(repeatCountPreference));
    const revealAfterRepeats = Math.min(
        normalizeNonNegative(Math.floor(repeatsBeforeShowingSubtitles)),
        repeatCount || Infinity
    );
    const startOffset = normalizeFinite(subtitleTriggerStartOffset);
    const gapEndOffset = normalizeNonPositive(subtitleTriggerGapEndOffset);
    const condensedMinimumSkipIntervalMs = normalizeNonNegative(condensedPlaybackMinimumSkipIntervalMs);
    const fastForwardMinimumSkipIntervalMs = normalizeNonNegative(fastForwardPlaybackMinimumSkipIntervalMs);
    const timeline = compilePlaybackTimelineSubtitles({
        subtitles,
        displaySubtitles,
        durationMs,
        subtitleTriggerStartOffset,
        subtitleTriggerEndOffset,
        subtitleTriggerGapStartOffset,
        subtitleTriggerGapEndOffset,
    });

    const dictionary = buildDictionaryPlaybackContext(input);
    const subtitleRates = buildSubtitleAdaptiveRates(input, dictionary);
    const compileMatchingBlocks = createMatchingBlockCompiler(input, timeline, dictionary);
    const actionBlocks = buildDictionaryActionBlocks(input, dictionary, compileMatchingBlocks, {
        autoPauseAtStart,
        autoPauseAtEnd,
        repeatCount,
        revealAfterRepeats,
    });
    const hiddenSubtitleIndexes = hiddenSubtitleIndexesForPlan(
        timeline.displaySubtitles,
        subtitleVisibility,
        dictionary
    );
    const condensedBlocks =
        playModes.has(PlayMode.condensed) && dictionary.configured('condensed')
            ? compileMatchingBlocks('condensed')
            : undefined;

    const pauseThisBlock = !dictionary.configured('autoPause');
    const repeatThisBlock = !dictionary.configured('repeat');
    const blocks = timeline.blocks.map<PlaybackTimelineBlock>((block) => {
        return {
            ...block,
            ...(autoPauseAtStart && pauseThisBlock ? { startAction: true as const } : {}),
            adaptiveRate: adaptiveRateForBlock(block, subtitleRates, playbackRate),
            ...((autoPauseAtEnd && pauseThisBlock) || (repeat && repeatThisBlock)
                ? {
                      endAction: {
                          pause: autoPauseAtEnd && pauseThisBlock,
                          ...(repeat && repeatThisBlock
                              ? {
                                    repeat: {
                                        count: repeatCount,
                                        repeatsBeforeShowingSubtitles: revealAfterRepeats,
                                    },
                                }
                              : {}),
                      },
                  }
                : {}),
        };
    });

    const plan: PlaybackPlan<T> = {
        timelineSubtitles: {
            ...timeline,
            blocks,
            actionBlocks,
            ...(condensedBlocks === undefined ? {} : { condensedBlocks }),
            hiddenSubtitleIndexes,
        },
        playbackRate,
        subtitleVisibility,
        ...(autoPauseEnabled
            ? {
                  autoPause: {
                      resume: buildAutoPauseResume(input),
                  },
              }
            : {}),
        ...(playModes.has(PlayMode.condensed)
            ? {
                  condensed: {
                      minimumSkipIntervalMs: condensedMinimumSkipIntervalMs,
                      pauseAtStart:
                          autoPauseAtStart && startOffset <= 0 && Math.abs(gapEndOffset) <= Math.abs(startOffset),
                  },
              }
            : {}),
        ...(playModes.has(PlayMode.fastForward)
            ? {
                  fastForward: {
                      playbackRate: fastForwardModePlaybackRate,
                      minimumSkipIntervalMs: fastForwardMinimumSkipIntervalMs,
                  },
              }
            : {}),
    };
    asbTrace('playback/plan', 'Built playback plan', {
        actionBlockCount: actionBlocks.length,
        adaptiveRateBlockCount: blocks.filter((block) => block.adaptiveRate !== undefined).length,
        autoPause: plan.autoPause?.resume.mode,
        condensed: plan.condensed !== undefined,
        condensedBlockCount: condensedBlocks?.length,
        dictionaryFeatures: dictionaryPlaybackFeatures.filter(dictionary.configured),
        dictionaryMatchingSubtitleCounts: Object.fromEntries(
            dictionaryPlaybackFeatures
                .filter((feature) => feature !== 'wordVisibility')
                .map((feature) => [
                    feature,
                    subtitles.reduce(
                        (count, subtitle) => count + Number(!!dictionary.matches(feature, subtitle.index)),
                        0
                    ),
                ])
        ),
        displaySubtitleCount: timeline.displaySubtitles.length,
        durationMs: timeline.durationMs,
        fastForward: plan.fastForward?.playbackRate,
        hiddenSubtitleCount: hiddenSubtitleIndexes.length,
        modes: [...playModes],
        playbackRate,
        repeatsBeforeShowingSubtitles: revealAfterRepeats,
        timelineBlockCount: plan.timelineSubtitles.blocks.length,
    });
    return plan;
};

export const fastForwardingForPlanState = <T extends IndexedSubtitleModel>(
    plan: PlaybackPlan<T>,
    state: PlaybackTimelineState
): boolean => {
    if (plan.fastForward === undefined) return false;
    if (state.current !== undefined) {
        return (state.current.adaptiveRate?.fraction ?? 0) > 0;
    }

    const previousGapEdge = state.previous?.subtitleTriggerGapStartOffsetMs;
    const nextGapEdge = state.next?.subtitleTriggerGapEndOffsetMs;
    if (previousGapEdge === undefined && nextGapEdge === undefined) return true;

    let gapDurationMs: number;
    if (previousGapEdge === undefined) {
        gapDurationMs = nextGapEdge! + 1;
    } else if (nextGapEdge === undefined) {
        gapDurationMs = plan.timelineSubtitles.durationMs - previousGapEdge;
    } else {
        gapDurationMs = nextGapEdge - previousGapEdge + 1;
    }
    return gapDurationMs + timestampComparisonToleranceMs >= plan.fastForward.minimumSkipIntervalMs;
};

const playbackTimelineRepeatActionComparators: FieldComparators<PlaybackTimelineRepeatAction> = {
    count: (left, right) => left === right,
    repeatsBeforeShowingSubtitles: (left, right) => left === right,
};

function arePlaybackTimelineRepeatActionsEqual(
    left: PlaybackTimelineRepeatAction | undefined,
    right: PlaybackTimelineRepeatAction | undefined
): boolean {
    return fieldsEqual(left, right, playbackTimelineRepeatActionComparators);
}

const playbackTimelineEndActionComparators: FieldComparators<PlaybackTimelineEndAction> = {
    pause: (left, right) => left === right,
    repeat: (left, right) => arePlaybackTimelineRepeatActionsEqual(left, right),
};

function arePlaybackTimelineEndActionsEqual(
    left: PlaybackTimelineEndAction | undefined,
    right: PlaybackTimelineEndAction | undefined
): boolean {
    return fieldsEqual(left, right, playbackTimelineEndActionComparators);
}

const playbackTimelineAdaptiveRateComparators: FieldComparators<PlaybackTimelineAdaptiveRate> = {
    playbackRate: (left, right) => left === right,
    fraction: (left, right) => left === right,
    comprehensionControlled: (left, right) => left === right,
};

const playbackTimelineBlockComparators: FieldComparators<PlaybackTimelineBlock> = {
    id: (left, right) => left === right,
    subtitleIndexes: (left, right) => arrayEquals(left, right),
    playbackModeStartMs: (left, right) => left === right,
    playbackModeEndMs: (left, right) => left === right,
    playbackModeEndExclusiveMs: (left, right) => left === right,
    subtitleTriggerGapEndOffsetMs: (left, right) => left === right,
    subtitleTriggerGapStartOffsetMs: (left, right) => left === right,
    startAction: (left, right) => left === right,
    adaptiveRate: (left, right) => fieldsEqual(left, right, playbackTimelineAdaptiveRateComparators),
    autoPauseToken: (left, right) =>
        left?.subtitleIndex === right?.subtitleIndex && left?.tokenStart === right?.tokenStart,
    autoPauseEndToken: (left, right) =>
        left?.subtitleIndex === right?.subtitleIndex && left?.tokenStart === right?.tokenStart,
    endAction: (left, right) => arePlaybackTimelineEndActionsEqual(left, right),
};

function arePlaybackTimelineBlocksEqual(left: PlaybackTimelineBlock, right: PlaybackTimelineBlock): boolean {
    return fieldsEqual(left, right, playbackTimelineBlockComparators);
}

const playbackPlanCondensedComparators: FieldComparators<PlaybackPlanCondensed> = {
    minimumSkipIntervalMs: (left, right) => left === right,
    pauseAtStart: (left, right) => left === right,
};

function arePlaybackPlanCondensedEqual(
    left: PlaybackPlanCondensed | undefined,
    right: PlaybackPlanCondensed | undefined
): boolean {
    return fieldsEqual(left, right, playbackPlanCondensedComparators);
}

export function playbackPlanAutoPauseResumesEqual(
    left: PlaybackPlanAutoPauseResume | undefined,
    right: PlaybackPlanAutoPauseResume | undefined
): boolean {
    if (left === right) return true;
    if (left === undefined || right === undefined) return false;
    if (left.mode !== right.mode) return false;
    switch (left.mode) {
        case AutoPauseResumeMode.fixed:
            return (
                right.mode === AutoPauseResumeMode.fixed &&
                left.fixedDurationMs === right.fixedDurationMs &&
                left.delayMs === right.delayMs
            );
        case AutoPauseResumeMode.subtitleLength:
            return (
                right.mode === AutoPauseResumeMode.subtitleLength &&
                left.minimumDurationMs === right.minimumDurationMs &&
                left.maximumDurationMs === right.maximumDurationMs &&
                left.timePerCharacterMs === right.timePerCharacterMs &&
                left.delayMs === right.delayMs
            );
        default:
            return true;
    }
}

function arePlaybackPlanAutoPausesEqual(
    left: PlaybackPlanAutoPause | undefined,
    right: PlaybackPlanAutoPause | undefined
): boolean {
    if (left === right) return true;
    if (left === undefined || right === undefined) return false;
    return playbackPlanAutoPauseResumesEqual(left.resume, right.resume);
}

const playbackPlanFastForwardComparators: FieldComparators<PlaybackPlanFastForward> = {
    playbackRate: (left, right) => left === right,
    minimumSkipIntervalMs: (left, right) => left === right,
};

function arePlaybackPlanFastForwardsEqual(
    left: PlaybackPlanFastForward | undefined,
    right: PlaybackPlanFastForward | undefined
): boolean {
    return fieldsEqual(left, right, playbackPlanFastForwardComparators);
}

const playbackTimelineSubtitlesComparators: FieldComparators<PlaybackTimelineSubtitles<IndexedSubtitleModel>> = {
    durationMs: (left, right) => left === right,
    blocks: (left, right) => arrayEquals(left, right, arePlaybackTimelineBlocksEqual),
    actionBlocks: (left, right) => arrayEquals(left, right, arePlaybackTimelineBlocksEqual),
    condensedBlocks: (left, right) => arrayEquals(left, right, arePlaybackTimelineBlocksEqual),
    hiddenSubtitleIndexes: (left, right) => arrayEquals(left, right),
    displaySubtitles: (left, right) => arrayEquals(left, right, areSubtitleModelsEqual),
};

function arePlaybackTimelineSubtitlesEqual(
    left: PlaybackTimelineSubtitles<IndexedSubtitleModel>,
    right: PlaybackTimelineSubtitles<IndexedSubtitleModel>
): boolean {
    return fieldsEqual(left, right, playbackTimelineSubtitlesComparators);
}

const playbackPlanComparators: FieldComparators<PlaybackPlan<IndexedSubtitleModel>> = {
    timelineSubtitles: (left, right) => arePlaybackTimelineSubtitlesEqual(left, right),
    playbackRate: (left, right) => left === right,
    condensed: (left, right) => arePlaybackPlanCondensedEqual(left, right),
    fastForward: (left, right) => arePlaybackPlanFastForwardsEqual(left, right),
    autoPause: (left, right) => arePlaybackPlanAutoPausesEqual(left, right),
    subtitleVisibility: (left, right) => left === right,
};

export const playbackPlansEqual = <T extends IndexedSubtitleModel>(
    left: PlaybackPlan<T>,
    right: PlaybackPlan<T>
): boolean => fieldsEqual(left, right, playbackPlanComparators);
