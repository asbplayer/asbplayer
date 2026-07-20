import { PlayMode } from '@project/common';

export interface PlayModeTransition {
    readonly modes: Set<PlayMode>;
    readonly added: Set<PlayMode>;
    readonly removed: Set<PlayMode>;
}

export interface PlaybackModeRememberSettings {
    readonly rememberPlaybackModes: boolean;
    readonly lastPlaybackModes: PlayMode[];
}

export const playbackModesFromSettings = ({
    rememberPlaybackModes,
    lastPlaybackModes,
}: PlaybackModeRememberSettings): Set<PlayMode> =>
    new Set(rememberPlaybackModes ? lastPlaybackModes : [PlayMode.normal]);

export const hasEnabledPlaybackModes = (modes: ReadonlySet<PlayMode>): boolean =>
    [...modes].some((mode) => mode !== PlayMode.normal);

export const shouldShowPlaybackRateNotification = (
    playbackRateNotificationEnabled: boolean,
    modes: ReadonlySet<PlayMode>
): boolean => playbackRateNotificationEnabled && !modes.has(PlayMode.fastForward);

export const normalizePlaybackModes = (modes: ReadonlySet<PlayMode>): Set<PlayMode> => {
    const normalized = new Set(modes);
    if (normalized.size === 0) {
        normalized.add(PlayMode.normal);
    } else if (normalized.size > 1) {
        normalized.delete(PlayMode.normal);
    }
    return normalized;
};

const modeChanges = (
    oldModes: ReadonlySet<PlayMode>,
    newModes: ReadonlySet<PlayMode>
): Pick<PlayModeTransition, 'added' | 'removed'> => ({
    added: new Set([...newModes].filter((mode) => !oldModes.has(mode))),
    removed: new Set([...oldModes].filter((mode) => !newModes.has(mode))),
});

export const playbackModeNotification = (transition: PlayModeTransition): string[] => {
    const getLocKey = (mode: PlayMode, enabled: boolean): string | undefined => {
        switch (mode) {
            case PlayMode.autoPause:
                return enabled ? 'info.enabledAutoPause' : 'info.disabledAutoPause';
            case PlayMode.condensed:
                return enabled ? 'info.enabledCondensedPlayback' : 'info.disabledCondensedPlayback';
            case PlayMode.fastForward:
                return enabled ? 'info.enabledFastForwardPlayback' : 'info.disabledFastForwardPlayback';
            case PlayMode.repeat:
                return enabled ? 'info.enabledRepeatPlayback' : 'info.disabledRepeatPlayback';
            case PlayMode.normal:
                return enabled ? 'info.disabledAllPlayModes' : undefined;
        }
    };

    const notifications: string[] = [];
    for (const mode of transition.removed) {
        const locKey = getLocKey(mode, false);
        if (locKey !== undefined) notifications.push(locKey);
    }
    for (const mode of transition.added) {
        const locKey = getLocKey(mode, true);
        if (locKey !== undefined) notifications.push(locKey);
    }
    return notifications;
};

/** Coordinates playback-mode selection; media behavior is owned by PlaybackPlanExecutor. */
export default class PlaybackModeController {
    private modes: Set<PlayMode>;

    constructor(initialModes: ReadonlySet<PlayMode> = new Set([PlayMode.normal])) {
        this.modes = normalizePlaybackModes(initialModes);
    }

    get playModes(): Set<PlayMode> {
        return new Set(this.modes);
    }

    setModes(modes: ReadonlySet<PlayMode>): PlayModeTransition {
        const oldModes = this.playModes;
        this.modes = normalizePlaybackModes(modes);
        const newModes = this.playModes;
        return {
            modes: newModes,
            ...modeChanges(oldModes, newModes),
        };
    }

    transition(targetMode: PlayMode): PlayModeTransition {
        const oldModes = this.playModes;

        if (targetMode === PlayMode.normal) {
            this.modes = new Set([PlayMode.normal]);
        } else if (this.modes.has(targetMode)) {
            this.modes.delete(targetMode);
            if (this.modes.size === 0) this.modes.add(PlayMode.normal);
        } else {
            if (this.modes.size === 1 && this.modes.has(PlayMode.normal)) this.modes.delete(PlayMode.normal);
            this.modes.add(targetMode);
            this.resolveConflicts(targetMode);
        }

        const modes = this.playModes;
        return {
            modes,
            ...modeChanges(oldModes, modes),
        };
    }

    private resolveConflicts(newMode: PlayMode): void {
        if (newMode === PlayMode.condensed) this.modes.delete(PlayMode.fastForward);
        if (newMode === PlayMode.fastForward) this.modes.delete(PlayMode.condensed);
    }
}
