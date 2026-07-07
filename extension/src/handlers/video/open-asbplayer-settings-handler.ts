import { Command, Message, OpenAsbplayerSettingsMessage } from '@project/common';

export default class OpenAsbplayerSettingsHandler {
    get sender() {
        return ['asbplayer-video', 'asbplayer-video-tab'];
    }

    get command() {
        return 'open-asbplayer-settings';
    }

    async handle(command: Command<Message>) {
        const { tutorial, scrollToId } = command.message as OpenAsbplayerSettingsMessage;
        const hash = scrollToId ? `#${scrollToId}` : '';

        if (tutorial) {
            void browser.tabs.create({
                active: true,
                url: browser.runtime.getURL(`/options.html?tutorial=true${hash}`),
            });
        } else if (scrollToId) {
            void browser.tabs.create({ active: true, url: browser.runtime.getURL(`/options.html${hash}`) });
        } else {
            void browser.runtime.openOptionsPage();
        }
    }
}
