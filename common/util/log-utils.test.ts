import { expect, it } from '@jest/globals';
import {
    formatConsoleLogLine,
    formatLogLine,
    trimLogLines,
    MAX_NON_TRACE_LOG_COUNT,
    MAX_TRACE_LOG_COUNT,
} from '@project/common/util/log-utils';
import type { LogLine } from '@project/common/util/log-utils';

const validLine: LogLine = {
    timestamp: new Date(2026, 0, 1, 13, 2, 3, 123).getTime(),
    label: 'playback',
    level: 'info',
    msg: 'ready',
};

it('formats stored lines with a local timestamp and without the console prefix', () => {
    expect(formatLogLine(validLine)).toBe('2026-01-01 13:02:03.123 info: [playback] ready');
    expect(formatLogLine({ ...validLine, label: '', msg: '' })).toBe('2026-01-01 13:02:03.123 info:');
    expect(formatLogLine({ ...validLine, label: '' })).toBe('2026-01-01 13:02:03.123 info: ready');
});

it('adds the app prefix only for console lines', () => {
    expect(formatConsoleLogLine(validLine)).toBe('2026-01-01 13:02:03.123 info: [asbplayer][playback] ready');
    expect(formatConsoleLogLine({ ...validLine, label: '', msg: '' })).toBe(
        '2026-01-01 13:02:03.123 info: [asbplayer]'
    );
});

it('keeps the newest trace and non-trace lines independently in append order', () => {
    const traceLines: LogLine[] = Array.from({ length: MAX_TRACE_LOG_COUNT + 1 }, (_, i) => ({
        ...validLine,
        level: 'trace',
        msg: `trace-${i}`,
    }));
    const normalLines: LogLine[] = Array.from({ length: MAX_NON_TRACE_LOG_COUNT + 1 }, (_, i) => ({
        ...validLine,
        msg: `normal-${i}`,
    }));
    const lines = trimLogLines([...traceLines, ...normalLines]);

    expect(lines).toHaveLength(MAX_TRACE_LOG_COUNT + MAX_NON_TRACE_LOG_COUNT);
    expect(lines[0].msg).toBe('trace-1');
    expect(lines[MAX_TRACE_LOG_COUNT].msg).toBe('normal-1');
    expect(lines.at(-1)?.msg).toBe(`normal-${MAX_NON_TRACE_LOG_COUNT}`);
});
