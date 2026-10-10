import type {
    ExtensionToVideoCommand,
    ImageCaptureParams,
    RecordAnimatedWebpMessage,
    RecordAnimatedWebpResponse,
    StartAnimatedWebpMessage,
    StartAnimatedWebpResponse,
    StopAnimatedWebpMessage,
} from '@project/common';

// Obtains a tabCapture stream id (no picker). consumerTabId lets the content script in that tab
// consume it via getUserMedia. Chrome only — Firefox has no tabCapture API.
export const tabCaptureStreamId = (tabId: number): Promise<string> =>
    new Promise((resolve) =>
        browser.tabCapture.getMediaStreamId({ targetTabId: tabId, consumerTabId: tabId }, (streamId) =>
            resolve(streamId)
        )
    );

// The capture armed ahead of the mining seek was gone (discarded after a timeout) and the request carried no
// stream to arm another from, so a new one has to be negotiated
export class ArmedCaptureMissingError extends Error {}

// The content script reports a failed capture in its response, since errors can't be sent across contexts
const throwIfFailed = (response: RecordAnimatedWebpResponse) => {
    if (response.armedCaptureMissing) {
        throw new ArmedCaptureMissingError(response.error);
    }

    if (response.error) {
        throw new Error(response.error);
    }

    return response;
};

// Asks the content script to capture the tab stream, encoding its video frames into a cropped animated
// WebP and recording the audio in parallel. Returns the webp plus the audio webm when requested, and throws
// if the capture failed. streamId/fps/quality can be omitted when the content script already has a
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

    return throwIfFailed(await browser.tabs.sendMessage(tabId, command));
};

// Asks the content script to begin an open-ended capture (manual recording), responding as soon as the
// stream is flowing. The clip is collected later via stopAnimatedWebp.
export const startAnimatedWebp = async (
    tabId: number,
    src: string,
    recordAudio: boolean,
    captureParams: ImageCaptureParams,
    negotiation: { streamId: string; fps: number; quality: number }
): Promise<StartAnimatedWebpResponse> => {
    const command: ExtensionToVideoCommand<StartAnimatedWebpMessage> = {
        sender: 'asbplayer-extension-to-video',
        message: { command: 'start-animated-webp', recordAudio, ...negotiation, ...captureParams },
        src,
    };

    return browser.tabs.sendMessage(tabId, command);
};

// Ends the capture in progress (open-ended or timed) and returns whatever it recorded. Throws if it failed.
export const stopAnimatedWebp = async (tabId: number, src: string): Promise<RecordAnimatedWebpResponse> => {
    const command: ExtensionToVideoCommand<StopAnimatedWebpMessage> = {
        sender: 'asbplayer-extension-to-video',
        message: { command: 'stop-animated-webp' },
        src,
    };

    return throwIfFailed(await browser.tabs.sendMessage(tabId, command));
};
