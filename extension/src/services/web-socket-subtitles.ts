import type {
    ExtensionToVideoCommand,
    RequestSubtitlesMessage,
    RequestSubtitlesResponse,
    SubtitleModel,
} from '@project/common';

export const requestSubtitlesFromVideoElement = async (
    tabId: number,
    src: string
): Promise<SubtitleModel[] | undefined> => {
    const requestSubtitlesCommand: ExtensionToVideoCommand<RequestSubtitlesMessage> = {
        sender: 'asbplayer-extension-to-video',
        src,
        message: { command: 'request-subtitles' },
    };

    try {
        const response: RequestSubtitlesResponse | undefined = await browser.tabs.sendMessage(
            tabId,
            requestSubtitlesCommand
        );
        return response?.subtitles;
    } catch {
        // Targeting a non-active/discarded tab can fail
        return undefined;
    }
};
