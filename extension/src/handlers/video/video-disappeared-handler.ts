import { Command, Message, VideoDisappearedMessage, VideoToExtensionCommand } from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class VideoDisappearedHandler {
    private readonly _tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'video-disappeared';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        if (sender.tab === undefined) {
            return;
        }

        const videoToExtensionCommand = command as VideoToExtensionCommand<VideoDisappearedMessage>;
        void this._tabRegistry.onVideoElementDisappeared(sender.tab, videoToExtensionCommand.src);
        return false;
    }
}
