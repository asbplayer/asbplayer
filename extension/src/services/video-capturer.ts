import type { CaptureArea, ExtensionToVideoCommand, RectModel, ResolveCaptureAreaMessage } from '@project/common';

// Obtains a tabCapture stream id (no picker) for the offscreen document to consume via getUserMedia. Chrome only —
// Firefox has no tabCapture API.
export const tabCaptureStreamId = (tabId: number): Promise<string> =>
    new Promise((resolve, reject) => {
        browser.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
            const error = browser.runtime.lastError;
            if (error || !streamId) {
                reject(new Error(error?.message ?? 'Failed to obtain a tab capture stream ID'));
            } else {
                resolve(streamId);
            }
        });
    });

// Asks the tab's root frame for the area to capture for a video, in the page's coordinates
export const resolveCaptureArea = (
    tabId: number,
    src: string,
    rect: RectModel,
    frameId: string | undefined
): Promise<CaptureArea> => {
    const command: ExtensionToVideoCommand<ResolveCaptureAreaMessage> = {
        sender: 'asbplayer-extension-to-video',
        message: { command: 'resolve-capture-area', rect, frameId },
        src,
    };
    return browser.tabs.sendMessage(tabId, command);
};
