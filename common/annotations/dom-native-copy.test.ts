import { describe, expect, it } from '@jest/globals';
import { ASB_SUBTITLE_INDEX_ATTRIBUTE } from '@project/common/annotations/dom-annotations';
import { registerSubtitleCopyScope } from '@project/common/annotations/dom-native-copy';
import { bindNativeTokenSelection } from '@project/common/annotations/dom-native-selection';

describe('native subtitle copy', () => {
    const copy = (target: EventTarget) => {
        const event = new Event('copy', { bubbles: true, cancelable: true, composed: true });
        const clipboardDataByType = new Map<string, string>();
        Object.defineProperty(event, 'clipboardData', {
            value: { setData: (type: string, value: string) => clipboardDataByType.set(type, value) },
        });
        target.dispatchEvent(event);
        return { handled: event.defaultPrevented, text: clipboardDataByType.get('text/plain') };
    };

    it('copies visible base text backward across cues, excluding ruby and inactive copies', () => {
        const container = document.createElement('div');
        container.innerHTML =
            `<span ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="0">` +
            '<ruby><b>alpha</b><rp>(</rp><rt>reading</rt><rp>)</rp></ruby> &amp; ' +
            '<span style="display: none">bravo</span><ruby>bravo<rt>frequency</rt></ruby><br>delta</span>' +
            `<br><span ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="1"><ruby>charlie<rt>gloss</rt></ruby></span>`;
        document.body.append(container);
        registerSubtitleCopyScope(container, `[${ASB_SUBTITLE_INDEX_ATTRIBUTE}]`);
        const selection = document.getSelection()!;
        const unbind = bindNativeTokenSelection(document);
        try {
            const start = container.querySelector('b')!.firstChild!;
            const end = container.querySelectorAll('ruby')[2].firstChild!;
            selection.setBaseAndExtent(end, 3, start, 2);

            expect(copy(container)).toEqual({ handled: true, text: 'pha & bravo\ndelta\ncha' });
            expect(selection.anchorNode).toBe(end);
            expect(selection.focusOffset).toBe(2);
            unbind();
            expect(copy(container)).toEqual({ handled: false, text: undefined });
        } finally {
            selection.removeAllRanges();
            unbind();
            container.remove();
        }
    });

    it('leaves native copy alone when page text sits between two owned endpoints', () => {
        const container = document.createElement('div');
        container.innerHTML =
            `<span ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="0">first</span>` +
            '<span>page text</span>' +
            `<span ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="1">second</span>`;
        document.body.append(container);
        registerSubtitleCopyScope(container, `[${ASB_SUBTITLE_INDEX_ATTRIBUTE}]`);
        const selection = document.getSelection()!;
        const unbind = bindNativeTokenSelection(document);
        try {
            selection.setBaseAndExtent(container.firstChild!.firstChild!, 1, container.lastChild!.firstChild!, 2);
            expect(copy(container)).toEqual({ handled: false, text: undefined });
        } finally {
            selection.removeAllRanges();
            unbind();
            container.remove();
        }
    });

    it('leaves multiple selected ruby annotations to native copy even with a trailing line break', () => {
        const cue = document.createElement('span');
        cue.innerHTML = '<ruby><ruby><ruby>base<rt>reading</rt></ruby><rt>42</rt></ruby><rt>gloss</rt></ruby><br>';
        document.body.append(cue);
        registerSubtitleCopyScope(cue);
        const selection = document.getSelection()!;
        const unbind = bindNativeTokenSelection(document);
        try {
            selection.setBaseAndExtent(cue.querySelector('rt')!.firstChild!, 0, cue, cue.childNodes.length);
            expect(selection.toString()).toBe('reading42gloss');
            expect(copy(cue)).toEqual({ handled: false, text: undefined });
        } finally {
            selection.removeAllRanges();
            unbind();
            cue.remove();
        }
    });

    it.each([
        { name: 'the selection is entirely inside a reading', owned: true },
        { name: 'the markup is not in an asbplayer subtitle container', owned: false },
    ])('leaves native copy alone when $name', ({ owned }) => {
        const container = document.createElement('div');
        container.innerHTML = `<span ${ASB_SUBTITLE_INDEX_ATTRIBUTE}="0"><ruby>base<rt>reading</rt></ruby></span>`;
        document.body.append(container);
        if (owned) registerSubtitleCopyScope(container.firstElementChild as HTMLElement);
        const selection = document.getSelection()!;
        const unbind = bindNativeTokenSelection(document);
        try {
            selection.selectAllChildren(owned ? container.querySelector('rt')! : container);
            expect(copy(container)).toEqual({ handled: false, text: undefined });
        } finally {
            selection.removeAllRanges();
            unbind();
            container.remove();
        }
    });
});
