import type { IndexedSubtitleModel } from '@project/common';
import type { AsbplayerSettings, SettingsProvider, PlaybackPosition } from '@project/common/settings';
import { asbTrace } from '@project/common/util/log';

export const minimumPlaybackPositionMs = 30_000;
export const playbackPositionSaveIntervalMs = 10_000;
export const maxPlaybackPositions = 25;

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
    readonly playbackPositionsChanged: (positions: readonly PlaybackPosition[]) => void;
    readonly onError: (error: unknown) => void;
}

export interface PlaybackPositionControllerOptions<T extends IndexedSubtitleModel> {
    readonly playbackPositionKeys: readonly string[];
    readonly currentTimeMs: () => number;
    readonly lastSubtitleEndMs: () => number | undefined;
    readonly settingsProvider: SettingsProvider;
    readonly callbacks: PlaybackPositionControllerCallbacks<T>;
}

/** Controller for managing playback positions for resume on next session. */
export default class PlaybackPositionController<T extends IndexedSubtitleModel> {
    private settings?: AsbplayerSettings;
    private readonly currentTimeMs: () => number;
    private readonly lastSubtitleEndMs: () => number | undefined;
    private readonly settingsProvider: SettingsProvider;
    private readonly callbacks: PlaybackPositionControllerCallbacks<T>;
    private restoreKeys: readonly string[];
    private lastSavedTimestampMs?: number;
    private hasOfferedRestorePosition = false;
    private pendingTimestampMs?: number;
    private skipInitialDiscontinuity = true;
    private playbackPositionSaveTimer?: ReturnType<typeof setInterval>;
    private saveOperation: Promise<void> = Promise.resolve();
    private saveOperationId = 0;

    constructor({
        playbackPositionKeys,
        currentTimeMs,
        lastSubtitleEndMs,
        settingsProvider,
        callbacks,
    }: PlaybackPositionControllerOptions<T>) {
        this.restoreKeys = this.normalizePlaybackPositionKeys(playbackPositionKeys);
        this.currentTimeMs = currentTimeMs;
        this.lastSubtitleEndMs = lastSubtitleEndMs;
        this.settingsProvider = settingsProvider;
        this.callbacks = callbacks;
    }

    bind(): void {
        if (this.playbackPositionSaveTimer !== undefined) return;
        asbTrace('playback/position', 'Bound playback position controller', {
            restoreKeyCount: this.restoreKeys.length,
        });
        this.playbackPositionSaveTimer = setInterval(() => {
            void this.savePlaybackPosition(this.currentTimeMs());
        }, playbackPositionSaveIntervalMs);
        this.restorePlaybackPosition();
    }

    unbind(): void {
        if (this.playbackPositionSaveTimer === undefined) return;
        asbTrace('playback/position', 'Unbound playback position controller');
        clearInterval(this.playbackPositionSaveTimer);
        this.playbackPositionSaveTimer = undefined;
        this.skipInitialDiscontinuity = true;
    }

    cancelPendingSaves(): void {
        ++this.saveOperationId;
    }

    profileChanged(): void {
        asbTrace('playback/position', 'Resetting playback position controller for profile change');
        this.cancelPendingSaves();
        this.dismissPlaybackPosition();
        this.hasOfferedRestorePosition = false;
        this.lastSavedTimestampMs = undefined;
    }

    setSettings(settings: AsbplayerSettings): void {
        this.settings = settings;
        asbTrace('playback/position', 'Initialized playback position settings');
    }

    settingsChanged(settings: AsbplayerSettings): void {
        this.settings = settings;
        asbTrace('playback/position', 'Updated playback position settings');
        this.restorePlaybackPosition();
    }

    playbackPositionKeysChanged(
        playbackPositionKeys: readonly string[],
        { isNewSource }: { isNewSource: boolean }
    ): void {
        const restoreKeys = this.normalizePlaybackPositionKeys(playbackPositionKeys);
        if (this.samePlaybackPositionKeys(this.restoreKeys, restoreKeys)) return;

        asbTrace('playback/position', 'Changed playback position restore keys', {
            isNewSource,
            keyCount: restoreKeys.length,
        });
        if (isNewSource) {
            this.dismissPlaybackPosition();
            this.hasOfferedRestorePosition = false;
        }
        this.restoreKeys = restoreKeys;
        this.lastSavedTimestampMs = undefined;
        this.restorePlaybackPosition();
    }

    playbackPaused(): void {
        void this.savePlaybackPosition(this.currentTimeMs());
    }

    discontinuity(timestampMs: number): void {
        if (this.skipInitialDiscontinuity) {
            this.skipInitialDiscontinuity = false;
            return;
        }
        void this.savePlaybackPosition(timestampMs);
    }

    savePlaybackPosition(timestampMs: number): Promise<void> {
        if (!this.settings) return Promise.resolve();
        const restoreKeys = this.restoreKeys;
        if (!restoreKeys.length || !Number.isFinite(timestampMs) || this.lastSavedTimestampMs === timestampMs) {
            return Promise.resolve();
        }

        if (timestampMs < minimumPlaybackPositionMs) {
            this.lastSavedTimestampMs = timestampMs;
            return this.removeRememberedPlaybackPositions();
        }
        if (this.isAtOrBeyondLastSubtitleEnd(timestampMs)) {
            this.lastSavedTimestampMs = timestampMs;
            return this.removeRememberedPlaybackPositions();
        }

        this.lastSavedTimestampMs = timestampMs;
        this.settings = {
            ...this.settings,
            lastPlaybackPositions: upsertPlaybackPositions(
                this.settings.lastPlaybackPositions,
                restoreKeys,
                Math.max(0, timestampMs)
            ),
        };
        this.callbacks.playbackPositionsChanged(this.settings.lastPlaybackPositions);
        return this.enqueueLastPlaybackPositions((lastPlaybackPositions) =>
            upsertPlaybackPositions(lastPlaybackPositions, restoreKeys, Math.max(0, timestampMs))
        );
    }

    dismissPlaybackPosition(): void {
        if (this.pendingTimestampMs === undefined) return;
        asbTrace('playback/position', 'Dismissed remembered playback position', {
            timestampMs: this.pendingTimestampMs,
        });
        this.pendingTimestampMs = undefined;
        this.callbacks.playbackPositionChanged(undefined);
    }

    async resumePlaybackPosition(): Promise<void> {
        const position = this.pendingTimestampMs;
        if (position === undefined) return;

        asbTrace('playback/position', 'Resuming remembered playback position from controller', {
            timestampMs: position,
        });
        this.dismissPlaybackPosition();
        const subtitle = this.callbacks.showingSubtitlesAt(position)[0];
        const targetTimestampMs = subtitle?.start ?? position;
        asbTrace('playback/position', 'Seeking to remembered playback position', { targetTimestampMs });
        await this.callbacks.seek(targetTimestampMs);
        await this.callbacks.play();
    }

    private normalizePlaybackPositionKeys(keys: readonly string[]): string[] {
        return [...new Set(keys.filter((key) => key.trim().length > 0))].sort();
    }

    private samePlaybackPositionKeys(first: readonly string[], second: readonly string[]): boolean {
        return first.length === second.length && first.every((key, index) => key === second[index]);
    }

    private removeRememberedPlaybackPositions(): Promise<void> {
        if (!this.settings) return Promise.resolve();
        const restoreKeys = this.restoreKeys;
        const lastPlaybackPositions = this.settings.lastPlaybackPositions.filter(
            ({ fileName }) => !restoreKeys.includes(fileName)
        );
        if (lastPlaybackPositions.length === this.settings.lastPlaybackPositions.length) return Promise.resolve();
        asbTrace('playback/position', 'Removing remembered playback positions', {
            restoreKeyCount: restoreKeys.length,
        });
        this.settings = {
            ...this.settings,
            lastPlaybackPositions,
        };
        this.callbacks.playbackPositionsChanged(this.settings.lastPlaybackPositions);
        return this.enqueueLastPlaybackPositions((lastPlaybackPositions) =>
            lastPlaybackPositions.filter(({ fileName }) => !restoreKeys.includes(fileName)).length ===
            lastPlaybackPositions.length
                ? [...lastPlaybackPositions]
                : lastPlaybackPositions.filter(({ fileName }) => !restoreKeys.includes(fileName))
        );
    }

    /**
     * Serializes this controller's position updates and reads the latest persisted positions before each write so
     * concurrent playback owners can preserve positions written before their read. The read/modify/write sequence is
     * is hard to make globally atomic, so this is best-effort and may result in dropped updates if multiple owners
     * write at the same time. Considering the frequency of writes, this approach balances consistency with complexity.
     */
    private enqueueLastPlaybackPositions(
        update: (lastPlaybackPositions: readonly PlaybackPosition[]) => PlaybackPosition[]
    ): Promise<void> {
        const saveOperationId = this.saveOperationId;
        this.saveOperation = this.saveOperation
            .catch(() => undefined)
            .then(async () => {
                if (saveOperationId !== this.saveOperationId || !this.settings) return;
                const existingPositions = await this.settingsProvider.getSingle('lastPlaybackPositions');
                if (saveOperationId !== this.saveOperationId || !this.settings) return;
                const lastPlaybackPositions = update(existingPositions);
                if (
                    lastPlaybackPositions.length === existingPositions.length &&
                    lastPlaybackPositions.every((position, index) => position === existingPositions[index])
                ) {
                    return;
                }
                this.settings = { ...this.settings, lastPlaybackPositions };
                this.callbacks.playbackPositionsChanged(lastPlaybackPositions);
                this.callbacks.saveSettings({ lastPlaybackPositions });
            });
        void this.saveOperation.catch((error) => {
            asbTrace('playback/error', 'Failed to persist playback positions', { error });
            this.callbacks.onError(error);
        });
        return this.saveOperation;
    }

    private restorePlaybackPosition(): void {
        if (!this.settings) return;
        if (
            !this.restoreKeys.length ||
            this.playbackPositionSaveTimer === undefined ||
            this.hasOfferedRestorePosition
        ) {
            return;
        }

        const position = playbackPositionFromSettings(this.settings, this.restoreKeys);
        this.hasOfferedRestorePosition = true;
        if (position === undefined) {
            asbTrace('playback/position', 'No remembered playback position found', {
                restoreKeyCount: this.restoreKeys.length,
            });
            return;
        }
        if (position < minimumPlaybackPositionMs) {
            asbTrace('playback/position', 'Discarding remembered playback position below restore threshold', {
                position,
            });
            void this.removeRememberedPlaybackPositions();
            return;
        }
        if (this.isAtOrBeyondLastSubtitleEnd(position)) {
            asbTrace('playback/position', 'Discarding remembered playback position at subtitle end', { position });
            void this.removeRememberedPlaybackPositions();
            return;
        }

        this.pendingTimestampMs = position;
        asbTrace('playback/position', 'Offered remembered playback position', { position });
        this.callbacks.playbackPositionChanged(position);
    }

    private isAtOrBeyondLastSubtitleEnd(timestampMs: number): boolean {
        const lastSubtitleEndMs = this.lastSubtitleEndMs();
        return (
            typeof lastSubtitleEndMs === 'number' &&
            Number.isFinite(lastSubtitleEndMs) &&
            timestampMs >= lastSubtitleEndMs
        );
    }
}
