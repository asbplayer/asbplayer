export const debounced = <Args extends unknown[]>(callback: (...args: Args) => void, delayMs: number) => {
    if (delayMs <= 0) {
        return callback;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;

    return (...args: Args) => {
        if (timeout !== undefined) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            callback(...args);
            timeout = undefined;
        }, delayMs);
    };
};
