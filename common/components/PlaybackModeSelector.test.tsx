import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PlayMode } from '@project/common';
import PlaybackModeSelector from './PlaybackModeSelector';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type MockSelectorProps = {
    open: boolean;
    selectedPlayModes: Set<PlayMode>;
    slotProps?: {
        paper?: {
            ref?: React.Ref<HTMLDivElement>;
            onMouseEnter?: () => void;
            onMouseLeave?: () => void;
        };
    };
};

jest.mock('./PlayModeSelector', () => {
    return {
        __esModule: true,
        default: ({ open, selectedPlayModes, slotProps }: MockSelectorProps) =>
            open
                ? React.createElement('div', {
                      'data-testid': 'playback-mode-selector',
                      'data-selected-play-modes': [...selectedPlayModes].join(','),
                      ref: slotProps?.paper?.ref,
                      onMouseEnter: slotProps?.paper?.onMouseEnter,
                      onMouseLeave: slotProps?.paper?.onMouseLeave,
                  })
                : null,
    };
});

describe('PlaybackModeSelector hover behavior', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(HTMLElement.prototype, 'matches').mockReturnValue(false);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    const renderSelector = ({
        temporaryOpenRequest,
        selectedPlayModes = new Set([PlayMode.normal]),
        onSelectorClosed = jest.fn(),
        onSelectorOpened = jest.fn(),
    }: {
        temporaryOpenRequest?: number;
        selectedPlayModes?: Set<PlayMode>;
        onSelectorClosed?: jest.Mock;
        onSelectorOpened?: jest.Mock;
    } = {}) => {
        act(() => {
            root.render(
                <PlaybackModeSelector
                    selectedPlayModes={selectedPlayModes}
                    onPlayMode={() => {}}
                    temporaryOpenRequest={temporaryOpenRequest}
                    onSelectorOpened={onSelectorOpened}
                    onSelectorClosed={onSelectorClosed}
                    renderButton={({ anchorRef, onClick, onMouseEnter, onMouseLeave }) => (
                        <button
                            ref={anchorRef}
                            onClick={onClick}
                            onMouseEnter={onMouseEnter}
                            onMouseLeave={onMouseLeave}
                        >
                            open
                        </button>
                    )}
                />
            );
        });
        return onSelectorClosed;
    };

    const selector = () => document.querySelector('[data-testid="playback-mode-selector"]');

    const dispatchMouseEvent = (type: 'mouseover' | 'mouseout') => {
        act(() => {
            selector()?.dispatchEvent(new MouseEvent(type, { bubbles: true }));
        });
    };

    it('keeps a temporary selector open while hovered and closes one second after leaving', () => {
        const onSelectorClosed = renderSelector({ temporaryOpenRequest: 1 });

        dispatchMouseEvent('mouseover');
        act(() => jest.advanceTimersByTime(3000));
        expect(selector()).not.toBeNull();

        dispatchMouseEvent('mouseout');
        act(() => jest.advanceTimersByTime(999));
        expect(selector()).not.toBeNull();

        act(() => jest.advanceTimersByTime(1));
        expect(selector()).toBeNull();
        expect(onSelectorClosed).toHaveBeenCalledTimes(1);
    });

    it('applies the same hover leave timeout after manual button opening', () => {
        renderSelector();

        act(() => {
            document.querySelector('button')?.click();
        });
        dispatchMouseEvent('mouseover');
        dispatchMouseEvent('mouseout');

        act(() => jest.advanceTimersByTime(999));
        expect(selector()).not.toBeNull();

        act(() => jest.advanceTimersByTime(1));
        expect(selector()).toBeNull();
    });

    it('keeps a selector open when a keybind opens it while the trigger is already hovered', () => {
        renderSelector();
        const button = document.querySelector('button')!;
        jest.spyOn(button, 'matches').mockImplementation((selector) => selector === ':hover');

        renderSelector({ temporaryOpenRequest: 1 });
        act(() => jest.advanceTimersByTime(3000));

        expect(selector()).not.toBeNull();
    });

    it('does not replace a button-opened selector with a temporary request', () => {
        const onSelectorOpened = jest.fn();
        renderSelector({ onSelectorOpened });

        act(() => {
            document.querySelector('button')?.click();
        });
        expect(onSelectorOpened).toHaveBeenCalledTimes(1);

        renderSelector({ temporaryOpenRequest: 1, onSelectorOpened });
        act(() => jest.advanceTimersByTime(3000));

        expect(selector()).not.toBeNull();
        expect(onSelectorOpened).toHaveBeenCalledTimes(1);
    });

    it('resets the temporary selector timeout when the request changes', () => {
        renderSelector({ temporaryOpenRequest: 1 });
        act(() => jest.advanceTimersByTime(2500));

        renderSelector({ temporaryOpenRequest: 2, selectedPlayModes: new Set([PlayMode.repeat]) });
        expect(selector()?.getAttribute('data-selected-play-modes')).toBe(String(PlayMode.repeat));
        act(() => jest.advanceTimersByTime(501));
        expect(selector()).not.toBeNull();

        act(() => jest.advanceTimersByTime(3001));
        expect(selector()).toBeNull();
    });
});
