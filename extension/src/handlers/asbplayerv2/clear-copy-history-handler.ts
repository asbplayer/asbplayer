import type { Command, Message } from '@project/common';
import { asbError } from '@project/common/util/log';
import { ExtensionCopyHistoryRepository } from '@project/extension/src/services/copy-history-repository';
import type { SettingsProvider } from '@project/common/settings';
import type TabRegistry from '@project/extension/src/services/tab-registry';

export default class ClearCopyHistoryHandler {
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
        return 'clear-copy-history';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (r?: any) => void) {
        void this._settings
            .getSingle('miningHistoryStorageLimit')
            .then((limit) => new ExtensionCopyHistoryRepository(limit, this._tabRegistry))
            .then((copyHistoryRepository) => copyHistoryRepository.clear())
            .then(() => sendResponse({}))
            .catch((error) => asbError('copy-history', 'Failed to clear copy history:', error));

        return true;
    }
}
