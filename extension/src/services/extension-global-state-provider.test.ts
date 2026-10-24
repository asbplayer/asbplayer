import { ExtensionGlobalStateProvider } from '@project/extension/src/services/extension-global-state-provider';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import { initialGlobalState } from '@project/common/global-state';
import { expect, it } from '@jest/globals';

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
        genericSubtitleParser: {
            pages: {},
        },
        onlineSubtitleSourceConfig: {
            jimakuApiKey: '',
            jimakuSearchCategory: 'anime',
            jimakuRecentWorks: [],
        },
        externalConnections: {
            approved: {},
            pending: {},
        },
    });
});

it('notifies onUpdated listeners of changes to global state keys', async () => {
    const storage = new MockStorageArea();
    const provider = new ExtensionGlobalStateProvider(storage);
    const updates: any[] = [];
    provider.onUpdated((state) => updates.push(state));

    await provider.set({ ftueAnnotation: 1 });

    expect(updates).toEqual([{ ftueAnnotation: 1 }]);
});

it('ignores changes to keys outside of global state', async () => {
    const storage = new MockStorageArea();
    const provider = new ExtensionGlobalStateProvider(storage);
    const updates: any[] = [];
    provider.onUpdated((state) => updates.push(state));

    // Settings live in the same storage area but are not global state.
    await storage.set({ 'some-settings-key': 'es' });

    expect(updates).toEqual([]);
});

it('falls back to the initial value when a global state key is removed', async () => {
    const storage = new MockStorageArea();
    const provider = new ExtensionGlobalStateProvider(storage);
    const updates: any[] = [];
    provider.onUpdated((state) => updates.push(state));

    await provider.set({ externalConnections: { approved: { sibling: { approvedAt: 0 } }, pending: {} } });
    await storage.remove('externalConnections');

    expect(updates).toEqual([
        { externalConnections: { approved: { sibling: { approvedAt: 0 } }, pending: {} } },
        { externalConnections: initialGlobalState.externalConnections },
    ]);
});

it('gives each onUpdated listener its own copy of the state', async () => {
    const provider = new ExtensionGlobalStateProvider(new MockStorageArea());
    const first: any[] = [];
    const second: any[] = [];
    provider.onUpdated((state) => {
        first.push(state);
        (state as any).ftueAnnotation = 99;
    });
    provider.onUpdated((state) => second.push(state));

    await provider.set({ ftueAnnotation: 1 });

    expect(second).toEqual([{ ftueAnnotation: 1 }]);
});

it('stops notifying after unsubscribing all onUpdated listeners', async () => {
    const provider = new ExtensionGlobalStateProvider(new MockStorageArea());
    const updates: any[] = [];
    const unsubscribe = provider.onUpdated((state) => updates.push(state));

    unsubscribe();
    await provider.set({ ftueAnnotation: 1 });

    expect(updates).toEqual([]);
});
