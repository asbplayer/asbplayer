import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PlayMode } from '@project/common';
import PlaybackModeSelector from '@project/common/components/PlaybackModeSelector';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type MockSelectorProps = {
    open: boolean;
    selectedPlayModes: Set<PlayMode>;
    slotProps?: {
        paper?: {
            onMouseEnter?: () => void;
            onMouseLeave?: () => void;
        };
    };
};

jest.mock('@project/common/components/PlayModeSelector', () => {
    return {
        __esModule: true,
        default: ({ open, selectedPlayModes, slotProps }: MockSelectorProps) =>
            open
                ? React.createElement('div', {
                      'data-testid': 'playback-mode-selector',
                      'data-selected-play-modes': [...selectedPlayModes].join(','),
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
        keepManualSelectorOpen,
        selectedPlayModes = new Set([PlayMode.normal]),
    }: {
        keepManualSelectorOpen?: boolean;
        selectedPlayModes?: Set<PlayMode>;
    } = {}) => {
        act(() => {
            root.render(
                <PlaybackModeSelector
                    selectedPlayModes={selectedPlayModes}
                    onPlayMode={() => {}}
                    keepManualSelectorOpen={keepManualSelectorOpen}
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
    };

    const selector = () => document.querySelector('[data-testid="playback-mode-selector"]');

    const dispatchMouseEvent = (type: 'mouseover' | 'mouseout') => {
        act(() => {
            selector()?.dispatchEvent(new MouseEvent(type, { bubbles: true }));
        });
    };

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

    it('keeps a manually opened selector open when manual auto-hide is disabled', () => {
        renderSelector({ keepManualSelectorOpen: true });

        act(() => {
            document.querySelector('button')?.click();
        });
        dispatchMouseEvent('mouseover');
        dispatchMouseEvent('mouseout');

        act(() => jest.advanceTimersByTime(3001));
        expect(selector()).not.toBeNull();
    });
});
