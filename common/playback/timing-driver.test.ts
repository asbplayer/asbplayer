import { describe, expect, it } from '@jest/globals';
import { emptyTimingDriverCallbacks } from '@project/common/playback/playback-engine-test-utils';
import TimingUpdateQueue from '@project/common/playback/timing-driver';

const flush = async () => {
    for (let i = 0; i < 10; ++i) await Promise.resolve();
};

const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

describe('TimingUpdateQueue', () => {
    it('ignores updates while inactive and forwards timestamps while active', async () => {
        let active = false;
        const updates: number[] = [];
        const queue = new TimingUpdateQueue(
            {
                ...emptyTimingDriverCallbacks,
                onTime: async (timestampMs) => {
                    updates.push(timestampMs);
                },
            },
            () => active
        );

        queue.enqueue(1);
        active = true;
        queue.enqueue(2);
        await flush();

        expect(updates).toEqual([2]);
    });

    it('serializes async updates and coalesces queued values to the latest timestamp', async () => {
        const firstUpdate = deferred();
        const updates: number[] = [];
        let activeUpdates = 0;
        let maximumActiveUpdates = 0;
        const queue = new TimingUpdateQueue(
            {
                ...emptyTimingDriverCallbacks,
                onTime: async (timestampMs) => {
                    activeUpdates++;
                    maximumActiveUpdates = Math.max(maximumActiveUpdates, activeUpdates);
                    updates.push(timestampMs);
                    if (updates.length === 1) await firstUpdate.promise;
                    activeUpdates--;
                },
            },
            () => true
        );

        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueue(3);
        expect(updates).toEqual([1]);

        firstUpdate.resolve();
        await flush();

        expect(updates).toEqual([1, 3]);
        expect(maximumActiveUpdates).toBe(1);
    });

    it('clears a queued update without interrupting the active update', async () => {
        const firstUpdate = deferred();
        const updates: number[] = [];
        const queue = new TimingUpdateQueue(
            {
                ...emptyTimingDriverCallbacks,
                onTime: async (timestampMs) => {
                    updates.push(timestampMs);
                    if (updates.length === 1) await firstUpdate.promise;
                },
            },
            () => true
        );

        queue.enqueue(1);
        queue.enqueue(2);
        queue.clear();
        firstUpdate.resolve();
        await flush();

        expect(updates).toEqual([1]);
    });

    it('serializes discontinuities after the active update and before the next update', async () => {
        const firstUpdate = deferred();
        const events: string[] = [];
        const queue = new TimingUpdateQueue(
            {
                ...emptyTimingDriverCallbacks,
                onTime: async (timestampMs) => {
                    events.push(`start:${timestampMs}`);
                    if (timestampMs === 1) {
                        await firstUpdate.promise;
                        events.push('finish:1');
                    }
                },
                onDiscontinuity: (timestampMs) => events.push(`discontinuity:${timestampMs}`),
            },
            () => true
        );

        queue.enqueue(1);
        queue.enqueue(2);
        queue.enqueueDiscontinuity(500);
        queue.enqueue(3);

        expect(events).toEqual(['start:1']);
        firstUpdate.resolve();
        await flush();

        expect(events).toEqual(['start:1', 'finish:1', 'discontinuity:500', 'start:3']);
    });

    it('reports an update error and continues with the latest queued update', async () => {
        const firstUpdate = deferred();
        const error = new Error('update failed');
        const errors: unknown[] = [];
        const updates: number[] = [];
        const queue = new TimingUpdateQueue(
            {
                ...emptyTimingDriverCallbacks,
                onTime: async (timestampMs) => {
                    updates.push(timestampMs);
                    if (updates.length === 1) await firstUpdate.promise;
                },
                onError: (caught) => errors.push(caught),
            },
            () => true
        );

        queue.enqueue(1);
        queue.enqueue(2);
        firstUpdate.reject(error);
        await flush();

        expect(errors).toEqual([error]);
        expect(updates).toEqual([1, 2]);
    });
});
