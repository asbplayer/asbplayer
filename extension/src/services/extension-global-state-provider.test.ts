import { ExtensionGlobalStateProvider } from '@project/extension/src/services/extension-global-state-provider';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import { MockLockManager } from '@project/extension/src/services/mock-lock-manager';
import { initialGlobalState, mutateExternalConnections } from '@project/common/global-state';
import { describe, expect, it } from '@jest/globals';

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
        externalConnections: {},
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

    await provider.set({
        externalConnections: { sibling: { approvedAt: 0, requestedAt: 0, methods: {} } },
    });
    await storage.remove('externalConnections');

    expect(updates).toEqual([
        { externalConnections: { sibling: { approvedAt: 0, requestedAt: 0, methods: {} } } },
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

describe('updateWithLocking', () => {
    it('applies and persists the mutation while holding the lock', async () => {
        const locks = new MockLockManager();
        const provider = new ExtensionGlobalStateProvider(new MockStorageArea(), locks);

        await mutateExternalConnections(provider, (externalConnections) => {
            externalConnections['ext-1'] = { name: 'ext', approvedAt: 123, requestedAt: 111, methods: {} };
            return true;
        });

        expect(locks.requestedNames).toEqual(['asbplayer-global-state:externalConnections']);
        const stored = (await provider.get(['externalConnections'])).externalConnections;
        expect(stored).toEqual({ 'ext-1': { name: 'ext', approvedAt: 123, requestedAt: 111, methods: {} } });
    });

    it('does not write when the mutator reports no change', async () => {
        const storage = new MockStorageArea();
        const locks = new MockLockManager();
        const provider = new ExtensionGlobalStateProvider(storage, locks);
        const updates: any[] = [];
        provider.onUpdated((state) => updates.push(state));

        await mutateExternalConnections(provider, () => false);

        expect(updates).toEqual([]);
        const stored = (await storage.get({ externalConnections: initialGlobalState.externalConnections }))
            .externalConnections;
        expect(stored).toEqual(initialGlobalState.externalConnections);
    });

    it('waits when the lock is already held', async () => {
        const lockName = 'asbplayer-global-state:externalConnections';
        const locks = new MockLockManager();
        locks.hold(lockName);
        const provider = new ExtensionGlobalStateProvider(new MockStorageArea(), locks);
        let mutated = false;
        const update = mutateExternalConnections(provider, (externalConnections) => {
            mutated = true;
            externalConnections['ext-1'] = { name: 'ext', approvedAt: 123, requestedAt: 102, methods: {} };
            return true;
        });

        await Promise.resolve();
        expect(mutated).toBe(false);
        expect((await provider.get(['externalConnections'])).externalConnections).toEqual({});

        locks.releaseHeld(lockName);
        await update;

        expect(mutated).toBe(true);
        expect((await provider.get(['externalConnections'])).externalConnections).toEqual({
            'ext-1': { name: 'ext', approvedAt: 123, requestedAt: 102, methods: {} },
        });
    });

    it('serializes concurrent mutations instead of losing one', async () => {
        const provider = new ExtensionGlobalStateProvider(new MockStorageArea(), new MockLockManager());

        await Promise.all([
            mutateExternalConnections(provider, (externalConnections) => {
                externalConnections['ext-1'] = { name: 'one', approvedAt: 1, requestedAt: 1, methods: {} };
                return true;
            }),
            mutateExternalConnections(provider, (externalConnections) => {
                externalConnections['ext-2'] = { name: 'two', approvedAt: 2, requestedAt: 2, methods: {} };
                return true;
            }),
        ]);

        expect((await provider.get(['externalConnections'])).externalConnections).toEqual({
            'ext-1': { name: 'one', approvedAt: 1, requestedAt: 1, methods: {} },
            'ext-2': { name: 'two', approvedAt: 2, requestedAt: 2, methods: {} },
        });
    });
});
