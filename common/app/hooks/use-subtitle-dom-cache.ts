import type { IndexedSubtitleModel } from '@project/common';
import { OffscreenDomCache } from '@project/common';
import {
    ASB_SUBTITLE_INDEX_ATTRIBUTE,
    restorableTokenSelectionInRoot,
    selectTokenInRoot,
} from '@project/common/annotations';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { subtitleKey } from '@project/common/subtitle-reader/subtitle-stream';

export const useSubtitleDomCache = (
    subtitles: IndexedSubtitleModel[],
    render: (subtitle: IndexedSubtitleModel) => string
) => {
    const domCacheRef = useRef(new OffscreenDomCache());
    const previousSubtitlesRef = useRef<IndexedSubtitleModel[] | undefined>(undefined);
    const previousRenderRef = useRef(render);

    useLayoutEffect(() => {
        const previousSubtitles = previousSubtitlesRef.current;
        const previousByKey = new Map(previousSubtitles?.map((cue) => [subtitleKey(cue), cue]));
        const currentKeys = new Set(subtitles.map(subtitleKey));
        const cache = domCacheRef.current;
        for (const key of cache.keys()) if (!currentKeys.has(key)) cache.delete(key);
        for (const subtitle of subtitles) {
            const key = subtitleKey(subtitle);
            const previous = previousByKey.get(key);
            if (
                !previous ||
                previous.text !== subtitle.text ||
                previous.tokenization !== subtitle.tokenization ||
                previous.textImage !== subtitle.textImage ||
                previousRenderRef.current !== render
            ) {
                const root = cache.has(key) ? cache.get(key) : undefined;
                const selection = root && restorableTokenSelectionInRoot(root);
                cache.add(key, render(subtitle));
                if (selection && previous?.text === subtitle.text) {
                    selectTokenInRoot(
                        cache.get(key),
                        { ...selection.location, subtitleIndex: subtitle.index },
                        {
                            ...selection.options,
                            focusContainer: false,
                            scrollIntoView: false,
                        }
                    );
                }
            } else if (previous.index !== subtitle.index) {
                for (const element of cache.get(key).querySelectorAll(`[${ASB_SUBTITLE_INDEX_ATTRIBUTE}]`)) {
                    element.setAttribute(ASB_SUBTITLE_INDEX_ATTRIBUTE, String(subtitle.index));
                }
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
