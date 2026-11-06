import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import type { CopyHistoryItem } from '@project/common';
import type { CopyHistoryRepository } from '@project/common/copy-history';

export const useCopyHistory = (miningHistoryStorageLimit: number, copyHistoryRepository: CopyHistoryRepository) => {
    const [copyHistoryItems, setCopyHistoryItems] = useState<CopyHistoryItem[]>([]);
    const version = useRef(0);
    const scope = useMemo(
        () => ({ copyHistoryRepository, miningHistoryStorageLimit }),
        [copyHistoryRepository, miningHistoryStorageLimit]
    );
    const activeScope = useRef<object | undefined>(undefined);
    const pending = useRef(new Map<symbol, { item: CopyHistoryItem; committed: boolean }>());
    const [pendingCopyHistoryItems, setPendingCopyHistoryItems] = useState<CopyHistoryItem[]>([]);
    const updatePending = useCallback(() => {
        setPendingCopyHistoryItems([...pending.current.values()].map(({ item }) => item));
    }, []);
    const updateCopyHistoryItems = useCallback(
        (items: CopyHistoryItem[]) => {
            ++version.current;
            setCopyHistoryItems(items);
            // A successful snapshot takes over ownership from completed saves, including pruned items.
            for (const [key, save] of pending.current) {
                if (save.committed) pending.current.delete(key);
            }
            updatePending();
        },
        [updatePending]
    );

    const refreshCopyHistory = useCallback(async () => {
        if (activeScope.current !== scope) return;
        const request = ++version.current;
        const items = await copyHistoryRepository.fetch(miningHistoryStorageLimit);
        if (activeScope.current === scope && request === version.current) updateCopyHistoryItems(items);
    }, [miningHistoryStorageLimit, updateCopyHistoryItems, copyHistoryRepository, scope]);

    useEffect(() => {
        let active = true;
        ++version.current;
        activeScope.current = scope;
        const unsubscribe = copyHistoryRepository.liveFetch(miningHistoryStorageLimit, (items) => {
            if (active) updateCopyHistoryItems(items);
        });
        return () => {
            active = false;
            activeScope.current = undefined;
            unsubscribe();
        };
    }, [copyHistoryRepository, miningHistoryStorageLimit, updateCopyHistoryItems, scope]);

    const deleteCopyHistoryItem = useCallback(
        async (item: CopyHistoryItem) => {
            await copyHistoryRepository.delete(item.id);
            await refreshCopyHistory();
        },
        [copyHistoryRepository, refreshCopyHistory]
    );

    const saveCopyHistoryItem = useCallback(
        async (item: CopyHistoryItem) => {
            const key = Symbol();
            const save = { item, committed: false };
            pending.current.set(key, save);
            updatePending();
            try {
                await copyHistoryRepository.save(item);
                save.committed = true;
                await refreshCopyHistory();
            } catch (error) {
                if (!save.committed) {
                    pending.current.delete(key);
                    updatePending();
                }
                throw error;
            }
        },
        [copyHistoryRepository, refreshCopyHistory, updatePending]
    );

    const deleteAllCopyHistoryItems = useCallback(async () => {
        await copyHistoryRepository.clear();
        await refreshCopyHistory();
    }, [copyHistoryRepository, refreshCopyHistory]);

    return {
        copyHistoryItems,
        pendingCopyHistoryItems,
        refreshCopyHistory,
        deleteCopyHistoryItem,
        deleteAllCopyHistoryItems,
        saveCopyHistoryItem,
    };
};
