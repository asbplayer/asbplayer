import { expect, it, jest } from '@jest/globals';
import { ExtensionLogStorage } from '@project/extension/src/services/extension-log-storage';

it('sends extension log commands using the app sender', async () => {
    const originalBrowser = (globalThis as any).browser;
    const sendMessage = jest.fn(async (message: unknown) => {
        void message;
        return { lines: [] };
    });
    (globalThis as any).browser = { runtime: { sendMessage } };

    try {
        const storage = new ExtensionLogStorage();
        const line = { timestamp: 1, label: 'extension', level: 'info' as const, msg: 'saved' };
        await storage.append([line]);
        await expect(storage.getLogs()).resolves.toEqual({ lines: [] });

        expect(sendMessage).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                sender: 'asbplayerv2',
                message: expect.objectContaining({ command: 'append-logs', lines: [line] }),
            })
        );
        expect(sendMessage).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                sender: 'asbplayerv2',
                message: expect.objectContaining({ command: 'get-logs' }),
            })
        );
    } finally {
        (globalThis as any).browser = originalBrowser;
    }
});
