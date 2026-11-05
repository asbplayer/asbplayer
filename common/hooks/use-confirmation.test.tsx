import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import useConfirmation from '@project/common/hooks/use-confirmation';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ConfirmAction({ timeoutMs }: { timeoutMs?: number }) {
    const [count, setCount] = useState(0);
    const { confirming, confirm, reset } = useConfirmation(() => setCount((value) => value + 1), timeoutMs);
    return (
        <>
            <button onClick={confirm}>{confirming ? 'Confirm' : 'Publish'}</button>
            <button onClick={reset}>Cancel</button>
            <output>{count}</output>
        </>
    );
}

describe('useConfirmation', () => {
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

    const renderAction = (timeoutMs?: number) => {
        act(() =>
            root.render(
                <React.StrictMode>
                    <ConfirmAction timeoutMs={timeoutMs} />
                </React.StrictMode>
            )
        );
    };
    const button = () => container.querySelector('button')!;
    const count = () => container.querySelector('output')!.textContent;

    it('runs the action only on the second press and requires confirmation again afterward', () => {
        renderAction();
        act(() => button().click());
        expect(button().textContent).toBe('Confirm');
        expect(count()).toBe('0');

        act(() => button().click());
        expect(count()).toBe('1');
        expect(button().textContent).toBe('Publish');

        act(() => button().click());
        expect(count()).toBe('1');
        expect(button().textContent).toBe('Confirm');
    });

    it.each([undefined, 1_000, 5_000])('expires after the configured timeout (%s ms)', (timeoutMs) => {
        renderAction(timeoutMs);
        act(() => button().click());
        act(() => jest.advanceTimersByTime((timeoutMs ?? 3_000) - 1));
        expect(button().textContent).toBe('Confirm');

        act(() => jest.advanceTimersByTime(1));
        expect(button().textContent).toBe('Publish');
        expect(count()).toBe('0');

        act(() => button().click());
        expect(count()).toBe('0');
        expect(button().textContent).toBe('Confirm');
        act(() => button().click());
        expect(count()).toBe('1');
    });

    it('allows a pending confirmation to be cancelled without running the action', () => {
        renderAction();
        act(() => button().click());
        act(() => container.querySelectorAll('button')[1].click());
        expect(button().textContent).toBe('Publish');
        expect(count()).toBe('0');

        act(() => button().click());
        expect(button().textContent).toBe('Confirm');
        expect(count()).toBe('0');
    });
});
