import type { AsbplayerSettings } from '@project/common/settings/settings';
import {
    defaultProfile,
    prefixedSettings,
    targetProfileName,
    unprefixedSettings,
} from '@project/common/settings/settings-provider';
import type {
    AsbplayerSettingsProfile,
    Profile,
    SettingsStorage,
    TargetProfile,
} from '@project/common/settings/settings-provider';

export class MockSettingsStorage implements SettingsStorage {
    private _activeProfile?: string;
    private _profiles: Profile[] = [];
    private _data: any = {};
    private _profileTarget: TargetProfile = undefined;

    targetingProfile(name: string | undefined): MockSettingsStorage {
        const copy = new MockSettingsStorage();
        copy._activeProfile = this._activeProfile;
        copy._profiles = this._profiles;
        copy._data = this._data;
        copy._profileTarget = name ?? defaultProfile;
        return copy;
    }

    async get(keysAndDefaults: Partial<AsbplayerSettings>) {
        const name = await targetProfileName(this._profileTarget, () => this.activeProfile());
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

    async set(settings: Partial<AsbplayerSettings>) {
        const name = await targetProfileName(this._profileTarget, () => this.activeProfile());
        const actualSettings = name === undefined ? settings : prefixedSettings(settings, name);

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
