import { AsbplayerHeartbeatMessage, Command, Message } from '@project/common';
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
        return 'heartbeat';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const message = command.message as AsbplayerHeartbeatMessage;
        void this.tabRegistry.onAsbplayerHeartbeat(sender.tab, message);
        return false;
    }
}
