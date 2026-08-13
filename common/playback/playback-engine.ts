import {
    defaultSettings,
    isTrackSeekable,
    type AsbplayerSettings,
    type SettingsProvider,
} from '@project/common/settings';
import type { IndexedSubtitleModel, PlaybackState } from '@project/common';
import { PlayMode } from '@project/common';
import { formatAsSignedMs } from '@project/common/util';
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
import PlaybackStateController from '@project/common/playback/controllers/playback-state-controller';
import type { TimingDriver } from '@project/common/playback/timing/timing-driver';
import { CachedLocalStorage } from '@project/common/app/services/cached-local-storage';

const internalSeekWatchdogMs = 10_000;
const subtitleOffsetStorageKey = 'offset';
const initialPlaybackSettingsAutoHideDurationMs = 6000;

export interface SubtitleOffsetOptions {
    readonly notifyPlayer: boolean;
}

export interface InitialPlaybackSettings {
    readonly autoHideDuration: number;
    readonly playbackRate: number;
    readonly subtitleOffset: number;
    readonly playbackModeTransition: PlayModeTransition;
    readonly notifications: InitialPlaybackSettingsNotifications;
}

export interface PlaybackRateNotification {
    readonly locKey: string;
    readonly replacements: { readonly rate: string };
}

export function formatPlaybackRateNotification(playbackRate: number, locKey: string): PlaybackRateNotification {
    return {
        locKey,
        replacements: {
            rate: String(Number(playbackRate.toFixed(2))),
        },
    };
}

export type InitialPlaybackNotification =
    | { readonly type: 'message'; readonly message: string }
    | { readonly type: 'translation'; readonly notification: PlaybackRateNotification };

export interface InitialPlaybackSettingsNotifications {
    readonly offsetAndRate: InitialPlaybackNotification[];
    readonly playbackMode: ReturnType<typeof playbackModeNotifications>;
}

export interface PlaybackEngineCallbacks {
    readonly pause: () => void;
    readonly play: () => Promise<void>;
    readonly seek: (timestampMs: number) => Promise<void>;
    readonly setPlaybackRate: (playbackRate: number) => void;
    readonly setSubtitleOffset: (offset: number, options: SubtitleOffsetOptions) => void;
    readonly playbackStateChanged: (state: PlaybackState) => void;
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
    readonly callbacks: PlaybackEngineCallbacks;
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
    private lastSubtitleEndMs?: number;
    private ready: { settings: boolean; subtitles: boolean };
    private playbackModesSuppressed: boolean;
    private plan: PlaybackPlan<T>;
    private readonly playbackModeController: PlaybackModeController;
    private readonly executor: PlaybackPlanExecutor<T>;
    private readonly callbacks: PlaybackEngineCallbacks;
    private readonly timingDriver: TimingDriver;
    private readonly playbackPositionController: PlaybackPositionController<T>;
    private readonly playbackStateController: PlaybackStateController<T>;
    private readonly settingsProvider: SettingsProvider;
    private unbindOperationId = 0;
    private settingsChangedOperationId = 0;
    private lastProfile?: string;
    private settingsInitialization?: {
        readonly unbindOperationId: number;
        readonly promise: Promise<void>;
    };

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
        this.settings = defaultSettings;
        this.appIntegration = appIntegration;
        this.settingsProvider = settingsProvider;
        this.subtitles = subtitles;
        this.lastSubtitleEndMs = this.calculateLastSubtitleEndMs(subtitles);
        this.ready = { settings: false, subtitles: subtitles.length > 0 };
        this.playbackModesSuppressed = playbackModesSuppressed;
        this.playbackModeController = new PlaybackModeController(new Set([PlayMode.normal]), playbackModesDisabled);
        this.callbacks = callbacks;
        this.timingDriver = timingDriver;
        this.plan = this.buildPlan();

        const executorCallbacks: PlaybackPlanExecutorCallbacks = {
            play: callbacks.play,
            paused: () => this.timingDriver.paused(),
            pause: () => {
                callbacks.pause();
                void this.playbackPositionController.savePlaybackPosition(this.timingDriver.currentTimeMs());
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
        };
        this.executor = new PlaybackPlanExecutor(this.plan, this.timingDriver.currentTimeMs(), executorCallbacks);
        this.playbackPositionController = new PlaybackPositionController({
            playbackPositionKeys,
            currentTimeMs: () => this.timingDriver.currentTimeMs(),
            lastSubtitleEndMs: () => this.lastSubtitleEndMs,
            callbacks: {
                saveSettings: (settings) => {
                    this.settings = { ...this.settings, ...settings };
                    callbacks.saveSettings(settings);
                },
                playbackPositionChanged: callbacks.playbackPositionChanged,
                seek: (timestampMs) => this.seek(timestampMs),
                play: callbacks.play,
                showingSubtitlesAt: (timestampMs) => this.executor.showingSubtitlesAt(timestampMs),
                playbackPositionsChanged: (positions) => {
                    this.settings = { ...this.settings, lastPlaybackPositions: [...positions] };
                },
                onError: callbacks.onError,
            },
            settingsProvider,
        });
        this.playbackStateController = new PlaybackStateController({
            paused: () => this.timingDriver.paused(),
            showingSubtitlesAt: (timestampMs) => this.executor.showingSubtitlesAt(timestampMs),
            playbackStateChanged: callbacks.playbackStateChanged,
            now: () => performance.now(),
        });
        this.timingDriver.setCallbacks({
            onTime: async (currentTimestampMs, { lookaheadTimestampMs }) => {
                const playbackStateLock = this.playbackStateController.lock(); // This update can trigger a lot of events
                try {
                    await this.executor.update(currentTimestampMs, { lookaheadTimestampMs });
                } finally {
                    this.playbackStateController.unlockAndNotify(playbackStateLock, this.timingDriver.currentTimeMs(), {
                        force: false,
                    });
                }
            },
            onPlaybackPaused: () => {
                this.playbackPositionController.playbackPaused();
                const timestampMs = this.timingDriver.currentTimeMs();
                this.playbackStateController.reconcileAndNotify(
                    timestampMs,
                    (reconcileTimestampMs) => {
                        this.executor.reconcileAt(reconcileTimestampMs, { forcePlaybackRate: false });
                    },
                    { force: true }
                );
            },
            onDiscontinuity: (currentTimestampMs) => {
                this.playbackPositionController.discontinuity(currentTimestampMs);
                this.executor.handleDiscontinuity(currentTimestampMs);
                this.playbackStateController.notify(currentTimestampMs, { force: true });
            },
            onCancel: (options) => this.executor.cancelPendingOperations(options),
            onPlaybackStarted: async () => {
                await this.executor.playbackStarted();
                this.playbackStateController.notify(this.timingDriver.currentTimeMs(), { force: true });
            },
            onError: callbacks.onError,
        });
        this.initializeSettings();
    }

    private initializeSettings(): void {
        if (this.ready.settings) return;
        const unbindOperationId = this.unbindOperationId;
        if (this.settingsInitialization?.unbindOperationId === unbindOperationId) return;
        const promise = this.loadSettings(unbindOperationId);
        this.settingsInitialization = { unbindOperationId, promise };
        void promise.finally(() => {
            if (this.settingsInitialization?.promise === promise) this.settingsInitialization = undefined;
        });
    }

    private async loadSettings(unbindOperationId: number): Promise<void> {
        try {
            while (true) {
                const settingsChangedOperationId = this.settingsChangedOperationId;
                const settings = await this.settingsProvider.getAll();
                const activeProfile = await this.settingsProvider.activeProfile();
                const profile = activeProfile?.name;
                if (settingsChangedOperationId !== this.settingsChangedOperationId) continue;
                if (unbindOperationId !== this.unbindOperationId) return;
                this.settings = settings;
                this.lastProfile = profile;
                this.playbackPositionController.setSettings(this.settings);
                this.ready.settings = true;
                this.rebuildPlan();
                this.bind();
                return;
            }
        } catch (error) {
            this.callbacks.onError(error);
        }
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

    private initialPlaybackSettingsNotifications({
        playbackRate,
        fastForwarding,
        subtitleOffset,
        playbackModeTransition,
    }: {
        readonly playbackRate: number;
        readonly fastForwarding: boolean;
        readonly subtitleOffset: number;
        readonly playbackModeTransition: PlayModeTransition;
    }): InitialPlaybackSettingsNotifications {
        const offsetAndRate: InitialPlaybackNotification[] = [];
        if (subtitleOffset !== 0) offsetAndRate.push({ type: 'message', message: formatAsSignedMs(subtitleOffset) });
        if (this.settings.playbackRateNotificationEnabled && playbackRate !== 1) {
            offsetAndRate.push({
                type: 'translation',
                notification: formatPlaybackRateNotification(
                    playbackRate,
                    fastForwarding ? 'info.fastForwardPlaybackRate' : 'info.playbackRate'
                ),
            });
        }
        return {
            offsetAndRate,
            playbackMode: playbackModeNotifications(playbackModeTransition),
        };
    }

    bind(): void {
        if (this.timingDriver.bound) return;
        if (!this.ready.settings) {
            this.initializeSettings();
            return;
        }
        if (!this.ready.subtitles) return;

        this.playbackStateController.bind();
        this.timingDriver.bind();
        this.playbackPositionController.bind();

        const playbackModeTransition = this.playbackModeController.setModes(playbackModesFromSettings(this.settings));
        this.timingDriver.onDurationChange();
        this.rebuildPlan({ initializePlaybackRate: true });

        const subtitleOffset = this.lastSubtitleOffset;
        this.callbacks.setSubtitleOffset(subtitleOffset, { notifyPlayer: false });
        const fastForwarding = this.executor.isFastForwarding;
        const playbackRate = fastForwarding ? this.plan.fastForward!.playbackRate : this.plan.playbackRate;
        const notifications = this.initialPlaybackSettingsNotifications({
            playbackRate,
            fastForwarding,
            subtitleOffset,
            playbackModeTransition,
        });
        this.callbacks.initialPlaybackSettingsChanged({
            autoHideDuration: initialPlaybackSettingsAutoHideDurationMs,
            playbackRate,
            subtitleOffset,
            playbackModeTransition,
            notifications,
        });
        this.playbackStateController.notify(this.timingDriver.currentTimeMs(), { force: true });
    }

    unbind(): void {
        this.teardown({ saveSettings: true });
    }

    profileChanged(profile?: string): void {
        if (this.lastProfile === profile) return;
        this.teardown({ saveSettings: false });
        this.ready.settings = false;
        ++this.settingsChangedOperationId;
        this.initializeSettings();
    }

    private teardown({ saveSettings }: { readonly saveSettings: boolean }): void {
        ++this.unbindOperationId;
        if (!saveSettings) this.playbackPositionController.profileChanged();
        if (!this.timingDriver.bound) return;
        this.playbackPositionController.unbind();
        this.timingDriver.unbind();
        if (!saveSettings) return;
        // Need to update these as PlaybackEngine doesn't keep them all synced with external settings.
        // lastPlaybackPositions are managed by the playbackPositionController and should not be explicitly saved here.
        this.callbacks.saveSettings({
            lastPlaybackModes: this.settings.lastPlaybackModes,
            ...(this.appIntegration ? { lastSubtitleOffset: this.settings.lastSubtitleOffset } : {}),
            rememberPlaybackRate: this.settings.rememberPlaybackRate, // This is done to ensure everyone is notified as its not in saveOnlySettings
            ...(this.settings.rememberPlaybackRate
                ? {
                      playbackRate: this.settings.playbackRate,
                      fastForwardModePlaybackRate: this.settings.fastForwardModePlaybackRate,
                  }
                : {}),
        });
    }

    private calculateLastSubtitleEndMs(subtitles: readonly T[]): number | undefined {
        if (!subtitles.length) return;
        return Math.max(...subtitles.map((subtitle) => subtitle.end));
    }

    settingsChanged(settings: AsbplayerSettings): void {
        ++this.settingsChangedOperationId;
        if (!this.ready.settings) return;
        const rememberPlaybackModesNow =
            !this.settings.rememberPlaybackModes && settings.rememberPlaybackModes && this.timingDriver.bound;
        // PlaybackEngine is the single source of truth for these settings and may not push updates to the settings from outside.
        // For playbackRate, this has a side effect of ignoring changes in the UI for the current playback. This is acceptable and
        // means that playback rate in the UI is for init only, live playback rate changes must be through other means.
        this.settings = {
            ...settings,
            playbackRate: this.settings.playbackRate,
            fastForwardModePlaybackRate: this.settings.fastForwardModePlaybackRate,
            lastPlaybackModes: this.settings.lastPlaybackModes,
            ...(this.appIntegration ? { lastSubtitleOffset: this.settings.lastSubtitleOffset } : {}),
        };
        this.playbackPositionController.settingsChanged(this.settings);
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
        this.lastSubtitleEndMs = this.calculateLastSubtitleEndMs(subtitles);
        if (subtitles.length) {
            this.ready.subtitles = true;
            this.bind();
            if (hadSubtitles) this.rebuildPlan();
        } else if (hadSubtitles) {
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
              readonly notification: PlaybackRateNotification;
          }
        | undefined {
        if (!this.timingDriver.bound) return;
        const isFastForwarding = this.executor.isFastForwarding;
        const setting = isFastForwarding ? 'fastForwardModePlaybackRate' : 'playbackRate';
        const locKey = isFastForwarding ? 'info.fastForwardPlaybackRate' : 'info.playbackRate';
        const notification = formatPlaybackRateNotification(this.settings[setting], locKey);
        const normalizedPlaybackRate = normalizePlaybackRate(playbackRate);
        if (normalizedPlaybackRate === undefined || this.settings[setting] === normalizedPlaybackRate) {
            return { notify: false, playbackRate: this.settings[setting], notification };
        }
        this.settings = { ...this.settings, [setting]: normalizedPlaybackRate };
        if (!this.rebuildPlan()) {
            return {
                notify: false,
                playbackRate: this.settings[setting],
                notification: formatPlaybackRateNotification(this.settings[setting], locKey),
            };
        }
        if (this.settings.rememberPlaybackRate) {
            this.callbacks.saveSettings({ [setting]: normalizedPlaybackRate });
        }
        return {
            notify: this.settings.playbackRateNotificationEnabled,
            playbackRate: normalizedPlaybackRate,
            notification: formatPlaybackRateNotification(normalizedPlaybackRate, locKey),
        };
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
        this.playbackStateController.notify(this.timingDriver.currentTimeMs(), { force: true });
    }

    adjustPlaybackRate(delta: number): ReturnType<typeof this.playbackRateChanged> {
        if (!this.timingDriver.bound) return;
        const isFastForwarding = this.executor.isFastForwarding;
        const playbackRate = isFastForwarding ? this.plan.fastForward!.playbackRate : this.plan.playbackRate;
        const locKey = isFastForwarding ? 'info.fastForwardPlaybackRate' : 'info.playbackRate';
        if (!delta || !Number.isFinite(delta)) {
            return {
                notify: false,
                playbackRate,
                notification: formatPlaybackRateNotification(playbackRate, locKey),
            };
        }
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
        this.playbackStateController.notify(timestampMs, { force: true });
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
    private rebuildPlan(options: { readonly initializePlaybackRate?: boolean } = {}): boolean {
        const plan = this.buildPlan();
        const planChanged = !playbackPlansEqual(this.plan, plan);
        if (planChanged) {
            this.plan = plan;
            this.executor.replacePlan(this.plan, this.timingDriver.currentTimeMs(), {
                forcePlaybackRate: options.initializePlaybackRate,
            });
            if (this.timingDriver.bound) {
                this.playbackStateController.notify(this.timingDriver.currentTimeMs(), { force: true });
            }
        } else if (options.initializePlaybackRate) {
            this.executor.initializePlaybackRate(this.timingDriver.currentTimeMs());
        }
        return planChanged;
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
            void this.playbackPositionController.savePlaybackPosition(targetTimestampMs);
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
