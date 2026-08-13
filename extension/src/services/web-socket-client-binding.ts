import { SettingsProvider, ankiSettingsKeys } from '@project/common/settings';
import {
    BoundMedia,
    LoadSubtitlesCommand,
    MineSubtitleCommand,
    SeekTimestampCommand,
    SubtitleCue,
    WebSocketClient,
} from '@project/common/web-socket-client';
import TabRegistry from '@project/extension/src/services/tab-registry';
import {
    AsbplayerInstance,
    CardTextFieldValues,
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

const isVideoElementTarget = (target: MediaTarget): target is { videoElement: VideoTabModel } =>
    'videoElement' in target;

const isAsbplayerTarget = (target: MediaTarget): target is { asbplayer: AsbplayerInstance } => 'asbplayer' in target;

const videoElementKey = (tabId: number, src: string) => `${tabId}:${src}`;

const activeTabId = async () => (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;

const resolveMediaTargets = async (tabRegistry: TabRegistry, mediaId: string | undefined): Promise<MediaTarget[]> => {
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

const publishToVideoElements = async <T extends Message>(
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

const publishToAsbplayers = async <T extends Message>(
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

    const ankiFieldValues = async (receivedFields: { [key: string]: string }): Promise<CardTextFieldValues> => {
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
        const targets = (await resolveMediaTargets(tabRegistry, mediaId)).filter((target) =>
            isVideoElementTarget(target) ? target.videoElement.loadedSubtitles : target.asbplayer.loadedSubtitles
        );

        if (targets.length === 0) {
            return false;
        }

        const cardTextFieldValues = await ankiFieldValues(receivedFields);
        const postMineAction = receivedPostMineAction ?? PostMineAction.showAnkiDialog;

        await Promise.all([
            publishToVideoElements<CopySubtitleMessage>(tabRegistry, targets, (src) => ({
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'copy-subtitle',
                    ...cardTextFieldValues,
                    postMineAction,
                    noteId,
                },
                src,
            })),
            publishToAsbplayers<CopySubtitleWithAdditionalFieldsMessage>(tabRegistry, targets, (asbplayerId) => ({
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'copy-subtitle-with-additional-fields',
                    ...cardTextFieldValues,
                    postMineAction,
                },
                asbplayerId,
            })),
        ]);

        return true;
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
        // Local media cannot be seeked, so only video element targets are published to
        const targets = await resolveMediaTargets(tabRegistry, mediaId);

        await publishToVideoElements(tabRegistry, targets, (src) => ({
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'currentTime',
                value: timestamp,
            },
            src,
        }));
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
        const [target] = await resolveMediaTargets(tabRegistry, mediaId);

        if (target !== undefined) {
            subtitles = isVideoElementTarget(target)
                ? await requestSubtitlesFromVideoElement(target.videoElement.id, target.videoElement.src)
                : await requestSubtitlesFromAsbplayer(tabRegistry, target.asbplayer.id);
        }

        return toSubtitleCues(filterByTracks(subtitles ?? [], trackNumbers));
    };
};

export const unbindWebSocketClient = () => {
    client?.unbind();
};
