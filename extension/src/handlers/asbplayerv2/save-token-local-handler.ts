import {
    AsbPlayerToVideoCommandV2,
    Command,
    ExtensionToVideoCommand,
    Message,
    SaveTokenLocalMessage,
} from '@project/common';

export default class SaveTokenLocalHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'save-token-local';
    }

    handle(command: Command<Message>) {
        const { tabId, src } = command as AsbPlayerToVideoCommandV2<SaveTokenLocalMessage>;
        const { track, token, status, states, applyStates } = command.message as SaveTokenLocalMessage;
        const saveTokenLocalCommand: ExtensionToVideoCommand<SaveTokenLocalMessage> = {
            sender: 'asbplayer-extension-to-video',
            src,
            message: { command: 'save-token-local', track, token, status, states, applyStates },
        };
        void browser.tabs.sendMessage(tabId, saveTokenLocalCommand);
        return false;
    }
}
