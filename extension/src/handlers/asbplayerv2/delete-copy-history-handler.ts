import type { Command, DeleteCopyHistoryMessage, Message } from '@project/common';
import { asbError } from '@project/common/util/log';
import type { CopyHistoryRepository } from '@project/common/copy-history';

export default class DeleteCopyHistoryHandler {
    private readonly _copyHistoryRepository: CopyHistoryRepository;
    constructor(copyHistoryRepository: CopyHistoryRepository) {
        this._copyHistoryRepository = copyHistoryRepository;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'delete-copy-history';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: any) => void) {
        const message = command.message as DeleteCopyHistoryMessage;
        Promise.all(message.ids.map((id) => this._copyHistoryRepository.delete(id)))
            .then(() => sendResponse({}))
            .catch((error) => asbError('copy-history', 'Failed to delete copy history items:', error));

        return true;
    }
}
