import { Command, Message } from '@project/common';

export default class StatisticsOverlayForwarderHandler {
    get sender() {
        return 'asbplayer-statistics-overlay-to-tab';
    }

    get command() {
        return null;
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        if (sender.tab?.id === undefined) {
            return;
        }

        void browser.tabs.sendMessage(sender.tab.id, command);
        return false;
    }
}
