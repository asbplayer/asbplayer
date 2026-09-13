import type { SettingsProvider } from '@project/common/settings';
import { ankiSettingsKeys } from '@project/common/settings';
import type {
    BoundMedia,
    LoadSubtitlesCommand,
    MineSubtitleCommand,
    SeekTimestampCommand,
    SubtitleCue,
    WebSocketCommandHandlers,
} from '@project/common/web-socket-client';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import type {
    CardTextFieldValues,
    CopySubtitleMessage,
    CopySubtitleWithAdditionalFieldsMessage,
    ExtensionToVideoCommand,
    Message,
    SubtitleModel,
    ToggleVideoSelectMessage,
} from '@project/common';
import { PostMineAction } from '@project/common';
import { localMediaId, streamingMediaId } from '@project/extension/src/services/web-socket-media-id';
import {
    isVideoElementTarget,
    publishToAsbplayers,
    publishToVideoElements,
    resolveMediaTargets,
} from '@project/extension/src/services/web-socket-media-targets';
import {
    filterByTracks,
    requestSubtitlesFromAsbplayer,
    requestSubtitlesFromVideoElement,
    toSubtitleCues,
} from '@project/extension/src/services/web-socket-subtitles';

const withoutExtension = (fileName: string) => {
    const dot = fileName.lastIndexOf('.');
    return dot > 0 ? fileName.substring(0, dot) : fileName;
};

const ankiFieldValues = async (
    settings: SettingsProvider,
    receivedFields: { [key: string]: string }
): Promise<CardTextFieldValues> => {
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

const mineSubtitle = async (
    settings: SettingsProvider,
    tabRegistry: TabRegistry,
    { body: { fields: receivedFields, postMineAction: receivedPostMineAction, mediaId, noteId } }: MineSubtitleCommand
): Promise<boolean> => {
    const targets = (await resolveMediaTargets(tabRegistry, mediaId)).filter((target) =>
        isVideoElementTarget(target) ? target.videoElement.loadedSubtitles : target.asbplayer.loadedSubtitles
    );

    if (targets.length === 0) {
        return false;
    }

    const cardTextFieldValues = await ankiFieldValues(settings, receivedFields);
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

const loadSubtitles = async (tabRegistry: TabRegistry, { body: { files: subtitleFiles } }: LoadSubtitlesCommand) => {
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

const seekTimestamp = async (tabRegistry: TabRegistry, { body: { timestamp, mediaId } }: SeekTimestampCommand) => {
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

const getBoundMedia = async (tabRegistry: TabRegistry): Promise<BoundMedia[]> => {
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

const getSubtitles = async (
    tabRegistry: TabRegistry,
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

export const webSocketCommandHandlers = (
    settings: SettingsProvider,
    tabRegistry: TabRegistry
): WebSocketCommandHandlers => ({
    onMineSubtitle: (command) => mineSubtitle(settings, tabRegistry, command),
    onLoadSubtitles: (command) => loadSubtitles(tabRegistry, command),
    onSeekTimestamp: (command) => seekTimestamp(tabRegistry, command),
    onGetBoundMedia: () => getBoundMedia(tabRegistry),
    onGetSubtitles: (mediaId, trackNumbers) => getSubtitles(tabRegistry, mediaId, trackNumbers),
});
