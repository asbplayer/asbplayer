import { asbError } from '@project/common/util/log';
import type { Command, Message } from '@project/common';
import type { SettingsProvider } from '@project/common/settings';
import { negotiateAnimatedWebp } from '@project/extension/src/services/animated-webp-media';

// Negotiates the animated-WebP settings and tabCapture stream id ahead of the mining seek, so
// RecordMediaHandler doesn't have to do it afterward - see armAnimatedWebpCapture for why that ordering
// matters.
export default class PrepareAnimatedWebpRecordingHandler {
    private readonly _settingsProvider: SettingsProvider;

    constructor(settingsProvider: SettingsProvider) {
        this._settingsProvider = settingsProvider;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'prepare-animated-webp-recording';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const tabId = sender.tab?.id;

        if (tabId === undefined) {
            sendResponse({ error: 'Cannot prepare animated WebP recording without a valid tab ID' });
            return true;
        }

        void negotiateAnimatedWebp(this._settingsProvider, tabId)
            .then((negotiation) => sendResponse(negotiation))
            .catch((e) => {
                asbError('recording/prepare-animated-webp', e);
                sendResponse({ error: String(e?.message ?? e) });
            });

        return true;
    }
}
