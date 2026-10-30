import type { AsbplayerSettings } from '@project/common/settings';
import { activeProfileKey, defaultSettings, prefixKey, profilesKey } from '@project/common/settings';
import { LocalSettingsStorage } from '@project/client/src/local-settings-storage';
import { expect, it, beforeEach, jest } from '@jest/globals';

const settingsStorage = new LocalSettingsStorage();

beforeEach(() => {
    settingsStorage.clear();
});

it('serializes and deserializes the default settings', async () => {
    await settingsStorage.set(defaultSettings);

    for (const key of Object.keys(defaultSettings)) {
        expect(localStorage.getItem(prefixKey(key, 'Default'))).not.toBeNull();
    }

    expect(await settingsStorage.get(defaultSettings)).toEqual(defaultSettings);
    expect(await settingsStorage.getStored(Object.keys(defaultSettings) as (keyof AsbplayerSettings)[])).toEqual(
        defaultSettings
    );
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

it('busts the cache without notifying settings callbacks for playback-owned storage events', async () => {
    const onSettingsUpdated = jest.fn();
    const unsubscribe = settingsStorage.onSettingsUpdated(onSettingsUpdated);

    await settingsStorage.set({ lastSubtitleOffset: 100 });
    localStorage.setItem(prefixKey('lastSubtitleOffset', 'Default'), '200');
    window.dispatchEvent(new StorageEvent('storage', { key: prefixKey('lastSubtitleOffset', 'Default') }));
    expect(onSettingsUpdated).not.toHaveBeenCalled();
    expect(await settingsStorage.get({ lastSubtitleOffset: 0 })).toEqual({ lastSubtitleOffset: 200 });

    window.dispatchEvent(new StorageEvent('storage', { key: prefixKey('playbackRate', 'Default') }));
    expect(onSettingsUpdated).toHaveBeenCalledTimes(1);

    unsubscribe();
});

it('handles active profile setting events and ignores other profile events', async () => {
    await settingsStorage.addProfile('Test');
    await settingsStorage.addProfile('Else');
    await settingsStorage.setActiveProfile('Test');

    const onSettingsUpdated = jest.fn();
    const unsubscribe = settingsStorage.onSettingsUpdated(onSettingsUpdated);
    await settingsStorage.get({ ankiConnectUrl: '' });

    localStorage.setItem(prefixKey('ankiConnectUrl', 'Test'), 'http://127.0.0.1:876');
    window.dispatchEvent(new StorageEvent('storage', { key: prefixKey('ankiConnectUrl', 'Test') }));

    expect(onSettingsUpdated).toHaveBeenCalledTimes(1);
    expect(await settingsStorage.get({ ankiConnectUrl: '' })).toEqual({
        ankiConnectUrl: 'http://127.0.0.1:876',
    });

    localStorage.setItem(prefixKey('ankiConnectUrl', 'Else'), 'http://127.0.0.1:875');
    window.dispatchEvent(new StorageEvent('storage', { key: prefixKey('ankiConnectUrl', 'Else') }));

    expect(onSettingsUpdated).toHaveBeenCalledTimes(1);
    unsubscribe();
});

it('refreshes profile metadata and active profile settings from storage events', async () => {
    await settingsStorage.addProfile('Test');
    await settingsStorage.addProfile('Else');
    await settingsStorage.setActiveProfile('Test');
    await settingsStorage.set({ ankiConnectUrl: 'test-url' });
    await settingsStorage.setActiveProfile('Else');
    await settingsStorage.set({ ankiConnectUrl: 'else-url' });
    await settingsStorage.setActiveProfile('Test');

    const onSettingsUpdated = jest.fn();
    const unsubscribe = settingsStorage.onSettingsUpdated(onSettingsUpdated);
    expect(await settingsStorage.get({ ankiConnectUrl: '' })).toEqual({ ankiConnectUrl: 'test-url' });

    localStorage.setItem(activeProfileKey, 'Else');
    window.dispatchEvent(new StorageEvent('storage', { key: activeProfileKey }));

    expect(onSettingsUpdated).toHaveBeenCalledTimes(1);
    expect(await settingsStorage.activeProfile()).toEqual({ name: 'Else' });
    expect(await settingsStorage.get({ ankiConnectUrl: '' })).toEqual({ ankiConnectUrl: 'else-url' });

    localStorage.setItem(
        profilesKey,
        JSON.stringify([{ name: 'Default' }, { name: 'Test' }, { name: 'Else' }, { name: 'New' }])
    );
    window.dispatchEvent(new StorageEvent('storage', { key: profilesKey }));

    expect(onSettingsUpdated).toHaveBeenCalledTimes(2);
    expect(await settingsStorage.profiles()).toEqual([
        { name: 'Default' },
        { name: 'Test' },
        { name: 'Else' },
        { name: 'New' },
    ]);
    unsubscribe();
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
    localStorage.setItem('language', 'es');
    localStorage.setItem(profilesKey, JSON.stringify([{ name: 'Japanese' }]));
    localStorage.setItem(activeProfileKey, 'Japanese');
    localStorage.setItem(prefixKey('language', 'Japanese'), 'ja');
    expect(await settingsStorage.profiles()).toEqual([{ name: 'Default' }, { name: 'Japanese' }]);
    expect(await settingsStorage.activeProfile()).toEqual({ name: 'Japanese' });
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'ja' });
    await settingsStorage.setActiveProfile('Default');
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'es' });
    await settingsStorage.removeProfile('Default');
    expect(await new LocalSettingsStorage().profiles()).toEqual([{ name: 'Japanese' }]);
});

it('preserves the legacy profile even when no settings were stored', async () => {
    localStorage.setItem(profilesKey, JSON.stringify([{ name: 'Profile 1' }]));
    expect(await settingsStorage.profiles()).toEqual([{ name: 'Default' }, { name: 'Profile 1' }]);
    expect(await settingsStorage.activeProfile()).toEqual({ name: 'Default' });
});

it('does not overwrite an existing named Default profile', async () => {
    localStorage.setItem(profilesKey, JSON.stringify([{ name: 'Default' }]));
    localStorage.setItem('language', 'es');
    localStorage.setItem(prefixKey('language', 'Default'), 'ja');
    expect(await settingsStorage.profiles()).toEqual([{ name: 'Default' }]);
    expect(await settingsStorage.get({ language: 'en' })).toEqual({ language: 'ja' });
});