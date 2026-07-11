export const debounced = (callback: () => void, delayMs: number) => {
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
