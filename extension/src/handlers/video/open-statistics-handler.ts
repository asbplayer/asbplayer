import { Command, Message } from '@project/common';
import TabRegistry from '../../services/tab-registry';
import { setExtensionRequestedLocation } from '@/services/side-panel';
import { isFirefoxBuild } from '@/services/build-flags';
import { createStatisticsPopup } from '@/services/statistics-util';

export default class OpenStatisticsHandler {
    private readonly _tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return ['asbplayer-video', 'asbplayer-video-tab'];
    }

    get command() {
        return 'open-statistics';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        if (isFirefoxBuild) {
            void setExtensionRequestedLocation('statistics');

            this._tabRegistry
                .findAsbplayer({
                    filter: (a) => a.sidePanel ?? false,
                    allowTabCreation: false,
                })
                .then((sidePanelAsbplayerId) => {
                    if (sidePanelAsbplayerId === undefined) {
                        // If we get here there was no side panel, so create a popup because
                        // Firefox doesn't allow us to show the side panel outside of a user gesture.
                        createStatisticsPopup();
                    }
                    // Else, a side panel was showing, and setExtensionRequestedLocation would have
                    // loaded the statistics into the side panel.
                });
        } else if (browser.sidePanel !== undefined) {
            void setExtensionRequestedLocation('statistics');

            browser.windows
                // @ts-ignore
                .getLastFocused((w) => {
                    const windowId = w.id;
                    browser.sidePanel.open({ windowId: windowId! });
                });
        } else {
            createStatisticsPopup();
        }

        return false;
    }
}
