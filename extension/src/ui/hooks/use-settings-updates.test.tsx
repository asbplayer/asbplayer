import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { PlayMode } from '@project/common';
import { DefaultKeyBinder } from '@project/common/key-binder';
import { defaultSettings, SettingsProvider } from '@project/common/settings';
import type { AsbplayerSettings } from '@project/common/settings';
import { useRecipeKeyBindings } from '@project/common/hooks/use-recipe-key-bindings';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import { useSettingsUpdates } from '@project/extension/src/ui/hooks/use-settings-updates';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('extension recipe settings updates', () => {
    const originalBrowser = Object.getOwnPropertyDescriptor(globalThis, 'browser');
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        if (originalBrowser) Object.defineProperty(globalThis, 'browser', originalBrowser);
        else Reflect.deleteProperty(globalThis, 'browser');
    });

    it('cycles using the updated local selection and broadcasts after each selection is stored', async () => {
        const provider = new SettingsProvider(new ExtensionSettingsStorage(new MockStorageArea()));
        const initial: AsbplayerSettings = {
            ...defaultSettings,
            recipes: [
                { name: 'Reading', playbackModes: [PlayMode.autoPause], settings: { playbackRate: 0.8 } },
                { name: 'Listening', playbackModes: [PlayMode.repeat], settings: { playbackRate: 1.2 } },
            ],
        };
        await provider.set(initial);
        const publishedSelections: (number | null)[] = [];
        const commands: unknown[] = [];
        Object.defineProperty(globalThis, 'browser', {
            configurable: true,
            value: {
                runtime: {
                    sendMessage: async (command: unknown) => {
                        commands.push(command);
                        publishedSelections.push(await provider.getSingle('activeRecipeId'));
                    },
                },
            },
        });
        const keyBinder = new DefaultKeyBinder({
            ...defaultSettings.keyBindSet,
            cycleRecipesForward: { keys: 'f' },
        });
        const subtitles = [{ text: 'subtitle', start: 0, end: 1000, originalStart: 0, originalEnd: 1000, track: 0 }];
        function Player() {
            const [settings, setSettings] = useState<AsbplayerSettings | undefined>(initial);
            const onSettingsChanged = useSettingsUpdates(provider, setSettings);
            useRecipeKeyBindings(keyBinder, settings!, onSettingsChanged, false, subtitles);
            return <output>{settings!.activeRecipeId ?? 'disabled'}</output>;
        }
        await act(async () => root.render(<Player />));
        for (const selected of ['0', '1', 'disabled']) {
            await act(async () => {
                for (const type of ['keydown', 'keyup']) {
                    const event = new KeyboardEvent(type, { key: 'f', bubbles: true, cancelable: true });
                    Object.defineProperty(event, 'keyCode', { value: 70 });
                    document.dispatchEvent(event);
                }
            });
            expect(container.textContent).toBe(selected);
        }
        expect(publishedSelections).toEqual([0, 1, null]);
        expect(commands).toEqual(
            Array.from({ length: 3 }, () => ({
                sender: 'asbplayer-settings',
                message: { command: 'settings-updated' },
            }))
        );
        expect((await provider.getAll()).recipes).toEqual(initial.recipes);
    });
});
