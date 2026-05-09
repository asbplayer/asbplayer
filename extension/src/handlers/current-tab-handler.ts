import { Command, Message } from '@project/common';

export default class CurrentTabHandler {
    get sender() {
        return ['asbplayer-mobile-overlay', 'asbplayer-statistics-overlay'];
    }

    get command() {
        return 'current-tab';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        sendResponse(sender.tab?.id);
        return false;
    }
}
