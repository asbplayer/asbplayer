import React, { useMemo } from 'react';
import { gzipSync } from 'fflate';

interface Recipe {
  name: string;
  playbackModes: number[];
  settings: Record<string, unknown>;
}

interface Props {
  recipe: Recipe;
  gapVariants?: boolean;
}

export const gapFastForwardRecipe = {
  name: 'Gap fast-forward',
  playbackModes: [4],
  settings: {
    fastForwardModePlaybackRate: 3,
    fastForwardPlaybackMinimumSkipIntervalMs: 1000,
    subtitleTriggerGapStartOffset: 150,
    subtitleTriggerGapEndOffset: -150,
  },
};

export const dialogueFocusRecipe = {
  name: 'Dialogue focus',
  playbackModes: [2, 4],
  settings: {
    ...gapFastForwardRecipe.settings,
    streamingCondensedPlaybackMinimumSkipIntervalMs: 5000,
  },
};

const gapRecipeVariants = [dialogueFocusRecipe, gapFastForwardRecipe];

const recipeWithGapVariant = (recipe: Recipe, variant: (typeof gapRecipeVariants)[number]): Recipe => ({
  ...recipe,
  name: `${recipe.name} + ${variant.name}`,
  playbackModes: [...new Set([...recipe.playbackModes.filter((mode) => mode !== 1), ...variant.playbackModes])],
  settings: { ...variant.settings, ...recipe.settings },
});

// Keep sorted JSON, compression options, base64url encoding, and fragment format in sync with recipeImportUrl() in common/settings/settings-recipes.ts.
const serializeRecipe = (recipe: Recipe): string =>
  JSON.stringify(recipe, (_key, value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, (value as Record<string, unknown>)[key]])
        )
      : value
  );

const recipeImportUrl = (json: string): string => {
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

function RecipePresetOption({ recipe, importLabel = 'Import' }: { recipe: Recipe; importLabel?: string }) {
  const json = serializeRecipe(recipe);
  const importUrl = useMemo(() => recipeImportUrl(json), [json]);

  return (
    <a className="button button--primary" href={importUrl} target="_blank" rel="noreferrer">
      {importLabel}
    </a>
  );
}

/** Recipe import buttons, with optional gap variants derived from the same recipe. */
export default function RecipePreset({ recipe, gapVariants = false }: Props) {
  return (
    <>
      <RecipePresetOption recipe={recipe} />
      {gapVariants &&
        gapRecipeVariants.map((variant) => (
          <div key={variant.name} className="margin-top--sm">
            <RecipePresetOption
              recipe={recipeWithGapVariant(recipe, variant)}
              importLabel={`Import with ${variant.name}`}
            />
          </div>
        ))}
    </>
  );
}
