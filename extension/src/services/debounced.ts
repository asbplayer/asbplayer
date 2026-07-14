export const debounced = (callback: () => void, delayMs: number) => {
    if (delayMs <= 0) {
        return callback;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;

    return () => {
        if (timeout !== undefined) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            callback();
            timeout = undefined;
        }, delayMs);
    };
};
