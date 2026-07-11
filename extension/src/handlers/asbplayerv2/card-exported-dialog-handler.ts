import {
    AsbPlayerToVideoCommandV2,
    CardExportedDialogMessage,
    Command,
    ExtensionToVideoCommand,
    Message,
} from '@project/common';

export default class CardExportedDialogHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'card-exported-dialog';
    }

    handle(command: Command<Message>) {
        const { tabId, src } = command as AsbPlayerToVideoCommandV2<CardExportedDialogMessage>;
        const cardExportedDialogFromTabCommand: ExtensionToVideoCommand<CardExportedDialogMessage> = {
            sender: 'asbplayer-extension-to-video',
            src,
            message: {
                command: 'card-exported-dialog',
            },
        };
        void browser.tabs.sendMessage(tabId, cardExportedDialogFromTabCommand);
        return true;
    }
}
