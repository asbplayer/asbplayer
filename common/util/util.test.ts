import {
    areTokenizationsEqual,
    arrayEquals,
    AsyncSemaphore,
    buildSubtitleTracks,
    compareSubtitlesForDisplay,
    computeStyles,
    computeStyleString,
    download,
    ensureStoragePersisted,
    extractText,
    filterAsync,
    fromBatches,
    getCurrentTimeString,
    getKanaMoras,
    hex2ToPercent,
    hexToRgb,
    humanReadableTime,
    inBatches,
    isKanaOnly,
    isKanaMoraPitchHigh,
    isAttachedParticlePitchHigh,
    isKatakanaOnly,
    isNumeric,
    iterateOverStringInBlocks,
    joinSubtitles,
    localizedDate,
    mapAsync,
    mockSurroundingSubtitles,
    normalizeForSearch,
    normalizedLookupTerms,
    percentToHex2,
    seekWithNudge,
    sourceString,
    subtitleIntersectsTimeInterval,
    subtitleTimestampWithDelay,
    surroundingSubtitles,
    surroundingSubtitlesAroundInterval,
    timeDurationDisplay,
    clampMediaTimestamp,
} from '@project/common/util';
import { TextSubtitleSettings } from '@project/common/settings';
import { Progress } from '@project/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

function subtitle(text: string, start: number, end: number, track = 0, index = 0) {
    return { text, start, end, originalStart: start, originalEnd: end, track, index };
}

function textSubtitleSettings(overrides: Partial<TextSubtitleSettings> = {}): TextSubtitleSettings {
    return {
        subtitleColor: '#FFFFFF',
        subtitleSize: 32,
        subtitleThickness: 700,
        subtitleOutlineThickness: 0,
        subtitleOutlineColor: '#000000',
        subtitleShadowThickness: 0,
        subtitleShadowColor: '#111111',
        subtitleBackgroundOpacity: 0,
        subtitleBackgroundColor: '#000000',
        subtitleFontFamily: '',
        subtitleCustomStyles: [],
        subtitleBlur: false,
        subtitleAlignment: 'bottom',
        ...overrides,
    };
}

describe('arrayEquals', () => {
    it('returns true for 0 items', () => {
        expect(arrayEquals([], [])).toBe(true);
    });

    it('returns true for 1 equal item and false for mismatched lengths', () => {
        expect(arrayEquals([1], [1])).toBe(true);
        expect(arrayEquals([1], [1, 2])).toBe(false);
    });

    it('supports custom comparators for 2 items', () => {
        expect(
            arrayEquals(
                [{ value: 1 }, { value: 2 }],
                [{ value: 1 }, { value: 2 }],
                (lhs, rhs) => lhs.value === rhs.value
            )
        ).toBe(true);
        expect(
            arrayEquals(
                [{ value: 1 }, { value: 2 }],
                [{ value: 1 }, { value: 3 }],
                (lhs, rhs) => lhs.value === rhs.value
            )
        ).toBe(false);
    });
});

describe('lookup and pitch helpers', () => {
    it('normalizes, expands, and deduplicates lookup terms while dropping empty values', () => {
        expect(normalizedLookupTerms('Café', 'cafe', null, undefined, '')).toEqual(['café', 'cafe']);
    });

    it('groups small kana into moras and evaluates numeric and explicit pitch patterns', () => {
        expect(getKanaMoras('きょう')).toEqual(['きょ', 'う']);
        expect(getKanaMoras('か\u3099')).toEqual(['が']);
        expect(isKanaMoraPitchHigh(0, 0)).toBe(false);
        expect(isKanaMoraPitchHigh(1, 0)).toBe(true);
        expect(isKanaMoraPitchHigh(1, 2)).toBe(true);
        expect(isKanaMoraPitchHigh(2, 'LHL')).toBe(false);
    });

    it('derives attached-particle pitch and rejects invalid candidates or context', () => {
        expect(isAttachedParticlePitchHigh('は', { prevMoras: ['に', 'ほ', 'ん'], prevPitchAccent: 0 })).toBe(true);
        expect(isAttachedParticlePitchHigh('は', { prevMoras: ['に', 'ほ', 'ん'], prevPitchAccent: 'LHH' })).toBe(true);
        expect(isAttachedParticlePitchHigh('word', { prevMoras: ['に'], prevPitchAccent: 0 })).toBeNull();
        expect(isAttachedParticlePitchHigh('は', {})).toBeNull();
    });

    it('builds sorted subtitle tracks once per used track and tolerates missing filenames', () => {
        expect(buildSubtitleTracks([{ track: 2 }, { track: 0 }, { track: 2 }], ['first.ass'])).toEqual([
            { trackNumber: 0, fileName: 'first.ass' },
            { trackNumber: 2, fileName: '' },
        ]);
    });
});

describe('humanReadableTime', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('formats localized dates with hour, minute, and second fields', () => {
        expect(localizedDate(Date.UTC(2026, 0, 1, 13, 2, 3), 'en-US', 'UTC')).toBe('01:02:03 PM');
    });

    it('formats 0 milliseconds', () => {
        expect(humanReadableTime(0)).toBe('0m00s');
    });

    it('formats nearest tenths for sub-minute timestamps', () => {
        expect(humanReadableTime(8250, true)).toBe('0m8.3s');
    });

    it('formats fully padded timestamps with hours', () => {
        expect(humanReadableTime(3_661_000, false, true)).toBe('01h01m01s');
        expect(humanReadableTime(3_668_200, true, true)).toBe('01h01m08.2s');
    });

    it('carries minute and hour boundaries with integer formatting', () => {
        expect(humanReadableTime(60_000)).toBe('1m00s');
        expect(humanReadableTime(3_600_000)).toBe('1h00m00s');
    });

    it('formats the current timestamp with date and clock components', () => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 4, 1, 2, 3, 4));

        expect(getCurrentTimeString()).toBe('2026-5-1-2-3-4');
    });
});

describe('download', () => {
    it('downloads a sanitized filename and cleans up the temporary object URL and element', () => {
        const blob = new Blob(['content'], { type: 'text/plain' });
        const originalCreateObjectURL = window.URL.createObjectURL;
        const originalRevokeObjectURL = window.URL.revokeObjectURL;
        const createdBlobs: Blob[] = [];
        const revokedUrls: string[] = [];
        let clickedAnchor: HTMLAnchorElement | undefined;
        const onClick = (event: Event) => {
            event.preventDefault();
            clickedAnchor = event.target as HTMLAnchorElement;
        };
        document.addEventListener('click', onClick);
        Object.defineProperty(window.URL, 'createObjectURL', {
            configurable: true,
            value: (value: Blob) => {
                createdBlobs.push(value);
                return 'blob:test-url';
            },
        });
        Object.defineProperty(window.URL, 'revokeObjectURL', {
            configurable: true,
            value: (value: string) => revokedUrls.push(value),
        });

        try {
            download(blob, '../bad:name?.txt');
        } finally {
            document.removeEventListener('click', onClick);
            Object.defineProperty(window.URL, 'createObjectURL', {
                configurable: true,
                value: originalCreateObjectURL,
            });
            Object.defineProperty(window.URL, 'revokeObjectURL', {
                configurable: true,
                value: originalRevokeObjectURL,
            });
        }

        expect(createdBlobs).toEqual([blob]);
        expect(revokedUrls).toEqual(['blob:test-url']);
        expect(document.querySelectorAll('a')).toHaveLength(0);
        expect(clickedAnchor).toMatchObject({ download: '..badname.txt', href: 'blob:test-url' });
    });
});

describe('timeDurationDisplay', () => {
    it.each([
        { timestamp: 1, length: 100, expected: '00:00.001' },
        { timestamp: 50, length: 100, expected: '00:00.050' },
        { timestamp: 99, length: 99, expected: '00:00.099' },
        { timestamp: 999, length: 1000, expected: '00:00.999' },
        { timestamp: 1250, length: 1250, expected: '00:01.250' },
    ])('zero-pads millisecond precision for $timestamp ms', ({ timestamp, length, expected }) => {
        expect(timeDurationDisplay(timestamp, length, true)).toBe(expected);
    });

    it('can omit milliseconds and display hour-long durations', () => {
        expect(timeDurationDisplay(3_661_250, 4_000_000, false)).toEqual('01:01:01');
    });

    it('displays negative timestamps with a leading minus sign', () => {
        expect(timeDurationDisplay(-1250, 1250, true)).toEqual('-00:01.250');
        expect(timeDurationDisplay(-1250, 1250, false)).toEqual('-00:01');
    });

    it('displays negative timestamps with hours when the media is at least one hour long', () => {
        expect(timeDurationDisplay(-3_723_004, 3_723_004, true)).toEqual('-01:02:03.004');
    });

    it('displays negative timestamps with hours when their magnitude exceeds the adjusted media length', () => {
        expect(timeDurationDisplay(-5_400_000, 1_800_000, true)).toEqual('-01:30:00.000');
    });
});

describe('clampMediaTimestamp', () => {
    it('clamps negative media timestamps to zero', () => {
        expect(clampMediaTimestamp(-1)).toBe(0);
        expect(clampMediaTimestamp(0)).toBe(0);
        expect(clampMediaTimestamp(1)).toBe(1);
    });

    it('clamps media timestamps to an optional media length', () => {
        expect(clampMediaTimestamp(-1, 100)).toBe(0);
        expect(clampMediaTimestamp(50, 100)).toBe(50);
        expect(clampMediaTimestamp(100, 100)).toBe(100);
        expect(clampMediaTimestamp(101, 100)).toBe(100);
    });

    it('does not apply an unavailable or invalid media length', () => {
        expect(clampMediaTimestamp(100, 0)).toBe(100);
        expect(clampMediaTimestamp(100, -1)).toBe(100);
        expect(clampMediaTimestamp(100, Number.NaN)).toBe(100);
        expect(clampMediaTimestamp(100, Number.POSITIVE_INFINITY)).toBe(100);
    });
});

describe('surroundingSubtitles', () => {
    it('returns 0 items when subtitles are empty', () => {
        expect(surroundingSubtitles([], 0, 0, 0)).toEqual([]);
    });

    it('returns the only subtitle for 1 item', () => {
        const subtitles = [subtitle('1', 10, 20)];
        expect(surroundingSubtitles(subtitles, 0, 0, 0)).toEqual(subtitles);
    });

    it('returns 2 items when count radius reaches the neighbor', () => {
        const subtitles = [subtitle('1', 0, 5), subtitle('2', 10, 15)];
        expect(surroundingSubtitles(subtitles, 0, 1, 0)).toEqual(subtitles);
    });

    it('uses time radius to include overlapping neighbors when count radius is 0', () => {
        const subtitles = [subtitle('1', 0, 5), subtitle('2', 4, 9), subtitle('3', 30, 35)];
        expect(surroundingSubtitles(subtitles, 1, 0, 5)).toEqual([subtitle('1', 0, 5), subtitle('2', 4, 9)]);
    });
});

describe('surroundingSubtitlesAroundInterval', () => {
    it('calculates surrounding subtitles around interval in middle when radius is 0', () => {
        const surrounding = surroundingSubtitlesAroundInterval(
            [subtitle('1', 0, 1), subtitle('2', 10, 20), subtitle('3', 25, 26), subtitle('4', 26, 30)],
            9,
            27,
            0,
            0
        );
        expect(surrounding.subtitle).toEqual(subtitle('2', 10, 20));
        expect(surrounding.surroundingSubtitles).toEqual([
            subtitle('2', 10, 20),
            subtitle('3', 25, 26),
            subtitle('4', 26, 30),
        ]);
    });

    it('calculates surrounding subtitles around interval in middle when radius is 0 and subtitles overlap', () => {
        const surrounding = surroundingSubtitlesAroundInterval(
            [subtitle('1', 0, 1), subtitle('2', 10, 20), subtitle('3', 15, 26), subtitle('4', 26, 30)],
            9,
            25,
            0,
            0
        );
        expect(surrounding.subtitle).toEqual(subtitle('2', 10, 20));
        expect(surrounding.surroundingSubtitles).toEqual([subtitle('2', 10, 20), subtitle('3', 15, 26)]);
    });

    it('returns an empty object for 0 items around an interval', () => {
        expect(surroundingSubtitlesAroundInterval([], 0, 10, 0, 0)).toEqual({});
    });

    it('returns an empty object when a single subtitle collapses both interval boundaries', () => {
        const only = subtitle('1', 10, 20);
        expect(surroundingSubtitlesAroundInterval([only], 11, 19, 0, 0)).toEqual({});
    });

    it('returns 2 items when count radius covers both interval neighbors', () => {
        const first = subtitle('1', 10, 20);
        const second = subtitle('2', 30, 40);
        expect(surroundingSubtitlesAroundInterval([first, second], 15, 35, 1, 0)).toEqual({
            surroundingSubtitles: [first, second],
            subtitle: second,
        });
    });
});

describe('mockSurroundingSubtitles', () => {
    it('returns 1 item when the subtitle already spans the whole media', () => {
        const middle = subtitle('1', 0, 100);
        expect(mockSurroundingSubtitles(middle, 100, 10)).toEqual([middle]);
    });

    it('returns 2 items with a trailing filler when only the end has space', () => {
        const middle = subtitle('1', 0, 40);
        expect(mockSurroundingSubtitles(middle, 100, 10)).toEqual([
            middle,
            {
                text: '',
                start: 40,
                end: 50,
                originalStart: 40,
                originalEnd: 50,
                track: 0,
                index: 0,
                richText: undefined,
            },
        ]);
    });

    it('returns 3 items when space exists on both sides and preserves subtitle offset', () => {
        const middle = { ...subtitle('1', 20, 30), originalStart: 10, originalEnd: 20 };
        expect(mockSurroundingSubtitles(middle, 100, 10)).toEqual([
            {
                text: '',
                start: 10,
                end: 20,
                originalStart: 0,
                originalEnd: 10,
                track: 0,
                index: 0,
                richText: undefined,
            },
            middle,
            {
                text: '',
                start: 30,
                end: 40,
                originalStart: 20,
                originalEnd: 30,
                track: 0,
                index: 0,
                richText: undefined,
            },
        ]);
    });
});

describe('subtitleTimestampWithDelay', () => {
    it('computes subtitle timestamp with delay and clamps to subtitle interval', () => {
        const sample = subtitle('text', 1000, 2000);

        expect(subtitleTimestampWithDelay(sample, 300)).toBe(1300);
        expect(subtitleTimestampWithDelay(sample, 1500)).toBe(2000);
        expect(subtitleTimestampWithDelay(sample, -300)).toBe(1700);
        expect(subtitleTimestampWithDelay(sample, -1500)).toBe(1000);
    });

    it('computes subtitle timestamp correctly for reversed intervals and zero-length subtitles', () => {
        expect(subtitleTimestampWithDelay(subtitle('text', 2000, 1000), 300)).toBe(1300);
        expect(subtitleTimestampWithDelay(subtitle('text', 1500, 1500), 999)).toBe(1500);
    });
});

describe('subtitleIntersectsTimeInterval', () => {
    it('returns false for 0-length subtitles', () => {
        expect(subtitleIntersectsTimeInterval(subtitle('1', 10, 10), [0, 100])).toBe(false);
    });

    it('returns true when overlap is exactly half of the subtitle length', () => {
        expect(subtitleIntersectsTimeInterval(subtitle('1', 10, 20), [0, 15])).toBe(true);
    });

    it('returns false when overlap is less than half of the subtitle length', () => {
        expect(subtitleIntersectsTimeInterval(subtitle('1', 10, 20), [0, 14])).toBe(false);
    });
});

describe('joinSubtitles', () => {
    it('returns an empty string for 0 items', () => {
        expect(joinSubtitles([])).toBe('');
    });

    it('joins 1 and 2 non-empty subtitles while filtering whitespace-only text', () => {
        expect(joinSubtitles([subtitle('one', 0, 1)])).toBe('one');
        expect(joinSubtitles([subtitle('one', 0, 1), subtitle('two', 1, 2)])).toBe('one\ntwo');
        expect(joinSubtitles([subtitle('one', 0, 1), subtitle('   ', 1, 2), subtitle('two', 2, 3)])).toBe('one\ntwo');
    });
});

describe('extractText', () => {
    it('returns the subtitle text when surrounding subtitles are empty', () => {
        const current = subtitle('current', 10, 20);
        expect(extractText(current, [])).toBe('current');
    });

    it('extracts 1 matching subtitle and filters by track when requested', () => {
        const current = subtitle('current', 10, 20, 0);
        const surrounding = [subtitle('track0', 10, 20, 0), subtitle('track1', 10, 20, 1)];
        expect(extractText(current, surrounding, 0)).toBe('track0');
        expect(extractText(current, surrounding, 1)).toBe('track1');
    });

    it('extracts 2 overlapping subtitles and excludes non-intersecting ones', () => {
        const current = subtitle('current', 10, 20);
        const surrounding = [subtitle('one', 5, 15), subtitle('two', 15, 25), subtitle('three', 30, 40)];
        expect(extractText(current, surrounding)).toBe('one\ntwo');
    });
});

describe('computeStyles and computeStyleString', () => {
    it('returns base styles when optional decorations are disabled', () => {
        expect(computeStyles(textSubtitleSettings())).toEqual({
            color: '#FFFFFF',
            fontSize: '32px',
            fontWeight: '700',
        });
    });

    it('applies outline, shadow, background, font family, and custom styles while ignoring numeric keys', () => {
        const styles = computeStyles(
            textSubtitleSettings({
                subtitleOutlineThickness: 2,
                subtitleShadowThickness: 3,
                subtitleBackgroundOpacity: 0.5,
                subtitleBackgroundColor: '#112233',
                subtitleFontFamily: 'Noto Sans JP',
                subtitleCustomStyles: [
                    { key: 'webkitTextFillColor', value: '#ABCDEF' },
                    { key: 'letterSpacing', value: '0.1em' },
                    { key: '0', value: 'invalid' },
                ],
            })
        );

        expect(styles).toEqual({
            color: '#FFFFFF',
            fontSize: '32px',
            fontWeight: '700',
            WebkitTextStroke: '#000000 2px',
            paintOrder: 'stroke fill',
            textShadow: '0 0 3px #111111, 0 0 3px #111111, 0 0 3px #111111, 0 0 3px #111111',
            backgroundColor: 'rgba(17, 34, 51, 0.5)',
            fontFamily: "'Noto Sans JP'",
            WebkitTextFillColor: '#ABCDEF',
            letterSpacing: '0.1em',
        });
    });

    it('builds a kebab-cased style string with important declarations', () => {
        const styleString = computeStyleString(
            textSubtitleSettings({
                subtitleOutlineThickness: 1,
                subtitleCustomStyles: [
                    { key: 'webkitTextFillColor', value: '#ABCDEF' },
                    { key: 'letterSpacing', value: '0.1em' },
                ],
            })
        );

        expect(styleString).toContain('color: #FFFFFF !important');
        expect(styleString).toContain('-webkit-text-stroke: #000000 1px !important');
        expect(styleString).toContain('-webkit-text-fill-color: #ABCDEF !important');
        expect(styleString).toContain('letter-spacing: 0.1em !important');
    });
});

describe('kana detection and normalization', () => {
    it('detects kana-only strings after NFC normalization', () => {
        expect(isKanaOnly('かな')).toBe(true);
        expect(isKanaOnly('ガ')).toBe(true);
        expect(isKanaOnly('仮名')).toBe(false);
        expect(isKanaOnly('')).toBe(false);
    });

    it('detects katakana-only strings and rejects hiragana and latin text', () => {
        expect(isKatakanaOnly('カタカナ')).toBe(true);
        expect(isKatakanaOnly('ガ')).toBe(true);
        expect(isKatakanaOnly('かな')).toBe(false);
        expect(isKatakanaOnly('abc')).toBe(false);
    });

    it('normalizes text for search across accent and ligature variants', () => {
        expect(normalizeForSearch('Crème Brûlée')).toBe('Creme Brulee');
        expect(normalizeForSearch('straße STRAẞE æ Æ œ Œ ø Ø đ Đ ł Ł')).toBe('strasse STRASSE ae AE oe OE o O d D l L');
    });

    it('normalizes decomposed input, preserves plain text, and is idempotent', () => {
        expect(normalizeForSearch('Cafe\u0301')).toBe('Cafe');
        expect(normalizeForSearch('plain ASCII 123')).toBe('plain ASCII 123');
        expect(normalizeForSearch(normalizeForSearch('Crème straße'))).toBe('Creme strasse');
    });

    it('removes combining marks without otherwise transliterating non-Latin text', () => {
        expect(normalizeForSearch('かな カナ 漢字')).toBe('かな カナ 漢字');
        expect(normalizeForSearch('क़')).toBe('क');
    });
});

describe('isNumeric', () => {
    it('returns true for integer, decimal, negative, and empty strings', () => {
        // Number('') === 0, so the implementation treats '' as numeric — pin this invariant
        expect(isNumeric('0')).toBe(true);
        expect(isNumeric('1')).toBe(true);
        expect(isNumeric('-1')).toBe(true);
        expect(isNumeric('1.5')).toBe(true);
        expect(isNumeric('')).toBe(true);
    });

    it('returns false for non-numeric strings used as style keys', () => {
        expect(isNumeric('a')).toBe(false);
        expect(isNumeric('letterSpacing')).toBe(false);
        expect(isNumeric('NaN')).toBe(false);
    });
});

describe('color and source helpers', () => {
    it('parses hex colors and falls back to white on invalid input', () => {
        expect(hexToRgb('#112233')).toEqual({ r: 17, g: 34, b: 51 });
        expect(hexToRgb('invalid')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('converts alpha hex values to percents and back with clamping', () => {
        expect(hex2ToPercent('#00')).toBe(0);
        expect(hex2ToPercent('#FF')).toBe(1);
        expect(hex2ToPercent('invalid')).toBe(1);
        expect(percentToHex2(0)).toBe('00');
        expect(percentToHex2(0.5)).toBe('80');
        expect(percentToHex2(1.5)).toBe('FF');
    });

    it('omits the timestamp from source strings when the timestamp is 0', () => {
        expect(sourceString('episode.ass', 0)).toBe('episode.ass');
        expect(sourceString('episode.ass', 8_250)).toBe('episode.ass (00h00m08.3s)');
    });
});

describe('seekWithNudge', () => {
    it('returns the exact target timestamp when the media lands on it', () => {
        const media = { currentTime: 0, duration: 100 } as HTMLMediaElement;
        expect(seekWithNudge(media, 5)).toBe(5);
    });

    it('nudges forward when the media lands short', () => {
        let storedTime = 0;
        let writes = 0;
        const media = {
            duration: 10,
            get currentTime() {
                return storedTime;
            },
            set currentTime(value: number) {
                writes += 1;
                storedTime = writes === 1 ? 4.995 : value;
            },
        } as HTMLMediaElement;

        expect(seekWithNudge(media, 6)).toBeCloseTo(5.005, 5);
    });

    it('caps a forward nudge at the media duration', () => {
        let storedTime = 0;
        let writes = 0;
        const media = {
            duration: 10,
            get currentTime() {
                return storedTime;
            },
            set currentTime(value: number) {
                writes += 1;
                storedTime = writes === 1 ? 9.995 : value;
            },
        } as HTMLMediaElement;

        expect(seekWithNudge(media, 10)).toBe(10);
    });

    it('clamps negative seeks before updating the media element', () => {
        const media = { currentTime: 10, duration: 100 } as HTMLMediaElement;

        expect(seekWithNudge(media, -1)).toBe(0);
        expect(media.currentTime).toBe(0);
    });

    it('clamps seeks past the media duration before updating the media element', () => {
        const media = { currentTime: 10, duration: 100 } as HTMLMediaElement;

        expect(seekWithNudge(media, 101)).toBe(100);
        expect(media.currentTime).toBe(100);
    });
});

describe('batch helpers', () => {
    it('inBatches handles 0, 1, and 2 items in order and reports progress', async () => {
        const seen: number[][] = [];
        const progress: Array<{ current: number; total: number }> = [];

        await inBatches([], async (batch) => {
            seen.push(batch);
        });
        await inBatches(
            [1],
            async (batch) => {
                seen.push(batch);
            },
            { batchSize: 1 }
        );
        await inBatches(
            [1, 2],
            async (batch) => {
                seen.push(batch);
            },
            {
                batchSize: 0,
                statusUpdates: async ({ current, total }) => {
                    progress.push({ current, total });
                },
            }
        );

        expect(seen).toEqual([[1], [1], [2]]);
        expect(progress).toEqual([
            { current: 1, total: 2 },
            { current: 2, total: 2 },
        ]);
    });

    it('fromBatches handles 0, 1, and 2 items while flattening results in order', async () => {
        expect(await fromBatches([], async (batch) => batch.map(String), { batchSize: 2 })).toEqual([]);
        expect(await fromBatches([1], async (batch) => batch.map(String), { batchSize: 1 })).toEqual(['1']);
        expect(await fromBatches([1, 2], async (batch) => batch.map((value) => value * 10), { batchSize: 1 })).toEqual([
            10, 20,
        ]);
    });

    it('mapAsync preserves input order for 0, 1, and 2 items', async () => {
        expect(await mapAsync([], async (value: number) => value, { batchSize: 2 })).toEqual([]);
        expect(await mapAsync([1], async (value) => value + 1, { batchSize: 1 })).toEqual([2]);
        expect(
            await mapAsync(
                [1, 2],
                async (value) => {
                    await Promise.resolve();
                    return value * 2;
                },
                { batchSize: 2 }
            )
        ).toEqual([2, 4]);
    });

    it('filterAsync preserves input order while filtering through async batches', async () => {
        const progress: Progress[] = [];

        await expect(
            filterAsync([1, 2, 3, 4], async (value) => value % 2 === 0, {
                batchSize: 2,
                statusUpdates: async (update) => {
                    progress.push(update);
                },
            })
        ).resolves.toEqual([2, 4]);
        expect(progress.map(({ current, total }) => ({ current, total }))).toEqual([
            { current: 2, total: 4 },
            { current: 4, total: 4 },
        ]);
    });
});

describe('ensureStoragePersisted', () => {
    const originalStorage = navigator.storage;

    afterEach(() => {
        jest.restoreAllMocks();
        Object.defineProperty(navigator, 'storage', {
            configurable: true,
            value: originalStorage,
        });
    });

    it('returns early when the storage API is unavailable', async () => {
        Object.defineProperty(navigator, 'storage', {
            configurable: true,
            value: undefined,
        });

        await expect(ensureStoragePersisted()).resolves.toBeUndefined();
    });

    it('returns early when storage is already persisted', async () => {
        Object.defineProperty(navigator, 'storage', {
            configurable: true,
            value: {
                persist: async () => true,
                persisted: async () => true,
            },
        });

        await expect(ensureStoragePersisted()).resolves.toBe(true);
    });

    it('warns when requesting persistence fails', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        Object.defineProperty(navigator, 'storage', {
            configurable: true,
            value: {
                persist: async () => false,
                persisted: async () => false,
            },
        });

        await expect(ensureStoragePersisted()).resolves.toBe(false);
        expect(warn).toHaveBeenCalledWith('Storage could not be persisted, data may be cleared by the browser');
    });
});

describe('iterateOverStringInBlocks', () => {
    it('iterates over a full gap when there are 0 blocks', () => {
        const calls: Array<[number, number, boolean]> = [];

        iterateOverStringInBlocks(
            'abcd',
            () => undefined,
            (left, right, block) => {
                calls.push([left, right, block !== undefined]);
            }
        );

        expect(calls).toEqual([[0, 4, false]]);
    });

    it('iterates over 1 block and surrounding gaps', () => {
        const calls: Array<[number, number, string | undefined]> = [];

        iterateOverStringInBlocks(
            'abcdef',
            (_, index) => (index === 0 ? { pos: [2, 4], label: 'block' } : undefined),
            (left, right, block) => {
                calls.push([left, right, block?.label]);
            }
        );

        expect(calls).toEqual([
            [0, 2, undefined],
            [2, 4, 'block'],
            [4, 6, undefined],
        ]);
    });

    it('iterates over 2 adjacent blocks without inventing extra gaps', () => {
        const calls: Array<[number, number, string | undefined]> = [];

        iterateOverStringInBlocks(
            'abcdef',
            (_, index) => {
                if (index === 0) return { pos: [0, 2], label: 'a' };
                if (index === 1) return { pos: [2, 4], label: 'b' };
                return undefined;
            },
            (left, right, block) => {
                calls.push([left, right, block?.label]);
            }
        );

        expect(calls).toEqual([
            [0, 2, 'a'],
            [2, 4, 'b'],
            [4, 6, undefined],
        ]);
    });
});

describe('areTokenizationsEqual', () => {
    const tokenization = {
        error: false,
        tokens: [
            {
                pos: [0, 1],
                status: 'known',
                states: ['ignored'],
                readings: [{ pos: [0, 1], reading: 'a' }],
                frequency: 1,
                groupingKey: 'group-a',
            },
        ],
    } as any;

    it('handles undefined values', () => {
        expect(areTokenizationsEqual(undefined, undefined)).toBe(true);
        expect(areTokenizationsEqual(tokenization, undefined)).toBe(false);
    });

    it('returns true for structurally equal tokenizations', () => {
        expect(
            areTokenizationsEqual(tokenization, {
                ...tokenization,
                tokens: tokenization.tokens.map((token: any) => ({
                    ...token,
                    pos: [...token.pos],
                    states: [...token.states],
                    readings: token.readings.map((reading: any) => ({ ...reading, pos: [...reading.pos] })),
                })),
            })
        ).toBe(true);
    });

    it('detects differences in tokenization error state', () => {
        expect(areTokenizationsEqual(tokenization, { ...tokenization, error: true })).toBe(false);
    });

    it('detects differences in token grouping keys', () => {
        expect(
            areTokenizationsEqual(tokenization, {
                ...tokenization,
                tokens: [{ ...tokenization.tokens[0], groupingKey: 'group-b' }],
            })
        ).toBe(false);
    });

    it('detects differences in token readings', () => {
        expect(
            areTokenizationsEqual(tokenization, {
                ...tokenization,
                tokens: [{ ...tokenization.tokens[0], readings: [{ pos: [0, 1], reading: 'b' }] }],
            })
        ).toBe(false);
    });
});

describe('AsyncSemaphore', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('validates constructor options', () => {
        expect(() => new AsyncSemaphore({ permits: 0 })).toThrow('Permits count must be positive');
        expect(() => new AsyncSemaphore({ permits: 1, lifetimeMs: -1 })).toThrow('Lifetime must be positive');
    });

    it('acquires immediately when permits are available', async () => {
        const semaphore = new AsyncSemaphore({ permits: 1 });
        await expect(semaphore.acquire()).resolves.toBe(1);
    });

    it('preserves FIFO order within the same priority', async () => {
        const semaphore = new AsyncSemaphore({ permits: 1 });
        const first = await semaphore.acquire();
        const secondPromise = semaphore.acquire();
        const thirdPromise = semaphore.acquire();

        semaphore.release(first);
        const second = await secondPromise;
        semaphore.release(second);
        const third = await thirdPromise;

        expect([second, third]).toEqual([2, 3]);
    });

    it('favors higher priorities when releasing permits', async () => {
        const semaphore = new AsyncSemaphore({ permits: 1 });
        const first = await semaphore.acquire();
        const lowPriorityPromise = semaphore.acquire(0);
        const highPriorityPromise = semaphore.acquire(2);

        semaphore.release(first);
        const highPriority = await highPriorityPromise;
        semaphore.release(highPriority);
        const lowPriority = await lowPriorityPromise;

        expect(highPriority).toBe(2);
        expect(lowPriority).toBe(3);
    });

    it('ignores duplicate releases without granting an extra permit', async () => {
        const semaphore = new AsyncSemaphore({ permits: 1 });
        const first = await semaphore.acquire();
        const queued = semaphore.acquire();

        semaphore.release(first);
        semaphore.release(first);
        const second = await queued;
        const next = semaphore.acquire();

        let nextAcquired = false;
        void next.then(() => {
            nextAcquired = true;
        });
        await Promise.resolve();

        expect(nextAcquired).toBe(false);
        semaphore.release(second);
        await expect(next).resolves.toBe(3);
        expect(second).toBe(2);
    });

    it('auto-releases an acquired permit after its lifetime expires', async () => {
        const semaphore = new AsyncSemaphore({ permits: 1, lifetimeMs: 1000 });
        await semaphore.acquire();
        const queued = semaphore.acquire();

        let queuedAcquired = false;
        void queued.then(() => {
            queuedAcquired = true;
        });
        await jest.advanceTimersByTimeAsync(999);
        expect(queuedAcquired).toBe(false);

        await jest.advanceTimersByTimeAsync(1);
        await expect(queued).resolves.toBe(2);
    });
});

// Regression test for https://github.com/asbplayer/asbplayer/issues/1064:
// cues sharing a start time (e.g. Netflix splitting one line into multiple cues)
// can be returned out of source order by SubtitleCollection, so display code
// must fall back to source index to keep cues in the order they were authored.
it('sorts subtitles by track, falling back to source index for ties', () => {
    const cues = [
        { track: 0, index: 1 },
        { track: 0, index: 0 },
    ];

    expect([...cues].sort(compareSubtitlesForDisplay)).toEqual([
        { track: 0, index: 0 },
        { track: 0, index: 1 },
    ]);
});

it('sorts subtitles by track first, regardless of source index', () => {
    const cues = [
        { track: 1, index: 0 },
        { track: 0, index: 1 },
    ];

    expect([...cues].sort(compareSubtitlesForDisplay)).toEqual([
        { track: 0, index: 1 },
        { track: 1, index: 0 },
    ]);
});
