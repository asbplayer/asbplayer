import { minimumPlaybackRate, maximumPlaybackRate } from '@project/common/util';
import { gzipSync, Gunzip } from 'fflate';
import { asbTrace } from '@project/common/util/log';
import {
    dictionaryPlaybackFeatures,
    defaultDictionaryTracks,
    NUM_DICTIONARY_TRACKS,
    NUM_TOKEN_STATUSES,
    NUM_TOKEN_STATES,
    minimumWholeSubtitleMatchThreshold,
    maximumWholeSubtitleMatchThreshold,
} from '@project/common/settings/settings-dictionary';
import type { DictionaryPlaybackConfig } from '@project/common/settings/settings-dictionary';
import { AutoPauseResumeMode, PauseOnHoverMode, SubtitleVisibility } from '@project/common/settings/settings';
import type { AsbplayerSettings } from '@project/common/settings/settings';
import type { RecipeShortcut } from '@project/common/key-binder';

import { AutoPausePreference, PlayMode } from '@project/common/src/model';

export const maximumRecipeNameLength = 100;
const maximumRecipeImportHashLength = 16 * 1024;
const maximumRecipeImportJsonLength = 64 * 1024;

export const recipeSettingGroups = {
    playback: ['seekableTracks', 'pauseOnHoverMode', 'playbackRate'],
    subtitleTriggers: [
        'autoPausePreference',
        'subtitleTriggerStartOffset',
        'subtitleTriggerEndOffset',
        'subtitleTriggerGapStartOffset',
        'subtitleTriggerGapEndOffset',
    ],
    autoPauseResumeMode: [
        'autoPauseResumeMode',
        'autoPauseResumeDelayMs',
        'autoPauseFixedDurationMs',
        'autoPauseMinimumDurationMs',
        'autoPauseMaximumDurationMs',
        'autoPauseTimePerCharacterMs',
    ],
    subtitleVisibility: ['subtitleVisibility'],
    repeat: ['repeatCountPreference', 'repeatsBeforeShowingSubtitles'],
    fastForward: ['fastForwardModePlaybackRate', 'fastForwardPlaybackMinimumSkipIntervalMs'],
    condensed: ['streamingCondensedPlaybackMinimumSkipIntervalMs'],
} as const satisfies Record<string, readonly (keyof AsbplayerSettings)[]>;

export const recipeSettingKeys = Object.values(recipeSettingGroups).flat();
export type RecipeSettingKey = (typeof recipeSettingKeys)[number];
export type RecipePartial<T> = T extends (infer Item)[]
    ? RecipePartial<Item>[]
    : T extends object
      ? { [K in keyof T]?: RecipePartial<T[K]> }
      : T;

export type RecipeSettings = Partial<Pick<AsbplayerSettings, RecipeSettingKey>> & {
    readonly dictionaryTracks?: { readonly dictionaryPlaybackConfig?: RecipePartial<DictionaryPlaybackConfig> }[]; // Regular annotation settings may be added in future
};

export interface Recipe {
    readonly name: string;
    readonly playbackModes: PlayMode[];
    readonly settings: RecipeSettings;
}

const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: unknown) => finite(value) && value >= 0;
const integer = (value: unknown) => nonnegative(value) && Number.isSafeInteger(value);
const rates = (value: unknown) => finite(value) && value >= minimumPlaybackRate && value <= maximumPlaybackRate;
const enumeration = (values: readonly unknown[]) => (value: unknown) => values.includes(value);
const validators: Record<RecipeSettingKey, (value: unknown) => boolean> = {
    seekableTracks: (v) => integer(v) && (v as number) <= 2 ** NUM_DICTIONARY_TRACKS - 1,
    pauseOnHoverMode: enumeration(Object.values(PauseOnHoverMode).filter(finite)),
    playbackRate: rates,
    autoPausePreference: enumeration(Object.values(AutoPausePreference).filter(finite)),
    subtitleTriggerStartOffset: finite,
    subtitleTriggerEndOffset: finite,
    subtitleTriggerGapStartOffset: finite,
    subtitleTriggerGapEndOffset: finite,
    autoPauseResumeMode: enumeration(Object.values(AutoPauseResumeMode)),
    autoPauseResumeDelayMs: nonnegative,
    autoPauseFixedDurationMs: nonnegative,
    autoPauseMinimumDurationMs: nonnegative,
    autoPauseMaximumDurationMs: nonnegative,
    autoPauseTimePerCharacterMs: nonnegative,
    subtitleVisibility: enumeration(Object.values(SubtitleVisibility)),
    repeatCountPreference: integer,
    repeatsBeforeShowingSubtitles: integer,
    fastForwardModePlaybackRate: rates,
    fastForwardPlaybackMinimumSkipIntervalMs: nonnegative,
    streamingCondensedPlaybackMinimumSkipIntervalMs: nonnegative,
};

const dictionaryConfig = (value: unknown): RecipePartial<DictionaryPlaybackConfig> | undefined => {
    if (!record(value)) return;
    const result: Record<string, unknown> = {};
    for (const feature of dictionaryPlaybackFeatures) {
        const input = value[feature];
        if (!record(input)) continue;
        const output: Record<string, unknown> = {};
        if (record(input.rules)) {
            const rules = Object.fromEntries(
                Object.keys(defaultDictionaryTracks[0].dictionaryPlaybackConfig[feature].rules)
                    .filter((key) => integer((input.rules as Record<string, unknown>)[key]))
                    .map((key) => [key, (input.rules as Record<string, unknown>)[key]])
            );
            for (const [min, max] of [
                ['minWords', 'maxWords'],
                ['minFrequency', 'maxFrequency'],
            ]) {
                if (
                    typeof rules[min] === 'number' &&
                    typeof rules[max] === 'number' &&
                    rules[max] !== 0 &&
                    rules[min] > rules[max]
                ) {
                    delete rules[max];
                }
            }
            if (Object.keys(rules).length) output.rules = rules;
        }
        for (const [key, length] of [
            ['onStatuses', NUM_TOKEN_STATUSES],
            ['onStates', NUM_TOKEN_STATES],
        ] as const) {
            if (Array.isArray(input[key])) {
                output[key] = input[key]
                    .slice(0, length)
                    .map((trigger) =>
                        record(trigger) && typeof trigger.enabled === 'boolean' ? { enabled: trigger.enabled } : {}
                    );
            }
        }
        if (
            feature === 'fastForward' &&
            record(input.rateByComprehension) &&
            typeof input.rateByComprehension.enabled === 'boolean'
        ) {
            output.rateByComprehension = { enabled: input.rateByComprehension.enabled };
        }
        if (feature === 'wordVisibility') {
            if (typeof input.hideWordsIndividuallyUntilThreshold === 'boolean') {
                output.hideWordsIndividuallyUntilThreshold = input.hideWordsIndividuallyUntilThreshold;
            }
            if (
                finite(input.wholeSubtitleMatchThreshold) &&
                input.wholeSubtitleMatchThreshold >= minimumWholeSubtitleMatchThreshold &&
                input.wholeSubtitleMatchThreshold <= maximumWholeSubtitleMatchThreshold
            ) {
                output.wholeSubtitleMatchThreshold = input.wholeSubtitleMatchThreshold;
            }
        }
        if (Object.keys(output).length) result[feature] = output;
    }
    return Object.keys(result).length ? result : undefined;
};

/** Treat recipes as untrusted input, including recipes edited directly in storage. */
export const normalizeRecipe = (value: unknown): Recipe | undefined => {
    if (
        !record(value) ||
        typeof value.name !== 'string' ||
        !record(value.settings) ||
        !Array.isArray(value.playbackModes)
    ) {
        return;
    }
    const name = value.name.trim();
    if (!name || name.length > maximumRecipeNameLength) return;
    const modes = [
        ...new Set(
            value.playbackModes.filter((mode): mode is PlayMode =>
                Object.values(PlayMode).filter(finite).includes(mode)
            )
        ),
    ];
    if (!modes.length) return;
    const settings: Record<string, unknown> = {};
    for (const key of recipeSettingKeys) {
        if (validators[key](value.settings[key])) settings[key] = value.settings[key];
    }
    if (Array.isArray(value.settings.dictionaryTracks)) {
        const tracks = value.settings.dictionaryTracks.slice(0, NUM_DICTIONARY_TRACKS).map((track) => {
            const config = record(track) ? dictionaryConfig(track.dictionaryPlaybackConfig) : undefined;
            return config ? { dictionaryPlaybackConfig: config } : {};
        });
        if (tracks.some((track) => track.dictionaryPlaybackConfig)) settings.dictionaryTracks = tracks;
    }
    if (
        finite(settings.autoPauseMinimumDurationMs) &&
        finite(settings.autoPauseMaximumDurationMs) &&
        settings.autoPauseMaximumDurationMs !== 0 &&
        settings.autoPauseMaximumDurationMs < settings.autoPauseMinimumDurationMs
    ) {
        delete settings.autoPauseMaximumDurationMs;
    }
    if (
        finite(settings.repeatCountPreference) &&
        settings.repeatCountPreference !== 0 &&
        finite(settings.repeatsBeforeShowingSubtitles) &&
        settings.repeatsBeforeShowingSubtitles > settings.repeatCountPreference
    ) {
        delete settings.repeatsBeforeShowingSubtitles;
    }
    if (Object.keys(settings).length === 0) return;
    return {
        name,
        playbackModes: modes.length > 1 ? modes.filter((mode) => mode !== PlayMode.normal) : modes,
        settings,
    };
};

/** Preserve selection by original index when invalid recipes are removed. */
export const ensureRecipeConsistency = (settings: Partial<AsbplayerSettings>): void => {
    if (settings.recipes === undefined) return;
    const recipes: Recipe[] = [];
    let activeRecipeId: number | null = null;
    if (Array.isArray(settings.recipes)) {
        settings.recipes.forEach((input, index) => {
            const recipe = normalizeRecipe(input);
            if (!recipe) return;
            if (settings.activeRecipeId === index) activeRecipeId = recipes.length;
            recipes.push(recipe);
        });
    }
    const recipesChanged = JSON.stringify(recipes) !== JSON.stringify(settings.recipes);
    if (recipesChanged || (settings.activeRecipeId !== undefined && settings.activeRecipeId !== activeRecipeId)) {
        asbTrace('settings/recipe', 'Normalized stored recipes', {
            previousRecipeCount: Array.isArray(settings.recipes) ? settings.recipes.length : 0,
            recipeCount: recipes.length,
            recipesChanged,
            previousRecipeId: settings.activeRecipeId,
            ...(settings.activeRecipeId !== undefined ? { activeRecipeId } : {}),
        });
    }
    Object.assign(settings, {
        recipes: recipesChanged ? recipes : settings.recipes,
        ...(settings.activeRecipeId !== undefined ? { activeRecipeId } : {}),
    });
};

export const activeRecipe = (settings: Pick<AsbplayerSettings, 'recipes' | 'activeRecipeId'>): Recipe | undefined =>
    settings.activeRecipeId === null ? undefined : settings.recipes[settings.activeRecipeId];

const mergePartial = (base: unknown, override: unknown): unknown => {
    if (Array.isArray(base) && Array.isArray(override)) {
        return base.map((item, index) => mergePartial(item, override[index]));
    }
    if (record(base) && record(override)) {
        return Object.fromEntries(
            Object.entries(base).map(([key, value]) => [key, mergePartial(value, override[key])])
        );
    }
    return override === undefined ? base : override;
};

export const settingsWithRecipe = (base: AsbplayerSettings, recipe: Recipe | undefined): AsbplayerSettings => {
    if (!recipe) return base;
    const { dictionaryTracks, ...settings } = recipe.settings;
    return {
        ...base,
        ...settings,
        dictionaryTracks: dictionaryTracks
            ? base.dictionaryTracks.map((track, index) => ({
                  ...track,
                  dictionaryPlaybackConfig: mergePartial(
                      track.dictionaryPlaybackConfig,
                      dictionaryTracks[index]?.dictionaryPlaybackConfig
                  ) as DictionaryPlaybackConfig,
              }))
            : base.dictionaryTracks,
    };
};

export const effectiveSettings = (settings: AsbplayerSettings): AsbplayerSettings =>
    settingsWithRecipe(settings, activeRecipe(settings));

const changedPartial = (before: unknown, after: unknown): unknown => {
    if (JSON.stringify(before) === JSON.stringify(after)) return undefined;
    if (Array.isArray(before) && Array.isArray(after)) {
        return after.map((value, index) => changedPartial(before[index], value) ?? {});
    }
    if (record(before) && record(after)) {
        return Object.fromEntries(
            Object.entries(after)
                .map(([key, value]) => [key, changedPartial(before[key], value)])
                .filter(([, value]) => value !== undefined)
        );
    }
    return after;
};

const mergeDraft = (base: unknown, changes: unknown): unknown => {
    if (Array.isArray(changes)) {
        return changes.map((value, index) => mergeDraft(Array.isArray(base) ? base[index] : {}, value));
    }
    if (record(changes)) {
        return Object.fromEntries(
            Object.entries({ ...(record(base) ? base : {}), ...changes }).map(([key, value]) => [
                key,
                key in changes ? mergeDraft(record(base) ? base[key] : undefined, value) : value,
            ])
        );
    }
    return changes;
};

/** Include only fields actually edited, so inherited dictionary values remain inherited. */
export const updateRecipeDraft = (
    draft: Recipe,
    rendered: AsbplayerSettings,
    update: Partial<AsbplayerSettings>
): Recipe => {
    const changes: Record<string, unknown> = Object.fromEntries(
        Object.entries(update).filter(([key]) => recipeSettingKeys.includes(key as RecipeSettingKey))
    );
    if (update.dictionaryTracks) {
        const difference = changedPartial(
            rendered.dictionaryTracks.map((track) => ({ dictionaryPlaybackConfig: track.dictionaryPlaybackConfig })),
            update.dictionaryTracks.map((track) => ({ dictionaryPlaybackConfig: track.dictionaryPlaybackConfig }))
        );
        if (difference !== undefined) changes.dictionaryTracks = difference;
    }
    return { ...draft, settings: mergeDraft(draft.settings, changes) as RecipeSettings };
};

export const recipeFromSettings = (settings: AsbplayerSettings): Recipe => ({
    name: '',
    playbackModes: settings.rememberPlaybackModes ? [...settings.lastPlaybackModes] : [PlayMode.normal],
    settings: {
        ...Object.fromEntries(recipeSettingKeys.map((key) => [key, settings[key]])),
        dictionaryTracks: settings.dictionaryTracks.map((track) => ({
            dictionaryPlaybackConfig: structuredClone(track.dictionaryPlaybackConfig),
        })),
    },
});

export const moveRecipe = (
    settings: Pick<AsbplayerSettings, 'recipes' | 'activeRecipeId'>,
    from: number,
    to: number
) => {
    if (
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from < 0 ||
        to < 0 ||
        from >= settings.recipes.length ||
        to >= settings.recipes.length
    ) {
        return settings;
    }
    const order = settings.recipes.map((_, index) => index);
    order.splice(to, 0, order.splice(from, 1)[0]);
    return {
        recipes: order.map((index) => settings.recipes[index]),
        activeRecipeId: settings.activeRecipeId === null ? null : order.indexOf(settings.activeRecipeId),
    };
};

export const deleteRecipe = (settings: Pick<AsbplayerSettings, 'recipes' | 'activeRecipeId'>, index: number) => {
    if (!Number.isInteger(index) || index < 0 || index >= settings.recipes.length) return settings;
    return {
        recipes: settings.recipes.filter((_, i) => i !== index),
        activeRecipeId:
            settings.activeRecipeId === null || settings.activeRecipeId === index
                ? null
                : settings.activeRecipeId > index
                  ? settings.activeRecipeId - 1
                  : settings.activeRecipeId,
    };
};

export const cycleRecipeId = (
    settings: Pick<AsbplayerSettings, 'recipes' | 'activeRecipeId'>,
    forward: boolean
): number | null => {
    const size = settings.recipes.length + 1;
    const current = settings.activeRecipeId === null ? 0 : settings.activeRecipeId + 1;
    const next = (current + (forward ? 1 : -1) + size) % size;
    return next === 0 ? null : next - 1;
};

/** Undefined means that a shortcut requested a recipe that is unavailable. */
export const recipeIdForShortcut = (
    settings: Pick<AsbplayerSettings, 'recipes' | 'activeRecipeId'>,
    action: RecipeShortcut
): number | null | undefined => {
    const activeRecipeId =
        action === 'clear'
            ? null
            : typeof action === 'number'
              ? action
              : cycleRecipeId(settings, action === 'cycleForward');
    if (activeRecipeId !== null && !settings.recipes[activeRecipeId]) {
        asbTrace('playback/recipe', 'Recipe shortcut ignored', {
            action,
            previousRecipeId: settings.activeRecipeId,
            activeRecipeId,
            reason: 'recipe-unavailable',
        });
        return;
    }
    return activeRecipeId;
};

/** Keep sorted JSON, compression options, base64url encoding, and fragment format in sync with docs/src/components/RecipePreset.tsx. */
export const recipeImportUrl = (recipe: Recipe): string => {
    const json = JSON.stringify(recipe, (_key, value: unknown) =>
        record(value)
            ? Object.fromEntries(
                  Object.keys(value)
                      .sort()
                      .map((key) => [key, value[key]])
              )
            : value
    );
    const compressed = gzipSync(new TextEncoder().encode(json), { mtime: 0, level: 6 });
    const payload = btoa(String.fromCharCode(...compressed))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    const url = new URL('https://app.asbplayer.dev/');
    url.searchParams.set('view', 'settings');
    url.hash = `playback?recipe=${payload}`;
    return url.toString();
};

export const recipeFromImportUrl = (url: URL): Recipe | undefined => {
    if (url.hash.length > maximumRecipeImportHashLength) return;
    const payload = new URLSearchParams(url.hash.split('?')[1]).get('recipe');
    if (payload === null || !/^[A-Za-z0-9_-]+$/.test(payload)) return;
    try {
        const compressed = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (char) =>
            char.charCodeAt(0)
        );
        if (compressed.length < 18) return;
        const declaredLength = new DataView(
            compressed.buffer,
            compressed.byteOffset + compressed.length - 4,
            4
        ).getUint32(0, true);
        if (declaredLength > maximumRecipeImportJsonLength) return;
        let length = 0;
        let json = '';
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const gunzip = new Gunzip((chunk) => {
            length += chunk.length;
            if (length > maximumRecipeImportJsonLength) throw new Error('Recipe import exceeds size limit');
            json += decoder.decode(chunk, { stream: true });
        });
        const chunkSize = 128; // Small input chunks bound temporary allocations; count actual output instead of trusting the gzip footer.
        for (let offset = 0; offset < compressed.length; offset += chunkSize) {
            gunzip.push(compressed.subarray(offset, offset + chunkSize), offset + chunkSize >= compressed.length);
        }
        if (length !== declaredLength) return;
        json += decoder.decode();
        return normalizeRecipe(JSON.parse(json));
    } catch {
        return undefined;
    }
};
