import { beforeEach, describe, expect, it } from '@jest/globals';
import PlaybackPreferences from './playback-preferences';

const makeSettings = (overrides: Record<string, unknown> = {}) => ({
    rememberSubtitleOffset: true,
    lastSubtitleOffset: 250,
    subtitleAlignment: 'bottom' as const,
    subtitlePositionOffset: 0,
    topSubtitlePositionOffset: 0,
    ...overrides,
});

class TestExtension {
    settings = { lastSubtitleOffset: 0 };

    constructor(readonly supportsAppIntegration = false) {}

    async setSettings(settings: { lastSubtitleOffset: number }) {
        this.settings = settings;
    }
}

beforeEach(() => {
    localStorage.clear();
});

describe('PlaybackPreferences', () => {
    it('uses user-facing defaults when storage is empty', () => {
        const preferences = new PlaybackPreferences(makeSettings(), new TestExtension());

        expect(preferences.volume).toBe(100);
        expect(preferences.theaterMode).toBe(false);
        expect(preferences.hideSubtitleList).toBe(false);
        expect(preferences.displaySubtitles).toBe(true);
        expect(preferences.offset).toBe(0);
        expect(preferences.subtitlePlayerWidth).toBeUndefined();
    });

    it('persists scalar playback preferences with their expected storage representation', () => {
        const preferences = new PlaybackPreferences(makeSettings(), new TestExtension());

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
            new TestExtension()
        );

        expect(preferences.offset).toBe(0);
    });

    it('reads and writes the settings-backed offset for app integration', () => {
        localStorage.setItem('offset', '900');
        const extension = new TestExtension(true);
        const preferences = new PlaybackPreferences(makeSettings({ lastSubtitleOffset: 375 }), extension);

        expect(preferences.offset).toBe(375);
        preferences.offset = 500;

        expect(extension.settings).toEqual({ lastSubtitleOffset: 500 });
        expect(localStorage.getItem('offset')).toBe('900');
    });
});
