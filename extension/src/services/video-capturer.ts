import type { CaptureArea, ExtensionToVideoCommand, RectModel, ResolveCaptureAreaMessage } from '@project/common';

// Obtains a tabCapture stream id (no picker) for the offscreen document to consume via getUserMedia. Chrome only —
// Firefox has no tabCapture API.
export const tabCaptureStreamId = (tabId: number): Promise<string> =>
    new Promise((resolve) =>
        browser.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => resolve(streamId))
    );

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
