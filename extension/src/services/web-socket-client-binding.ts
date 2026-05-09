import { SettingsProvider, ankiSettingsKeys } from '@project/common/settings';
import {
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
            // Publish the command to all active video elements
            tabRegistry.publishCommandToVideoElements((videoElement) => {
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
    };
};

export const unbindWebSocketClient = () => {
    client?.unbind();
};
