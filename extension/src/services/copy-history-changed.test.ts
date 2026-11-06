import { expect, it, jest } from '@jest/globals';
import type { Command, Message } from '@project/common';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import { publishCopyHistoryChanged } from '@project/extension/src/services/copy-history-changed';

it.each([0, 1, 2])('relays changes to all %s app instances, including player frames', async (count) => {
    const received: Command<Message>[] = [];
    const registry: Pick<TabRegistry, 'publishCommandToAsbplayers'> = {
        publishCommandToAsbplayers: async ({ commandFactory }) => {
            for (let index = 0; index < count; index++) {
                const command = commandFactory({ id: String(index), timestamp: 0, videoPlayer: index === 1 });
                if (command) received.push(command);
            }
        },
    };
    await publishCopyHistoryChanged(registry);
    expect(received).toEqual(
        Array.from({ length: count }, () => ({
            sender: 'asbplayer-extension-to-player',
            message: { command: 'copy-history-changed' },
        }))
    );
});

it('does not turn a completed mutation into a failure when notification delivery fails', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        await expect(
            publishCopyHistoryChanged({
                publishCommandToAsbplayers: async () => {
                    throw new Error('Tab closed');
                },
            })
        ).resolves.toBeUndefined();
    } finally {
        errorLog.mockRestore();
    }
});
