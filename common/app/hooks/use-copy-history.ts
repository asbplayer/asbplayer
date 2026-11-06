import { useEffect, useCallback, useRef, useState } from 'react';
import type { CopyHistoryItem } from '@project/common';
import type { CopyHistoryRepository } from '@project/common/copy-history';

export const useCopyHistory = (miningHistoryStorageLimit: number, copyHistoryRepository: CopyHistoryRepository) => {
    const [copyHistoryItems, setCopyHistoryItems] = useState<CopyHistoryItem[]>([]);
    const removalVersion = useRef(0);
    const updateCopyHistoryItems = useCallback((items: CopyHistoryItem[]) => {
        setCopyHistoryItems((existing: CopyHistoryItem[]) => {
            const newItems = [...existing];

            for (const item of items) {
                if (existing.find((i) => i.id === item.id) === undefined) {
                    newItems.push(item);
                }
            }

            return newItems;
        });
    }, []);

    const refreshCopyHistory = useCallback(async () => {
        const version = removalVersion.current;
        const items = await copyHistoryRepository.fetch(miningHistoryStorageLimit);
        if (version === removalVersion.current) updateCopyHistoryItems(items);
    }, [miningHistoryStorageLimit, updateCopyHistoryItems, copyHistoryRepository]);

    const rememberCopyHistoryItem = useCallback(
        (item: CopyHistoryItem) => updateCopyHistoryItems([item]),
        [updateCopyHistoryItems]
    );

    useEffect(() => {
        return copyHistoryRepository.liveFetch(miningHistoryStorageLimit, updateCopyHistoryItems);
    }, [copyHistoryRepository, miningHistoryStorageLimit, updateCopyHistoryItems]);

    const removeCopyHistoryItems = useCallback((ids?: readonly string[]) => {
        if (ids?.length === 0) return;
        ++removalVersion.current;
        const removed = ids === undefined ? undefined : new Set(ids);
        setCopyHistoryItems((items) => (removed ? items.filter((item) => !removed.has(item.id)) : []));
    }, []);

    const deleteCopyHistoryItem = useCallback(
        async (item: CopyHistoryItem) => {
            await copyHistoryRepository.delete(item.id);
            removeCopyHistoryItems([item.id]);
        },
        [copyHistoryRepository, removeCopyHistoryItems]
    );

    const saveCopyHistoryItem = useCallback(
        async (item: CopyHistoryItem) => {
            setCopyHistoryItems((items) => [...items, item]);
            await copyHistoryRepository.save(item);
        },
        [copyHistoryRepository]
    );

    const deleteAllCopyHistoryItems = useCallback(async () => {
        await copyHistoryRepository.clear();
        removeCopyHistoryItems();
    }, [copyHistoryRepository, removeCopyHistoryItems]);

    return {
        copyHistoryItems,
        rememberCopyHistoryItem,
        removeCopyHistoryItems,
        refreshCopyHistory,
        deleteCopyHistoryItem,
        deleteAllCopyHistoryItems,
        saveCopyHistoryItem,
    };
};
