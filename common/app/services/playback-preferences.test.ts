import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import PlaybackPreferences from './playback-preferences';

const makeSettings = (overrides: Record<string, unknown> = {}) => ({
    rememberSubtitleOffset: true,
    lastSubtitleOffset: 250,
    subtitleAlignment: 'bottom' as const,
    subtitlePositionOffset: 0,
    topSubtitlePositionOffset: 0,
    ...overrides,
});

const makeExtension = (supportsAppIntegration = false) => ({
    supportsAppIntegration,
    setSettings: jest.fn(async () => undefined),
});

beforeEach(() => {
    localStorage.clear();
});

describe('PlaybackPreferences', () => {
    it('uses user-facing defaults when storage is empty', () => {
        const preferences = new PlaybackPreferences(makeSettings(), makeExtension() as any);

        expect(preferences.volume).toBe(100);
        expect(preferences.theaterMode).toBe(false);
        expect(preferences.hideSubtitleList).toBe(false);
        expect(preferences.displaySubtitles).toBe(true);
        expect(preferences.offset).toBe(0);
        expect(preferences.subtitlePlayerWidth).toBeUndefined();
    });

    it('persists scalar playback preferences with their expected storage representation', () => {
        const preferences = new PlaybackPreferences(makeSettings(), makeExtension() as any);

        preferences.volume = 65;
        preferences.theaterMode = true;
        preferences.hideSubtitleList = true;
        preferences.displaySubtitles = false;
        preferences.subtitlePlayerWidth = 720;
        preferences.offset = -125;

        expect(preferences.volume).toBe(65);
        expect(preferences.theaterMode).toBe(true);
        expect(preferences.hideSubtitleList).toBe(true);
        expect(preferences.displaySubtitles).toBe(false);
        expect(preferences.subtitlePlayerWidth).toBe(720);
        expect(preferences.offset).toBe(-125);
        expect({ ...localStorage }).toEqual(
            expect.objectContaining({
                volume: '65',
                theaterMode: 'true',
                hideSubtitleList: 'true',
                displaySubtitles: 'false',
                subtitlePlayerWidth: '720',
                offset: '-125',
            })
        );
    });

    it('ignores stored offsets when remembering is disabled', () => {
        localStorage.setItem('offset', '900');
        const preferences = new PlaybackPreferences(
            makeSettings({ rememberSubtitleOffset: false }),
            makeExtension() as any
        );

        expect(preferences.offset).toBe(0);
    });

    it('reads and writes the settings-backed offset for app integration', () => {
        localStorage.setItem('offset', '900');
        const extension = makeExtension(true);
        const preferences = new PlaybackPreferences(makeSettings({ lastSubtitleOffset: 375 }), extension as any);

        expect(preferences.offset).toBe(375);
        preferences.offset = 500;

        expect(extension.setSettings).toHaveBeenCalledWith({ lastSubtitleOffset: 500 });
        expect(localStorage.getItem('offset')).toBe('900');
    });
});
