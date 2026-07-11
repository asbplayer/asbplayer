import {
    Command,
    ExtensionSyncMessage,
    ExtensionToAsbPlayerCommand,
    Message,
    PlayerSyncMessage,
    VideoToExtensionCommand,
} from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class SyncHandler {
    private readonly tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'sync';
    }

    async handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        try {
            const extensionSyncCommand = command as VideoToExtensionCommand<ExtensionSyncMessage>;
            await this.tabRegistry.publishTabsToAsbplayers();
            const asbplayerId = await this.tabRegistry.findAsbplayer({
                filter: (asbplayer) => {
                    if (asbplayer.receivedTabs === undefined || sender.tab === undefined || asbplayer.sidePanel) {
                        return false;
                    }

                    if (extensionSyncCommand.message.withSyncedAsbplayerOnly) {
                        return (
                            asbplayer.syncedVideoElement !== undefined &&
                            asbplayer.syncedVideoElement.id === sender.tab?.id &&
                            asbplayer.syncedVideoElement.src === extensionSyncCommand.src
                        );
                    }

                    if (extensionSyncCommand.message.withAsbplayerId) {
                        return asbplayer.id === extensionSyncCommand.message.withAsbplayerId;
                    }

                    return (
                        asbplayer.receivedTabs.find(
                            (tab) => tab.id === sender.tab!.id && tab.src === extensionSyncCommand.src
                        ) !== undefined
                    );
                },
                allowTabCreation: !extensionSyncCommand.message.withSyncedAsbplayerOnly,
            });

            const playerSyncCommand: ExtensionToAsbPlayerCommand<PlayerSyncMessage> = {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'syncv2',
                    subtitles: extensionSyncCommand.message.subtitles,
                    flatten: extensionSyncCommand.message.flatten,
                },
                src: extensionSyncCommand.src,
                tabId: sender.tab!.id!,
            };

            if (asbplayerId !== undefined) {
                void this.tabRegistry.publishCommandToAsbplayers({
                    asbplayerId,
                    commandFactory: () => playerSyncCommand,
                });
            }
        } catch (error) {
            console.error(error);
        }
    }
}
