import { SettingsProvider, ankiSettingsKeys } from '@project/common/settings';
import {
    BoundMedia,
    LoadSubtitlesCommand,
    MineSubtitleCommand,
    SeekTimestampCommand,
    SubtitleCue,
    WebSocketClient,
} from '@project/common/web-socket-client';
import TabRegistry from './tab-registry';
import {
    AsbplayerInstance,
    CopySubtitleMessage,
    CopySubtitleWithAdditionalFieldsMessage,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    Message,
    PostMineAction,
    LocalSubtitlesResponseMessage,
    RequestLocalSubtitlesMessage,
    RequestSubtitlesMessage,
    RequestSubtitlesResponse,
    SubtitleModel,
    ToggleVideoSelectMessage,
    VideoTabModel,
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

const streamingMediaId = (tabId: number, src: string) => cyrb53(`streaming:${tabId}:${src}`);
const localMediaId = (asbplayerId: string) => cyrb53(`local:${asbplayerId}`);

// Filters subtitles to the requested tracks, or returns all of them when none are specified.
const filterByTracks = (subtitles: SubtitleModel[], trackNumbers: number[] | undefined) => {
    if (trackNumbers === undefined || trackNumbers.length === 0) {
        return subtitles;
    }

    return subtitles.filter((subtitle) => trackNumbers.includes(subtitle.track));
};

const toSubtitleCues = (subtitles: SubtitleModel[]): SubtitleCue[] =>
    subtitles.map(({ text, start, end, track }) => ({ text, start, end, track }));

// Requests the loaded subtitles from a local asbplayer app instance
const requestSubtitlesFromAsbplayer = async (
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

type MediaTarget = { videoElement: VideoTabModel } | { asbplayer: AsbplayerInstance };

// Resolves an explicit mediaId against the currently-bound media
const resolveMediaTarget = async (tabRegistry: TabRegistry, mediaId: string): Promise<MediaTarget | undefined> => {
    const videoElements = await tabRegistry.activeVideoElements();
    const videoElement = videoElements.find((v) => streamingMediaId(v.id, v.src) === mediaId);

    if (videoElement !== undefined) {
        return { videoElement };
    }

    const asbplayerInstances = await tabRegistry.asbplayerInstances();
    const asbplayer = asbplayerInstances.find((instance) => localMediaId(instance.id) === mediaId);

    if (asbplayer !== undefined) {
        return { asbplayer };
    }

    return undefined;
};

const requestSubtitlesFromVideoElement = async (tabId: number, src: string): Promise<SubtitleModel[] | undefined> => {
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

export const bindWebSocketClient = async (settings: SettingsProvider, tabRegistry: TabRegistry) => {
    client?.unbind();
    const url = await settings.getSingle('webSocketServerUrl');

    if (!url) {
        return;
    }

    client = new WebSocketClient();
    void client.bind(url);

    const ankiFieldValues = async (receivedFields: { [key: string]: string }) => {
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
                .filter((entry) => entry !== undefined)
        );
        return { word, definition, text, customFieldValues };
    };

    client.onMineSubtitle = async ({
        body: { fields: receivedFields, postMineAction: receivedPostMineAction, mediaId, noteId },
    }: MineSubtitleCommand) => {
        if (mediaId !== undefined) {
            const target = await resolveMediaTarget(tabRegistry, mediaId);

            if (target === undefined) {
                return false;
            }

            const { word, definition, text, customFieldValues } = await ankiFieldValues(receivedFields);
            const postMineAction = receivedPostMineAction ?? PostMineAction.showAnkiDialog;

            if ('videoElement' in target) {
                if (!target.videoElement.loadedSubtitles) {
                    return false;
                }

                await tabRegistry.publishCommandToVideoElements((videoElement) => {
                    if (
                        videoElement.tab.id !== target.videoElement.id ||
                        videoElement.src !== target.videoElement.src
                    ) {
                        return undefined;
                    }

                    const extensionToVideoCommand: ExtensionToVideoCommand<CopySubtitleMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'copy-subtitle',
                            word,
                            definition,
                            text,
                            postMineAction,
                            customFieldValues,
                            noteId,
                        },
                        src: videoElement.src,
                    };
                    return extensionToVideoCommand;
                });
            } else {
                if (!target.asbplayer.loadedSubtitles) {
                    return false;
                }

                await tabRegistry.publishCommandToAsbplayers({
                    asbplayerId: target.asbplayer.id,
                    commandFactory: (
                        asbplayer
                    ): ExtensionToAsbPlayerCommand<CopySubtitleWithAdditionalFieldsMessage> => ({
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
                    }),
                });
            }

            return true;
        }

        return new Promise((resolve, reject) => {
            browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                void (async () => {
                    const { word, definition, text, customFieldValues } = await ankiFieldValues(receivedFields);
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
                                noteId,
                            },
                            src: videoElement.src,
                        };
                        return extensionToVideoCommand;
                    });

                    await tabRegistry.publishCommandToAsbplayers({
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
                    resolve(published);
                })().catch(reject);
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
        void tabRegistry.publishCommandToVideoElementTabs((): ExtensionToVideoCommand<Message> | undefined => {
            return toggleVideoSelectCommand;
        });
    };
    client.onSeekTimestamp = async ({ body: { timestamp, mediaId } }: SeekTimestampCommand) => {
        if (mediaId !== undefined) {
            const target = await resolveMediaTarget(tabRegistry, mediaId);

            if (target === undefined || !('videoElement' in target)) {
                // Local media cannot be seeked by mediaId
                return;
            }

            await tabRegistry.publishCommandToVideoElements((videoElement) => {
                if (videoElement.tab.id !== target.videoElement.id || videoElement.src !== target.videoElement.src) {
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

            return;
        }

        return new Promise<void>((resolve) => {
            // Publish the command to the active tab video element
            browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                void tabRegistry.publishCommandToVideoElements((videoElement) => {
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
            id: streamingMediaId(videoElement.id, videoElement.src),
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
                    id: localMediaId(asbplayer.id),
                    type: 'local',
                    title: firstTrack === undefined ? undefined : withoutExtension(firstTrack.fileName),
                    loadedSubtitles,
                    active: activeByTabId.get(asbplayer.tabId!) ?? false,
                };
            });

        return [...streamingMedia, ...localMedia];
    };
    client.onGetSubtitles = async (
        mediaId: string | undefined,
        trackNumbers: number[] | undefined
    ): Promise<SubtitleCue[]> => {
        let subtitles: SubtitleModel[] | undefined;

        if (mediaId !== undefined) {
            const target = await resolveMediaTarget(tabRegistry, mediaId);

            if (target !== undefined) {
                if ('videoElement' in target) {
                    subtitles = await requestSubtitlesFromVideoElement(target.videoElement.id, target.videoElement.src);
                } else {
                    subtitles = await requestSubtitlesFromAsbplayer(tabRegistry, target.asbplayer.id);
                }
            }
        } else {
            // Default to the active tab's video element
            const videoElements = await tabRegistry.activeVideoElements();
            const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
            const match = videoElements.find((videoElement) => videoElement.id === activeTab?.id);

            if (match !== undefined) {
                subtitles = await requestSubtitlesFromVideoElement(match.id, match.src);
            }
        }

        return toSubtitleCues(filterByTracks(subtitles ?? [], trackNumbers));
    };
};

export const unbindWebSocketClient = () => {
    client?.unbind();
};
