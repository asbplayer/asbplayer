import { useCallback, useEffect, useState } from 'react';

/** Requires a second press within the timeout before running an action. Defaults to three seconds. */
export default function useConfirmation(onConfirm: () => void, timeoutMs = 3_000) {
    const [confirming, setConfirming] = useState(false);

    const reset = useCallback(() => setConfirming(false), []);

    useEffect(() => {
        if (!confirming) return;
        const timeout = setTimeout(reset, timeoutMs);
        return () => clearTimeout(timeout);
    }, [confirming, reset, timeoutMs]);

    const confirm = useCallback(() => {
        if (confirming) {
            reset();
            onConfirm();
        } else {
            setConfirming(true);
        }
    }, [confirming, onConfirm, reset]);

    return { confirming, confirm, reset };
}
