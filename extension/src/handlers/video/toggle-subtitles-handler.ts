import { ExtensionToVideoCommand, SettingsUpdatedMessage } from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import TabRegistry from '../../services/tab-registry';

export default class ToggleSubtitlesHandler {
    private readonly settings: SettingsProvider;
    private readonly tabRegistry: TabRegistry;

    constructor(settings: SettingsProvider, tabRegistry: TabRegistry) {
        this.settings = settings;
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return ['asbplayer-video', 'asbplayer-mobile-overlay-to-video'];
    }

    get command() {
        return 'toggle-subtitles';
    }

    async handle() {
        const displaySubtitles = await this.settings.getSingle('streamingDisplaySubtitles');
        await this.settings.set({ streamingDisplaySubtitles: !displaySubtitles });

        void this.tabRegistry.publishCommandToVideoElements((videoElement) => {
            const settingsUpdatedCommand: ExtensionToVideoCommand<SettingsUpdatedMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'settings-updated',
                },
                src: videoElement.src,
            };
            return settingsUpdatedCommand;
        });
    }
}
