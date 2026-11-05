import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DefaultKeyBinder } from '@project/common/key-binder';
import { defaultSettings } from '@project/common/settings';
import type { AsbplayerSettings } from '@project/common/settings';
import { PlayMode } from '@project/common';
import type { SubtitleModel } from '@project/common';
import { useRecipeKeyBindings } from '@project/common/hooks/use-recipe-key-bindings';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('recipe keyboard shortcuts', () => {
    let container: HTMLDivElement;
    let root: Root;
    let saves: Partial<AsbplayerSettings>[];
    const settings: AsbplayerSettings = {
        ...defaultSettings,
        recipes: [
            { name: 'Reading', playbackModes: [PlayMode.autoPause], settings: { playbackRate: 0.8 } },
            { name: 'Listening', playbackModes: [PlayMode.repeat], settings: { playbackRate: 1.2 } },
        ],
    };
    const keyBinder = new DefaultKeyBinder({
        ...defaultSettings.keyBindSet,
        toggleRecipe1: { keys: 's' },
        toggleRecipe2: { keys: 't' },
        toggleRecipe3: { keys: 'u' },
        cycleRecipesForward: { keys: 'f' },
        cycleRecipesBackward: { keys: 'b' },
    });

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        saves = [];
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    function Player({ subtitles, disabled }: { subtitles: SubtitleModel[]; disabled: boolean }) {
        const [current, setCurrent] = useState(settings);
        useRecipeKeyBindings(
            keyBinder,
            current,
            (change) => {
                saves.push(change);
                setCurrent((previous) => ({ ...previous, ...change }));
            },
            disabled,
            subtitles
        );
        return <output>{current.activeRecipeId ?? 'disabled'}</output>;
    }

    const renderPlayer = (count: number, disabled = false) => {
        const subtitles = Array.from({ length: count }, (_, index) => ({
            text: 'subtitle',
            start: index * 1000,
            end: (index + 1) * 1000,
            originalStart: index * 1000,
            originalEnd: (index + 1) * 1000,
            track: 0,
        }));
        act(() => root.render(<Player subtitles={subtitles} disabled={disabled} />));
    };
    const press = (key: string) => {
        let consumed = false;
        act(() => {
            for (const type of ['keydown', 'keyup']) {
                const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
                Object.defineProperty(event, 'keyCode', { value: key.toUpperCase().charCodeAt(0) });
                document.dispatchEvent(event);
                consumed ||= event.defaultPrevented;
            }
        });
        return consumed;
    };

    it('enables toggling and cycling only with subtitles, and preserves the dialog blocker', () => {
        renderPlayer(0);
        for (const key of ['s', 't', 'f', 'b']) expect(press(key)).toBe(false);
        expect(saves).toEqual([]);
        renderPlayer(1);
        for (const [key, selected] of [
            ['s', '0'],
            ['s', 'disabled'],
            ['s', '0'],
            ['f', '1'],
            ['b', '0'],
            ['t', '1'],
            ['t', 'disabled'],
            ['t', '1'],
        ]) {
            press(key);
            expect(container.textContent).toBe(selected);
        }
        expect(saves).toHaveLength(8);
        press('u');
        expect(container.textContent).toBe('1');
        expect(saves).toHaveLength(8);
        renderPlayer(0);
        for (const key of ['s', 't', 'f', 'b']) expect(press(key)).toBe(false);
        expect(container.textContent).toBe('1');
        expect(saves).toHaveLength(8);
        renderPlayer(2, true);
        for (const key of ['s', 't', 'f', 'b']) expect(press(key)).toBe(false);
        expect(container.textContent).toBe('1');
        expect(saves).toHaveLength(8);
    });
});
