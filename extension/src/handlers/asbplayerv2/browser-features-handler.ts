import { isFirefoxBuild } from '@/services/build-flags';
import type { Command, Message } from '@project/common';
import { asbError } from '@project/common/util/log';

export default class BrowserFeaturesHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'browser-features';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        if (isFirefoxBuild) {
            sendResponse({ sidePanel: true });
            return false;
        }
        if (browser.sidePanel === undefined) {
            sendResponse({ sidePanel: false });
            return false;
        }
        const windowId = sender.tab?.windowId;
        if (windowId === undefined) {
            sendResponse({ sidePanel: true });
            return false;
        }
        browser.windows.get(windowId, (w) => {
            if (browser.runtime.lastError) {
                asbError(
                    'Failed to get last focused window when determining browser features:',
                    browser.runtime.lastError
                );
                sendResponse({ sidePanel: false });
                return;
            }
            sendResponse({
                // Chromium-based PWA doesn't support the side panel, and they report their window type as "app"
                sidePanel: w.type !== 'app',
            });
        });
        return true;
    }
}
