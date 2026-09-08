import { useCallback, useEffect, useRef, useState } from 'react';

const snackbarDisplayTimeMs = 6_000;
const snackbarUnhoveredDisplayTimeMs = 1_000;

export interface UseSnackbarOptions {
    readonly open: boolean;
    readonly onClose: () => void;
}

export interface SnackbarControls {
    readonly open: boolean;
    readonly close: () => void;
    readonly onMouseEnter: () => void;
    readonly onMouseLeave: () => void;
}

export default function useSnackbar({ open: requestedOpen, onClose }: UseSnackbarOptions): SnackbarControls {
    const [open, setOpen] = useState(requestedOpen);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

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
            timeoutRef.current = setTimeout(close, durationMs);
        },
        [clearTimeoutRef, close]
    );

    const onMouseEnter = useCallback(() => clearTimeoutRef(), [clearTimeoutRef]);

    const onMouseLeave = useCallback(() => {
        if (open) scheduleClose(snackbarUnhoveredDisplayTimeMs);
    }, [open, scheduleClose]);

    useEffect(() => {
        if (!requestedOpen) {
            clearTimeoutRef();
            setOpen(false);
            return;
        }

        setOpen(true);
        scheduleClose(snackbarDisplayTimeMs);
    }, [clearTimeoutRef, requestedOpen, scheduleClose]);

    useEffect(() => clearTimeoutRef, [clearTimeoutRef]);

    return { open, close, onMouseEnter, onMouseLeave };
}
