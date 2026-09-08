import type { Command, Message } from '@project/common';

export default class MobileOverlayForwarderHandler {
    get sender() {
        return 'asbplayer-mobile-overlay-to-video';
    }

    get command() {
        return null;
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
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

                // Non-extension page, need to send message via tabs API
                void browser.tabs.sendMessage(tabId, command);
            })
            .catch(() => {
                // Tab may have been closed
            });
        return false;
    }
}
