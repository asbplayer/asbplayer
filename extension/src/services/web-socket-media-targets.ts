import type TabRegistry from '@project/extension/src/services/tab-registry';
import type {
    AsbplayerInstance,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    Message,
    VideoTabModel,
    WebSocketCommandMessage,
    WebSocketCommandResponseMessage,
} from '@project/common';
import type { Response, WebSocketCommand } from '@project/common/web-socket-client';
import { localMediaId, streamingMediaId } from '@project/common/web-socket-client/web-socket-media';

export type MediaTarget = { videoElement: VideoTabModel } | { asbplayer: AsbplayerInstance };

export const isVideoElementTarget = (target: MediaTarget): target is { videoElement: VideoTabModel } =>
    'videoElement' in target;

export const isAsbplayerTarget = (target: MediaTarget): target is { asbplayer: AsbplayerInstance } =>
    'asbplayer' in target;

const videoElementKey = (tabId: number, src: string) => `${tabId}:${src}`;

const activeTabId = async () => (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;

export const resolveMediaTargets = async (
    tabRegistry: TabRegistry,
    mediaId: string | undefined
): Promise<MediaTarget[]> => {
    const videoElements = await tabRegistry.activeVideoElements();
    const asbplayers = (await tabRegistry.asbplayerInstances()).filter(
        (asbplayer) => !asbplayer.sidePanel && !asbplayer.videoPlayer
    );

    if (mediaId !== undefined) {
        const videoElement = videoElements.find((v) => streamingMediaId(v.id, v.src) === mediaId);

        if (videoElement !== undefined) {
            return [{ videoElement }];
        }

        const asbplayer = asbplayers.find((a) => localMediaId(a.id) === mediaId);
        return asbplayer === undefined ? [] : [{ asbplayer }];
    }

    const tabId = await activeTabId();

    if (tabId === undefined) {
        return [];
    }

    return [
        ...videoElements.filter((v) => v.id === tabId).map((videoElement) => ({ videoElement })),
        ...asbplayers.filter((a) => a.tabId === tabId).map((asbplayer) => ({ asbplayer })),
    ];
};

export const publishToVideoElements = async <T extends Message>(
    tabRegistry: TabRegistry,
    targets: MediaTarget[],
    commandFactory: (src: string) => ExtensionToVideoCommand<T>
) => {
    const keys = new Set(
        targets
            .filter(isVideoElementTarget)
            .map(({ videoElement }) => videoElementKey(videoElement.id, videoElement.src))
    );

    if (keys.size === 0) {
        return;
    }

    await tabRegistry.publishCommandToVideoElements((videoElement) =>
        keys.has(videoElementKey(videoElement.tab.id, videoElement.src)) ? commandFactory(videoElement.src) : undefined
    );
};

export const forwardToAsbplayers = async (
    tabRegistry: TabRegistry,
    targets: MediaTarget[],
    command: WebSocketCommand
): Promise<(Response<object> | undefined)[]> =>
    Promise.all(
        targets.filter(isAsbplayerTarget).map(async ({ asbplayer }) => {
            // The app treats the command as targeted at its own media, so it never re-decides what is active.
            const webSocketCommand = {
                ...command,
                body: { ...command.body, mediaId: localMediaId(asbplayer.id) },
            } as WebSocketCommand;
            const response = await tabRegistry.publishCommandToAsbplayersAndAwaitResponse<
                WebSocketCommandMessage,
                WebSocketCommandResponseMessage
            >({
                asbplayerId: asbplayer.id,
                responseCommand: 'web-socket-command-response',
                commandFactory: (_, messageId): ExtensionToAsbPlayerCommand<WebSocketCommandMessage> => ({
                    sender: 'asbplayer-extension-to-player',
                    message: { command: 'web-socket-command', messageId, webSocketCommand },
                    asbplayerId: asbplayer.id,
                }),
            });
            return response?.response;
        })
    );
