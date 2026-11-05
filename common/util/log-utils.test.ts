import { expect, it } from '@jest/globals';
import {
    formatConsoleLogLine,
    formatLogLine,
    formatRedactedLogText,
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

it('formats lines and redacts each custom app URL occurrence from messages', () => {
    const streamingAppUrl = 'https://private.example/asbplayer/';
    const lines: LogLine[] = [
        {
            ...validLine,
            msg: `Loading ${streamingAppUrl}extension.json and retrying ${streamingAppUrl}`,
        },
        { ...validLine, timestamp: validLine.timestamp + 1, msg: 'No app URL in this line' },
    ];

    expect(formatRedactedLogText(lines, streamingAppUrl, 'https://app.asbplayer.dev/')).toBe(
        '2026-01-01 13:02:03.123 info: [playback] ' +
            'Loading [REDACTED_APP_URL]/extension.json and retrying [REDACTED_APP_URL]/\n' +
            '2026-01-01 13:02:03.124 info: [playback] No app URL in this line'
    );
    expect(lines[0].msg).toBe(`Loading ${streamingAppUrl}extension.json and retrying ${streamingAppUrl}`);
});

it.each([
    ['https://PRIVATE.example/asbplayer', 'https://private.example/asbplayer'],
    ['HTTPS://private.example:443/asbplayer', 'https://private.example/asbplayer'],
    ['https://private.example/My App', 'https://private.example/My%20App'],
])('redacts literal and browser-normalized occurrences of %s', (streamingAppUrl, normalizedAppUrl) => {
    const lines: LogLine[] = [
        {
            ...validLine,
            msg: `Loading ${streamingAppUrl}; stack at ${normalizedAppUrl}/assets/app.js:10:3; retry ${normalizedAppUrl}`,
        },
    ];

    expect(formatRedactedLogText(lines, streamingAppUrl, 'https://default.example')).toBe(
        '2026-01-01 13:02:03.123 info: [playback] Loading [REDACTED_APP_URL]; ' +
            'stack at [REDACTED_APP_URL]/assets/app.js:10:3; retry [REDACTED_APP_URL]'
    );
});

it('preserves path case when redacting the origin of a different path', () => {
    const lines: LogLine[] = [
        {
            ...validLine,
            msg: 'Loading https://private.example/MyApp and https://private.example/myapp',
        },
    ];

    expect(formatRedactedLogText(lines, 'https://PRIVATE.example/MyApp', 'https://default.example')).toBe(
        '2026-01-01 13:02:03.123 info: [playback] Loading [REDACTED_APP_URL] and [REDACTED_APP_URL]/myapp'
    );
});

it('redacts full app URLs before remaining origins while preserving other paths and filenames', () => {
    const lines: LogLine[] = [
        {
            ...validLine,
            msg:
                'App https://private.example/asbplayer; script https://private.example/assets/app.js:10:3; ' +
                'origin https://private.example; retry https://private.example/assets/app.js; other https://other.example',
        },
    ];

    expect(formatRedactedLogText(lines, 'https://private.example/asbplayer', 'https://default.example')).toBe(
        '2026-01-01 13:02:03.123 info: [playback] App [REDACTED_APP_URL]; ' +
            'script [REDACTED_APP_URL]/assets/app.js:10:3; origin [REDACTED_APP_URL]; ' +
            'retry [REDACTED_APP_URL]/assets/app.js; other https://other.example'
    );
});

it('does not treat an opaque URL origin as the literal text null', () => {
    const lines: LogLine[] = [{ ...validLine, msg: 'App about:blank returned null' }];

    expect(formatRedactedLogText(lines, 'about:blank', 'https://default.example')).toBe(
        '2026-01-01 13:02:03.123 info: [playback] App [REDACTED_APP_URL] returned null'
    );
});

it.each(['app', 'https://[private]/app'])('leaves logs unchanged for an invalid app URL: %s', (streamingAppUrl) => {
    const lines: LogLine[] = [{ ...validLine, msg: `Loading ${streamingAppUrl}/extension.json` }];

    expect(formatRedactedLogText(lines, streamingAppUrl, 'https://default.example')).toBe(formatLogLine(lines[0]));
});

it('does not redact when trailing-slash normalization makes the URLs exactly equal', () => {
    const defaultStreamingAppUrl = 'https://app.asbplayer.dev/';
    const streamingAppUrl = 'https://app.asbplayer.dev///';
    const lines: LogLine[] = [{ ...validLine, msg: `Loading ${defaultStreamingAppUrl}extension.json` }];

    expect(formatRedactedLogText(lines, streamingAppUrl, defaultStreamingAppUrl)).toBe(formatLogLine(lines[0]));
});

it.each([
    ['https://app.asbplayer.dev/custom/', 'https://app.asbplayer.dev/'],
    ['https://public.example/custom/', 'https://public.example/base/'],
    ['HTTPS://PUBLIC.example:443/custom/', 'https://public.example/'],
])('does not redact custom paths on the default app origin: %s', (streamingAppUrl, defaultStreamingAppUrl) => {
    const lines: LogLine[] = [{ ...validLine, msg: `Loading ${streamingAppUrl}extension.json` }];

    expect(formatRedactedLogText(lines, streamingAppUrl, defaultStreamingAppUrl)).toBe(formatLogLine(lines[0]));
});

it('redacts a different origin even when its hostname starts with the default hostname', () => {
    const defaultStreamingAppUrl = 'https://public.example/';
    const streamingAppUrl = 'https://public.example.private.example/custom/';
    const lines: LogLine[] = [{ ...validLine, msg: `Loading ${streamingAppUrl}extension.json` }];

    expect(formatRedactedLogText(lines, streamingAppUrl, defaultStreamingAppUrl)).toBe(
        '2026-01-01 13:02:03.123 info: [playback] Loading [REDACTED_APP_URL]/extension.json'
    );
});

it('does not redact when the configured URL has no non-slash characters', () => {
    const lines: LogLine[] = [{ ...validLine, msg: 'plain message' }];

    expect(formatRedactedLogText(lines, '///', 'https://app.asbplayer.dev')).toBe(formatLogLine(lines[0]));
    expect(formatRedactedLogText([], 'https://private.example/asbplayer', 'https://app.asbplayer.dev')).toBe('');
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
