import { useCallback, useEffect, useRef, useState } from 'react';

const snackbarDisplayTimeMs = 6_000;
const snackbarUnhoveredDisplayTimeMs = 1_000;

export interface UseSnackbarOptions {
    readonly open: boolean;
    readonly onClose: () => void;
    /** Override automatic dismissal without changing the close button's behavior. */
    readonly onTimeout?: () => void;
    /** Reopen and restart the display period when the prompt becomes useful again. */
    readonly refreshKey?: unknown;
}

export interface SnackbarControls {
    readonly open: boolean;
    readonly close: () => void;
    readonly onMouseEnter: () => void;
    readonly onMouseLeave: () => void;
}

export default function useSnackbar({
    open: requestedOpen,
    onClose,
    onTimeout = onClose,
    refreshKey,
}: UseSnackbarOptions): SnackbarControls {
    const [open, setOpen] = useState(requestedOpen);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const onTimeoutRef = useRef(onTimeout);
    onTimeoutRef.current = onTimeout;
    const hoveredRef = useRef(false);

    const clearTimeoutRef = useCallback(() => {
        if (timeoutRef.current === undefined) return;
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
    }, []);

    const close = useCallback(() => {
        clearTimeoutRef();
        setOpen(false);
        onCloseRef.current();
    }, [clearTimeoutRef]);

    const scheduleClose = useCallback(
        (durationMs: number) => {
            clearTimeoutRef();
            timeoutRef.current = setTimeout(() => {
                timeoutRef.current = undefined;
                setOpen(false);
                onTimeoutRef.current();
            }, durationMs);
        },
        [clearTimeoutRef]
    );

    const onMouseEnter = useCallback(() => {
        hoveredRef.current = true;
        clearTimeoutRef();
    }, [clearTimeoutRef]);

    const onMouseLeave = useCallback(() => {
        hoveredRef.current = false;
        if (open) scheduleClose(snackbarUnhoveredDisplayTimeMs);
    }, [open, scheduleClose]);

    useEffect(() => {
        if (!requestedOpen) {
            clearTimeoutRef();
            setOpen(false);
            hoveredRef.current = false;
            return;
        }

        setOpen(true);
        clearTimeoutRef();
        if (!hoveredRef.current) scheduleClose(snackbarDisplayTimeMs);
    }, [clearTimeoutRef, requestedOpen, refreshKey, scheduleClose]);

    useEffect(() => clearTimeoutRef, [clearTimeoutRef]);

    return { open, close, onMouseEnter, onMouseLeave };
}
