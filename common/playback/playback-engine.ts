import { defaultSettings, isTrackSeekable } from '@project/common/settings';
import type { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import type { IndexedSubtitleModel, PlaybackState } from '@project/common';
import { PlayMode } from '@project/common';
import { asbError, asbTrace, asbWarn } from '@project/common/util/log';
import { formatAsSignedMs } from '@project/common/util';
import {
    buildPlaybackPlan,
    playbackPlansEqual,
    playbackPlanCorrectionToleranceMs,
} from '@project/common/playback/plan/playback-plan';
import type { PlaybackPlan } from '@project/common/playback/plan/playback-plan';
import PlaybackPlanExecutor, {
    maximumInternalSeekMismatchMs,
} from '@project/common/playback/plan/playback-plan-executor';
import type {
    PlaybackPlanExecutorCallbacks,
    PlaybackTimelineTransitionCause,
} from '@project/common/playback/plan/playback-plan-executor';
import PlaybackModeController, {
    minimumPlaybackRate,
    normalizePlaybackRate,
    playbackModesFromSettings,
} from '@project/common/playback/controllers/playback-mode-controller';
import type { PlayModeTransition } from '@project/common/playback/controllers/playback-mode-controller';
import AutoPauseController, {
    formatAutoPauseResumeModeNotification,
    nextAutoPauseResumeMode,
} from '@project/common/playback/controllers/auto-pause-controller';
import type { AutoPauseResumeModeNotification } from '@project/common/playback/controllers/auto-pause-controller';
import PlaybackPositionController from '@project/common/playback/controllers/playback-position-controller';
import PlaybackStateController from '@project/common/playback/controllers/playback-state-controller';
import SubtitleVisibilityController, {
    formatSubtitleVisibilityNotification,
    nextSubtitleVisibility,
} from '@project/common/playback/controllers/subtitle-visibility-controller';
import type { SubtitleVisibilityNotification } from '@project/common/playback/controllers/subtitle-visibility-controller';
import type { TimingDriver } from '@project/common/playback/timing/timing-driver';
import { CachedLocalStorage } from '@project/common/app/services/cached-local-storage';

const internalSeekWatchdogMs = 10_000;
const subtitleOffsetStorageKey = 'offset';
const initialPlaybackSettingsAutoHideDurationMs = 6000;
const playbackRateNotificationKey = 'playback-rate';
const subtitleOffsetNotificationKey = 'subtitle-offset';

const playbackPlanTraceDetails = <T extends IndexedSubtitleModel>(plan: PlaybackPlan<T>) => ({
    durationMs: plan.timelineSubtitles.durationMs,
    displaySubtitleCount: plan.timelineSubtitles.displaySubtitles.length,
    timelineBlockCount: plan.timelineSubtitles.blocks.length,
    playbackRate: plan.playbackRate,
    condensed: plan.condensed !== undefined,
    fastForwardPlaybackRate: plan.fastForward?.playbackRate,
    autoPauseResumeMode: plan.autoPause?.resume.mode,
    subtitleVisibility: plan.subtitleVisibility,
});

const playbackModeTransitionTraceDetails = ({ modes, added, removed }: PlayModeTransition) => ({
    modes: [...modes],
    added: [...added],
    removed: [...removed],
});

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
    readonly key: typeof playbackRateNotificationKey;
    readonly locKey: string;
    readonly replacements: { readonly rate: string };
}

export function formatPlaybackRateNotification(playbackRate: number, locKey: string): PlaybackRateNotification {
    return {
        key: playbackRateNotificationKey,
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
}

export interface PlaybackEngineCallbacks {
    readonly pause: () => void;
    readonly play: () => Promise<void>;
    readonly seek: (timestampMs: number) => Promise<void>;
    readonly setPlaybackRate: (playbackRate: number) => void;
    readonly setSubtitleOffset: (
        offset: number,
        options: SubtitleOffsetOptions,
        notificationKey: typeof subtitleOffsetNotificationKey
    ) => void;
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
    readonly autoPauseCorrectionDisabled: boolean;
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
 *     ├── PlaybackStateController
 *     ├── PlaybackModeController
 *     ├── PlaybackPositionController
 *     ├── AutoPauseController
 *     ├── SubtitleVisibilityController
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
    private readonly autoPauseCorrectionDisabled: boolean;
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
    private readonly autoPauseController: AutoPauseController;
    private readonly subtitleVisibilityController: SubtitleVisibilityController;
    private readonly playbackStateController: PlaybackStateController<T>;
    private autoPauseTimestampMs?: number;
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
        autoPauseCorrectionDisabled,
        subtitles,
        playbackModesDisabled,
        playbackModesSuppressed,
        playbackPositionKeys,
        callbacks,
        timingDriver,
    }: PlaybackEngineOptions<T>) {
        asbTrace('playback/lifecycle', 'Creating playback engine', {
            appIntegration,
            autoPauseCorrectionDisabled,
            playbackModesDisabled,
            playbackModesSuppressed,
            playbackPositionKeyCount: playbackPositionKeys.length,
            subtitleCount: subtitles.length,
        });
        this.settings = defaultSettings;
        this.appIntegration = appIntegration;
        this.autoPauseCorrectionDisabled = autoPauseCorrectionDisabled;
        this.settingsProvider = settingsProvider;
        this.subtitles = subtitles;
        this.lastSubtitleEndMs = this.calculateLastSubtitleEndMs(subtitles);
        this.ready = { settings: false, subtitles: subtitles.length > 0 };
        this.playbackModesSuppressed = playbackModesSuppressed;
        this.playbackModeController = new PlaybackModeController(new Set([PlayMode.normal]), playbackModesDisabled);
        this.callbacks = callbacks;
        this.timingDriver = timingDriver;
        this.plan = this.buildPlan();
        this.subtitleVisibilityController = new SubtitleVisibilityController({
            visibilityChanged: () => {
                if (!this.timingDriver.bound) return;
                asbTrace('playback/subtitles', 'Subtitle visibility state changed', {
                    subtitlesVisible: this.subtitleVisibilityController.subtitlesVisible,
                    timestampMs: this.timingDriver.currentTimeMs(),
                });
                this.playbackStateController.notify(this.timingDriver.currentTimeMs(), { force: true });
            },
        });
        this.subtitleVisibilityController.replacePlan(this.plan.subtitleVisibility, this.timingDriver.paused());
        this.autoPauseController = new AutoPauseController({
            play: callbacks.play,
            resumeDelayStarted: () => this.subtitleVisibilityController.autoPauseResumeDelayStarted(),
            autoResumeFailed: () => {
                const snapshotCleared = this.clearAutoPauseTimestamp();
                asbTrace('playback/auto-pause', 'Automatic playback resume failed', {
                    snapshotCleared,
                    timestampMs: this.timingDriver.currentTimeMs(),
                });
                this.subtitleVisibilityController.autoPauseCancelled(this.timingDriver.paused());
                if (snapshotCleared && this.timingDriver.bound) {
                    this.playbackStateController.notify(this.timingDriver.currentTimeMs(), { force: false });
                }
            },
            onError: (error) => {
                asbTrace('playback/error', 'Auto-pause controller error', { error });
                callbacks.onError(error);
            },
        });
        this.autoPauseController.replacePlan(this.plan.autoPause?.resume);

        const executorCallbacks: PlaybackPlanExecutorCallbacks<T> = {
            play: callbacks.play,
            paused: () => this.timingDriver.paused(),
            pause: ({ timestampMs, playbackModeSubtitlesAtPause }) => {
                this.autoPauseTimestampMs = timestampMs;
                this.subtitleVisibilityController.autoPaused();
                this.autoPauseController.autoPaused(playbackModeSubtitlesAtPause);
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
                    asbWarn('playback/rate', 'Playback rate command was not respected', {
                        requestedPlaybackRate: playbackRate,
                        actualPlaybackRate,
                    });
                }
                asbTrace('playback/rate', 'Applied playback plan rate command', {
                    actualPlaybackRate,
                    requestedPlaybackRate: playbackRate,
                    timestampMs: this.timingDriver.currentTimeMs(),
                });
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
                onError: (error) => {
                    asbTrace('playback/error', 'Playback position controller error', { error });
                    callbacks.onError(error);
                },
            },
            settingsProvider,
        });
        this.playbackStateController = new PlaybackStateController({
            paused: () => this.timingDriver.paused(),
            showingSubtitlesAt: (timestampMs) =>
                this.executor.showingSubtitlesAt(this.autoPauseTimestampMs ?? timestampMs),
            subtitlesVisible: () => this.subtitleVisibilityController.subtitlesVisible,
            invisibleSubtitlesAt: (timestampMs) =>
                this.executor.invisibleSubtitlesAt(this.autoPauseTimestampMs ?? timestampMs),
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
                const timestampMs = this.timingDriver.currentTimeMs();
                asbTrace('playback/state', 'Playback paused', {
                    playbackRate: this.timingDriver.playbackRate(),
                    timestampMs,
                });
                this.subtitleVisibilityController.playbackPaused();
                this.playbackPositionController.playbackPaused();
                this.playbackStateController.reconcileAndNotify(
                    timestampMs,
                    (reconcileTimestampMs) => {
                        this.executor.reconcileAt(reconcileTimestampMs, { forcePlaybackRate: false });
                    },
                    { force: true }
                );
            },
            onSeekStarted: (cause) => this.seekStartedWithCause(cause),
            onDiscontinuity: (currentTimestampMs) => {
                this.playbackPositionController.discontinuity(currentTimestampMs);
                const { cause } = this.executor.handleDiscontinuity(currentTimestampMs);
                if (cause !== 'internal-seek') {
                    asbTrace('playback/seek', 'Playback discontinuity handled', {
                        cause,
                        timestampMs: currentTimestampMs,
                    });
                    this.clearAutoPauseTimestamp();
                    this.autoPauseController.userSeeked();
                    this.subtitleVisibilityController.userSeeked(this.timingDriver.paused());
                }
                this.playbackStateController.notify(currentTimestampMs, { force: true });
            },
            onCancel: (options) => this.executor.cancelPendingOperations(options),
            onPlaybackStarted: async () => {
                asbTrace('playback/state', 'Playback started', {
                    playbackRate: this.timingDriver.playbackRate(),
                    timestampMs: this.timingDriver.currentTimeMs(),
                });
                this.clearAutoPauseTimestamp();
                this.autoPauseController.playbackStarted();
                this.subtitleVisibilityController.playbackStarted();
                await this.executor.playbackStarted();
                this.playbackStateController.notify(this.timingDriver.currentTimeMs(), { force: true });
            },
            onError: (error) => {
                asbTrace('playback/error', 'Playback timing error', { error });
                callbacks.onError(error);
            },
        });
        this.initializeSettings();
        asbTrace('playback/lifecycle', 'Created playback engine', {
            ready: this.ready,
            plan: playbackPlanTraceDetails(this.plan),
        });
    }

    private initializeSettings(): void {
        if (this.ready.settings) return;
        const unbindOperationId = this.unbindOperationId;
        if (this.settingsInitialization?.unbindOperationId === unbindOperationId) return;
        asbTrace('playback/settings', 'Starting playback settings initialization', {
            unbindOperationId,
        });
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
                if (settingsChangedOperationId !== this.settingsChangedOperationId) {
                    asbTrace(
                        'playback/settings',
                        'Retrying playback settings initialization after a concurrent update',
                        {
                            requestedSettingsChangedOperationId: settingsChangedOperationId,
                            currentSettingsChangedOperationId: this.settingsChangedOperationId,
                        }
                    );
                    continue;
                }
                if (unbindOperationId !== this.unbindOperationId) {
                    asbTrace('playback/settings', 'Discarding playback settings initialization after teardown', {
                        unbindOperationId,
                        currentUnbindOperationId: this.unbindOperationId,
                    });
                    return;
                }
                this.settings = settings;
                this.lastProfile = profile;
                this.playbackPositionController.setSettings(this.settings);
                this.ready.settings = true;
                asbTrace('playback/settings', 'Playback settings initialized', {
                    lastPlaybackModes: settings.lastPlaybackModes,
                    profile,
                    settingsChangedOperationId,
                });
                this.rebuildPlan();
                this.bind();
                return;
            }
        } catch (error) {
            asbTrace('playback/error', 'Playback settings initialization failed', { error });
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
    }: {
        readonly playbackRate: number;
        readonly fastForwarding: boolean;
        readonly subtitleOffset: number;
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
        };
    }

    bind(): void {
        if (this.timingDriver.bound) return;
        if (!this.ready.settings) {
            asbTrace('playback/lifecycle', 'Deferring playback engine bind until settings are ready');
            this.initializeSettings();
            return;
        }
        if (!this.ready.subtitles) {
            asbTrace('playback/lifecycle', 'Deferring playback engine bind until subtitles are available');
            return;
        }

        this.playbackStateController.bind();
        this.timingDriver.bind();
        this.playbackPositionController.bind();

        const playbackModeTransition = this.playbackModeController.setModes(playbackModesFromSettings(this.settings));
        this.timingDriver.onDurationChange();
        this.rebuildPlan({ initializePlaybackRate: true });

        const subtitleOffset = this.lastSubtitleOffset;
        this.callbacks.setSubtitleOffset(subtitleOffset, { notifyPlayer: false }, subtitleOffsetNotificationKey);
        const fastForwarding = this.executor.isFastForwarding;
        const playbackRate = fastForwarding ? this.plan.fastForward!.playbackRate : this.plan.playbackRate;
        const notifications = this.initialPlaybackSettingsNotifications({
            playbackRate,
            fastForwarding,
            subtitleOffset,
        });
        this.callbacks.initialPlaybackSettingsChanged({
            autoHideDuration: initialPlaybackSettingsAutoHideDurationMs,
            playbackRate,
            subtitleOffset,
            playbackModeTransition,
            notifications,
        });
        asbTrace('playback/lifecycle', 'Playback engine bound', {
            initialPlaybackRate: playbackRate,
            modeTransition: playbackModeTransitionTraceDetails(playbackModeTransition),
            notifications: notifications.offsetAndRate.length,
            playbackModes: [...this.playbackModeController.playModes],
            subtitleOffset,
            timestampMs: this.timingDriver.currentTimeMs(),
        });
        this.playbackStateController.notify(this.timingDriver.currentTimeMs(), { force: true });
    }

    unbind(): void {
        this.teardown({ saveSettings: true });
    }

    profileChanged(profile?: string): void {
        if (this.lastProfile === profile) return;
        asbTrace('playback/settings', 'Playback profile changed', {
            previousProfile: this.lastProfile,
            profile,
        });
        this.teardown({ saveSettings: false });
        this.ready.settings = false;
        ++this.settingsChangedOperationId;
        this.initializeSettings();
    }

    private teardown({ saveSettings }: { readonly saveSettings: boolean }): void {
        const wasBound = this.timingDriver.bound;
        asbTrace('playback/lifecycle', 'Tearing down playback engine', {
            saveSettings,
            timestampMs: wasBound ? this.timingDriver.currentTimeMs() : undefined,
            wasBound,
        });
        ++this.unbindOperationId;
        this.clearAutoPauseTimestamp();
        this.autoPauseController.cancel();
        this.subtitleVisibilityController.cancel();
        if (!saveSettings) this.playbackPositionController.profileChanged();
        if (!this.timingDriver.bound) {
            asbTrace('playback/lifecycle', 'Playback engine teardown finished while already unbound', { saveSettings });
            return;
        }
        this.playbackPositionController.unbind();
        this.timingDriver.unbind();
        if (!saveSettings) {
            asbTrace('playback/lifecycle', 'Playback engine unbound', { saveSettings });
            return;
        }
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
        asbTrace('playback/lifecycle', 'Playback engine unbound', { saveSettings });
    }

    private calculateLastSubtitleEndMs(subtitles: readonly T[]): number | undefined {
        if (!subtitles.length) return;
        return Math.max(...subtitles.map((subtitle) => subtitle.end));
    }

    settingsChanged(settings: AsbplayerSettings): void {
        ++this.settingsChangedOperationId;
        if (!this.ready.settings) {
            asbTrace('playback/settings', 'Deferring playback settings update until initialization completes', {
                settingsChangedOperationId: this.settingsChangedOperationId,
            });
            return;
        }
        const rememberPlaybackModesNow =
            !this.settings.rememberPlaybackModes && settings.rememberPlaybackModes && this.timingDriver.bound;
        asbTrace('playback/settings', 'Applying playback settings update', {
            bound: this.timingDriver.bound,
            rememberPlaybackModesNow,
            settingsChangedOperationId: this.settingsChangedOperationId,
        });
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
        asbTrace('playback/position', 'Playback position keys changed', {
            keyCount: playbackPositionKeys.length,
        });
        this.playbackPositionController.playbackPositionKeysChanged(playbackPositionKeys);
    }

    subtitlesChanged(subtitles: readonly T[]): void {
        const previousSubtitleCount = this.subtitles.length;
        const hadSubtitles = this.ready.subtitles;
        const snapshotCleared = this.clearAutoPauseTimestamp();
        this.subtitles = subtitles;
        this.lastSubtitleEndMs = this.calculateLastSubtitleEndMs(subtitles);
        asbTrace('playback/subtitles', 'Playback subtitles changed', {
            hadSubtitles,
            newSubtitleCount: subtitles.length,
            previousSubtitleCount,
            snapshotCleared,
        });
        if (subtitles.length) {
            this.ready.subtitles = true;
            this.bind();
            if (hadSubtitles) {
                const planChanged = this.rebuildPlan();
                if (!planChanged && snapshotCleared && this.timingDriver.bound) {
                    this.playbackStateController.notify(this.timingDriver.currentTimeMs(), { force: false });
                }
            }
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
        if (!this.timingDriver.bound) {
            asbTrace('playback/rate', 'Ignoring playback rate change while unbound', { playbackRate });
            return;
        }
        const isFastForwarding = this.executor.isFastForwarding;
        const setting = isFastForwarding ? 'fastForwardModePlaybackRate' : 'playbackRate';
        const locKey = isFastForwarding ? 'info.fastForwardPlaybackRate' : 'info.playbackRate';
        const notification = formatPlaybackRateNotification(this.settings[setting], locKey);
        const normalizedPlaybackRate = normalizePlaybackRate(playbackRate);
        if (normalizedPlaybackRate === undefined || this.settings[setting] === normalizedPlaybackRate) {
            asbTrace('playback/rate', 'Ignoring unchanged or invalid playback rate', {
                normalizedPlaybackRate,
                requestedPlaybackRate: playbackRate,
                setting,
            });
            return { notify: false, playbackRate: this.settings[setting], notification };
        }
        const previousPlaybackRate = this.settings[setting];
        this.settings = { ...this.settings, [setting]: normalizedPlaybackRate };
        const planChanged = this.rebuildPlan();
        asbTrace('playback/rate', 'Playback rate changed', {
            fastForwarding: isFastForwarding,
            planChanged,
            previousPlaybackRate,
            requestedPlaybackRate: playbackRate,
            setting,
            playbackRate: normalizedPlaybackRate,
        });
        if (!planChanged) {
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
        if (!this.timingDriver.bound) {
            asbTrace('playback/subtitles', 'Ignoring subtitle offset change while unbound', { offset });
            return;
        }
        asbTrace('playback/subtitles', 'Subtitle offset changed', {
            appIntegration: this.appIntegration,
            notifyPlayer: options.notifyPlayer,
            offset,
        });
        if (this.appIntegration) {
            this.settings = { ...this.settings, lastSubtitleOffset: offset };
            this.callbacks.saveSettings({ lastSubtitleOffset: offset });
        } else {
            this.subtitleOffsetStorage.set(subtitleOffsetStorageKey, String(offset));
        }
        this.callbacks.setSubtitleOffset(offset, options, subtitleOffsetNotificationKey);
        this.playbackStateController.notify(this.timingDriver.currentTimeMs(), { force: true });
    }

    adjustPlaybackRate(delta: number): ReturnType<typeof this.playbackRateChanged> {
        if (!this.timingDriver.bound) {
            asbTrace('playback/rate', 'Ignoring playback rate adjustment while unbound', { delta });
            return;
        }
        const isFastForwarding = this.executor.isFastForwarding;
        const playbackRate = isFastForwarding ? this.plan.fastForward!.playbackRate : this.plan.playbackRate;
        const locKey = isFastForwarding ? 'info.fastForwardPlaybackRate' : 'info.playbackRate';
        if (!delta || !Number.isFinite(delta)) {
            asbTrace('playback/rate', 'Ignoring invalid playback rate adjustment', {
                currentPlaybackRate: playbackRate,
                delta,
            });
            return {
                notify: false,
                playbackRate,
                notification: formatPlaybackRateNotification(playbackRate, locKey),
            };
        }
        return this.playbackRateChanged(playbackRate + delta);
    }

    durationChanged(durationMs: number): void {
        const previousDurationMs = this.plan.timelineSubtitles.durationMs;
        if (!Number.isFinite(durationMs) || durationMs === previousDurationMs) {
            asbTrace('playback/plan', 'Ignoring unchanged or invalid duration change', {
                durationMs,
                previousDurationMs,
            });
            return;
        }
        asbTrace('playback/plan', 'Playback duration changed', { durationMs, previousDurationMs });
        this.rebuildPlan();
    }

    playbackModesSuppressedChanged(suppressed: boolean): void {
        if (this.playbackModesSuppressed === suppressed) {
            asbTrace('playback/mode', 'Ignoring unchanged playback mode suppression', { suppressed });
            return;
        }
        asbTrace('playback/mode', 'Playback mode suppression changed', {
            previousSuppressed: this.playbackModesSuppressed,
            suppressed,
        });
        this.playbackModesSuppressed = suppressed;
        this.rebuildPlan();
    }

    togglePlaybackMode(targetMode: PlayMode): void {
        if (!this.timingDriver.bound) {
            asbTrace('playback/mode', 'Ignoring playback mode toggle while unbound', { targetMode });
            return;
        }
        const transition = this.playbackModeController.transition(targetMode);
        this.applyPlaybackModeTransition(transition, { savePlaybackModes: true, rebuildWhenUnchanged: false });
    }

    cycleAutoPauseResumeMode(): AutoPauseResumeModeNotification | undefined {
        if (!this.timingDriver.bound) {
            asbTrace('playback/auto-pause', 'Ignoring auto-pause resume mode change while unbound');
            return;
        }
        const autoPauseResumeMode = nextAutoPauseResumeMode(this.settings.autoPauseResumeMode);
        this.settings = { ...this.settings, autoPauseResumeMode };
        const planChanged = this.rebuildPlan();
        this.callbacks.saveSettings({ autoPauseResumeMode });
        asbTrace('playback/auto-pause', 'Auto-pause resume mode changed', {
            autoPauseResumeMode,
            planChanged,
        });
        return formatAutoPauseResumeModeNotification(autoPauseResumeMode);
    }

    toggleSubtitleVisibility(): SubtitleVisibilityNotification | undefined {
        if (!this.timingDriver.bound) {
            asbTrace('playback/subtitles', 'Ignoring subtitle visibility toggle while unbound');
            return;
        }
        const subtitleVisibility = nextSubtitleVisibility(this.settings.subtitleVisibility);
        this.settings = { ...this.settings, subtitleVisibility };
        const planChanged = this.rebuildPlan();
        this.callbacks.saveSettings({ subtitleVisibility });
        asbTrace('playback/subtitles', 'Subtitle visibility changed', {
            planChanged,
            subtitleVisibility,
        });
        return formatSubtitleVisibilityNotification(subtitleVisibility);
    }

    dismissPlaybackPosition(): void {
        asbTrace('playback/position', 'Dismissing remembered playback position');
        this.playbackPositionController.dismissPlaybackPosition();
    }

    async resumePlaybackPosition(): Promise<void> {
        asbTrace('playback/position', 'Resuming remembered playback position');
        try {
            await this.playbackPositionController.resumePlaybackPosition();
            asbTrace('playback/position', 'Finished resuming remembered playback position', {
                timestampMs: this.timingDriver.currentTimeMs(),
            });
        } catch (error) {
            asbError('playback/error', 'Failed to resume remembered playback position', { error });
            throw error;
        }
    }

    /** Reports a discontinuity from a non-standard media adapter, such as Disney+'s page-script seek event. */
    seeked(timestampMs: number): void {
        if (this.timingDriver.externalSeekEvents) {
            asbTrace('playback/seek', 'Received external seek completion', { timestampMs });
            this.timingDriver.externalSeeked!(timestampMs);
            return;
        }
        const { cause } = this.executor.handleDiscontinuity(timestampMs);
        if (cause !== 'internal-seek') {
            this.clearAutoPauseTimestamp();
            this.autoPauseController.userSeeked();
            this.subtitleVisibilityController.userSeeked(this.timingDriver.paused());
        }
        this.playbackStateController.notify(timestampMs, { force: true });
    }

    /** Reports that a seek operation has started from a non-standard media adapter, such as Disney+'s page-script seek event. */
    seekStarted(): void {
        if (this.timingDriver.externalSeekEvents) {
            asbTrace('playback/seek', 'Received external seek start');
            this.timingDriver.externalSeekStarted!();
            return;
        }
        asbTrace('playback/seek', 'Received seek start');
        this.seekStartedWithCause('user-seek');
        this.executor.cancelPendingOperations({ preserveExpectedDiscontinuity: false });
    }

    private seekStartedWithCause(cause: PlaybackTimelineTransitionCause): void {
        if (cause === 'internal-seek') return;
        const snapshotCleared = this.clearAutoPauseTimestamp();
        this.autoPauseController.userSeeked();
        this.subtitleVisibilityController.userSeeked(this.timingDriver.paused());
        if (snapshotCleared && this.timingDriver.bound) {
            this.playbackStateController.notify(this.timingDriver.currentTimeMs(), { force: false });
        }
    }

    /** Reports that a seek operation has been canceled from a non-standard media adapter, such as Disney+'s page-script seek event. */
    seekCanceled(): void {
        if (this.timingDriver.externalSeekEvents) {
            asbTrace('playback/seek', 'Received external seek cancellation');
            this.timingDriver.externalSeekCanceled!();
            return;
        }
        asbTrace('playback/seek', 'Received seek cancellation');
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
            autoPauseResumeMode: this.settings.autoPauseResumeMode,
            autoPauseResumeDelayMs: this.settings.autoPauseResumeDelayMs,
            autoPauseFixedDurationMs: this.settings.autoPauseFixedDurationMs,
            autoPauseMinimumDurationMs: this.settings.autoPauseMinimumDurationMs,
            autoPauseMaximumDurationMs: this.settings.autoPauseMaximumDurationMs,
            autoPauseTimePerCharacterMs: this.settings.autoPauseTimePerCharacterMs,
            subtitleVisibility: this.settings.subtitleVisibility,
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
        asbTrace('playback/plan', 'Rebuilt playback plan', {
            currentTimestampMs: this.timingDriver.bound ? this.timingDriver.currentTimeMs() : undefined,
            initializePlaybackRate: options.initializePlaybackRate === true,
            plan: playbackPlanTraceDetails(plan),
            planChanged,
            playbackModes: [...this.playbackModeController.playModes],
            playbackModesSuppressed: this.playbackModesSuppressed,
        });
        if (planChanged) {
            const subtitleVisibilityChanged = this.plan.subtitleVisibility !== plan.subtitleVisibility;
            this.plan = plan;
            const autoPauseResumeChanged = this.autoPauseController.replacePlan(this.plan.autoPause?.resume);
            if (autoPauseResumeChanged || subtitleVisibilityChanged) this.clearAutoPauseTimestamp();
            this.subtitleVisibilityController.replacePlan(this.plan.subtitleVisibility, this.timingDriver.paused());
            if (autoPauseResumeChanged) {
                this.subtitleVisibilityController.autoPauseCancelled(this.timingDriver.paused());
            }
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

    private clearAutoPauseTimestamp(): boolean {
        if (this.autoPauseTimestampMs === undefined) return false;
        this.autoPauseTimestampMs = undefined;
        return true;
    }

    private applyPlaybackModeTransition(
        transition: PlayModeTransition,
        options: { readonly savePlaybackModes: boolean; readonly rebuildWhenUnchanged: boolean }
    ): void {
        asbTrace('playback/mode', 'Applying playback mode transition', {
            ...playbackModeTransitionTraceDetails(transition),
            rebuildWhenUnchanged: options.rebuildWhenUnchanged,
            savePlaybackModes: options.savePlaybackModes,
        });
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
        if (targetTimestampMs !== timestampMs) {
            asbTrace('playback/seek', 'Clamped seek target', {
                requestedTimestampMs: timestampMs,
                targetTimestampMs,
            });
        }
        await this.performSeek(targetTimestampMs, 'seek');
    }

    private async correctTimestamp(
        timestampMs: number,
        warningCommand: 'pause-correction'
    ): Promise<{ seekIssued: boolean }> {
        if (this.autoPauseCorrectionDisabled) return { seekIssued: false };
        const targetTimestampMs = this.clampTimestamp(timestampMs);
        if (Math.abs(this.timingDriver.currentTimeMs() - targetTimestampMs) < playbackPlanCorrectionToleranceMs) {
            return { seekIssued: false };
        }
        await this.performSeek(targetTimestampMs, warningCommand);
        return { seekIssued: true };
    }

    private async performSeek(targetTimestampMs: number, warningCommand: 'seek' | 'pause-correction'): Promise<void> {
        if (warningCommand === 'seek') {
            asbTrace('playback/seek', 'Starting internal seek', {
                currentTimestampMs: this.timingDriver.currentTimeMs(),
                targetTimestampMs,
            });
        }
        const seekCompletion = this.timingDriver.beginInternalSeek();
        let watchdogHandle: ReturnType<typeof setTimeout> | undefined;
        const watchdog = new Promise<'cancelled'>((resolve) => {
            watchdogHandle = setTimeout(() => {
                asbTrace('playback/seek', 'Internal seek watchdog timed out', {
                    targetTimestampMs,
                    timeoutMs: internalSeekWatchdogMs,
                });
                asbWarn('playback/seek', 'Internal seek did not complete before the watchdog timeout', {
                    targetTimestampMs,
                    timeoutMs: internalSeekWatchdogMs,
                });
                this.timingDriver.cancelExpectedInternalSeek();
                resolve('cancelled');
            }, internalSeekWatchdogMs);
        });
        try {
            await this.callbacks.seek(targetTimestampMs);
            const completion = await Promise.race([seekCompletion, watchdog]);
            if (completion !== 'completed') {
                asbTrace('playback/seek', 'Internal seek did not complete', {
                    completion,
                    targetTimestampMs,
                });
                return;
            }
            this.warnIfTimestampMismatch(warningCommand, targetTimestampMs);
            const actualTimestampMs = this.timingDriver.currentTimeMs();
            const playbackPositionTimestampMs =
                Math.abs(actualTimestampMs - targetTimestampMs) > maximumInternalSeekMismatchMs
                    ? actualTimestampMs
                    : targetTimestampMs;
            void this.playbackPositionController.savePlaybackPosition(playbackPositionTimestampMs);
            if (warningCommand === 'seek') {
                asbTrace('playback/seek', 'Finished internal seek', {
                    actualTimestampMs,
                    playbackPositionTimestampMs,
                    targetTimestampMs,
                });
            }
        } catch (error) {
            asbTrace('playback/error', 'Internal seek failed', { error, targetTimestampMs, warningCommand });
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
        asbTrace('playback/seek', `${command} timestamp mismatch`, {
            actualTimestampMs,
            frameTimeMs,
            targetTimestampMs,
        });
        asbWarn('playback/seek', `${command} command has a timestamp mismatch`, {
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
