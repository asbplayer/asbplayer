import type { Command, GetLocalDefinitionMessage, Message } from '@project/common';
import project from '@project/common/project';
import { getLocalLookupToken } from '@/services/local-lookup-token';

const { host, port } = project.services.transcriber;

// Only the extension-owned Anki dialog can spend local lookup quota.
export default class GetLocalDefinitionHandler {
    get sender() {
        return 'asbplayer-video-tab';
    }

    get command() {
        return 'get-local-definition';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        if (
            sender.id !== browser.runtime.id ||
            sender.url?.split('?')[0] !== browser.runtime.getURL('/anki-lookup.html')
        ) {
            return false;
        }

        const { word, sentence } = command.message as GetLocalDefinitionMessage;

        this._lookup(word, sentence)
            .then(sendResponse)
            .catch(() => sendResponse(undefined));

        return true;
    }

    private async _lookup(word: string, sentence: string) {
        const token = await getLocalLookupToken();
        if (token.length < 32) {
            return undefined;
        }

        const query = new URLSearchParams({ word, sentence });
        return fetch(`http://${host}:${port}/define?${query}`, {
            headers: { Authorization: `Bearer ${token}` },
            redirect: 'error',
        }).then(async (response) => {
            const json = await response.json().catch(() => ({}));
            return response.ok && typeof json.definition === 'string' ? { definition: json.definition } : undefined;
        });
    }
}
