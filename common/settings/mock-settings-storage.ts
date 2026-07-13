import type { AsbplayerSettings } from './settings';
import {
    prefixedSettings,
    type AsbplayerSettingsProfile,
    type Profile,
    type SettingsStorage,
    unprefixedSettings,
} from './settings-provider';

export class MockSettingsStorage implements SettingsStorage {
    private _activeProfile?: string;
    private _profiles: Profile[] = [];
    private _data: any = {};

    async get(keysAndDefaults: Partial<AsbplayerSettings>) {
        const settings: any = {};

        const actualKeysAndDefaults =
            this._activeProfile === undefined
                ? keysAndDefaults
                : prefixedSettings(keysAndDefaults, this._activeProfile);

        for (const [key, defaultValue] of Object.entries(actualKeysAndDefaults)) {
            // Simulate retrieval from actual storage - object references should change
            settings[key] = JSON.parse(JSON.stringify(this._data[key] ?? defaultValue));
        }

        return this._activeProfile === undefined
            ? (settings as Partial<AsbplayerSettings>)
            : unprefixedSettings(settings as Partial<AsbplayerSettingsProfile<string>>, this._activeProfile);
    }

    async set(settings: Partial<AsbplayerSettings>) {
        const actualSettings =
            this._activeProfile === undefined ? settings : prefixedSettings(settings, this._activeProfile);

        for (const [key, value] of Object.entries(actualSettings)) {
            this._data[key] = value;
        }
    }

    async activeProfile(): Promise<Profile | undefined> {
        return this._activeProfile === undefined
            ? undefined
            : this._profiles.find((p) => p.name === this._activeProfile);
    }

    async setActiveProfile(name: string | undefined): Promise<void> {
        this._activeProfile = name;
    }

    async profiles(): Promise<Profile[]> {
        return this._profiles;
    }

    async addProfile(name: string): Promise<void> {
        const existing = this._profiles.find((p) => p.name === name);

        if (existing === undefined) {
            this._profiles.push({ name });
        }
    }

    async removeProfile(name: string): Promise<void> {
        if (this._activeProfile === name) {
            throw new Error('Cannot remove active profile');
        }

        this._profiles = this._profiles.filter((p) => p.name !== name);
    }

    setData(data: any) {
        this._data = data;
    }
}
