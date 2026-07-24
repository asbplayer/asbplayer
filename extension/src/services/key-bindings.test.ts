import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { PlayMode } from '@project/common';
import { defaultSettings } from '@project/common/settings';
import type Binding from './binding';
import KeyBindings from './key-bindings';

describe('KeyBindings playback modes', () => {
    const bindings: KeyBindings[] = [];

    afterEach(() => {
        for (const binding of bindings) binding.unbind();
        bindings.length = 0;
    });

    it('toggles repeat between subtitles when a subtitle track is loaded', () => {
        const togglePlayMode = jest.fn();
        const context = {
            subtitleController: {
                subtitles: [{}],
                currentSubtitle: () => [null],
            },
            togglePlayMode,
        } as unknown as Binding;
        const binding = new KeyBindings();
        bindings.push(binding);
        binding.setKeyBindSet(context, {
            ...defaultSettings.keyBindSet,
            toggleRepeat: { keys: 'r' },
        });

        const keydown = new KeyboardEvent('keydown', { key: 'r', bubbles: true });
        Object.defineProperty(keydown, 'keyCode', { value: 82 });
        document.dispatchEvent(keydown);

        expect(togglePlayMode).toHaveBeenCalledWith(PlayMode.repeat);
    });
});
