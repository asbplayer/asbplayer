import TabRegistry from '@/services/tab-registry';
import { Command, Message, OpenStatisticsOverlayMessage } from '@project/common';

export default class OpenStatisticsOverlayHandler {
    private readonly _tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return ['asbplayerv2', 'asbplayer-popup'];
    }

    get command() {
        return 'open-statistics-overlay';
    }

    async handle(
        command: Command<Message>,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) {
        const openCommand: Command<OpenStatisticsOverlayMessage> = command as Command<OpenStatisticsOverlayMessage>;
        void this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => {
                if (asbplayer.sidePanel) return;

                if (
                    asbplayer.id === openCommand.message.mediaId ||
                    asbplayer.syncedVideoElement?.src === openCommand.message.mediaId
                ) {
                    return {
                        sender: 'asbplayer-extension-to-player',
                        message: openCommand.message,
                    };
                }
            },
        });
        void this._tabRegistry.publishCommandToVideoElements((videoElement) => {
            if (videoElement.src === openCommand.message.mediaId) {
                return {
                    sender: 'asbplayer-extension-to-video',
                    message: openCommand.message,
                    src: videoElement.src,
                };
            }
        });
        return false;
    }
}
