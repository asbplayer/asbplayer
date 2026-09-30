import { expect, it, jest } from '@jest/globals';
import { MAX_NON_TRACE_LOG_COUNT, MAX_TRACE_LOG_COUNT } from '@project/common/util/log-utils';
import type { LogLine } from '@project/common/util/log-utils';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import { SessionLogStorage } from '@project/extension/src/services/session-log-storage';

const line = (level: LogLine['level'], msg: string): LogLine => ({ timestamp: 1, label: 'test', level, msg });

it('keeps concurrent appends in order and reads them from a new store instance', async () => {
    const session = new MockStorageArea();
    const storage = new SessionLogStorage(session);
    const first = line('info', 'first');
    const second = line('warning', 'second');

    const writes = [storage.append([first]), storage.append([second])];
    expect(await storage.getLogs()).toEqual({ lines: [first, second] });
    await Promise.all(writes);

    expect(await new SessionLogStorage(session).getLogs()).toEqual({ lines: [first, second] });
});

it('retains the newest trace and non-trace lines across writes', async () => {
    const storage = new SessionLogStorage(new MockStorageArea());
    const traces = Array.from({ length: MAX_TRACE_LOG_COUNT + 1 }, (_, i) => line('trace', `trace-${i}`));
    const normals = Array.from({ length: MAX_NON_TRACE_LOG_COUNT + 1 }, (_, i) => line('info', `normal-${i}`));

    await storage.append(traces);
    await storage.append(normals);

    const { lines } = await storage.getLogs();
    expect(lines).toHaveLength(MAX_TRACE_LOG_COUNT + MAX_NON_TRACE_LOG_COUNT);
    expect(lines[0].msg).toBe('trace-1');
    expect(lines[MAX_TRACE_LOG_COUNT].msg).toBe('normal-1');
    expect(lines.at(-1)?.msg).toBe(`normal-${MAX_NON_TRACE_LOG_COUNT}`);
});

it('continues writing after a failed session storage write', async () => {
    const session = new MockStorageArea();
    jest.spyOn(session, 'set').mockRejectedValueOnce(new Error('unavailable'));
    const storage = new SessionLogStorage(session);

    await expect(storage.append([line('error', 'failed')])).rejects.toThrow('unavailable');
    await storage.append([line('info', 'saved')]);

    expect((await storage.getLogs()).lines.map((entry) => entry.msg)).toEqual(['saved']);
});
