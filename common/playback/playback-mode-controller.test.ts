import { describe, expect, it } from '@jest/globals';
import { PlayMode } from '@project/common';
import PlaybackModeController, {
    hasEnabledPlaybackModes,
    playbackModeNotifications,
    playbackModesFromSettings,
} from '@project/common/playback/playback-mode-controller';

const sortedModes = (modes: Set<PlayMode>) => [...modes].sort((left, right) => left - right);

function controllerWithModes(...modes: PlayMode[]) {
    return new PlaybackModeController(new Set(modes));
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
        { name: 'no modes', modes: [], expected: false },
        { name: 'normal mode only', modes: [PlayMode.normal], expected: false },
        { name: 'one enabled mode', modes: [PlayMode.repeat], expected: true },
        { name: 'two enabled modes', modes: [PlayMode.autoPause, PlayMode.repeat], expected: true },
    ])('reports whether $name should be shown on first load', ({ modes, expected }) => {
        expect(hasEnabledPlaybackModes(new Set(modes))).toBe(expected);
    });

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
            playbackModesFromSettings({ rememberPlaybackModes, lastPlaybackModes })
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

        expect(playbackModeNotifications(controller.transition(PlayMode.fastForward)).notifications).toEqual([
            'info.enabledFastForwardPlayback',
        ]);
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

    it('makes condensed and fast-forward mutually exclusive and reports the observable transition', () => {
        const controller = controllerWithModes(PlayMode.fastForward, PlayMode.repeat);

        const transition = controller.transition(PlayMode.condensed);

        expect(sortedModes(transition.modes)).toEqual([PlayMode.condensed, PlayMode.repeat]);
        expect(transition).toMatchObject({
            added: new Set([PlayMode.condensed]),
            removed: new Set([PlayMode.fastForward]),
        });
        expect(transition).not.toHaveProperty('resetPlaybackRate');

        const reverseTransition = controller.transition(PlayMode.fastForward);
        expect(sortedModes(reverseTransition.modes)).toEqual([PlayMode.fastForward, PlayMode.repeat]);
        expect(reverseTransition).toMatchObject({
            added: new Set([PlayMode.fastForward]),
            removed: new Set([PlayMode.condensed]),
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
