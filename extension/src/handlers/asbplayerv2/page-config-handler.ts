import { settingsPageConfigs } from '@/services/pages';
import type { Command, Message } from '@project/common';

export default class PageConfigHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'page-config';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        if (browser.commands === undefined) {
            sendResponse({});
            return false;
        }

        sendResponse(settingsPageConfigs);
        return false;
    }
}
