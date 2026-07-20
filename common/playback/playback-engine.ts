import type { AsbplayerSettings } from '@project/common/settings';
import { isTrackSeekable } from '@project/common/settings';
import type { IndexedSubtitleModel } from '@project/common';
import { PlayMode } from '@project/common';
import { playbackPlansEqual, buildPlaybackPlan, type PlaybackPlan } from '@project/common/playback/playback-plan';
import PlaybackPlanExecutor, {
    playbackPlanCorrectionToleranceMs,
    type PlaybackRateChange,
    type PlaybackPlanExecutorCallbacks,
} from '@project/common/playback/playback-plan-executor';
import PlaybackModeController, {
    playbackModesFromSettings,
    shouldShowPlaybackRateNotification,
    type PlayModeTransition,
} from '@project/common/playback/playback-mode-controller';
import type { TimingDriver } from '@project/common/playback/timing-driver';

export interface PlaybackEngineCallbacks<T extends IndexedSubtitleModel = IndexedSubtitleModel> {
    readonly pause: () => void;
    readonly play: () => Promise<void>;
    readonly seek: (timestampMs: number) => Promise<void>;
    readonly setPlaybackRate: (playbackRate: number) => void;
    readonly showingSubtitlesChanged: (subtitles: readonly T[]) => void;
    readonly saveSettings: (settings: Partial<AsbplayerSettings>) => void;
    readonly playbackModesChanged: (transition: PlayModeTransition) => void;
    readonly onError: (error: unknown) => void;
}

export interface PlaybackEngineOptions<T extends IndexedSubtitleModel = IndexedSubtitleModel> {
    readonly settings: AsbplayerSettings;
    readonly subtitles: readonly T[];
    readonly ready: { settings: boolean };
    readonly subtitleOffsetMs: number;
    readonly playbackModesSuppressed?: boolean;
    readonly callbacks: PlaybackEngineCallbacks<T>;
    readonly timingDriver: TimingDriver;
}

/**
 * Owns playback settings, plan lifecycle, timing, and discontinuity policy for a media adapter.
 * The caller owns the media controls and supplies them through callbacks. The media owners can
 * also notify of certain events through methods as well. Generally, PlaybackEngine should own
 * controlling the media and attaching to their related events. However things 'canplay' or
 * workarounds for certain sites should live outside this class to not complicate its responsibilities.
 *
 * Binding/VideoPlayer/Player
 * ├── Clock (VideoPlayer/Player)
 * └── PlaybackEngine
 *     ├── VideoFrameTimingDriver (Player: AnimationFrameTimingDriver)
 *     ├── PlaybackModeController
 *     ├── PlaybackPlan
 *     │   └── PlaybackTimelineCompiler
 *     └── PlaybackPlanExecutor
 *         ├── PlaybackTimeline
 *         └── PlaybackTimelineRunner
 *             ├── PlaybackTimeline
 *             └── PlaybackTimelineCursor
 */
export default class PlaybackEngine<T extends IndexedSubtitleModel> {
    private settings: AsbplayerSettings;
    private subtitles: readonly T[];
    private ready: { settings: boolean; subtitles: boolean };
    private subtitleOffsetMs: number;
    private playbackModesSuppressed: boolean;
    private plan: PlaybackPlan<T>;
    private readonly playbackModeController: PlaybackModeController;
    private readonly executor: PlaybackPlanExecutor<T>;
    private readonly seekMedia: PlaybackEngineCallbacks<T>['seek'];
    private readonly setPlaybackRateMedia: PlaybackEngineCallbacks<T>['setPlaybackRate'];
    private readonly saveSettings: PlaybackEngineCallbacks<T>['saveSettings'];
    private readonly timingDriver: TimingDriver;
    private readonly playbackModesChanged: PlaybackEngineCallbacks<T>['playbackModesChanged'];

    constructor({
        settings,
        subtitles,
        ready,
        subtitleOffsetMs,
        playbackModesSuppressed = false,
        callbacks,
        timingDriver,
    }: PlaybackEngineOptions<T>) {
        this.settings = settings;
        this.subtitles = subtitles;
        this.ready = { settings: ready.settings, subtitles: subtitles.length > 0 };
        this.subtitleOffsetMs = subtitleOffsetMs;
        this.playbackModesSuppressed = playbackModesSuppressed;
        this.playbackModeController = new PlaybackModeController(playbackModesFromSettings(settings));
        this.seekMedia = callbacks.seek;
        this.setPlaybackRateMedia = callbacks.setPlaybackRate;
        this.saveSettings = callbacks.saveSettings;
        this.playbackModesChanged = callbacks.playbackModesChanged;
        this.timingDriver = timingDriver;
        this.plan = this.buildPlan();

        const executorCallbacks: PlaybackPlanExecutorCallbacks<T> = {
            paused: () => this.timingDriver.paused(),
            pause: callbacks.pause,
            seek: (targetTimestampMs) => this.seek(targetTimestampMs),
            setPlaybackRate: (change: PlaybackRateChange) => {
                this.setPlaybackRateMedia(change.playbackRate);
            },
            correctTimestamp: async (targetTimestampMs) => {
                await this.correctTimestamp(targetTimestampMs);
            },
            showingSubtitlesChanged: callbacks.showingSubtitlesChanged,
            afterCondensedSeek: callbacks.play,
        };
        this.executor = new PlaybackPlanExecutor(this.plan, this.timingDriver.currentTimeMs(), executorCallbacks);
        this.timingDriver.setCallbacks({
            onTime: (currentTimestampMs, lookaheadTimestampMs) =>
                this.executor.update(currentTimestampMs, lookaheadTimestampMs),
            onDiscontinuity: (currentTimestampMs) => this.onDiscontinuity(currentTimestampMs),
            onCancel: () => this.executor.cancelPendingOperations(true),
            onPlaybackStarted: () => this.executor.playbackStarted(),
            onError: callbacks.onError,
        });
    }

    bind(): void {
        if (this.timingDriver.bound) return;
        if (!this.ready.settings || !this.ready.subtitles) return;

        const transition = this.playbackModeController.setModes(this.playbackModeController.playModes);
        this.playbackModesChanged(transition);
        this.setPlaybackRateMedia(this.settings.playbackRate);
        this.executor.initializePlaybackRate(this.timingDriver.currentTimeMs());
        this.timingDriver.bind();
    }

    unbind(): void {
        if (!this.timingDriver.bound) return;
        this.timingDriver.unbind();
    }

    settingsChanged(settings: AsbplayerSettings): void {
        this.settings = settings;
        this.ready.settings = true;
        this.bind();
        if (this.settings.rememberPlaybackModes) {
            this.applyPlaybackModeTransition(
                this.playbackModeController.setModes(playbackModesFromSettings(settings)),
                { savePlaybackModes: false }
            );
        }
        this.rebuildPlan();
    }

    subtitlesChanged(subtitles: readonly T[]): void {
        this.subtitles = subtitles;
        if (subtitles.length) {
            this.ready.subtitles = true;
            this.bind();
            this.rebuildPlan();
        } else {
            this.ready.subtitles = false;
            this.applyPlaybackModeTransition(this.playbackModeController.setModes(new Set([PlayMode.normal])), {
                savePlaybackModes: false,
            });
            this.rebuildPlan();
            this.unbind();
        }
    }

    playbackRateChanged(playbackRate: number): { readonly notify: boolean } {
        if (Number.isFinite(playbackRate)) {
            const fastForwarding = this.executor.fastForwardingAt(this.timingDriver.currentTimeMs());
            const setting = fastForwarding ? 'fastForwardModePlaybackRate' : 'playbackRate';
            if (this.settings[setting] !== playbackRate) {
                this.settings = { ...this.settings, [setting]: playbackRate };
                this.rebuildPlan();
                if (this.settings.rememberPlaybackRate) this.saveSettings({ [setting]: playbackRate });
            }
        }
        const modes = this.playbackModeController.playModes;
        return { notify: shouldShowPlaybackRateNotification(this.settings.playbackRateNotificationEnabled, modes) };
    }

    setPlaybackRate(playbackRate: number): { readonly notify: boolean } {
        return this.playbackRateChanged(playbackRate);
    }

    durationChanged(durationMs: number): void {
        if (!Number.isFinite(durationMs) || durationMs === this.plan.timeline.durationMs) return;
        this.rebuildPlan();
    }

    subtitleOffsetChanged(offsetMs: number): void {
        if (!Number.isFinite(offsetMs) || this.subtitleOffsetMs === offsetMs) return;

        const shiftTimelineMs = offsetMs - this.subtitleOffsetMs;
        this.subtitleOffsetMs = offsetMs;
        this.rebuildPlan({ shiftTimelineMs });
    }

    playbackModesSuppressedChanged(suppressed: boolean): void {
        if (this.playbackModesSuppressed === suppressed) return;
        this.playbackModesSuppressed = suppressed;
        this.rebuildPlan();
    }

    togglePlaybackMode(targetMode: PlayMode): void {
        const transition = this.playbackModeController.transition(targetMode);
        this.applyPlaybackModeTransition(transition, { savePlaybackModes: true });
    }

    /** Reports a discontinuity from a non-standard media adapter, such as Disney+'s page-script seek event. */
    seeked(timestampMs = this.timingDriver.currentTimeMs()): void {
        this.onDiscontinuity(timestampMs);
    }

    /** Reports that a seek operation has started from a non-standard media adapter, such as Disney+'s page-script seek event. */
    seekStarted(): void {
        this.executor.cancelPendingOperations();
    }

    /** Reports that a seek operation has been canceled from a non-standard media adapter, such as Disney+'s page-script seek event. */
    seekCanceled(): void {
        this.executor.cancelPendingOperations();
    }

    private buildPlan(): PlaybackPlan<T> {
        const displaySubtitles = this.subtitles.map((subtitle) => {
            const start = subtitle.originalStart + this.subtitleOffsetMs;
            const end = subtitle.originalEnd + this.subtitleOffsetMs;
            return subtitle.start === start && subtitle.end === end ? subtitle : { ...subtitle, start, end };
        });
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
            playbackModeStartOffset: this.settings.playbackModeStartOffset,
            playbackModeEndOffset: this.settings.playbackModeEndOffset,
            playbackModesStartGap: this.settings.playbackModesStartGap,
            playbackModesEndGap: this.settings.playbackModesEndGap,
            repeatCountPreference: this.settings.repeatCountPreference,
            condensedPlaybackMinimumSkipIntervalMs: this.settings.streamingCondensedPlaybackMinimumSkipIntervalMs,
            playbackRate: this.settings.playbackRate,
            fastForwardModePlaybackRate: this.settings.fastForwardModePlaybackRate,
            fastForwardPlaybackMinimumSkipIntervalMs: this.settings.fastForwardPlaybackMinimumSkipIntervalMs,
        });
    }

    private rebuildPlan(options: { readonly shiftTimelineMs?: number } = {}): void {
        const plan = this.buildPlan();
        if (playbackPlansEqual(this.plan, plan)) return;

        this.plan = plan;
        if (options.shiftTimelineMs !== undefined) {
            this.executor.shiftTimeline(options.shiftTimelineMs, this.timingDriver.currentTimeMs(), plan);
        } else {
            this.executor.replacePlan(plan, this.timingDriver.currentTimeMs());
        }
    }

    private onDiscontinuity(timestampMs: number): void {
        this.executor.handleDiscontinuity(timestampMs);
    }

    private applyPlaybackModeTransition(
        transition: PlayModeTransition,
        options: { readonly savePlaybackModes: boolean }
    ): void {
        if (!transition.added.size && !transition.removed.size) return;
        this.rebuildPlan();
        if (options.savePlaybackModes) this.saveSettings({ lastPlaybackModes: [...transition.modes] });
        this.playbackModesChanged(transition);
    }

    private seek(timestampMs: number): Promise<void> {
        return this.seekMedia(this.clampTimestamp(timestampMs));
    }

    private async correctTimestamp(timestampMs: number): Promise<void> {
        const targetTimestampMs = this.clampTimestamp(timestampMs);
        if (Math.abs(this.timingDriver.currentTimeMs() - targetTimestampMs) < playbackPlanCorrectionToleranceMs) return;
        await this.seekMedia(targetTimestampMs);
    }

    private clampTimestamp(timestampMs: number): number {
        if (!Number.isFinite(timestampMs)) return 0;
        const durationMs = this.timingDriver.durationMs();
        if (!Number.isFinite(durationMs)) return Math.max(0, timestampMs);
        return Math.max(0, Math.min(durationMs, timestampMs));
    }
}
