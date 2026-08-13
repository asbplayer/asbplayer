import type { Command, Message } from '@project/common';

export interface CommandHandler {
    sender: string | string[];
    command: string | null;
    handle: (
        command: Command<Message>,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => boolean | undefined | Promise<unknown>;
}
