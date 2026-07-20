import { extractEpisode } from './jimaku-episode-patterns';

describe('extractEpisode', () => {
    it('returns undefined for empty or whitespace input', () => {
        expect(extractEpisode(undefined)).toBeUndefined();
        expect(extractEpisode('')).toBeUndefined();
        expect(extractEpisode('   ')).toBeUndefined();
    });

    it('parses SxxExx style (Netflix)', () => {
        expect(extractEpisode('Vivy S01E05 Vivy')).toBe(5);
    });

    it('parses Sxx.Exx style with separator (Amazon)', () => {
        expect(extractEpisode('Series Title.S01.E12 Episode Name')).toBe(12);
    });

    it('parses explicit episode prefix EP/E', () => {
        expect(extractEpisode('Some Title EP07')).toBe(7);
        expect(extractEpisode('Some Title E03')).toBe(3);
    });

    it('parses CJK 第N集/话/話 with arabic numerals', () => {
        expect(extractEpisode('某作品 第5话')).toBe(5);
        expect(extractEpisode('某作品 第12集')).toBe(12);
        expect(extractEpisode('某作品 第3話')).toBe(3);
    });

    it('parses CJK kanji numerals, Chinese 第十一集 and Japanese 第十一話', () => {
        expect(extractEpisode('某作品 第一集')).toBe(1);
        expect(extractEpisode('某作品 第十集')).toBe(10);
        expect(extractEpisode('某作品 第十一集')).toBe(11);
        expect(extractEpisode('某作品 第二十集')).toBe(20);
        expect(extractEpisode('某作品 第二十三集')).toBe(23);
        expect(extractEpisode('某作品 第二十九話')).toBe(29);
        expect(extractEpisode('ある作品 第九十九話')).toBe(99);
    });

    it('takes the first match when multiple patterns would match', () => {
        expect(extractEpisode('Title S01E02 E05')).toBe(2);
    });

    it('prefers arabic numerals over kanji when both appear', () => {
        expect(extractEpisode('某作品 第5话 第十集')).toBe(5);
    });

    it('returns undefined for titles without an unambiguous episode marker', () => {
        expect(extractEpisode('2.43 Seiin Koukou Danshi Volley-bu')).toBeUndefined();
        expect(extractEpisode('The Matrix')).toBeUndefined();
        expect(extractEpisode('Go-toubun no Hanayome')).toBeUndefined();
    });

    it('ignores bare trailing numbers to avoid false positives', () => {
        expect(extractEpisode('Movie 2005')).toBeUndefined();
        expect(extractEpisode('Episode Title 5')).toBeUndefined();
    });

    it('rejects non-positive captures', () => {
        expect(extractEpisode('Title S01E00')).toBeUndefined();
        expect(extractEpisode('某作品 第0集')).toBeUndefined();
    });
});
