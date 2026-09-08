import type { AsbplayerSettings, Profile } from '@project/common/settings';
import type { ChromeExtension } from '@project/common/app';
import type { AppSettingsStorage } from '@project/common/app/services/app-settings-storage';

export class AppExtensionSettingsStorage implements AppSettingsStorage {
    private readonly _extension: ChromeExtension;
    private readonly _settingsUpdatedCallbacks: (() => void)[] = [];
    private _unsubscribeExtension?: () => void;

    constructor(extension: ChromeExtension) {
        this._extension = extension;
    }

    get(keysAndDefaults: Partial<AsbplayerSettings>): Promise<Partial<AsbplayerSettings>> {
        return this._extension.getSettings(keysAndDefaults);
    }

    set(settings: Partial<AsbplayerSettings>): Promise<void> {
        return this._extension.setSettings(settings);
    }

    activeProfile(): Promise<Profile | undefined> {
        return this._extension.activeSettingsProfile();
    }

    setActiveProfile(name: string | undefined): Promise<void> {
        return this._extension.setActiveSettingsProfile(name);
    }

    profiles(): Promise<Profile[]> {
        return this._extension.settingsProfiles();
    }

    addProfile(name: string): Promise<void> {
        return this._extension.addSettingsProfile(name);
    }

    removeProfile(name: string): Promise<void> {
        return this._extension.removeSettingsProfile(name);
    }

    onSettingsUpdated(callback: () => void) {
        if (this._settingsUpdatedCallbacks.length === 0) {
            this._unsubscribeExtension = this._extension.subscribe((message) => {
                if (message.data.command === 'settings-updated') {
                    for (const c of this._settingsUpdatedCallbacks) {
                        c();
                    }
                }
            });
        }
        this._settingsUpdatedCallbacks.push(callback);
        return () => this._unsubscribeCallback(callback);
    }

    _unsubscribeCallback(callback: () => void) {
        for (let i = this._settingsUpdatedCallbacks.length - 1; i >= 0; --i) {
            if (callback === this._settingsUpdatedCallbacks[i]) {
                this._settingsUpdatedCallbacks.splice(i, 1);
                break;
            }
        }

        if (this._settingsUpdatedCallbacks.length === 0) {
            this._unsubscribeExtension?.();
        }
    }
}
