import { beforeEach, describe, expect, it } from '@jest/globals';
import PlaybackPreferenceController from './playback-preference-controller';

beforeEach(() => {
    localStorage.clear();
});

describe('PlaybackPreferenceController', () => {
    it('uses user-facing defaults when storage is empty', () => {
        const preferences = new PlaybackPreferenceController();

        expect(preferences.volume).toBe(100);
        expect(preferences.theaterMode).toBe(false);
        expect(preferences.hideSubtitleList).toBe(false);
        expect(preferences.displaySubtitles).toBe(true);
        expect(preferences.subtitlePlayerWidth).toBeUndefined();
    });

    it('persists scalar playback preferences with their expected storage representation', () => {
        const preferences = new PlaybackPreferenceController();

        preferences.volume = 65;
        preferences.theaterMode = true;
        preferences.hideSubtitleList = true;
        preferences.displaySubtitles = false;
        preferences.subtitlePlayerWidth = 720;

        expect(preferences.volume).toBe(65);
        expect(preferences.theaterMode).toBe(true);
        expect(preferences.hideSubtitleList).toBe(true);
        expect(preferences.displaySubtitles).toBe(false);
        expect(preferences.subtitlePlayerWidth).toBe(720);
        expect({ ...localStorage }).toEqual(
            expect.objectContaining({
                volume: '65',
                theaterMode: 'true',
                hideSubtitleList: 'true',
                displaySubtitles: 'false',
                subtitlePlayerWidth: '720',
            })
        );
    });
});
