import { CopyHistoryItem } from '../..';
import { CopyHistoryRepository } from '../../copy-history';
import ChromeExtension from './chrome-extension';

export class ExtensionBridgedCopyHistoryRepository implements CopyHistoryRepository {
    private readonly _extension: ChromeExtension;

    constructor(extension: ChromeExtension) {
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

    liveFetch(): () => void {
        // Not supported
        return () => {};
    }
}
