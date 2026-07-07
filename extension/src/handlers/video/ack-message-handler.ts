import { AckMessage, Command, ExtensionToAsbPlayerCommand, Message } from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class AckMessageHandler {
    private readonly _tabRegistry: TabRegistry;
    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'ack-message';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const message = command.message as AckMessage;
        const ackCommand: ExtensionToAsbPlayerCommand<AckMessage> = {
            sender: 'asbplayer-extension-to-player',
            message,
        };
        void this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: () => ackCommand,
        });
        return false;
    }
}
