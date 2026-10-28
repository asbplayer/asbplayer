import { beforeEach, expect, it } from '@jest/globals';
import '@project/common/copy-history/test-database';
import type { CopyHistoryItem } from '@project/common';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';
import { ExtensionCopyHistoryRepository } from '@project/extension/src/services/copy-history-repository';
import { SettingsProvider } from '@project/common/settings';
import { MockSettingsStorage } from '@project/common/settings/mock-settings-storage';

beforeEach(async () => {
    await new IndexedDBCopyHistoryRepository(new SettingsProvider(new MockSettingsStorage())).clear();
});

it('announces committed additions, updates, automatic pruning, deletions and clear to website instances', async () => {
    const snapshots: CopyHistoryItem[][] = [];
    const settings = new SettingsProvider(new MockSettingsStorage());
    await settings.set({ miningHistoryStorageLimit: 2 });
    const repository = new ExtensionCopyHistoryRepository(settings, {
        publishCommandToAsbplayers: async ({ commandFactory }) => {
            const command = commandFactory({ id: 'app', timestamp: 0, videoPlayer: false });
            if (command?.message.command === 'copy-history-changed') snapshots.push(await repository.fetch(2));
        },
    });
    const first: CopyHistoryItem = {
        id: 'first',
        timestamp: 1,
        mediaTimestamp: 0,
        subtitleFileName: 'video.srt',
        surroundingSubtitles: [],
        subtitle: { text: 'first', start: 0, end: 1, originalStart: 0, originalEnd: 1, track: 0 },
    };
    const updated = { ...first, subtitleFileName: 'updated.srt' };
    const second = { ...first, id: 'second' };
    const third = { ...first, id: 'third' };
    await repository.save(first);
    await repository.save(updated);
    await repository.save(second);
    await repository.save(third);
    await repository.delete(second.id);
    await repository.clear();
    expect(snapshots).toEqual([
        [expect.objectContaining({ ...first })],
        [expect.objectContaining(updated)],
        [expect.objectContaining(updated), expect.objectContaining(second)],
        [expect.objectContaining(second), expect.objectContaining(third)],
        [expect.objectContaining(third)],
        [],
    ]);
});
