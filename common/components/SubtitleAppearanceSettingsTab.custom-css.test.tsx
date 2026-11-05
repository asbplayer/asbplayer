import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import SubtitleAppearanceSettingsTab from '@project/common/components/SubtitleAppearanceSettingsTab';
import type { AsbplayerSettings, CustomStyle, TextSubtitleSettings } from '@project/common/settings';
import { defaultSettings, textSubtitleSettingsForTrack } from '@project/common/settings';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { styleKey?: string }) =>
            options?.styleKey === undefined ? key : `${key}:${options.styleKey}`,
    }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const theme = createTheme();
const initialStyles: CustomStyle[][] = [
    [
        { key: 'color', value: 'red' },
        { key: 'fontWeight', value: '900' },
    ],
    [
        { key: 'letterSpacing', value: '2px' },
        { key: 'fontStyle', value: 'italic' },
        { key: 'wordSpacing', value: '4px' },
    ],
    [{ key: 'marginTop', value: '3px' }],
];

describe('custom CSS for individual subtitle tracks', () => {
    let container: HTMLDivElement;
    let root: Root;
    let settings: AsbplayerSettings;

    const render = () => {
        root.render(
            <ThemeProvider theme={theme}>
                <SubtitleAppearanceSettingsTab
                    settings={settings}
                    onSettingChanged={async () => {}}
                    onSettingsChanged={(diff) => {
                        settings = { ...settings, ...diff };
                        render();
                    }}
                    localFontsAvailable={false}
                    localFontFamilies={[]}
                    onUnlockLocalFonts={() => {}}
                    onViewKeyboardShortcuts={() => {}}
                />
            </ThemeProvider>
        );
    };

    const stylesFor = (track: number) => textSubtitleSettingsForTrack(settings, track).subtitleCustomStyles;
    const selectTrack = (track: number) => {
        const select = container.querySelector<HTMLElement>('.MuiSelect-select')!;
        act(() => {
            select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });
        const option = document.querySelector<HTMLElement>(`[role="option"][data-value="${track}"]`)!;
        act(() => option.click());
    };
    const cssControl = (key: string) =>
        Array.from(container.querySelectorAll('.MuiFormControl-root')).find((control) =>
            Array.from(control.querySelectorAll('label')).some(
                (label) => label.textContent === `settings.customCssField:${key}`
            )
        )!;
    const edit = (key: string, value: string) => {
        const input = cssControl(key).querySelector('input')!;
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    };
    const remove = (key: string) => {
        const button = cssControl(key).querySelector('[data-testid="DeleteIcon"]')!.closest('button')!;
        act(() => button.click());
    };
    const add = () => {
        const button = container.querySelector('[data-testid="AddIcon"]')!.closest('button')!;
        expect(button.disabled).toBe(false);
        act(() => button.click());
    };
    const expectOtherTracksUnchanged = (selectedTrack: number) => {
        for (const track of [0, 1, 2]) {
            if (track !== selectedTrack) expect(stylesFor(track)).toEqual(initialStyles[track]);
        }
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        const base = textSubtitleSettingsForTrack(defaultSettings, 0) as TextSubtitleSettings;
        settings = {
            ...defaultSettings,
            subtitleCustomStyles: initialStyles[0].map((style) => ({ ...style })),
            subtitleTracksV2: initialStyles.slice(1).map((styles) => ({
                ...base,
                subtitleCustomStyles: styles.map((style) => ({ ...style })),
            })),
        };
        act(render);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it.each([0, 1, 2])('edits track %i without replacing its other properties', (track) => {
        selectTrack(track);
        const key = initialStyles[track][0].key;
        const value = track === 0 ? 'blue' : '5px';
        edit(key, value);

        expect(stylesFor(track)).toEqual([{ key, value }, ...initialStyles[track].slice(1)]);
        expectOtherTracksUnchanged(track);
    });

    it.each([0, 1, 2])('deletes only the selected property from track %i', (track) => {
        selectTrack(track);
        remove(initialStyles[track][0].key);

        expect(stylesFor(track)).toEqual(initialStyles[track].slice(1));
        expectOtherTracksUnchanged(track);
    });

    it.each([0, 1, 2])('adds a property while retaining track %i custom CSS', (track) => {
        selectTrack(track);
        add();

        expect(stylesFor(track)?.slice(0, -1)).toEqual(initialStyles[track]);
        expect(stylesFor(track)).toHaveLength(initialStyles[track].length + 1);
        expectOtherTracksUnchanged(track);
    });

    it('retains independent edits after switching between tracks', () => {
        selectTrack(1);
        edit('letterSpacing', '5px');
        selectTrack(2);
        edit('marginTop', '6px');
        selectTrack(1);

        expect(cssControl('letterSpacing').querySelector('input')!.value).toBe('5px');
        expect(stylesFor(1)).toEqual([{ key: 'letterSpacing', value: '5px' }, ...initialStyles[1].slice(1)]);
        expect(stylesFor(2)).toEqual([{ key: 'marginTop', value: '6px' }]);
        expect(stylesFor(0)).toEqual(initialStyles[0]);
    });
});
