import type { Command, Message, RequestCopyHistoryMessage, RequestCopyHistoryResponse } from '@project/common';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';

export default class RequestCopyHistoryHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'request-copy-history';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: any) => void) {
        const message = command.message as RequestCopyHistoryMessage;
        void new IndexedDBCopyHistoryRepository(message.count).fetch(message.count).then((copyHistoryItems) => {
            const response: RequestCopyHistoryResponse = {
                copyHistoryItems,
            };
            sendResponse(response);
        });
        return true;
    }
}
