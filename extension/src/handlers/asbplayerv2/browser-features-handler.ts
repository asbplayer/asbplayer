import { isFirefoxBuild } from '@/services/build-flags';
import { Command, Message } from '@project/common';

export default class BrowserFeaturesHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'browser-features';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        sendResponse({
            sidePanel: browser.sidePanel !== undefined || isFirefoxBuild,
        });
        return false;
    }
}
