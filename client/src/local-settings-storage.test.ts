import { AsbplayerSettings, defaultSettings } from '@project/common/settings';
import { LocalSettingsStorage } from './local-settings-storage';
import { expect, it, beforeEach } from '@jest/globals';

const settingsStorage = new LocalSettingsStorage();

beforeEach(() => {
    settingsStorage.clear();
});

it('serializes and deserializes the default settings', async () => {
    await settingsStorage.set(defaultSettings);

    for (const key of Object.keys(defaultSettings)) {
        expect(localStorage.getItem(key)).not.toBeNull();
    }

    expect(await settingsStorage.get(defaultSettings)).toEqual(defaultSettings);
    expect(await settingsStorage.getStored(Object.keys(defaultSettings) as (keyof AsbplayerSettings)[])).toEqual(
        defaultSettings
    );
});

it('copies default profile when creating a new profile', async () => {
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
    await settingsStorage.setActiveProfile(undefined);

    // Default profile still has default value 'en'
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'en' });
});
