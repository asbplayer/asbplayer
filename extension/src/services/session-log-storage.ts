import type { LogLine, LogSnapshot, LogStorage } from '@project/common/util/log';
import { LOG_LINES_KEY, trimLogLines } from '@project/common/util/log';
import type { StorageArea } from '@project/extension/src/services/extension-settings-storage';

export class SessionLogStorage implements LogStorage {
    private writeQueue: Promise<void> = Promise.resolve();

    constructor(private readonly storage: Pick<StorageArea, 'get' | 'set'> = browser.storage.session) {}

    append(lines: readonly LogLine[]): Promise<void> {
        if (lines.length === 0) return Promise.resolve();

        const write = this.writeQueue.then(async () => {
            const existing = (await this.storage.get(LOG_LINES_KEY))[LOG_LINES_KEY] as LogLine[] | undefined;
            await this.storage.set({ [LOG_LINES_KEY]: trimLogLines([...(existing ?? []), ...lines]) });
        });
        this.writeQueue = write.catch(() => undefined);
        return write;
    }

    async getLogs(): Promise<LogSnapshot> {
        await this.writeQueue;
        const lines = (await this.storage.get(LOG_LINES_KEY))[LOG_LINES_KEY] as LogLine[] | undefined;
        return { lines: lines ?? [] };
    }
}
