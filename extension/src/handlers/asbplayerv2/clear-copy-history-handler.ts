import type { Command, Message } from '@project/common';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';
import { SettingsProvider } from '@project/common/settings';

export default class ClearCopyHistoryHandler {
    private readonly _settings: SettingsProvider;
    constructor(settings: SettingsProvider) {
        this._settings = settings;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'clear-copy-history';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: any) => void) {
        void this._settings
            .getSingle('miningHistoryStorageLimit')
            .then((limit) => new IndexedDBCopyHistoryRepository(limit))
            .then((copyHistoryRepository) => {
                void copyHistoryRepository.clear().then(() => {
                    sendResponse({});
                });
            });

        return true;
    }
}
