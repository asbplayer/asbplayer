import type ChromeExtension from '@project/common/app/services/chrome-extension';
import type { LogLine, LogSnapshot, LogStorage } from '@project/common/util/log';

export class AppExtensionLogStorage implements LogStorage {
    constructor(private readonly extension: ChromeExtension) {}

    append(lines: readonly LogLine[]): Promise<void> {
        return this.extension.appendLogs(lines);
    }

    getLogs(): Promise<LogSnapshot> {
        return this.extension.getLogs();
    }
}
