import type { Command, Message, SaveCopyHistoryMessage } from '@project/common';
import { asbError } from '@project/common/util/log';
import { ExtensionCopyHistoryRepository } from '@project/extension/src/services/copy-history-repository';
import type { SettingsProvider } from '@project/common/settings';
import type TabRegistry from '@project/extension/src/services/tab-registry';

export default class SaveCopyHistoryHandler {
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
        return 'save-copy-history';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: any) => void) {
        const message = command.message as SaveCopyHistoryMessage;

        void this._settings
            .getSingle('miningHistoryStorageLimit')
            .then((limit) => new ExtensionCopyHistoryRepository(limit, this._tabRegistry))
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
