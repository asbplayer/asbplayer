import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { PlayMode } from '@project/common';
import { currentTokenSelectionLocation, HoveredToken, selectTokenInRoot } from '@project/common/annotations';
import { makeSubtitle, makeToken } from '@project/common/annotations/annotations-test-utils';
import { ApplyStrategy, defaultSettings, TokenStatus } from '@project/common/settings';
import type Binding from '@project/extension/src/services/binding';
import KeyBindings from '@project/extension/src/services/key-bindings';

describe('KeyBindings playback modes', () => {
    const bindings: KeyBindings[] = [];

    afterEach(() => {
        for (const binding of bindings) binding.unbind();
        bindings.length = 0;
        document.body.replaceChildren();
        document.getSelection()?.removeAllRanges();
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

    it('repeatedly seeks and selects matching tokens without taking focus from the video', () => {
        const subtitles = [
            makeSubtitle({
                index: 0,
                start: 100,
                end: 200,
                text: 'first',
                tokenization: { tokens: [makeToken({ pos: [0, 5], status: TokenStatus.UNCOLLECTED })] },
            }),
            makeSubtitle({
                index: 1,
                start: 300,
                end: 400,
                text: 'second',
                tokenization: { tokens: [makeToken({ pos: [0, 6], status: TokenStatus.UNCOLLECTED })] },
            }),
        ];
        const seek = jest.fn<Binding['seek']>().mockResolvedValue(undefined);
        const saveTokenLocal = jest.fn();
        const tokenContainer = document.createElement('div');
        tokenContainer.className = 'asbplayer-token-container';
        tokenContainer.tabIndex = -1;
        tokenContainer.innerHTML =
            '<span data-asb-subtitle-index="0" data-track="0"><span class="asb-token" data-asb-token-start="0">first</span></span>' +
            '<span data-asb-subtitle-index="1" data-track="0"><span class="asb-token" data-asb-token-start="0">second</span></span>';
        const video = document.createElement('video');
        video.tabIndex = 0;
        document.body.append(video, tokenContainer);
        video.focus();
        const context = {
            subtitleController: {
                subtitles,
                subtitleAnnotations: { saveTokenLocal },
                currentTokenSelectionLocation: () => currentTokenSelectionLocation(subtitles, tokenContainer),
                selectToken: (target: { subtitleIndex: number; tokenStart: number }) =>
                    selectTokenInRoot(tokenContainer, target, { focusContainer: false }),
            },
            currentTimeMs: 0,
            seekableTracks: 1,
            seek,
            hoveredToken: new HoveredToken(),
        } as unknown as Binding;
        const binding = new KeyBindings();
        bindings.push(binding);
        binding.setKeyBindSet(context, {
            ...defaultSettings.keyBindSet,
            jumpToNextTokenStatus0: { keys: 'n' },
            markHoveredToken1: { keys: 'm' },
        });

        const keydown = new KeyboardEvent('keydown', { key: 'n', bubbles: true });
        Object.defineProperty(keydown, 'keyCode', { value: 78 });
        document.dispatchEvent(keydown);

        expect(seek).toHaveBeenCalledWith(100);
        expect(document.getSelection()?.toString()).toBe('first');
        expect(document.activeElement).toBe(video);

        const jumpKeyup = new KeyboardEvent('keyup', { key: 'n', bubbles: true });
        Object.defineProperty(jumpKeyup, 'keyCode', { value: 78 });
        document.dispatchEvent(jumpKeyup);
        document.getSelection()?.removeAllRanges();

        const secondJumpKeydown = new KeyboardEvent('keydown', { key: 'n', bubbles: true });
        Object.defineProperty(secondJumpKeydown, 'keyCode', { value: 78 });
        document.dispatchEvent(secondJumpKeydown);

        expect(seek).toHaveBeenLastCalledWith(300);
        expect(document.getSelection()?.toString()).toBe('second');
        expect(document.activeElement).toBe(video);

        const secondJumpKeyup = new KeyboardEvent('keyup', { key: 'n', bubbles: true });
        Object.defineProperty(secondJumpKeyup, 'keyCode', { value: 78 });
        document.dispatchEvent(secondJumpKeyup);
        const markKeydown = new KeyboardEvent('keydown', { key: 'm', bubbles: true });
        Object.defineProperty(markKeydown, 'keyCode', { value: 77 });
        document.dispatchEvent(markKeydown);

        expect(saveTokenLocal).toHaveBeenCalledWith(0, 'second', TokenStatus.UNKNOWN, [], ApplyStrategy.ADD);
        const markKeyup = new KeyboardEvent('keyup', { key: 'm', bubbles: true });
        Object.defineProperty(markKeyup, 'keyCode', { value: 77 });
        document.dispatchEvent(markKeyup);
    });

    it('does not consume a jump shortcut when no token matches its target', () => {
        const subtitles = [
            makeSubtitle({
                text: 'mature',
                tokenization: { tokens: [makeToken({ pos: [0, 6], status: TokenStatus.MATURE })] },
            }),
        ];
        const seek = jest.fn<Binding['seek']>().mockResolvedValue(undefined);
        const context = {
            subtitleController: {
                subtitles,
                currentTokenSelectionLocation: () => undefined,
            },
            currentTimeMs: 0,
            seekableTracks: 1,
            seek,
        } as unknown as Binding;
        const binding = new KeyBindings();
        bindings.push(binding);
        binding.setKeyBindSet(context, {
            ...defaultSettings.keyBindSet,
            jumpToNextTokenStatus1: { keys: 'n' },
        });

        const keydown = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true });
        Object.defineProperty(keydown, 'keyCode', { value: 78 });
        document.dispatchEvent(keydown);
        const keyup = new KeyboardEvent('keyup', { key: 'n', bubbles: true, cancelable: true });
        Object.defineProperty(keyup, 'keyCode', { value: 78 });
        document.dispatchEvent(keyup);

        expect(seek).not.toHaveBeenCalled();
        expect(keydown.defaultPrevented).toBe(false);
        expect(keyup.defaultPrevented).toBe(false);
    });

    it.each([
        { chordKey: 'e', chordKeyCode: 69, currentTimeMs: 250, expectedStart: 500 },
        { chordKey: 'w', chordKeyCode: 87, currentTimeMs: 250, expectedStart: 100 },
    ])('uses the default Q+$chordKey shortcut to jump to any adjacent token', (testCase) => {
        const subtitles = [
            makeSubtitle({
                index: 0,
                start: 100,
                end: 200,
                text: 'mature',
                tokenization: {
                    tokens: [makeToken({ pos: [0, 6], status: TokenStatus.MATURE, states: [] })],
                },
            }),
            makeSubtitle({
                index: 1,
                start: 500,
                end: 600,
                text: 'uncollected',
                tokenization: {
                    tokens: [makeToken({ pos: [0, 11], status: TokenStatus.UNCOLLECTED })],
                },
            }),
        ];
        const seek = jest.fn<Binding['seek']>().mockResolvedValue(undefined);
        const context = {
            subtitleController: {
                subtitles,
                currentTokenSelectionLocation: () => undefined,
                selectToken: () => true,
            },
            currentTimeMs: testCase.currentTimeMs,
            seekableTracks: 1,
            seek,
        } as unknown as Binding;
        const binding = new KeyBindings();
        bindings.push(binding);
        binding.setKeyBindSet(context, defaultSettings.keyBindSet);

        const qDown = new KeyboardEvent('keydown', { key: 'q', bubbles: true });
        Object.defineProperty(qDown, 'keyCode', { value: 81 });
        document.dispatchEvent(qDown);
        const chordDown = new KeyboardEvent('keydown', { key: testCase.chordKey, bubbles: true });
        Object.defineProperty(chordDown, 'keyCode', { value: testCase.chordKeyCode });
        document.dispatchEvent(chordDown);

        expect(seek).toHaveBeenCalledWith(testCase.expectedStart);

        const chordUp = new KeyboardEvent('keyup', { key: testCase.chordKey, bubbles: true });
        Object.defineProperty(chordUp, 'keyCode', { value: testCase.chordKeyCode });
        document.dispatchEvent(chordUp);
        const qUp = new KeyboardEvent('keyup', { key: 'q', bubbles: true });
        Object.defineProperty(qUp, 'keyCode', { value: 81 });
        document.dispatchEvent(qUp);
    });
});
