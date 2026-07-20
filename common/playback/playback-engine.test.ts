import { describe, expect, it, jest } from '@jest/globals';
import { AutoPausePreference, type IndexedSubtitleModel, PlayMode } from '@project/common';
import { defaultSettings, type AsbplayerSettings } from '@project/common/settings';
import PlaybackEngine from '@project/common/playback/playback-engine';
import type { TimingDriver, TimingDriverCallbacks } from '@project/common/playback/timing-driver';

class FakeTimingDriver implements TimingDriver {
    callbacks: TimingDriverCallbacks = {
        onTime: async () => {},
        onPlaybackStarted: async () => {},
        onDiscontinuity: () => {},
        onCancel: () => {},
        onError: () => {},
    };
    bound = false;
    bindCalls = 0;
    unbindCalls = 0;
    timestampMs = 0;
    durationMsValue = 6000;
    durationMsReads = 0;
    isPaused = false;

    bind(): void {
        if (this.bound) return;
        this.bindCalls += 1;
        this.bound = true;
    }

    unbind(): void {
        if (!this.bound) return;
        this.unbindCalls += 1;
        this.bound = false;
    }

    setCallbacks(callbacks: TimingDriverCallbacks): void {
        this.callbacks = callbacks;
    }

    currentTimeMs(): number {
        return this.timestampMs;
    }

    durationMs(): number {
        this.durationMsReads += 1;
        return this.durationMsValue;
    }

    paused(): boolean {
        return this.isPaused;
    }

    async time(timestampMs: number, lookaheadTimestampMs?: number): Promise<void> {
        this.timestampMs = timestampMs;
        await this.callbacks.onTime(timestampMs, lookaheadTimestampMs);
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
    playbackModeStartOffset: 0,
    playbackModeEndOffset: 0,
    playbackModesStartGap: 0,
    playbackModesEndGap: 0,
    repeatCountPreference: 0,
    streamingCondensedPlaybackMinimumSkipIntervalMs: 500,
    playbackRate: 1,
    fastForwardModePlaybackRate: 2,
    fastForwardPlaybackMinimumSkipIntervalMs: 500,
    ...overrides,
});

function makePlaybackEngine(
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
    }> = {}
) {
    const driver = new FakeTimingDriver();
    driver.timestampMs = timestampMs;
    driver.isPaused = overrides.paused ?? false;
    driver.durationMsValue = overrides.durationMs ?? 6000;
    const seeks: number[] = [];
    const showing: (readonly IndexedSubtitleModel[])[] = [];
    const pauses: number[] = [];
    const plays: number[] = [];
    const savedSettings: Partial<AsbplayerSettings>[] = [];
    const playbackRates: number[] = [];
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
    const playbackEngine = new PlaybackEngine({
        settings,
        subtitles,
        ready: { settings: overrides.settingsReady ?? true },
        subtitleOffsetMs: 0,
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
                    return Promise.resolve();
                }),
            setPlaybackRate: (playbackRate) => playbackRates.push(playbackRate),
            showingSubtitlesChanged: (values) => showing.push(values),
            saveSettings: (settings) => savedSettings.push(settings),
            playbackModesChanged: (transition) => modeChanges.push(transition),
            onError: () => {},
        },
    });
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
        settings,
        setDuration: (value: number) => {
            driver.durationMsValue = value;
        },
    };
}

describe('PlaybackEngine', () => {
    it('owns playback modes and rebuilds behavior from AsbplayerSettings', async () => {
        const harness = makePlaybackEngine([PlayMode.normal], 1500);

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

    it('does not bind timing without subtitles', () => {
        const driver = new FakeTimingDriver();
        const playbackEngine = new PlaybackEngine<IndexedSubtitleModel>({
            settings: playbackSettings(),
            subtitles: [],
            ready: { settings: true },
            subtitleOffsetMs: 0,
            timingDriver: driver,
            callbacks: {
                pause: () => {},
                play: async () => {},
                seek: async () => {},
                setPlaybackRate: () => {},
                showingSubtitlesChanged: () => {},
                saveSettings: () => {},
                playbackModesChanged: () => {},
                onError: () => {},
            },
        });

        playbackEngine.bind();
        playbackEngine.bind();
        expect(driver.bound).toBe(false);
        expect(driver.bindCalls).toBe(0);

        playbackEngine.durationChanged(6000);
        playbackEngine.subtitlesChanged([subtitle]);
        expect(driver.bound).toBe(true);
        expect(driver.bindCalls).toBe(1);

        playbackEngine.bind();
        expect(driver.bindCalls).toBe(1);
    });

    it('does not bind until settings are ready', () => {
        const harness = makePlaybackEngine([PlayMode.normal], 0, [subtitle], { settingsReady: false });

        harness.playbackEngine.bind();

        expect(harness.driver.bound).toBe(false);
        expect(harness.driver.bindCalls).toBe(0);

        harness.playbackEngine.settingsChanged(harness.settings);

        expect(harness.driver.bound).toBe(true);
        expect(harness.driver.bindCalls).toBe(1);
    });

    it('unbinds timing only once', () => {
        const harness = makePlaybackEngine([PlayMode.normal]);

        harness.playbackEngine.bind();
        harness.playbackEngine.unbind();
        harness.playbackEngine.unbind();

        expect(harness.driver.unbindCalls).toBe(1);
    });

    it('shows remembered enabled modes when binding', () => {
        const harness = makePlaybackEngine([PlayMode.repeat]);

        harness.playbackEngine.bind();

        expect(harness.modeChanges.at(-1)).toEqual({
            modes: new Set([PlayMode.repeat]),
            added: new Set(),
            removed: new Set(),
        });
    });

    it('does not reconcile the executor for settings that produce an equal plan', () => {
        const harness = makePlaybackEngine([PlayMode.normal], 1500);
        const showingCount = harness.showing.length;

        harness.playbackEngine.settingsChanged({ ...harness.settings, language: 'ja' });

        expect(harness.showing).toHaveLength(showingCount);
    });

    it('does not rebuild the plan when the duration is unchanged', () => {
        const harness = makePlaybackEngine([PlayMode.normal]);
        harness.driver.durationMsReads = 0;

        harness.playbackEngine.durationChanged(6000);
        expect(harness.driver.durationMsReads).toBe(0);

        harness.setDuration(7000);
        harness.playbackEngine.durationChanged(7000);
        expect(harness.driver.durationMsReads).toBe(1);
    });

    it('reconciles persistent state through a user discontinuity', () => {
        const harness = makePlaybackEngine([PlayMode.normal]);
        harness.playbackEngine.bind();

        harness.driver.discontinuity(1500);

        expect(harness.showing.at(-1)).toEqual([subtitle]);
    });

    it('preserves internal repeat state when its discontinuity arrives', async () => {
        const harness = makePlaybackEngine([PlayMode.repeat], 1500);
        harness.playbackEngine.bind();

        await harness.driver.time(1999);
        harness.driver.discontinuity(1000);
        await harness.driver.time(1999);

        expect(harness.seeks).toEqual([1000, 1000]);
    });

    it('resumes through the adapter after a condensed seek', async () => {
        const harness = makePlaybackEngine([PlayMode.condensed], 1500, [subtitle, secondSubtitle]);
        harness.playbackEngine.bind();

        await harness.driver.time(2000);

        expect(harness.seeks).toEqual([3999]);
        expect(harness.plays).toEqual([2000]);
    });

    it('shifts playback boundaries when the media owner reports an absolute subtitle offset', async () => {
        const harness = makePlaybackEngine([PlayMode.autoPause], 500, [subtitle], {
            settings: { autoPausePreference: AutoPausePreference.atStart },
        });

        harness.playbackEngine.subtitleOffsetChanged(1000);
        await harness.driver.time(1500);
        expect(harness.pauses).toEqual([]);

        await harness.driver.time(2000);
        expect(harness.pauses).toEqual([2000]);
    });

    it('uses timing-driver time and engine correction tolerance for auto-pause seeks', async () => {
        const harness = makePlaybackEngine([PlayMode.autoPause], 1500);

        await harness.driver.time(2100);

        expect(harness.pauses).toEqual([2100]);
        expect(harness.seeks).toEqual([1999]);
    });

    it('does not produce non-finite seeks when duration is unavailable', async () => {
        const harness = makePlaybackEngine([PlayMode.autoPause], 1500, [subtitle], { durationMs: Number.NaN });
        harness.playbackEngine.bind();

        await harness.driver.time(2100);

        expect(harness.seeks).toEqual([1999]);
    });

    it('restores remembered modes when settings enable mode remembering', () => {
        const harness = makePlaybackEngine([PlayMode.normal], 0, [subtitle], {
            settings: { rememberPlaybackModes: false },
        });
        harness.playbackEngine.settingsChanged({
            ...harness.settings,
            rememberPlaybackModes: true,
            lastPlaybackModes: [PlayMode.repeat],
        });

        expect(harness.modeChanges.at(-1)?.modes).toEqual(new Set([PlayMode.repeat]));
        expect(harness.modeChanges.at(-1)).toEqual({
            modes: new Set([PlayMode.repeat]),
            added: new Set([PlayMode.repeat]),
            removed: new Set([PlayMode.normal]),
        });
        expect(harness.savedSettings).toEqual([]);
    });

    it('does not persist automatic mode resets or temporary suppression', () => {
        const resetHarness = makePlaybackEngine([PlayMode.repeat]);
        resetHarness.playbackEngine.settingsChanged({ ...resetHarness.settings, rememberPlaybackModes: false });
        resetHarness.playbackEngine.subtitlesChanged([]);

        expect(resetHarness.savedSettings).toEqual([]);

        const suppressedHarness = makePlaybackEngine([PlayMode.repeat]);
        suppressedHarness.playbackEngine.playbackModesSuppressedChanged(true);

        expect(suppressedHarness.savedSettings).toEqual([]);

        suppressedHarness.playbackEngine.togglePlaybackMode(PlayMode.normal);
        expect(suppressedHarness.modeChanges.at(-1)?.modes).toEqual(new Set([PlayMode.normal]));
    });

    it('initializes the media rate as part of binding', () => {
        const harness = makePlaybackEngine([PlayMode.normal]);
        const setPlaybackRate = jest.fn();
        const rebound = new PlaybackEngine({
            settings: harness.settings,
            subtitles: [subtitle],
            ready: { settings: true },
            subtitleOffsetMs: 0,
            timingDriver: harness.driver,
            callbacks: {
                pause: () => {},
                play: async () => {},
                seek: async () => {},
                setPlaybackRate,
                showingSubtitlesChanged: () => {},
                saveSettings: () => {},
                playbackModesChanged: () => {},
                onError: () => {},
            },
        });

        expect(setPlaybackRate).not.toHaveBeenCalled();
        rebound.bind();
        expect(setPlaybackRate).toHaveBeenCalledWith(harness.settings.playbackRate);
    });

    it('updates and remembers the normal plan rate while fast-forward is enabled but inactive', () => {
        const harness = makePlaybackEngine([PlayMode.fastForward], 1500, [subtitle], {
            settings: { rememberPlaybackRate: true },
        });
        harness.playbackEngine.bind();

        harness.playbackEngine.setPlaybackRate(1.4);

        expect(harness.playbackRates.at(-1)).toBe(1.4);
        expect(harness.savedSettings).toContainEqual({ playbackRate: 1.4 });
        expect(harness.savedSettings).not.toContainEqual({ fastForwardModePlaybackRate: 1.4 });
    });

    it('updates and remembers the active fast-forward rate when remembering is enabled', () => {
        const harness = makePlaybackEngine([PlayMode.fastForward], 2500, [subtitle], {
            settings: { rememberPlaybackRate: true },
        });
        harness.playbackEngine.bind();

        harness.playbackEngine.setPlaybackRate(3);

        expect(harness.playbackRates.at(-1)).toBe(3);
        expect(harness.savedSettings).toContainEqual({ fastForwardModePlaybackRate: 3 });
        expect(harness.savedSettings).not.toContainEqual({ playbackRate: 3 });
    });

    it('does not remember the active fast-forward rate when remembering is disabled', () => {
        const harness = makePlaybackEngine([PlayMode.fastForward], 2500, [subtitle], {
            settings: { rememberPlaybackRate: false },
        });
        harness.playbackEngine.bind();

        harness.playbackEngine.setPlaybackRate(3);

        expect(harness.savedSettings).not.toContainEqual({ fastForwardModePlaybackRate: 3 });
    });
});
