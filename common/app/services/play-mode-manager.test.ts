import { describe, expect, it, jest } from '@jest/globals';
import { PlayMode } from '@project/common';
import PlayModeManager from '@project/common/app/services/play-mode-manager';

const sortedModes = (modes: Set<PlayMode>) => [...modes].sort((left, right) => left - right);

describe('PlayModeManager', () => {
    it('defaults 0 initial modes to normal', () => {
        const manager = new PlayModeManager(new Set());

        expect(sortedModes(manager.getModes())).toEqual([PlayMode.normal]);
        expect(manager.has(PlayMode.normal)).toBe(true);
        expect(manager.size).toBe(1);
    });

    it('treats normal as exclusive when constructed from a mixed mode set', () => {
        const manager = new PlayModeManager(new Set([PlayMode.normal, PlayMode.autoPause, PlayMode.repeat]));

        expect(sortedModes(manager.getModes())).toEqual([PlayMode.autoPause, PlayMode.repeat]);
        expect(manager.has(PlayMode.normal)).toBe(false);
    });

    it('returns added and removed changes for 1 old mode and 2 new modes', () => {
        const changes = PlayModeManager.getModeChanges(
            new Set([PlayMode.normal]),
            new Set([PlayMode.condensed, PlayMode.repeat])
        );

        expect(sortedModes(changes.added)).toEqual([PlayMode.condensed, PlayMode.repeat]);
        expect(sortedModes(changes.removed)).toEqual([PlayMode.normal]);
    });

    it('keeps normal enabled when toggling normal with only normal selected', () => {
        const manager = new PlayModeManager(new Set([PlayMode.normal]));
        const resolveConflicts = jest.fn();

        const modes = manager.toggle(PlayMode.normal, resolveConflicts);

        expect(sortedModes(modes)).toEqual([PlayMode.normal]);
        expect(resolveConflicts).not.toHaveBeenCalled();
    });

    it('replaces normal when enabling a non-normal mode', () => {
        const manager = new PlayModeManager(new Set([PlayMode.normal]));

        const modes = manager.toggle(PlayMode.autoPause);

        expect(sortedModes(modes)).toEqual([PlayMode.autoPause]);
        expect(manager.has(PlayMode.normal)).toBe(false);
    });

    it('falls back to normal when toggling off the last non-normal mode', () => {
        const manager = new PlayModeManager(new Set([PlayMode.repeat]));

        const modes = manager.toggle(PlayMode.repeat);

        expect(sortedModes(modes)).toEqual([PlayMode.normal]);
        expect(manager.size).toBe(1);
    });

    it('removes fast forward and requests a playback-rate reset when condensed playback conflicts with it', () => {
        const manager = new PlayModeManager(new Set([PlayMode.fastForward]));
        const resolveConflicts = jest.fn();

        const modes = manager.toggle(PlayMode.condensed, resolveConflicts);

        expect(sortedModes(modes)).toEqual([PlayMode.condensed]);
        expect(resolveConflicts).toHaveBeenCalledTimes(1);
        expect(resolveConflicts).toHaveBeenCalledWith({
            mode: PlayMode.fastForward,
            shouldResetPlaybackRate: true,
        });
    });

    it('removes condensed playback without requesting a playback-rate reset when fast forward conflicts with it', () => {
        const manager = new PlayModeManager(new Set([PlayMode.condensed]));
        const resolveConflicts = jest.fn();

        const modes = manager.toggle(PlayMode.fastForward, resolveConflicts);

        expect(sortedModes(modes)).toEqual([PlayMode.fastForward]);
        expect(resolveConflicts).toHaveBeenCalledTimes(1);
        expect(resolveConflicts).toHaveBeenCalledWith({
            mode: PlayMode.condensed,
            shouldResetPlaybackRate: false,
        });
    });

    it('resets fast forward when normal mode clears a 2-mode selection', () => {
        const manager = new PlayModeManager(new Set([PlayMode.fastForward, PlayMode.repeat]));
        const resolveConflicts = jest.fn();

        const modes = manager.toggle(PlayMode.normal, resolveConflicts);

        expect(sortedModes(modes)).toEqual([PlayMode.normal]);
        expect(resolveConflicts).toHaveBeenCalledTimes(1);
        expect(resolveConflicts).toHaveBeenCalledWith({
            mode: PlayMode.fastForward,
            shouldResetPlaybackRate: true,
        });
    });

    it('returns a defensive copy from getModes', () => {
        const manager = new PlayModeManager(new Set([PlayMode.repeat]));
        const modes = manager.getModes();

        modes.add(PlayMode.condensed);

        expect(sortedModes(manager.getModes())).toEqual([PlayMode.repeat]);
    });

    it('preserves non-conflicting modes across multi-step toggles', () => {
        const manager = new PlayModeManager(new Set([PlayMode.normal]));
        const resolveConflicts = jest.fn();

        expect(sortedModes(manager.toggle(PlayMode.autoPause, resolveConflicts))).toEqual([PlayMode.autoPause]);
        expect(sortedModes(manager.toggle(PlayMode.repeat, resolveConflicts))).toEqual([
            PlayMode.autoPause,
            PlayMode.repeat,
        ]);
        expect(sortedModes(manager.toggle(PlayMode.autoPause, resolveConflicts))).toEqual([PlayMode.repeat]);
        expect(sortedModes(manager.toggle(PlayMode.condensed, resolveConflicts))).toEqual([
            PlayMode.condensed,
            PlayMode.repeat,
        ]);

        expect(resolveConflicts).not.toHaveBeenCalled();
    });

    it('resolves conflicting modes that are already present when one conflict target is toggled', () => {
        const manager = new PlayModeManager(new Set([PlayMode.condensed, PlayMode.fastForward, PlayMode.repeat]));
        const resolveConflicts = jest.fn();

        const modes = manager.toggle(PlayMode.fastForward, resolveConflicts);

        expect(sortedModes(modes)).toEqual([PlayMode.condensed, PlayMode.repeat]);
        expect(resolveConflicts).toHaveBeenCalledWith({
            mode: PlayMode.fastForward,
            shouldResetPlaybackRate: true,
        });
    });
});
