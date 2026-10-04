import { asbError } from '@project/common/util/log';
import type {
    AsbPlayerToVideoCommandV2,
    Command,
    ExtensionToVideoCommand,
    Message,
    RequestSubtitlesMessage,
} from '@project/common';

export default class RequestSubtitlesHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'request-subtitles';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const { tabId, src } = command as AsbPlayerToVideoCommandV2<RequestSubtitlesMessage>;
        const requestSubtitlesFromTabCommand: ExtensionToVideoCommand<RequestSubtitlesMessage> = {
            sender: 'asbplayer-extension-to-video',
            src,
            message: {
                command: 'request-subtitles',
            },
        };
        void browser.tabs
            .sendMessage(tabId, requestSubtitlesFromTabCommand)
            .then(sendResponse)
            .catch((error) => asbError('video/request', 'Failed to request subtitles from the video tab:', error));
        return true;
    }
}
