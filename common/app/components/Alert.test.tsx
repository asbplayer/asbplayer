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
                <Alert useAppLogo={true} open={open} autoHideDuration={3000} onClose={() => {}} severity="info">
                    {message}
                </Alert>
            );
        });
    };

    const renderNotifications = (notifications: { message: string; severity: 'info' | 'warning' }[]) => {
        act(() => {
            root.render(
                <Alert
                    useAppLogo={true}
                    open={true}
                    autoHideDuration={3000}
                    onClose={() => {}}
                    notifications={notifications}
                />
            );
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
});
