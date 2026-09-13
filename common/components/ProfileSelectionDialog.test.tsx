import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import ProfileSelectionDialog from '@project/common/components/ProfileSelectionDialog';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (locKey: string) => locKey,
    }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const profiles: (string | undefined)[] = [undefined, 'profile a', 'profile b'];

describe('ProfileSelectionDialog', () => {
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

    const checkboxes = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const buttonByText = (text: string) =>
        Array.from(document.querySelectorAll('button')).find((button) => (button.textContent ?? '').includes(text));

    const renderDialog = (onConfirm = () => {}, onClose = () => {}) => {
        act(() => {
            root.render(
                <ProfileSelectionDialog
                    open={true}
                    title="dialog-title"
                    confirmLabel="dialog-confirm"
                    profiles={profiles}
                    onConfirm={onConfirm}
                    onClose={onClose}
                />
            );
        });
    };

    it('checks every profile by default', () => {
        renderDialog();

        expect(checkboxes().map((checkbox) => checkbox.checked)).toEqual([true, true, true]);
    });

    it('checks all and unchecks all profiles', () => {
        renderDialog();

        act(() => {
            buttonByText('action.checkNone')?.click();
        });
        expect(checkboxes().map((checkbox) => checkbox.checked)).toEqual([false, false, false]);
        expect(buttonByText('dialog-confirm')?.disabled).toBe(true);

        act(() => {
            buttonByText('action.checkAll')?.click();
        });
        expect(checkboxes().map((checkbox) => checkbox.checked)).toEqual([true, true, true]);
        expect(buttonByText('dialog-confirm')?.disabled).toBe(false);
    });

    it('confirms only the selected profiles in display order', () => {
        const onConfirm = jest.fn();
        renderDialog(onConfirm);

        // Uncheck the first profile
        act(() => {
            checkboxes()[1].click();
        });
        act(() => {
            buttonByText('dialog-confirm')?.click();
        });

        expect(onConfirm).toHaveBeenCalledWith([undefined, 'profile b']);
    });

    it('closes without confirming when canceled', () => {
        const onConfirm = jest.fn();
        const onClose = jest.fn();
        renderDialog(onConfirm, onClose);

        act(() => {
            buttonByText('action.cancel')?.click();
        });

        expect(onConfirm).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });
});
