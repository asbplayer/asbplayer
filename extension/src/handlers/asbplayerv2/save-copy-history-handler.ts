import type { Command, Message, SaveCopyHistoryMessage } from '@project/common';
import { asbError } from '@project/common/util/log';
import type { CopyHistoryRepository } from '@project/common/copy-history';

export default class SaveCopyHistoryHandler {
    private readonly _copyHistoryRepository: CopyHistoryRepository;
    constructor(copyHistoryRepository: CopyHistoryRepository) {
        this._copyHistoryRepository = copyHistoryRepository;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'save-copy-history';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: any) => void) {
        const message = command.message as SaveCopyHistoryMessage;

        Promise.all(
            message.copyHistoryItems.map((copyHistoryItem) => this._copyHistoryRepository.save(copyHistoryItem))
        )
            .then(() => sendResponse({}))
            .catch((error) => asbError('copy-history', 'Failed to save copy history items:', error));

        return true;
    }
}
