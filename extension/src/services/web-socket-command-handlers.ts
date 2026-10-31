import type { SettingsProvider } from '@project/common/settings';
import { ankiSettingsKeys } from '@project/common/settings';
import type {
    BoundMedia,
    GetSubtitlesResponseBody,
    LoadSubtitlesCommand,
    MineSubtitleCommand,
    MineSubtitleResponseBody,
    SeekTimestampCommand,
    SubtitleCue,
    WebSocketCommandHandlers,
} from '@project/common/web-socket-client';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import type {
    CardTextFieldValues,
    CopySubtitleMessage,
    ExtensionToVideoCommand,
    ToggleVideoSelectMessage,
} from '@project/common';
import { PostMineAction } from '@project/common';
import { v4 as uuidv4 } from 'uuid';
import { localMediaId, localMediaTitle, streamingMediaId } from '@project/common/web-socket-client/web-socket-media';
import {
    forwardToAsbplayers,
    isVideoElementTarget,
    publishToVideoElements,
    resolveMediaTargets,
} from '@project/extension/src/services/web-socket-media-targets';
import { requestSubtitlesFromVideoElement } from '@project/extension/src/services/web-socket-subtitles';
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
    command: MineSubtitleCommand
): Promise<boolean> => {
    const {
        body: { fields: receivedFields, postMineAction: receivedPostMineAction, mediaId, noteId },
    } = command;
    const targets = (await resolveMediaTargets(tabRegistry, mediaId)).filter((target) =>
        isVideoElementTarget(target) ? target.videoElement.loadedSubtitles : target.asbplayer.loadedSubtitles
    );

    if (targets.length === 0) {
        return false;
    }

    const cardTextFieldValues = await ankiFieldValues(settings, receivedFields);
    const postMineAction = receivedPostMineAction ?? PostMineAction.showAnkiDialog;

    const [, asbplayerResponses] = await Promise.all([
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
        forwardToAsbplayers(tabRegistry, targets, command),
    ]);

    return (
        targets.some(isVideoElementTarget) ||
        asbplayerResponses.some((response) => (response?.body as MineSubtitleResponseBody | undefined)?.published)
    );
};

const loadSubtitles = async (tabRegistry: TabRegistry, command: LoadSubtitlesCommand) => {
    const {
        body: { files: subtitleFiles, mediaId },
    } = command;
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

    await forwardToAsbplayers(tabRegistry, targets, command);
};

const seekTimestamp = async (tabRegistry: TabRegistry, command: SeekTimestampCommand) => {
    const {
        body: { timestamp, mediaId },
    } = command;
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
        forwardToAsbplayers(tabRegistry, targets, command),
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
    const [target] = await resolveMediaTargets(tabRegistry, mediaId);

    if (target === undefined) {
        return [];
    }

    if (isVideoElementTarget(target)) {
        const subtitles = await requestSubtitlesFromVideoElement(target.videoElement.id, target.videoElement.src);
        return toSubtitleCues(filterByTracks(subtitles ?? [], trackNumbers));
    }

    const [response] = await forwardToAsbplayers(tabRegistry, [target], {
        command: 'get-subtitles',
        messageId: uuidv4(),
        body: { trackNumbers },
    });
    return (response?.body as GetSubtitlesResponseBody | undefined)?.subtitles ?? [];
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
