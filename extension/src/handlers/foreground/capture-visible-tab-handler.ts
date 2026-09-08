import type { Command, Message } from '@project/common';
import { asbWarn } from '@project/common/util';
import { captureVisibleTab } from '@project/extension/src/services/capture-visible-tab';

export default class CaptureVisibleTabHandler {
    get sender() {
        return 'asbplayer-foreground';
    }

    get command() {
        return 'capture-visible-tab';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        if (sender.tab === undefined || sender.tab.id === undefined) {
            return;
        }

        void captureVisibleTab(sender.tab.id)
            .then((dataUrl: string) => {
                sendResponse(dataUrl);
            })
            .catch((e) => {
                // It's normal to get here since the user might not have the activeTab permission
                asbWarn(
                    'background/capture-visible-tab',
                    'failed to capture visible tab - responding with empty string',
                    e
                );
                sendResponse('');
            });

        return true;
    }
}
