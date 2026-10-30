export const MAX_TRACE_LOG_COUNT = 9000;
export const MAX_NON_TRACE_LOG_COUNT = 1000;
export const MAX_LOG_MESSAGE_LENGTH = 8192;
export const LOG_LINES_KEY = 'asbplayer-log-lines';

export type LogLevel = 'error' | 'warning' | 'info' | 'log' | 'trace';

export interface LogLine {
    readonly timestamp: number;
    readonly label: string;
    readonly level: LogLevel;
    readonly msg: string;
}

const REDACTED_APP_URL = '[REDACTED_APP_URL]';

export interface LogSnapshot {
    readonly lines: readonly LogLine[];
}

export interface LogStorage {
    append(lines: readonly LogLine[]): Promise<void>;
    getLogs(): Promise<LogSnapshot>;
}

function trimTrailingSlashes(value: string): string {
    return value.replace(/\/+$/, '');
}

export function trimLogLines(lines: readonly LogLine[]): LogLine[] {
    let traceCount = 0;
    let nonTraceCount = 0;
    return lines
        .slice()
        .reverse()
        .filter((line) =>
            line.level === 'trace' ? ++traceCount <= MAX_TRACE_LOG_COUNT : ++nonTraceCount <= MAX_NON_TRACE_LOG_COUNT
        )
        .reverse();
}

function pad(value: number, width = 2): string {
    return String(value).padStart(width, '0');
}

function formatLine(logLine: LogLine, consolePrefix: string): string {
    const date = new Date(logLine.timestamp);
    const timestamp = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
        date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
    const prefix = consolePrefix + (logLine.label.length ? '[' + logLine.label + ']' : '');
    const msg = logLine.msg.length ? ' ' + logLine.msg : '';
    return timestamp + ' ' + logLine.level + ':' + (prefix.length ? ' ' + prefix : '') + msg;
}

export function formatLogLine(logLine: LogLine): string {
    return formatLine(logLine, '');
}

export function formatRedactedLogText(
    lines: readonly LogLine[],
    streamingAppUrl: string,
    defaultStreamingAppUrl: string
): string {
    const appUrls = new Set<string>();

    try {
        const configuredUrl = new URL(streamingAppUrl);
        if (configuredUrl.origin !== new URL(defaultStreamingAppUrl).origin) {
            appUrls.add(trimTrailingSlashes(streamingAppUrl));
            appUrls.add(trimTrailingSlashes(configuredUrl.href));
            if (configuredUrl.origin !== 'null') appUrls.add(configuredUrl.origin);
        }
    } catch {
        // Leave logs unchanged for invalid URLs.
    }

    return lines
        .map((line) => {
            let msg = line.msg;
            for (const url of appUrls) msg = msg.split(url).join(REDACTED_APP_URL);
            return formatLogLine(msg === line.msg ? line : { ...line, msg });
        })
        .join('\n');
}

export function formatConsoleLogLine(logLine: LogLine): string {
    return formatLine(logLine, '[asbplayer]');
}
