import { SettingsProvider, ankiSettingsKeys } from '@project/common/settings';
import {
    BoundMedia,
    LoadSubtitlesCommand,
    MineSubtitleCommand,
    SeekTimestampCommand,
    WebSocketClient,
} from '@project/common/web-socket-client';
import TabRegistry from './tab-registry';
import {
    CopySubtitleMessage,
    CopySubtitleWithAdditionalFieldsMessage,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    Message,
    PostMineAction,
    ToggleVideoSelectMessage,
} from '@project/common';

let client: WebSocketClient | undefined;

// Derives a human-readable title from a subtitle file name by dropping its extension.
const withoutExtension = (fileName: string) => {
    const dot = fileName.lastIndexOf('.');
    return dot > 0 ? fileName.substring(0, dot) : fileName;
};

// cyrb53 string hash...should be collision resistant and fast to compute
const cyrb53 = (str: string) => {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;

    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

const boundMediaId = (key: string) => cyrb53(key);

export const bindWebSocketClient = async (settings: SettingsProvider, tabRegistry: TabRegistry) => {
    client?.unbind();
    const url = await settings.getSingle('webSocketServerUrl');

    if (!url) {
        return;
    }

    client = new WebSocketClient();
    client.bind(url);
    client.onMineSubtitle = async ({
        body: { fields: receivedFields, postMineAction: receivedPostMineAction },
    }: MineSubtitleCommand) => {
        return new Promise((resolve, reject) => {
            browser.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                const ankiSettings = await settings.get(ankiSettingsKeys);
                const fields = receivedFields ?? {};
                const word = fields[ankiSettings.wordField] || undefined;
                const definition = fields[ankiSettings.definitionField] || undefined;
                const text = fields[ankiSettings.sentenceField] || undefined;
                const customFieldValues = Object.fromEntries(
                    Object.entries(ankiSettings.customAnkiFields)
                        .map(([asbplayerFieldName, ankiFieldName]) => {
                            const fieldValue = fields[ankiFieldName];

                            if (fieldValue === undefined) {
                                return undefined;
                            }

                            return [asbplayerFieldName, fieldValue];
                        })
                        .filter((entry) => entry !== undefined) as string[][]
                );
                const postMineAction = receivedPostMineAction ?? PostMineAction.showAnkiDialog;
                let published = false;

                const publishToVideoElements = tabRegistry.publishCommandToVideoElements((videoElement) => {
                    if (!videoElement.loadedSubtitles) {
                        return undefined;
                    }

                    if (tabs.find((t) => t.id === videoElement.tab.id) === undefined) {
                        return undefined;
                    }

                    published = true;
                    const extensionToVideoCommand: ExtensionToVideoCommand<CopySubtitleMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'copy-subtitle',
                            word,
                            definition,
                            text,
                            postMineAction,
                            customFieldValues,
                        },
                        src: videoElement.src,
                    };
                    return extensionToVideoCommand;
                });

                const publishToAsbplayers = await tabRegistry.publishCommandToAsbplayers({
                    commandFactory: (asbplayer) => {
                        if (asbplayer.sidePanel || !asbplayer.loadedSubtitles) {
                            return undefined;
                        }

                        published = true;
                        const extensionToPlayerCommand: ExtensionToAsbPlayerCommand<CopySubtitleWithAdditionalFieldsMessage> =
                            {
                                sender: 'asbplayer-extension-to-player',
                                message: {
                                    command: 'copy-subtitle-with-additional-fields',
                                    word,
                                    definition,
                                    text,
                                    postMineAction,
                                    customFieldValues,
                                },
                                asbplayerId: asbplayer.id,
                            };
                        return extensionToPlayerCommand;
                    },
                });

                await publishToVideoElements;
                await publishToAsbplayers;
                resolve(published);
            });
        });
    };
    client.onLoadSubtitles = async (command: LoadSubtitlesCommand) => {
        const { files: subtitleFiles } = command.body;
        const toggleVideoSelectCommand: ExtensionToVideoCommand<ToggleVideoSelectMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'toggle-video-select',
                subtitleFiles,
            },
        };
        tabRegistry.publishCommandToVideoElementTabs((tab): ExtensionToVideoCommand<Message> | undefined => {
            return toggleVideoSelectCommand;
        });
    };
    client.onSeekTimestamp = async ({ body: { timestamp } }: SeekTimestampCommand) => {
        return new Promise<void>((resolve) => {
            // Publish the command to the active tab video element
            browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                tabRegistry.publishCommandToVideoElements((videoElement) => {
                    if (tabs.find((t) => t.id === videoElement.tab.id) === undefined) {
                        return undefined;
                    }

                    return {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'currentTime',
                            value: timestamp,
                        },
                        src: videoElement.src,
                    };
                });

                resolve();
            });
        });
    };
    client.onGetBoundMedia = async (): Promise<BoundMedia[]> => {
        const videoElements = await tabRegistry.activeVideoElements();
        const asbplayerInstances = await tabRegistry.asbplayerInstances();
        const allTabs = await browser.tabs.query({});
        const activeByTabId = new Map<number, boolean>();

        for (const tab of allTabs) {
            if (tab.id !== undefined) {
                activeByTabId.set(tab.id, tab.active ?? false);
            }
        }

        const streamingMedia: BoundMedia[] = videoElements.map((videoElement) => ({
            id: boundMediaId(`streaming:${videoElement.id}:${videoElement.src}`),
            type: 'streaming',
            title: videoElement.title,
            faviconUrl: videoElement.faviconUrl,
            loadedSubtitles: videoElement.subtitleTracks ?? [],
            active: activeByTabId.get(videoElement.id) ?? false,
        }));

        // Include asbplayer webapp instances that have media loaded, excluding side-panel instances
        const localMedia: BoundMedia[] = asbplayerInstances
            .filter(
                (asbplayer) =>
                    asbplayer.tabId !== undefined &&
                    !asbplayer.sidePanel &&
                    asbplayer.syncedVideoElement === undefined &&
                    asbplayer.loadedSubtitles
            )
            .map((asbplayer) => {
                const loadedSubtitles = asbplayer.subtitleTracks ?? [];
                const [firstTrack] = loadedSubtitles;
                return {
                    id: boundMediaId(`local:${asbplayer.id}`),
                    type: 'local',
                    title: firstTrack === undefined ? undefined : withoutExtension(firstTrack.fileName),
                    loadedSubtitles,
                    active: activeByTabId.get(asbplayer.tabId!) ?? false,
                };
            });

        return [...streamingMedia, ...localMedia];
    };
};

export const unbindWebSocketClient = () => {
    client?.unbind();
};
