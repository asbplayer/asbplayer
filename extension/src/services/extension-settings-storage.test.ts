import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import { defaultSettings, profilesKey, activeProfileKey, prefixKey } from '@project/common/settings';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import { expect, it, beforeEach } from '@jest/globals';

const storage = new MockStorageArea();
const settingsStorage = new ExtensionSettingsStorage(storage);

beforeEach(async () => {
    await settingsStorage.clear();
});

it('serializes and deserializes the default settings', async () => {
    await settingsStorage.set(defaultSettings);

    expect(await settingsStorage.get(defaultSettings)).toEqual(defaultSettings);
});

it('copies the active profile when creating a new profile', async () => {
    await settingsStorage.set({ language: 'es' });
    await settingsStorage.addProfile('new profile');
    await settingsStorage.setActiveProfile('new profile');
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'es' });
});

it('changes separate keys for different profiles', async () => {
    await settingsStorage.addProfile('new profile');
    await settingsStorage.setActiveProfile('new profile');

    // Set profile value to 'es'
    await settingsStorage.set({ language: 'es' });
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'es' });
    await settingsStorage.setActiveProfile('Default');

    // Original profile still has its original value 'en'
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'en' });
});

it('creates a regular initial profile and protects the last remaining profile', async () => {
    expect(await settingsStorage.profiles()).toEqual([{ name: 'Default' }]);
    expect(await settingsStorage.activeProfile()).toEqual({ name: 'Default' });
    await expect(settingsStorage.removeProfile('Default')).rejects.toThrow('last profile');
    await expect(settingsStorage.setActiveProfile(undefined)).rejects.toThrow();
    expect(await settingsStorage.profiles()).toHaveLength(1);
});

it('allows removing the initial and active profiles and selects a survivor', async () => {
    await settingsStorage.set({ language: 'es' });
    await settingsStorage.addProfile('Second');
    await settingsStorage.setActiveProfile('Second');
    await settingsStorage.set({ language: 'ja' });
    await settingsStorage.setActiveProfile('Default');
    await settingsStorage.removeProfile('Default');
    expect(await settingsStorage.activeProfile()).toEqual({ name: 'Second' });
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'ja' });
    await expect(settingsStorage.removeProfile('Second')).rejects.toThrow('last profile');
});

it('migrates legacy settings once and preserves the selected named profile', async () => {
    await storage.set({
        language: 'es',
        [profilesKey]: [{ name: 'Japanese' }],
        [activeProfileKey]: 'Japanese',
        [prefixKey('language', 'Japanese')]: 'ja',
    });
    expect(await settingsStorage.profiles()).toEqual([{ name: 'Default' }, { name: 'Japanese' }]);
    expect(await settingsStorage.activeProfile()).toEqual({ name: 'Japanese' });
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'ja' });
    await settingsStorage.setActiveProfile('Default');
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'es' });
    await settingsStorage.removeProfile('Default');
    expect(await new ExtensionSettingsStorage(storage).profiles()).toEqual([{ name: 'Japanese' }]);
});

it('preserves the legacy profile even when no settings were stored', async () => {
    await storage.set({ [profilesKey]: [{ name: 'Profile 1' }] });
    expect(await settingsStorage.profiles()).toEqual([{ name: 'Default' }, { name: 'Profile 1' }]);
    expect(await settingsStorage.activeProfile()).toEqual({ name: 'Default' });
});

it('does not overwrite an existing named Default profile', async () => {
    await storage.set({
        [profilesKey]: [{ name: 'Default' }],
        language: 'es',
        [prefixKey('language', 'Default')]: 'ja',
    });
    expect(await settingsStorage.profiles()).toEqual([{ name: 'Default' }]);
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'ja' });
});
it('recovers a missing Default despite the migration flag and remembers explicit deletion', async () => {
    await storage.set({
        legacyDefaultProfileMigrated: true,
        [profilesKey]: [{ name: 'Japanese' }, { name: 'Spanish' }],
        [activeProfileKey]: 'Japanese',
        language: 'es',
        [prefixKey('language', 'Default')]: 'fr',
        [prefixKey('language', 'Japanese')]: 'ja',
    });
    expect(await settingsStorage.profiles()).toEqual([{ name: 'Default' }, { name: 'Japanese' }, { name: 'Spanish' }]);
    expect(await settingsStorage.activeProfile()).toEqual({ name: 'Japanese' });
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'ja' });
    await settingsStorage.setActiveProfile('Default');
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'fr' });
    await settingsStorage.removeProfile('Default');
    expect(await new ExtensionSettingsStorage(storage).profiles()).toEqual([{ name: 'Japanese' }, { name: 'Spanish' }]);
    await settingsStorage.addProfile('Default');
    expect(await settingsStorage.profiles()).toEqual([{ name: 'Japanese' }, { name: 'Spanish' }, { name: 'Default' }]);
});
