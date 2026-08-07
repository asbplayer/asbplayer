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
                <Alert useAppLogo={true} open={open} onClose={() => {}} severity="info">
                    {message}
                </Alert>
            );
        });
    };

    const renderNotifications = (notifications: { message: string; severity: 'info' | 'warning' }[]) => {
        act(() => {
            root.render(<Alert useAppLogo={true} open={true} onClose={() => {}} notifications={notifications} />);
        });
    };

    it('keeps successive notifications visible as separate alerts in newest-first order', () => {
        renderAlert('Fast-forward enabled');
        renderAlert('Playback rate: 2.0');
        renderAlert('Fast-forward disabled');
        renderAlert('Playback rate: 1.0');

        const alerts = Array.from(container.querySelectorAll('[role="alert"]'));

        expect(alerts).toHaveLength(4);
        expect(alerts.map((alert) => alert.textContent)).toEqual([
            'Playback rate: 1.0',
            'Fast-forward disabled',
            'Playback rate: 2.0',
            'Fast-forward enabled',
        ]);
    });

    it('renders notifications from one request in the supplied order', () => {
        renderNotifications([
            { message: 'Offset | playback rate', severity: 'info' },
            { message: 'Repeat enabled', severity: 'warning' },
        ]);

        const alerts = Array.from(container.querySelectorAll('[role="alert"]'));

        expect(alerts.map((alert) => alert.textContent)).toEqual(['Offset | playback rate', 'Repeat enabled']);
        expect(alerts[0].classList.contains('MuiAlert-standardInfo')).toBe(true);
        expect(alerts[1].classList.contains('MuiAlert-standardWarning')).toBe(true);
    });

    it('uses a notification-specific auto-hide duration', () => {
        const onClose = jest.fn();

        act(() => {
            root.render(
                <Alert
                    useAppLogo={true}
                    open={true}
                    onClose={onClose}
                    notifications={[{ message: 'Initial settings', severity: 'info', autoHideDuration: 6000 }]}
                />
            );
        });

        act(() => jest.advanceTimersByTime(3000));
        expect(onClose).not.toHaveBeenCalled();

        act(() => jest.advanceTimersByTime(3001));
        act(() => jest.advanceTimersByTime(1000));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('uses the default auto-hide duration when a notification does not specify one', () => {
        const onClose = jest.fn();

        act(() => {
            root.render(
                <Alert
                    useAppLogo={true}
                    open={true}
                    onClose={onClose}
                    notifications={[{ message: 'Default duration', severity: 'info' }]}
                />
            );
        });

        act(() => jest.advanceTimersByTime(3000));
        expect(onClose).not.toHaveBeenCalled();

        act(() => jest.advanceTimersByTime(1001));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not update indefinitely when closed', () => {
        renderAlert('Hidden', false);

        expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
    });
});
