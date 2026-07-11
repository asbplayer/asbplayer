import { Command, Message, RequestingActiveTabPermsisionMessage, VideoToExtensionCommand } from '@project/common';
import { setRequestingActiveTabPermission } from '../../services/active-tab-permission-request';

export class RequestingActiveTabPermissionHandler {
    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'requesting-active-tab-permission';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const requestingActiveTabPermissionCommand =
            command as VideoToExtensionCommand<RequestingActiveTabPermsisionMessage>;

        if (sender.tab?.id !== undefined) {
            void setRequestingActiveTabPermission(
                sender.tab.id,
                requestingActiveTabPermissionCommand.src,
                requestingActiveTabPermissionCommand.message.requesting
            );
        }

        return false;
    }
}
