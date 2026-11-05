import { useEffect } from 'react';
import type { KeyBinder } from '@project/common/key-binder';
import type { SubtitleModel } from '@project/common';
import { recipeIdForShortcut } from '@project/common/settings';
import type { AsbplayerSettings } from '@project/common/settings';
import { asbTrace } from '@project/common/util/log';

export const useRecipeKeyBindings = (
    keyBinder: KeyBinder,
    settings: Pick<AsbplayerSettings, 'recipes' | 'activeRecipeId'>,
    onChange: (settings: Partial<AsbplayerSettings>) => void,
    disabled: boolean,
    subtitles: readonly SubtitleModel[]
) => {
    useEffect(
        () =>
            keyBinder.bindRecipes(
                (event, action) => {
                    event.preventDefault();
                    const activeRecipeId = recipeIdForShortcut(settings, action);
                    if (activeRecipeId === undefined) return;
                    asbTrace('playback/recipe', 'Recipe shortcut requested', {
                        action,
                        previousRecipeId: settings.activeRecipeId,
                        activeRecipeId,
                    });
                    onChange({ activeRecipeId });
                },
                () => disabled,
                () => subtitles
            ),
        [keyBinder, settings, onChange, disabled, subtitles]
    );
};
