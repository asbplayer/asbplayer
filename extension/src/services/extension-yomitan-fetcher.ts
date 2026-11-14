import { HttpYomitanFetcher } from '@project/common/yomitan/yomitan-fetcher';
import { ExtensionToExtensionYomitanFetcher } from '@project/extension/src/services/extension-to-extension-yomitan-fetcher';
import type { YomitanFetcher } from '@project/common/yomitan/yomitan-fetcher';
import { v4 as uuidv4 } from 'uuid';
import type { Command, YomitanExecuteMessage } from '@project/common';
import type { YomitanFetcherSettings } from '@project/common/settings';

export class ExtensionForegroundYomitanFetcher implements YomitanFetcher {
    constructor(
        private readonly _yomitanFetcherSettings: YomitanFetcherSettings,
        private readonly _sender: string
    ) {}

    async fetch(action: string, body: object) {
        const response = await browser.runtime.sendMessage({
            sender: this._sender,
            message: {
                command: 'yomitan-execute',
                yomitanFetcherSettings: this._yomitanFetcherSettings,
                action,
                body,
                messageId: uuidv4(),
            },
        } satisfies Command<YomitanExecuteMessage>);
        // Surface handler failures instead of letting them be parsed as Yomitan data.
        if (response && typeof response === 'object' && 'error' in response) {
            throw new Error(response.error);
        }
        return response;
    }
}

export const createForegroundYomitanFetcher =
    (sender: string) =>
    (settings: YomitanFetcherSettings): YomitanFetcher =>
        new ExtensionForegroundYomitanFetcher(settings, sender);

export const createBackgroundYomitanFetcher =
    () =>
    (settings: YomitanFetcherSettings): YomitanFetcher =>
        settings.dictionaryYomitanTransport === 'extension'
            ? new ExtensionToExtensionYomitanFetcher(settings.dictionaryYomitanExtensionId)
            : new HttpYomitanFetcher(settings.dictionaryYomitanUrl);
