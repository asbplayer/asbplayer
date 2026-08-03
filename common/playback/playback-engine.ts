import type { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import { isTrackSeekable } from '@project/common/settings';
import type { IndexedSubtitleModel } from '@project/common';
import { PlayMode } from '@project/common';
import {
    buildPlaybackPlan,
    playbackPlansEqual,
    type PlaybackPlan,
    playbackPlanCorrectionToleranceMs,
} from '@project/common/playback/plan/playback-plan';
import PlaybackPlanExecutor, {
    type PlaybackPlanExecutorCallbacks,
} from '@project/common/playback/plan/playback-plan-executor';
import PlaybackModeController, {
    minimumPlaybackRate,
    normalizePlaybackRate,
    playbackModeNotifications,
    playbackModesFromSettings,
    type PlayModeTransition,
} from '@project/common/playback/controllers/playback-mode-controller';
import PlaybackPositionController from '@project/common/playback/controllers/playback-position-controller';
import type { TimingDriver } from '@project/common/playback/timing/timing-driver';
import { CachedLocalStorage } from '@project/common/app/services/cached-local-storage';

const internalSeekWatchdogMs = 10_000;
const subtitleOffsetStorageKey = 'offset';

export interface SubtitleOffsetOptions {
    readonly notifyPlayer: boolean;
}

export interface InitialPlaybackSettings {
    readonly playbackRate: number;
    readonly playbackRateNotificationEnabled: boolean;
    readonly fastForwarding: boolean;
    readonly subtitleOffset: number;
    readonly playbackModeTransition: PlayModeTransition;
    readonly join: string;
}

export interface PlaybackEngineCallbacks<T extends IndexedSubtitleModel> {
    readonly pause: () => void;
    readonly play: () => Promise<void>;
    readonly seek: (timestampMs: number) => Promise<void>;
    readonly setPlaybackRate: (playbackRate: number) => void;
    readonly setSubtitleOffset: (offset: number, options: SubtitleOffsetOptions) => void;
    readonly showingSubtitlesChanged: (subtitles: readonly T[]) => void;
    readonly playbackPositionChanged: (position: number | undefined) => void;
    readonly saveSettings: (settings: Partial<AsbplayerSettings>) => void;
    readonly playbackModesChanged: (transition: PlayModeTransition) => void;
    readonly initialPlaybackSettingsChanged: (settings: InitialPlaybackSettings) => void;
    readonly onError: (error: unknown) => void;
}

export interface PlaybackEngineOptions<T extends IndexedSubtitleModel> {
    readonly settingsProvider: SettingsProvider;
    readonly appIntegration: boolean;
    readonly subtitles: readonly T[];
    readonly playbackModesDisabled: boolean;
    readonly playbackModesSuppressed: boolean;
    readonly playbackPositionKeys: readonly string[];
    readonly callbacks: PlaybackEngineCallbacks<T>;
    readonly timingDriver: TimingDriver;
}

/**
 * Owns playback settings, plan lifecycle, timing, and discontinuity policy for a media adapter.
 * The caller owns the media controls and supplies them through callbacks. The media owners can
 * also notify of certain events through methods as well. Generally, PlaybackEngine should own
 * controlling the media and attaching to their related events. However things such as 'canplay' or
 * workarounds for certain sites should live outside this class to not complicate its responsibilities.
 *
 * Binding/VideoPlayer/Player
 * ├── Clock (VideoPlayer/Player)
 * └── PlaybackEngine
 *     ├── VideoFrameTimingDriver (Player: AnimationFrameTimingDriver)
 *     │   └── TimingUpdateQueue
 *     ├── PlaybackModeController
 *     ├── PlaybackPositionController
 *     ├── PlaybackPlan
 *     └── PlaybackPlanExecutor
 *         ├── PlaybackTimeline
 *         │   └── PlaybackTimelineCompiler
 *         ├── PlaybackTimelineRunner
 *         │   └── PlaybackTimelineCursor
 *         └── PlaybackTimelineLookaheadCursor
 */
export default class PlaybackEngine<T extends IndexedSubtitleModel> {
    private settings: AsbplayerSettings;
    private readonly appIntegration: boolean;
    private readonly subtitleOffsetStorage = new CachedLocalStorage();
    private subtitles: readonly T[];
    private ready: { settings: boolean; subtitles: boolean };
    private playbackModesSuppressed: boolean;
    private plan: PlaybackPlan<T>;
    private readonly playbackModeController: PlaybackModeController;
    private readonly executor: PlaybackPlanExecutor<T>;
    private readonly callbacks: PlaybackEngineCallbacks<T>;
    private readonly timingDriver: TimingDriver;
    private readonly playbackPositionController: PlaybackPositionController<T>;

    constructor({
        settingsProvider,
        appIntegration,
        subtitles,
        playbackModesDisabled,
        playbackModesSuppressed,
        playbackPositionKeys,
        callbacks,
        timingDriver,
    }: PlaybackEngineOptions<T>) {
        this.settings = {} as AsbplayerSettings;
        this.appIntegration = appIntegration;
        this.subtitles = subtitles;
        this.ready = { settings: false, subtitles: subtitles.length > 0 };
        this.playbackModesSuppressed = playbackModesSuppressed;
        this.playbackModeController = new PlaybackModeController(new Set([PlayMode.normal]), playbackModesDisabled);
        this.callbacks = callbacks;
        this.timingDriver = timingDriver;
        this.plan = this.buildPlan();

        const executorCallbacks: PlaybackPlanExecutorCallbacks<T> = {
            play: callbacks.play,
            paused: () => this.timingDriver.paused(),
            pause: () => {
                callbacks.pause();
                this.playbackPositionController.savePlaybackPosition(this.timingDriver.currentTimeMs());
            },
            seek: (targetTimestampMs) => this.seek(targetTimestampMs),
            setPlaybackRate: (playbackRate) => {
                if (!this.timingDriver.bound) return;
                if (!Number.isFinite(playbackRate)) return;
                this.callbacks.setPlaybackRate(playbackRate);
                const actualPlaybackRate = this.timingDriver.playbackRate();
                if (
                    actualPlaybackRate !== undefined &&
                    (!Number.isFinite(actualPlaybackRate) ||
                        Math.abs(actualPlaybackRate - playbackRate) > minimumPlaybackRate)
                ) {
                    console.warn('[asbplayer/playback] Playback rate command was not respected', {
                        requestedPlaybackRate: playbackRate,
                        actualPlaybackRate,
                    });
                }
            },
            correctAutoPause: async (targetTimestampMs) => {
                return this.correctTimestamp(targetTimestampMs, 'pause-correction');
            },
            showingSubtitlesChanged: (subtitles) => {
                callbacks.showingSubtitlesChanged(subtitles);
            },
        };
        this.executor = new PlaybackPlanExecutor(this.plan, this.timingDriver.currentTimeMs(), executorCallbacks);
        this.playbackPositionController = new PlaybackPositionController({
            playbackPositionKeys,
            currentTimeMs: () => this.timingDriver.currentTimeMs(),
            durationMs: () => this.timingDriver.durationMs(),
            callbacks: {
                saveSettings: (settings) => {
                    this.settings = { ...this.settings, ...settings };
                    callbacks.saveSettings(settings);
                },
                playbackPositionChanged: callbacks.playbackPositionChanged,
                seek: (timestampMs) => this.seek(timestampMs),
                play: callbacks.play,
                showingSubtitlesAt: (timestampMs) => this.executor.showingSubtitlesAt(timestampMs),
            },
        });
        this.timingDriver.setCallbacks({
            onTime: (currentTimestampMs, { lookaheadTimestampMs }) => {
                return this.executor.update(currentTimestampMs, { lookaheadTimestampMs });
            },
            onPlaybackPaused: () => this.playbackPositionController.playbackPaused(),
            onDiscontinuity: (currentTimestampMs) => {
                this.playbackPositionController.discontinuity(currentTimestampMs);
                this.executor.handleDiscontinuity(currentTimestampMs);
            },
            onCancel: (options) => this.executor.cancelPendingOperations(options),
            onPlaybackStarted: () => this.executor.playbackStarted(),
            onError: callbacks.onError,
        });
        void this.initializeSettings(settingsProvider);
    }

    private async initializeSettings(settingsProvider: SettingsProvider): Promise<void> {
        this.settings = await settingsProvider.getAll();
        this.playbackPositionController.setSettings(this.settings);
        this.ready.settings = true;
        this.bind();
    }

    get lastSubtitleOffset(): number {
        if (!this.settings.rememberSubtitleOffset) return 0;
        if (this.appIntegration) return this.settings.lastSubtitleOffset;
        const value = this.subtitleOffsetStorage.get(subtitleOffsetStorageKey);
        return value === null ? 0 : Number(value);
    }

    get playbackModes(): Set<PlayMode> {
        return this.playbackModeController.playModes;
    }

    bind(): void {
        if (this.timingDriver.bound) return;
        if (!this.ready.settings || !this.ready.subtitles) return;

        this.timingDriver.bind();
        this.playbackPositionController.bind();

        const playbackModeTransition = this.playbackModeController.setModes(playbackModesFromSettings(this.settings));
        this.executor.initializePlaybackRate(this.timingDriver.currentTimeMs());
        this.timingDriver.onDurationChange();

        this.rebuildPlan();

        const { join } = playbackModeNotifications(playbackModeTransition);
        this.callbacks.initialPlaybackSettingsChanged({
            playbackRate: this.executor.isFastForwarding ? this.plan.fastForward!.playbackRate : this.plan.playbackRate,
            playbackRateNotificationEnabled: this.settings.playbackRateNotificationEnabled,
            fastForwarding: this.executor.isFastForwarding,
            subtitleOffset: this.lastSubtitleOffset,
            playbackModeTransition,
            join,
        });
    }

    unbind(): void {
        if (!this.timingDriver.bound) return;
        this.playbackPositionController.unbind();
        this.timingDriver.unbind();
        // Need to update these as PlaybackEngine doesn't keep them all synced with external settings.
        // This relies on the fact playbackRate is not considered a save only setting thus publishing the new settings.
        this.callbacks.saveSettings({
            playbackRate: this.settings.playbackRate,
            fastForwardModePlaybackRate: this.settings.fastForwardModePlaybackRate,
            lastPlaybackModes: this.settings.lastPlaybackModes,
            ...(this.appIntegration ? { lastSubtitleOffset: this.settings.lastSubtitleOffset } : {}),
            lastPlaybackPositions: this.settings.lastPlaybackPositions,
        });
    }

    settingsChanged(settings: AsbplayerSettings): void {
        if (!this.ready.settings) return;
        const rememberPlaybackModesNow =
            !this.settings.rememberPlaybackModes && settings.rememberPlaybackModes && this.timingDriver.bound;
        // PlaybackEngine is the single source of truth for these settings and may not push updates to the settings from outside.
        this.settings = {
            ...settings,
            playbackRate: this.settings.playbackRate,
            fastForwardModePlaybackRate: this.settings.fastForwardModePlaybackRate,
            lastPlaybackModes: this.settings.lastPlaybackModes,
            ...(this.appIntegration ? { lastSubtitleOffset: this.settings.lastSubtitleOffset } : {}),
        };
        this.settings = this.playbackPositionController.settingsChanged(this.settings)!;
        this.bind();
        if (rememberPlaybackModesNow) {
            this.applyPlaybackModeTransition(
                this.playbackModeController.setModes(playbackModesFromSettings(this.settings)),
                { savePlaybackModes: false, rebuildWhenUnchanged: true }
            );
        } else {
            this.rebuildPlan();
        }
    }

    playbackPositionKeysChanged(playbackPositionKeys: readonly string[]): void {
        this.playbackPositionController.playbackPositionKeysChanged(playbackPositionKeys);
    }

    subtitlesChanged(subtitles: readonly T[]): void {
        const hadSubtitles = this.ready.subtitles;
        this.subtitles = subtitles;
        if (subtitles.length) {
            this.ready.subtitles = true;
            this.bind();
            if (hadSubtitles) this.rebuildPlan();
        } else if (this.ready.subtitles) {
            this.ready.subtitles = false;
            this.applyPlaybackModeTransition(this.playbackModeController.setModes(new Set([PlayMode.normal])), {
                savePlaybackModes: false,
                rebuildWhenUnchanged: true,
            }); // Reset to normal while subtitles are unavailable
            this.unbind();
        }
    }

    playbackRateChanged(playbackRate: number):
        | {
              readonly notify: boolean;
              readonly playbackRate: number;
              readonly locKey: string;
          }
        | undefined {
        if (!this.timingDriver.bound) return;
        const isFastForwarding = this.executor.isFastForwarding;
        const setting = isFastForwarding ? 'fastForwardModePlaybackRate' : 'playbackRate';
        const locKey = isFastForwarding ? 'info.fastForwardPlaybackRate' : 'info.playbackRate';
        const normalizedPlaybackRate = normalizePlaybackRate(playbackRate);
        if (normalizedPlaybackRate === undefined || this.settings[setting] === normalizedPlaybackRate) {
            return { notify: false, playbackRate: this.settings[setting], locKey };
        }
        this.settings = { ...this.settings, [setting]: normalizedPlaybackRate };
        if (!this.rebuildPlan()) return { notify: false, playbackRate: this.settings[setting], locKey };
        if (this.settings.rememberPlaybackRate) {
            this.callbacks.saveSettings({ [setting]: normalizedPlaybackRate });
        }
        return { notify: this.settings.playbackRateNotificationEnabled, playbackRate: normalizedPlaybackRate, locKey };
    }

    subtitleOffsetChanged(offset: number, options: SubtitleOffsetOptions): void {
        if (!this.timingDriver.bound) return;
        if (this.appIntegration) {
            this.settings = { ...this.settings, lastSubtitleOffset: offset };
            this.callbacks.saveSettings({ lastSubtitleOffset: offset });
        } else {
            this.subtitleOffsetStorage.set(subtitleOffsetStorageKey, String(offset));
        }
        this.callbacks.setSubtitleOffset(offset, options);
    }

    adjustPlaybackRate(delta: number): ReturnType<typeof this.playbackRateChanged> {
        if (!this.timingDriver.bound) return;
        const isFastForwarding = this.executor.isFastForwarding;
        const playbackRate = isFastForwarding ? this.plan.fastForward!.playbackRate : this.plan.playbackRate;
        const locKey = isFastForwarding ? 'info.fastForwardPlaybackRate' : 'info.playbackRate';
        if (!delta || !Number.isFinite(delta)) return { notify: false, playbackRate, locKey };
        return this.playbackRateChanged(playbackRate + delta);
    }

    durationChanged(durationMs: number): void {
        if (!Number.isFinite(durationMs) || durationMs === this.plan.timelineSubtitles.durationMs) return;
        this.rebuildPlan();
    }

    playbackModesSuppressedChanged(suppressed: boolean): void {
        if (this.playbackModesSuppressed === suppressed) return;
        this.playbackModesSuppressed = suppressed;
        this.rebuildPlan();
    }

    togglePlaybackMode(targetMode: PlayMode): void {
        if (!this.timingDriver.bound) return;
        const transition = this.playbackModeController.transition(targetMode);
        this.applyPlaybackModeTransition(transition, { savePlaybackModes: true, rebuildWhenUnchanged: false });
    }

    dismissPlaybackPosition(): void {
        this.playbackPositionController.dismissPlaybackPosition();
    }

    async resumePlaybackPosition(): Promise<void> {
        await this.playbackPositionController.resumePlaybackPosition();
    }

    /** Reports a discontinuity from a non-standard media adapter, such as Disney+'s page-script seek event. */
    seeked(timestampMs: number): void {
        if (this.timingDriver.externalSeekEvents) {
            this.timingDriver.externalSeeked!(timestampMs);
            return;
        }
        this.executor.handleDiscontinuity(timestampMs);
    }

    /** Reports that a seek operation has started from a non-standard media adapter, such as Disney+'s page-script seek event. */
    seekStarted(): void {
        if (this.timingDriver.externalSeekEvents) {
            this.timingDriver.externalSeekStarted!();
            return;
        }
        this.executor.cancelPendingOperations({ preserveExpectedDiscontinuity: false });
    }

    /** Reports that a seek operation has been canceled from a non-standard media adapter, such as Disney+'s page-script seek event. */
    seekCanceled(): void {
        if (this.timingDriver.externalSeekEvents) {
            this.timingDriver.externalSeekCanceled!();
            return;
        }
        this.timingDriver.cancelExpectedInternalSeek();
        this.executor.cancelPendingOperations({ preserveExpectedDiscontinuity: false });
    }

    private buildPlan(): PlaybackPlan<T> {
        const displaySubtitles = this.subtitles;
        const effectiveModes = this.playbackModesSuppressed
            ? new Set([PlayMode.normal])
            : this.playbackModeController.playModes;

        return buildPlaybackPlan({
            subtitles: displaySubtitles.filter((subtitle) =>
                isTrackSeekable(this.settings.seekableTracks, subtitle.track)
            ),
            displaySubtitles,
            durationMs: this.timingDriver.durationMs(),
            playModes: effectiveModes,
            autoPausePreference: this.settings.autoPausePreference,
            subtitleTriggerStartOffset: this.settings.subtitleTriggerStartOffset,
            subtitleTriggerEndOffset: this.settings.subtitleTriggerEndOffset,
            subtitleTriggerGapEndOffset: this.settings.subtitleTriggerGapEndOffset,
            subtitleTriggerGapStartOffset: this.settings.subtitleTriggerGapStartOffset,
            repeatCountPreference: this.settings.repeatCountPreference,
            condensedPlaybackMinimumSkipIntervalMs: this.settings.streamingCondensedPlaybackMinimumSkipIntervalMs,
            playbackRate: this.settings.playbackRate,
            fastForwardModePlaybackRate: this.settings.fastForwardModePlaybackRate,
            fastForwardPlaybackMinimumSkipIntervalMs: this.settings.fastForwardPlaybackMinimumSkipIntervalMs,
        });
    }

    /**
     * We prefer simply rebuilding the plan unconditionally rather than trying to optimize for specific cases.
     * It takes <1ms to build thus completely negligible. Any runtime check that can be encoded as a part of
     * the plan or timeline should as rebuilding to update them is always preferred. It also serves to simplify
     * the overall logic by reducing runtime checks.
     */
    private rebuildPlan(): boolean {
        const plan = this.buildPlan();
        if (playbackPlansEqual(this.plan, plan)) return false;
        this.plan = plan;
        this.executor.replacePlan(this.plan, this.timingDriver.currentTimeMs());
        return true;
    }

    private applyPlaybackModeTransition(
        transition: PlayModeTransition,
        options: { readonly savePlaybackModes: boolean; readonly rebuildWhenUnchanged: boolean }
    ): void {
        if (!transition.added.size && !transition.removed.size) {
            if (options.rebuildWhenUnchanged) this.rebuildPlan();
            return;
        }
        this.rebuildPlan();
        if (options.savePlaybackModes) {
            const lastPlaybackModes = [...transition.modes];
            this.settings = { ...this.settings, lastPlaybackModes };
            this.callbacks.saveSettings({ lastPlaybackModes });
        }
        this.callbacks.playbackModesChanged(transition);
    }

    private async seek(timestampMs: number): Promise<void> {
        const targetTimestampMs = this.clampTimestamp(timestampMs);
        await this.performSeek(targetTimestampMs, 'seek');
    }

    private async correctTimestamp(
        timestampMs: number,
        warningCommand: 'pause-correction'
    ): Promise<{ seekIssued: boolean }> {
        const targetTimestampMs = this.clampTimestamp(timestampMs);
        if (Math.abs(this.timingDriver.currentTimeMs() - targetTimestampMs) < playbackPlanCorrectionToleranceMs) {
            return { seekIssued: false };
        }
        await this.performSeek(targetTimestampMs, warningCommand);
        return { seekIssued: true };
    }

    private async performSeek(targetTimestampMs: number, warningCommand: 'seek' | 'pause-correction'): Promise<void> {
        const seekCompletion = this.timingDriver.beginInternalSeek();
        let watchdogHandle: ReturnType<typeof setTimeout> | undefined;
        const watchdog = new Promise<'cancelled'>((resolve) => {
            watchdogHandle = setTimeout(() => {
                console.warn('[asbplayer/playback] Internal seek did not complete before the watchdog timeout', {
                    targetTimestampMs,
                    timeoutMs: internalSeekWatchdogMs,
                });
                this.timingDriver.cancelExpectedInternalSeek();
                resolve('cancelled');
            }, internalSeekWatchdogMs);
        });
        try {
            await this.callbacks.seek(targetTimestampMs);
            if ((await Promise.race([seekCompletion, watchdog])) !== 'completed') return;
            this.warnIfTimestampMismatch(warningCommand, targetTimestampMs);
            this.playbackPositionController.savePlaybackPosition(targetTimestampMs);
        } catch (error) {
            this.timingDriver.cancelExpectedInternalSeek();
            throw error;
        } finally {
            if (watchdogHandle !== undefined) clearTimeout(watchdogHandle);
        }
    }

    private warnIfTimestampMismatch(command: 'seek' | 'pause-correction', targetTimestampMs: number): void {
        const actualTimestampMs = this.timingDriver.currentTimeMs();
        const frameTimeMs = this.timingDriver.frameTimeMs();
        if (frameTimeMs <= 0 || Math.abs(actualTimestampMs - targetTimestampMs) <= frameTimeMs / 2) return;
        console.warn(`[asbplayer/playback] ${command} command has a timestamp mismatch`, {
            targetTimestampMs,
            actualTimestampMs,
            frameTimeMs,
        });
    }

    private clampTimestamp(timestampMs: number): number {
        if (!Number.isFinite(timestampMs)) return 0;
        const durationMs = this.timingDriver.durationMs();
        if (!Number.isFinite(durationMs)) return Math.max(0, timestampMs);
        return Math.max(0, Math.min(durationMs, timestampMs));
    }
}
