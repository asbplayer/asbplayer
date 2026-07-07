import { Command, Message } from '@project/common';

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

        void browser.tabs.sendMessage(sender.tab.id, command);
        return false;
    }
}
