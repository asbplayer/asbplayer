import {
    type AutoPausePreferenceEdge,
    autoPausePreferenceForCheckboxChange,
    calculateSeekableTracksValue,
    isTrackSeekable,
    updateSeekableTracksValue,
} from '.';
import { describe, expect, it } from '@jest/globals';
import { AutoPausePreference } from '../src/model';

describe('autoPausePreferenceForCheckboxChange', () => {
    it.each<{
        preference: AutoPausePreference;
        edge: AutoPausePreferenceEdge;
        checked: boolean;
        expected: AutoPausePreference;
    }>([
        {
            preference: AutoPausePreference.atStart,
            edge: AutoPausePreference.atStart,
            checked: false,
            expected: AutoPausePreference.atEnd,
        },
        {
            preference: AutoPausePreference.atEnd,
            edge: AutoPausePreference.atEnd,
            checked: false,
            expected: AutoPausePreference.atStart,
        },
        {
            preference: AutoPausePreference.atStartAndEnd,
            edge: AutoPausePreference.atStart,
            checked: false,
            expected: AutoPausePreference.atEnd,
        },
        {
            preference: AutoPausePreference.atStartAndEnd,
            edge: AutoPausePreference.atEnd,
            checked: false,
            expected: AutoPausePreference.atStart,
        },
        {
            preference: AutoPausePreference.atStart,
            edge: AutoPausePreference.atEnd,
            checked: true,
            expected: AutoPausePreference.atStartAndEnd,
        },
        {
            preference: AutoPausePreference.atEnd,
            edge: AutoPausePreference.atStart,
            checked: true,
            expected: AutoPausePreference.atStartAndEnd,
        },
    ])('maps $preference when edge $edge becomes $checked to $expected', ({ preference, edge, checked, expected }) => {
        expect(autoPausePreferenceForCheckboxChange(preference, edge, checked)).toBe(expected);
    });
});

it('can determine seekable tracks correctly', () => {
    expect(isTrackSeekable(0, 0)).toBe(false);
    expect(isTrackSeekable(0, 1)).toBe(false);
    expect(isTrackSeekable(0, 2)).toBe(false);

    expect(isTrackSeekable(1, 0)).toBe(true);
    expect(isTrackSeekable(1, 1)).toBe(false);
    expect(isTrackSeekable(1, 2)).toBe(false);

    expect(isTrackSeekable(2, 0)).toBe(false);
    expect(isTrackSeekable(2, 1)).toBe(true);
    expect(isTrackSeekable(2, 2)).toBe(false);

    expect(isTrackSeekable(3, 0)).toBe(true);
    expect(isTrackSeekable(3, 1)).toBe(true);
    expect(isTrackSeekable(3, 2)).toBe(false);

    expect(isTrackSeekable(4, 0)).toBe(false);
    expect(isTrackSeekable(4, 1)).toBe(false);
    expect(isTrackSeekable(4, 2)).toBe(true);
});

it('can calculate seekable tracks correctly', () => {
    const val = calculateSeekableTracksValue([0]);
    expect(isTrackSeekable(val, 0)).toBe(true);
    expect(isTrackSeekable(val, 1)).toBe(false);
    expect(isTrackSeekable(val, 2)).toBe(false);

    const val2 = calculateSeekableTracksValue([1, 2]);
    expect(isTrackSeekable(val2, 0)).toBe(false);
    expect(isTrackSeekable(val2, 1)).toBe(true);
    expect(isTrackSeekable(val2, 2)).toBe(true);
});

it('can update seekable tracks correctly', () => {
    expect(updateSeekableTracksValue(calculateSeekableTracksValue([1, 2]), 1, false)).toEqual(
        calculateSeekableTracksValue([2])
    );
    expect(updateSeekableTracksValue(calculateSeekableTracksValue([1, 2]), 1, true)).toEqual(
        calculateSeekableTracksValue([1, 2])
    );
    expect(updateSeekableTracksValue(calculateSeekableTracksValue([1, 2]), 0, true)).toEqual(
        calculateSeekableTracksValue([0, 1, 2])
    );
});
