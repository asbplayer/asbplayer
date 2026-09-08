import { prepareHint } from '@project/common/subtitle-sources/jimaku-episode-patterns';
import { describe, expect, it } from '@jest/globals';

describe('prepareHint', () => {
    it('returns undefined episode and empty cleaned for empty or whitespace input', () => {
        expect(prepareHint(undefined)).toEqual({ episode: undefined, cleaned: '' });
        expect(prepareHint('')).toEqual({ episode: undefined, cleaned: '' });
        expect(prepareHint('   ')).toEqual({ episode: undefined, cleaned: '' });
    });

    it('parses SxxExx style (Netflix)', () => {
        expect(prepareHint('Vivy S01E05 Vivy')).toEqual({ episode: 5, cleaned: 'Vivy Vivy' });
    });

    it('parses Sxx.Exx style with separator (Amazon)', () => {
        expect(prepareHint('Series Title.S01.E12 Episode Name')).toEqual({
            episode: 12,
            cleaned: 'Series Title. Episode Name',
        });
    });

    it('parses explicit episode prefix EP/E', () => {
        expect(prepareHint('Some Title EP07')).toEqual({ episode: 7, cleaned: 'Some Title' });
        expect(prepareHint('Some Title E03')).toEqual({ episode: 3, cleaned: 'Some Title' });
    });

    it('parses CJK 第N集/话/話 with arabic numerals', () => {
        expect(prepareHint('某作品 第5话')).toEqual({ episode: 5, cleaned: '某作品' });
        expect(prepareHint('某作品 第12集')).toEqual({ episode: 12, cleaned: '某作品' });
        expect(prepareHint('某作品 第3話')).toEqual({ episode: 3, cleaned: '某作品' });
    });

    it('parses CJK kanji numerals, Chinese 第十一集 and Japanese 第十一話', () => {
        expect(prepareHint('某作品 第一集')).toEqual({ episode: 1, cleaned: '某作品' });
        expect(prepareHint('某作品 第十集')).toEqual({ episode: 10, cleaned: '某作品' });
        expect(prepareHint('某作品 第十一集')).toEqual({ episode: 11, cleaned: '某作品' });
        expect(prepareHint('某作品 第二十集')).toEqual({ episode: 20, cleaned: '某作品' });
        expect(prepareHint('某作品 第二十三集')).toEqual({ episode: 23, cleaned: '某作品' });
        expect(prepareHint('某作品 第二十九話')).toEqual({ episode: 29, cleaned: '某作品' });
        expect(prepareHint('ある作品 第九十九話')).toEqual({ episode: 99, cleaned: 'ある作品' });
    });

    it('takes the first match when multiple patterns would match', () => {
        expect(prepareHint('Title S01E02 E05')).toEqual({ episode: 2, cleaned: 'Title E05' });
    });

    it('prefers arabic numerals over kanji when both appear', () => {
        expect(prepareHint('某作品 第5话 第十集')).toEqual({ episode: 5, cleaned: '某作品 第十集' });
    });

    it('returns undefined episode for titles without an unambiguous episode marker', () => {
        expect(prepareHint('2.43 Seiin Koukou Danshi Volley-bu')).toEqual({
            episode: undefined,
            cleaned: '2.43 Seiin Koukou Danshi Volley-bu',
        });
        expect(prepareHint('The Matrix')).toEqual({ episode: undefined, cleaned: 'The Matrix' });
        expect(prepareHint('Go-toubun no Hanayome')).toEqual({
            episode: undefined,
            cleaned: 'Go-toubun no Hanayome',
        });
    });

    it('ignores bare trailing numbers to avoid false positives', () => {
        expect(prepareHint('Movie 2005')).toEqual({ episode: undefined, cleaned: 'Movie 2005' });
        expect(prepareHint('Episode Title 5')).toEqual({ episode: undefined, cleaned: 'Episode Title 5' });
    });

    it('rejects non-positive captures', () => {
        expect(prepareHint('Title S01E00')).toEqual({ episode: undefined, cleaned: 'Title S01E00' });
        expect(prepareHint('某作品 第0集')).toEqual({ episode: undefined, cleaned: '某作品 第0集' });
    });

    it('strips the " - suffix" portion from the cleaned title', () => {
        expect(prepareHint('Some Series S01E05 - Episode Title')).toEqual({
            episode: 5,
            cleaned: 'Some Series',
        });
    });

    it('preserves the full title when no episode is detected and there is no suffix separator', () => {
        expect(prepareHint('Plain Title')).toEqual({ episode: undefined, cleaned: 'Plain Title' });
    });
});
