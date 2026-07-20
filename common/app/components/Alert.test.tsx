import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import Alert from './Alert';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Alert', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        jest.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        jest.useRealTimers();
    });

    const renderAlert = (message: string, open = true) => {
        act(() => {
            root.render(
                <Alert open={open} autoHideDuration={3000} onClose={() => {}} severity="info">
                    {message}
                </Alert>
            );
        });
    };

    it('keeps successive notifications as separate rows in one fixed stack', () => {
        renderAlert('Fast-forward enabled');
        renderAlert('Playback rate: 2.0');
        renderAlert('Fast-forward disabled');
        renderAlert('Playback rate: 1.0');

        const stack = container.firstElementChild as HTMLElement;
        const rows = Array.from(stack.children) as HTMLElement[];

        expect(rows).toHaveLength(4);
        expect(rows.map((row) => row.textContent)).toEqual([
            'Playback rate: 1.0',
            'Fast-forward disabled',
            'Playback rate: 2.0',
            'Fast-forward enabled',
        ]);
        expect(getComputedStyle(stack).position).toBe('fixed');
        expect(getComputedStyle(stack).display).toBe('flex');
        expect(getComputedStyle(stack).flexDirection).toBe('column');
        expect(rows.every((row) => getComputedStyle(row).position !== 'fixed')).toBe(true);
    });
});
