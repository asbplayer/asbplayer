import type { Command, Message } from '@project/common';

export default class ExtensionCommandsHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'extension-commands';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        if (browser.commands === undefined) {
            sendResponse({});
            return false;
        }

        browser.commands.getAll((commands) => {
            const commandsObj: any = {};

            for (const c of commands) {
                if (c.name && c.shortcut) {
                    commandsObj[c.name] = c.shortcut;
                }
            }

            sendResponse(commandsObj);
        });

        return true;
    }
}
