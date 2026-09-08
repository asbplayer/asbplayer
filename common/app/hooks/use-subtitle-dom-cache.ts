import type { IndexedSubtitleModel } from '@project/common';
import { OffscreenDomCache } from '@project/common';
import { needsReset } from '@project/common/annotations';
import { useCallback, useEffect, useRef, useState } from 'react';

export const useSubtitleDomCache = (
    subtitles: IndexedSubtitleModel[],
    render: (subtitle: IndexedSubtitleModel) => string
) => {
    const [domCache, setDomCache] = useState<OffscreenDomCache>(() => new OffscreenDomCache());
    const domCacheRef = useRef(domCache);
    const previousSubtitlesRef = useRef<IndexedSubtitleModel[] | undefined>(undefined);
    const previousRenderRef = useRef(render);

    useEffect(() => {
        const previousSubtitles = previousSubtitlesRef.current;
        const shouldReset =
            previousSubtitles === undefined ||
            needsReset(subtitles, previousSubtitles) ||
            previousRenderRef.current !== render;

        if (shouldReset) {
            const nextDomCache = new OffscreenDomCache();
            for (const subtitle of subtitles) nextDomCache.add(String(subtitle.index), render(subtitle));
            domCacheRef.current.clear();
            domCacheRef.current = nextDomCache;
            setDomCache(nextDomCache);
        }

        previousSubtitlesRef.current = subtitles;
        previousRenderRef.current = render;
    }, [subtitles, render]);

    useEffect(() => () => domCacheRef.current.clear(), []);

    const updateSubtitleDomCache = useCallback(
        (updatedSubtitles: IndexedSubtitleModel[]) => {
            const domCache = domCacheRef.current;
            for (const subtitle of updatedSubtitles) {
                const key = String(subtitle.index);
                if (domCache.has(key)) domCache.add(key, render(subtitle)); // Re-render updated subtitles that already exist in the cache
            }
        },
        [render]
    );

    return { getSubtitleDomCache: () => domCache, updateSubtitleDomCache };
};
