import type { Command, Message, YomitanExecuteMessage } from '@project/common';
import { asbError } from '@project/common/util/log';
import type { SettingsProvider } from '@project/common/settings';
import { HttpYomitanFetcher } from '@project/common/yomitan/yomitan-fetcher';
import { ExtensionToExtensionYomitanFetcher } from '@/services/extension-to-extension-yomitan-fetcher';

export default class YomitanExecuteHandler {
    private readonly portFetchers = new Map<string, ExtensionToExtensionYomitanFetcher>();

    constructor(
        private readonly _settings: SettingsProvider,
        private readonly _createPortFetcher: (yomitanExtensionId: string) => ExtensionToExtensionYomitanFetcher = (
            id
        ) => new ExtensionToExtensionYomitanFetcher(id)
    ) {}

    get sender() {
        return ['asbplayer-popup', 'asbplayer-settings', 'asbplayer-video', 'asbplayerv2'];
    }

    get command() {
        return 'yomitan-execute';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const message = command.message as YomitanExecuteMessage;

        this._serve(message)
            .then((data) => sendResponse(data))
            .catch((e) => {
                asbError('yomitan-execute', e);
                sendResponse({ error: e.message });
            });

        return true;
    }

    private async _serve(message: YomitanExecuteMessage) {
        const fetcher =
            message.yomitanFetcherSettings.dictionaryYomitanTransport === 'extension'
                ? this._portFetcher(message.yomitanFetcherSettings.dictionaryYomitanExtensionId)
                : new HttpYomitanFetcher(message.yomitanFetcherSettings.dictionaryYomitanUrl);
        return fetcher.fetch(message.action, message.body);
    }

    private _portFetcher(yomitanExtensionId: string): ExtensionToExtensionYomitanFetcher {
        let fetcher = this.portFetchers.get(yomitanExtensionId);
        if (!fetcher) {
            fetcher = this._createPortFetcher(yomitanExtensionId);
            this.portFetchers.set(yomitanExtensionId, fetcher);
        }
        return fetcher;
    }
}
