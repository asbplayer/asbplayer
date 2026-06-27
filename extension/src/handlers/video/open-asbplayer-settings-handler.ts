import { Command, Message, OpenAsbplayerSettingsMessage } from '@project/common';

export default class OpenAsbplayerSettingsHandler {
    get sender() {
        return ['asbplayer-video', 'asbplayer-video-tab'];
    }

    get command() {
        return 'open-asbplayer-settings';
    }

    async handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const { tutorial, scrollToId } = command.message as OpenAsbplayerSettingsMessage;
        const hash = scrollToId ? `#${scrollToId}` : '';

        if (tutorial) {
            browser.tabs.create({ active: true, url: browser.runtime.getURL(`/options.html?tutorial=true${hash}`) });
        } else if (scrollToId) {
            browser.tabs.create({ active: true, url: browser.runtime.getURL(`/options.html${hash}`) });
        } else {
            browser.runtime.openOptionsPage();
        }
    }
}
