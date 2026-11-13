import type { IndexedSubtitleModel } from '@project/common';
import { OffscreenDomCache } from '@project/common';
import {
    ASB_SUBTITLE_INDEX_ATTRIBUTE,
    restorableTokenSelectionInRoot,
    selectTokenInRoot,
} from '@project/common/annotations';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { diffCues, sameSubtitleAppearance, subtitleKey } from '@project/common/subtitle-reader/subtitle-stream';

export const useSubtitleDomCache = (
    subtitles: IndexedSubtitleModel[],
    render: (subtitle: IndexedSubtitleModel) => string
) => {
    const domCacheRef = useRef(new OffscreenDomCache());
    const previousSubtitlesRef = useRef<IndexedSubtitleModel[] | undefined>(undefined);
    const previousRenderRef = useRef(render);

    useLayoutEffect(() => {
        const diff = diffCues(
            previousSubtitlesRef.current ?? [],
            subtitles,
            (previous, next) => previousRenderRef.current === render && sameSubtitleAppearance(previous, next)
        );
        const cache = domCacheRef.current;
        for (const key of diff.removedKeys) cache.delete(key);
        for (const subtitle of diff.added) cache.add(subtitleKey(subtitle), render(subtitle));
        for (const { previous, next } of diff.changed) {
            const key = subtitleKey(next);
            const root = cache.has(key) ? cache.get(key) : undefined;
            const selection = root && restorableTokenSelectionInRoot(root);
            cache.add(key, render(next));
            if (selection && previous.text === next.text) {
                selectTokenInRoot(
                    cache.get(key),
                    { ...selection.location, subtitleIndex: next.index },
                    {
                        ...selection.options,
                        focusContainer: false,
                        scrollIntoView: false,
                    }
                );
            }
        }
        for (const { previous, next } of diff.retained) {
            if (previous.index === next.index) continue;
            for (const element of cache.get(subtitleKey(next)).querySelectorAll(`[${ASB_SUBTITLE_INDEX_ATTRIBUTE}]`)) {
                element.setAttribute(ASB_SUBTITLE_INDEX_ATTRIBUTE, String(next.index));
            }
        }

        previousSubtitlesRef.current = subtitles;
        previousRenderRef.current = render;
    }, [subtitles, render]);

    useEffect(() => () => domCacheRef.current.clear(), []);

    const updateSubtitleDomCache = useCallback(
        (updatedSubtitles: readonly IndexedSubtitleModel[]) => {
            const domCache = domCacheRef.current;
            for (const subtitle of updatedSubtitles) {
                const key = subtitleKey(subtitle);
                if (!domCache.has(key)) continue;
                const root = domCache.get(key);
                const tokenSelection = restorableTokenSelectionInRoot(root);
                domCache.add(key, render(subtitle)); // Replaces the root's content in place
                if (tokenSelection) {
                    selectTokenInRoot(root, tokenSelection.location, {
                        ...tokenSelection.options,
                        focusContainer: false,
                        scrollIntoView: false,
                    });
                }
            }
        },
        [render]
    );

    return { getSubtitleDomCache: () => domCacheRef.current, updateSubtitleDomCache };
};
