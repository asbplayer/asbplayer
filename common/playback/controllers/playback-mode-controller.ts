import { PlayMode } from '@project/common';

export const minimumPlaybackRate = 0.01;

export const roundPlaybackRate = (playbackRate: number): number => Math.round(playbackRate * 1000) / 1000;

export const normalizePlaybackRate = (playbackRate: number): number | undefined => {
    if (!Number.isFinite(playbackRate)) return;
    return Math.max(minimumPlaybackRate, roundPlaybackRate(playbackRate));
};

export interface PlayModeTransition {
    readonly modes: Set<PlayMode>;
    readonly added: Set<PlayMode>;
    readonly removed: Set<PlayMode>;
}

export interface PlaybackModeRememberSettings {
    readonly rememberPlaybackModes: boolean;
    readonly lastPlaybackModes: PlayMode[];
}

export const playbackModesSummaryNotificationKey = 'playback-modes-summary';
export const playbackModeTransitionNotificationKey = 'playback-mode-transition';
export const playbackModeNotificationJoin = ' | ';
const playbackModesSummaryJoin = ' + ';

export interface PlaybackModeNotificationText {
    readonly key: string;
    readonly text: string;
}

export interface PlaybackModeNotificationFormatOptions {
    readonly includeTransition?: boolean;
    readonly summarySeparator?: string;
}

const playbackModeTransitionLocKey = (mode: PlayMode, enabled: boolean): string | undefined => {
    switch (mode) {
        case PlayMode.autoPause:
            return enabled ? 'info.enabledAutoPause' : 'info.disabledAutoPause';
        case PlayMode.condensed:
            return enabled ? 'info.enabledCondensedPlayback' : 'info.disabledCondensedPlayback';
        case PlayMode.fastForward:
            return enabled ? 'info.enabledFastForwardPlayback' : 'info.disabledFastForwardPlayback';
        case PlayMode.repeat:
            return enabled ? 'info.enabledRepeatPlayback' : 'info.disabledRepeatPlayback';
        default:
            return;
    }
};

export const playbackModeLabelLocKey = (mode: PlayMode): string => {
    switch (mode) {
        case PlayMode.normal:
            return 'controls.normalMode';
        case PlayMode.condensed:
            return 'controls.condensedMode';
        case PlayMode.autoPause:
            return 'controls.autoPauseMode';
        case PlayMode.fastForward:
            return 'controls.fastForwardMode';
        case PlayMode.repeat:
            return 'controls.repeatMode';
    }
};

const playbackModesForSummary: readonly PlayMode[] = [
    PlayMode.condensed,
    PlayMode.fastForward,
    PlayMode.autoPause,
    PlayMode.repeat,
];

export const formatPlaybackModeNotifications = (
    transition: PlayModeTransition,
    localize: (locKey: string) => string,
    { includeTransition = true, summarySeparator = ': ' }: PlaybackModeNotificationFormatOptions = {}
): PlaybackModeNotificationText[] => {
    const enabledModes = playbackModesForSummary
        .filter((mode) => transition.modes.has(mode))
        .map((mode) => localize(playbackModeLabelLocKey(mode)));
    const notifications: PlaybackModeNotificationText[] = [
        {
            key: playbackModesSummaryNotificationKey,
            text: `${localize('settings.playbackModes')}${summarySeparator}${
                enabledModes.length > 0
                    ? enabledModes.join(playbackModesSummaryJoin)
                    : localize(playbackModeLabelLocKey(PlayMode.normal))
            }`,
        },
    ];
    if (!includeTransition) return notifications;

    const transitionText = [
        ...[...transition.removed].map((mode) => playbackModeTransitionLocKey(mode, false)),
        ...[...transition.added].map((mode) => playbackModeTransitionLocKey(mode, true)),
    ]
        .filter((locKey): locKey is string => locKey !== undefined)
        .map(localize)
        .join(playbackModeNotificationJoin);
    if (transitionText) {
        notifications.push({
            key: playbackModeTransitionNotificationKey,
            text: transitionText,
        });
    }
    return notifications;
};

export const playbackModesFromSettings = ({
    rememberPlaybackModes,
    lastPlaybackModes,
}: PlaybackModeRememberSettings): Set<PlayMode> =>
    new Set(rememberPlaybackModes ? lastPlaybackModes : [PlayMode.normal]);

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

/** Coordinates playback-mode selection. */
export default class PlaybackModeController {
    private modes: Set<PlayMode>;
    private readonly playbackModesDisabled: boolean;

    constructor(initialModes: ReadonlySet<PlayMode>, playbackModesDisabled: boolean) {
        this.playbackModesDisabled = playbackModesDisabled;
        this.modes = this.normalizeModes(initialModes);
    }

    get playModes(): Set<PlayMode> {
        return new Set(this.modes);
    }

    setModes(modes: ReadonlySet<PlayMode>): PlayModeTransition {
        const oldModes = this.playModes;
        this.modes = this.normalizeModes(modes);
        const newModes = this.playModes;
        return {
            modes: newModes,
            ...modeChanges(oldModes, newModes),
        };
    }

    transition(targetMode: PlayMode): PlayModeTransition {
        const oldModes = this.playModes;
        if (this.playbackModesDisabled) {
            return {
                modes: oldModes,
                added: new Set(),
                removed: new Set(),
            };
        }

        if (targetMode === PlayMode.normal) {
            this.modes = new Set([PlayMode.normal]);
        } else if (this.modes.has(targetMode)) {
            this.modes.delete(targetMode);
            if (this.modes.size === 0) this.modes.add(PlayMode.normal);
        } else {
            this.modes.delete(PlayMode.normal);
            this.modes.add(targetMode);
        }

        const modes = this.playModes;
        return {
            modes,
            ...modeChanges(oldModes, modes),
        };
    }

    private normalizeModes(modes: ReadonlySet<PlayMode>): Set<PlayMode> {
        return this.playbackModesDisabled ? new Set([PlayMode.normal]) : normalizePlaybackModes(modes);
    }
}
