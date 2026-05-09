import { Command, Message } from '@project/common';

export default class StatisticsOverlayForwarderHandler {
    get sender() {
        return 'asbplayer-statistics-overlay-to-tab';
    }

    get command() {
        return null;
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        if (sender.tab?.id === undefined) {
            return;
        }

        browser.tabs.sendMessage(sender.tab.id, command);
        return false;
    }
}
