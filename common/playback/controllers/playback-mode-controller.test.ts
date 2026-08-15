import { describe, expect, it } from '@jest/globals';
import { PlayMode } from '@project/common';
import PlaybackModeController, {
    formatPlaybackModeNotifications,
    playbackModesSummaryNotificationKey,
    playbackModeTransitionNotificationKey,
    playbackModesFromSettings,
} from '@project/common/playback/controllers/playback-mode-controller';

const sortedModes = (modes: Set<PlayMode>) => [...modes].sort((left, right) => left - right);

function controllerWithModes(...modes: PlayMode[]) {
    return new PlaybackModeController(new Set(modes), false);
}

interface ModeSelectionCase {
    readonly name: string;
    readonly toggles: PlayMode[];
    readonly expected: PlayMode[];
}

const modeSelectionCases: ModeSelectionCase[] = [
    { name: 'normal', toggles: [], expected: [PlayMode.normal] },
    { name: 'auto-pause', toggles: [PlayMode.autoPause], expected: [PlayMode.autoPause] },
    { name: 'repeat', toggles: [PlayMode.repeat], expected: [PlayMode.repeat] },
    {
        name: 'auto-pause + repeat',
        toggles: [PlayMode.autoPause, PlayMode.repeat],
        expected: [PlayMode.autoPause, PlayMode.repeat],
    },
    { name: 'condensed', toggles: [PlayMode.condensed], expected: [PlayMode.condensed] },
    {
        name: 'condensed + auto-pause',
        toggles: [PlayMode.condensed, PlayMode.autoPause],
        expected: [PlayMode.condensed, PlayMode.autoPause],
    },
    {
        name: 'condensed + repeat',
        toggles: [PlayMode.condensed, PlayMode.repeat],
        expected: [PlayMode.condensed, PlayMode.repeat],
    },
    {
        name: 'condensed + fast-forward',
        toggles: [PlayMode.condensed, PlayMode.fastForward],
        expected: [PlayMode.condensed, PlayMode.fastForward],
    },
    {
        name: 'condensed + auto-pause + repeat',
        toggles: [PlayMode.condensed, PlayMode.autoPause, PlayMode.repeat],
        expected: [PlayMode.condensed, PlayMode.autoPause, PlayMode.repeat],
    },
    { name: 'fast-forward', toggles: [PlayMode.fastForward], expected: [PlayMode.fastForward] },
    {
        name: 'fast-forward + auto-pause',
        toggles: [PlayMode.fastForward, PlayMode.autoPause],
        expected: [PlayMode.fastForward, PlayMode.autoPause],
    },
    {
        name: 'fast-forward + repeat',
        toggles: [PlayMode.fastForward, PlayMode.repeat],
        expected: [PlayMode.fastForward, PlayMode.repeat],
    },
    {
        name: 'fast-forward + auto-pause + repeat',
        toggles: [PlayMode.fastForward, PlayMode.autoPause, PlayMode.repeat],
        expected: [PlayMode.fastForward, PlayMode.autoPause, PlayMode.repeat],
    },
];

describe('playback mode selection', () => {
    it.each([
        {
            name: 'remembering disabled with two stored modes',
            rememberPlaybackModes: false,
            lastPlaybackModes: [PlayMode.autoPause, PlayMode.repeat],
            expected: [PlayMode.normal],
        },
        {
            name: 'remembering enabled with one stored mode',
            rememberPlaybackModes: true,
            lastPlaybackModes: [PlayMode.repeat],
            expected: [PlayMode.repeat],
        },
        {
            name: 'remembering enabled with no stored modes',
            rememberPlaybackModes: true,
            lastPlaybackModes: [],
            expected: [PlayMode.normal],
        },
    ])('selects startup modes for $name', ({ rememberPlaybackModes, lastPlaybackModes, expected }) => {
        const controller = new PlaybackModeController(
            playbackModesFromSettings({ rememberPlaybackModes, lastPlaybackModes }),
            false
        );

        expect(sortedModes(controller.playModes)).toEqual(expected);
    });

    it.each(modeSelectionCases)('reaches the $name selection through public toggles', ({ toggles, expected }) => {
        const controller = controllerWithModes(PlayMode.normal);

        for (const mode of toggles) controller.transition(mode);

        expect(sortedModes(controller.playModes)).toEqual(sortedModes(new Set(expected)));
    });

    it('normalizes empty and mixed-normal initial selections', () => {
        const empty = controllerWithModes();
        const mixed = controllerWithModes(PlayMode.normal, PlayMode.autoPause, PlayMode.repeat);

        expect(sortedModes(empty.playModes)).toEqual([PlayMode.normal]);
        expect(sortedModes(mixed.playModes)).toEqual([PlayMode.autoPause, PlayMode.repeat]);
    });

    it('keeps playback modes normal when disabled', () => {
        const controller = new PlaybackModeController(new Set([PlayMode.repeat]), true);

        expect(sortedModes(controller.playModes)).toEqual([PlayMode.normal]);
        expect(sortedModes(controller.setModes(new Set([PlayMode.repeat])).modes)).toEqual([PlayMode.normal]);
        expect(sortedModes(controller.transition(PlayMode.repeat).modes)).toEqual([PlayMode.normal]);
    });

    it('returns defensive mode snapshots', () => {
        const controller = controllerWithModes(PlayMode.repeat);
        const modes = controller.playModes;

        modes.add(PlayMode.condensed);

        expect(sortedModes(controller.playModes)).toEqual([PlayMode.repeat]);
    });

    it('replaces stale controller modes when an external owner resets to normal', () => {
        const controller = controllerWithModes(PlayMode.condensed, PlayMode.repeat);
        const replacement = new Set([PlayMode.normal]);

        controller.setModes(replacement);
        replacement.add(PlayMode.autoPause);

        expect(sortedModes(controller.playModes)).toEqual([PlayMode.normal]);
        expect(sortedModes(controller.transition(PlayMode.autoPause).modes)).toEqual([PlayMode.autoPause]);
    });

    it('keeps normal selected when normal is toggled by itself', () => {
        const controller = controllerWithModes(PlayMode.normal);

        const transition = controller.transition(PlayMode.normal);

        expect(sortedModes(transition.modes)).toEqual([PlayMode.normal]);
        expect(transition).toMatchObject({ added: new Set(), removed: new Set() });
    });

    it('replaces normal and restores it after the last active mode is disabled', () => {
        const controller = controllerWithModes(PlayMode.normal);

        expect(sortedModes(controller.transition(PlayMode.autoPause).modes)).toEqual([PlayMode.autoPause]);
        expect(sortedModes(controller.transition(PlayMode.autoPause).modes)).toEqual([PlayMode.normal]);
    });

    it('does not report normal mode being disabled when enabling fast-forward', () => {
        const controller = controllerWithModes(PlayMode.normal);

        const transition = controller.transition(PlayMode.fastForward);

        expect(transition).toMatchObject({
            added: new Set([PlayMode.fastForward]),
            removed: new Set([PlayMode.normal]),
        });

        expect(
            formatPlaybackModeNotifications(
                transition,
                (locKey) =>
                    ({
                        'settings.playbackModes': 'Playback Modes',
                        'controls.normalMode': 'Normal',
                        'controls.condensedMode': 'Condensed',
                        'controls.autoPauseMode': 'Auto-pause',
                        'controls.fastForwardMode': 'Fast-forward',
                        'controls.repeatMode': 'Repeat',
                    })[locKey] ?? locKey
            )
        ).toEqual([
            {
                key: playbackModesSummaryNotificationKey,
                text: 'Playback Modes: Fast-forward',
            },
            {
                key: playbackModeTransitionNotificationKey,
                text: 'info.enabledFastForwardPlayback',
            },
        ]);

        expect(
            formatPlaybackModeNotifications(
                transition,
                (locKey) =>
                    ({
                        'settings.playbackModes': 'Playback Modes',
                        'controls.normalMode': 'Normal',
                        'controls.fastForwardMode': 'Fast-forward',
                    })[locKey] ?? locKey,
                { includeTransition: false }
            )
        ).toEqual([{ key: playbackModesSummaryNotificationKey, text: 'Playback Modes: Fast-forward' }]);
    });

    it('shows active modes and falls back to normal', () => {
        const localize = (locKey: string) =>
            ({
                'settings.playbackModes': 'Playback Modes',
                'controls.normalMode': 'Normal',
                'controls.condensedMode': 'Condensed',
                'controls.autoPauseMode': 'Auto-pause',
                'controls.fastForwardMode': 'Fast-forward',
                'controls.repeatMode': 'Repeat',
            })[locKey] ?? locKey;

        const activeModes = {
            modes: new Set([PlayMode.condensed, PlayMode.repeat]),
            added: new Set<PlayMode>(),
            removed: new Set<PlayMode>(),
        };
        const normalModes = {
            modes: new Set([PlayMode.normal]),
            added: new Set<PlayMode>(),
            removed: new Set<PlayMode>(),
        };

        expect(formatPlaybackModeNotifications(activeModes, localize)[0].text).toBe(
            'Playback Modes: Condensed + Repeat'
        );
        expect(formatPlaybackModeNotifications(normalModes, localize)[0].text).toBe('Playback Modes: Normal');
    });

    it('preserves non-conflicting modes over multiple toggles', () => {
        const controller = controllerWithModes(PlayMode.normal);

        expect(sortedModes(controller.transition(PlayMode.autoPause).modes)).toEqual([PlayMode.autoPause]);
        expect(sortedModes(controller.transition(PlayMode.repeat).modes)).toEqual([
            PlayMode.autoPause,
            PlayMode.repeat,
        ]);
        expect(sortedModes(controller.transition(PlayMode.autoPause).modes)).toEqual([PlayMode.repeat]);
        expect(sortedModes(controller.transition(PlayMode.condensed).modes)).toEqual([
            PlayMode.condensed,
            PlayMode.repeat,
        ]);
    });

    it('allows condensed and fast-forward together and reports the observable transition', () => {
        const controller = controllerWithModes(PlayMode.fastForward, PlayMode.repeat);

        const transition = controller.transition(PlayMode.condensed);

        expect(sortedModes(transition.modes)).toEqual([PlayMode.condensed, PlayMode.fastForward, PlayMode.repeat]);
        expect(transition).toMatchObject({
            added: new Set([PlayMode.condensed]),
            removed: new Set(),
        });
        expect(transition).not.toHaveProperty('resetPlaybackRate');

        const reverseTransition = controller.transition(PlayMode.fastForward);
        expect(sortedModes(reverseTransition.modes)).toEqual([PlayMode.condensed, PlayMode.repeat]);
        expect(reverseTransition).toMatchObject({
            added: new Set(),
            removed: new Set([PlayMode.fastForward]),
        });
    });

    it('reports every mode removed when normal clears a multi-mode selection', () => {
        const controller = controllerWithModes(PlayMode.fastForward, PlayMode.repeat);

        const transition = controller.transition(PlayMode.normal);

        expect(sortedModes(transition.modes)).toEqual([PlayMode.normal]);
        expect(transition).toMatchObject({
            added: new Set([PlayMode.normal]),
            removed: new Set([PlayMode.fastForward, PlayMode.repeat]),
        });
        expect(
            formatPlaybackModeNotifications(
                transition,
                (locKey) =>
                    ({
                        'settings.playbackModes': 'Playback Modes',
                        'controls.normalMode': 'Normal',
                        'controls.fastForwardMode': 'Fast-forward',
                        'controls.repeatMode': 'Repeat',
                        'info.disabledFastForwardPlayback': 'Fast-forward playback: Off',
                        'info.disabledRepeatPlayback': 'Repeat playback: Off',
                    })[locKey] ?? locKey
            )
        ).toEqual([
            { key: playbackModesSummaryNotificationKey, text: 'Playback Modes: Normal' },
            {
                key: playbackModeTransitionNotificationKey,
                text: 'Fast-forward playback: Off | Repeat playback: Off',
            },
        ]);
    });

    it('replaces a single non-normal mode when normal is selected', () => {
        const controller = controllerWithModes(PlayMode.repeat);

        const transition = controller.transition(PlayMode.normal);

        expect(sortedModes(transition.modes)).toEqual([PlayMode.normal]);
        expect(transition).toMatchObject({
            added: new Set([PlayMode.normal]),
            removed: new Set([PlayMode.repeat]),
        });
    });
});
