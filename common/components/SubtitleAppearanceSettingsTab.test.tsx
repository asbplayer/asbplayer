import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import SubtitleAppearanceSettingsTab from '@project/common/components/SubtitleAppearanceSettingsTab';
import type { AsbplayerSettings } from '@project/common/settings';
import { defaultSettings } from '@project/common/settings';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (locKey: string) => locKey,
    }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const theme = createTheme();

describe('SubtitleAppearanceSettingsTab subtitles width', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    const renderTab = (
        settings: Partial<AsbplayerSettings>,
        extension: {
            installed?: boolean;
            supportsSubtitlesWidthInPixels?: boolean;
        } = {}
    ) => {
        const onSettingChanged = jest.fn<(key: string, value: unknown) => Promise<void>>(async () => {});
        const onSettingsChanged = jest.fn<(settings: Partial<AsbplayerSettings>) => void>();

        act(() => {
            root.render(
                <ThemeProvider theme={theme}>
                    <SubtitleAppearanceSettingsTab
                        settings={{ ...defaultSettings, ...settings }}
                        onSettingChanged={onSettingChanged}
                        onSettingsChanged={onSettingsChanged}
                        extensionInstalled={extension.installed}
                        extensionSupportsSubtitlesWidthSetting={extension.installed}
                        extensionSupportsSubtitlesWidthInPixels={extension.supportsSubtitlesWidthInPixels}
                        localFontsAvailable={false}
                        localFontFamilies={[]}
                        onUnlockLocalFonts={() => {}}
                        onViewKeyboardShortcuts={() => {}}
                    />
                </ThemeProvider>
            );
        });

        return { onSettingChanged, onSettingsChanged };
    };

    const subtitlesWidthControl = () =>
        Array.from(container.querySelectorAll('.MuiFormControl-root')).find((control) =>
            Array.from(control.querySelectorAll('label')).some(
                (label) => label.textContent === 'settings.subtitlesWidth'
            )
        );

    const unitSelect = () => subtitlesWidthControl()?.querySelector<HTMLElement>('.MuiSelect-select');

    const widthInput = () => subtitlesWidthControl()!.querySelector('input') as HTMLInputElement;

    const setInputValue = (input: HTMLInputElement, value: string) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const openUnitMenu = () => {
        act(() => {
            unitSelect()!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });
    };

    const selectUnit = (unit: string) => {
        openUnitMenu();
        const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
            (o) => o.textContent === unit
        );
        act(() => option!.click());
    };

    it.each([
        ['no extension', { installed: false, supportsSubtitlesWidthInPixels: false }],
        ['extension 1.22 or later', { installed: true, supportsSubtitlesWidthInPixels: true }],
    ])('shows the unit dropdown with % and px options with %s', (_name, extension) => {
        renderTab({ subtitlesWidth: 80, subtitlesWidthUnit: '%' }, extension);

        expect(unitSelect()?.textContent).toBe('%');
        expect(subtitlesWidthControl()?.querySelector('[role="combobox"]')?.getAttribute('aria-label')).toBe(
            'settings.subtitlesWidth'
        );

        openUnitMenu();
        expect(Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).map((o) => o.textContent)).toEqual(
            ['%', 'px']
        );
    });

    it('saves the selected unit together with the width', () => {
        const { onSettingsChanged } = renderTab({ subtitlesWidth: 80, subtitlesWidthUnit: '%' });

        selectUnit('px');

        expect(onSettingsChanged).toHaveBeenCalledWith({ subtitlesWidthUnit: 'px', subtitlesWidth: 80 });
    });

    it('caps the width when switching from pixels to percentages', () => {
        const { onSettingsChanged } = renderTab({ subtitlesWidth: 1280, subtitlesWidthUnit: 'px' });

        selectUnit('%');

        expect(onSettingsChanged).toHaveBeenCalledWith({ subtitlesWidthUnit: '%', subtitlesWidth: 100 });
    });

    it('shows only the legacy percent option with an older extension', () => {
        const { onSettingChanged, onSettingsChanged } = renderTab(
            { subtitlesWidth: 80, subtitlesWidthUnit: '%' },
            { installed: true, supportsSubtitlesWidthInPixels: false }
        );

        expect(unitSelect()).toBeNull();
        expect(subtitlesWidthControl()?.querySelector('.MuiInputAdornment-root')?.textContent).toBe('%');
        expect(widthInput().getAttribute('max')).toBe('100');

        act(() => setInputValue(widthInput(), '90'));

        expect(onSettingChanged).toHaveBeenCalledWith('subtitlesWidth', 90);
        expect(onSettingsChanged).not.toHaveBeenCalled();
    });

    it('does not show a unit dropdown when the width is automatic', () => {
        renderTab({ subtitlesWidth: -1 });

        expect(subtitlesWidthControl()?.querySelector('input')?.value).toBe('auto');
        expect(unitSelect()).toBeNull();
    });

    it('limits percentages to 100', () => {
        const { onSettingChanged } = renderTab({ subtitlesWidth: 80, subtitlesWidthUnit: '%' });
        const input = widthInput();

        expect(input.getAttribute('max')).toBe('100');

        act(() => setInputValue(input, '150'));

        expect(onSettingChanged).not.toHaveBeenCalled();
    });

    it('limits pixels to 10000', () => {
        const { onSettingChanged } = renderTab({ subtitlesWidth: 1280, subtitlesWidthUnit: 'px' });
        const input = widthInput();

        expect(input.getAttribute('max')).toBe('10000');

        act(() => setInputValue(input, '9000'));

        expect(onSettingChanged).toHaveBeenCalledWith('subtitlesWidth', 9000);

        onSettingChanged.mockClear();

        act(() => setInputValue(input, '12000'));

        expect(onSettingChanged).not.toHaveBeenCalled();
    });
});
