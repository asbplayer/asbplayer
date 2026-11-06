import { expect, it, jest } from '@jest/globals';
import type { Command, Message } from '@project/common';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import { publishCopyHistoryRemoval } from '@project/extension/src/services/copy-history-removal';

it.each([0, 1, 2])('relays removals to all %s app instances, including player frames', async (count) => {
    const received: Command<Message>[] = [];
    const registry: Pick<TabRegistry, 'publishCommandToAsbplayers'> = {
        publishCommandToAsbplayers: async ({ commandFactory }) => {
            for (let index = 0; index < count; index++) {
                const command = commandFactory({ id: String(index), timestamp: 0, videoPlayer: index === 1 });
                if (command) received.push(command);
            }
        },
    };
    await publishCopyHistoryRemoval(registry, ['first', 'second']);
    expect(received).toEqual(
        Array.from({ length: count }, () => ({
            sender: 'asbplayer-extension-to-player',
            message: { command: 'copy-history-removed', ids: ['first', 'second'] },
        }))
    );
    received.length = 0;
    await publishCopyHistoryRemoval(registry);
    expect(received).toEqual(
        Array.from({ length: count }, () => ({
            sender: 'asbplayer-extension-to-player',
            message: { command: 'copy-history-removed', ids: undefined },
        }))
    );
});

it('does not publish an empty deletion as a history clear', async () => {
    const publishCommandToAsbplayers = jest.fn(async () => {});
    await publishCopyHistoryRemoval({ publishCommandToAsbplayers }, []);
    expect(publishCommandToAsbplayers).not.toHaveBeenCalled();
});

it('does not turn a completed deletion into a failure when notification delivery fails', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        await expect(
            publishCopyHistoryRemoval(
                {
                    publishCommandToAsbplayers: async () => {
                        throw new Error('Tab closed');
                    },
                },
                ['card']
            )
        ).resolves.toBeUndefined();
    } finally {
        errorLog.mockRestore();
    }
});
