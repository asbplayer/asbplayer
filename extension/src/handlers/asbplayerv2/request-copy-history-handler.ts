import type { Command, Message, RequestCopyHistoryMessage, RequestCopyHistoryResponse } from '@project/common';
import { asbError } from '@project/common/util/log';
import type { CopyHistoryRepository } from '@project/common/copy-history';

export default class RequestCopyHistoryHandler {
    private readonly _copyHistoryRepository;

    constructor(copyHistoryRepository: CopyHistoryRepository) {
        this._copyHistoryRepository = copyHistoryRepository;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'request-copy-history';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: any) => void) {
        const message = command.message as RequestCopyHistoryMessage;
        void this._copyHistoryRepository
            .fetch(message.count, message.cardIds)
            .then((copyHistoryItems) => {
                const response: RequestCopyHistoryResponse = {
                    copyHistoryItems,
                };
                sendResponse(response);
            })
            .catch((error) => asbError('copy-history', 'Failed to load copy history:', error));
        return true;
    }
}
