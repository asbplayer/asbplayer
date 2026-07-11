import { Command, Message } from '@project/common';

export default class CopyToClipboardHandler {
    constructor() {}

    get sender() {
        return ['asbplayer-video', 'asbplayer-video-tab'];
    }

    get command() {
        return 'copy-to-clipboard';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const tabId = sender.tab?.id;

        if (tabId === undefined) {
            return;
        }

        // Publish this command back to the tab so that the topmost window (i.e. non-iframe) can write the data to clipboard
        const extensionToVideoCommand = {
            sender: 'asbplayer-extension-to-video',
            message: command.message,
        };
        void browser.tabs.sendMessage(tabId, extensionToVideoCommand);
        return false;
    }
}
