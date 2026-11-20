import type { Command, GetLocalTranscriptMessage, Message } from '@project/common';
import project from '@project/common/project';

const { host, port } = project.services.transcriber;

// Fetched here rather than in the content script, which would be subject to the page's CORS and local-network checks.
export default class GetLocalTranscriptHandler {
    get sender() {
        return ['asbplayer-video', 'asbplayer-video-tab'];
    }

    get command() {
        return 'get-local-transcript';
    }

    handle(command: Command<Message>, _sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const { key } = command.message as GetLocalTranscriptMessage;

        fetch(`http://${host}:${port}/subtitles?key=${encodeURIComponent(key)}`)
            .then(async (response) => sendResponse(response.ok ? await response.text() : undefined))
            // The transcriber is optional, so being offline is the normal case, not an error.
            .catch(() => sendResponse(undefined));

        return true;
    }
}
