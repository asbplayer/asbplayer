import { expect, it } from '@jest/globals';
import { LogProvider } from '@project/common/util/log';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import { handleLogMessage } from '@project/extension/src/services/log-message-handler';
import { SessionLogStorage } from '@project/extension/src/services/session-log-storage';

it('stores app and extension messages in the same session log history', async () => {
    const store = new SessionLogStorage(new MockStorageArea());
    const provider = new LogProvider(store);
    const appLine = { timestamp: 1, label: 'app', level: 'info' as const, msg: 'app' };
    const extensionLine = { timestamp: 2, label: 'extension', level: 'warning' as const, msg: 'extension' };
    const response = (lines: (typeof appLine | typeof extensionLine)[]) =>
        new Promise<unknown>((resolve) => {
            expect(
                handleLogMessage(
                    { sender: 'asbplayerv2', message: { command: 'append-logs', lines } },
                    resolve,
                    store,
                    provider
                )
            ).toBe(true);
        });

    await response([appLine]);
    await response([extensionLine]);

    const snapshot = new Promise<unknown>((resolve) => {
        expect(
            handleLogMessage({ sender: 'asbplayerv2', message: { command: 'get-logs' } }, resolve, store, provider)
        ).toBe(true);
    });
    expect(await snapshot).toEqual({ lines: [appLine, extensionLine] });
    expect(
        handleLogMessage(
            { sender: 'external-page', message: { command: 'append-logs', lines: [appLine] } },
            () => {},
            store,
            provider
        )
    ).toBe(false);
    expect(
        handleLogMessage({ sender: 'external-page', message: { command: 'get-logs' } }, () => {}, store, provider)
    ).toBe(false);
    expect((await store.getLogs()).lines).toEqual([appLine, extensionLine]);
});
