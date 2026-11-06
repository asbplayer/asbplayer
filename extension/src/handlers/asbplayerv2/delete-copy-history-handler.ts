import type { Command, DeleteCopyHistoryMessage, Message } from '@project/common';
import { asbError } from '@project/common/util/log';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history';
import type { SettingsProvider } from '@project/common/settings';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import { publishCopyHistoryRemoval } from '@project/extension/src/services/copy-history-removal';

export default class DeleteCopyHistoryHandler {
    private readonly _settings: SettingsProvider;
    constructor(
        settings: SettingsProvider,
        private readonly _tabRegistry: TabRegistry
    ) {
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
            .then((copyHistoryRepository) => Promise.all(message.ids.map((id) => copyHistoryRepository.delete(id))))
            .then(() => publishCopyHistoryRemoval(this._tabRegistry, message.ids))
            .then(() => sendResponse({}))
            .catch((error) => asbError('copy-history', 'Failed to delete copy history items:', error));

        return true;
    }
}
