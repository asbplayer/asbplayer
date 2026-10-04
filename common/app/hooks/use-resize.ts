import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
    initialWidth: () => number;
    minWidth: number;
    maxWidth: number;
    onResizeStart?: () => void;
    onResizeEnd?: (width: number) => void;
}

// https://stackoverflow.com/questions/49469834/recommended-way-to-have-drawer-resizable
export const useResize = ({ initialWidth, minWidth, maxWidth, onResizeStart, onResizeEnd }: Props) => {
    const [isResizing, setIsResizing] = useState(false);
    const [width, setWidth] = useState(initialWidth);
    const [lastMouseDownClientX, setLastMouseDownClientX] = useState<number>(0);
    const widthRef = useRef(width);

    useEffect(() => {
        widthRef.current = width;
    }, [width]);

    const enableResize = useCallback(() => {
        setIsResizing(true);
        onResizeStart?.();
    }, [setIsResizing, onResizeStart]);

    const disableResize = useCallback(() => {
        if (!isResizing) {
            return;
        }

        setIsResizing(false);
        onResizeEnd?.(widthRef.current);
    }, [isResizing, setIsResizing, onResizeEnd]);

    const recordLastMouseDownPosition = useCallback((e: MouseEvent) => {
        setLastMouseDownClientX(e.clientX);
    }, []);

    const recordLastTouchStartPosition = useCallback((e: TouchEvent) => {
        if (e.touches.length === 0) {
            return;
        }

        setLastMouseDownClientX(e.touches[0].clientX);
    }, []);

    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing) {
                const delta = lastMouseDownClientX - e.clientX;
                const newWidth = width + delta;

                setLastMouseDownClientX(e.clientX);

                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    setWidth(newWidth);
                }
            }
        },
        [minWidth, maxWidth, lastMouseDownClientX, width, isResizing]
    );

    const resizeFromTouch = useCallback(
        (e: TouchEvent) => {
            if (e.touches.length === 0) {
                return;
            }

            if (isResizing) {
                const delta = lastMouseDownClientX - e.touches[0].clientX;
                const newWidth = width + delta;

                setLastMouseDownClientX(e.touches[0].clientX);

                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    setWidth(newWidth);
                }
            }
        },
        [minWidth, maxWidth, lastMouseDownClientX, width, isResizing]
    );

    useEffect(() => {
        // Prioritize minWidth even if it's larger than maxWidth
        if (minWidth !== 0 && width < minWidth) {
            setWidth(minWidth);
        } else if (maxWidth !== 0 && width > Math.max(minWidth, maxWidth)) {
            setWidth(maxWidth);
        }
    }, [maxWidth, minWidth, width]);

    useEffect(() => {
        document.addEventListener('mouseleave', disableResize);
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', disableResize);
        document.addEventListener('mousedown', recordLastMouseDownPosition);

        document.addEventListener('touchcancel', disableResize);
        document.addEventListener('touchmove', resizeFromTouch);
        document.addEventListener('touchend', disableResize);
        document.addEventListener('touchstart', recordLastTouchStartPosition);

        return () => {
            document.removeEventListener('mouseleave', disableResize);
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', disableResize);
            document.removeEventListener('mousedown', recordLastMouseDownPosition);

            document.removeEventListener('touchcancel', disableResize);
            document.removeEventListener('touchmove', resizeFromTouch);
            document.removeEventListener('touchend', disableResize);
            document.removeEventListener('touchstart', recordLastTouchStartPosition);
        };
    }, [disableResize, resize, resizeFromTouch, recordLastMouseDownPosition, recordLastTouchStartPosition]);

    return { width, setWidth, enableResize, isResizing };
};
