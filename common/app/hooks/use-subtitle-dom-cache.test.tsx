import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { IndexedSubtitleModel, OffscreenDomCache } from '@project/common';
import { ASB_SUBTITLE_INDEX_ATTRIBUTE } from '@project/common/annotations';
import { useSubtitleDomCache } from '@project/common/app/hooks/use-subtitle-dom-cache';
import { makeSubtitle } from '@project/common/playback/playback-test-utils';
import { subtitleKey } from '@project/common/subtitle-reader/subtitle-stream';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const renderSubtitle = (cue: IndexedSubtitleModel) =>
    `<span ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="${cue.index}">${cue.text}</span>`;

describe('useSubtitleDomCache', () => {
    let root: Root;
    let container: HTMLDivElement;
    let cache: OffscreenDomCache;
    function Player({
        subtitles,
        render = renderSubtitle,
    }: {
        subtitles: IndexedSubtitleModel[];
        render?: (cue: IndexedSubtitleModel) => string;
    }) {
        cache = useSubtitleDomCache(subtitles, render).getSubtitleDomCache();
        return null;
    }
    beforeEach(() => {
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        window.getSelection()?.removeAllRanges();
    });

    it('preserves DOM nodes and text selection while new cues move an existing cue to another index', async () => {
        const cue = makeSubtitle({ text: 'selected word', source: { loadId: 'stream', cueId: 0 } });
        await act(async () => root.render(<Player subtitles={[cue]} />));
        const element = cache.get(subtitleKey(cue));
        const span = element.firstElementChild!;
        const range = document.createRange();
        range.selectNodeContents(span);
        window.getSelection()?.addRange(range);
        const earlier = makeSubtitle({ text: 'earlier', source: { loadId: 'other', cueId: 0 } });
        await act(async () => root.render(<Player subtitles={[earlier, { ...cue, index: 1 }]} />));
        expect(cache.get(subtitleKey(cue)).firstElementChild).toBe(span);
        expect(span.getAttribute(ASB_SUBTITLE_INDEX_ATTRIBUTE)).toBe('1');
        expect(window.getSelection()?.toString()).toBe('selected word');
        expect(cache.keys()).toHaveLength(2);
    });

    it('updates corrected text and removes cues belonging to a replaced source', async () => {
        const cue = makeSubtitle({ text: 'original', source: { loadId: 'old', cueId: 0 } });
        await act(async () => root.render(<Player subtitles={[cue]} />));
        await act(async () => root.render(<Player subtitles={[{ ...cue, text: 'corrected' }]} />));
        expect(cache.get(subtitleKey(cue)).textContent?.trim()).toBe('corrected');
        const replacement = { ...cue, source: { loadId: 'new', cueId: 0 } };
        await act(async () => root.render(<Player subtitles={[replacement]} />));
        expect(cache.has(subtitleKey(cue))).toBe(false);
        expect(cache.get(subtitleKey(replacement)).textContent?.trim()).toBe('original');
    });

    it('refreshes retained cues when the renderer changes and clears removed cues', async () => {
        const cue = makeSubtitle({ text: 'word', source: { loadId: 'stream', cueId: 0 } });
        const subtitles = [cue];
        await act(async () => root.render(<Player subtitles={subtitles} />));
        await act(async () => root.render(<Player subtitles={subtitles} render={(cue) => `<em>${cue.text}</em>`} />));
        expect(cache.get(subtitleKey(cue)).querySelector('em')?.textContent).toBe('word');
        await act(async () => root.render(<Player subtitles={[]} />));
        expect(cache.keys()).toEqual([]);
    });
});
