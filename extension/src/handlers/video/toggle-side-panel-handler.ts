import {
    CloseSidePanelMessage,
    Command,
    ExtensionToAsbPlayerCommand,
    Message,
    ToggleSidePanelMessage,
} from '@project/common';
import TabRegistry from '../../services/tab-registry';
import { setAppRequestedLocation } from '@/services/side-panel';
import { isFirefoxBuild } from '@/services/build-flags';

export default class ToggleSidePanelHandler {
    private readonly _tabRegistry: TabRegistry;
    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return ['asbplayer-video-tab', 'asbplayerv2'];
    }

    get command() {
        return 'toggle-side-panel';
    }

    /**
     * If a location is not specified, toggles the side panel open or closed.
     * Otherwise, sets the app-requested location state, which will update the side panel's location.
     */
    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const toggleSidePanelMessage = command.message as ToggleSidePanelMessage;

        // Currently we do not support the extension specifying a location inside the side panel.
        // Only the app can specify a location.
        const appRequestedLocation =
            command.sender === 'asbplayer-video-tab' ? undefined : toggleSidePanelMessage.location;

        let sidePanelOpen = false;

        this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => {
                if (asbplayer.sidePanel) {
                    sidePanelOpen = true;
                    if (appRequestedLocation === undefined) {
                        const command: ExtensionToAsbPlayerCommand<CloseSidePanelMessage> = {
                            sender: 'asbplayer-extension-to-player',
                            message: {
                                command: 'close-side-panel',
                            },
                        };
                        return command;
                    }
                }

                return undefined;
            },
        });

        if (sidePanelOpen) {
            // Side panel is open, we can change its location
            void setAppRequestedLocation(appRequestedLocation!);
        } else if (!sidePanelOpen) {
            // Open the side panel at the app-requested location
            void setAppRequestedLocation(appRequestedLocation!);
            if (!isFirefoxBuild) {
                browser.windows
                    // @ts-ignore
                    .getLastFocused((w) => {
                        const windowId = w.id;
                        browser.sidePanel.open({ windowId: windowId! });
                    });
            }
        }

        return false;
    }
}
