import { useCallback, useEffect, useRef } from 'react';
import type { CardModel } from '@project/common';
import { isActiveBlobUrl, revokeBlobUrl } from '@project/common/blob-url';

/** Release converted sources after history, dialogs and active exports have discarded them. */
export const useCardAudioSources = (cards: readonly CardModel[]) => {
    const retained = useRef(new Set<string>());
    const mounted = useRef(false);

    useEffect(() => {
        const current = new Set(
            cards.flatMap((card) => {
                const url = card.file?.transcodedAudio?.blobUrl;
                return url && isActiveBlobUrl(url) ? [url] : [];
            })
        );
        for (const url of retained.current) {
            if (!current.has(url)) revokeBlobUrl(url);
        }
        retained.current = current;
    });

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            // Strict Mode immediately remounts effects; keep sources alive during that check.
            queueMicrotask(() => {
                if (mounted.current) return;
                for (const url of retained.current) revokeBlobUrl(url);
                retained.current.clear();
            });
        };
    }, []);

    // Register synchronously: a fast save can finish before React renders its pending state.
    return useCallback((card: CardModel) => {
        const url = card.file?.transcodedAudio?.blobUrl;
        if (url && isActiveBlobUrl(url)) retained.current.add(url);
    }, []);
};
