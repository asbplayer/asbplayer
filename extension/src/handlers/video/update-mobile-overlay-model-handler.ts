import { Command, Message } from '@project/common';

export default class UpdateMobileOverlayModelHandler {
    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'update-mobile-overlay-model';
    }

    async handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        if (sender.tab?.id === undefined) {
            return;
        }

        // Need to send this back to the tab so that the overlay (inside an iframe) can receive the message.
        // Otherwise, the message is not received (on Firefox).
        void browser.tabs.sendMessage(sender.tab.id, { ...command, sender: 'asbplayer-video-to-mobile-overlay' });
    }
}
