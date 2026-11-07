import type { CopyHistoryItem } from '@project/common';
import type { CopyHistoryRepository } from '@project/common/copy-history';
import type ChromeExtension from '@project/common/app/services/chrome-extension';
import { asbWarn } from '@project/common/util/log';

type CopyHistoryExtension = Pick<
    ChromeExtension,
    'requestCopyHistory' | 'clearCopyHistory' | 'deleteCopyHistory' | 'saveCopyHistory' | 'subscribe'
>;

export class ExtensionBridgedCopyHistoryRepository implements CopyHistoryRepository {
    private readonly _extension: CopyHistoryExtension;

    constructor(extension: CopyHistoryExtension) {
        this._extension = extension;
    }

    async fetch(count: number): Promise<CopyHistoryItem[]> {
        return (await this._extension.requestCopyHistory(count)).copyHistoryItems;
    }

    async clear(): Promise<void> {
        await this._extension.clearCopyHistory();
    }

    async delete(id: string): Promise<void> {
        await this._extension.deleteCopyHistory(id);
    }

    async save(copyHistoryItem: CopyHistoryItem): Promise<void> {
        await this._extension.saveCopyHistory(copyHistoryItem);
    }

    liveFetch(count: number, callback: (items: CopyHistoryItem[]) => void): () => void {
        let active = true;
        let generation = 0;
        const refresh = async () => {
            const request = ++generation;
            try {
                const items = await this.fetch(count);
                if (active && request === generation) callback(items);
            } catch (error) {
                if (active && request === generation) asbWarn('copy-history', 'Could not refresh history', error);
            }
        };
        const unsubscribe = this._extension.subscribe(({ data }) => {
            if (data.command === 'copy-history-changed') void refresh();
        });
        void refresh();
        return () => {
            active = false;
            unsubscribe();
        };
    }
}
