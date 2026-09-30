import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
    asbError,
    asbInfo,
    asbLog,
    asbTrace,
    asbWarn,
    configureLogProvider,
    LogProvider,
    MAX_NON_TRACE_LOG_COUNT,
    MAX_TRACE_LOG_COUNT,
} from '@project/common/util';
import type { LogLine, LogStorage } from '@project/common/util/log';

const createLogStorage = (): LogStorage => {
    const lines: LogLine[] = [];
    return {
        append: async (batch) => {
            lines.push(...batch);
        },
        getLogs: async () => ({ lines: [...lines] }),
    };
};
const createLogProvider = () => new LogProvider(createLogStorage());
const logTimestamp = '2026-09-21 18:00:00.000';

afterEach(() => {
    jest.restoreAllMocks();
});

describe('log provider configuration', () => {
    it('flushes startup logs to the initial provider and does not migrate history on a backend change', async () => {
        const initialProvider = createLogProvider();
        const replacementProvider = createLogProvider();
        asbLog('startup-buffer', 'message');
        await configureLogProvider(initialProvider);

        await expect(initialProvider.getLogText()).resolves.toContain('[startup-buffer] message');

        const previousBackendLine = {
            timestamp: 1,
            label: 'previous-backend',
            level: 'info' as const,
            msg: 'message',
        };
        void initialProvider.append([previousBackendLine]);

        await configureLogProvider(replacementProvider);

        await expect(initialProvider.getLogLines()).resolves.toContainEqual(previousBackendLine);
        await expect(replacementProvider.getLogLines()).resolves.not.toContainEqual(previousBackendLine);
    });

    it('bounds startup logs independently for trace and non-trace logs, keeping the newest of each', async () => {
        await jest.isolateModulesAsync(async () => {
            const log = await import('@project/common/util/log');
            jest.spyOn(console, 'info').mockImplementation(() => undefined);
            for (let i = 0; i <= MAX_TRACE_LOG_COUNT; ++i) log.asbTrace('test', `trace-${i}`);
            for (let i = 0; i <= MAX_NON_TRACE_LOG_COUNT; ++i) log.asbInfo('test', `info-${i}`);

            const appended: LogLine[] = [];
            await log.configureLogProvider(
                new log.LogProvider({
                    append: async (lines) => {
                        appended.push(...lines);
                    },
                    getLogs: async () => ({ lines: appended }),
                })
            );

            const messages = appended.map((line) => line.msg);
            expect(messages).toHaveLength(MAX_TRACE_LOG_COUNT + MAX_NON_TRACE_LOG_COUNT);
            expect(messages[0]).toBe('trace-1');
            expect(messages[MAX_TRACE_LOG_COUNT]).toBe('info-1');
            expect(messages.at(-1)).toBe(`info-${MAX_NON_TRACE_LOG_COUNT}`);
        });
    });
});

describe('asb logging', () => {
    let logProvider: LogProvider;

    beforeEach(async () => {
        logProvider = createLogProvider();
        await configureLogProvider(logProvider);
    });

    it('prepends the label while preserving all message arguments', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const details = { durationMs: 10 };
        const timestamp = new Date(2026, 8, 21, 18, 0, 0, 0).getTime();
        jest.spyOn(Date, 'now').mockReturnValue(timestamp);

        asbLog('playback', 'message', details);

        expect(log).toHaveBeenCalledWith(`${logTimestamp} log: [asbplayer][playback]`, 'message', details);
    });

    it('supports warning logging', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const error = new Error('failed');
        const timestamp = new Date(2026, 8, 21, 18, 0, 0, 0).getTime();
        jest.spyOn(Date, 'now').mockReturnValue(timestamp);

        asbWarn('playback/timing', 'message', error);

        expect(warn).toHaveBeenCalledWith(`${logTimestamp} warning: [asbplayer][playback/timing]`, 'message', error);
    });

    it('preserves informational logging', () => {
        const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
        const timestamp = new Date(2026, 8, 21, 18, 0, 0, 0).getTime();
        jest.spyOn(Date, 'now').mockReturnValue(timestamp);

        asbInfo('media-fragment', 'message');

        expect(info).toHaveBeenCalledWith(`${logTimestamp} info: [asbplayer][media-fragment]`, 'message');
    });

    it('supports error logging', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const error = new Error('failed');
        const timestamp = new Date(2026, 8, 21, 18, 0, 0, 0).getTime();
        jest.spyOn(Date, 'now').mockReturnValue(timestamp);

        asbError('yomitan/mecab', error);

        expect(errorSpy).toHaveBeenCalledWith(`${logTimestamp} error: [asbplayer][yomitan/mecab]`, error);
    });

    it('records normal logs for the viewer and export', async () => {
        asbLog('viewer', 'message', { durationMs: 10 });

        await expect(logProvider.getLogText()).resolves.toContain('[viewer] message {"durationMs":10}');
    });

    it('keeps nested error details in exported logs', async () => {
        asbTrace('error-context', { error: new Error('failed') });

        await expect(logProvider.getLogText()).resolves.toContain('"error":{"name":"Error","message":"failed"');
    });

    it('preserves console logging and later arguments when a value cannot be serialized', async () => {
        const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const value = {
            toJSON: () => {
                throw new Error('cannot serialize');
            },
            toString: () => {
                throw new Error('cannot stringify');
            },
        };

        asbError('error-context', value, 'still recorded');

        expect(error).toHaveBeenCalledWith(
            expect.stringContaining('[asbplayer][error-context]'),
            value,
            'still recorded'
        );
        await expect(logProvider.getLogText()).resolves.toContain('<unserializable> still recorded');
    });

    it('records severity and timestamp for each log level', async () => {
        const timestamp = new Date(2026, 8, 21, 18, 0, 0, 0).getTime();
        jest.spyOn(Date, 'now').mockReturnValue(timestamp);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        jest.spyOn(console, 'info').mockImplementation(() => undefined);
        jest.spyOn(console, 'log').mockImplementation(() => undefined);

        asbTrace('trace', 'message');
        asbError('error', 'message');
        asbWarn('warning', 'message');
        asbInfo('info', 'message');
        asbLog('log', 'message');

        expect((await logProvider.getLogLines()).slice(-5)).toEqual([
            expect.objectContaining({ level: 'trace', timestamp }),
            expect.objectContaining({ level: 'error', timestamp }),
            expect.objectContaining({ level: 'warning', timestamp }),
            expect.objectContaining({ level: 'info', timestamp }),
            expect.objectContaining({ level: 'log', timestamp }),
        ]);
    });

    it('records trace logs without writing them to the console', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const trace = jest.spyOn(console, 'trace').mockImplementation(() => undefined);
        asbTrace('trace', 'details');

        expect(log).not.toHaveBeenCalled();
        expect(trace).not.toHaveBeenCalled();
        await expect(logProvider.getLogText()).resolves.toContain('trace: [trace] details');
    });
});

describe('independent log providers', () => {
    it('keeps provider histories independent', async () => {
        const first = createLogProvider();
        const second = createLogProvider();

        const timestamp = new Date(2026, 8, 21, 18, 0, 0, 0).getTime();
        await first.append([{ timestamp, label: 'test', level: 'info', msg: 'first' }]);

        await expect(first.getLogText()).resolves.toBe(`${logTimestamp} info: [test] first`);
        await expect(second.getLogText()).resolves.toBe('');
    });

    it('includes ISO dates and times without an app prefix in every exported line', async () => {
        const provider = createLogProvider();
        const timestamp = new Date(2026, 8, 21, 18, 1, 2, 3).getTime();

        await provider.append([
            { timestamp, label: 'test', level: 'warning', msg: 'warning' },
            { timestamp: timestamp + 1000, label: 'test', level: 'info', msg: 'next' },
        ]);

        await expect(provider.getLogText()).resolves.toBe(
            '2026-09-21 18:01:02.003 warning: [test] warning\n' + '2026-09-21 18:01:03.003 info: [test] next'
        );
    });
});

describe('provider-backed log storage', () => {
    it('batches a burst of logs and persists logs added during an active write', async () => {
        const batches: LogLine[][] = [];
        let finishFirstWrite!: () => void;
        const firstWrite = new Promise<void>((resolve) => {
            finishFirstWrite = resolve;
        });
        const provider = new LogProvider({
            append: async (lines) => {
                batches.push([...lines]);
                if (batches.length === 1) await firstWrite;
            },
            getLogs: async () => ({ lines: batches.flat() }),
        });
        const first = { timestamp: 1, label: 'test', level: 'info' as const, msg: 'first' };
        const second = { timestamp: 2, label: 'test', level: 'info' as const, msg: 'second' };
        const third = { timestamp: 3, label: 'test', level: 'info' as const, msg: 'third' };

        await provider.append([]);
        const firstWriteResult = provider.append([first]);
        const secondWriteResult = provider.append([second]);
        await Promise.resolve();
        expect(batches).toEqual([[first, second]]);

        const thirdWriteResult = provider.append([third]);
        finishFirstWrite();
        await Promise.all([firstWriteResult, secondWriteResult, thirdWriteResult]);

        expect(batches).toEqual([[first, second], [third]]);
        expect(await provider.getLogLines()).toEqual([first, second, third]);
    });

    it('persists appended lines through its storage', async () => {
        const storage = createLogStorage();
        const provider = new LogProvider(storage);
        const line = { timestamp: 3, label: 'test', level: 'info' as const, msg: 'saved' };

        await provider.append([line]);

        expect(await storage.getLogs()).toEqual({ lines: [line] });
    });

    it('reads updated logs from storage', async () => {
        const storage = createLogStorage();
        const provider = new LogProvider(storage);
        const oldLine = { timestamp: 1, label: 'test', level: 'info' as const, msg: 'old' };

        await storage.append([oldLine]);

        const newLine = { timestamp: 2, label: 'test', level: 'info' as const, msg: 'new' };
        await storage.append([newLine]);

        expect(await provider.getLogLines()).toEqual([oldLine, newLine]);
    });

    it('keeps writing after a failed append without rejecting the caller', async () => {
        const storedLines: LogLine[] = [];
        const failedLine = { timestamp: 1, label: 'test', level: 'error' as const, msg: 'unsaved' };
        const savedLine = { timestamp: 2, label: 'test', level: 'info' as const, msg: 'saved' };
        const provider = new LogProvider({
            append: async (lines) => {
                if (lines.includes(failedLine)) throw new Error('storage unavailable');
                storedLines.push(...lines);
            },
            getLogs: async () => ({ lines: storedLines }),
        });

        await expect(provider.append([failedLine])).resolves.toBeUndefined();
        await provider.append([savedLine]);

        expect(await provider.getLogLines()).toEqual([savedLine]);
    });

    it('propagates log-read failures to the caller', async () => {
        const provider = new LogProvider({
            append: async () => undefined,
            getLogs: async () => {
                throw new Error('storage unavailable');
            },
        });

        await expect(provider.getLogLines()).rejects.toThrow('storage unavailable');
    });
});
