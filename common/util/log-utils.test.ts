import { expect, it } from '@jest/globals';
import { localizeDateTime } from '@project/common/util/util';
import {
    formatLogLine,
    trimLogLines,
    MAX_NON_TRACE_LOG_COUNT,
    MAX_TRACE_LOG_COUNT,
} from '@project/common/util/log-utils';
import type { LogLine } from '@project/common/util/log-utils';

const validLine: LogLine = {
    timestamp: Date.UTC(2026, 0, 1, 13, 2, 3, 123),
    label: 'playback',
    level: 'info',
    msg: 'ready',
};

it('formats the date, time, severity, prefix, and message', () => {
    expect(formatLogLine(validLine)).toBe(
        `[${localizeDateTime(validLine.timestamp, { hour12: false, includeMilliseconds: true, includeDate: true })}][info] [asbplayer][playback] ready`
    );
    expect(formatLogLine({ ...validLine, label: '', msg: '' })).toBe(
        `[${localizeDateTime(validLine.timestamp, { hour12: false, includeMilliseconds: true, includeDate: true })}][info] [asbplayer]`
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
