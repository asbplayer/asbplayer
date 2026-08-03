import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { IndexedSubtitleModel } from '@project/common';
import { defaultSettings, type AsbplayerSettings } from '@project/common/settings';
import PlaybackPositionController, {
    maxPlaybackPositions,
    minimumPlaybackPositionMs,
    playbackPositionFromSettings,
    playbackPositionSaveIntervalMs,
    upsertPlaybackPositions,
} from '@project/common/playback/controllers/playback-position-controller';

const subtitle: IndexedSubtitleModel = {
    text: 'subtitle',
    start: 61_000,
    end: 62_000,
    originalStart: 61_000,
    originalEnd: 62_000,
    track: 0,
    index: 0,
};

const makeController = ({
    settings = {},
    playbackPositionKeys = ['video.mp4'],
    currentTimeMs = 65_000,
    durationMs = 120_000,
    showingSubtitlesAt = () => [],
}: {
    settings?: Partial<AsbplayerSettings>;
    playbackPositionKeys?: readonly string[];
    currentTimeMs?: number;
    durationMs?: number;
    showingSubtitlesAt?: (timestampMs: number) => readonly IndexedSubtitleModel[];
} = {}) => {
    const savedSettings: Partial<AsbplayerSettings>[] = [];
    const playbackPositionChanges: (number | undefined)[] = [];
    const seekCalls: number[] = [];
    const playCalls: number[] = [];
    const state = { currentTimeMs, durationMs };
    const controller = new PlaybackPositionController<IndexedSubtitleModel>({
        settings: { ...defaultSettings, ...settings },
        playbackPositionKeys,
        currentTimeMs: () => state.currentTimeMs,
        durationMs: () => state.durationMs,
        callbacks: {
            saveSettings: (updatedSettings) => savedSettings.push(updatedSettings),
            playbackPositionChanged: (position) => playbackPositionChanges.push(position),
            seek: async (timestampMs) => {
                seekCalls.push(timestampMs);
            },
            play: async () => {
                playCalls.push(1);
            },
            showingSubtitlesAt,
        },
    });

    return {
        controller,
        state,
        savedSettings,
        playbackPositionChanges,
        seekCalls,
        playCalls,
    };
};

afterEach(() => {
    jest.useRealTimers();
});

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

    it('updates all matching filenames and keeps at most maxPlaybackPositions videos', () => {
        const positions = Array.from({ length: maxPlaybackPositions }, (_, index) => ({
            fileName: `${index}.mp4`,
            position: index,
        }));

        const result = upsertPlaybackPositions(positions, ['first.mp4', 'second.mp4'], 100);

        expect(result).toHaveLength(maxPlaybackPositions);
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

describe('PlaybackPositionController', () => {
    it('respects the minimum when saving and restoring, removing positions below it', () => {
        const saveHarness = makeController({
            settings: {
                lastPlaybackPositions: [
                    { fileName: 'video.mp4', position: minimumPlaybackPositionMs },
                    { fileName: 'other.mp4', position: 10_000 },
                ],
            },
        });

        saveHarness.controller.savePlaybackPosition(minimumPlaybackPositionMs - 1);

        expect(saveHarness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [{ fileName: 'other.mp4', position: 10_000 }],
            },
        ]);

        const boundarySaveHarness = makeController();
        boundarySaveHarness.controller.savePlaybackPosition(minimumPlaybackPositionMs);
        expect(boundarySaveHarness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: minimumPlaybackPositionMs }],
            },
        ]);

        const restoreHarness = makeController({
            settings: {
                lastPlaybackPositions: [
                    { fileName: 'video.mp4', position: minimumPlaybackPositionMs - 1 },
                    { fileName: 'other.mp4', position: 10_000 },
                ],
            },
        });
        restoreHarness.controller.bind();

        expect(restoreHarness.playbackPositionChanges).toEqual([]);
        expect(restoreHarness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [{ fileName: 'other.mp4', position: 10_000 }],
            },
        ]);
        restoreHarness.controller.unbind();
    });

    it('restores a position at the minimum boundary', () => {
        const harness = makeController({
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: minimumPlaybackPositionMs }],
            },
        });

        harness.controller.bind();

        expect(harness.playbackPositionChanges).toEqual([minimumPlaybackPositionMs]);
        harness.controller.unbind();
    });

    it('does nothing when playback position keys change to the same normalized keys', () => {
        const harness = makeController({
            playbackPositionKeys: ['second.srt', 'first.srt', 'first.srt'],
            settings: {
                lastPlaybackPositions: [{ fileName: 'first.srt', position: 61_000 }],
            },
        });

        harness.controller.bind();
        harness.controller.playbackPositionKeysChanged(['first.srt', 'second.srt']);

        expect(harness.playbackPositionChanges).toEqual([61_000]);
        expect(harness.savedSettings).toEqual([]);
        harness.controller.unbind();
    });

    it('offers a restore position only once across later settings changes', () => {
        const harness = makeController({
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 61_000 }],
            },
        });

        harness.controller.bind();
        harness.controller.settingsChanged({
            ...defaultSettings,
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 62_000 }],
        });

        expect(harness.playbackPositionChanges).toEqual([61_000]);
        harness.controller.unbind();
    });

    it('keeps a locally removed position deleted across a stale settings refresh', () => {
        const harness = makeController({
            currentTimeMs: 0,
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 61_000 }],
            },
        });

        harness.controller.bind();
        harness.controller.savePlaybackPosition(0);
        harness.controller.settingsChanged({
            ...defaultSettings,
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 61_000 }],
        });
        harness.controller.playbackPositionKeysChanged(['other.mp4']);
        harness.controller.playbackPositionKeysChanged(['video.mp4']);

        expect(harness.playbackPositionChanges).toEqual([61_000, undefined]);
        harness.controller.unbind();
    });

    it('does not restore while unbound', () => {
        const harness = makeController({
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 61_000 }],
            },
        });

        harness.controller.settingsChanged({
            ...defaultSettings,
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 62_000 }],
        });

        expect(harness.playbackPositionChanges).toEqual([]);
        expect(harness.savedSettings).toEqual([]);
    });

    it('dismisses the restore overlay before seeking and playing', async () => {
        const harness = makeController({
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 61_000 }],
            },
            showingSubtitlesAt: () => [subtitle],
        });
        harness.controller.bind();
        harness.playbackPositionChanges.length = 0;

        const resume = harness.controller.resumePlaybackPosition();
        expect(harness.playbackPositionChanges).toEqual([undefined]);
        await resume;

        expect(harness.seekCalls).toEqual([subtitle.start]);
        expect(harness.playCalls).toEqual([1]);
        harness.controller.unbind();
    });

    it('does not save for invalid keys, timestamps, or a repeated timestamp', () => {
        const invalidKeysHarness = makeController({ playbackPositionKeys: [' ', ''] });
        invalidKeysHarness.controller.savePlaybackPosition(61_000);
        expect(invalidKeysHarness.savedSettings).toEqual([]);

        const harness = makeController();
        harness.controller.savePlaybackPosition(Number.NaN);
        harness.controller.savePlaybackPosition(Number.POSITIVE_INFINITY);
        harness.controller.savePlaybackPosition(Number.NEGATIVE_INFINITY);
        harness.controller.savePlaybackPosition(61_000);
        harness.controller.savePlaybackPosition(61_000);

        expect(harness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 61_000 }],
            },
        ]);
    });

    it('stores the exact timestamp in the last saved positions', () => {
        const harness = makeController({
            playbackPositionKeys: ['video.mp4', 'subtitles.srt'],
            settings: {
                lastPlaybackPositions: [{ fileName: 'other.mp4', position: 12_000 }],
            },
        });

        harness.controller.savePlaybackPosition(65_432);

        expect(harness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [
                    { fileName: 'subtitles.srt', position: 65_432 },
                    { fileName: 'video.mp4', position: 65_432 },
                    { fileName: 'other.mp4', position: 12_000 },
                ],
            },
        ]);
    });

    it('does not save the initial discontinuity, including after a rebind', () => {
        const harness = makeController();
        harness.controller.bind();

        harness.controller.discontinuity(61_000);
        expect(harness.savedSettings).toEqual([]);

        harness.controller.discontinuity(62_000);
        expect(harness.savedSettings).toHaveLength(1);

        harness.controller.unbind();
        harness.controller.bind();
        harness.controller.discontinuity(63_000);
        expect(harness.savedSettings).toHaveLength(1);

        harness.controller.discontinuity(64_000);
        expect(harness.savedSettings).toHaveLength(2);
        harness.controller.unbind();
    });

    it('saves on pause, at intervals, and after a seek discontinuity', () => {
        jest.useFakeTimers();
        const harness = makeController();
        harness.controller.bind();

        harness.controller.discontinuity(0);
        harness.controller.playbackPaused();
        harness.state.currentTimeMs = 66_000;
        jest.advanceTimersByTime(playbackPositionSaveIntervalMs);
        harness.controller.discontinuity(67_000);

        expect(harness.savedSettings).toEqual([
            { lastPlaybackPositions: [{ fileName: 'video.mp4', position: 65_000 }] },
            { lastPlaybackPositions: [{ fileName: 'video.mp4', position: 66_000 }] },
            { lastPlaybackPositions: [{ fileName: 'video.mp4', position: 67_000 }] },
        ]);
        harness.controller.unbind();
    });
});
