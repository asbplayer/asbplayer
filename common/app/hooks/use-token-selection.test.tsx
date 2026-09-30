import React, { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { makeSubtitle, makeToken } from '@project/common/annotations/annotations-test-utils';
import {
    claimTokenSelectionFocus,
    restoreClaimedTokenSelectionFocus,
    useTokenSelection,
} from '@project/common/app/hooks/use-token-selection';
import type { TokenSelectionRequestOptions } from '@project/common/app/hooks/use-token-selection';
import type { TokenSelectionLocation } from '@project/common/annotations';
import type { TokenJumpTarget } from '@project/common/settings';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const subtitles = [
    makeSubtitle({
        index: 0,
        text: 'word',
        tokenization: { tokens: [makeToken({ pos: [0, 4] })] },
    }),
];

class TestKeyBinder {
    private readonly handlers: ((event: KeyboardEvent, target: TokenJumpTarget, forward: boolean) => void)[] = [];

    bindJumpToToken(handler: (event: KeyboardEvent, target: TokenJumpTarget, forward: boolean) => boolean) {
        this.handlers.push(handler);
        return () => this.handlers.splice(this.handlers.indexOf(handler), 1);
    }

    jumpFrom(target: Element) {
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'target', { value: target });
        for (const handler of this.handlers) handler(event, { kind: 'any' }, true);
    }
}

const TestPlayer = ({
    name,
    keyBinder,
    onMatch,
    subtitleData,
    exposeRequest,
}: {
    name: string;
    keyBinder: TestKeyBinder;
    onMatch: () => void;
    subtitleData: typeof subtitles;
    exposeRequest?: (request: (target: TokenSelectionLocation, options?: TokenSelectionRequestOptions) => void) => void;
}) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const { requestTokenSelection } = useTokenSelection({
        rootRef,
        maxAttempts: 1,
        keyBinder,
        subtitles: subtitleData,
        getCurrentTime: () => 0,
        getSeekableTracks: () => 1,
        onMatch,
        disabledGetter: () => false,
    });
    exposeRequest?.(requestTokenSelection);
    return (
        <div ref={rootRef} className="asbplayer-token-container" data-player={name} tabIndex={-1}>
            <button>{name}</button>
            <span data-asb-subtitle-index="0">
                <span data-asb-token-start="0">word</span>
            </span>
        </div>
    );
};

describe('useTokenSelection', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            callback(0);
            return 1;
        });
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        document.body.classList.remove('asbplayer-token-container');
        document.body.removeAttribute('tabindex');
        claimTokenSelectionFocus(null);
        jest.restoreAllMocks();
    });

    it('keeps shared token jumps with their last owning player', () => {
        const keyBinder = new TestKeyBinder();
        const videoMatch = jest.fn();
        const subtitleMatch = jest.fn();
        const renderPlayers = (subtitleData = subtitles) =>
            root.render(
                <>
                    <TestPlayer {...{ keyBinder, subtitleData }} name="video" onMatch={videoMatch} />
                    <TestPlayer {...{ keyBinder, subtitleData }} name="subtitles" onMatch={subtitleMatch} />
                </>
            );

        act(() => renderPlayers());
        keyBinder.jumpFrom(container.querySelector('[data-player="video"] button')!);
        expect(videoMatch).toHaveBeenCalledTimes(1);
        expect(subtitleMatch).not.toHaveBeenCalled();

        document.body.className = 'asbplayer-token-container';
        document.body.tabIndex = -1;
        document.body.focus();
        act(() => {
            window.dispatchEvent(new FocusEvent('focus'));
        });
        expect(document.activeElement).toBe(container.querySelector('[data-player="video"]'));

        document.body.focus();
        keyBinder.jumpFrom(document.body);
        expect(videoMatch).toHaveBeenCalledTimes(2);
        expect(subtitleMatch).not.toHaveBeenCalled();

        keyBinder.jumpFrom(container.querySelector('[data-player="subtitles"] button')!);
        act(() => renderPlayers([...subtitles]));
        expect(subtitleMatch).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(container.querySelector('[data-player="subtitles"]'));

        const frame = document.body.appendChild(document.createElement('iframe'));
        claimTokenSelectionFocus(frame);
        document.body.focus();
        keyBinder.jumpFrom(document.body);
        expect(videoMatch).toHaveBeenCalledTimes(2);
        expect(subtitleMatch).toHaveBeenCalledTimes(1);
        frame.remove();
    });

    it('restores a claimed video frame on consecutive popup returns', () => {
        const frame = document.body.appendChild(document.createElement('iframe'));
        document.body.tabIndex = -1;
        document.body.focus();
        claimTokenSelectionFocus(frame);

        expect(restoreClaimedTokenSelectionFocus(frame)).toBe(true);
        expect(restoreClaimedTokenSelectionFocus(frame)).toBe(true);
        expect(document.activeElement).toBe(frame);
        frame.remove();
    });

    it('allows an explicit selection request to take ownership from the video frame', () => {
        const keyBinder = new TestKeyBinder();
        let requestSelection!: (target: TokenSelectionLocation, options?: TokenSelectionRequestOptions) => void;
        act(() => {
            root.render(
                <TestPlayer
                    keyBinder={keyBinder}
                    subtitleData={subtitles}
                    name="subtitles"
                    onMatch={jest.fn()}
                    exposeRequest={(request) => (requestSelection = request)}
                />
            );
        });
        const frame = document.body.appendChild(document.createElement('iframe'));
        claimTokenSelectionFocus(frame);

        act(() => requestSelection({ subtitleIndex: 0, tokenStart: 0 }));
        expect(container.querySelector('.asb-token-selected')).toBeNull();

        act(() => requestSelection({ subtitleIndex: 0, tokenStart: 0 }, { claimOwner: true }));
        expect(container.querySelector('.asb-token-selected')).not.toBeNull();
        frame.remove();
    });

    it('cancels a superseded token-selection retry', () => {
        let nextAnimationFrame = 1;
        jest.mocked(window.requestAnimationFrame).mockImplementation(() => nextAnimationFrame++);
        const cancelAnimationFrame = jest.spyOn(window, 'cancelAnimationFrame');
        let requestSelection!: (target: TokenSelectionLocation) => void;
        act(() => {
            root.render(
                <TestPlayer
                    keyBinder={new TestKeyBinder()}
                    subtitleData={subtitles}
                    name="subtitles"
                    onMatch={jest.fn()}
                    exposeRequest={(request) => (requestSelection = request)}
                />
            );
        });

        act(() => {
            requestSelection({ subtitleIndex: 0, tokenStart: 0 });
            requestSelection({ subtitleIndex: 0, tokenStart: 0 });
        });

        expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    });
});
