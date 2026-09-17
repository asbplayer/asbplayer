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

    const renderTab = (settings: Partial<AsbplayerSettings>) => {
        const onSettingChanged = jest.fn<(key: string, value: unknown) => Promise<void>>(async () => {});

        act(() => {
            root.render(
                <ThemeProvider theme={theme}>
                    <SubtitleAppearanceSettingsTab
                        settings={{ ...defaultSettings, ...settings }}
                        onSettingChanged={onSettingChanged}
                        onSettingsChanged={() => {}}
                        localFontsAvailable={false}
                        localFontFamilies={[]}
                        onUnlockLocalFonts={() => {}}
                        onViewKeyboardShortcuts={() => {}}
                    />
                </ThemeProvider>
            );
        });

        return onSettingChanged;
    };

    const subtitlesWidthControl = () =>
        Array.from(container.querySelectorAll('.MuiFormControl-root')).find((control) =>
            Array.from(control.querySelectorAll('label')).some(
                (label) => label.textContent === 'settings.subtitlesWidth'
            )
        );

    const unitSelect = () => subtitlesWidthControl()?.querySelector<HTMLElement>('.MuiSelect-select');

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

    it('shows a unit dropdown with the currently selected unit', () => {
        renderTab({ subtitlesWidth: 80, subtitlesWidthUnit: '%' });

        expect(unitSelect()?.textContent).toBe('%');
        expect(subtitlesWidthControl()?.querySelector('[role="combobox"]')?.getAttribute('aria-label')).toBe(
            'settings.subtitlesWidth'
        );

        openUnitMenu();
        expect(Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).map((o) => o.textContent)).toEqual(
            ['%', 'px']
        );
    });

    it('persists the selected unit', () => {
        const onSettingChanged = renderTab({ subtitlesWidth: 80, subtitlesWidthUnit: '%' });

        selectUnit('px');

        expect(onSettingChanged).toHaveBeenCalledWith('subtitlesWidthUnit', 'px');
    });

    it('shows the selected unit after it changes', () => {
        renderTab({ subtitlesWidth: 80, subtitlesWidthUnit: 'px' });

        expect(unitSelect()?.textContent).toBe('px');
    });

    it('does not show a unit dropdown when the width is automatic', () => {
        renderTab({ subtitlesWidth: -1 });

        expect(subtitlesWidthControl()?.querySelector('input')?.value).toBe('auto');
        expect(unitSelect()).toBeNull();
    });
});
