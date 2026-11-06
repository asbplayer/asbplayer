import { afterEach, beforeEach, expect, it } from '@jest/globals';
import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Blob as ReadableBlob, resolveObjectURL } from 'node:buffer';
import { URL as NodeURL } from 'node:url';
import type { CardModel, CopyHistoryItem } from '@project/common';
import { AudioClip } from '@project/common/audio-clip';
import { createBlobUrl, isActiveBlobUrl, revokeBlobUrl } from '@project/common/blob-url';
import { useCardAudioSources } from '@project/common/app/hooks/use-card-audio-sources';
import { useCopyHistory } from '@project/common/app/hooks/use-copy-history';
import type { CopyHistoryRepository } from '@project/common/copy-history';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
let container: HTMLDivElement;
let root: Root;
const sources: string[] = [];
const audioBlob = () => new ReadableBlob(['converted audio']) as unknown as Blob;
const cardFor = (): CardModel => {
    const transcodedAudio = AudioClip.createTranscodedAudioSource({
        audio: audioBlob(),
        required: true,
        complete: false,
    })!;
    sources.push(transcodedAudio.blobUrl!);
    return {
        file: { name: 'video.mkv', blobUrl: 'blob:video', transcodedAudio },
        subtitle: { text: '', start: 0, end: 1000, originalStart: 0, originalEnd: 1000, track: 0 },
        surroundingSubtitles: [],
        subtitleFileName: 'video.srt',
        mediaTimestamp: 0,
    };
};
const Harness = ({ cards }: { cards: CardModel[] }) => {
    useCardAudioSources(cards);
    return null;
};
const render = async (cards: CardModel[], strict = false) => {
    await act(async () => {
        root.render(
            strict ? (
                <StrictMode>
                    <Harness cards={cards} />
                </StrictMode>
            ) : (
                <Harness cards={cards} />
            )
        );
    });
};

beforeEach(() => {
    // Use real browser-style Blob URLs; jsdom does not implement this boundary.
    URL.createObjectURL = NodeURL.createObjectURL as typeof URL.createObjectURL;
    URL.revokeObjectURL = NodeURL.revokeObjectURL;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    for (const url of sources.splice(0)) revokeBlobUrl(url);
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
});

it('keeps a source while either history or the dialog needs it and releases it after both discard it', async () => {
    await render([]);
    const card = cardFor();
    const url = card.file!.transcodedAudio!.blobUrl!;
    await render([card, { ...card }]);
    await render([card]);
    expect(isActiveBlobUrl(url)).toBe(true);
    expect(resolveObjectURL(url)).toBeDefined();
    await render([]);
    expect(isActiveBlobUrl(url)).toBe(false);
    expect(resolveObjectURL(url)).toBeUndefined();
});

it('releases replaced sources independently and releases the remaining sources on unmount', async () => {
    const first = cardFor();
    const second = cardFor();
    const firstUrl = first.file!.transcodedAudio!.blobUrl!;
    const secondUrl = second.file!.transcodedAudio!.blobUrl!;
    await render([first, second]);
    await render([second]);
    expect(isActiveBlobUrl(firstUrl)).toBe(false);
    expect(isActiveBlobUrl(secondUrl)).toBe(true);
    await act(async () => root.unmount());
    expect(resolveObjectURL(secondUrl)).toBeUndefined();
});

it('preserves sources through Strict Mode effect remounts', async () => {
    const card = cardFor();
    await render([card], true);
    expect(resolveObjectURL(card.file!.transcodedAudio!.blobUrl!)).toBeDefined();
});

it('leaves original media and sources owned by other documents alone', async () => {
    const video = createBlobUrl(audioBlob());
    const external = URL.createObjectURL(audioBlob());
    sources.push(video, external);
    const card = cardFor();
    card.file = { ...card.file!, blobUrl: video, transcodedAudio: { blobUrl: external, complete: true } };
    await render([card]);
    await render([]);
    expect(isActiveBlobUrl(video)).toBe(true);
    expect(resolveObjectURL(external)).toBeDefined();
});

it('releases deleted and cleared history sources while preserving the open dialog', async () => {
    const saved = new Map<string, CopyHistoryItem>();
    const repository: CopyHistoryRepository = {
        fetch: async () => [...saved.values()],
        liveFetch: () => () => {},
        save: async (item) => {
            saved.set(item.id, item);
        },
        delete: async (id) => {
            saved.delete(id);
        },
        clear: async () => saved.clear(),
    };
    let history!: ReturnType<typeof useCopyHistory>;
    const HistoryHarness = ({ dialog }: { dialog?: CardModel }) => {
        history = useCopyHistory(25, repository);
        useCardAudioSources([...history.copyHistoryItems, ...(dialog ? [dialog] : [])]);
        return null;
    };
    const first = { ...cardFor(), id: 'first', timestamp: 1 };
    const second = { ...cardFor(), id: 'second', timestamp: 2 };
    const firstUrl = first.file!.transcodedAudio!.blobUrl!;
    const secondUrl = second.file!.transcodedAudio!.blobUrl!;
    await act(async () => root.render(<HistoryHarness dialog={first} />));
    await act(async () => {
        await history.saveCopyHistoryItem(first);
        await history.saveCopyHistoryItem(second);
    });
    await act(async () => history.deleteCopyHistoryItem(first));
    expect(resolveObjectURL(firstUrl)).toBeDefined();
    expect(saved.has('first')).toBe(false);
    await act(async () => history.deleteAllCopyHistoryItems());
    expect(resolveObjectURL(secondUrl)).toBeUndefined();
    expect(resolveObjectURL(firstUrl)).toBeDefined();
    await act(async () => root.render(<HistoryHarness />));
    expect(resolveObjectURL(firstUrl)).toBeUndefined();
});

it('replaces live history snapshots and retains open dialogs and exports without accepting stale fetches', async () => {
    const saved = new Map<string, CopyHistoryItem>();
    let publish!: (items: CopyHistoryItem[]) => void;
    let subscribed = false;
    const repository: CopyHistoryRepository = {
        fetch: async () => [...saved.values()],
        liveFetch: (_count, callback) => {
            publish = callback;
            subscribed = true;
            return () => {
                subscribed = false;
            };
        },
        save: async (item) => {
            saved.set(item.id, item);
        },
        delete: async () => {
            throw new Error('Remote removals must not write back');
        },
        clear: async () => {
            throw new Error('Remote removals must not write back');
        },
    };
    const notify = async (ids?: string[]) => {
        if (ids) ids.forEach((id) => saved.delete(id));
        else saved.clear();
        await act(async () => {
            publish([...saved.values()]);
        });
    };
    let history!: ReturnType<typeof useCopyHistory>;
    const RemoteHarness = ({ dialog, exporting }: { dialog?: CardModel; exporting?: CardModel }) => {
        history = useCopyHistory(25, repository);
        useCardAudioSources([
            ...history.copyHistoryItems,
            ...(dialog ? [dialog] : []),
            ...(exporting ? [exporting] : []),
        ]);
        return null;
    };
    const first = { ...cardFor(), id: 'dialog', timestamp: 1 };
    const second = { ...cardFor(), id: 'history', timestamp: 2 };
    const third = { ...cardFor(), id: 'export', timestamp: 3 };
    const urls = [first, second, third].map((card) => card.file!.transcodedAudio!.blobUrl!);
    await act(async () => root.render(<RemoteHarness dialog={first} exporting={third} />));
    await act(async () => {
        for (const card of [first, second, third]) await history.saveCopyHistoryItem(card);
    });
    await notify([]);
    await notify(['unknown']);
    expect(history.copyHistoryItems).toHaveLength(3);
    let finishFetch!: (items: CopyHistoryItem[]) => void;
    repository.fetch = () =>
        new Promise((resolve) => {
            finishFetch = resolve;
        });
    const beforeDeletion = history.copyHistoryItems;
    const refreshingBeforeDeletion = history.refreshCopyHistory();
    await notify([first.id, second.id]);
    await act(async () => {
        finishFetch(beforeDeletion);
        await refreshingBeforeDeletion;
    });
    await notify([first.id, second.id]); // Delivery to multiple app instances can repeat a notification.
    expect(history.copyHistoryItems.map((card) => card.id)).toEqual([third.id]);
    expect(resolveObjectURL(urls[0])).toBeDefined();
    expect(resolveObjectURL(urls[1])).toBeUndefined();
    const beforeClear = history.copyHistoryItems;
    const refreshingBeforeClear = history.refreshCopyHistory();
    await notify();
    await act(async () => {
        finishFetch(beforeClear);
        await refreshingBeforeClear;
    });
    expect(history.copyHistoryItems).toEqual([]);
    expect(resolveObjectURL(urls[2])).toBeDefined();
    expect(saved.size).toBe(0);
    await act(async () => root.render(<RemoteHarness exporting={third} />));
    expect(resolveObjectURL(urls[0])).toBeUndefined();
    await act(async () => root.render(<RemoteHarness />));
    expect(resolveObjectURL(urls[2])).toBeUndefined();
    await act(async () => root.unmount());
    expect(subscribed).toBe(false);
});

it.each(['delete', 'clear'] as const)('preserves history and its source when %s fails', async (operation) => {
    const saved = new Map<string, CopyHistoryItem>();
    const repository: CopyHistoryRepository = {
        fetch: async () => [...saved.values()],
        liveFetch: () => () => {},
        save: async (item) => {
            saved.set(item.id, item);
        },
        delete: async () => {
            throw new Error('Storage failed');
        },
        clear: async () => {
            throw new Error('Storage failed');
        },
    };
    let history!: ReturnType<typeof useCopyHistory>;
    const FailedMutationHarness = () => {
        history = useCopyHistory(25, repository);
        useCardAudioSources(history.copyHistoryItems);
        return null;
    };
    const card = { ...cardFor(), id: 'card', timestamp: 1 };
    await act(async () => root.render(<FailedMutationHarness />));
    await act(async () => history.saveCopyHistoryItem(card));
    await act(async () => {
        await expect(
            operation === 'delete' ? history.deleteCopyHistoryItem(card) : history.deleteAllCopyHistoryItems()
        ).rejects.toThrow('Storage failed');
    });
    expect(history.copyHistoryItems).toEqual([card]);
    expect(resolveObjectURL(card.file!.transcodedAudio!.blobUrl!)).toBeDefined();
});

it.each(['disabled', 'failed'] as const)(
    'releases an unretained snapshot after a fast save with history %s',
    async (mode) => {
        const repository: CopyHistoryRepository = {
            fetch: async () => [],
            liveFetch: () => () => {},
            save: async () => {
                if (mode === 'failed') throw new Error('Save failed');
            },
            delete: async () => {},
            clear: async () => {},
        };
        let history!: ReturnType<typeof useCopyHistory>;
        let retain!: ReturnType<typeof useCardAudioSources>;
        const SavingHarness = () => {
            history = useCopyHistory(0, repository);
            retain = useCardAudioSources([...history.copyHistoryItems, ...history.pendingCopyHistoryItems]);
            return null;
        };
        await act(async () => root.render(<SavingHarness />));
        const card = { ...cardFor(), id: 'card', timestamp: 1 };
        const url = card.file!.transcodedAudio!.blobUrl!;
        await act(async () => {
            retain(card);
            const saving = history.saveCopyHistoryItem(card);
            if (mode === 'failed') await expect(saving).rejects.toThrow('Save failed');
            else await saving;
        });
        expect(history.copyHistoryItems).toEqual([]);
        expect(history.pendingCopyHistoryItems).toEqual([]);
        expect(resolveObjectURL(url)).toBeUndefined();
    }
);

it('keeps a snapshot through a pending save and releases it only after a committed snapshot discards it', async () => {
    let finishSave!: () => void;
    const pendingSave = new Promise<void>((resolve) => {
        finishSave = resolve;
    });
    let finishFetch!: (items: CopyHistoryItem[]) => void;
    const repository: CopyHistoryRepository = {
        fetch: () =>
            new Promise((resolve) => {
                finishFetch = resolve;
            }),
        liveFetch: () => () => {},
        save: () => pendingSave,
        delete: async () => {},
        clear: async () => {},
    };
    let history!: ReturnType<typeof useCopyHistory>;
    let retain!: ReturnType<typeof useCardAudioSources>;
    const SavingHarness = () => {
        history = useCopyHistory(1, repository);
        retain = useCardAudioSources([...history.copyHistoryItems, ...history.pendingCopyHistoryItems]);
        return null;
    };
    await act(async () => root.render(<SavingHarness />));
    const card = { ...cardFor(), id: 'card', timestamp: 1 };
    const url = card.file!.transcodedAudio!.blobUrl!;
    let saving!: Promise<void>;
    await act(async () => {
        retain(card);
        saving = history.saveCopyHistoryItem(card);
    });
    expect(resolveObjectURL(url)).toBeDefined();
    await act(async () => finishSave());
    expect(resolveObjectURL(url)).toBeDefined();

    // A newer explicit fetch supersedes the save's fetch; ownership must survive until it finishes.
    const oldFetch = finishFetch;
    let refreshing!: Promise<void>;
    await act(async () => {
        refreshing = history.refreshCopyHistory();
    });
    await act(async () => {
        oldFetch([card]);
        await saving;
    });
    expect(resolveObjectURL(url)).toBeDefined();
    await act(async () => {
        finishFetch([]);
        await refreshing;
    });
    expect(history.pendingCopyHistoryItems).toEqual([]);
    expect(resolveObjectURL(url)).toBeUndefined();
});
