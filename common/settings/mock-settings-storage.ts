import type { AsbplayerSettings } from './settings';
import {
    prefixedSettings,
    type AsbplayerSettingsProfile,
    type Profile,
    type SettingsStorage,
    type TargetProfile,
    unprefixedSettings,
} from './settings-provider';

export class MockSettingsStorage implements SettingsStorage {
    private _activeProfile?: string;
    private _profiles: Profile[] = [];
    private _data: any = {};

    async get(keysAndDefaults: Partial<AsbplayerSettings>, profile?: TargetProfile) {
        const name = this._targetProfileName(profile);
        const settings: any = {};

        const actualKeysAndDefaults = name === undefined ? keysAndDefaults : prefixedSettings(keysAndDefaults, name);

        for (const [key, defaultValue] of Object.entries(actualKeysAndDefaults)) {
            // Simulate retrieval from actual storage - object references should change
            settings[key] = JSON.parse(JSON.stringify(this._data[key] ?? defaultValue));
        }

        return name === undefined
            ? (settings as Partial<AsbplayerSettings>)
            : unprefixedSettings(settings as Partial<AsbplayerSettingsProfile<string>>, name);
    }

    async set(settings: Partial<AsbplayerSettings>, profile?: TargetProfile) {
        const name = this._targetProfileName(profile);
        const actualSettings = name === undefined ? settings : prefixedSettings(settings, name);

        for (const [key, value] of Object.entries(actualSettings)) {
            this._data[key] = value;
        }
    }

    private _targetProfileName(target: TargetProfile) {
        return target === undefined ? this._activeProfile : (target ?? undefined);
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
