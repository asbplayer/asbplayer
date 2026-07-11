import { AckTabsMessage, Command, Message } from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class AsbplayerHeartbeatHandler {
    private readonly tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'ackTabs';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const message = command.message as AckTabsMessage;
        void this.tabRegistry.onAsbplayerAckTabs(sender.tab, message);
        return false;
    }
}
