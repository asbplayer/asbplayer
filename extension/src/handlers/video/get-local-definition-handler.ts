import type { Command, GetLocalDefinitionMessage, Message } from '@project/common';
import project from '@project/common/project';

const { host, port } = project.services.transcriber;

// Asks the local transcriber (transcriber/server.py), which calls the Claude API, for a word's meaning in context.
// Fetched here rather than in the page-origin Anki frame, which would be subject to CORS and local-network checks.
export default class GetLocalDefinitionHandler {
    get sender() {
        return ['asbplayer-video', 'asbplayer-video-tab'];
    }

    get command() {
        return 'get-local-definition';
    }

    handle(command: Command<Message>, _sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const { word, sentence } = command.message as GetLocalDefinitionMessage;
        const query = new URLSearchParams({ word, sentence });

        fetch(`http://${host}:${port}/define?${query}`)
            .then(async (response) => {
                const json = await response.json().catch(() => ({}));
                sendResponse(
                    response.ok ? { definition: json.definition } : { error: json.error ?? response.statusText }
                );
            })
            // The transcriber is optional, so being offline is the normal case, not an error.
            .catch(() => sendResponse({ error: 'transcriber offline' }));

        return true;
    }
}
