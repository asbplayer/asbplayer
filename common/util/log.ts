type LogArgs = [firstArg: unknown, ...args: unknown[]];

function writeLog(method: (...args: unknown[]) => void, label: string, ...args: LogArgs): void {
    method.apply(console, [label.length ? `[asbplayer][${label}]` : '[asbplayer]', ...args]);
}

/**
 * Logs a message using `console.log` with an `[asbplayer]` prefix and label.
 */
export function asbLog(label: string, ...args: LogArgs): void {
    writeLog(console.log, label, ...args);
}

/**
 * Logs an info message using `console.info` with an `[asbplayer]` prefix and label.
 */
export function asbInfo(label: string, ...args: LogArgs): void {
    writeLog(console.info, label, ...args);
}

/**
 * Logs a warning using `console.warn` with an `[asbplayer]` prefix and label.
 */
export function asbWarn(label: string, ...args: LogArgs): void {
    writeLog(console.warn, label, ...args);
}

/**
 * Logs an error using `console.error` with an `[asbplayer]` prefix and label.
 */
export function asbError(label: string, ...args: LogArgs): void {
    writeLog(console.error, label, ...args);
}
