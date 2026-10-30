import { CachedLocalStorage } from '@project/common/app/services/cached-local-storage';
import type { AppSettingsStorage } from '@project/common/app/services/app-settings-storage';
import type { AsbplayerSettings, Profile } from '@project/common/settings';
import {
    activeProfileKey,
    defaultSettings,
    prefixKey,
    prefixedSettings,
    profilesKey,
    removedProfilesKey,
    settingsDeserializers,
    saveOnlySettings,
    unprefixKey,
} from '@project/common/settings';

const cachedLocalStorage = new CachedLocalStorage();

export class LocalSettingsStorage implements AppSettingsStorage {
    private readonly _settingsUpdatedCallbacks: (() => void)[] = [];
    private _storageListener?: (event: StorageEvent) => void;

    async get(keysAndDefaults: Partial<AsbplayerSettings>) {
        const activeProfile = this._activeProfile();
        return this._get(keysAndDefaults, activeProfile);
    }

    private _get(keysAndDefaults: Partial<AsbplayerSettings>, activeProfile?: Profile) {
        const settings: any = {};
        const actualKeysAndDefaults =
            activeProfile === undefined ? keysAndDefaults : prefixedSettings(keysAndDefaults, activeProfile.name);

        for (const [key, defaultValue] of Object.entries(actualKeysAndDefaults)) {
            const value = cachedLocalStorage.get(key);
            const originalKey = activeProfile === undefined ? key : unprefixKey(key, activeProfile.name);

            if (value === null) {
                settings[originalKey] = defaultValue;
            } else {
                settings[originalKey] = settingsDeserializers[originalKey as keyof AsbplayerSettings](value);
            }
        }

        return settings as Partial<AsbplayerSettings>;
    }

    async getStored(keys: (keyof AsbplayerSettings)[]) {
        const activeProfile = this._activeProfile();
        return this._getStored(keys, activeProfile);
    }

    private _getStored(keys: (keyof AsbplayerSettings)[], activeProfile?: Profile) {
        const settings: any = {};

        for (const key of keys) {
            const actualKey = activeProfile === undefined ? key : prefixKey(key, activeProfile.name);
            const value = cachedLocalStorage.get(actualKey);

            if (value !== null) {
                settings[key] = settingsDeserializers[key](value);
            }
        }

        return settings as Partial<AsbplayerSettings>;
    }

    async set(settings: Partial<AsbplayerSettings>) {
        const activeProfile = this._activeProfile();
        this._set(settings, activeProfile);
    }

    private _set(settings: Partial<AsbplayerSettings>, activeProfile?: Profile) {
        const actualSettings = activeProfile === undefined ? settings : prefixedSettings(settings, activeProfile.name);

        for (const [key, value] of Object.entries(actualSettings)) {
            if (typeof value === 'object') {
                cachedLocalStorage.set(key, JSON.stringify(value));
            } else {
                cachedLocalStorage.set(key, String(value));
            }
        }
    }

    async activeProfile(): Promise<Profile | undefined> {
        return this._activeProfile();
    }

    private _activeProfile(): Profile {
        const profiles = this._profiles();
        const name = cachedLocalStorage.get(activeProfileKey);
        const profile = profiles.find((p) => p.name === name) ?? profiles[0];
        if (name !== profile.name) cachedLocalStorage.set(activeProfileKey, profile.name);
        return profile;
    }

    async setActiveProfile(name: string | undefined): Promise<void> {
        const profiles = this._profiles();
        if (!profiles.some((p) => p.name === name)) {
            throw new Error(`Cannot set active profile to non-existent profile ${name}`);
        }
        cachedLocalStorage.set(activeProfileKey, name!);
    }

    async profiles(): Promise<Profile[]> {
        return this._profiles();
    }

    private _profiles(): Profile[] {
        const value = cachedLocalStorage.get(profilesKey);
        const profiles: Profile[] = value === null ? [] : JSON.parse(value);
        const removedProfiles: string[] = JSON.parse(cachedLocalStorage.get(removedProfilesKey) ?? '[]');
        const missingLegacyProfile =
            !profiles.some((p) => p.name === 'Default') && !removedProfiles.includes('Default');
        if (cachedLocalStorage.get('legacyDefaultProfileMigrated') !== 'true' || missingLegacyProfile) {
            const legacy = this._getStored(Object.keys(defaultSettings) as (keyof AsbplayerSettings)[]);
            // The legacy profile can have dictionary data even without stored settings.
            // Keep its name so those records remain attached to the same profile.
            const name = 'Default';
            if (missingLegacyProfile) {
                const profile = { name };
                const migrated = this._getStored(Object.keys(defaultSettings) as (keyof AsbplayerSettings)[], profile);
                this._set({ ...legacy, ...migrated }, profile);
                profiles.unshift(profile);
            }
            cachedLocalStorage.set(profilesKey, JSON.stringify(profiles));
            if (cachedLocalStorage.get(activeProfileKey) === null) cachedLocalStorage.set(activeProfileKey, name);
            cachedLocalStorage.set('legacyDefaultProfileMigrated', 'true');
        }
        return profiles;
    }

    async addProfile(name: string): Promise<void> {
        const profiles = this._profiles();
        const existing = profiles.find((p) => p.name === name);
        const newProfile = { name };

        if (existing === undefined) {
            profiles.push(newProfile);
        }

        cachedLocalStorage.set(profilesKey, JSON.stringify(profiles));
        const removedProfiles: string[] = JSON.parse(cachedLocalStorage.get(removedProfilesKey) ?? '[]');
        cachedLocalStorage.set(removedProfilesKey, JSON.stringify(removedProfiles.filter((p) => p !== name)));
        const initialValues = this._getStored(
            Object.keys(defaultSettings) as (keyof AsbplayerSettings)[],
            this._activeProfile()
        );
        this._set(initialValues, newProfile);
    }

    async removeProfile(name: string): Promise<void> {
        const profiles = this._profiles();
        const activeProfile = this._activeProfile();

        if (!profiles.some((p) => p.name === name)) return;
        if (profiles.length <= 1) throw new Error('Cannot remove the last profile');
        if (name === activeProfile?.name) {
            await this.setActiveProfile(profiles.find((p) => p.name !== name)!.name);
        }

        const newProfiles = profiles.filter((p) => p.name !== name);
        const removedProfiles: string[] = JSON.parse(cachedLocalStorage.get(removedProfilesKey) ?? '[]');
        cachedLocalStorage.set(removedProfilesKey, JSON.stringify(Array.from(new Set([...removedProfiles, name]))));
        const prefixedKeys = Object.keys(prefixedSettings(defaultSettings, name));

        for (const key of prefixedKeys) {
            cachedLocalStorage.delete(key);
        }

        cachedLocalStorage.set(profilesKey, JSON.stringify(newProfiles));
    }

    onSettingsUpdated(callback: () => void) {
        if (this._settingsUpdatedCallbacks.length === 0) {
            this._storageListener = (event: StorageEvent) => {
                const key = event.key;
                if (key === null) return;

                if (key === activeProfileKey || key === profilesKey) {
                    cachedLocalStorage.bustCache();
                    for (const c of this._settingsUpdatedCallbacks) c();
                    return;
                }

                const activeProfile = this._activeProfile();
                let settingKey = key;
                if (activeProfile !== undefined) {
                    const profilePrefix = prefixKey('', activeProfile.name);
                    if (!key.startsWith(profilePrefix)) return;
                    settingKey = unprefixKey(key, activeProfile.name);
                }
                if (!(settingKey in defaultSettings)) return;

                cachedLocalStorage.bustCache();
                if (saveOnlySettings.includes(settingKey as (typeof saveOnlySettings)[number])) return;
                for (const c of this._settingsUpdatedCallbacks) c();
            };
            window.addEventListener('storage', this._storageListener);
        }
        this._settingsUpdatedCallbacks.push(callback);
        return () => this._unsubscribe(callback);
    }

    private _unsubscribe(callback: () => void) {
        for (let i = this._settingsUpdatedCallbacks.length - 1; i >= 0; --i) {
            if (callback === this._settingsUpdatedCallbacks[i]) {
                this._settingsUpdatedCallbacks.splice(i, 1);
                break;
            }
        }

        if (this._settingsUpdatedCallbacks.length === 0 && this._storageListener !== undefined) {
            window.removeEventListener('storage', this._storageListener);
        }
    }

    clear() {
        cachedLocalStorage.bustCache();
        localStorage.clear();
    }
}
