import { adjacentSubtitle, findCurrentSubtitle, findAllCurrentSubtitles } from './key-binder';
import { SubtitleModel } from '../src/model';

function subtitle(text: string, start: number, end: number, track: number = 0): SubtitleModel {
    return {
        text,
        start,
        end,
        originalStart: start,
        originalEnd: end,
        track,
    } as SubtitleModel;
}

function expectSubtitleAt(index: number | null, subtitles: SubtitleModel[], expectedText: string) {
    expect(index).not.toBeNull();
    expect(subtitles[index!]?.text).toBe(expectedText);
}

describe('findCurrentSubtitle', () => {
    it('finds subtitle in the middle of the array', () => {
        const subtitles = [
            subtitle('First', 1000, 2000, 0),
            subtitle('Second', 3000, 4000, 0),
            subtitle('Third', 5000, 6000, 0),
            subtitle('Fourth', 7000, 8000, 0),
            subtitle('Fifth', 9000, 10000, 0),
        ];

        const foundIndex = findCurrentSubtitle(5500, subtitles);
        expectSubtitleAt(foundIndex, subtitles, 'Third');
    });

    it('finds subtitle at the beginning of the array', () => {
        const subtitles = [
            subtitle('First', 1000, 2000, 0),
            subtitle('Second', 3000, 4000, 0),
            subtitle('Third', 5000, 6000, 0),
        ];

        const foundIndex = findCurrentSubtitle(1500, subtitles);
        expectSubtitleAt(foundIndex, subtitles, 'First');
    });

    it('finds subtitle at the end of the array', () => {
        const subtitles = [
            subtitle('First', 1000, 2000, 0),
            subtitle('Second', 3000, 4000, 0),
            subtitle('Third', 5000, 6000, 0),
        ];

        const foundIndex = findCurrentSubtitle(5500, subtitles);
        expectSubtitleAt(foundIndex, subtitles, 'Third');
    });

    it('returns null when time is before all subtitles', () => {
        const subtitles = [
            subtitle('First', 1000, 2000, 0),
            subtitle('Second', 3000, 4000, 0),
        ];

        const foundIndex = findCurrentSubtitle(500, subtitles);
        expect(foundIndex).toBeNull();
    });

    it('returns null when time is after all subtitles', () => {
        const subtitles = [
            subtitle('First', 1000, 2000, 0),
            subtitle('Second', 3000, 4000, 0),
        ];

        const foundIndex = findCurrentSubtitle(5000, subtitles);
        expect(foundIndex).toBeNull();
    });

    it('returns null when time is in a gap between subtitles', () => {
        const subtitles = [
            subtitle('First', 1000, 2000, 0),
            subtitle('Second', 3000, 4000, 0),
            subtitle('Third', 5000, 6000, 0),
        ];

        const foundIndex = findCurrentSubtitle(2500, subtitles);
        expect(foundIndex).toBeNull();
    });

    it('returns null for empty array', () => {
        const foundIndex = findCurrentSubtitle(1000, []);
        expect(foundIndex).toBeNull();
    });

    it('finds subtitle when time equals start time', () => {
        const subtitles = [
            subtitle('First', 1000, 2000, 0),
            subtitle('Second', 3000, 4000, 0),
        ];

        const foundIndex = findCurrentSubtitle(3000, subtitles);
        expectSubtitleAt(foundIndex, subtitles, 'Second');
    });

    it('returns null when time equals end time (exclusive)', () => {
        const subtitles = [
            subtitle('First', 1000, 2000, 0),
            subtitle('Second', 3000, 4000, 0),
        ];

        const foundIndex = findCurrentSubtitle(2000, subtitles);
        expect(foundIndex).toBeNull();
    });

    it('finds correct subtitle with multiple tracks at same time', () => {
        const subtitles = [
            subtitle('Track 1 - First', 1000, 2000, 0),
            subtitle('Track 2 - First', 1001, 2001, 1),
            subtitle('Track 1 - Second', 3000, 4000, 0),
            subtitle('Track 2 - Second', 3001, 4001, 1),
        ];

        const foundIndex = findCurrentSubtitle(3500, subtitles);
        // Should find one of the subtitles at this time (either index 2 or 3)
        expect(foundIndex).not.toBeNull();
        expect(foundIndex).toBeGreaterThanOrEqual(2);
        expect(foundIndex).toBeLessThanOrEqual(3);
        expect(subtitles[foundIndex!].start).toBeLessThanOrEqual(3500);
        expect(subtitles[foundIndex!].end).toBeGreaterThan(3500);
    });

    it('finds first matching subtitle when multiple overlap', () => {
        const subtitles = [
            subtitle('Track 1', 629295, 632129, 0),
            subtitle('Track 2', 629296, 632130, 1),
            subtitle('Track 3', 631130, 635343, 0),
            subtitle('Track 4', 631131, 635344, 1),
        ];

        // Time 631787 is inside both Track 1 (629295-632129) and Track 3 (631130-635343)
        // Binary search will find one of the overlapping subtitles
        const foundIndex = findCurrentSubtitle(631787, subtitles);
        expect(foundIndex).not.toBeNull();
        expect(foundIndex).toBeGreaterThanOrEqual(0);
        expect(subtitles[foundIndex!].start).toBeLessThanOrEqual(631787);
        expect(subtitles[foundIndex!].end).toBeGreaterThan(631787);
    });

    it('handles large array efficiently', () => {
        // Create 1000 subtitles
        const subtitles = [];
        for (let i = 0; i < 1000; i++) {
            subtitles.push(subtitle(`Subtitle ${i}`, i * 1000, (i + 1) * 1000, 0));
        }

        const foundIndex = findCurrentSubtitle(500500, subtitles);
        expectSubtitleAt(foundIndex, subtitles, 'Subtitle 500');
    });

    it('works with single subtitle', () => {
        const subtitles = [subtitle('Only', 1000, 2000, 0)];

        const foundIndex = findCurrentSubtitle(1500, subtitles);
        expectSubtitleAt(foundIndex, subtitles, 'Only');

        expect(findCurrentSubtitle(500, subtitles)).toBeNull();
        expect(findCurrentSubtitle(2500, subtitles)).toBeNull();
    });
});

describe('findAllCurrentSubtitles', () => {
    it('returns single subtitle when only one is active', () => {
        const subtitles = [
            subtitle('First', 1000, 2000, 0),
            subtitle('Second', 3000, 4000, 0),
            subtitle('Third', 5000, 6000, 0),
        ];

        const indices = findAllCurrentSubtitles(3500, subtitles);
        expect(indices).toEqual([1]);
        expectSubtitleAt(indices[0], subtitles, 'Second');
    });

    it('returns multiple subtitles when tracks overlap', () => {
        const subtitles = [
            subtitle('Track 1 - First', 1000, 2000, 0),
            subtitle('Track 2 - First', 1001, 2001, 1),
            subtitle('Track 1 - Second', 3000, 4000, 0),
            subtitle('Track 2 - Second', 3001, 4001, 1),
        ];

        const indices = findAllCurrentSubtitles(3500, subtitles);
        expect(indices).toEqual([2, 3]);
        expectSubtitleAt(indices[0], subtitles, 'Track 1 - Second');
        expectSubtitleAt(indices[1], subtitles, 'Track 2 - Second');
    });

    it('returns all overlapping subtitles in real overlap scenario', () => {
        const subtitles = [
            subtitle('Track 1 - First', 629295, 632129, 0),
            subtitle('Track 2 - First', 629296, 632130, 1),
            subtitle('Track 1 - Second', 631130, 635343, 0),
            subtitle('Track 2 - Second', 631131, 635344, 1),
        ];

        // At time 631787, both "First" and "Second" subtitles are still active
        const indices = findAllCurrentSubtitles(631787, subtitles);
        expect(indices.length).toBe(4);
        expect(indices).toEqual([0, 1, 2, 3]);
    });

    it('returns empty array when no subtitle is active', () => {
        const subtitles = [
            subtitle('First', 1000, 2000, 0),
            subtitle('Second', 3000, 4000, 0),
        ];

        const indices = findAllCurrentSubtitles(2500, subtitles);
        expect(indices).toEqual([]);
    });

    it('returns empty array for empty subtitle list', () => {
        const indices = findAllCurrentSubtitles(1000, []);
        expect(indices).toEqual([]);
    });

    it('returns all three tracks when they overlap', () => {
        const subtitles = [
            subtitle('Track 1', 1000, 2000, 0),
            subtitle('Track 2', 1001, 2001, 1),
            subtitle('Track 3', 1002, 2002, 2),
        ];

        const indices = findAllCurrentSubtitles(1500, subtitles);
        expect(indices).toEqual([0, 1, 2]);
    });

    it('returns only partially overlapping subtitles', () => {
        const subtitles = [
            subtitle('First', 1000, 2000, 0),
            subtitle('Second', 1500, 2500, 0),
            subtitle('Third', 3000, 4000, 0),
        ];

        // At 1750, only First and Second overlap
        const indices = findAllCurrentSubtitles(1750, subtitles);
        expect(indices).toEqual([0, 1]);
        expectSubtitleAt(indices[0], subtitles, 'First');
        expectSubtitleAt(indices[1], subtitles, 'Second');
    });

    it('returns subtitles in order even when binary search finds middle one', () => {
        const subtitles = [
            subtitle('Track 1', 1000, 3000, 0),
            subtitle('Track 2', 1500, 2500, 1),
            subtitle('Track 3', 2000, 4000, 2),
        ];

        // All three overlap at time 2250
        const indices = findAllCurrentSubtitles(2250, subtitles);
        expect(indices).toEqual([0, 1, 2]);
    });
});

describe('adjacentSubtitle', () => {
    describe('seekPreviousSubtitle', () => {
        it('returns previous subtitle skipping same time group', () => {
            const subtitles = [
                subtitle('Track 1 - First', 1000, 2000, 0),
                subtitle('Track 2 - First', 1001, 2001, 1),
                subtitle('Track 1 - Second', 3000, 4000, 0),
                subtitle('Track 2 - Second', 3001, 4001, 1),
                subtitle('Track 1 - Third', 5000, 6000, 0),
                subtitle('Track 2 - Third', 5001, 6001, 1),
            ];

            // Currently at Track 1 - Third (5000-6000)
            const result = adjacentSubtitle(false, 5500, subtitles);

            // Should skip Track 2 - Third (within 100ms threshold) and return Track 2 - Second
            // which is the last subtitle before the current time group
            expect(result?.start).toBeLessThan(5000 - 100);
        });

        it('skips subtitles that start at roughly the same time with non-overlapping subtitles', () => {
            const subtitles = [
                subtitle('Track 1 - First', 629295, 630000, 0),
                subtitle('Track 2 - First', 629296, 630001, 1),
                subtitle('Track 1 - Second', 631130, 635343, 0),
                subtitle('Track 2 - Second', 631131, 635344, 1),
            ];

            // Currently at time 631787 inside Track 1/2 - Second
            const result = adjacentSubtitle(false, 631787, subtitles);

            // Should skip Track 2 - Second (within 100ms of 631130) and return one from the First group
            expect(result?.start).toBeLessThan(631130 - 100);
            expect(result?.text).toContain('First');
        });

        it('handles case where only one track has a subtitle', () => {
            const subtitles = [
                subtitle('Track 1 - First', 1000, 2000, 0),
                subtitle('Track 2 - First', 1001, 2001, 1),
                subtitle('Track 2 - Alone', 3000, 4000, 1), // Only track 2
                subtitle('Track 1 - Second', 5000, 6000, 0),
                subtitle('Track 2 - Second', 5001, 6001, 1),
            ];

            // Currently at Track 1 - Second (5000-6000)
            const result = adjacentSubtitle(false, 5500, subtitles);

            // Should return Track 2 - Alone since it's in a different time group
            expect(result).toEqual(subtitle('Track 2 - Alone', 3000, 4000, 1));
        });

        it('returns last subtitle before time when not inside any subtitle', () => {
            const subtitles = [
                subtitle('First', 1000, 2000, 0),
                subtitle('Second', 3000, 4000, 0),
                subtitle('Third', 5000, 6000, 0),
            ];

            // Currently at 4500 (between Second and Third)
            const result = adjacentSubtitle(false, 4500, subtitles);

            // Should return Second
            expect(result).toEqual(subtitle('Second', 3000, 4000, 0));
        });

        it('returns null when at the beginning', () => {
            const subtitles = [
                subtitle('First', 1000, 2000, 0),
                subtitle('Second', 3000, 4000, 0),
            ];

            // Currently at First
            const result = adjacentSubtitle(false, 1500, subtitles);

            expect(result).toBeNull();
        });

        it('returns null when time is before all subtitles', () => {
            const subtitles = [
                subtitle('First', 1000, 2000, 0),
                subtitle('Second', 3000, 4000, 0),
            ];

            const result = adjacentSubtitle(false, 500, subtitles);

            expect(result).toBeNull();
        });

        it('handles three tracks with same start times', () => {
            const subtitles = [
                subtitle('Track 1 - First', 1000, 2000, 0),
                subtitle('Track 2 - First', 1001, 2001, 1),
                subtitle('Track 3 - First', 1002, 2002, 2),
                subtitle('Track 1 - Second', 3000, 4000, 0),
                subtitle('Track 2 - Second', 3001, 4001, 1),
                subtitle('Track 3 - Second', 3002, 4002, 2),
            ];

            // Currently at Track 2 - Second
            const result = adjacentSubtitle(false, 3500, subtitles);

            // Should skip all three tracks from first time group and return any from first group
            expect(result?.start).toBeLessThan(2003);
        });
    });

    describe('seekNextSubtitle', () => {
        it('returns next subtitle with minimum time difference', () => {
            const subtitles = [
                subtitle('First', 1000, 2000, 0),
                subtitle('Second', 3000, 4000, 0),
                subtitle('Third', 5000, 6000, 0),
            ];

            // Currently at 2500
            const result = adjacentSubtitle(true, 2500, subtitles);

            // Should return Second
            expect(result).toEqual(subtitle('Second', 3000, 4000, 0));
        });

        it('returns earliest next subtitle when multiple tracks exist', () => {
            const subtitles = [
                subtitle('Track 1 - First', 1000, 2000, 0),
                subtitle('Track 2 - First', 1001, 2001, 1),
                subtitle('Track 1 - Second', 3000, 4000, 0),
                subtitle('Track 2 - Second', 3001, 4001, 1),
            ];

            // Currently at 2500
            const result = adjacentSubtitle(true, 2500, subtitles);

            // Should return the earliest next subtitle (Track 1 - Second)
            expect(result).toEqual(subtitle('Track 1 - Second', 3000, 4000, 0));
        });

        it('returns null when at the end', () => {
            const subtitles = [
                subtitle('First', 1000, 2000, 0),
                subtitle('Second', 3000, 4000, 0),
            ];

            // Currently after all subtitles
            const result = adjacentSubtitle(true, 5000, subtitles);

            expect(result).toBeNull();
        });

        it('returns null for empty subtitle list', () => {
            const result = adjacentSubtitle(true, 1000, []);

            expect(result).toBeNull();
        });
    });

    describe('edge cases', () => {
        it('handles empty subtitle array', () => {
            expect(adjacentSubtitle(false, 1000, [])).toBeNull();
            expect(adjacentSubtitle(true, 1000, [])).toBeNull();
        });

        it('handles single subtitle', () => {
            const subtitles = [subtitle('Only', 1000, 2000, 0)];

            // Before subtitle
            expect(adjacentSubtitle(false, 500, subtitles)).toBeNull();
            expect(adjacentSubtitle(true, 500, subtitles)).toEqual(subtitle('Only', 1000, 2000, 0));

            // Inside subtitle
            expect(adjacentSubtitle(false, 1500, subtitles)).toBeNull();

            // After subtitle
            expect(adjacentSubtitle(false, 2500, subtitles)).toEqual(subtitle('Only', 1000, 2000, 0));
            expect(adjacentSubtitle(true, 2500, subtitles)).toBeNull();
        });

        it('handles subtitles with exact same start time (0ms difference)', () => {
            const subtitles = [
                subtitle('Track 1 - First', 1000, 2000, 0),
                subtitle('Track 2 - First', 1000, 2000, 1), // Exact same start
                subtitle('Track 1 - Second', 3000, 4000, 0),
                subtitle('Track 2 - Second', 3000, 4000, 1), // Exact same start
            ];

            // Currently at Track 1 - Second
            const result = adjacentSubtitle(false, 3500, subtitles);

            // Should skip both tracks and return one from first group
            expect(result?.start).toBe(1000);
        });
    });
});
