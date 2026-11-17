import type ChromeExtension from '@project/common/app/services/chrome-extension';
import type { Fetcher } from '@project/common';
import { HttpYomitanFetcher } from '@project/common/yomitan/yomitan-fetcher';
import type { YomitanFetcher } from '@project/common/yomitan/yomitan-fetcher';
import type { YomitanFetcherSettings } from '@project/common/settings';

export class AppExtensionYomitanFetcher implements YomitanFetcher {
    constructor(
        private readonly _extension: ChromeExtension,
        private readonly _yomitanFetcherSettings: YomitanFetcherSettings
    ) {}

    async fetch(action: string, body: object) {
        return this._extension.executeYomitanAction(action, body, this._yomitanFetcherSettings);
    }
}

export const createAppYomitanFetcher =
    (extension: ChromeExtension, httpFetcherFallback?: Fetcher) => (settings: YomitanFetcherSettings) => {
        // Older extensions lack the yomitan-execute handler and would leave the request hanging.
        if (settings.dictionaryYomitanTransport === 'extension' && extension.supportsYomitanExtensionMessaging) {
            return new AppExtensionYomitanFetcher(extension, settings);
        }
        return new HttpYomitanFetcher(settings.dictionaryYomitanUrl, httpFetcherFallback);
    };
