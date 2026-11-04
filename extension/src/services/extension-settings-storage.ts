import type { AsbplayerSettings, SettingsStorage, Profile } from '@project/common/settings';
import {
    unprefixedSettings,
    prefixedSettings,
    defaultSettings,
    activeProfileKey,
    profilesKey,
    removedProfilesKey,
} from '@project/common/settings';

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

        return unprefixedSettings(
            await this._storage.get(prefixedSettings(keysAndDefaults, activeProfile.name)),
            activeProfile.name
        );
    }

    async set(settings: Partial<AsbplayerSettings>) {
        const activeProfile = await this.activeProfile();

        await this._storage.set(prefixedSettings(settings, activeProfile.name));
    }

    async activeProfile(): Promise<Profile> {
        const profiles = await this.profiles();
        const result = await this._storage.get(activeProfileKey);
        const name = result[activeProfileKey];
        const profile = profiles.find((p) => p.name === name) ?? profiles[0];
        if (name !== profile.name) await this._storage.set({ [activeProfileKey]: profile.name });
        return profile;
    }

    async setActiveProfile(name: string | undefined): Promise<void> {
        const profiles = await this.profiles();
        if (!profiles.some((p) => p.name === name)) {
            throw new Error(`Cannot set active profile to non-existent profile ${name}`);
        }
        await this._storage.set({ [activeProfileKey]: name });
    }

    private _initialization?: Promise<Profile[]>;

    async profiles(): Promise<Profile[]> {
        // Share initialization across concurrent settings reads on this storage instance.
        if (this._initialization) return this._initialization;
        this._initialization = this._initializeProfiles();
        try {
            return await this._initialization;
        } finally {
            this._initialization = undefined;
        }
    }

    private async _initializeProfiles(): Promise<Profile[]> {
        const result = await this._storage.get({
            [profilesKey]: [],
            legacyDefaultProfileMigrated: false,
            [activeProfileKey]: null,
            [removedProfilesKey]: [],
        });
        const profiles: Profile[] = [...result[profilesKey]];
        const removedProfiles: string[] = result[removedProfilesKey];
        const missingLegacyProfile =
            !profiles.some((p) => p.name === 'Default') && !removedProfiles.includes('Default');
        if (!result.legacyDefaultProfileMigrated || missingLegacyProfile) {
            const legacy = await this._storage.get(Object.keys(defaultSettings));
            // The legacy profile can have dictionary data even without stored settings.
            // Keep its name so those records remain attached to the same profile.
            const name = 'Default';
            if (missingLegacyProfile) {
                const migrated = await this._storage.get(Object.keys(prefixedSettings(defaultSettings, name)));
                await this._storage.set({ ...prefixedSettings(legacy, name), ...migrated });
                profiles.unshift({ name });
            }
            await this._storage.set({
                [profilesKey]: profiles,
                [activeProfileKey]: result[activeProfileKey] ?? name,
                legacyDefaultProfileMigrated: true,
            });
        }
        return profiles;
    }

    async addProfile(name: string): Promise<void> {
        const profiles = await this.profiles();
        const existing = profiles.find((p) => p.name === name);

        if (existing === undefined) {
            profiles.push({ name });
        }

        const metadata = await this._storage.get({ [removedProfilesKey]: [] });
        await this._storage.set({
            [profilesKey]: profiles,
            [removedProfilesKey]: (metadata[removedProfilesKey] as string[]).filter((p) => p !== name),
        });
        const initialValues = await this.get(defaultSettings);
        await this._storage.set(prefixedSettings(initialValues, name));
    }

    async removeProfile(name: string): Promise<void> {
        const profiles = await this.profiles();
        const activeProfile = await this.activeProfile();

        if (!profiles.some((p) => p.name === name)) return;
        if (profiles.length <= 1) throw new Error('Cannot remove the last profile');
        if (name === activeProfile.name) {
            await this.setActiveProfile(profiles.find((p) => p.name !== name)!.name);
        }

        const newProfiles = profiles.filter((p) => p.name !== name);
        const metadata = await this._storage.get({ [removedProfilesKey]: [] });
        // Record explicit deletion before removing data so recovery does not recreate it.
        await this._storage.set({
            [profilesKey]: newProfiles,
            [removedProfilesKey]: Array.from(new Set([...metadata[removedProfilesKey], name])),
        });
        const prefixedKeys = Object.keys(prefixedSettings(defaultSettings, name));
        await this._storage.remove(prefixedKeys);
    }

    async clear() {
        await this._storage.clear();
    }
}
