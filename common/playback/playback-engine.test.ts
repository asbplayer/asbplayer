import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AutoPausePreference, type IndexedSubtitleModel, PlayMode } from '@project/common';
import {
    defaultSettings,
    isSaveOnlySettings,
    type AsbplayerSettings,
    type SettingsProvider,
} from '@project/common/settings';
import PlaybackEngine, {
    formatPlaybackRateNotification,
    type InitialPlaybackSettings,
} from '@project/common/playback/playback-engine';
import type {
    InternalSeekCompletion,
    TimingDriver,
    TimingDriverCallbacks,
} from '@project/common/playback/timing/timing-driver';

beforeEach(() => {
    localStorage.clear();
});

class FakeTimingDriver implements TimingDriver {
    callbacks: TimingDriverCallbacks = {
        onTime: async () => {},
        onPlaybackStarted: async () => {},
        onPlaybackPaused: () => {},
        onDiscontinuity: () => {},
        onCancel: () => {},
        onError: () => {},
    };
    bound = false;
    emitInitialDiscontinuity = false;
    bindCalls = 0;
    unbindCalls = 0;
    timestampMs = 0;
    durationMsValue = 6000;
    durationMsReads = 0;
    playbackRateValue = 1;
    isPaused = false;
    expectedInternalSeekCalls = 0;
    cancelExpectedInternalSeekCalls = 0;
    internalSeekCompletion: InternalSeekCompletion = 'completed';
    internalSeekCompletionPromise?: Promise<InternalSeekCompletion>;

    bind(): void {
        if (this.bound) return;
        this.bindCalls += 1;
        this.bound = true;
        if (this.emitInitialDiscontinuity) this.callbacks.onDiscontinuity(this.timestampMs);
    }

    unbind(): void {
        if (!this.bound) return;
        this.unbindCalls += 1;
        this.bound = false;
    }

    setCallbacks(callbacks: TimingDriverCallbacks): void {
        this.callbacks = callbacks;
    }

    beginInternalSeek(): Promise<InternalSeekCompletion> {
        this.expectedInternalSeekCalls++;
        return this.internalSeekCompletionPromise ?? Promise.resolve(this.internalSeekCompletion);
    }

    cancelExpectedInternalSeek(): void {
        this.cancelExpectedInternalSeekCalls++;
    }

    currentTimeMs(): number {
        return this.timestampMs;
    }

    frameTimeMs(): number {
        return 1000 / 60;
    }

    playbackRate(): number {
        return this.playbackRateValue;
    }

    durationMs(): number {
        this.durationMsReads += 1;
        return this.durationMsValue;
    }

    onDurationChange(): void {}

    paused(): boolean {
        return this.isPaused;
    }

    async time(timestampMs: number, lookaheadTimestampMs?: number): Promise<void> {
        this.timestampMs = timestampMs;
        await this.callbacks.onTime(timestampMs, { lookaheadTimestampMs });
    }

    discontinuity(timestampMs: number): void {
        this.timestampMs = timestampMs;
        this.callbacks.onDiscontinuity(timestampMs);
    }

    async start(): Promise<void> {
        this.isPaused = false;
        await this.callbacks.onPlaybackStarted();
    }
}

const subtitle: IndexedSubtitleModel = {
    text: 'subtitle',
    start: 1000,
    end: 2000,
    originalStart: 1000,
    originalEnd: 2000,
    track: 0,
    index: 0,
};
const secondSubtitle: IndexedSubtitleModel = {
    ...subtitle,
    start: 4000,
    end: 5000,
    originalStart: 4000,
    originalEnd: 5000,
    index: 1,
};

const playbackSettings = (overrides: Partial<AsbplayerSettings> = {}): AsbplayerSettings => ({
    ...defaultSettings,
    seekableTracks: 1,
    autoPausePreference: AutoPausePreference.atEnd,
    subtitleTriggerStartOffset: 0,
    subtitleTriggerEndOffset: 0,
    subtitleTriggerGapEndOffset: 0,
    subtitleTriggerGapStartOffset: 0,
    repeatCountPreference: 0,
    streamingCondensedPlaybackMinimumSkipIntervalMs: 500,
    playbackRate: 1,
    fastForwardModePlaybackRate: 2,
    fastForwardPlaybackMinimumSkipIntervalMs: 500,
    ...overrides,
});

const flushPlaybackSaves = async (): Promise<void> => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
};

const flushPlaybackInitialization = flushPlaybackSaves;

async function makePlaybackEngine(
    modes: PlayMode[],
    timestampMs = 0,
    subtitles: readonly IndexedSubtitleModel[] = [subtitle],
    overrides: Partial<{
        paused: boolean;
        pause: () => void;
        play: () => Promise<void>;
        seek: (timestampMs: number) => Promise<void>;
        durationMs?: number;
        settings: Partial<AsbplayerSettings>;
        settingsReady: boolean;
        emitInitialDiscontinuity?: boolean;
        appIntegration?: boolean;
        playbackModesDisabled?: boolean;
        playbackPositionKeys?: readonly string[];
        profile?: string;
    }> = {}
) {
    const driver = new FakeTimingDriver();
    driver.timestampMs = timestampMs;
    driver.isPaused = overrides.paused ?? false;
    driver.durationMsValue = overrides.durationMs ?? 6000;
    driver.emitInitialDiscontinuity = overrides.emitInitialDiscontinuity ?? false;
    const seeks: number[] = [];
    const showing: (readonly IndexedSubtitleModel[])[] = [];
    const pauses: number[] = [];
    const plays: number[] = [];
    const savedSettings: Partial<AsbplayerSettings>[] = [];
    const playbackRates: number[] = [];
    const subtitleOffsets: number[] = [];
    const subtitleOffsetOptions: { readonly offset: number; readonly notifyPlayer: boolean }[] = [];
    const initialPlaybackSettings: InitialPlaybackSettings[] = [];
    const playbackPositionChanges: (number | undefined)[] = [];
    const modeChanges: {
        readonly modes: Set<PlayMode>;
        readonly added: Set<PlayMode>;
        readonly removed: Set<PlayMode>;
    }[] = [];
    const settings = playbackSettings({
        ...overrides.settings,
        rememberPlaybackModes: overrides.settings?.rememberPlaybackModes ?? true,
        lastPlaybackModes: overrides.settings?.lastPlaybackModes ?? modes,
    });
    let providerPositions = settings.lastPlaybackPositions;
    let providerProfile = overrides.profile;
    let resolveSettings: ((settings: AsbplayerSettings) => void) | undefined;
    let settingsLoadPending = overrides.settingsReady === false;
    const settingsProvider = (overrides.settingsReady === false
        ? {
              getAll: () => {
                  if (!settingsLoadPending) return Promise.resolve(settings);
                  settingsLoadPending = false;
                  return new Promise<AsbplayerSettings>((resolve) => {
                      resolveSettings = resolve;
                  });
              },
              getSingle: async () => providerPositions,
              activeProfile: async () => (providerProfile === undefined ? undefined : { name: providerProfile }),
          }
        : {
              getAll: async () => settings,
              getSingle: async () => providerPositions,
              activeProfile: async () => (providerProfile === undefined ? undefined : { name: providerProfile }),
          }) as unknown as SettingsProvider;
    const playbackEngine = new PlaybackEngine({
        settingsProvider,
        appIntegration: overrides.appIntegration ?? true,
        subtitles,
        playbackModesDisabled: overrides.playbackModesDisabled ?? false,
        playbackModesSuppressed: false,
        playbackPositionKeys: overrides.playbackPositionKeys ?? [],
        timingDriver: driver,
        callbacks: {
            pause: overrides.pause ?? (() => pauses.push(driver.timestampMs)),
            play:
                overrides.play ??
                (() => {
                    plays.push(driver.timestampMs);
                    return Promise.resolve();
                }),
            seek:
                overrides.seek ??
                ((targetTimestampMs) => {
                    seeks.push(targetTimestampMs);
                    driver.timestampMs = targetTimestampMs;
                    return Promise.resolve();
                }),
            setPlaybackRate: (playbackRate) => {
                playbackRates.push(playbackRate);
                driver.playbackRateValue = playbackRate;
            },
            setSubtitleOffset: (offset, options) => {
                subtitleOffsets.push(offset);
                subtitleOffsetOptions.push({ offset, notifyPlayer: options.notifyPlayer });
            },
            showingSubtitlesChanged: (values) => showing.push(values),
            playbackPositionChanged: (position) => playbackPositionChanges.push(position),
            saveSettings: (settings) => {
                savedSettings.push(settings);
                if (settings.lastPlaybackPositions !== undefined) {
                    providerPositions = settings.lastPlaybackPositions;
                }
            },
            playbackModesChanged: (transition) => modeChanges.push(transition),
            initialPlaybackSettingsChanged: (settings) => initialPlaybackSettings.push(settings),
            onError: () => {},
        },
    });
    if (overrides.settingsReady ?? true) await Promise.resolve();
    return {
        playbackEngine,
        driver,
        seeks,
        showing,
        pauses,
        plays,
        modeChanges,
        savedSettings,
        playbackRates,
        subtitleOffsets,
        subtitleOffsetOptions,
        initialPlaybackSettings,
        playbackPositionChanges,
        settings,
        setDuration: (value: number) => {
            driver.durationMsValue = value;
        },
        resolveSettings: (loadedSettings: AsbplayerSettings) => resolveSettings?.(loadedSettings),
        setProfile: (profile: string | undefined) => {
            providerProfile = profile;
        },
    };
}

describe('PlaybackEngine', () => {
    it('exposes the remember-aware initial subtitle offset to its consumers', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            settings: { lastSubtitleOffset: 375, rememberSubtitleOffset: false },
        });

        expect(harness.playbackEngine.lastSubtitleOffset).toBe(0);

        harness.playbackEngine.settingsChanged({ ...harness.settings, rememberSubtitleOffset: true });

        expect(harness.playbackEngine.lastSubtitleOffset).toBe(375);
    });

    it('retains engine-owned playback modes when settings updates echo stale modes', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal]);

        harness.playbackEngine.togglePlaybackMode(PlayMode.repeat);
        harness.playbackEngine.settingsChanged({ ...harness.settings, lastPlaybackModes: [PlayMode.normal] });

        expect(harness.playbackEngine.playbackModes).toEqual(new Set([PlayMode.repeat]));
        expect(harness.savedSettings).toEqual([{ lastPlaybackModes: [PlayMode.repeat] }]);
    });

    it('does not change the engine-owned offset when settings are refreshed', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            settings: { lastSubtitleOffset: 375, rememberSubtitleOffset: false },
        });

        harness.playbackEngine.subtitleOffsetChanged(250, { notifyPlayer: false });
        harness.playbackEngine.settingsChanged({
            ...harness.settings,
            lastSubtitleOffset: -500,
            rememberSubtitleOffset: false,
        });

        expect(harness.playbackEngine.lastSubtitleOffset).toBe(0);
        expect(harness.subtitleOffsets).toEqual([250]);
        expect(harness.savedSettings).toEqual([{ lastSubtitleOffset: 250 }]);
    });

    it('uses and updates the legacy local offset when app integration is unavailable', async () => {
        localStorage.setItem('offset', '375');
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            appIntegration: false,
            settings: { rememberSubtitleOffset: true, lastSubtitleOffset: 900 },
        });

        expect(harness.playbackEngine.lastSubtitleOffset).toBe(375);

        harness.playbackEngine.subtitleOffsetChanged(250, { notifyPlayer: false });

        expect(localStorage.getItem('offset')).toBe('250');
        expect(harness.savedSettings).toEqual([]);
    });

    it('publishes the offset when binding', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            settings: { lastSubtitleOffset: 375, playbackRate: 1.4 },
        });

        harness.playbackEngine.bind();

        expect(harness.playbackRates).toEqual([1.4]);
        expect(harness.subtitleOffsets).toEqual([375]);
        expect(harness.subtitleOffsetOptions).toEqual([{ offset: 375, notifyPlayer: false }]);
        expect(harness.initialPlaybackSettings).toEqual([
            {
                autoHideDuration: 6000,
                playbackRate: 1.4,
                subtitleOffset: 375,
                playbackModeTransition: {
                    modes: new Set([PlayMode.normal]),
                    added: new Set(),
                    removed: new Set(),
                },
                notifications: {
                    offsetAndRate: [
                        { type: 'message', message: '+375 ms' },
                        {
                            type: 'translation',
                            notification: { locKey: 'info.playbackRate', replacements: { rate: '1.4' } },
                        },
                    ],
                    playbackMode: { notifications: [], join: ' | ' },
                },
            },
        ]);
    });

    it('does not reset remembered playback state for an initial empty subtitle update', async () => {
        const harness = await makePlaybackEngine([PlayMode.fastForward], 0, [], {
            settings: {
                playbackRate: 1.4,
                fastForwardModePlaybackRate: 2.7,
                lastSubtitleOffset: 375,
                rememberSubtitleOffset: true,
            },
        });

        harness.playbackEngine.subtitlesChanged([]);

        expect(harness.playbackEngine.playbackModes).toEqual(new Set([PlayMode.normal]));
        expect(harness.playbackRates).toEqual([]);

        harness.playbackEngine.subtitlesChanged([subtitle]);

        expect(harness.playbackRates).not.toContain(1.4);
        expect(harness.playbackRates.at(-1)).toBe(2.7);
        expect(harness.playbackEngine.playbackModes).toEqual(new Set([PlayMode.fastForward]));
        expect(harness.initialPlaybackSettings.at(-1)?.subtitleOffset).toBe(375);
    });

    it('publishes the active fast-forward rate when binding', async () => {
        const harness = await makePlaybackEngine([PlayMode.fastForward], 0, [subtitle], {
            settings: { fastForwardModePlaybackRate: 2.7 },
        });

        expect(harness.initialPlaybackSettings.at(-1)).toMatchObject({
            playbackRate: 2.7,
            notifications: {
                offsetAndRate: [
                    {
                        type: 'translation',
                        notification: {
                            locKey: 'info.fastForwardPlaybackRate',
                            replacements: { rate: '2.7' },
                        },
                    },
                ],
            },
        });
        expect(harness.playbackRates.at(-1)).toBe(2.7);
    });

    it('formats playback rate notifications without trailing zeros', () => {
        expect(formatPlaybackRateNotification(1, 'info.playbackRate')).toEqual({
            locKey: 'info.playbackRate',
            replacements: { rate: '1' },
        });
        expect(formatPlaybackRateNotification(1.1, 'info.playbackRate')).toEqual({
            locKey: 'info.playbackRate',
            replacements: { rate: '1.1' },
        });
    });

    it('refreshes the plan duration before binding', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], { settingsReady: false });
        harness.driver.durationMsReads = 0;
        harness.setDuration(12_000);

        harness.resolveSettings(harness.settings);
        await Promise.resolve();
        await Promise.resolve();

        expect(harness.driver.durationMsReads).toBeGreaterThan(0);
    });

    it('does not bind after unbinding invalidates a pending settings load', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], { settingsReady: false });

        harness.playbackEngine.bind();
        harness.playbackEngine.unbind();
        harness.resolveSettings(harness.settings);
        await Promise.resolve();
        await Promise.resolve();

        expect(harness.driver.bindCalls).toBe(0);
        expect(harness.driver.bound).toBe(false);
        expect(harness.initialPlaybackSettings).toEqual([]);
    });

    it('starts from the current time when binding after time has elapsed', async () => {
        const harness = await makePlaybackEngine([PlayMode.autoPause], 0, [subtitle], {
            settings: { autoPausePreference: AutoPausePreference.atStart },
            settingsReady: false,
            emitInitialDiscontinuity: true,
        });
        harness.driver.timestampMs = 1500;

        harness.resolveSettings(harness.settings);
        await flushPlaybackInitialization();
        await harness.driver.time(2000);

        expect(harness.pauses).toEqual([]);
        expect(harness.showing.at(-1)).toEqual([]);
    });

    it('uses playback settings loaded before ready instead of preserving constructor settings', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            durationMs: 70_000,
            settingsReady: false,
            settings: { rememberPlaybackModes: false, lastPlaybackPositions: [] },
            playbackPositionKeys: ['video.mp4'],
        });
        const loadedSettings = {
            ...harness.settings,
            rememberPlaybackModes: true,
            lastPlaybackModes: [PlayMode.repeat],
            playbackRate: 1.4,
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 63_000 }],
            lastSubtitleOffset: 375,
            rememberSubtitleOffset: true,
        };

        harness.resolveSettings(loadedSettings);
        await flushPlaybackInitialization();

        expect(harness.playbackEngine.playbackModes).toEqual(new Set([PlayMode.repeat]));
        expect(harness.playbackRates).toContain(1.4);
        expect(harness.initialPlaybackSettings.at(-1)?.subtitleOffset).toBe(375);
        expect(harness.playbackPositionChanges).toEqual([63_000]);
    });

    it('preserves every engine-owned playback setting across a post-ready settings change', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 2500, [subtitle], {
            settings: {
                rememberPlaybackRate: true,
                rememberPlaybackModes: true,
                rememberSubtitleOffset: true,
                lastPlaybackPositions: [],
                playbackRate: 1,
                fastForwardModePlaybackRate: 2,
            },
        });

        harness.playbackEngine.playbackRateChanged(1.7);
        harness.playbackEngine.togglePlaybackMode(PlayMode.fastForward);
        harness.playbackEngine.bind();
        harness.playbackEngine.playbackRateChanged(3.1);
        harness.playbackEngine.togglePlaybackMode(PlayMode.repeat);
        harness.playbackEngine.subtitleOffsetChanged(250, { notifyPlayer: false });

        const staleSettings = {
            ...harness.settings,
            playbackRate: 1,
            fastForwardModePlaybackRate: 2,
            lastPlaybackModes: [PlayMode.normal],
            lastPlaybackPositions: [],
            lastSubtitleOffset: 0,
        };
        harness.playbackEngine.settingsChanged(staleSettings);

        expect(harness.playbackEngine.playbackModes).toEqual(new Set([PlayMode.fastForward, PlayMode.repeat]));
        expect(harness.playbackEngine.lastSubtitleOffset).toBe(250);

        harness.playbackEngine.togglePlaybackMode(PlayMode.normal);
        expect(harness.playbackRates.at(-1)).toBe(1.7);
        harness.playbackEngine.togglePlaybackMode(PlayMode.fastForward);
        expect(harness.playbackRates.at(-1)).toBe(3.1);
    });

    it('owns playback modes and rebuilds behavior from AsbplayerSettings', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 1500);

        harness.playbackEngine.togglePlaybackMode(PlayMode.repeat);
        await harness.driver.time(1999);

        expect(harness.modeChanges.at(-1)).toMatchObject({
            modes: new Set([PlayMode.repeat]),
            added: new Set([PlayMode.repeat]),
            removed: new Set([PlayMode.normal]),
        });
        expect(harness.savedSettings.at(-1)).toEqual({ lastPlaybackModes: [PlayMode.repeat] });
        expect(harness.seeks).toEqual([1000]);
    });

    it('keeps playback modes normal when disabled', async () => {
        const harness = await makePlaybackEngine([PlayMode.repeat], 0, [subtitle], {
            playbackModesDisabled: true,
        });

        expect(harness.playbackEngine.playbackModes).toEqual(new Set([PlayMode.normal]));
        expect(harness.initialPlaybackSettings.at(-1)?.playbackModeTransition).toEqual({
            modes: new Set([PlayMode.normal]),
            added: new Set(),
            removed: new Set(),
        });

        harness.playbackEngine.togglePlaybackMode(PlayMode.repeat);

        expect(harness.playbackEngine.playbackModes).toEqual(new Set([PlayMode.normal]));
        expect(harness.modeChanges).toEqual([]);
    });

    it('does not bind timing without subtitles', async () => {
        const driver = new FakeTimingDriver();
        const settings = playbackSettings();
        const playbackEngine = new PlaybackEngine<IndexedSubtitleModel>({
            settingsProvider: {
                getAll: async () => settings,
                getSingle: async () => settings.lastPlaybackPositions,
                activeProfile: async () => undefined,
            } as unknown as SettingsProvider,
            appIntegration: true,
            subtitles: [],
            playbackModesDisabled: false,
            playbackModesSuppressed: false,
            playbackPositionKeys: [],
            timingDriver: driver,
            callbacks: {
                pause: () => {},
                play: async () => {},
                seek: async () => {},
                setPlaybackRate: () => {},
                setSubtitleOffset: () => {},
                showingSubtitlesChanged: () => {},
                playbackPositionChanged: () => {},
                saveSettings: () => {},
                playbackModesChanged: () => {},
                initialPlaybackSettingsChanged: () => {},
                onError: () => {},
            },
        });

        playbackEngine.bind();
        playbackEngine.bind();
        expect(driver.bound).toBe(false);
        expect(driver.bindCalls).toBe(0);
        expect(playbackEngine.playbackRateChanged(1.5)).toBeUndefined();
        expect(playbackEngine.adjustPlaybackRate(0.1)).toBeUndefined();
        playbackEngine.subtitleOffsetChanged(250, { notifyPlayer: false });
        playbackEngine.togglePlaybackMode(PlayMode.repeat);
        expect(playbackEngine.playbackModes).toEqual(new Set([PlayMode.normal]));

        await flushPlaybackInitialization();
        playbackEngine.durationChanged(6000);
        playbackEngine.subtitlesChanged([subtitle]);
        expect(driver.bound).toBe(true);
        expect(driver.bindCalls).toBe(1);

        playbackEngine.bind();
        expect(driver.bindCalls).toBe(1);
    });

    it('does not report a playback-mode reset when subtitles were already empty', async () => {
        const harness = await makePlaybackEngine([PlayMode.repeat], 0, []);

        harness.playbackEngine.subtitlesChanged([]);

        expect(harness.modeChanges).toEqual([]);
    });

    it('reports a playback-mode reset when loaded subtitles are cleared', async () => {
        const harness = await makePlaybackEngine([PlayMode.repeat]);

        harness.playbackEngine.subtitlesChanged([]);

        expect(harness.modeChanges).toEqual([
            {
                modes: new Set([PlayMode.normal]),
                added: new Set([PlayMode.normal]),
                removed: new Set([PlayMode.repeat]),
            },
        ]);
    });

    it('does not bind until settings are ready', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], { settingsReady: false });

        harness.playbackEngine.bind();

        expect(harness.driver.bound).toBe(false);
        expect(harness.driver.bindCalls).toBe(0);

        harness.playbackEngine.settingsChanged(harness.settings);
        harness.resolveSettings(harness.settings);
        await flushPlaybackInitialization();

        expect(harness.driver.bound).toBe(true);
        expect(harness.driver.bindCalls).toBe(1);
    });

    it('retries the settings read when an update arrives during initialization', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], { settingsReady: false });

        harness.playbackEngine.settingsChanged({ ...harness.settings, playbackRate: 1.5 });
        harness.resolveSettings(harness.settings);
        await flushPlaybackInitialization();

        expect(harness.initialPlaybackSettings.at(-1)?.playbackRate).toBe(harness.settings.playbackRate);
    });

    it('retries initialization when the profile changes before settings are ready', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            settingsReady: false,
            profile: 'old-profile',
        });

        harness.setProfile('new-profile');
        harness.playbackEngine.profileChanged('new-profile');
        harness.resolveSettings(harness.settings);
        await flushPlaybackInitialization();

        expect(harness.driver.bound).toBe(true);
        expect(harness.driver.bindCalls).toBe(1);
    });

    it('restores remembered positions when settings load without changing the playback plan', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            durationMs: 70_000,
            settingsReady: false,
            playbackPositionKeys: ['video.mp4'],
            settings: { lastPlaybackPositions: [] },
        });

        harness.resolveSettings({
            ...harness.settings,
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 63_000 }],
        });
        await flushPlaybackInitialization();

        expect(harness.playbackPositionChanges).toEqual([63_000]);
    });

    it('unbinds timing only once', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal]);

        harness.playbackEngine.bind();
        harness.playbackEngine.unbind();
        harness.playbackEngine.unbind();

        expect(harness.driver.unbindCalls).toBe(1);
        expect(harness.savedSettings).toHaveLength(1);
    });

    it('reinitializes on a profile change without persisting the previous profile', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            durationMs: 70_000,
            playbackPositionKeys: ['video.mp4'],
            profile: 'old-profile',
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 61_000 }],
            },
        });

        harness.driver.discontinuity(0);
        harness.driver.discontinuity(62_000);
        harness.setProfile('new-profile');
        harness.playbackEngine.profileChanged('new-profile');
        await flushPlaybackSaves();

        expect(harness.savedSettings).toEqual([]);
        expect(harness.playbackPositionChanges).toEqual([61_000, undefined, 61_000]);
        expect(harness.driver.bound).toBe(true);
        expect(harness.driver.bindCalls).toBe(2);
        expect(harness.driver.unbindCalls).toBe(1);
    });

    it('publishes the current playback settings when unbinding', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            settings: {
                rememberPlaybackRate: true,
                rememberSubtitleOffset: true,
                lastPlaybackPositions: [],
                playbackRate: 1,
                fastForwardModePlaybackRate: 2,
            },
            playbackPositionKeys: ['video.mp4'],
            durationMs: 70_000,
        });

        harness.playbackEngine.bind();
        harness.playbackEngine.playbackRateChanged(1.5);
        harness.playbackEngine.togglePlaybackMode(PlayMode.repeat);
        harness.playbackEngine.subtitleOffsetChanged(250, { notifyPlayer: false });
        harness.driver.discontinuity(0);
        harness.driver.discontinuity(63_000);

        harness.playbackEngine.unbind();

        const finalSettings = harness.savedSettings.at(-1);
        expect(finalSettings).toEqual({
            playbackRate: 1.5,
            fastForwardModePlaybackRate: 2,
            lastPlaybackModes: [PlayMode.repeat],
            lastSubtitleOffset: 250,
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 63_000 }],
            rememberPlaybackRate: true,
        });
        expect(isSaveOnlySettings(finalSettings!)).toBe(false);
    });

    it('shows remembered enabled modes when binding', async () => {
        const harness = await makePlaybackEngine([PlayMode.repeat]);

        harness.playbackEngine.bind();

        expect(harness.initialPlaybackSettings.at(-1)?.playbackModeTransition).toEqual({
            modes: new Set([PlayMode.repeat]),
            added: new Set([PlayMode.repeat]),
            removed: new Set([PlayMode.normal]),
        });
    });

    it('keeps visible subtitles stable when an unrelated setting changes', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 1500);
        const showingCount = harness.showing.length;

        harness.playbackEngine.settingsChanged({ ...harness.settings, language: 'ja' });

        expect(harness.showing).toHaveLength(showingCount);
    });

    it('retains a live playback rate across every post-ready settings change', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 1500, [subtitle], {
            settings: { rememberPlaybackRate: true },
        });
        harness.playbackEngine.bind();
        harness.playbackEngine.playbackRateChanged(1.7);
        const rateChangeCount = harness.playbackRates.length;

        harness.playbackEngine.settingsChanged({ ...harness.settings, playbackRate: 1, language: 'ja' });

        expect(harness.playbackRates).toHaveLength(rateChangeCount);
        expect(harness.playbackRates.at(-1)).toBe(1.7);
    });

    it('saves keybind playback-rate changes', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 1500, [subtitle], {
            settings: { rememberPlaybackRate: true },
        });

        harness.playbackEngine.playbackRateChanged(1.7);

        expect(harness.savedSettings).toContainEqual({ playbackRate: 1.7 });
    });

    it('owns and persists subtitle offset changes', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 1500, [subtitle], {
            settings: { rememberSubtitleOffset: true },
        });

        harness.playbackEngine.subtitleOffsetChanged(-7000, { notifyPlayer: true });

        expect(harness.subtitleOffsets).toEqual([-7000]);
        expect(harness.savedSettings).toContainEqual({ lastSubtitleOffset: -7000 });
    });

    it('does not rebuild the plan when the duration is unchanged', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal]);
        harness.driver.durationMsReads = 0;

        harness.playbackEngine.durationChanged(6000);
        expect(harness.driver.durationMsReads).toBe(0);

        harness.setDuration(7000);
        harness.playbackEngine.durationChanged(7000);
        expect(harness.driver.durationMsReads).toBe(1);
    });

    it('reconciles persistent state through a user discontinuity', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal]);
        harness.playbackEngine.bind();

        harness.driver.discontinuity(1500);

        expect(harness.showing.at(-1)).toEqual([subtitle]);
    });

    it('preserves internal repeat state when its discontinuity arrives', async () => {
        const harness = await makePlaybackEngine([PlayMode.repeat], 1500);
        harness.playbackEngine.bind();

        await harness.driver.time(1999);
        harness.driver.discontinuity(1000);
        await harness.driver.time(1999);

        expect(harness.seeks).toEqual([1000, 1000]);
    });

    it('resumes through the adapter after a condensed seek', async () => {
        const harness = await makePlaybackEngine([PlayMode.condensed], 1500, [subtitle, secondSubtitle]);
        harness.playbackEngine.bind();

        await harness.driver.time(2000);

        expect(harness.seeks).toEqual([3999]);
        expect(harness.plays).toEqual([3999]);
    });

    it('rebuilds playback boundaries from the subtitles provided by the media owner', async () => {
        const harness = await makePlaybackEngine([PlayMode.autoPause], 500, [subtitle], {
            settings: { autoPausePreference: AutoPausePreference.atStart },
        });

        harness.playbackEngine.subtitlesChanged([{ ...subtitle, start: 2000, end: 3000 }]);
        await harness.driver.time(1500);
        expect(harness.pauses).toEqual([]);

        await harness.driver.time(2000);
        expect(harness.pauses).toEqual([2000]);
    });

    it('uses timing-driver time and engine correction tolerance for auto-pause seeks', async () => {
        const harness = await makePlaybackEngine([PlayMode.autoPause], 1500);

        await harness.driver.time(2100);

        expect(harness.pauses).toEqual([2100]);
        expect(harness.seeks).toEqual([1999]);
    });

    it('clears the internal marker when a seek fails', async () => {
        const harness = await makePlaybackEngine([PlayMode.repeat], 1500, [subtitle], {
            seek: async () => {
                throw new Error('seek failed');
            },
        });

        await expect(harness.driver.time(2100)).rejects.toThrow('seek failed');

        expect(harness.driver.expectedInternalSeekCalls).toBe(1);
        expect(harness.driver.cancelExpectedInternalSeekCalls).toBe(1);
    });

    it('cancels an internal seek that never reports completion', async () => {
        jest.useFakeTimers();
        const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const harness = await makePlaybackEngine([PlayMode.repeat], 1500);
            harness.driver.internalSeekCompletionPromise = new Promise(() => {});

            const update = harness.driver.time(2100);
            await jest.advanceTimersByTimeAsync(10_000);
            await update;

            expect(harness.driver.cancelExpectedInternalSeekCalls).toBe(1);
            expect(warning).toHaveBeenCalledWith(
                '[asbplayer/playback] Internal seek did not complete before the watchdog timeout',
                expect.objectContaining({ targetTimestampMs: 1000, timeoutMs: 10_000 })
            );
        } finally {
            warning.mockRestore();
            jest.useRealTimers();
        }
    });

    it('does not persist the target of a cancelled internal seek', async () => {
        const seekTargets: number[] = [];
        const subtitleAtOneMinute = {
            ...subtitle,
            start: 61_000,
            end: 62_000,
            originalStart: 61_000,
            originalEnd: 62_000,
        };
        const harness = await makePlaybackEngine([PlayMode.repeat], 61_500, [subtitleAtOneMinute], {
            durationMs: 70_000,
            playbackPositionKeys: ['video.mp4'],
            seek: async (targetTimestampMs) => {
                seekTargets.push(targetTimestampMs);
            },
        });
        harness.driver.internalSeekCompletion = 'cancelled';

        await harness.driver.time(61_999);

        expect(seekTargets).toEqual([61_000]);
        expect(harness.savedSettings).toEqual([]);
    });

    it('does not produce non-finite seeks when duration is unavailable', async () => {
        const harness = await makePlaybackEngine([PlayMode.autoPause], 1500, [subtitle], { durationMs: Number.NaN });
        harness.playbackEngine.bind();

        await harness.driver.time(2100);

        expect(harness.seeks).toEqual([1999]);
    });

    it('restores engine-owned remembered modes when settings enable mode remembering', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            settings: {
                rememberPlaybackModes: false,
                lastPlaybackModes: [PlayMode.repeat],
            },
        });
        harness.playbackEngine.settingsChanged({
            ...harness.settings,
            rememberPlaybackModes: true,
            lastPlaybackModes: [PlayMode.normal],
        });

        expect(harness.modeChanges.at(-1)).toEqual({
            modes: new Set([PlayMode.repeat]),
            added: new Set([PlayMode.repeat]),
            removed: new Set([PlayMode.normal]),
        });
        expect(harness.savedSettings).toEqual([]);
    });

    it('defers remembered modes until binding when settings change before subtitles load', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [], {
            settings: {
                rememberPlaybackModes: false,
                lastPlaybackModes: [PlayMode.repeat],
            },
        });

        harness.playbackEngine.settingsChanged({
            ...harness.settings,
            rememberPlaybackModes: true,
            lastPlaybackModes: [PlayMode.repeat],
        });

        expect(harness.modeChanges).toEqual([]);
        expect(harness.initialPlaybackSettings).toEqual([]);

        harness.playbackEngine.subtitlesChanged([subtitle]);

        expect(harness.initialPlaybackSettings.at(-1)?.playbackModeTransition).toEqual({
            modes: new Set([PlayMode.repeat]),
            added: new Set([PlayMode.repeat]),
            removed: new Set([PlayMode.normal]),
        });
    });

    it('does not persist automatic mode resets while remembering is disabled', async () => {
        const resetHarness = await makePlaybackEngine([PlayMode.repeat]);
        resetHarness.playbackEngine.settingsChanged({ ...resetHarness.settings, rememberPlaybackModes: false });
        resetHarness.playbackEngine.subtitlesChanged([]);

        expect(resetHarness.savedSettings.at(-1)?.lastPlaybackModes).toEqual([PlayMode.repeat]);

        const unloadingHarness = await makePlaybackEngine([PlayMode.normal]);
        unloadingHarness.playbackEngine.togglePlaybackMode(PlayMode.repeat);
        unloadingHarness.playbackEngine.subtitlesChanged([]);

        expect(unloadingHarness.savedSettings).toContainEqual({ lastPlaybackModes: [PlayMode.repeat] });

        const suppressedHarness = await makePlaybackEngine([PlayMode.repeat]);
        suppressedHarness.playbackEngine.playbackModesSuppressedChanged(true);

        expect(suppressedHarness.savedSettings).toEqual([]);

        suppressedHarness.playbackEngine.togglePlaybackMode(PlayMode.normal);
        expect(suppressedHarness.modeChanges.at(-1)?.modes).toEqual(new Set([PlayMode.normal]));
    });

    it('restores remembered playback modes when subtitles are loaded again', async () => {
        const harness = await makePlaybackEngine([PlayMode.repeat]);

        harness.playbackEngine.subtitlesChanged([]);
        harness.playbackEngine.subtitlesChanged([subtitle]);

        expect(harness.initialPlaybackSettings.at(-1)?.playbackModeTransition.modes).toEqual(
            new Set([PlayMode.repeat])
        );
        expect(harness.driver.bound).toBe(true);
    });

    it('initializes the media rate as part of binding', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal]);
        const setPlaybackRate = jest.fn();
        const rebound = new PlaybackEngine({
            settingsProvider: {
                getAll: async () => harness.settings,
                getSingle: async () => harness.settings.lastPlaybackPositions,
                activeProfile: async () => undefined,
            } as unknown as SettingsProvider,
            appIntegration: true,
            subtitles: [subtitle],
            playbackModesDisabled: false,
            playbackModesSuppressed: false,
            playbackPositionKeys: [],
            timingDriver: new FakeTimingDriver(),
            callbacks: {
                pause: () => {},
                play: async () => {},
                seek: async () => {},
                setPlaybackRate,
                setSubtitleOffset: () => {},
                showingSubtitlesChanged: () => {},
                playbackPositionChanged: () => {},
                saveSettings: () => {},
                playbackModesChanged: () => {},
                initialPlaybackSettingsChanged: () => {},
                onError: () => {},
            },
        });

        expect(setPlaybackRate).not.toHaveBeenCalled();
        setPlaybackRate.mockClear();
        await flushPlaybackInitialization();
        rebound.settingsChanged(harness.settings);
        expect(setPlaybackRate).toHaveBeenCalledWith(harness.settings.playbackRate);
    });

    it('updates and remembers the normal plan rate while fast-forward is enabled but inactive', async () => {
        const harness = await makePlaybackEngine([PlayMode.fastForward], 1500, [subtitle], {
            settings: { rememberPlaybackRate: true },
        });
        harness.playbackEngine.bind();

        expect(harness.playbackEngine.adjustPlaybackRate(0.4)!.playbackRate).toBe(1.4);

        expect(harness.playbackRates.at(-1)).toBe(1.4);
        expect(harness.savedSettings).toContainEqual({ playbackRate: 1.4 });
        expect(harness.savedSettings).not.toContainEqual({ fastForwardModePlaybackRate: 1.4 });
    });

    it('only requests a notification when a playback rate setting changes', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal]);

        expect(harness.playbackEngine.adjustPlaybackRate(0.4)!.notify).toBe(true);
        expect(harness.playbackEngine.adjustPlaybackRate(0)!.notify).toBe(false);
    });

    it('rounds playback rates to thousandths and clamps them below the minimum', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            settings: { rememberPlaybackRate: true },
        });
        harness.playbackEngine.bind();

        expect(harness.playbackEngine.playbackRateChanged(1.23456)!.playbackRate).toBe(1.235);
        expect(harness.playbackEngine.adjustPlaybackRate(-2)!.playbackRate).toBe(0.01);
        expect(harness.playbackEngine.playbackRateChanged(6.789)!.playbackRate).toBe(6.789);
        expect(harness.playbackRates.slice(-3)).toEqual([1.235, 0.01, 6.789]);
        expect(harness.savedSettings.slice(-3)).toEqual([
            { playbackRate: 1.235 },
            { playbackRate: 0.01 },
            { playbackRate: 6.789 },
        ]);
    });

    it('updates and remembers the active fast-forward rate when remembering is enabled', async () => {
        const harness = await makePlaybackEngine([PlayMode.fastForward], 2500, [subtitle], {
            settings: { rememberPlaybackRate: true },
        });
        harness.playbackEngine.bind();

        expect(harness.playbackEngine.adjustPlaybackRate(1)!.playbackRate).toBe(3);

        expect(harness.playbackRates.at(-1)).toBe(3);
        expect(harness.savedSettings).toContainEqual({ fastForwardModePlaybackRate: 3 });
        expect(harness.savedSettings).not.toContainEqual({ playbackRate: 3 });
    });

    it('updates the active fast-forward rate when the applied media rate is stale', async () => {
        const harness = await makePlaybackEngine([PlayMode.fastForward], 0, [subtitle], {
            settings: { rememberPlaybackRate: true },
        });
        harness.playbackEngine.bind();
        harness.driver.timestampMs = 2500;

        expect(harness.playbackEngine.adjustPlaybackRate(1)!.playbackRate).toBe(3);

        expect(harness.playbackRates.at(-1)).toBe(3);
        expect(harness.savedSettings).toContainEqual({ fastForwardModePlaybackRate: 3 });
        expect(harness.savedSettings).not.toContainEqual({ playbackRate: 3 });
    });

    it('keeps assigning custom native rate changes to fast-forward', async () => {
        const harness = await makePlaybackEngine([PlayMode.fastForward], 2500, [subtitle], {
            settings: { rememberPlaybackRate: true },
        });
        harness.playbackEngine.bind();

        harness.playbackEngine.playbackRateChanged(3.1);
        harness.playbackEngine.playbackRateChanged(3.2);

        expect(harness.savedSettings).toEqual([
            { fastForwardModePlaybackRate: 3.1 },
            { fastForwardModePlaybackRate: 3.2 },
        ]);
    });

    it('does not remember the active fast-forward rate when remembering is disabled', async () => {
        const harness = await makePlaybackEngine([PlayMode.fastForward], 2500, [subtitle], {
            settings: { rememberPlaybackRate: false },
        });
        harness.playbackEngine.bind();

        expect(harness.playbackEngine.adjustPlaybackRate(1)!.playbackRate).toBe(3);

        expect(harness.savedSettings).not.toContainEqual({ fastForwardModePlaybackRate: 3 });
    });

    it('does not persist changed playback rates when unbinding with remembering disabled', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            settings: { rememberPlaybackRate: false },
        });
        harness.playbackEngine.bind();

        harness.playbackEngine.playbackRateChanged(1.7);
        harness.playbackEngine.unbind();

        expect(harness.savedSettings.at(-1)).not.toHaveProperty('playbackRate');
        expect(harness.savedSettings.at(-1)).not.toHaveProperty('fastForwardModePlaybackRate');
    });

    it('always saves the current position, even when remembering is disabled', async () => {
        jest.useFakeTimers();
        const harness = await makePlaybackEngine([PlayMode.normal], 1_000, [subtitle], {
            playbackPositionKeys: ['first.srt', 'second.srt'],
        });

        harness.playbackEngine.bind();
        await harness.driver.time(61_000);
        jest.advanceTimersByTime(10_000);
        await flushPlaybackSaves();

        expect(harness.savedSettings).toContainEqual({
            lastPlaybackPositions: [
                { fileName: 'first.srt', position: 61_000 },
                { fileName: 'second.srt', position: 61_000 },
            ],
        });
        jest.useRealTimers();
    });

    it('saves on the ten-second interval when the current time changed', async () => {
        jest.useFakeTimers();
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            playbackPositionKeys: ['video.mp4'],
        });

        harness.playbackEngine.bind();
        await harness.driver.time(61_000);
        jest.advanceTimersByTime(9_999);
        expect(harness.savedSettings).toHaveLength(0);

        await harness.driver.time(71_000);
        jest.advanceTimersByTime(1);
        await flushPlaybackSaves();
        expect(harness.savedSettings.at(-1)).toEqual({
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 71_000 }],
        });
        jest.useRealTimers();
    });

    it('offers a remembered position for explicit resumption', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 1_000, [subtitle], {
            durationMs: 70_000,
            playbackPositionKeys: ['video.mp4'],
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 63_000 }],
            },
        });

        harness.playbackEngine.bind();
        await Promise.resolve();
        expect(harness.seeks).toEqual([]);
        expect(harness.playbackPositionChanges).toEqual([63_000]);

        await harness.playbackEngine.resumePlaybackPosition();
        expect(harness.seeks).toEqual([63_000]);
        expect(harness.plays).toHaveLength(1);
        expect(harness.playbackPositionChanges).toEqual([63_000, undefined]);

        expect(harness.playbackPositionChanges).toEqual([63_000, undefined]);
    });

    it('does not resume a remembered position when playback starts normally', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 1_000, [subtitle], {
            durationMs: 70_000,
            playbackPositionKeys: ['video.mp4'],
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 63_000 }],
            },
        });

        harness.playbackEngine.bind();
        await Promise.resolve();
        await harness.driver.start();

        expect(harness.seeks).toEqual([]);
        expect(harness.playbackPositionChanges).toEqual([63_000]);
    });

    it('offers the lowest position across all restore keys only once per key set', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 1_000, [subtitle], {
            durationMs: 70_000,
            settings: {
                lastPlaybackPositions: [
                    { fileName: 'second.srt', position: 68_000 },
                    { fileName: 'first.srt', position: 63_000 },
                ],
            },
        });

        harness.playbackEngine.bind();
        harness.playbackEngine.playbackPositionKeysChanged(['first.srt', 'second.srt']);
        expect(harness.playbackPositionChanges).toEqual([63_000]);
    });

    it('starts at zero when the remembered position is at or beyond the duration', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            durationMs: 6_000,
            playbackPositionKeys: ['video.mp4'],
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 6_000 }],
            },
        });

        harness.playbackEngine.bind();
        await Promise.resolve();

        expect(harness.seeks).toEqual([]);
        expect(harness.driver.timestampMs).toBe(0);
    });

    it('saves on pause and seek discontinuities', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 62_000, [subtitle], {
            playbackPositionKeys: ['video.mp4'],
        });

        harness.playbackEngine.bind();
        harness.driver.discontinuity(62_000);
        harness.driver.callbacks.onPlaybackPaused();
        await flushPlaybackSaves();
        expect(harness.savedSettings.at(-1)).toEqual({
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 62_000 }],
        });

        harness.driver.discontinuity(64_000);
        await flushPlaybackSaves();
        expect(harness.savedSettings.at(-1)).toEqual({
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 64_000 }],
        });
    });

    it('saves the first user discontinuity after binding', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            playbackPositionKeys: ['video.mp4'],
            settingsReady: false,
            emitInitialDiscontinuity: true,
        });

        harness.resolveSettings(harness.settings);
        await Promise.resolve();
        await Promise.resolve();
        harness.driver.discontinuity(62_000);
        await flushPlaybackSaves();

        expect(harness.savedSettings).toContainEqual({
            lastPlaybackPositions: [{ fileName: 'video.mp4', position: 62_000 }],
        });
    });

    it('accepts settings refreshes without preserving stale local playback positions', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            durationMs: 70_000,
            playbackPositionKeys: ['video.mp4'],
            settingsReady: false,
            emitInitialDiscontinuity: true,
        });
        harness.resolveSettings(harness.settings);
        await flushPlaybackInitialization();
        harness.driver.discontinuity(62_000);
        await flushPlaybackSaves();

        harness.playbackEngine.settingsChanged({ ...harness.settings, lastPlaybackPositions: [] });
        harness.playbackEngine.playbackPositionKeysChanged(['other-video.mp4']);
        harness.playbackEngine.playbackPositionKeysChanged(['video.mp4']);

        expect(harness.playbackPositionChanges).toEqual([]);
    });

    it('accepts remembered positions for other playback owners during a settings refresh', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            durationMs: 70_000,
            playbackPositionKeys: ['video.mp4'],
            settingsReady: false,
            emitInitialDiscontinuity: true,
        });
        harness.resolveSettings(harness.settings);
        await flushPlaybackInitialization();
        harness.driver.discontinuity(62_000);

        harness.playbackEngine.settingsChanged({
            ...harness.settings,
            lastPlaybackPositions: [{ fileName: 'other-video.mp4', position: 63_000 }],
        });
        harness.playbackEngine.playbackPositionKeysChanged(['other-video.mp4']);

        expect(harness.playbackPositionChanges).toEqual([63_000]);
    });

    it('removes remembered positions when the current position is below one minute', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            playbackPositionKeys: ['video.mp4'],
            settings: {
                lastPlaybackPositions: [
                    { fileName: 'video.mp4', position: 90_000 },
                    { fileName: 'other-video.mp4', position: 120_000 },
                ],
            },
        });

        harness.playbackEngine.bind();
        harness.driver.callbacks.onPlaybackPaused();
        await flushPlaybackSaves();

        expect(harness.savedSettings.at(-1)).toEqual({
            lastPlaybackPositions: [{ fileName: 'other-video.mp4', position: 120_000 }],
        });
    });

    it('removes an existing sub-minute position instead of offering it for resumption', async () => {
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            playbackPositionKeys: ['video.mp4'],
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 30_000 }],
            },
        });

        harness.playbackEngine.bind();
        await Promise.resolve();
        await flushPlaybackSaves();

        expect(harness.savedSettings).toEqual([{ lastPlaybackPositions: [] }]);
        expect(harness.playbackPositionChanges).toEqual([]);
    });

    it('resumes from the start of a subtitle when the remembered position is inside it', async () => {
        const subtitleAtOneMinute = {
            ...subtitle,
            start: 61_000,
            end: 62_000,
            originalStart: 61_000,
            originalEnd: 62_000,
        };
        const harness = await makePlaybackEngine([PlayMode.normal], 0, [subtitleAtOneMinute], {
            durationMs: 70_000,
            playbackPositionKeys: ['video.mp4'],
            settings: {
                lastPlaybackPositions: [{ fileName: 'video.mp4', position: 61_500 }],
            },
        });

        harness.playbackEngine.bind();
        await Promise.resolve();
        await harness.playbackEngine.resumePlaybackPosition();

        expect(harness.seeks).toEqual([61_000]);
        expect(harness.plays).toHaveLength(1);
    });
});
