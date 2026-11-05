import { openExtensionShortcuts } from '@/services/extension-shortcuts';

export default class OpenExtensionShortcutsHandler {
    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'open-extension-shortcuts';
    }

    handle() {
        openExtensionShortcuts();
        return false;
    }
}
