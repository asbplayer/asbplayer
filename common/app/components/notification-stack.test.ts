import { expect, it } from '@jest/globals';
import { Notification, prependNotification, removeNotification } from './notification-stack';

const notification = (id: number, value: string): Notification<string> => ({ id, value });

it('places newer notifications before older notifications', () => {
    const older = notification(1, 'older');
    const newer = notification(2, 'newer');

    expect(prependNotification([], older)).toEqual([older]);
    expect(prependNotification([older], newer)).toEqual([newer, older]);
});

it('removes only the notification that closes', () => {
    const older = notification(1, 'older');
    const newer = notification(2, 'newer');

    expect(removeNotification([newer, older], newer.id)).toEqual([older]);
});
