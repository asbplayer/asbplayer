import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PlayMode } from '@project/common';
import type { Recipe } from '@project/common/settings';
import PlaybackModeButton from '@project/common/components/PlaybackModeButton';
import PlaybackModeSelector from '@project/common/components/PlaybackModeSelector';

const translations = JSON.parse(readFileSync(join(__dirname, '../locales/en.json'), 'utf8'));
const recipes: readonly Recipe[] = [
    { name: 'Reading', playbackModes: [PlayMode.autoPause], settings: {} },
    { name: 'Listening', playbackModes: [PlayMode.condensed, PlayMode.repeat], settings: {} },
];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('playback menu recipes', () => {
    let container: HTMLDivElement;
    let root: Root;
    let recipeChanges: (number | null)[];
    let modeChanges: PlayMode[];

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        recipeChanges = [];
        modeChanges = [];
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    const renderMenu = async ({
        availableRecipes = recipes,
        initialRecipeId = null,
        playModesEnabled = true,
        horizontal = false,
    }: {
        availableRecipes?: readonly Recipe[];
        initialRecipeId?: number | null;
        playModesEnabled?: boolean;
        horizontal?: boolean;
    } = {}) => {
        const i18n = createInstance();
        await i18n.init({
            lng: 'en',
            resources: { en: { translation: translations } },
            interpolation: { escapeValue: false },
        });

        function Menu() {
            const [activeRecipeId, setActiveRecipeId] = useState(initialRecipeId);
            const activeRecipe = activeRecipeId == null ? undefined : availableRecipes[activeRecipeId];
            return (
                <PlaybackModeSelector
                    selectedPlayModes={new Set(activeRecipe?.playbackModes ?? [PlayMode.normal])}
                    onPlayMode={(mode) => modeChanges.push(mode)}
                    keepManualSelectorOpen
                    selectorProps={{
                        recipes: availableRecipes,
                        activeRecipeId,
                        onRecipeSelect: (index) => {
                            recipeChanges.push(index);
                            setActiveRecipeId(index);
                        },
                        playModesEnabled,
                        listStyle: { flexDirection: horizontal ? 'row' : 'column' },
                    }}
                    renderButton={({ anchorRef, open, onClick }) => (
                        <PlaybackModeButton
                            ref={anchorRef}
                            recipes={availableRecipes}
                            activeRecipeId={activeRecipeId}
                            onClick={onClick}
                            aria-expanded={open}
                            tooltipProps={{ disabled: true }}
                        />
                    )}
                />
            );
        }

        await act(async () => {
            root.render(
                <I18nextProvider i18n={i18n}>
                    <Menu />
                </I18nextProvider>
            );
        });
        // jsdom has no layout; provide a visible popover anchor as in a browser.
        button().getBoundingClientRect = () => ({
            x: 20,
            y: 500,
            top: 500,
            left: 20,
            bottom: 540,
            right: 60,
            width: 40,
            height: 40,
            toJSON() {},
        });
        await act(async () => button().click());
    };

    const button = () => container.querySelector('button')!;
    const input = (label: string) => document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    const choose = async (label: string) => {
        await act(async () => input(label).closest<HTMLElement>('[role="button"]')!.click());
    };

    it('selects and switches recipes, then restores manual mode controls when disabled', async () => {
        await renderMenu();
        expect(input('Disabled').checked).toBe(true);
        expect(input('Normal').disabled).toBe(false);

        await choose('2. Listening');
        expect(recipeChanges).toEqual([1]);
        expect(input('2. Listening').checked).toBe(true);
        expect(input('1. Reading').checked).toBe(false);
        expect(input('Condensed').checked).toBe(true);
        expect(input('Repeat').checked).toBe(true);
        expect(input('Normal').disabled).toBe(true);
        expect(button().getAttribute('aria-label')).toContain('Recipe: Listening');
        expect(button().textContent).toBe('2');
        expect(document.body.textContent).toContain("Playback Modes can't be changed while a Recipe is active");

        await choose('Normal');
        expect(modeChanges).toEqual([]);

        await choose('1. Reading');
        expect(recipeChanges).toEqual([1, 0]);
        expect(button().textContent).toBe('1');
        expect(input('Auto-pause').checked).toBe(true);

        await choose('Disabled');
        expect(recipeChanges).toEqual([1, 0, null]);
        expect(input('Normal').disabled).toBe(false);
        expect(button().getAttribute('aria-label')).toBe('Playback Mode');
        expect(button().textContent).toBe('');
        await choose('Repeat');
        expect(modeChanges).toEqual([PlayMode.repeat]);
    });

    it('preserves manual mode selection when no recipes are available', async () => {
        await renderMenu({ availableRecipes: [] });
        expect(document.querySelector('[aria-label="Recipe"]')).toBeNull();
        expect(input('Normal').checked).toBe(true);
        await choose('Condensed');
        expect(modeChanges).toEqual([PlayMode.condensed]);
    });

    it('treats an unavailable recipe as disabled and allows a valid selection', async () => {
        await renderMenu({ initialRecipeId: 20 });
        expect(input('Disabled').checked).toBe(true);
        expect(input('Normal').disabled).toBe(false);
        expect(button().getAttribute('aria-label')).toBe('Playback Mode');
        await choose('1. Reading');
        expect(recipeChanges).toEqual([0]);
        expect(input('Normal').disabled).toBe(true);
    });

    it('allows keyboard recipe selection in the horizontal menu without subtitle modes', async () => {
        await renderMenu({ availableRecipes: [recipes[0]], playModesEnabled: false, horizontal: true });
        expect(document.querySelector('input[type="checkbox"]')).toBeNull();
        const readingButton = input('1. Reading').closest<HTMLElement>('[role="button"]')!;
        await act(async () => {
            readingButton.focus();
            readingButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        expect(recipeChanges).toEqual([0]);
        expect(input('1. Reading').checked).toBe(true);
        expect(button().getAttribute('aria-label')).toContain('Recipe: Reading');
    });
});
