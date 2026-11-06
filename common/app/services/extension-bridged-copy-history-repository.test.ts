import type { CopyHistoryItem, RequestCopyHistoryResponse } from '@project/common';
import type { ExtensionMessage } from '@project/common/app/services/chrome-extension';
import { ExtensionBridgedCopyHistoryRepository } from '@project/common/app/services/extension-bridged-copy-history-repository';

const card = (id: string): CopyHistoryItem => ({
    id,
    timestamp: 1,
    subtitle: { text: id, start: 0, end: 1, originalStart: 0, originalEnd: 1, track: 0 },
    surroundingSubtitles: [],
    subtitleFileName: 'video.srt',
    mediaTimestamp: 0,
});

const harness = () => {
    const listeners = new Set<(message: ExtensionMessage) => void>();
    const requests: { count: number; resolve: (response: RequestCopyHistoryResponse) => void }[] = [];
    // The extension message channel is the asynchronous browser boundary.
    const repository = new ExtensionBridgedCopyHistoryRepository({
        requestCopyHistory: (count) => new Promise((resolve) => requests.push({ count, resolve })),
        clearCopyHistory: async () => {},
        deleteCopyHistory: async () => {},
        saveCopyHistory: async () => {},
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    });
    const snapshots: CopyHistoryItem[][] = [];
    const unsubscribe = repository.liveFetch(2, (items) => snapshots.push(items));
    const finish = async (index: number, items: CopyHistoryItem[]) => {
        requests[index].resolve({ copyHistoryItems: items });
        await Promise.resolve();
        await Promise.resolve();
    };
    const notify = () => {
        for (const listener of listeners) listener({ data: { command: 'copy-history-changed' } });
    };
    return { requests, snapshots, listeners, unsubscribe, finish, notify };
};

it('fetches an initial snapshot and forwards complete snapshots for additions, updates, pruning and clear', async () => {
    const h = harness();
    const first = card('first');
    const second = card('second');
    const updated = { ...second, subtitleFileName: 'updated.srt' };
    for (const [index, items] of [[], [first], [first, second], [updated], []].entries()) {
        if (index > 0) h.notify();
        await h.finish(index, items);
        expect(h.snapshots[index]).toEqual(items);
    }
    expect(h.requests.map(({ count }) => count)).toEqual([2, 2, 2, 2, 2]);
    h.unsubscribe();
});

it('ignores responses superseded by a newer change or an unsubscribe', async () => {
    const h = harness();
    h.notify();
    await h.finish(1, [card('new')]);
    await h.finish(0, [card('stale')]);
    expect(h.snapshots).toEqual([[card('new')]]);
    h.notify();
    h.unsubscribe();
    await h.finish(2, []);
    expect(h.snapshots).toHaveLength(1);
    expect(h.listeners.size).toBe(0);
});
