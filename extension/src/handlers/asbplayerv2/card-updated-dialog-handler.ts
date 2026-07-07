import {
    AsbPlayerToVideoCommandV2,
    CardUpdatedDialogMessage,
    Command,
    ExtensionToVideoCommand,
    Message,
} from '@project/common';

export default class CardUpdatedDialogHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'card-updated-dialog';
    }

    handle(command: Command<Message>) {
        const { tabId, src } = command as AsbPlayerToVideoCommandV2<CardUpdatedDialogMessage>;
        const cardUpdatedDialogFromTabCommand: ExtensionToVideoCommand<CardUpdatedDialogMessage> = {
            sender: 'asbplayer-extension-to-video',
            src,
            message: {
                command: 'card-updated-dialog',
            },
        };
        void browser.tabs.sendMessage(tabId, cardUpdatedDialogFromTabCommand);
        return true;
    }
}
