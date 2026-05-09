import { PlayMode } from '@project/common';

export interface ConflictResolutionContext {
    mode: PlayMode;
    shouldResetPlaybackRate: boolean;
}

export interface PlayModeChanges {
    readonly added: Set<PlayMode>;
    readonly removed: Set<PlayMode>;
}

export default class PlayModeManager {
    private _modes: Set<PlayMode>;
    private readonly _conflicts: readonly [PlayMode, PlayMode][] = [[PlayMode.condensed, PlayMode.fastForward]];

    constructor(initialModes: Set<PlayMode> = new Set([PlayMode.normal])) {
        this._modes = new Set(initialModes);
        if (this._modes.size === 0) {
            this._modes.add(PlayMode.normal);
        }
    }

    static getModeChanges(oldModes: Set<PlayMode>, newModes: Set<PlayMode>): PlayModeChanges {
        const added = new Set<PlayMode>();
        const removed = new Set<PlayMode>();

        for (const mode of newModes) {
            if (!oldModes.has(mode)) {
                added.add(mode);
            }
        }

        for (const mode of oldModes) {
            if (!newModes.has(mode)) {
                removed.add(mode);
            }
        }

        return { added, removed };
    }

    getModes(): Set<PlayMode> {
        return new Set(this._modes);
    }

    has(mode: PlayMode): boolean {
        return this._modes.has(mode);
    }

    get size(): number {
        return this._modes.size;
    }

    toggle(targetMode: PlayMode, resolveConflicts?: (context: ConflictResolutionContext) => void): Set<PlayMode> {
        const hadFastForwardBefore = this._modes.has(PlayMode.fastForward);

        if (targetMode === PlayMode.normal) {
            if (this._modes.size === 1 && this._modes.has(PlayMode.normal)) {
                return this.getModes();
            }
            this._modes = new Set([PlayMode.normal]);
            if (hadFastForwardBefore && resolveConflicts) {
                resolveConflicts({ mode: PlayMode.fastForward, shouldResetPlaybackRate: true });
            }
            return this.getModes();
        }

        if (this._modes.has(targetMode)) {
            this._modes.delete(targetMode);
            if (this._modes.size === 0) {
                this._modes.add(PlayMode.normal);
            }
        } else {
            if (this._modes.has(PlayMode.normal) && this._modes.size === 1) {
                this._modes.delete(PlayMode.normal);
            }
            this._modes.add(targetMode);
        }

        if (hadFastForwardBefore && !this._modes.has(PlayMode.fastForward) && resolveConflicts) {
            resolveConflicts({ mode: PlayMode.fastForward, shouldResetPlaybackRate: true });
        }

        this._resolvePlayModeConflicts(targetMode, resolveConflicts);

        return this.getModes();
    }

    private _resolvePlayModeConflicts(
        newMode: PlayMode,
        onConflict?: (context: ConflictResolutionContext) => void
    ): void {
        for (const [mode1, mode2] of this._conflicts) {
            const conflictingMode = this._findConflictingMode(newMode, mode1, mode2);
            if (conflictingMode !== null) {
                const shouldResetPlaybackRate = onConflict !== undefined && conflictingMode === PlayMode.fastForward;
                if (onConflict) {
                    onConflict({ mode: conflictingMode, shouldResetPlaybackRate });
                }
                this._modes.delete(conflictingMode);
            }
        }
    }

    private _findConflictingMode(newMode: PlayMode, mode1: PlayMode, mode2: PlayMode): PlayMode | null {
        if (newMode === mode1 && this._modes.has(mode2)) {
            return mode2;
        }
        if (newMode === mode2 && this._modes.has(mode1)) {
            return mode1;
        }
        return null;
    }
}
