import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import Alert from '@project/common/app/components/Alert';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (locKey: string, replacements?: { rate?: string }) => `${locKey}:${replacements?.rate ?? ''}`,
    }),
}));

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

    const renderAlert = (message: string, open = true, key?: string) => {
        act(() => {
            root.render(
                <Alert
                    useAppLogo={true}
                    open={open}
                    onClose={() => {}}
                    notifications={[{ key, message, severity: 'info' }]}
                />
            );
        });
    };

    const renderNotifications = (
        notifications: { key?: string; message: string; severity: 'info' | 'warning'; autoHideDuration?: number }[],
        onClose = () => {}
    ) => {
        act(() => {
            root.render(<Alert useAppLogo={true} open={true} onClose={onClose} notifications={notifications} />);
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

    it('updates the top keyed notification without removing unrelated notifications', () => {
        renderNotifications([
            { key: 'playback-rate', message: 'Playback rate: 2.0', severity: 'info' },
            { message: 'Repeat enabled', severity: 'info' },
        ]);
        renderNotifications([{ key: 'playback-rate', message: 'Playback rate: 1.0', severity: 'info' }]);

        const alerts = Array.from(container.querySelectorAll('[role="alert"]'));

        expect(alerts).toHaveLength(2);
        expect(alerts.map((alert) => alert.textContent)).toEqual(['Playback rate: 1.0', 'Repeat enabled']);
    });

    it('updates every keyed notification that remains in the same position', () => {
        renderNotifications([
            { key: 'playback-rate', message: 'Playback rate: 2.0', severity: 'info' },
            { key: 'subtitle-offset', message: 'Offset: +100ms', severity: 'info' },
            { message: 'Repeat enabled', severity: 'info' },
        ]);
        const previousAlerts = Array.from(container.querySelectorAll('[role="alert"]'));

        renderNotifications([
            { key: 'playback-rate', message: 'Playback rate: 1.0', severity: 'info' },
            { key: 'subtitle-offset', message: 'Offset: +200ms', severity: 'info' },
        ]);

        const alerts = Array.from(container.querySelectorAll('[role="alert"]'));

        expect(alerts.map((alert) => alert.textContent)).toEqual([
            'Playback rate: 1.0',
            'Offset: +200ms',
            'Repeat enabled',
        ]);
        expect(alerts[0]).toBe(previousAlerts[0]);
        expect(alerts[1]).toBe(previousAlerts[1]);
        expect(alerts[2]).toBe(previousAlerts[2]);
    });

    it('moves a keyed notification to the top when it is not already at the top', () => {
        renderNotifications([
            { message: 'Repeat enabled', severity: 'info' },
            { key: 'playback-rate', message: 'Playback rate: 2.0', severity: 'info' },
        ]);
        const previousAlerts = Array.from(container.querySelectorAll('[role="alert"]'));

        renderNotifications([{ key: 'playback-rate', message: 'Playback rate: 1.0', severity: 'info' }]);

        const alerts = Array.from(container.querySelectorAll('[role="alert"]'));

        expect(alerts.map((alert) => alert.textContent)).toEqual(['Playback rate: 1.0', 'Repeat enabled']);
        expect(alerts[0]).not.toBe(previousAlerts[1]);
        expect(alerts[1]).toBe(previousAlerts[0]);
    });

    it('resets the auto-hide timer when the top keyed notification is updated', () => {
        const onClose = jest.fn();
        const notification = (message: string) => ({
            key: 'playback-rate',
            message,
            severity: 'info' as const,
            autoHideDuration: 3000,
        });

        renderNotifications([notification('Playback rate: 2.0')], onClose);
        act(() => jest.advanceTimersByTime(2000));
        renderNotifications([notification('Playback rate: 1.0')], onClose);

        act(() => jest.advanceTimersByTime(1000));
        expect(onClose).not.toHaveBeenCalled();

        act(() => jest.advanceTimersByTime(2001));
        act(() => jest.advanceTimersByTime(1000));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not add a duplicate notification when the same keyed request is rendered again', () => {
        const notification = { key: 'playback-rate', message: 'Playback rate: 2.0', severity: 'info' as const };

        renderNotifications([notification]);
        renderNotifications([{ ...notification }]);

        expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1);
    });

    it('renders only the latest notification when a request contains duplicate keys', () => {
        renderNotifications([
            { key: 'playback-rate', message: 'Playback rate: 2.0', severity: 'info' },
            { key: 'playback-rate', message: 'Playback rate: 1.0', severity: 'info' },
        ]);

        const alerts = Array.from(container.querySelectorAll('[role="alert"]'));

        expect(alerts).toHaveLength(1);
        expect(alerts[0].textContent).toBe('Playback rate: 1.0');
    });

    it('localizes notification messages when given a loc key', () => {
        act(() => {
            root.render(
                <Alert
                    useAppLogo={true}
                    open={true}
                    onClose={() => {}}
                    notifications={[
                        {
                            message: { locKey: 'info.playbackRate', replacements: { rate: '1.4' } },
                            severity: 'info',
                        },
                    ]}
                />
            );
        });

        expect(container.querySelector('[role="alert"]')?.textContent).toBe('info.playbackRate:1.4');
    });

    it('uses a notification-specific auto-hide duration', () => {
        const onClose = jest.fn();

        act(() => {
            root.render(
                <Alert
                    useAppLogo={true}
                    open={true}
                    onClose={onClose}
                    notifications={[
                        {
                            message: 'Initial settings',
                            severity: 'info',
                            autoHideDuration: 6000,
                        },
                    ]}
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
