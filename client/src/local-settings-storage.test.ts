import { AsbplayerSettings, defaultSettings } from '@project/common/settings';
import { LocalSettingsStorage } from './local-settings-storage';
import { expect, it, beforeEach, jest } from '@jest/globals';

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

it('busts the cache without notifying settings callbacks for playback-owned storage events', async () => {
    const onSettingsUpdated = jest.fn();
    const unsubscribe = settingsStorage.onSettingsUpdated(onSettingsUpdated);

    await settingsStorage.set({ lastSubtitleOffset: 100 });
    localStorage.setItem('lastSubtitleOffset', '200');
    window.dispatchEvent(new StorageEvent('storage', { key: 'lastSubtitleOffset' }));
    expect(onSettingsUpdated).not.toHaveBeenCalled();
    expect(await settingsStorage.get({ lastSubtitleOffset: 0 })).toEqual({ lastSubtitleOffset: 200 });

    window.dispatchEvent(new StorageEvent('storage', { key: 'playbackRate' }));
    expect(onSettingsUpdated).toHaveBeenCalledTimes(1);

    unsubscribe();
});
