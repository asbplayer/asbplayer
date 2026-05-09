import { ExtensionGlobalStateProvider } from './extension-global-state-provider';
import { MockStorageArea } from './mock-storage-area';

it('can retrieve list of keys', async () => {
    const provider = new ExtensionGlobalStateProvider(new MockStorageArea());
    expect(await provider.get(['ftueHasSeenAnkiDialogQuickSelectV2'])).toEqual({
        ftueHasSeenAnkiDialogQuickSelectV2: false,
    });
    await provider.set({ ftueHasSeenAnkiDialogQuickSelectV2: true });
    expect(await provider.get(['ftueHasSeenAnkiDialogQuickSelectV2'])).toEqual({
        ftueHasSeenAnkiDialogQuickSelectV2: true,
    });
});

it('can retrieve 0 keys', async () => {
    const provider = new ExtensionGlobalStateProvider(new MockStorageArea());
    expect(await provider.get([])).toEqual({});
});

it('can retrieve all keys', async () => {
    const provider = new ExtensionGlobalStateProvider(new MockStorageArea());
    expect(await provider.getAll()).toEqual({
        ftueHasSeenAnkiDialogQuickSelectV2: false,
        ftueHasSeenSubtitleTrackSelector: false,
        ftueAnnotation: 0,
        onlineSubtitleSourceConfig: {
            jimakuApiKey: '',
        },
    });
});
