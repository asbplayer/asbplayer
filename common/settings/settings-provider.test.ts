import {
    SettingsProvider,
    SubtitleAlignment,
    VideoSubtitleSplitBehavior,
    changeForTextSubtitleSetting,
    defaultSettings,
    textSubtitleSettingsForTrack,
} from '@project/common/settings';
import { expect, it } from '@jest/globals';
import { MockSettingsStorage } from './mock-settings-storage';

it('starts at default settings', async () => {
    const provider = new SettingsProvider(new MockSettingsStorage());
    const initialSettings = await provider.getAll();
    expect(initialSettings).toEqual(defaultSettings);
});

it('can change the value of object-typed settings', async () => {
    const provider = new SettingsProvider(new MockSettingsStorage());
    await provider.set({ tags: ['foo'] });
    expect(await provider.getSingle('tags')).toEqual(['foo']);
    const newKeyBindSet = {
        ...defaultSettings.keyBindSet,
        togglePlay: { keys: 'moon-wolf' },
    };
    await provider.set({ keyBindSet: newKeyBindSet });
    expect(await provider.getSingle('keyBindSet')).toEqual(newKeyBindSet);
});

it('can change the value of value-typed settings', async () => {
    const provider = new SettingsProvider(new MockSettingsStorage());
    await provider.set({ audioField: 'test-value' });
    expect(await provider.getSingle('audioField')).toBe('test-value');
    await provider.set({ videoSubtitleSplitBehavior: VideoSubtitleSplitBehavior.autoMaximizeVideo });
    expect(await provider.getSingle('videoSubtitleSplitBehavior')).toBe(VideoSubtitleSplitBehavior.autoMaximizeVideo);
});

it('returns the same object references if the values inside do not change', async () => {
    const provider = new SettingsProvider(new MockSettingsStorage());
    const newKeyBindSet = {
        ...defaultSettings.keyBindSet,
        togglePlay: { keys: 'moon-wolf' },
    };
    await provider.set({ keyBindSet: newKeyBindSet });
    expect(await provider.getSingle('keyBindSet')).toBe(await provider.getSingle('keyBindSet'));
});

it('changes different keys for different profiles', async () => {
    const storage = new MockSettingsStorage();
    const provider = new SettingsProvider(storage);
    const defaultProfileValue = 'https://foo.bar';
    await provider.set({ streamingAppUrl: defaultProfileValue });
    await storage.addProfile('profile');
    await storage.setActiveProfile('profile');
    const profileValue = await provider.getSingle('streamingAppUrl');
    expect(profileValue).toEqual('https://app.asbplayer.dev');
});

it('provides default values for unpopulated, nested settings', async () => {
    const storage = new MockSettingsStorage();
    const provider = new SettingsProvider(storage);
    storage.setData({ keyBindSet: { togglePlay: { keys: 'p' } } });
    expect(await provider.getSingle('keyBindSet')).toEqual({
        ...defaultSettings.keyBindSet,
        togglePlay: { keys: 'p' },
    });

    storage.setData({ ankiFieldSettings: { url: { order: 12 } } });
    expect(await provider.getSingle('ankiFieldSettings')).toEqual({
        ...defaultSettings.ankiFieldSettings,
        url: { order: 12 },
    });
});

it('removes corresponding field settings when custom anki fields are removed', async () => {
    const storage = new MockSettingsStorage();
    const provider = new SettingsProvider(storage);
    await provider.set({
        customAnkiFields: { foo: 'bar', baz: 'moo' },
        customAnkiFieldSettings: { foo: { order: 1, display: true }, baz: { order: 2, display: false } },
    });
    await provider.set({ customAnkiFields: { foo: 'bar' } });
    expect(await provider.get(['customAnkiFields', 'customAnkiFieldSettings'])).toEqual({
        customAnkiFields: { foo: 'bar' },
        customAnkiFieldSettings: { foo: { order: 1, display: true } },
    });
});

const subtitleSettings = {
    subtitleSize: 36,
    subtitleColor: '#ffffff',
    subtitleThickness: 700,
    subtitleOutlineThickness: 0,
    subtitleOutlineColor: '#000000',
    subtitleShadowThickness: 2,
    subtitleShadowColor: '#000000',
    subtitleBackgroundColor: '#000000',
    subtitleBackgroundOpacity: 0,
    subtitleFontFamily: 'ToppanBunkyuMidashiGothicStdN-ExtraBold',
    subtitleBlur: false,
    subtitleAlignment: 'bottom' as SubtitleAlignment,
    subtitleCustomStyles: [],
    imageBasedSubtitleScaleFactor: 1,
    subtitlePositionOffset: 70,
    topSubtitlePositionOffset: 70,
    subtitlesWidth: 100,
    subtitleTracksV2: [
        {
            subtitleSize: 36,
            subtitleColor: '#ffffff',
            subtitleThickness: 700,
            subtitleOutlineThickness: 0,
            subtitleOutlineColor: '#000000',
            subtitleShadowThickness: 2,
            subtitleShadowColor: '#000000',
            subtitleBackgroundColor: '#000000',
            subtitleBackgroundOpacity: 0,
            subtitleFontFamily: 'ToppanBunkyuMidashiGothicStdN-ExtraBold',
            subtitleBlur: true,
            subtitleAlignment: 'bottom' as SubtitleAlignment,
            subtitleCustomStyles: [],
        },
    ],
};

it('calculates diff for text subtitle settings', () => {
    expect(
        changeForTextSubtitleSetting({ subtitleCustomStyles: [{ key: 'opacity', value: '0.5' }] }, subtitleSettings, 2)
    ).toEqual({
        subtitleTracksV2: [
            {
                subtitleSize: 36,
                subtitleColor: '#ffffff',
                subtitleThickness: 700,
                subtitleOutlineThickness: 0,
                subtitleOutlineColor: '#000000',
                subtitleShadowThickness: 2,
                subtitleShadowColor: '#000000',
                subtitleBackgroundColor: '#000000',
                subtitleBackgroundOpacity: 0,
                subtitleFontFamily: 'ToppanBunkyuMidashiGothicStdN-ExtraBold',
                subtitleBlur: true,
                subtitleAlignment: 'bottom',
                subtitleCustomStyles: [],
            },
            {
                subtitleSize: 36,
                subtitleColor: '#ffffff',
                subtitleThickness: 700,
                subtitleOutlineThickness: 0,
                subtitleOutlineColor: '#000000',
                subtitleShadowThickness: 2,
                subtitleShadowColor: '#000000',
                subtitleBackgroundColor: '#000000',
                subtitleBackgroundOpacity: 0,
                subtitleFontFamily: 'ToppanBunkyuMidashiGothicStdN-ExtraBold',
                subtitleBlur: false,
                subtitleAlignment: 'bottom',
                subtitleCustomStyles: [{ key: 'opacity', value: '0.5' }],
            },
        ],
    });
    expect(changeForTextSubtitleSetting({ subtitleBlur: false }, subtitleSettings, 0)).toEqual({
        subtitleBlur: false,
    });
    expect(changeForTextSubtitleSetting({ subtitleOutlineColor: '#ccc' }, subtitleSettings, 1)).toEqual({
        subtitleTracksV2: [
            {
                subtitleSize: 36,
                subtitleColor: '#ffffff',
                subtitleThickness: 700,
                subtitleOutlineThickness: 0,
                subtitleOutlineColor: '#ccc',
                subtitleShadowThickness: 2,
                subtitleShadowColor: '#000000',
                subtitleBackgroundColor: '#000000',
                subtitleBackgroundOpacity: 0,
                subtitleFontFamily: 'ToppanBunkyuMidashiGothicStdN-ExtraBold',
                subtitleBlur: true,
                subtitleAlignment: 'bottom',
                subtitleCustomStyles: [],
            },
        ],
    });
    expect(changeForTextSubtitleSetting({ subtitleBlur: false }, subtitleSettings, 1)).toEqual({
        subtitleTracksV2: [],
    });
});

it('targets correct values for text subtitle ', () => {
    expect(textSubtitleSettingsForTrack(subtitleSettings, 0)).toEqual({
        subtitleSize: 36,
        subtitleColor: '#ffffff',
        subtitleThickness: 700,
        subtitleOutlineThickness: 0,
        subtitleOutlineColor: '#000000',
        subtitleShadowThickness: 2,
        subtitleShadowColor: '#000000',
        subtitleBackgroundColor: '#000000',
        subtitleBackgroundOpacity: 0,
        subtitleFontFamily: 'ToppanBunkyuMidashiGothicStdN-ExtraBold',
        subtitleBlur: false,
        subtitleAlignment: 'bottom',
        subtitleCustomStyles: [],
    });
    expect(textSubtitleSettingsForTrack(subtitleSettings, 1)).toEqual({
        subtitleSize: 36,
        subtitleColor: '#ffffff',
        subtitleThickness: 700,
        subtitleOutlineThickness: 0,
        subtitleOutlineColor: '#000000',
        subtitleShadowThickness: 2,
        subtitleShadowColor: '#000000',
        subtitleBackgroundColor: '#000000',
        subtitleBackgroundOpacity: 0,
        subtitleFontFamily: 'ToppanBunkyuMidashiGothicStdN-ExtraBold',
        subtitleBlur: true,
        subtitleAlignment: 'bottom',
        subtitleCustomStyles: [],
    });
});
