import { describe, expect, it } from '@jest/globals';
import type { GlobalStateUpdatedMessage } from '@project/common';
import type ChromeExtension from '@project/common/app/services/chrome-extension';
import { AppExtensionGlobalStateProvider } from '@project/common/app/services/app-extension-global-state-provider';

const stubExtension = (installed: boolean) => {
    const messageCallbacks: ((message: any) => void)[] = [];
    const extension = {
        get supportsGlobalState() {
            return installed;
        },
        subscribe: (callback: (message: any) => void) => {
            messageCallbacks.push(callback);
            return () => {
                const index = messageCallbacks.indexOf(callback);

                if (index >= 0) {
                    messageCallbacks.splice(index, 1);
                }
            };
        },
    } as unknown as ChromeExtension;

    return {
        extension,
        publish: (message: any) => {
            for (const callback of [...messageCallbacks]) {
                callback({ data: message });
            }
        },
    };
};

const globalStateUpdated = (state: any): GlobalStateUpdatedMessage => ({
    command: 'global-state-updated',
    state,
});

describe('AppExtensionGlobalStateProvider.onUpdated', () => {
    it('notifies listeners when the extension pushes global state updates', () => {
        const { extension, publish } = stubExtension(true);
        const provider = new AppExtensionGlobalStateProvider(extension);
        const updates: any[] = [];
        provider.onUpdated((state) => updates.push(state));

        publish(globalStateUpdated({ externalConnections: { approved: {}, pending: {} } }));
        publish({ command: 'settings-updated' });

        expect(updates).toEqual([{ externalConnections: { approved: {}, pending: {} } }]);
    });

    it('notifies multiple listeners and stops after unsubscribing all of them', () => {
        const { extension, publish } = stubExtension(true);
        const provider = new AppExtensionGlobalStateProvider(extension);
        const firstUpdates: any[] = [];
        const secondUpdates: any[] = [];
        const unsubscribeFirst = provider.onUpdated((state) => firstUpdates.push(state));
        provider.onUpdated((state) => secondUpdates.push(state));

        unsubscribeFirst();
        publish(globalStateUpdated({ ftueAnnotation: 2 }));

        expect(firstUpdates).toEqual([]);
        expect(secondUpdates).toEqual([{ ftueAnnotation: 2 }]);
    });

    it('stops listening to the extension once the last listener unsubscribes', () => {
        const { extension, publish } = stubExtension(true);
        const provider = new AppExtensionGlobalStateProvider(extension);
        const updates: any[] = [];
        const unsubscribe = provider.onUpdated((state) => updates.push(state));

        unsubscribe();
        publish(globalStateUpdated({ ftueAnnotation: 2 }));

        expect(updates).toEqual([]);
    });

    it('falls back to storage events when the extension does not support global state', () => {
        const { extension } = stubExtension(false);
        const provider = new AppExtensionGlobalStateProvider(extension);
        const updates: any[] = [];
        const unsubscribe = provider.onUpdated((state) => updates.push(state));

        const event = new StorageEvent('storage', { key: 'ftueHasSeenAnkiDialogQuickSelectV2', newValue: 'true' });
        Object.defineProperty(event, 'storageArea', { value: window.localStorage });
        window.dispatchEvent(event);

        const unrelatedEvent = new StorageEvent('storage', { key: 'unrelated', newValue: 'true' });
        Object.defineProperty(unrelatedEvent, 'storageArea', { value: window.localStorage });
        window.dispatchEvent(unrelatedEvent);

        unsubscribe();
        window.dispatchEvent(event);

        expect(updates).toEqual([{ ftueHasSeenAnkiDialogQuickSelectV2: true }]);
    });
});
