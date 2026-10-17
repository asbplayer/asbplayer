import { isFirefoxBuild } from '@/services/build-flags';

export const openExtensionShortcuts = () => {
    if (isFirefoxBuild) {
        // @ts-expect-error: openShortcutSettings is Firefox-only (137+) and not in the typings
        void browser.commands.openShortcutSettings?.();
    } else {
        void browser.tabs.create({ active: true, url: 'chrome://extensions/shortcuts' });
    }
};
