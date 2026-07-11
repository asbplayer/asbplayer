import type { Command, DeleteCopyHistoryMessage, Message } from '@project/common';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';
import { SettingsProvider } from '@project/common/settings';

export default class DeleteCopyHistoryHandler {
    private readonly _settings: SettingsProvider;
    constructor(settings: SettingsProvider) {
        this._settings = settings;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'delete-copy-history';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: any) => void) {
        const message = command.message as DeleteCopyHistoryMessage;
        void this._settings
            .getSingle('miningHistoryStorageLimit')
            .then((limit) => new IndexedDBCopyHistoryRepository(limit))
            .then((copyHistoryRepository) => {
                return Promise.all(message.ids.map((id) => copyHistoryRepository.delete(id))).then(() => {
                    sendResponse({});
                });
            });

        return true;
    }
}
