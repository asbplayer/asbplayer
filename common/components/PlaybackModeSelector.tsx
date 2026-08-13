import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PlayMode } from '@project/common';
import PlayModeSelector from './PlayModeSelector';

const playbackModeOverlayAutoHideDurationMouseLeave = 1000;

type SelectorProps = Omit<
    React.ComponentProps<typeof PlayModeSelector>,
    'anchorEl' | 'onClose' | 'onPlayMode' | 'open' | 'selectedPlayModes' | 'slotProps'
>;

interface PlaybackModeSelectorButtonProps {
    anchorRef: React.RefObject<HTMLButtonElement | null>;
    onClick: React.MouseEventHandler<HTMLButtonElement>;
    onMouseEnter: React.MouseEventHandler<HTMLButtonElement>;
    onMouseLeave: React.MouseEventHandler<HTMLButtonElement>;
}

interface Props {
    selectedPlayModes: Set<PlayMode>;
    onPlayMode: (playMode: PlayMode) => void;
    renderButton: (props: PlaybackModeSelectorButtonProps) => React.ReactNode;
    keepManualSelectorOpen?: boolean;
    onSelectorOpened?: () => void;
    onSelectorClosed?: () => void;
    selectorProps?: SelectorProps;
}

export default function PlaybackModeSelector({
    selectedPlayModes,
    onPlayMode,
    renderButton,
    keepManualSelectorOpen = false,
    onSelectorOpened,
    onSelectorClosed,
    selectorProps,
}: Props) {
    const [open, setOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<HTMLElement>();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const hoveredRef = useRef(false);
    const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const onSelectorClosedRef = useRef(onSelectorClosed);
    onSelectorClosedRef.current = onSelectorClosed;

    const cancelAutoHide = useCallback(() => {
        if (autoHideTimeoutRef.current === undefined) return;

        clearTimeout(autoHideTimeoutRef.current);
        autoHideTimeoutRef.current = undefined;
    }, []);

    const closeSelector = useCallback(() => {
        cancelAutoHide();
        hoveredRef.current = false;
        setOpen(false);
        setAnchorEl(undefined);
        onSelectorClosedRef.current?.();
    }, [cancelAutoHide]);

    const startAutoHide = useCallback(
        (duration: number) => {
            cancelAutoHide();
            if (hoveredRef.current) return;

            autoHideTimeoutRef.current = setTimeout(() => {
                autoHideTimeoutRef.current = undefined;
                closeSelector();
            }, duration);
        },
        [cancelAutoHide, closeSelector]
    );

    const handleMouseEnter = useCallback(() => {
        if (hoveredRef.current) return;

        hoveredRef.current = true;
        cancelAutoHide();
    }, [cancelAutoHide]);

    const handleMouseLeave = useCallback(() => {
        if (!hoveredRef.current) return;

        hoveredRef.current = false;
        if (keepManualSelectorOpen) return;

        startAutoHide(playbackModeOverlayAutoHideDurationMouseLeave);
    }, [keepManualSelectorOpen, startAutoHide]);

    const handleButtonClick = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            cancelAutoHide();
            onSelectorOpened?.();
            setAnchorEl(event.currentTarget);
            setOpen(true);
        },
        [cancelAutoHide, onSelectorOpened]
    );

    useEffect(() => cancelAutoHide, [cancelAutoHide]);

    return (
        <>
            {renderButton({
                anchorRef: buttonRef,
                onClick: handleButtonClick,
                onMouseEnter: handleMouseEnter,
                onMouseLeave: handleMouseLeave,
            })}
            {open && (
                <PlayModeSelector
                    {...selectorProps}
                    disableAutoFocus={true}
                    disableRestoreFocus={true}
                    open={open}
                    anchorEl={anchorEl}
                    onClose={closeSelector}
                    selectedPlayModes={selectedPlayModes}
                    onPlayMode={onPlayMode}
                    slotProps={{
                        paper: {
                            onMouseEnter: handleMouseEnter,
                            onMouseLeave: handleMouseLeave,
                        },
                    }}
                />
            )}
        </>
    );
}
