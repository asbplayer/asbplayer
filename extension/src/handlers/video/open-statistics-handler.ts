import type TabRegistry from '@project/extension/src/services/tab-registry';
import { asbError } from '@project/common/util/log';
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

    handle() {
        if (isFirefoxBuild) {
            void setExtensionRequestedLocation('statistics').catch((error) =>
                asbError('statistics', 'Failed to save the requested panel location:', error)
            );

            void this._tabRegistry
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
                })
                .catch((error) => asbError('statistics', 'Failed to find the statistics side panel:', error));
        } else if (browser.sidePanel !== undefined) {
            void setExtensionRequestedLocation('statistics').catch((error) =>
                asbError('statistics', 'Failed to save the requested panel location:', error)
            );

            browser.windows.getLastFocused((w) => {
                const windowId = w.id;
                void browser.sidePanel
                    .open({ windowId: windowId! })
                    .catch((error) => asbError('statistics', 'Failed to open the statistics side panel:', error));
            });
        } else {
            createStatisticsPopup();
        }

        return false;
    }
}
