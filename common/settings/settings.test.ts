import {
    areDictionaryPlaybackConfigsEqual,
    dictionaryPlaybackGroupSettingsEnabled,
    dictionaryPlaybackFeatures,
    autoPausePreferenceForCheckboxChange,
    calculateSeekableTracksValue,
    effectiveSubtitleListCustomization,
    isTrackSeekable,
    maxSubtitlesWidth,
    subtitlesWidthCssValue,
    SubtitleListTimestampDisplay,
    updateSeekableTracksValue,
} from '.';
import type { AutoPausePreferenceEdge } from '.';
import { describe, expect, it } from '@jest/globals';
import { AutoPausePreference } from '@project/common/src/model';
import { defaultSettings } from '@project/common/settings/settings-provider';

it('compares dictionary playback fields by value regardless of object key order', () => {
    const config = defaultSettings.dictionaryTracks[0].dictionaryPlaybackConfig;
    const reorderFeature = (feature: typeof config.autoPause) => ({
        onStates: feature.onStates.map((state) => ({ ...state })),
        onStatuses: feature.onStatuses.map((status) => ({ ...status })),
        rules: { maxFrequency: 0, minFrequency: 0, maxWords: 0, minWords: 0 },
    });
    const reordered = {
        wordVisibility: {
            wholeSubtitleMatchThreshold: config.wordVisibility.wholeSubtitleMatchThreshold,
            hideWordsIndividuallyUntilThreshold: config.wordVisibility.hideWordsIndividuallyUntilThreshold,
            ...reorderFeature(config.wordVisibility),
        },
        repeat: reorderFeature(config.repeat),
        fastForward: {
            rateByComprehension: { ...config.fastForward.rateByComprehension },
            ...reorderFeature(config.fastForward),
        },
        condensed: reorderFeature(config.condensed),
        autoPause: reorderFeature(config.autoPause),
    };
    expect(areDictionaryPlaybackConfigsEqual(config, reordered)).toBe(true);
    reordered.fastForward.rateByComprehension.enabled = true;
    expect(areDictionaryPlaybackConfigsEqual(config, reordered)).toBe(false);
    reordered.fastForward.rateByComprehension.enabled = false;
    reordered.repeat.rules.maxFrequency = 1;
    expect(areDictionaryPlaybackConfigsEqual(config, reordered)).toBe(false);
    reordered.repeat.rules.maxFrequency = 0;
    reordered.repeat.rules.minFrequency = 1;
    expect(areDictionaryPlaybackConfigsEqual(config, reordered)).toBe(false);
    reordered.repeat.rules.minFrequency = 0;
    reordered.autoPause.rules.minWords = 2;
    expect(areDictionaryPlaybackConfigsEqual(config, reordered)).toBe(false);
    reordered.autoPause.rules.minWords = 0;
    reordered.wordVisibility.wholeSubtitleMatchThreshold = 0.5;
    expect(areDictionaryPlaybackConfigsEqual(config, reordered)).toBe(false);
    reordered.wordVisibility.wholeSubtitleMatchThreshold = 1;
    reordered.wordVisibility.hideWordsIndividuallyUntilThreshold = false;
    expect(areDictionaryPlaybackConfigsEqual(config, reordered)).toBe(false);
    reordered.wordVisibility.hideWordsIndividuallyUntilThreshold = true;
    reordered.autoPause.onStatuses[0].enabled = true;
    expect(areDictionaryPlaybackConfigsEqual(config, reordered)).toBe(false);
    reordered.autoPause.onStatuses[0].enabled = false;
    reordered.repeat.onStates[0].enabled = true;
    expect(areDictionaryPlaybackConfigsEqual(config, reordered)).toBe(false);
});

it('activates word filters only through selected statuses or states, independently of saved limits', () => {
    const config = JSON.parse(JSON.stringify(defaultSettings.dictionaryTracks[0].dictionaryPlaybackConfig));
    for (const feature of dictionaryPlaybackFeatures) {
        config[feature].rules.minWords = 1;
        config[feature].rules.maxWords = 2;
        config[feature].rules.minFrequency = 10;
        config[feature].rules.maxFrequency = 1000;
        config.wordVisibility.wholeSubtitleMatchThreshold = 0.8;
        expect(dictionaryPlaybackGroupSettingsEnabled(config, feature)).toBe(false);
        config[feature].onStatuses[0].enabled = true;
        expect(dictionaryPlaybackGroupSettingsEnabled(config, feature)).toBe(true);
        config[feature].onStatuses[0].enabled = false;
        config[feature].onStates[0].enabled = true;
        expect(dictionaryPlaybackGroupSettingsEnabled(config, feature)).toBe(true);
        config[feature].onStates[0].enabled = false;
    }
    config.fastForward.rateByComprehension.enabled = true;
    expect(dictionaryPlaybackGroupSettingsEnabled(config, 'fastForward')).toBe(true);
});

describe('effectiveSubtitleListCustomization', () => {
    const configured = {
        showSubtitleListMiningButton: false,
        subtitleListTimestampDisplay: SubtitleListTimestampDisplay.startAndEnd,
    };

    it('uses the configured values when customization is supported', () => {
        expect(effectiveSubtitleListCustomization(configured, true)).toEqual({
            showMiningButton: false,
            timestampDisplay: SubtitleListTimestampDisplay.startAndEnd,
        });
    });

    it('uses legacy defaults when customization is not supported', () => {
        expect(effectiveSubtitleListCustomization(configured, false)).toEqual({
            showMiningButton: true,
            timestampDisplay: SubtitleListTimestampDisplay.start,
        });
    });
});

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
        expect(autoPausePreferenceForCheckboxChange(preference, edge, { checked })).toBe(expected);
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

describe('subtitlesWidthCssValue', () => {
    it('leaves the width automatic when it is -1', () => {
        expect(subtitlesWidthCssValue({ subtitlesWidth: -1, subtitlesWidthUnit: '%' })).toBeUndefined();
        expect(subtitlesWidthCssValue({ subtitlesWidth: -1, subtitlesWidthUnit: 'px' })).toBeUndefined();
    });

    it('renders percentages and pixels', () => {
        expect(subtitlesWidthCssValue({ subtitlesWidth: 80, subtitlesWidthUnit: '%' })).toBe('80%');
        expect(subtitlesWidthCssValue({ subtitlesWidth: 800, subtitlesWidthUnit: 'px' })).toBe('800px');
    });
});

describe('subtitlesWidth bounds', () => {
    it('caps percentages at 100 and pixels at a sanity limit', () => {
        expect(maxSubtitlesWidth('%')).toBe(100);
        expect(maxSubtitlesWidth('px')).toBe(10000);
    });
});
