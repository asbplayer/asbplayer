import { Command, Message } from '@project/common';

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

        void browser.tabs.sendMessage(sender.tab.id, command).then((model) => sendResponse(model));
        return true;
    }
}
