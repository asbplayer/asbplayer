// 10K total logs ~1.5MB, need to watch for anything else needing session storage
export const MAX_TRACE_LOG_COUNT = 9000;
export const MAX_NON_TRACE_LOG_COUNT = 1000;
export const LOG_LINES_KEY = 'asbplayer-log-lines';

export type LogLevel = 'error' | 'warning' | 'info' | 'log' | 'trace';

export interface LogLine {
    readonly timestamp: number;
    readonly label: string;
    readonly level: LogLevel;
    readonly msg: string;
}

export interface LogSnapshot {
    readonly lines: readonly LogLine[];
}

export interface LogStorage {
    append(lines: readonly LogLine[]): Promise<void>;
    getLogs(): Promise<LogSnapshot>;
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

export function formatConsoleLogLine(logLine: LogLine): string {
    return formatLine(logLine, '[asbplayer]');
}
