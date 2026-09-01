import type TabRegistry from '@project/extension/src/services/tab-registry';
import type {
    AsbplayerInstance,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    Message,
    VideoTabModel,
} from '@project/common';
import { localMediaId, streamingMediaId } from '@project/extension/src/services/web-socket-media-id';

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

export const publishToAsbplayers = async <T extends Message>(
    tabRegistry: TabRegistry,
    targets: MediaTarget[],
    commandFactory: (asbplayerId: string) => ExtensionToAsbPlayerCommand<T>
) => {
    const ids = new Set(targets.filter(isAsbplayerTarget).map(({ asbplayer }) => asbplayer.id));

    if (ids.size === 0) {
        return;
    }

    await tabRegistry.publishCommandToAsbplayers({
        commandFactory: (asbplayer) => (ids.has(asbplayer.id) ? commandFactory(asbplayer.id) : undefined),
    });
};
