import type { CopyHistoryItem } from '@project/common';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import { publishCopyHistoryChanged } from '@project/extension/src/services/copy-history-changed';
import type { SettingsProvider } from '@project/common/settings';

/** Notify website instances after every extension mutation, including saves that prune old items. */
export class ExtensionCopyHistoryRepository extends IndexedDBCopyHistoryRepository {
    constructor(
        settingsProvider: SettingsProvider,
        private readonly tabRegistry: Pick<TabRegistry, 'publishCommandToAsbplayers'>
    ) {
        super(settingsProvider);
    }

    override async save(item: CopyHistoryItem): Promise<void> {
        await super.save(item);
        await publishCopyHistoryChanged(this.tabRegistry);
    }

    override async delete(id: string): Promise<void> {
        await super.delete(id);
        await publishCopyHistoryChanged(this.tabRegistry);
    }

    override async clear(): Promise<void> {
        await super.clear();
        await publishCopyHistoryChanged(this.tabRegistry);
    }
}
