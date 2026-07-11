import {
    AsbplayerSettings,
    SettingsStorage,
    unprefixedSettings,
    prefixedSettings,
    defaultSettings,
    Profile,
} from '@project/common/settings';

const activeProfileKey = 'activeSettingsProfile';
const profilesKey = 'settingsProfiles';

export interface StorageArea {
    set(items: { [key: string]: any }): Promise<void>;

    remove(keys: string | string[]): Promise<void>;

    get(keys?: string | string[] | { [key: string]: any } | null): Promise<{ [key: string]: any }>;

    clear(): Promise<void>;
}

export class ExtensionSettingsStorage implements SettingsStorage {
    private readonly _storage: StorageArea;

    constructor(storage?: StorageArea) {
        this._storage = storage ?? browser.storage.local;
    }

    async get(keysAndDefaults: Partial<AsbplayerSettings>) {
        const activeProfile = await this.activeProfile();

        if (activeProfile === undefined) {
            return this._storage.get(keysAndDefaults);
        }

        return unprefixedSettings(
            await this._storage.get(prefixedSettings(keysAndDefaults, activeProfile.name)),
            activeProfile.name
        );
    }

    async set(settings: Partial<AsbplayerSettings>) {
        const activeProfile = await this.activeProfile();

        if (activeProfile === undefined) {
            await this._storage.set(settings);
        } else {
            await this._storage.set(prefixedSettings(settings, activeProfile.name));
        }
    }

    async activeProfile(): Promise<Profile | undefined> {
        const result = await this._storage.get(activeProfileKey);
        const name = result && result[activeProfileKey];

        if (name === undefined) {
            return undefined;
        }

        const profiles = await this.profiles();
        return profiles.find((p) => p.name === name);
    }

    async setActiveProfile(name: string | undefined): Promise<void> {
        if (name === undefined) {
            await this._storage.remove(activeProfileKey);
        } else {
            const profiles = await this.profiles();
            const profileExists = profiles.find((p) => p.name === name) !== undefined;

            if (!profileExists) {
                throw new Error(`Cannot set active profile to non-existant profile ${name}`);
            }

            await this._storage.set({ [activeProfileKey]: name });
        }
    }

    async profiles(): Promise<Profile[]> {
        const result = await this._storage.get({ [profilesKey]: [] });
        return result ? (result[profilesKey] ?? []) : [];
    }

    async addProfile(name: string): Promise<void> {
        const profiles = await this.profiles();
        const existing = profiles.find((p) => p.name === name);

        if (existing === undefined) {
            profiles.push({ name });
        }

        await this._storage.set({ [profilesKey]: profiles });
        const initialValues = await this._storage.get(Object.keys(defaultSettings));
        await this._storage.set(prefixedSettings(initialValues, name));
    }

    async removeProfile(name: string): Promise<void> {
        const profiles = await this.profiles();
        const activeProfile = await this.activeProfile();

        if (name === activeProfile?.name) {
            throw new Error('Cannot remove active profile');
        }

        const newProfiles = profiles.filter((p) => p.name !== name);
        const prefixedKeys = Object.keys(prefixedSettings(defaultSettings, name));
        await this._storage.remove(prefixedKeys);
        await this._storage.set({ [profilesKey]: newProfiles });
    }

    async clear() {
        await this._storage.clear();
    }
}
