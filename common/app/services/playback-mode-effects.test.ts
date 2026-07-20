import { describe, expect, it, jest } from '@jest/globals';
import { AutoPausePreference, PlayMode, type SubtitleModel } from '@project/common';
import { SubtitleCollection, type SubtitleSlice } from '@project/common/subtitle-collection';
import {
    applySubtitleStopPlaybackModeEffect,
    pendingPlaybackModeSeekTimestamp,
    selectCondensedPlaybackSeekTimestamp,
    selectFastForwardPlaybackRate,
    selectSubtitleStopPlaybackModeEffect,
    shouldAutoPauseAtSubtitleEnd,
    shouldAutoPauseAtSubtitleStart,
} from './playback-mode-effects';

const makeSubtitle = (overrides: Partial<SubtitleModel> = {}): SubtitleModel => ({
    text: 'subtitle',
    start: 0,
    end: 1000,
    originalStart: 0,
    originalEnd: 1000,
    track: 0,
    index: 0,
    ...overrides,
});

const makeCollection = (subtitles: SubtitleModel[]) => {
    const collection = new SubtitleCollection<SubtitleModel>({ returnLastShown: true, returnNextToShow: true });
    collection.setSubtitles(subtitles);
    return collection;
};

const emptyCollection = makeCollection([]);

describe('app playback mode effects', () => {
    it('pauses at subtitle start only when app auto-pause at start applies locally', () => {
        const subtitle = makeSubtitle();
        const playModes = new Set([PlayMode.autoPause]);

        expect(
            shouldAutoPauseAtSubtitleStart({
                playModes,
                autoPausePreference: AutoPausePreference.atStart,
                seekableTracks: 1,
                subtitle,
                delegatedToVideoPlayer: false,
            })
        ).toBe(true);
        expect(
            shouldAutoPauseAtSubtitleStart({
                playModes,
                autoPausePreference: AutoPausePreference.atStart,
                seekableTracks: 1,
                subtitle,
                delegatedToVideoPlayer: true,
            })
        ).toBe(false);
        expect(
            shouldAutoPauseAtSubtitleStart({
                playModes,
                autoPausePreference: AutoPausePreference.atEnd,
                seekableTracks: 1,
                subtitle,
                delegatedToVideoPlayer: false,
            })
        ).toBe(false);
        expect(
            shouldAutoPauseAtSubtitleStart({
                playModes,
                autoPausePreference: AutoPausePreference.atStart,
                seekableTracks: 0,
                subtitle,
                delegatedToVideoPlayer: false,
            })
        ).toBe(false);
        expect(
            shouldAutoPauseAtSubtitleStart({
                playModes: new Set([PlayMode.normal]),
                autoPausePreference: AutoPausePreference.atStart,
                seekableTracks: 1,
                subtitle,
                delegatedToVideoPlayer: false,
            })
        ).toBe(false);
    });

    it('pauses at subtitle end only when app auto-pause at end applies locally', () => {
        const subtitle = makeSubtitle();
        const playModes = new Set([PlayMode.autoPause]);

        expect(
            shouldAutoPauseAtSubtitleEnd({
                playModes,
                autoPausePreference: AutoPausePreference.atEnd,
                seekableTracks: 1,
                subtitle,
                delegatedToVideoPlayer: false,
            })
        ).toBe(true);
        expect(
            shouldAutoPauseAtSubtitleEnd({
                playModes,
                autoPausePreference: AutoPausePreference.atStart,
                seekableTracks: 1,
                subtitle,
                delegatedToVideoPlayer: false,
            })
        ).toBe(false);
        expect(
            shouldAutoPauseAtSubtitleEnd({
                playModes,
                autoPausePreference: AutoPausePreference.atEnd,
                seekableTracks: 0,
                subtitle,
                delegatedToVideoPlayer: false,
            })
        ).toBe(false);
        expect(
            shouldAutoPauseAtSubtitleEnd({
                playModes,
                autoPausePreference: AutoPausePreference.atEnd,
                seekableTracks: 1,
                subtitle,
                delegatedToVideoPlayer: true,
            })
        ).toBe(false);
    });

    it('pauses at subtitle end for local auto-pause mode', () => {
        const effect = selectSubtitleStopPlaybackModeEffect({
            playModes: new Set([PlayMode.autoPause]),
            autoPausePreference: AutoPausePreference.atEnd,
            seekableTracks: 1,
            subtitle: makeSubtitle({ start: 2000, end: 2600 }),
            subtitleCollection: emptyCollection,
            delegatedToVideoPlayer: false,
            lastSeekDuration: 0,
        });

        expect(effect).toEqual({
            resetPendingAutoRepeatTargetTimestamp: true,
            pause: true,
            preservePlaybackStateWhileSeeking: false,
            recordSeekDuration: false,
        });
    });

    it('does not reset pending repeat state or pause when the subtitle track is not seekable', () => {
        const effect = selectSubtitleStopPlaybackModeEffect({
            playModes: new Set([PlayMode.autoPause, PlayMode.repeat]),
            autoPausePreference: AutoPausePreference.atEnd,
            seekableTracks: 0,
            subtitle: makeSubtitle({ start: 2000, end: 2600 }),
            subtitleCollection: emptyCollection,
            delegatedToVideoPlayer: false,
            lastSeekDuration: 0,
        });

        expect(effect).toEqual({
            resetPendingAutoRepeatTargetTimestamp: false,
            pause: false,
            preservePlaybackStateWhileSeeking: false,
            recordSeekDuration: false,
        });
    });

    it('keeps auto-pause end state local to the delegated video player without pausing in the app', () => {
        const effect = selectSubtitleStopPlaybackModeEffect({
            playModes: new Set([PlayMode.autoPause]),
            autoPausePreference: AutoPausePreference.atEnd,
            seekableTracks: 1,
            subtitle: makeSubtitle({ start: 2000, end: 2600 }),
            subtitleCollection: emptyCollection,
            delegatedToVideoPlayer: true,
            lastSeekDuration: 0,
        });

        expect(effect).toEqual({
            resetPendingAutoRepeatTargetTimestamp: true,
            pause: false,
            preservePlaybackStateWhileSeeking: false,
            recordSeekDuration: false,
        });
    });

    it('seeks to the subtitle start for repeat mode without auto-pause at end', () => {
        const effect = selectSubtitleStopPlaybackModeEffect({
            playModes: new Set([PlayMode.repeat]),
            autoPausePreference: AutoPausePreference.atEnd,
            seekableTracks: 1,
            subtitle: makeSubtitle({ start: 2000, end: 2600 }),
            subtitleCollection: emptyCollection,
            delegatedToVideoPlayer: false,
            lastSeekDuration: 0,
        });

        expect(effect).toEqual({
            resetPendingAutoRepeatTargetTimestamp: true,
            pause: false,
            seekTimestamp: 2000,
            preservePlaybackStateWhileSeeking: false,
            recordSeekDuration: false,
        });
    });

    it('pauses and schedules the repeat target when auto-pause at end and repeat are combined', () => {
        const effect = selectSubtitleStopPlaybackModeEffect({
            playModes: new Set([PlayMode.autoPause, PlayMode.repeat]),
            autoPausePreference: AutoPausePreference.atEnd,
            seekableTracks: 1,
            subtitle: makeSubtitle({ start: 2000, end: 2600 }),
            subtitleCollection: emptyCollection,
            delegatedToVideoPlayer: false,
            lastSeekDuration: 0,
        });

        expect(effect).toEqual({
            resetPendingAutoRepeatTargetTimestamp: true,
            pause: true,
            pendingAutoRepeatTargetTimestamp: 2000,
            preservePlaybackStateWhileSeeking: false,
            recordSeekDuration: false,
        });
    });

    it('delegates pausing while preserving repeat and condensed targets for the video player', () => {
        const current = makeSubtitle({ start: 2000, end: 2600, index: 0 });
        const next = makeSubtitle({ start: 5000, end: 6000, index: 1 });
        const commonArgs = {
            autoPausePreference: AutoPausePreference.atEnd,
            seekableTracks: 1,
            subtitle: current,
            subtitleCollection: makeCollection([current, next]),
            delegatedToVideoPlayer: true,
            lastSeekDuration: 100,
        };

        expect(
            selectSubtitleStopPlaybackModeEffect({
                ...commonArgs,
                playModes: new Set([PlayMode.autoPause, PlayMode.repeat]),
            })
        ).toMatchObject({ pause: false, pendingAutoRepeatTargetTimestamp: 2000 });
        expect(
            selectSubtitleStopPlaybackModeEffect({
                ...commonArgs,
                playModes: new Set([PlayMode.autoPause, PlayMode.condensed]),
            })
        ).toMatchObject({ pause: false, pendingAutoRepeatTargetTimestamp: 5000 });
    });

    it('selects the next subtitle for app condensed mode after a large enough gap', () => {
        const current = makeSubtitle({ start: 1000, end: 2000, index: 0 });
        const next = makeSubtitle({ start: 3300, end: 4300, index: 1 });
        const collection = makeCollection([current, next]);

        const effect = selectSubtitleStopPlaybackModeEffect({
            playModes: new Set([PlayMode.autoPause, PlayMode.condensed]),
            autoPausePreference: AutoPausePreference.atStart,
            seekableTracks: 1,
            subtitle: current,
            subtitleCollection: collection,
            delegatedToVideoPlayer: false,
            lastSeekDuration: 100,
        });

        expect(effect).toEqual({
            resetPendingAutoRepeatTargetTimestamp: true,
            pause: false,
            seekTimestamp: 3300,
            preservePlaybackStateWhileSeeking: true,
            recordSeekDuration: true,
        });
    });

    it('schedules the next subtitle when auto-pause at end and condensed mode are combined', () => {
        const current = makeSubtitle({ start: 1000, end: 2000, index: 0 });
        const next = makeSubtitle({ start: 5000, end: 6000, index: 1 });

        const effect = selectSubtitleStopPlaybackModeEffect({
            playModes: new Set([PlayMode.autoPause, PlayMode.condensed]),
            autoPausePreference: AutoPausePreference.atEnd,
            seekableTracks: 1,
            subtitle: current,
            subtitleCollection: makeCollection([current, next]),
            delegatedToVideoPlayer: false,
            lastSeekDuration: 100,
        });

        expect(effect).toEqual({
            resetPendingAutoRepeatTargetTimestamp: true,
            pause: true,
            pendingAutoRepeatTargetTimestamp: 5000,
            preservePlaybackStateWhileSeeking: false,
            recordSeekDuration: false,
        });
    });

    it('does not apply stop-time condensed seeking without local auto-pause at start', () => {
        const current = makeSubtitle({ start: 1000, end: 2000, index: 0 });
        const next = makeSubtitle({ start: 5000, end: 6000, index: 1 });

        const effect = selectSubtitleStopPlaybackModeEffect({
            playModes: new Set([PlayMode.condensed]),
            autoPausePreference: AutoPausePreference.atStart,
            seekableTracks: 1,
            subtitle: current,
            subtitleCollection: makeCollection([current, next]),
            delegatedToVideoPlayer: false,
            lastSeekDuration: 100,
        });

        expect(effect).toEqual({
            resetPendingAutoRepeatTargetTimestamp: true,
            pause: false,
            preservePlaybackStateWhileSeeking: false,
            recordSeekDuration: false,
        });
    });

    it('does not select a condensed seek target for small gaps or pending repeat targets', () => {
        const next = makeSubtitle({ start: 1400, end: 2000, index: 1 });
        const slice: SubtitleSlice<SubtitleModel> = {
            showing: [],
            nextToShow: [next],
            startedShowing: undefined,
            willStopShowing: undefined,
        };

        expect(
            selectCondensedPlaybackSeekTimestamp({
                slice,
                timestamp: 1000,
                expectedSeekTime: 100,
                pendingAutoRepeatTargetTimestamp: 0,
            })
        ).toBeUndefined();
        expect(
            selectCondensedPlaybackSeekTimestamp({
                slice: { ...slice, nextToShow: [makeSubtitle({ start: 3000, index: 2 })] },
                timestamp: 1000,
                expectedSeekTime: 100,
                pendingAutoRepeatTargetTimestamp: 2500,
            })
        ).toBeUndefined();
    });

    it('handles zero next subtitles and seeks at the exact condensed threshold', () => {
        const baseSlice: SubtitleSlice<SubtitleModel> = {
            showing: [],
            startedShowing: undefined,
            willStopShowing: undefined,
        };

        expect(
            selectCondensedPlaybackSeekTimestamp({
                slice: baseSlice,
                timestamp: 1000,
                expectedSeekTime: 100,
                pendingAutoRepeatTargetTimestamp: 0,
            })
        ).toBeUndefined();
        expect(
            selectCondensedPlaybackSeekTimestamp({
                slice: { ...baseSlice, nextToShow: [] },
                timestamp: 1000,
                expectedSeekTime: 100,
                pendingAutoRepeatTargetTimestamp: 0,
            })
        ).toBeUndefined();
        expect(
            selectCondensedPlaybackSeekTimestamp({
                slice: { ...baseSlice, nextToShow: [makeSubtitle({ start: 1600 })] },
                timestamp: 1000,
                expectedSeekTime: 100,
                pendingAutoRepeatTargetTimestamp: 0,
            })
        ).toBe(1600);
    });

    it('selects fast-forward speed only in subtitle gaps with enough lead time', () => {
        expect(
            selectFastForwardPlaybackRate({
                slice: {
                    showing: [],
                    nextToShow: [makeSubtitle({ start: 3000, index: 1 })],
                    startedShowing: undefined,
                    willStopShowing: undefined,
                },
                timestamp: 1000,
                fastForwardModePlaybackRate: 2.7,
            })
        ).toBe(2.7);
        expect(
            selectFastForwardPlaybackRate({
                slice: {
                    showing: [makeSubtitle({ start: 1000, end: 1500 })],
                    startedShowing: undefined,
                    willStopShowing: undefined,
                },
                timestamp: 1200,
                fastForwardModePlaybackRate: 2.7,
            })
        ).toBe(1);
        expect(
            selectFastForwardPlaybackRate({
                slice: {
                    showing: [],
                    nextToShow: [makeSubtitle({ start: 1800, index: 1 })],
                    startedShowing: undefined,
                    willStopShowing: undefined,
                },
                timestamp: 1000,
                fastForwardModePlaybackRate: 2.7,
            })
        ).toBe(1);
    });

    it('fast-forwards after the last subtitle but not for an explicit empty next-subtitle list', () => {
        const baseSlice: SubtitleSlice<SubtitleModel> = {
            showing: [],
            startedShowing: undefined,
            willStopShowing: undefined,
        };

        expect(
            selectFastForwardPlaybackRate({
                slice: baseSlice,
                timestamp: 3000,
                fastForwardModePlaybackRate: 2.7,
            })
        ).toBe(2.7);
        expect(
            selectFastForwardPlaybackRate({
                slice: { ...baseSlice, nextToShow: [] },
                timestamp: 3000,
                fastForwardModePlaybackRate: 2.7,
            })
        ).toBe(1);
    });

    it('consumes pending playback targets only for auto-pause or repeat modes', () => {
        expect(pendingPlaybackModeSeekTimestamp(new Set([PlayMode.normal]), 0)).toBeUndefined();
        expect(pendingPlaybackModeSeekTimestamp(new Set([PlayMode.normal]), 2500)).toBeUndefined();
        expect(pendingPlaybackModeSeekTimestamp(new Set([PlayMode.autoPause]), 2500)).toBe(2500);
        expect(pendingPlaybackModeSeekTimestamp(new Set([PlayMode.repeat]), 2500)).toBe(2500);
    });

    it('applies pause and pending-target effects without seeking', async () => {
        const clock = { running: false, stop: jest.fn(), start: jest.fn() };
        const pause = jest.fn();
        const seek = jest.fn(async () => undefined);
        const resetPending = jest.fn();
        const setPending = jest.fn();
        const setLastSeekDuration = jest.fn();

        await applySubtitleStopPlaybackModeEffect({
            effect: {
                resetPendingAutoRepeatTargetTimestamp: true,
                pause: true,
                pendingAutoRepeatTargetTimestamp: 2000,
                preservePlaybackStateWhileSeeking: false,
                recordSeekDuration: false,
            },
            clock,
            pause,
            seek,
            resetPendingAutoRepeatTargetTimestamp: resetPending,
            setPendingAutoRepeatTargetTimestamp: setPending,
            setLastSeekDuration,
        });

        expect(resetPending).toHaveBeenCalledTimes(1);
        expect(pause).toHaveBeenCalledTimes(1);
        expect(setPending).toHaveBeenCalledWith(2000);
        expect(seek).not.toHaveBeenCalled();
        expect(clock.stop).not.toHaveBeenCalled();
        expect(clock.start).not.toHaveBeenCalled();
        expect(setLastSeekDuration).not.toHaveBeenCalled();
    });

    it('preserves playback state and records duration around an applied seek effect', async () => {
        const clock = { running: true, stop: jest.fn(), start: jest.fn() };
        const seek = jest.fn(async () => undefined);
        const setLastSeekDuration = jest.fn();
        const now = jest.fn<() => number>().mockReturnValueOnce(100).mockReturnValueOnce(145);

        await applySubtitleStopPlaybackModeEffect({
            effect: {
                resetPendingAutoRepeatTargetTimestamp: true,
                pause: false,
                seekTimestamp: 3300,
                preservePlaybackStateWhileSeeking: true,
                recordSeekDuration: true,
            },
            clock,
            pause: jest.fn(),
            seek,
            resetPendingAutoRepeatTargetTimestamp: jest.fn(),
            setPendingAutoRepeatTargetTimestamp: jest.fn(),
            setLastSeekDuration,
            now,
        });

        expect(clock.stop).toHaveBeenCalledTimes(1);
        expect(seek).toHaveBeenCalledWith(3300);
        expect(setLastSeekDuration).toHaveBeenCalledWith(45);
        expect(clock.start).toHaveBeenCalledTimes(1);
    });

    it('does not stop or restart playback when a seek effect does not preserve playback state', async () => {
        const clock = { running: true, stop: jest.fn(), start: jest.fn() };
        const seek = jest.fn(async () => undefined);

        await applySubtitleStopPlaybackModeEffect({
            effect: {
                resetPendingAutoRepeatTargetTimestamp: true,
                pause: false,
                seekTimestamp: 3300,
                preservePlaybackStateWhileSeeking: false,
                recordSeekDuration: false,
            },
            clock,
            pause: jest.fn(),
            seek,
            resetPendingAutoRepeatTargetTimestamp: jest.fn(),
            setPendingAutoRepeatTargetTimestamp: jest.fn(),
            setLastSeekDuration: jest.fn(),
        });

        expect(seek).toHaveBeenCalledWith(3300);
        expect(clock.stop).not.toHaveBeenCalled();
        expect(clock.start).not.toHaveBeenCalled();
    });

    it('does nothing when an applied effect does not reset pending state', async () => {
        const resetPending = jest.fn();
        const pause = jest.fn();
        const seek = jest.fn(async () => undefined);

        await applySubtitleStopPlaybackModeEffect({
            effect: {
                resetPendingAutoRepeatTargetTimestamp: false,
                pause: false,
                preservePlaybackStateWhileSeeking: false,
                recordSeekDuration: false,
            },
            clock: { running: false, stop: jest.fn(), start: jest.fn() },
            pause,
            seek,
            resetPendingAutoRepeatTargetTimestamp: resetPending,
            setPendingAutoRepeatTargetTimestamp: jest.fn(),
            setLastSeekDuration: jest.fn(),
        });

        expect(resetPending).not.toHaveBeenCalled();
        expect(pause).not.toHaveBeenCalled();
        expect(seek).not.toHaveBeenCalled();
    });
});
