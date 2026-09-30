import { beforeEach, expect, it } from '@jest/globals';
import { LocalLogStorage } from '@project/client/src/local-log-storage';

beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
});

it('keeps standalone app logs in session storage across provider instances', async () => {
    const first = { timestamp: 2, label: 'app', level: 'info' as const, msg: 'first' };
    const second = { timestamp: 1, label: 'app', level: 'warning' as const, msg: 'second' };
    const storage = new LocalLogStorage();

    await storage.append([first]);
    await storage.append([second]);

    expect(await new LocalLogStorage().getLogs()).toEqual({ lines: [first, second] });
    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
});
