import { afterEach, expect, it, jest } from '@jest/globals';
import type {
    ClearCopyHistoryMessage,
    Command,
    CopyHistoryRemovedMessage,
    DeleteCopyHistoryMessage,
    Message,
} from '@project/common';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';
import type { SettingsProvider } from '@project/common/settings';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import DeleteCopyHistoryHandler from '@project/extension/src/handlers/asbplayerv2/delete-copy-history-handler';
import ClearCopyHistoryHandler from '@project/extension/src/handlers/asbplayerv2/clear-copy-history-handler';

afterEach(() => {
    jest.restoreAllMocks();
});

it.each(['delete', 'clear'] as const)('notifies apps only after %s is committed', async (operation) => {
    let finish!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
        finish = resolve;
    });
    const mutationStarted = new Promise<void>((resolve) => {
        started = resolve;
    });
    // Persistence and extension messaging are the two asynchronous boundaries here.
    jest.spyOn(IndexedDBCopyHistoryRepository.prototype, operation).mockImplementation(async () => {
        started();
        await pending;
    });
    const settings = { getSingle: async () => 25 } as unknown as SettingsProvider;
    const notifications: Message[] = [];
    const publishCommandToAsbplayers: TabRegistry['publishCommandToAsbplayers'] = async ({ commandFactory }) => {
        const command = commandFactory({ id: 'app', timestamp: 0, videoPlayer: false });
        if (command) notifications.push(command.message);
    };
    const registry = { publishCommandToAsbplayers } as TabRegistry;
    const handler =
        operation === 'delete'
            ? new DeleteCopyHistoryHandler(settings, registry)
            : new ClearCopyHistoryHandler(settings, registry);
    const message: DeleteCopyHistoryMessage | ClearCopyHistoryMessage =
        operation === 'delete'
            ? { command: 'delete-copy-history', messageId: 'request', ids: ['card'] }
            : { command: 'clear-copy-history', messageId: 'request' };
    const command: Command<Message> = { sender: 'asbplayerv2', message };
    const response = new Promise((resolve) => handler.handle(command, {}, resolve));
    await mutationStarted;
    expect(notifications).toEqual([]);
    finish();
    await response;
    const expected: CopyHistoryRemovedMessage = {
        command: 'copy-history-removed',
        ids: operation === 'delete' ? ['card'] : undefined,
    };
    expect(notifications).toEqual([expected]);
});

it.each(['delete', 'clear'] as const)('does not notify apps if %s fails', async (operation) => {
    jest.spyOn(IndexedDBCopyHistoryRepository.prototype, operation).mockRejectedValue(new Error('Storage failed'));
    let failureReported!: () => void;
    const failed = new Promise<void>((resolve) => {
        failureReported = resolve;
    });
    jest.spyOn(console, 'error').mockImplementation(() => failureReported());
    const publishCommandToAsbplayers = jest.fn(async () => {});
    const settings = { getSingle: async () => 25 } as unknown as SettingsProvider;
    const registry = { publishCommandToAsbplayers } as unknown as TabRegistry;
    const handler =
        operation === 'delete'
            ? new DeleteCopyHistoryHandler(settings, registry)
            : new ClearCopyHistoryHandler(settings, registry);
    handler.handle(
        {
            sender: 'asbplayerv2',
            message: { command: handler.command, ids: ['card'] } as Message,
        },
        {},
        () => {}
    );
    await failed;
    expect(publishCommandToAsbplayers).not.toHaveBeenCalled();
});
