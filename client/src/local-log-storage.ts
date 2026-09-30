import type { LogLine, LogSnapshot, LogStorage } from '@project/common/util/log-utils';
import { LOG_LINES_KEY, trimLogLines } from '@project/common/util/log-utils';

export class LocalLogStorage implements LogStorage {
    constructor(private readonly storage: Storage = window.sessionStorage) {}

    async append(lines: readonly LogLine[]): Promise<void> {
        if (lines.length === 0) return;
        this.storage.setItem(LOG_LINES_KEY, JSON.stringify(trimLogLines([...this.readLines(), ...lines])));
    }

    async getLogs(): Promise<LogSnapshot> {
        return { lines: this.readLines() };
    }

    private readLines(): LogLine[] {
        const value = this.storage.getItem(LOG_LINES_KEY);
        return value === null ? [] : (JSON.parse(value) as LogLine[]);
    }
}
