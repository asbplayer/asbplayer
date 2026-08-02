import type { IndexedSubtitleModel } from '@project/common';
import type { AsbplayerSettings } from '@project/common/settings';
import type { PlaybackPosition } from '@project/common/settings';

export const minimumPlaybackPositionMs = 60_000;
export const playbackPositionSaveIntervalMs = 10_000;
export const maxPlaybackPositions = 50;

export interface PlaybackPositionRememberSettings {
    readonly lastPlaybackPositions: PlaybackPosition[];
}

export const playbackPositionFromSettings = (
    { lastPlaybackPositions }: PlaybackPositionRememberSettings,
    fileNames: readonly string[]
): number | undefined => {
    let position: number | undefined;
    for (const playbackPosition of lastPlaybackPositions) {
        if (!fileNames.includes(playbackPosition.fileName) || !Number.isFinite(playbackPosition.position)) continue;
        if (position === undefined || playbackPosition.position < position) position = playbackPosition.position;
    }
    return position;
};

export const upsertPlaybackPositions = (
    lastPlaybackPositions: readonly PlaybackPosition[],
    fileNames: readonly string[],
    position: number
): PlaybackPosition[] => {
    const updatedPlaybackPositions = lastPlaybackPositions.slice();
    for (let index = fileNames.length - 1; index >= 0; index--) {
        const fileName = fileNames[index];
        const existing = updatedPlaybackPositions.findIndex((p) => p.fileName === fileName);
        if (existing !== -1) updatedPlaybackPositions.splice(existing, 1);
        updatedPlaybackPositions.unshift({ fileName, position });
        if (updatedPlaybackPositions.length > maxPlaybackPositions) updatedPlaybackPositions.pop();
    }
    return updatedPlaybackPositions;
};

export interface PlaybackPositionControllerCallbacks<T extends IndexedSubtitleModel> {
    readonly saveSettings: (settings: Partial<AsbplayerSettings>) => void;
    readonly playbackPositionChanged: (position: number | undefined) => void;
    readonly seek: (timestampMs: number) => Promise<void>;
    readonly play: () => Promise<void>;
    readonly showingSubtitlesAt: (timestampMs: number) => readonly T[];
}

export interface PlaybackPositionControllerOptions<T extends IndexedSubtitleModel> {
    readonly settings: AsbplayerSettings;
    readonly playbackPositionKeys: readonly string[];
    readonly currentTimeMs: () => number;
    readonly durationMs: () => number;
    readonly callbacks: PlaybackPositionControllerCallbacks<T>;
}

/** Controller for managing playback positions for resume on next session. */
export default class PlaybackPositionController<T extends IndexedSubtitleModel> {
    private settings: AsbplayerSettings;
    private readonly currentTimeMs: () => number;
    private readonly durationMs: () => number;
    private readonly callbacks: PlaybackPositionControllerCallbacks<T>;
    private restoreKeys: readonly string[];
    private lastSavedTimestampMs?: number;
    private hasOfferedRestorePosition = false;
    private pendingTimestampMs?: number;
    private skipInitialDiscontinuity = true;
    private playbackPositionSaveTimer?: ReturnType<typeof setInterval>;

    constructor({
        settings,
        playbackPositionKeys,
        currentTimeMs,
        durationMs,
        callbacks,
    }: PlaybackPositionControllerOptions<T>) {
        this.settings = settings;
        this.restoreKeys = this.normalizePlaybackPositionKeys(playbackPositionKeys);
        this.currentTimeMs = currentTimeMs;
        this.durationMs = durationMs;
        this.callbacks = callbacks;
    }

    bind(): void {
        if (this.playbackPositionSaveTimer !== undefined) return;
        this.playbackPositionSaveTimer = setInterval(
            () => this.savePlaybackPosition(this.currentTimeMs()),
            playbackPositionSaveIntervalMs
        );
        this.restorePlaybackPosition();
    }

    unbind(): void {
        if (this.playbackPositionSaveTimer === undefined) return;
        clearInterval(this.playbackPositionSaveTimer);
        this.playbackPositionSaveTimer = undefined;
        this.skipInitialDiscontinuity = true;
    }

    settingsChanged(settings: AsbplayerSettings): void {
        this.settings = settings;
        this.restorePlaybackPosition();
    }

    playbackPositionKeysChanged(playbackPositionKeys: readonly string[]): void {
        const restoreKeys = this.normalizePlaybackPositionKeys(playbackPositionKeys);
        if (this.samePlaybackPositionKeys(this.restoreKeys, restoreKeys)) return;

        this.dismissPlaybackPosition();
        this.restoreKeys = restoreKeys;
        this.hasOfferedRestorePosition = false;
        this.lastSavedTimestampMs = undefined;
        this.restorePlaybackPosition();
    }

    playbackPaused(): void {
        this.savePlaybackPosition(this.currentTimeMs());
    }

    discontinuity(timestampMs: number): void {
        if (this.skipInitialDiscontinuity) {
            this.skipInitialDiscontinuity = false;
            return;
        }
        this.savePlaybackPosition(timestampMs);
    }

    savePlaybackPosition(timestampMs: number): void {
        if (!this.restoreKeys.length || !Number.isFinite(timestampMs) || this.lastSavedTimestampMs === timestampMs) {
            return;
        }

        if (timestampMs < minimumPlaybackPositionMs) {
            this.lastSavedTimestampMs = timestampMs;
            this.removeRememberedPlaybackPositions();
            return;
        }

        const lastPlaybackPositions = upsertPlaybackPositions(
            this.settings.lastPlaybackPositions,
            this.restoreKeys,
            Math.max(0, timestampMs)
        );
        this.lastSavedTimestampMs = timestampMs;
        this.settings = { ...this.settings, lastPlaybackPositions };
        this.callbacks.saveSettings({ lastPlaybackPositions });
    }

    dismissPlaybackPosition(): void {
        if (this.pendingTimestampMs === undefined) return;
        this.pendingTimestampMs = undefined;
        this.callbacks.playbackPositionChanged(undefined);
    }

    async resumePlaybackPosition(): Promise<void> {
        const position = this.pendingTimestampMs;
        if (position === undefined) return;

        this.dismissPlaybackPosition();
        const subtitle = this.callbacks.showingSubtitlesAt(position)[0];
        await this.callbacks.seek(subtitle?.start ?? position);
        await this.callbacks.play();
    }

    private normalizePlaybackPositionKeys(keys: readonly string[]): string[] {
        return [...new Set(keys.filter((key) => key.trim().length > 0))].sort();
    }

    private samePlaybackPositionKeys(first: readonly string[], second: readonly string[]): boolean {
        return first.length === second.length && first.every((key, index) => key === second[index]);
    }

    private removeRememberedPlaybackPositions(): void {
        const lastPlaybackPositions = this.settings.lastPlaybackPositions.filter(
            ({ fileName }) => !this.restoreKeys.includes(fileName)
        );
        if (lastPlaybackPositions.length === this.settings.lastPlaybackPositions.length) return;

        this.settings = { ...this.settings, lastPlaybackPositions };
        this.callbacks.saveSettings({ lastPlaybackPositions });
    }

    private restorePlaybackPosition(): void {
        if (
            !this.restoreKeys.length ||
            this.playbackPositionSaveTimer === undefined ||
            this.hasOfferedRestorePosition
        ) {
            return;
        }

        const position = playbackPositionFromSettings(this.settings, this.restoreKeys);
        this.hasOfferedRestorePosition = true;
        if (position === undefined) return;
        if (position < minimumPlaybackPositionMs) {
            this.removeRememberedPlaybackPositions();
            return;
        }
        if (position >= this.durationMs()) return;

        this.pendingTimestampMs = position;
        this.callbacks.playbackPositionChanged(position);
    }
}
