import { asbError } from '@project/common/util';
import type {
    ExtensionToVideoCommand,
    ImageCaptureParams,
    RecordAnimatedWebpMessage,
    RecordAnimatedWebpResponse,
} from '@project/common';

// Obtains a tabCapture stream id (no picker). consumerTabId lets the content script in that tab
// consume it via getUserMedia. Chrome only — Firefox has no tabCapture API.
export const tabCaptureStreamId = (tabId: number): Promise<string> =>
    new Promise((resolve) =>
        browser.tabCapture.getMediaStreamId({ targetTabId: tabId, consumerTabId: tabId }, (streamId) =>
            resolve(streamId)
        )
    );

// Asks the content script to capture the tab stream, encoding its video frames into a cropped animated
// WebP and recording the audio in parallel. Returns the webp (empty string on failure) plus the audio
// webm when requested. streamId/fps/quality can be omitted when the content script already has a
// capture armed from a prior PrepareAnimatedWebpRecordingMessage - it uses that instead.
export const recordAnimatedWebp = async (
    tabId: number,
    src: string,
    durationMs: number,
    recordAudio: boolean,
    captureParams: ImageCaptureParams,
    negotiation?: { streamId: string; fps: number; quality: number }
): Promise<RecordAnimatedWebpResponse> => {
    const { streamId, fps, quality } = negotiation ?? {};
    const command: ExtensionToVideoCommand<RecordAnimatedWebpMessage> = {
        sender: 'asbplayer-extension-to-video',
        message: { command: 'record-animated-webp', streamId, durationMs, fps, quality, recordAudio, ...captureParams },
        src,
    };

    const response: RecordAnimatedWebpResponse = await browser.tabs.sendMessage(tabId, command);

    if (response.error) {
        asbError('recording/animated-webp', response.error);
    }

    return response;
};
