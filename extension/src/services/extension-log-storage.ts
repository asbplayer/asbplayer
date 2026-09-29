import type { AppendLogsMessage, AsbPlayerCommand, GetLogsMessage, GetLogsResponse } from '@project/common';
import type { LogLine, LogSnapshot, LogStorage } from '@project/common/util/log';
import { v4 as uuidv4 } from 'uuid';

export class ExtensionLogStorage implements LogStorage {
    async append(lines: readonly LogLine[]): Promise<void> {
        const message: AsbPlayerCommand<AppendLogsMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'append-logs',
                lines,
                messageId: uuidv4(),
            },
        };
        await browser.runtime.sendMessage(message);
    }

    getLogs(): Promise<LogSnapshot> {
        const message: AsbPlayerCommand<GetLogsMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'get-logs',
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message).then((response: GetLogsResponse) => {
            if ('error' in response) throw new Error(response.error);
            return response;
        });
    }
}
