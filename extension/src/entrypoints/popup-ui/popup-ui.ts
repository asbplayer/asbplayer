import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { renderPopupUi } from '@/ui/popup';
import { SettingsProvider } from '@project/common/settings';

const fetchShortcuts = () => {
    return new Promise((resolve) => {
        if (browser.commands === undefined) {
            resolve({});
            return;
        }

        browser.commands.getAll((commands) => {
            const commandsObj: any = {};

            for (const c of commands) {
                if (c.name && c.shortcut) {
                    commandsObj[c.name] = c.shortcut;
                }
            }

            resolve(commandsObj);
        });
    });
};

document.addEventListener('DOMContentLoaded', () => {
    void (async () => {
        const settings = new SettingsProvider(new ExtensionSettingsStorage());
        const currentSettingsPromise = settings.getAll();
        const commandsPromise = fetchShortcuts();
        const currentSettings = await currentSettingsPromise;
        const commands = await commandsPromise;
        const rootElement = document.getElementById('root')!;
        await renderPopupUi(rootElement, { currentSettings, commands });
    })().catch(console.error);
});
