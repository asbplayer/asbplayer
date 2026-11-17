import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { IndexedSubtitleModel, OffscreenDomCache } from '@project/common';
import {
    ASB_SUBTITLE_INDEX_ATTRIBUTE,
    selectTokenInRoot,
    restorableTokenSelectionInRoot,
} from '@project/common/annotations';
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
        cache = useSubtitleDomCache(subtitles, render);
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

    it('keeps equivalent DOM when the renderer changes and replaces only changed markup', async () => {
        const cues = [makeSubtitle({ index: 0, text: 'first' }), makeSubtitle({ index: 1, text: 'second' })];
        await act(async () => root.render(<Player subtitles={cues} />));
        const first = cache.get(subtitleKey(cues[0])).firstElementChild;
        const second = cache.get(subtitleKey(cues[1])).firstElementChild;
        const render = (cue: IndexedSubtitleModel) =>
            cue.index === 0 ? `<i>${renderSubtitle(cue)}</i>` : renderSubtitle(cue);

        await act(async () => root.render(<Player subtitles={cues} render={render} />));
        expect(cache.get(subtitleKey(cues[0])).firstElementChild).not.toBe(first);
        expect(cache.get(subtitleKey(cues[0])).querySelector('i')?.textContent).toBe('first');
        expect(cache.get(subtitleKey(cues[1])).firstElementChild).toBe(second);

        await act(async () => root.render(<Player subtitles={cues} />));
        expect(cache.get(subtitleKey(cues[0])).querySelector('i')).toBeNull();
        expect(cache.get(subtitleKey(cues[1])).firstElementChild).toBe(second);
    });

    it('refreshes index attributes after reindexing and a renderer change', async () => {
        const cue = makeSubtitle({ text: 'word', source: { loadId: 'stream', cueId: 0 } });
        await act(async () => root.render(<Player subtitles={[cue]} />));
        const earlier = makeSubtitle({ text: 'earlier', source: { loadId: 'other', cueId: 0 } });
        await act(async () => root.render(<Player subtitles={[earlier, { ...cue, index: 1 }]} />));
        expect(cache.get(subtitleKey(cue)).firstElementChild?.getAttribute(ASB_SUBTITLE_INDEX_ATTRIBUTE)).toBe('1');

        const render = (cue: IndexedSubtitleModel) => renderSubtitle(cue);
        await act(async () => root.render(<Player subtitles={[cue]} render={render} />));
        expect(cache.get(subtitleKey(cue)).firstElementChild?.getAttribute(ASB_SUBTITLE_INDEX_ATTRIBUTE)).toBe('0');
    });

    it.each(['settings', 'annotations'] as const)('preserves a selected token across a %s batch', async (change) => {
        const cues = [makeSubtitle({ index: 0, text: 'first' }), makeSubtitle({ index: 1, text: 'second' })];
        const tokenHtml = (cue: IndexedSubtitleModel) =>
            `<span class="asbplayer-subtitles" ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="${cue.index}"><span data-asb-token-start="0">${cue.text}</span></span>`;
        await act(async () => root.render(<Player subtitles={cues} render={tokenHtml} />));
        const selectedRoot = cache.get(subtitleKey(cues[1]));
        const previousToken = selectedRoot.querySelector('[data-asb-token-start]');
        expect(
            selectTokenInRoot(
                selectedRoot,
                { subtitleIndex: 1, tokenStart: 0 },
                {
                    focusContainer: false,
                    scrollIntoView: false,
                    autoPause: true,
                }
            )
        ).toBe(true);

        if (change === 'settings') {
            const styledHtml = (cue: IndexedSubtitleModel) => `<i>${tokenHtml(cue)}</i>`;
            await act(async () => root.render(<Player subtitles={cues} render={styledHtml} />));
            expect(selectedRoot.querySelector('i')).not.toBeNull();
        } else {
            const updated = cues.map((cue) => ({ ...cue, tokenization: { tokens: [] } }));
            await act(async () => root.render(<Player subtitles={updated} render={tokenHtml} />));
        }

        expect(cache.get(subtitleKey(cues[1]))).toBe(selectedRoot);
        if (change === 'settings') {
            expect(selectedRoot.querySelector('[data-asb-token-start]')).not.toBe(previousToken);
        } else {
            expect(selectedRoot.querySelector('[data-asb-token-start]')).toBe(previousToken);
        }
        expect(document.getSelection()?.toString()).toBe('second');
        expect(restorableTokenSelectionInRoot(selectedRoot)).toEqual({
            location: { subtitleIndex: 1, tokenStart: 0 },
            options: { autoPause: true, selectText: true },
        });
        expect(restorableTokenSelectionInRoot(cache.get(subtitleKey(cues[0])))).toBeUndefined();
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
