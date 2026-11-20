import type {
    Command,
    EpisodeTranscriptionMessage,
    Message,
    ExtensionToOffscreenDocumentCommand,
    CaptureEpisodeAudioMessage,
} from '@project/common';
import { ensureOffscreenAudioServiceDocument } from '@/services/offscreen-document';
import { localTranscriberUrl } from '@/services/local-transcriber';
import type { TranscriptionResponse } from '@/services/local-transcriber';
import { tabCaptureStreamId } from '@/services/video-capturer';

export default class EpisodeTranscriptionHandler {
    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'episode-transcription';
    }

    handle(
        command: Command<Message>,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response: TranscriptionResponse) => void
    ) {
        if (sender.tab?.id === undefined || !browser.tabCapture) return false;

        void this._handle(command.message as EpisodeTranscriptionMessage, sender.tab.id).then(sendResponse, (error) => {
            sendResponse({ error: error instanceof Error ? error.message : String(error) });
        });
        return true;
    }

    private async _handle(
        { operation, id }: EpisodeTranscriptionMessage,
        tabId: number
    ): Promise<TranscriptionResponse> {
        if (operation.action === 'status' || operation.action === 'start') {
            const response = await fetch(localTranscriberUrl('jobs', operation.key), {
                signal: AbortSignal.timeout(5000),
            }).catch(() => {
                throw new Error('The local Whisper server is unavailable. Start asbplayer Whisper and try again.');
            });
            const job = response.ok ? await response.json() : undefined;
            if (!response.ok && response.status !== 404) {
                throw new Error('The Whisper server could not check the episode.');
            }
            if (operation.action === 'status') return { job };
            if (job?.state === 'queued' || job?.state === 'running') {
                throw new Error('Whisper is already processing this episode.');
            }
        }

        let streamId: string | undefined;
        if (operation.action === 'start') {
            await ensureOffscreenAudioServiceDocument();
            streamId = await tabCaptureStreamId(tabId).catch((error: Error) => {
                if (/invoked|activeTab|permission/i.test(error.message)) {
                    throw new Error('Click the asbplayer toolbar icon on this tab and try again.');
                }
                throw error;
            });
        }

        const command: ExtensionToOffscreenDocumentCommand<CaptureEpisodeAudioMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: { command: 'capture-episode-audio', id, tabId, operation, streamId },
        };
        return browser.runtime.sendMessage(command);
    }
}
