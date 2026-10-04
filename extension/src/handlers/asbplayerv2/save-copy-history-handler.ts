import type { Command, Message, SaveCopyHistoryMessage } from '@project/common';
import { asbError } from '@project/common/util/log';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';
import type { SettingsProvider } from '@project/common/settings';

export default class SaveCopyHistoryHandler {
    private readonly _settings: SettingsProvider;
    constructor(settings: SettingsProvider) {
        this._settings = settings;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'save-copy-history';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: any) => void) {
        const message = command.message as SaveCopyHistoryMessage;

        void this._settings
            .getSingle('miningHistoryStorageLimit')
            .then((limit) => new IndexedDBCopyHistoryRepository(limit))
            .then((copyHistoryRepository) =>
                Promise.all(
                    message.copyHistoryItems.map((copyHistoryItem) => copyHistoryRepository.save(copyHistoryItem))
                )
            )
            .then(() => sendResponse({}))
            .catch((error) => asbError('copy-history', 'Failed to save copy history items:', error));

        return true;
    }
}
