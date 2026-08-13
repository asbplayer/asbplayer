/**
 * Optional metadata for an asb logging call.
 *
 * When supplied as the first or last argument, `asbLogLabel` is removed from
 * the message arguments and appended to the `[asbplayer]` console prefix.
 * The prefixed name avoids colliding with ordinary payload properties such as
 * `label` when these functions are used as console-compatible replacements.
 */
export interface AsbLogOptions {
    /** The subsystem or operation name to include in the console prefix. */
    readonly asbLogLabel?: string;
}

function isAsbLogOptions(value: unknown): value is AsbLogOptions {
    return (
        typeof value === 'object' &&
        value !== null &&
        'asbLogLabel' in value &&
        (typeof value.asbLogLabel === 'string' || value.asbLogLabel === undefined)
    );
}

function splitOptions(args: readonly unknown[]): { asbLogLabel?: string; args: readonly unknown[] } {
    const first = args[0];
    const last = args[args.length - 1];
    if (isAsbLogOptions(first)) return { asbLogLabel: first.asbLogLabel, args: args.slice(1) };
    if (isAsbLogOptions(last)) return { asbLogLabel: last.asbLogLabel, args: args.slice(0, -1) };
    return { args };
}

function writeLog(method: (...args: unknown[]) => void, args: readonly unknown[]): void {
    const { asbLogLabel, args: messageArgs } = splitOptions(args);
    method.apply(console, [asbLogLabel?.length ? `[asbplayer][${asbLogLabel}]` : '[asbplayer]', ...messageArgs]);
}

/**
 * Logs a message using `console.log` with an `[asbplayer]` prefix.
 *
 * Accepts the same variadic arguments as `console.log`. An optional
 * {@link AsbLogOptions} object may be supplied as the first or last argument.
 */
export function asbLog(...args: unknown[]): void {
    writeLog(console.log, args);
}

/**
 * Logs an informational message using `console.info` with an `[asbplayer]` prefix.
 *
 * Accepts the same variadic arguments as `console.info`. An optional
 * {@link AsbLogOptions} object may be supplied as the first or last argument.
 */
export function asbInfo(...args: unknown[]): void {
    writeLog(console.info, args);
}

/**
 * Logs a warning using `console.warn` with an `[asbplayer]` prefix.
 *
 * Accepts the same variadic arguments as `console.warn`. An optional
 * {@link AsbLogOptions} object may be supplied as the first or last argument.
 */
export function asbWarn(...args: unknown[]): void {
    writeLog(console.warn, args);
}

/**
 * Logs an error using `console.error` with an `[asbplayer]` prefix.
 *
 * Accepts the same variadic arguments as `console.error`. An optional
 * {@link AsbLogOptions} object may be supplied as the first or last argument.
 */
export function asbError(...args: unknown[]): void {
    writeLog(console.error, args);
}
