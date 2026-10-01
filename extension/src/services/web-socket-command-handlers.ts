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
    LoadSubtitleFilesMessage,
    SeekTimestampMessage,
    SubtitleModel,
    ToggleVideoSelectMessage,
} from '@project/common';
import { PostMineAction } from '@project/common';
import { localMediaId, localMediaTitle, streamingMediaId } from '@project/common/web-socket-client/web-socket-media';
import {
    isVideoElementTarget,
    publishToAsbplayers,
    publishToVideoElements,
    resolveMediaTargets,
} from '@project/extension/src/services/web-socket-media-targets';
import {
    requestSubtitlesFromAsbplayer,
    requestSubtitlesFromVideoElement,
} from '@project/extension/src/services/web-socket-subtitles';
import { filterByTracks, toSubtitleCues } from '@project/common/web-socket-client/web-socket-subtitles';

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

const loadSubtitles = async (
    tabRegistry: TabRegistry,
    { body: { files: subtitleFiles, mediaId } }: LoadSubtitlesCommand
) => {
    const targets = await resolveMediaTargets(tabRegistry, mediaId);

    if (mediaId === undefined) {
        // Target the whole tab rather than its videos so that a tab with several videos shows the video selector.
        const tabIds = new Set(targets.filter(isVideoElementTarget).map(({ videoElement }) => videoElement.id));
        await tabRegistry.publishCommandToVideoElementTabs(
            (tab): ExtensionToVideoCommand<ToggleVideoSelectMessage> | undefined =>
                tabIds.has(tab.id)
                    ? {
                          sender: 'asbplayer-extension-to-video',
                          message: {
                              command: 'toggle-video-select',
                              subtitleFiles,
                          },
                      }
                    : undefined
        );
    } else {
        await publishToVideoElements<ToggleVideoSelectMessage>(tabRegistry, targets, (src) => ({
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'toggle-video-select',
                subtitleFiles,
            },
            src,
        }));
    }

    if (subtitleFiles === undefined || subtitleFiles.length === 0) {
        return;
    }

    await publishToAsbplayers<LoadSubtitleFilesMessage>(tabRegistry, targets, (asbplayerId) => ({
        sender: 'asbplayer-extension-to-player',
        message: {
            command: 'load-subtitle-files',
            subtitleFiles,
        },
        asbplayerId,
    }));
};

const seekTimestamp = async (tabRegistry: TabRegistry, { body: { timestamp, mediaId } }: SeekTimestampCommand) => {
    const targets = await resolveMediaTargets(tabRegistry, mediaId);

    await Promise.all([
        publishToVideoElements(tabRegistry, targets, (src) => ({
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'currentTime',
                value: timestamp,
            },
            src,
        })),
        publishToAsbplayers<SeekTimestampMessage>(tabRegistry, targets, (asbplayerId) => ({
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'seek-timestamp',
                timestamp,
            },
            asbplayerId,
        })),
    ]);
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
            return {
                id: localMediaId(asbplayer.id),
                type: 'local',
                title: localMediaTitle(loadedSubtitles),
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
