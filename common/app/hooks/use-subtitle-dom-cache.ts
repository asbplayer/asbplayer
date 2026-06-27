import { IndexedSubtitleModel, OffscreenDomCache } from '@project/common';
import { useCallback, useEffect, useState } from 'react';

export const useSubtitleDomCache = (
    subtitles: IndexedSubtitleModel[],
    render: (subtitle: IndexedSubtitleModel) => string
) => {
    const [domCache, setDomCache] = useState<OffscreenDomCache>(new OffscreenDomCache());

    useEffect(() => {
        const domCache = new OffscreenDomCache();
        setDomCache(domCache);
        return () => domCache.clear();
    }, [subtitles, render]);

    const refreshSubtitleDomCacheForSubtitles = useCallback(
        (windowSubtitles: IndexedSubtitleModel[]) => {
            const keep = new Set(windowSubtitles.map((s) => String(s.index)));
            for (const key of domCache.keys()) {
                if (!keep.has(key)) domCache.delete(key);
            }
            for (const subtitle of windowSubtitles) {
                const key = String(subtitle.index);
                if (!domCache.has(key)) domCache.add(key, render(subtitle));
            }
        },
        [domCache, render]
    );

    const updateSubtitleDomCache = useCallback(
        (updatedSubtitles: IndexedSubtitleModel[]) => {
            for (const subtitle of updatedSubtitles) {
                const key = String(subtitle.index);
                if (domCache.has(key)) domCache.add(key, render(subtitle)); // Re-render updated subtitles that already exist in the cache
            }
        },
        [domCache, render]
    );

    return {
        getSubtitleDomCache: () => domCache,
        refreshSubtitleDomCacheForSubtitles,
        updateSubtitleDomCache,
    };
};
