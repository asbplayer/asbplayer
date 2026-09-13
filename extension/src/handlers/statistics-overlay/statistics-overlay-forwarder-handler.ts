import type { Command, Message } from '@project/common';

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

        // For now only element-exists requires a response
        if (command.message.command === 'element-exists') {
            void browser.tabs.sendMessage(sender.tab.id, command).then(sendResponse);
            return true;
        }

        void browser.tabs.sendMessage(sender.tab.id, command);
        return false;
    }
}
