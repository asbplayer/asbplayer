import type { LogProvider } from '@project/common/util/log';
import type { LogLine, LogStorage } from '@project/common/util/log-utils';

type LogRequest = {
    sender?: string;
    message?: { command?: string; lines?: readonly LogLine[] };
};

export function handleLogMessage(
    request: LogRequest,
    sendResponse: (response: unknown) => void,
    logStore: LogStorage,
    logProvider: LogProvider
): boolean {
    if (request?.sender !== 'asbplayerv2') return false;
    const command = request.message?.command;
    if (command === 'append-logs') {
        // Always respond so the sender's write queue is not stalled; there is nowhere to report a failed write.
        const respond = () => sendResponse({});
        void logStore.append(request.message?.lines ?? []).then(respond, respond);
        return true;
    }
    if (command === 'get-logs') {
        void logProvider
            .flush()
            .then(() => logStore.getLogs())
            .then(sendResponse, (error) =>
                sendResponse({ error: error instanceof Error ? error.message : String(error) })
            );
        return true;
    }
    return false;
}
