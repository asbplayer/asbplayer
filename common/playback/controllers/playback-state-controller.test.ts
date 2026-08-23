import { describe, expect, it } from '@jest/globals';
import type { IndexedSubtitleModel, PlaybackState } from '@project/common';
import PlaybackStateController from '@project/common/playback/controllers/playback-state-controller';

const subtitles: readonly IndexedSubtitleModel[] = [
    {
        text: 'first',
        start: 0,
        end: 1000,
        originalStart: 0,
        originalEnd: 1000,
        track: 0,
        index: 0,
    },
    {
        text: 'second',
        start: 1000,
        end: 2000,
        originalStart: 1000,
        originalEnd: 2000,
        track: 0,
        index: 1,
    },
];

const makeController = () => {
    const state = { currentTimeMs: 500, paused: false };
    let nowMs = 0;
    const playbackStates: PlaybackState[] = [];
    const controller = new PlaybackStateController({
        paused: () => state.paused,
        showingSubtitlesAt: (timestampMs) =>
            subtitles.filter(({ start, end }) => timestampMs >= start && timestampMs < end),
        playbackStateChanged: (playbackState) => playbackStates.push(playbackState),
        now: () => nowMs,
    });
    controller.bind();

    return { controller, playbackStates, state, setNow: (value: number) => (nowMs = value) };
};

describe('PlaybackStateController', () => {
    it('publishes one coherent state snapshot', () => {
        const harness = makeController();
        harness.state.currentTimeMs = 1500;
        harness.state.paused = true;

        harness.controller.notify(1500, { force: false });

        expect(harness.playbackStates).toEqual([
            {
                timestampMs: 1500,
                showingSubtitleIndexes: [1],
                paused: true,
            },
        ]);
    });

    it('suppresses notifications while locked and allows them after the lock is released', () => {
        const harness = makeController();

        const lock = harness.controller.lock();
        try {
            harness.state.currentTimeMs = 1500;
            harness.controller.notify(1500, { force: false });
            expect(harness.playbackStates).toEqual([]);
        } finally {
            harness.controller.unlockAndNotify(lock, 1500, { force: false });
        }

        expect(harness.playbackStates).toEqual([
            {
                timestampMs: 1500,
                showingSubtitleIndexes: [1],
                paused: false,
            },
        ]);
    });

    it('keeps nested locks from exposing an intermediate snapshot', () => {
        const harness = makeController();

        const outerLock = harness.controller.lock();
        const innerLock = harness.controller.lock();
        harness.controller.notify(1500, { force: false });
        harness.controller.unlockAndNotify(innerLock, 500, { force: false });
        expect(harness.playbackStates).toEqual([]);

        harness.state.currentTimeMs = 1500;
        harness.controller.unlockAndNotify(outerLock, 1500, { force: false });

        expect(harness.playbackStates).toEqual([
            {
                timestampMs: 1500,
                showingSubtitleIndexes: [1],
                paused: false,
            },
        ]);
    });

    it('preserves a forced inner unlock until the outer lock is released', () => {
        const harness = makeController();

        harness.controller.notify(500, { force: false });
        harness.setNow(500);
        const outerLock = harness.controller.lock();
        const innerLock = harness.controller.lock();
        harness.controller.unlockAndNotify(innerLock, 550, { force: true });
        harness.controller.unlockAndNotify(outerLock, 600, { force: false });

        expect(harness.playbackStates.map(({ timestampMs }) => timestampMs)).toEqual([500, 600]);
    });

    it('reconciles before publishing when it is not locked', () => {
        const harness = makeController();

        harness.controller.reconcileAndNotify(
            1500,
            () => {
                harness.state.paused = true;
            },
            { force: true }
        );

        expect(harness.playbackStates.at(-1)).toEqual({
            timestampMs: 1500,
            showingSubtitleIndexes: [1],
            paused: true,
        });
    });

    it('defers locked reconciliation to the final timestamp and preserves its force', () => {
        const harness = makeController();
        const reconciliations: number[] = [];

        harness.controller.notify(500, { force: false });
        harness.setNow(500);
        const lock = harness.controller.lock();
        harness.controller.reconcileAndNotify(1500, (timestampMs) => reconciliations.push(timestampMs), {
            force: true,
        });
        harness.controller.unlockAndNotify(lock, 600, { force: false });

        expect(reconciliations).toEqual([600]);
        expect(harness.playbackStates.map(({ timestampMs }) => timestampMs)).toEqual([500, 600]);
    });

    it('does not publish a locked notification', () => {
        const harness = makeController();

        const lock = harness.controller.lock();
        try {
            harness.controller.notify(500, { force: false });
            expect(harness.playbackStates).toEqual([]);
        } finally {
            harness.controller.unlockAndNotify(lock, 500, { force: false });
        }
    });

    it('throttles unchanged timing updates but publishes semantic changes immediately', () => {
        const harness = makeController();

        harness.controller.notify(500, { force: false });
        harness.setNow(500);
        harness.controller.notify(600, { force: false });
        expect(harness.playbackStates).toHaveLength(1);

        harness.state.currentTimeMs = 1500;
        harness.controller.notify(1500, { force: false });
        expect(harness.playbackStates.at(-1)).toEqual({
            timestampMs: 1500,
            showingSubtitleIndexes: [1],
            paused: false,
        });
    });

    it('publishes a forced unchanged state during the throttle interval', () => {
        const harness = makeController();

        harness.controller.notify(500, { force: false });
        harness.setNow(500);
        harness.controller.notify(600, { force: true });

        expect(harness.playbackStates.map(({ timestampMs }) => timestampMs)).toEqual([500, 600]);
    });

    it('publishes an unchanged timing state when the throttle interval expires', () => {
        const harness = makeController();

        harness.controller.notify(500, { force: false });
        harness.setNow(999);
        harness.controller.notify(600, { force: false });
        harness.setNow(1000);
        harness.controller.notify(700, { force: false });

        expect(harness.playbackStates.map(({ timestampMs }) => timestampMs)).toEqual([500, 700]);
    });

    it('does not let a lock from an old binding suppress or publish into the new binding', () => {
        const harness = makeController();
        const oldLock = harness.controller.lock();

        harness.controller.bind();
        harness.controller.notify(1500, { force: true });
        harness.controller.unlockAndNotify(oldLock, 500, { force: true });

        expect(harness.playbackStates).toEqual([
            {
                timestampMs: 1500,
                showingSubtitleIndexes: [1],
                paused: false,
            },
        ]);
    });
});
