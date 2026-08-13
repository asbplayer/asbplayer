import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { IndexedSubtitleModel } from '@project/common';
import type { SettingsProvider } from '@project/common/settings';
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
    lastSubtitleEndMs = 120_000,
    showingSubtitlesAt = () => [],
}: {
    settings?: Partial<AsbplayerSettings>;
    playbackPositionKeys?: readonly string[];
    currentTimeMs?: number;
    lastSubtitleEndMs?: number;
    showingSubtitlesAt?: (timestampMs: number) => readonly IndexedSubtitleModel[];
} = {}) => {
    const savedSettings: Partial<AsbplayerSettings>[] = [];
    const playbackPositionChanges: (number | undefined)[] = [];
    const seekCalls: number[] = [];
    const playCalls: number[] = [];
    const state = { currentTimeMs, lastSubtitleEndMs };
    let providerPositions = [...(settings.lastPlaybackPositions ?? defaultSettings.lastPlaybackPositions)];
    let providerReadPromise: Promise<AsbplayerSettings['lastPlaybackPositions']> | undefined;
    const settingsProvider = {
        getSingle: async () => providerReadPromise ?? providerPositions,
        set: async (updatedSettings: Partial<AsbplayerSettings>) => {
            if (updatedSettings.lastPlaybackPositions !== undefined) {
                providerPositions = updatedSettings.lastPlaybackPositions;
            }
        },
    } as unknown as SettingsProvider;
    const controller = new PlaybackPositionController<IndexedSubtitleModel>({
        playbackPositionKeys,
        currentTimeMs: () => state.currentTimeMs,
        lastSubtitleEndMs: () => state.lastSubtitleEndMs,
        settingsProvider,
        callbacks: {
            saveSettings: (updatedSettings) => {
                savedSettings.push(updatedSettings);
                if (updatedSettings.lastPlaybackPositions !== undefined) {
                    providerPositions = updatedSettings.lastPlaybackPositions;
                }
            },
            playbackPositionChanged: (position) => playbackPositionChanges.push(position),
            seek: async (timestampMs) => {
                seekCalls.push(timestampMs);
            },
            play: async () => {
                playCalls.push(1);
            },
            showingSubtitlesAt,
            playbackPositionsChanged: () => {},
            onError: () => {},
        },
    });
    controller.setSettings({ ...defaultSettings, ...settings });

    return {
        controller,
        state,
        setProviderPositions: (positions: AsbplayerSettings['lastPlaybackPositions']) => {
            providerPositions = positions;
        },
        deferProviderRead: (promise: Promise<AsbplayerSettings['lastPlaybackPositions']>) => {
            providerReadPromise = promise;
        },
        savedSettings,
        playbackPositionChanges,
        seekCalls,
        playCalls,
    };
};

afterEach(() => {
    jest.useRealTimers();
});

const flushSave = async (): Promise<void> => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
};

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
    it('respects the minimum when saving and restoring, removing positions below it', async () => {
        const saveHarness = makeController({
            settings: {
                lastPlaybackPositions: [
                    { fileName: 'video.mp4', position: minimumPlaybackPositionMs },
                    { fileName: 'other.mp4', position: 10_000 },
                ],
            },
        });

        await saveHarness.controller.savePlaybackPosition(minimumPlaybackPositionMs - 1);

        expect(saveHarness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [{ fileName: 'other.mp4', position: 10_000 }],
            },
        ]);

        const boundarySaveHarness = makeController();
        await boundarySaveHarness.controller.savePlaybackPosition(minimumPlaybackPositionMs);
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
        await flushSave();

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

    it('does not save a position at or beyond the last subtitle end', async () => {
        const harness = makeController({
            lastSubtitleEndMs: 120_000,
            settings: {
                lastPlaybackPositions: [
                    { fileName: 'video.mp4', position: 90_000 },
                    { fileName: 'other.mp4', position: 130_000 },
                ],
            },
        });

        await harness.controller.savePlaybackPosition(120_001);

        expect(harness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [{ fileName: 'other.mp4', position: 130_000 }],
            },
        ]);
    });

    it('removes a remembered position at or beyond the last subtitle end', async () => {
        const harness = makeController({
            lastSubtitleEndMs: 120_000,
            settings: {
                lastPlaybackPositions: [
                    { fileName: 'video.mp4', position: 120_000 },
                    { fileName: 'other.mp4', position: 130_000 },
                ],
            },
        });

        harness.controller.bind();
        await flushSave();

        expect(harness.playbackPositionChanges).toEqual([]);
        expect(harness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [{ fileName: 'other.mp4', position: 130_000 }],
            },
        ]);
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

    it('uses the provider array when updating a remembered position', async () => {
        const harness = makeController({
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 61_000 }],
            },
        });

        harness.setProviderPositions([{ fileName: 'other.mp4', position: 10_000 }]);
        await harness.controller.savePlaybackPosition(62_000);

        expect(harness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [
                    { fileName: 'video.mp4', position: 62_000 },
                    { fileName: 'other.mp4', position: 10_000 },
                ],
            },
        ]);
    });

    it('keeps the keys from when a save was requested', async () => {
        const harness = makeController({ playbackPositionKeys: ['first.mp4'] });
        let resolveProviderRead!: (positions: AsbplayerSettings['lastPlaybackPositions']) => void;
        harness.deferProviderRead(
            new Promise<AsbplayerSettings['lastPlaybackPositions']>((resolve) => {
                resolveProviderRead = resolve;
            })
        );

        const save = harness.controller.savePlaybackPosition(62_000);
        harness.controller.playbackPositionKeysChanged(['second.mp4']);
        resolveProviderRead([]);
        await save;

        expect(harness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [{ fileName: 'first.mp4', position: 62_000 }],
            },
        ]);
    });

    it('keeps the keys from when a remembered position is removed', async () => {
        const harness = makeController({
            playbackPositionKeys: ['first.mp4'],
            settings: {
                lastPlaybackPositions: [
                    { fileName: 'first.mp4', position: 62_000 },
                    { fileName: 'second.mp4', position: 63_000 },
                ],
            },
        });
        let resolveProviderRead!: (positions: AsbplayerSettings['lastPlaybackPositions']) => void;
        harness.deferProviderRead(
            new Promise<AsbplayerSettings['lastPlaybackPositions']>((resolve) => {
                resolveProviderRead = resolve;
            })
        );

        const save = harness.controller.savePlaybackPosition(0);
        harness.controller.playbackPositionKeysChanged(['second.mp4']);
        resolveProviderRead([
            { fileName: 'first.mp4', position: 62_000 },
            { fileName: 'second.mp4', position: 63_000 },
        ]);
        await save;

        expect(harness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [{ fileName: 'second.mp4', position: 63_000 }],
            },
        ]);
    });

    it('does not write when the provider already reflects a removal', async () => {
        const harness = makeController({
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 62_000 }],
            },
        });
        harness.setProviderPositions([]);

        await harness.controller.savePlaybackPosition(0);

        expect(harness.savedSettings).toEqual([]);
    });

    it('resets restore state when the profile changes', async () => {
        const harness = makeController({
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 61_000 }],
            },
        });
        harness.controller.bind();
        harness.controller.profileChanged();
        harness.controller.settingsChanged({
            ...defaultSettings,
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 62_000 }],
        });
        await flushSave();

        expect(harness.playbackPositionChanges).toEqual([61_000, undefined, 62_000]);
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

    it('does not save for invalid keys, timestamps, or a repeated timestamp', async () => {
        const invalidKeysHarness = makeController({ playbackPositionKeys: [' ', ''] });
        void invalidKeysHarness.controller.savePlaybackPosition(61_000);
        expect(invalidKeysHarness.savedSettings).toEqual([]);

        const harness = makeController();
        void harness.controller.savePlaybackPosition(Number.NaN);
        void harness.controller.savePlaybackPosition(Number.POSITIVE_INFINITY);
        void harness.controller.savePlaybackPosition(Number.NEGATIVE_INFINITY);
        await harness.controller.savePlaybackPosition(61_000);
        await harness.controller.savePlaybackPosition(61_000);

        expect(harness.savedSettings).toEqual([
            {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 61_000 }],
            },
        ]);
    });

    it('stores the exact timestamp in the last saved positions', async () => {
        const harness = makeController({
            playbackPositionKeys: ['video.mp4', 'subtitles.srt'],
            settings: {
                lastPlaybackPositions: [{ fileName: 'other.mp4', position: 12_000 }],
            },
        });

        await harness.controller.savePlaybackPosition(65_432);

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

    it('does not save the initial discontinuity, including after a rebind', async () => {
        const harness = makeController();
        harness.controller.bind();

        harness.controller.discontinuity(61_000);
        expect(harness.savedSettings).toEqual([]);

        harness.controller.discontinuity(62_000);
        await flushSave();
        expect(harness.savedSettings).toHaveLength(1);

        harness.controller.unbind();
        harness.controller.bind();
        harness.controller.discontinuity(63_000);
        expect(harness.savedSettings).toHaveLength(1);

        harness.controller.discontinuity(64_000);
        await flushSave();
        expect(harness.savedSettings).toHaveLength(2);
        harness.controller.unbind();
    });

    it('saves on pause, at intervals, and after a seek discontinuity', async () => {
        jest.useFakeTimers();
        const harness = makeController();
        harness.controller.bind();

        harness.controller.discontinuity(0);
        harness.controller.playbackPaused();
        harness.state.currentTimeMs = 66_000;
        jest.advanceTimersByTime(playbackPositionSaveIntervalMs);
        await flushSave();
        harness.controller.discontinuity(67_000);
        await flushSave();

        expect(harness.savedSettings).toEqual([
            { lastPlaybackPositions: [{ fileName: 'video.mp4', position: 65_000 }] },
            { lastPlaybackPositions: [{ fileName: 'video.mp4', position: 66_000 }] },
            { lastPlaybackPositions: [{ fileName: 'video.mp4', position: 67_000 }] },
        ]);
        harness.controller.unbind();
    });
});
