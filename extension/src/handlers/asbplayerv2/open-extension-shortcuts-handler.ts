export default class OpenExtensionShortcutsHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'open-extension-shortcuts';
    }

    handle() {
        void browser.tabs.create({ active: true, url: 'chrome://extensions/shortcuts' });
        return false;
    }
}
