import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import RecipeSettings from '@project/common/components/RecipeSettings';
import PlaybackSettingsTab from '@project/common/components/PlaybackSettingsTab';
import { defaultSettings, recipeImportUrl } from '@project/common/settings';
import type { AsbplayerSettings, Recipe } from '@project/common/settings';
import { PlayMode } from '@project/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TextEncoder, TextDecoder } from 'util';

const translations = JSON.parse(readFileSync(join(__dirname, '../locales/en.json'), 'utf8'));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom lacks this browser API; recipes contain only JSON data.
const originalClone = globalThis.structuredClone;
const originalEncoder = globalThis.TextEncoder;
const originalDecoder = globalThis.TextDecoder;
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

describe('recipe editor', () => {
    let container: HTMLDivElement;
    let root: Root;
    let saves: Partial<AsbplayerSettings>[];
    let copied: string[];
    let navigation: string[];
    const recipe: Recipe = { name: 'Reading', playbackModes: [PlayMode.autoPause], settings: { playbackRate: 0.8 } };

    beforeEach(() => {
        globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
        globalThis.TextEncoder = TextEncoder;
        globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
        window.history.replaceState({}, '', '/');
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        saves = [];
        copied = [];
        navigation = [];
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: async (text: string) => {
                    copied.push(text);
                },
            },
        });
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        globalThis.structuredClone = originalClone;
        globalThis.TextEncoder = originalEncoder;
        globalThis.TextDecoder = originalDecoder;
        if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
        else Reflect.deleteProperty(navigator, 'clipboard');
        window.history.replaceState({}, '', '/');
    });

    const renderEditor = async (
        initial: AsbplayerSettings = { ...defaultSettings, recipes: [recipe], activeRecipeId: 0 },
        strictMode = false,
        withPlaybackFields = false
    ) => {
        const i18n = createInstance();
        await i18n.init({
            lng: 'en',
            resources: { en: { translation: translations } },
            interpolation: { escapeValue: false },
        });
        function Editor() {
            const [settings, setSettings] = useState(initial);
            const [track, setTrack] = useState(0);
            const onSettingsChanged = (change: Partial<AsbplayerSettings>) => {
                saves.push(change);
                setSettings((previous) => ({ ...previous, ...change }));
            };
            if (withPlaybackFields) {
                return (
                    <PlaybackSettingsTab
                        settings={settings}
                        onSettingsChanged={onSettingsChanged}
                        onSettingChanged={async (key, value) => onSettingsChanged({ [key]: value })}
                        supportsPlaybackEngine
                        supportsAutoPauseResume
                        supportsDictionaryPlayback
                        selectedDictionaryTrack={track}
                        onSelectedDictionaryTrackChanged={setTrack}
                        onViewPlaybackModeKeyboardShortcuts={() => navigation.push('modes')}
                        onViewPlaybackRateKeyboardShortcuts={() => navigation.push('rate')}
                        onViewSubtitleKeyboardShortcuts={() => navigation.push('subtitles')}
                        onAnnotationSettingsClick={() => navigation.push('annotation')}
                    />
                );
            }
            return (
                <RecipeSettings settings={settings} onSettingsChanged={onSettingsChanged}>
                    {(settings, onChange, modes, readOnly) => (
                        <>
                            <output data-testid="rate">{settings.playbackRate}</output>
                            <button disabled={readOnly} onClick={() => onChange({ playbackRate: 1.5 })}>
                                change rate
                            </button>
                            {modes}
                        </>
                    )}
                </RecipeSettings>
            );
        }
        const Wrapper = strictMode ? React.StrictMode : React.Fragment;
        await act(async () =>
            root.render(
                <Wrapper>
                    <I18nextProvider i18n={i18n}>
                        <ThemeProvider theme={createTheme()}>
                            <Editor />
                        </ThemeProvider>
                    </I18nextProvider>
                </Wrapper>
            )
        );
    };

    const click = async (text: string, scope: ParentNode = document) => {
        const button = [...scope.querySelectorAll('button')].find((element) => element.textContent === text);
        if (!button) throw new Error(`Missing button ${text}`);
        await act(async () => button.click());
    };
    const dialog = () => document.querySelector('[role="dialog"]')!;
    const openView = async () => {
        const selector = container.querySelector('[role="combobox"]')!;
        await act(async () => selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
        const preview = document.querySelector<HTMLButtonElement>('[aria-label="Preview"]')!;
        await act(async () => preview.click());
    };
    const setInput = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
        const prototype =
            element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        await act(async () => {
            Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
        });
    };

    it('always shows the introduction as helper text and adds the selected recipe restriction while read only', async () => {
        await renderEditor({ ...defaultSettings, recipes: [recipe], activeRecipeId: null });
        const helper = () => container.querySelector('.MuiFormHelperText-root')!;
        const introduction = 'Recipes combine playback modes and settings for different learning activities.';
        expect(helper().textContent).toContain(introduction);
        expect(helper().textContent).not.toContain(translations.recipes.readOnly);
        expect(container.querySelector('[role="alert"]')).toBeNull();
        expect(helper().querySelector('a')?.href).toBe('https://docs.asbplayer.dev/docs/guides/recipes');
        const selector = container.querySelector('[role="combobox"]')!;
        await act(async () => selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
        await act(async () => document.querySelector<HTMLElement>('[role="option"][data-value="0"]')!.click());
        expect(helper().textContent).toContain(introduction);

        expect(helper().textContent?.endsWith(` ${translations.recipes.readOnly}`)).toBe(true);
        await click('Edit Recipe');
        expect(helper().textContent).toContain(introduction);
        expect(helper().textContent).not.toContain(translations.recipes.readOnly);
    });

    it('renders the selected effective settings read only and isolates draft changes until cancellation', async () => {
        await renderEditor();
        expect((container.querySelector('output')?.nextElementSibling as HTMLButtonElement)?.disabled).toBe(true);
        expect(container.querySelector('output')?.textContent).toBe('0.8');
        await click('Edit Recipe');
        expect((container.querySelector('output')?.nextElementSibling as HTMLButtonElement)?.disabled).toBe(false);
        await click('change rate');
        expect(container.querySelector('output')?.textContent).toBe('1.5');
        expect(saves).toEqual([]);
        await click('Cancel', container);
        expect(container.querySelector('output')?.textContent).toBe('0.8');
        expect(saves).toEqual([]);
    });

    it('keeps active recipe settings readable and navigation usable while disabling edits', async () => {
        await renderEditor(undefined, false, true);
        expect(container.querySelector('[inert], [aria-hidden="true"] input[type="number"]')).toBeNull();
        const rate = container.querySelector<HTMLInputElement>('input[type="number"]')!;
        expect(rate.value).toBe('0.8');
        expect(rate.disabled).toBe(true);
        expect(
            [
                ...container.querySelectorAll<HTMLInputElement>(
                    'input[type="number"], input[type="radio"], input[type="checkbox"]'
                ),
            ].every((input) => input.disabled)
        ).toBe(true);
        const dictionary = container.querySelector('#dictionary-playback-settings')!;
        const selectors = [...dictionary.querySelectorAll<HTMLElement>('[role="combobox"]')];
        expect(selectors[0].getAttribute('aria-disabled')).not.toBe('true');
        expect(selectors.slice(1).every((select) => select.getAttribute('aria-disabled') === 'true')).toBe(true);

        await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Keyboard Shortcuts"]')!.click());
        await click('Annotation', dictionary);
        expect(navigation).toEqual(['subtitles', 'annotation']);
        await act(async () => selectors[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
        await act(async () => document.querySelector<HTMLElement>('[role="option"][data-value="1"]')!.click());
        expect(selectors[0].textContent).toContain('2');
        expect(saves).toEqual([]);

        await click('Edit Recipe');
        expect(rate.disabled).toBe(false);
        expect(selectors.slice(1).every((select) => select.getAttribute('aria-disabled') !== 'true')).toBe(true);
    });

    it('updates the selected recipe when its name is untouched and preserves omitted settings', async () => {
        await renderEditor();
        await click('Edit Recipe');
        await click('change rate');
        await click('Save Recipe');
        const name = dialog().querySelector('input')!;
        expect(name.value).toBe('Reading');
        expect(name.selectionStart).toBe(0);
        expect(name.selectionEnd).toBe('Reading'.length);
        await click('Save', dialog());
        expect(saves).toEqual([{ recipes: [{ ...recipe, settings: { playbackRate: 1.5 } }], activeRecipeId: 0 }]);
    });

    it('shows recipe playback modes read only and enables them only while editing a draft', async () => {
        const selected = { ...recipe, playbackModes: [PlayMode.autoPause, PlayMode.repeat] };
        await renderEditor({ ...defaultSettings, recipes: [selected], activeRecipeId: 0 });
        const checkboxes = () => [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
        const checkedLabels = () =>
            checkboxes()
                .filter((checkbox) => checkbox.checked)
                .map((checkbox) => checkbox.closest('label')?.textContent);
        expect(checkedLabels()).toEqual([translations.controls.autoPauseMode, translations.controls.repeatMode]);
        expect(checkboxes().every((checkbox) => checkbox.disabled)).toBe(true);
        await act(async () => checkboxes()[0].click());
        expect(checkedLabels()).toEqual([translations.controls.autoPauseMode, translations.controls.repeatMode]);
        expect(saves).toEqual([]);
        await click('Edit Recipe');
        expect(checkboxes().every((checkbox) => !checkbox.disabled)).toBe(true);
        await act(async () => checkboxes()[0].click());
        expect(checkedLabels()).toEqual([translations.controls.normalMode]);
        expect(saves).toEqual([]);
        await click('Cancel', container);
        expect(checkedLabels()).toEqual([translations.controls.autoPauseMode, translations.controls.repeatMode]);
        expect(checkboxes().every((checkbox) => checkbox.disabled)).toBe(true);
    });

    it('creates a new recipe after changing the name, even when changed back to the same name', async () => {
        await renderEditor();
        await click('Edit Recipe');
        await click('Save Recipe');
        const name = dialog().querySelector('input')!;
        await setInput(name, 'Listening');
        await setInput(name, 'Reading');
        await click('Save', dialog());
        expect(saves).toEqual([{ recipes: [recipe, recipe], activeRecipeId: 1 }]);
    });

    it('previews a valid pasted import, permits removing settings, and appends only on confirmation', async () => {
        await renderEditor();
        await click('Import Recipe');
        const paste = dialog().querySelector('textarea')!;
        await setInput(paste, '{invalid');
        expect(dialog().textContent).toContain('This recipe is invalid, check for any formatting errors.');
        await setInput(
            paste,
            JSON.stringify({ ...recipe, name: 'Listening', settings: { playbackRate: 1.3, repeatCountPreference: 2 } })
        );
        expect(dialog().textContent).toContain('Playback rate');
        expect(dialog().querySelector('textarea')).toBeNull();
        const remove = dialog().querySelector<HTMLButtonElement>('[aria-label="Delete Playback rate"]')!;
        await act(async () => remove.click());
        expect(saves).toEqual([]);
        await click('Import Recipe', dialog());
        expect(saves).toEqual([
            {
                recipes: [recipe, { ...recipe, name: 'Listening', settings: { repeatCountPreference: 2 } }],
                activeRecipeId: 1,
            },
        ]);
    });

    it.each(
        ['JSON', 'URL'].flatMap((source) =>
            ['<b>Reading</b>', 'Reading<img src="x" onerror="void 0">'].map((name) => ({ source, name }))
        )
    )('rejects $source imports with HTML recipe names: $name', async ({ source, name }) => {
        const imported = { ...recipe, name };
        if (source === 'URL') {
            const url = new URL(recipeImportUrl(imported));
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        }
        await renderEditor({ ...defaultSettings });
        if (source === 'JSON') {
            await click('Import Recipe');
            await setInput(dialog().querySelector('textarea')!, JSON.stringify(imported));
        }

        expect(dialog().textContent).toContain(translations.recipes.invalid);
        expect(dialog().querySelector('textarea')).not.toBeNull();
        const importButton = [...dialog().querySelectorAll('button')].find(
            (button) => button.textContent === 'Import Recipe'
        )!;
        expect(importButton.disabled).toBe(true);
        expect(saves).toEqual([]);
        if (source === 'URL') expect(window.location.hash).toBe('#playback');
    });

    it.each(['JSON', 'URL'])('preserves Unicode and ampersands in %s import names', async (source) => {
        const imported = { ...recipe, name: '読む & listen #1 🎧' };
        if (source === 'URL') {
            const url = new URL(recipeImportUrl(imported));
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        }
        await renderEditor({ ...defaultSettings });
        if (source === 'JSON') {
            await click('Import Recipe');
            await setInput(dialog().querySelector('textarea')!, JSON.stringify(imported));
        }

        expect(dialog().querySelector('input')?.value).toBe(imported.name);
        expect(saves).toEqual([]);
        await click('Import Recipe', dialog());
        expect(saves).toEqual([{ recipes: [imported], activeRecipeId: 0 }]);
    });

    it.each([false, true])(
        'removes the share payload after parsing while preserving the preview until confirmation (StrictMode: %s)',
        async (strictMode) => {
            const url = new URL(recipeImportUrl(recipe));
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
            await renderEditor({ ...defaultSettings }, strictMode);
            expect(dialog().textContent).toContain('Import Recipe');
            expect(dialog().querySelector('input')?.value).toBe('Reading');
            expect(dialog().querySelector('textarea')).toBeNull();
            expect(window.location.search).toBe('?view=settings');
            expect(window.location.hash).toBe('#playback');
            expect(saves).toEqual([]);
            await click('Import Recipe', dialog());
            expect(saves).toEqual([{ recipes: [recipe], activeRecipeId: 0 }]);
        }
    );

    it('keeps the summary name in the header and copies two-space JSON or the URL from the footer', async () => {
        await renderEditor();
        await openView();
        expect(dialog().querySelector('.MuiDialogTitle-root')?.textContent).toContain('Reading');
        const footer = dialog().querySelector('.MuiDialogActions-root')!;
        const url = footer.querySelector('input')!;
        expect(url.value).toBe(recipeImportUrl(recipe));
        expect(dialog().querySelector('.MuiDialogContent-root input')).toBeNull();
        await click('Copy', footer);
        expect(copied).toEqual([JSON.stringify(recipe, null, 2)]);
        const copyUrl = footer.querySelector<HTMLButtonElement>('[aria-label="Copy"]')!;
        await act(async () => copyUrl.click());
        expect(copied).toEqual([JSON.stringify(recipe, null, 2), recipeImportUrl(recipe)]);
        expect(saves).toEqual([]);
        await click('Delete', footer);
        expect(footer.textContent).toContain('Delete "Reading"?');
        await click('Delete', footer);
        expect(saves).toEqual([{ recipes: [], activeRecipeId: null }]);
    });

    it('closes the view summary without cancelling an edit or changing settings', async () => {
        await renderEditor();
        await openView();
        expect([...dialog().querySelectorAll('button')].some((button) => button.textContent === 'Cancel')).toBe(false);
        await click('Close', dialog());
        expect(saves).toEqual([]);
        await click('Import Recipe', container);
        expect(dialog().querySelector('textarea')).not.toBeNull();
        expect([...dialog().querySelectorAll('button')].some((button) => button.textContent === 'Cancel')).toBe(true);
    });

    it('groups track settings and removes values only from the selected track', async () => {
        const dictionaryTracks = [
            { dictionaryPlaybackConfig: { repeat: { rules: { minWords: 2 } } } },
            {
                dictionaryPlaybackConfig: {
                    repeat: { rules: { minWords: 7 } },
                    wordVisibility: { wholeSubtitleMatchThreshold: 0.75 },
                },
            },
        ];
        await renderEditor();
        await click('Import Recipe');
        await setInput(
            dialog().querySelector('textarea')!,
            JSON.stringify({ ...recipe, settings: { dictionaryTracks } })
        );
        const repeatLabel = translations.settings.dictionaryPlaybackRepeat;
        const repeatTable = () => dialog().querySelector(`table[aria-label="${repeatLabel}"]`)!;
        expect(repeatTable().querySelector('td')?.textContent).toBe('2');
        expect(repeatTable().querySelector('th')?.textContent).not.toContain('Track 1');
        expect(dialog().textContent).not.toContain('75%');
        const selector = dialog().querySelector('[role="combobox"]')!;
        await act(async () => selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
        expect([...document.querySelectorAll('[role="option"]')].map((option) => option.textContent)).toEqual([
            'Track 1',
            'Track 2',
        ]);
        const option = document.querySelector<HTMLElement>('[role="option"][data-value="1"]')!;
        await act(async () => option.click());
        expect(repeatTable().querySelector('td')?.textContent).toBe('7');
        expect(dialog().textContent).toContain('75%');
        await act(async () => repeatTable().querySelector('button')!.click());
        expect(dialog().querySelector(`table[aria-label="${repeatLabel}"]`)).toBeNull();
        await click('Import Recipe', dialog());
        expect(saves).toEqual([
            {
                recipes: [
                    recipe,
                    {
                        ...recipe,
                        settings: {
                            dictionaryTracks: [
                                dictionaryTracks[0],
                                { dictionaryPlaybackConfig: { wordVisibility: { wholeSubtitleMatchThreshold: 0.75 } } },
                            ],
                        },
                    },
                ],
                activeRecipeId: 1,
            },
        ]);
    });

    it('opens the first included track without shifting its index when earlier tracks have no recipe settings', async () => {
        await renderEditor();
        await click('Import Recipe');
        const imported = {
            ...recipe,
            settings: {
                dictionaryTracks: [
                    {},
                    {},
                    {
                        dictionaryPlaybackConfig: { autoPause: { onStatuses: [{ enabled: false }] } },
                    },
                ],
            },
        };
        await setInput(dialog().querySelector('textarea')!, JSON.stringify(imported));
        expect(dialog().querySelector('[role="combobox"]')?.textContent).toContain('Track 3');
        expect(dialog().querySelector('table')?.textContent).toContain('Disabled');
        await click('Import Recipe', dialog());
        expect(saves).toEqual([{ recipes: [recipe, imported], activeRecipeId: 1 }]);
    });

    it.each(['hashchange', 'popstate'])('previews import links received through %s after mounting', async (event) => {
        await renderEditor({ ...defaultSettings });
        const navigate = async (hash: string) => {
            window.history.replaceState({}, '', '/?view=settings' + hash);
            await act(async () => window.dispatchEvent(new Event(event)));
        };
        const url = new URL(recipeImportUrl(recipe));
        await navigate(url.hash);
        expect(dialog().querySelector('input')?.value).toBe('Reading');
        expect(dialog().querySelector('textarea')).toBeNull();
        expect(window.location.hash).toBe('#playback');
        expect(saves).toEqual([]);
        await click('Cancel', dialog());
        await navigate('#playback?recipe=invalid!');
        expect(dialog().textContent).toContain('This recipe is invalid, check for any formatting errors.');
        expect(window.location.hash).toBe('#playback');
        await navigate(url.hash);
        expect(dialog().querySelector('input')?.value).toBe('Reading');
        expect(dialog().querySelector('textarea')).toBeNull();
        expect(saves).toEqual([]);
        await click('Import Recipe', dialog());
        expect(saves).toEqual([{ recipes: [recipe], activeRecipeId: 0 }]);
    });

    it('preserves the path, other parameters, and history state when removing the recipe payload', async () => {
        const url = new URL(recipeImportUrl(recipe));
        url.pathname = '/settings';
        url.searchParams.set('other', 'value');
        url.hash += '&other=fragment';
        const state = { navigation: 'settings' };
        window.history.replaceState(state, '', url.pathname + url.search + url.hash);
        const historyLength = window.history.length;
        await renderEditor({ ...defaultSettings });
        expect(window.location.pathname).toBe('/settings');
        expect(window.location.search).toBe('?view=settings&other=value');
        expect(window.location.hash).toBe('#playback?other=fragment');
        expect(window.history.state).toEqual(state);
        expect(window.history.length).toBe(historyLength);
        expect(dialog().querySelector('input')?.value).toBe('Reading');
        await click('Cancel', dialog());
        expect(saves).toEqual([]);
    });

    it('removes an invalid share payload immediately while showing the error without saving', async () => {
        window.history.replaceState({}, '', '/?view=settings#playback?recipe=invalid!');
        await renderEditor({ ...defaultSettings });
        expect(dialog().textContent).toContain('This recipe is invalid, check for any formatting errors.');
        const importButton = [...dialog().querySelectorAll('button')].find(
            (button) => button.textContent === 'Import Recipe'
        )!;
        expect(importButton.disabled).toBe(true);
        expect(window.location.hash).toBe('#playback');
        await click('Cancel', dialog());
        expect(saves).toEqual([]);
        expect(window.location.hash).toBe('#playback');
    });
});
