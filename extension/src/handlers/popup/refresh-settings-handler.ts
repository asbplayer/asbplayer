import { ExtensionToAsbPlayerCommand, ExtensionToVideoCommand, SettingsUpdatedMessage } from '@project/common';
import TabRegistry from '../../services/tab-registry';
import { SettingsProvider } from '@project/common/settings';
import { primeLocalization } from '../../services/localization-fetcher';
import { bindWebSocketClient, unbindWebSocketClient } from '../../services/web-socket-client-binding';

export default class RefreshSettingsHandler {
    private readonly _tabRegistry: TabRegistry;
    private readonly _settingsProvider: SettingsProvider;
    constructor(tabRegistry: TabRegistry, settingsProvider: SettingsProvider) {
        this._tabRegistry = tabRegistry;
        this._settingsProvider = settingsProvider;
    }

    get sender() {
        return [
            'asbplayer-popup',
            'asbplayer-settings',
            'asbplayer-mobile-overlay',
            'asbplayer-video',
            'asbplayer-video-tab',
        ];
    }

    get command() {
        return 'settings-updated';
    }

    handle() {
        void this._settingsProvider
            .get(['language', 'webSocketClientEnabled'])
            .then(({ language, webSocketClientEnabled }) => {
                void primeLocalization(language);

                if (webSocketClientEnabled) {
                    void bindWebSocketClient(this._settingsProvider, this._tabRegistry);
                } else {
                    unbindWebSocketClient();
                }
            });
        void this._tabRegistry.publishCommandToVideoElements((videoElement) => {
            const settingsUpdatedCommand: ExtensionToVideoCommand<SettingsUpdatedMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'settings-updated',
                },
                src: videoElement.src,
            };
            return settingsUpdatedCommand;
        });
        void this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: () => {
                const settingsUpdatedCommand: ExtensionToAsbPlayerCommand<SettingsUpdatedMessage> = {
                    sender: 'asbplayer-extension-to-player',
                    message: {
                        command: 'settings-updated',
                    },
                };
                return settingsUpdatedCommand;
            },
        });
        void browser.tabs.query({ url: `${browser.runtime.getURL('/options.html')}` }).then((tabs) => {
            for (const t of tabs) {
                if (t.id !== undefined) {
                    void browser.tabs.sendMessage(t.id, {
                        message: {
                            command: 'settings-updated',
                        },
                    });
                }
            }
        });
        return false;
    }
}
