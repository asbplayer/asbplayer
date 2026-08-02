import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import useSnackbar from './use-snackbar';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface TestProps {
    readonly requestedOpen: boolean;
    readonly onClose: () => void;
}

function TestSnackbar({ requestedOpen, onClose }: TestProps) {
    const snackbar = useSnackbar({ open: requestedOpen, onClose });
    return (
        <button data-open={snackbar.open} onMouseEnter={snackbar.onMouseEnter} onMouseLeave={snackbar.onMouseLeave} />
    );
}

describe('useSnackbar', () => {
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

    const renderSnackbar = (requestedOpen: boolean, onClose: () => void) => {
        act(() => {
            root.render(<TestSnackbar requestedOpen={requestedOpen} onClose={onClose} />);
        });
    };

    it('closes after six seconds', () => {
        const onClose = jest.fn();
        renderSnackbar(true, onClose);

        act(() => jest.advanceTimersByTime(5_999));
        expect(onClose).not.toHaveBeenCalled();
        expect(container.querySelector('button')?.dataset.open).toBe('true');

        act(() => jest.advanceTimersByTime(1));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(container.querySelector('button')?.dataset.open).toBe('false');
    });

    it('stays open while hovered and closes one second after unhovering', () => {
        const onClose = jest.fn();
        renderSnackbar(true, onClose);
        const button = container.querySelector('button')!;

        void act(() => button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
        act(() => jest.advanceTimersByTime(6_000));
        expect(onClose).not.toHaveBeenCalled();

        void act(() => button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
        act(() => jest.advanceTimersByTime(999));
        expect(onClose).not.toHaveBeenCalled();

        act(() => jest.advanceTimersByTime(1));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
