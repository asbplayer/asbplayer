import { describe, expect, it } from '@jest/globals';
import {
    playbackPositionFromSettings,
    upsertPlaybackPositions,
} from '@project/common/playback/playback-position-controller';

describe('playback positions', () => {
    it('returns a remembered position for a matching file', () => {
        const settings = {
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 12_000 }],
        };

        expect(playbackPositionFromSettings(settings, ['video.mp4'])).toBe(12_000);
        expect(playbackPositionFromSettings(settings, ['other.mp4'])).toBeUndefined();
    });

    it('returns the lowest remembered position for multiple matching files', () => {
        const settings = {
            lastPlaybackPositions: [
                { fileName: 'second.srt', position: 8_000 },
                { fileName: 'first.srt', position: 3_000 },
            ],
        };

        expect(playbackPositionFromSettings(settings, ['first.srt', 'second.srt'])).toBe(3_000);
    });

    it('updates all matching filenames and keeps at most 50 videos', () => {
        const positions = Array.from({ length: 50 }, (_, index) => ({
            fileName: `${index}.mp4`,
            position: index,
        }));

        const result = upsertPlaybackPositions(positions, ['first.mp4', 'second.mp4'], 100);

        expect(result).toHaveLength(50);
        expect(result.slice(0, 2)).toEqual([
            { fileName: 'first.mp4', position: 100 },
            { fileName: 'second.mp4', position: 100 },
        ]);
        expect(result.find(({ fileName }) => fileName === '49.mp4')).toBeUndefined();
    });

    it('updates an existing filename instead of duplicating it', () => {
        const result = upsertPlaybackPositions(
            [
                { fileName: 'video.mp4', position: 10 },
                { fileName: 'other.mp4', position: 20 },
            ],
            ['video.mp4'],
            30
        );

        expect(result).toEqual([
            { fileName: 'video.mp4', position: 30 },
            { fileName: 'other.mp4', position: 20 },
        ]);
    });
});
