import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import { defaultSettings } from '@project/common/settings';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import { expect, it, beforeEach } from '@jest/globals';

const settingsStorage = new ExtensionSettingsStorage(new MockStorageArea());

beforeEach(async () => {
    await settingsStorage.clear();
});

it('serializes and deserializes the default settings', async () => {
    await settingsStorage.set(defaultSettings);

    expect(await settingsStorage.get(defaultSettings)).toEqual(defaultSettings);
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

it('changes keys for a profile other than the active one', async () => {
    await settingsStorage.addProfile('new profile');
    await settingsStorage.targetingProfile('new profile').set({ language: 'es' });

    // Active (default) profile still has default value 'en'
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'en' });
    expect(await settingsStorage.targetingProfile('new profile').get({ language: 'en' })).toEqual({
        language: 'es',
    });
});

it('changes keys for the default profile while another profile is active', async () => {
    await settingsStorage.addProfile('new profile');
    await settingsStorage.setActiveProfile('new profile');
    await settingsStorage.targetingProfile(undefined).set({ language: 'es' });

    // Active profile still has default value 'en'
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'en' });
    expect(await settingsStorage.targetingProfile(undefined).get({ language: 'en' })).toEqual({ language: 'es' });
});
