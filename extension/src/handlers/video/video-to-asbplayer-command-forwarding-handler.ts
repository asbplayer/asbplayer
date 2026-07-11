import { Command, ExtensionToAsbPlayerCommand, Message, VideoToExtensionCommand } from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class VideoToAsbplayerCommandForwardingHandler {
    private readonly tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return null;
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const videoToExtensionCommand = command as VideoToExtensionCommand<Message>;

        if (typeof sender.tab?.id !== 'undefined') {
            const extensionToPlayerCommand: ExtensionToAsbPlayerCommand<Message> = {
                sender: 'asbplayer-extension-to-player',
                message: command.message,
                tabId: sender.tab.id,
                src: videoToExtensionCommand.src,
            };
            void this.tabRegistry.publishCommandToAsbplayers({ commandFactory: () => extensionToPlayerCommand });
        }

        return false;
    }
}
