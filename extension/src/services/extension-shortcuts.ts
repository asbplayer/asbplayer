import { isFirefoxBuild } from '@/services/build-flags';

export const openExtensionShortcuts = ({ closePopup = false }: { closePopup?: boolean } = {}) => {
    if (isFirefoxBuild) {
        // @ts-expect-error: openShortcutSettings is Firefox-only (137+) and not in the typings
        const openShortcutSettings = browser.commands.openShortcutSettings as (() => Promise<void>) | undefined;

        if (openShortcutSettings) {
            void openShortcutSettings().then(() => {
                if (closePopup) {
                    window.close();
                }
            });
        }
    } else {
        void browser.tabs.create({ active: true, url: 'chrome://extensions/shortcuts' });
    }
};
