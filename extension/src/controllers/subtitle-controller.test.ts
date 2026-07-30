import { describe, expect, it } from '@jest/globals';
import { IndexedSubtitleModel } from '@project/common';
import { buildSubtitleContextText } from './subtitle-controller';

const subtitle = (text: string, index: number): IndexedSubtitleModel => ({
    text,
    index,
    start: index * 1000,
    end: (index + 1) * 1000,
    originalStart: index * 1000,
    originalEnd: (index + 1) * 1000,
    track: 0,
});

describe('buildSubtitleContextText', () => {
    it('returns empty strings for single subtitle', () => {
        const result = buildSubtitleContextText(0, [subtitle('A', 0)]);
        expect(result).toEqual({ before: '', after: '' });
    });

    it('returns correct before and after text', () => {
        const subs = [subtitle('A', 0), subtitle('B', 1), subtitle('C', 2)];
        const result = buildSubtitleContextText(1, subs);
        expect(result).toEqual({ before: 'A', after: 'C' });
    });

    it('trims trailing space from subtitle text', () => {
        const subs = [subtitle('A ', 0), subtitle('B', 1)];
        const result = buildSubtitleContextText(1, subs);
        expect(result.before).toBe('A');
    });

    it('trims leading space from subtitle text', () => {
        const subs = [subtitle('A', 0), subtitle(' B', 1)];
        const result = buildSubtitleContextText(0, subs);
        expect(result.after).toBe('B');
    });

    it('prevents double space at before boundary', () => {
        const subs = [subtitle('A ', 0), subtitle('B', 1)];
        const result = buildSubtitleContextText(1, subs);
        expect(result.before).toBe('A');
        expect(result.before).not.toMatch(/ {2}/);
    });

    it('prevents double space at after boundary', () => {
        const subs = [subtitle('A', 0), subtitle(' B', 1)];
        const result = buildSubtitleContextText(0, subs);
        expect(result.after).toBe('B');
        expect(result.after).not.toMatch(/ {2}/);
    });

    it('joins multiple before subtitles with single space', () => {
        const subs = [subtitle('A', 0), subtitle('B', 1), subtitle('C', 2)];
        const result = buildSubtitleContextText(2, subs);
        expect(result.before).toBe('A B');
    });

    it('joins multiple after subtitles with single space', () => {
        const subs = [subtitle('A', 0), subtitle('B', 1), subtitle('C', 2)];
        const result = buildSubtitleContextText(0, subs);
        expect(result.after).toBe('B C');
    });
});
