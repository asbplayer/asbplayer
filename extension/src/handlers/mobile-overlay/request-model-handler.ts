import type { Command, Message } from '@project/common';

export default class RequestModelHandler {
    get sender() {
        return 'asbplayer-mobile-overlay-to-video';
    }

    get command() {
        return 'request-mobile-overlay-model';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        if (sender.tab?.id === undefined) {
            return;
        }

        const tabId = sender.tab.id;
        browser.tabs
            .get(tabId)
            .then((tab) => {
                if (tab.url?.startsWith(browser.runtime.getURL(''))) {
                    // runtime.sendMessage already goes directly to extension page content scripts
                    return;
                }

                void browser.tabs.sendMessage(tabId, command).then((model) => sendResponse(model));
            })
            .catch(() => {
                // Tab may have been closed
            });
        return true;
    }
}
