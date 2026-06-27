import React, { useCallback, useEffect, useRef, useState } from 'react';
import { makeStyles } from '@mui/styles';
import { type Theme } from '@mui/material/styles';
import { useOverlayBounds } from '../hooks/use-overlay-bounds';

// Resizable, draggable blur mask that stays within its container and auto-hides its handles when idle

const HANDLE_SIZE = 12;
const MIN_WIDTH = 60;
const MIN_HEIGHT = 30;

const useStyles = makeStyles<Theme>(() => ({
    overlay: {
        position: 'absolute',
        zIndex: 5,
        boxSizing: 'border-box',
        backgroundColor: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '2px dashed rgba(255,255,255,0.35)',
        borderRadius: 4,
        cursor: 'move',
        userSelect: 'none',
        touchAction: 'none',
    },
    handle: {
        position: 'absolute',
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        background: 'rgba(255,255,255,0.7)',
        borderRadius: 2,
        zIndex: 3,
    },
}));

interface Position {
    x: number;
    y: number;
}

interface Size {
    width: number;
    height: number;
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const resizeHandles: { dir: ResizeDir; style: React.CSSProperties }[] = [
    { dir: 'nw', style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: 'nw-resize' } },
    { dir: 'n', style: { top: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' } },
    { dir: 'ne', style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: 'ne-resize' } },
    { dir: 'e', style: { top: '50%', right: -HANDLE_SIZE / 2, transform: 'translateY(-50%)', cursor: 'e-resize' } },
    { dir: 'se', style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: 'se-resize' } },
    { dir: 's', style: { bottom: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' } },
    { dir: 'sw', style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: 'sw-resize' } },
    { dir: 'w', style: { top: '50%', left: -HANDLE_SIZE / 2, transform: 'translateY(-50%)', cursor: 'w-resize' } },
];

interface BlurOverlayProps {
    anchorRef: React.RefObject<HTMLElement | null | undefined>;
    containerRef: React.RefObject<HTMLElement | null | undefined>;
}

export default function BlurOverlay({ anchorRef, containerRef }: BlurOverlayProps) {
    const classes = useStyles();
    const overlayRef = useRef<HTMLDivElement | null>(null);

    // Position/size of the overlay within the container
    const [pos, setPos] = useState<Position>({ x: 50, y: 300 });
    const [size, setSize] = useState<Size>({ width: 400, height: 80 });
    const [showHandles, setShowHandles] = useState<boolean>(true);

    // Mutable refs used during drag/resize so we don't re-render on every mousemove
    const isDraggingRef = useRef(false);
    const activeResizeDirRef = useRef<ResizeDir | null>(null);
    const dragStart = useRef<Position>({ x: 0, y: 0 });
    const posStart = useRef<Position>({ x: 0, y: 0 });
    const sizeStart = useRef<Size>({ width: 0, height: 0 });
    const autoHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { bounds, boundsRef, containerBounds, clampPos, clampSizeToBounds } = useOverlayBounds({
        anchorRef,
        containerRef,
        pos,
        size,
        setPos,
        setSize,
        minWidth: MIN_WIDTH,
        minHeight: MIN_HEIGHT,
    });

    // Show handles immediately, then hide them if idle for 2 seconds
    const resetAutoHideTimer = useCallback(() => {
        setShowHandles(true);
        if (autoHideTimeoutRef.current) {
            clearTimeout(autoHideTimeoutRef.current);
        }
        // Only set auto-hide timer if not currently dragging or resizing
        if (!isDraggingRef.current && !activeResizeDirRef.current) {
            autoHideTimeoutRef.current = setTimeout(() => {
                // Hide handles and border after 2 seconds of inactivity
                if (!isDraggingRef.current && !activeResizeDirRef.current) {
                    setShowHandles(false);
                }
            }, 2000);
        }
    }, []);

    // Begin drag: remember start positions for delta calculations
    const onMouseDownDrag = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            isDraggingRef.current = true;
            dragStart.current = { x: e.clientX, y: e.clientY };
            posStart.current = { ...pos };
            resetAutoHideTimer();
        },
        [pos, resetAutoHideTimer]
    );

    // Begin resize: store starting box and which edge/corner is active
    const onMouseDownResize = useCallback(
        (dir: ResizeDir) => (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            activeResizeDirRef.current = dir;
            dragStart.current = { x: e.clientX, y: e.clientY };
            posStart.current = { ...pos };
            sizeStart.current = { ...size };
            resetAutoHideTimer();
        },
        [pos, size, resetAutoHideTimer]
    );

    useEffect(() => {
        // Start auto-hide timer and wire global listeners for drag/resize
        resetAutoHideTimer();

        const onMouseMove = (e: MouseEvent) => {
            const activeBounds = boundsRef.current ?? containerBounds();
            const clientX = activeBounds
                ? Math.min(
                      Math.max(e.clientX, activeBounds.viewportLeft),
                      activeBounds.viewportLeft + activeBounds.width
                  )
                : e.clientX;
            const clientY = activeBounds
                ? Math.min(
                      Math.max(e.clientY, activeBounds.viewportTop),
                      activeBounds.viewportTop + activeBounds.height
                  )
                : e.clientY;
            const dx = clientX - dragStart.current.x;
            const dy = clientY - dragStart.current.y;

            if (isDraggingRef.current) {
                const nx = posStart.current.x + dx;
                const ny = posStart.current.y + dy;
                setPos(clampPos(nx, ny, size.width, size.height));
                return;
            }

            if (activeResizeDirRef.current) {
                const dir = activeResizeDirRef.current;
                let nx = posStart.current.x;
                let ny = posStart.current.y;
                let nw = sizeStart.current.width;
                let nh = sizeStart.current.height;

                // Grow/shrink based on active edges; enforce minimums
                if (dir.includes('e')) nw = Math.max(MIN_WIDTH, sizeStart.current.width + dx);
                if (dir.includes('s')) nh = Math.max(MIN_HEIGHT, sizeStart.current.height + dy);
                if (dir.includes('w')) {
                    nw = Math.max(MIN_WIDTH, sizeStart.current.width - dx);
                    nx = posStart.current.x + sizeStart.current.width - nw;
                }
                if (dir.includes('n')) {
                    nh = Math.max(MIN_HEIGHT, sizeStart.current.height - dy);
                    ny = posStart.current.y + sizeStart.current.height - nh;
                }

                const clampedSize = clampSizeToBounds({ width: nw, height: nh }, activeBounds ?? undefined);
                const clampedPos = clampPos(nx, ny, clampedSize.width, clampedSize.height);
                setPos(clampedPos);
                setSize(clampedSize);
            }
        };

        const onMouseUp = () => {
            const wasDragging = isDraggingRef.current;
            const wasResizing = activeResizeDirRef.current;
            isDraggingRef.current = false;
            activeResizeDirRef.current = null;

            // Restart auto-hide timer if we just finished dragging or resizing
            if (wasDragging || wasResizing) {
                resetAutoHideTimer();
            }
        };

        const onGlobalClick = (e: MouseEvent) => {
            // Hide handles if clicking outside the overlay
            const target = e.target as Element;
            const overlayElement = overlayRef.current;
            if (overlayElement && !overlayElement.contains(target)) {
                setShowHandles(false);
                if (autoHideTimeoutRef.current) {
                    clearTimeout(autoHideTimeoutRef.current);
                }
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('click', onGlobalClick);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('click', onGlobalClick);
            if (autoHideTimeoutRef.current) {
                clearTimeout(autoHideTimeoutRef.current);
            }
        };
    }, [clampPos, clampSizeToBounds, size, resetAutoHideTimer, containerBounds, boundsRef]);

    // Clicking the overlay restores handles if they were hidden
    const handleMouseClick = useCallback(() => {
        setShowHandles(true);
        resetAutoHideTimer();
    }, [resetAutoHideTimer]);

    return (
        <div
            ref={overlayRef}
            className={classes.overlay}
            style={{
                left: (bounds?.left ?? 0) + pos.x,
                top: (bounds?.top ?? 0) + pos.y,
                width: size.width,
                height: size.height,
                border: showHandles ? '2px dashed rgba(255,255,255,0.35)' : 'none',
                cursor: showHandles ? 'move' : 'default',
            }}
            onMouseDown={onMouseDownDrag}
            onClick={handleMouseClick}
        >
            {showHandles &&
                resizeHandles.map(({ dir, style }) => {
                    // Calculate handle dimensions based on overlay size
                    const handleWidth = dir === 'n' || dir === 's' ? Math.min(size.width * 0.5, 120) : HANDLE_SIZE;
                    const handleHeight = dir === 'e' || dir === 'w' ? Math.min(size.height * 0.5, 120) : HANDLE_SIZE;

                    return (
                        <div
                            key={dir}
                            className={classes.handle}
                            style={{
                                ...style,
                                width: handleWidth,
                                height: handleHeight,
                            }}
                            onMouseDown={onMouseDownResize(dir)}
                        />
                    );
                })}
        </div>
    );
}
