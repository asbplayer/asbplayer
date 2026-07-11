import { Command, Message } from '@project/common';
import { captureVisibleTab } from '../../services/capture-visible-tab';

export default class CaptureVisibleTabHandler {
    get sender() {
        return 'asbplayer-foreground';
    }

    get command() {
        return 'capture-visible-tab';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        if (sender.tab === undefined || sender.tab.id === undefined) {
            return;
        }

        void captureVisibleTab(sender.tab.id).then((dataUrl) => {
            sendResponse(dataUrl);
        });

        return true;
    }
}
