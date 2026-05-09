import { Command, Message } from '@project/common';

export default class MobileOverlayForwarderHandler {
    get sender() {
        return 'asbplayer-mobile-overlay-to-video';
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
