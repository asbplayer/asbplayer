import {
    AsbPlayerToVideoCommandV2,
    Command,
    ExtensionToVideoCommand,
    Message,
    RequestCurrentSubtitleMessage,
} from '@project/common';

export default class RequestCurrentSubtitleHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'request-current-subtitle';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const { tabId, src } = command as AsbPlayerToVideoCommandV2<RequestCurrentSubtitleMessage>;
        const requestCurrentSubtitleFromTabCommand: ExtensionToVideoCommand<RequestCurrentSubtitleMessage> = {
            sender: 'asbplayer-extension-to-video',
            src,
            message: {
                command: 'request-current-subtitle',
            },
        };
        void browser.tabs.sendMessage(tabId, requestCurrentSubtitleFromTabCommand).then((response) => {
            sendResponse(response);
        });
        return true;
    }
}
