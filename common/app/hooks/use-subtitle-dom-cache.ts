import type { IndexedSubtitleModel } from '@project/common';
import { OffscreenDomCache } from '@project/common';
import {
    ASB_SUBTITLE_INDEX_ATTRIBUTE,
    restorableTokenSelectionInRoot,
    selectTokenInRoot,
} from '@project/common/annotations';
import type { RestorableTokenSelection } from '@project/common/annotations';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { diffCues, sameSubtitleAppearance, subtitleKey } from '@project/common/subtitle-reader/subtitle-stream';

interface CachedSubtitleUpdate {
    key: string;
    subtitle: IndexedSubtitleModel;
    html: string;
    selection: RestorableTokenSelection | undefined;
}

const replaceCachedSubtitles = (cache: OffscreenDomCache, updates: CachedSubtitleUpdate[]) => {
    // Selections are captured before any replacements: getSelection() can force layout in Chrome.
    // Restore them after all writes so a settings update does not lay out the entire cache per cue.
    for (const { key, html } of updates) cache.add(key, html);
    for (const { key, subtitle, selection } of updates) {
        if (selection) {
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
    }
};

export const useSubtitleDomCache = (
    subtitles: IndexedSubtitleModel[],
    render: (subtitle: IndexedSubtitleModel) => string
) => {
    const domCacheRef = useRef(new OffscreenDomCache());
    const previousSubtitlesRef = useRef<IndexedSubtitleModel[] | undefined>(undefined);
    const previousRenderRef = useRef(render);
    const previousHtmlRef = useRef(new Map<string, string>());

    useLayoutEffect(() => {
        const diff = diffCues(
            previousSubtitlesRef.current ?? [],
            subtitles,
            (previous, next) => previousRenderRef.current === render && sameSubtitleAppearance(previous, next)
        );
        const cache = domCacheRef.current;
        for (const key of diff.removedKeys) {
            cache.delete(key);
            previousHtmlRef.current.delete(key);
        }
        const updates: CachedSubtitleUpdate[] = diff.added.map((subtitle) => ({
            key: subtitleKey(subtitle),
            subtitle,
            html: render(subtitle),
            selection: undefined,
        }));
        for (const { previous, next } of diff.changed) {
            const key = subtitleKey(next);
            const html = render(next);
            const root = cache.has(key) ? cache.get(key) : undefined;
            if (root && previous.index === next.index && previousHtmlRef.current.get(key) === html) continue; // Keep live DOM and selections when a settings or annotation change produces identical markup
            const selection = root && previous.text === next.text ? restorableTokenSelectionInRoot(root) : undefined;
            updates.push({ key, subtitle: next, html, selection });
        }
        for (const { previous, next } of diff.retained) {
            if (previous.index === next.index) continue;
            const key = subtitleKey(next);
            previousHtmlRef.current.delete(key); // Index attributes are edited directly, so the stored renderer output is stale
            for (const element of cache.get(key).querySelectorAll(`[${ASB_SUBTITLE_INDEX_ATTRIBUTE}]`)) {
                element.setAttribute(ASB_SUBTITLE_INDEX_ATTRIBUTE, String(next.index));
            }
        }
        replaceCachedSubtitles(cache, updates);
        for (const { key, html } of updates) previousHtmlRef.current.set(key, html);

        previousSubtitlesRef.current = subtitles;
        previousRenderRef.current = render;
    }, [subtitles, render]);

    useEffect(
        () => () => {
            domCacheRef.current.clear();
            previousHtmlRef.current.clear();
        },
        []
    );

    return domCacheRef.current;
};
