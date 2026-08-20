import { useEffect, useCallback, useState } from 'react';
import type { CopyHistoryItem } from '@project/common';
import type { CopyHistoryRepository } from '@project/common/copy-history';

export const useCopyHistory = (miningHistoryStorageLimit: number, copyHistoryRepository: CopyHistoryRepository) => {
    const [copyHistoryItems, setCopyHistoryItems] = useState<CopyHistoryItem[]>([]);
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
        updateCopyHistoryItems(await copyHistoryRepository.fetch(miningHistoryStorageLimit));
    }, [miningHistoryStorageLimit, updateCopyHistoryItems, copyHistoryRepository]);

    useEffect(() => {
        return copyHistoryRepository.liveFetch(miningHistoryStorageLimit, updateCopyHistoryItems);
    }, [copyHistoryRepository, miningHistoryStorageLimit, updateCopyHistoryItems]);

    const deleteCopyHistoryItem = useCallback(
        async (item: CopyHistoryItem) => {
            const newCopyHistoryItems: CopyHistoryItem[] = [];

            for (const i of copyHistoryItems) {
                if (item.id !== i.id) {
                    newCopyHistoryItems.push(i);
                }
            }

            setCopyHistoryItems(newCopyHistoryItems);
            await copyHistoryRepository.delete(item.id);
        },
        [copyHistoryItems, copyHistoryRepository]
    );

    const saveCopyHistoryItem = useCallback(
        async (item: CopyHistoryItem) => {
            setCopyHistoryItems((items) => [...items, item]);
            await copyHistoryRepository.save(item);
        },
        [copyHistoryRepository]
    );

    const deleteAllCopyHistoryItems = useCallback(async () => {
        setCopyHistoryItems([]);
        await copyHistoryRepository.clear();
    }, [copyHistoryRepository]);

    return {
        copyHistoryItems,
        refreshCopyHistory,
        deleteCopyHistoryItem,
        deleteAllCopyHistoryItems,
        saveCopyHistoryItem,
    };
};
