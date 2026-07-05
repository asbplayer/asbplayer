import {
    ExtensionToVideoCommand,
    ImageCaptureParams,
    RecordAnimatedWebpMessage,
    RecordAnimatedWebpResponse,
} from '@project/common';

// Obtains a tabCapture stream id (no picker). consumerTabId lets the content script in that tab
// consume it via getUserMedia. Chrome only — Firefox has no tabCapture API.
export const tabCaptureStreamId = (tabId: number): Promise<string> =>
    new Promise((resolve) =>
        browser.tabCapture.getMediaStreamId({ targetTabId: tabId, consumerTabId: tabId } as any, (streamId) =>
            resolve(streamId)
        )
    );

// Asks the content script to capture the tab stream, encoding its video frames into a cropped animated
// WebP and recording the audio in parallel. Returns the webp (empty string on failure) plus the audio
// webm when requested.
export const recordAnimatedWebp = async (
    tabId: number,
    src: string,
    streamId: string,
    durationMs: number,
    fps: number,
    quality: number,
    recordAudio: boolean,
    captureParams: ImageCaptureParams
): Promise<RecordAnimatedWebpResponse> => {
    const command: ExtensionToVideoCommand<RecordAnimatedWebpMessage> = {
        sender: 'asbplayer-extension-to-video',
        message: { command: 'record-animated-webp', streamId, durationMs, fps, quality, recordAudio, ...captureParams },
        src,
    };

    const response = (await browser.tabs.sendMessage(tabId, command)) as RecordAnimatedWebpResponse;

    if (response.error) {
        console.error('Animated WebP recording failed:', response.error);
    }

    return response;
};
