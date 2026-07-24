import { expect, it } from '@jest/globals';
import { prepend, remove, Stack } from './notification-stack';

const item = (id: number, value: string): Stack<string> => ({ id, value });

it('places newer notifications before older notifications', () => {
    const older = item(1, 'older');
    const newer = item(2, 'newer');

    expect(prepend([], older)).toEqual([older]);
    expect(prepend([older], newer)).toEqual([newer, older]);
});

it('removes only the notification that closes', () => {
    const older = item(1, 'older');
    const newer = item(2, 'newer');

    expect(remove([newer, older], newer.id)).toEqual([older]);
});
