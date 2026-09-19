import type TabRegistry from '@project/extension/src/services/tab-registry';
import type { SubtitleCue } from '@project/common/web-socket-client';
import type {
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    LocalSubtitlesResponseMessage,
    RequestLocalSubtitlesMessage,
    RequestSubtitlesMessage,
    RequestSubtitlesResponse,
    SubtitleModel,
} from '@project/common';

export const requestSubtitlesFromAsbplayer = async (
    tabRegistry: TabRegistry,
    asbplayerId: string
): Promise<SubtitleModel[] | undefined> => {
    const response = await tabRegistry.publishCommandToAsbplayersAndAwaitResponse<
        RequestLocalSubtitlesMessage,
        LocalSubtitlesResponseMessage
    >({
        asbplayerId,
        responseCommand: 'local-subtitles-response',
        commandFactory: (asbplayer, messageId): ExtensionToAsbPlayerCommand<RequestLocalSubtitlesMessage> => ({
            sender: 'asbplayer-extension-to-player',
            message: { command: 'request-local-subtitles', messageId },
            asbplayerId: asbplayer.id,
        }),
    });

    return response?.response.subtitles;
};

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

export const filterByTracks = (subtitles: SubtitleModel[], trackNumbers: number[] | undefined) => {
    if (trackNumbers === undefined || trackNumbers.length === 0) {
        return subtitles;
    }

    return subtitles.filter((subtitle) => trackNumbers.includes(subtitle.track));
};

export const toSubtitleCues = (subtitles: SubtitleModel[]): SubtitleCue[] =>
    subtitles.map(({ text, start, end, track }) => ({ text, start, end, track }));
