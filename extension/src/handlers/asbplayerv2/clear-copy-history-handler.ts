import type { Command, Message } from '@project/common';
import { asbError } from '@project/common/util/log';
import type { CopyHistoryRepository } from '@project/common/copy-history';

export default class ClearCopyHistoryHandler {
    private readonly _copyHistoryRepository: CopyHistoryRepository;

    constructor(copyHistoryRepository: CopyHistoryRepository) {
        this._copyHistoryRepository = copyHistoryRepository;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'clear-copy-history';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: any) => void) {
        void this._copyHistoryRepository
            .clear()
            .then(() => sendResponse({}))
            .catch((error) => asbError('copy-history', 'Failed to clear copy history:', error));

        return true;
    }
}
