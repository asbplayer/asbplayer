import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { TokenSelectionLocation } from '@project/common/annotations/token-navigation';
import TokenSelectionController from '@project/common/playback/controllers/token-selection-controller';
import type { PlaybackPlanTokenSelection } from '@project/common/playback/plan/playback-plan';
import { makeSubtitle } from '@project/common/playback/playback-test-utils';

const makeController = (plan: PlaybackPlanTokenSelection = { onPause: new Map([[0, 0]]) }) => {
    const state = {
        paused: true,
        automaticallyPaused: false,
        subtitlesVisible: true,
        hideForRepeat: false,
        rendered: true,
        disabledTracks: new Set<number>(),
    };
    const selected: TokenSelectionLocation[] = [];
    let attempts = 0;
    let cleared = 0;
    const controller = new TokenSelectionController(plan, {
        paused: () => state.paused,
        automaticallyPaused: () => state.automaticallyPaused,
        subtitlesVisible: () => state.subtitlesVisible,
        showingSubtitlesAt: (timestampMs) =>
            [makeSubtitle(1000, 2000, 0), makeSubtitle(1000, 2000, 1, { track: 1 })].filter(
                ({ start, end }) => timestampMs >= start && timestampMs < end
            ),
        hideSubtitlesForRepeatAt: () => state.hideForRepeat,
        selectToken: (target) => {
            attempts++;
            if (!state.rendered || state.disabledTracks.has(target.subtitleIndex)) return false;
            selected.push(target);
            return true;
        },
        clearPauseTokenSelection: () => cleared++,
    });
    return { controller, state, selected, attempts: () => attempts, cleared: () => cleared };
};

beforeEach(() => {
    jest.useFakeTimers();
});
afterEach(() => {
    jest.useRealTimers();
});

describe('TokenSelectionController', () => {
    it.each([
        { entries: [], expected: [] },
        { entries: [[1, 4]], expected: [{ subtitleIndex: 1, tokenStart: 4 }] },
        {
            entries: [
                [1, 4],
                [0, 0],
            ],
            expected: [{ subtitleIndex: 0, tokenStart: 0 }],
        },
    ])('selects the first showing subtitle matching $entries', ({ entries, expected }) => {
        const { controller, selected } = makeController({
            onPause: new Map(entries.map(([index, start]) => [index, start])),
        });
        controller.playbackPaused(1500);
        jest.runAllTimers();
        expect(selected).toEqual(expected);
    });

    it('does not select a matching subtitle outside its display interval', () => {
        const { controller, selected } = makeController();
        controller.playbackPaused(2500);
        jest.runAllTimers();
        expect(selected).toEqual([]);
    });

    it('selects an overlapping enabled track when the first matching track is disabled', () => {
        const { controller, state, selected } = makeController({
            onPause: new Map([
                [0, 0],
                [1, 4],
            ]),
        });
        state.disabledTracks.add(0);
        state.rendered = false;
        controller.playbackPaused(1500);
        jest.advanceTimersByTime(32);
        state.rendered = true;
        jest.runAllTimers();
        expect(selected).toEqual([{ subtitleIndex: 1, tokenStart: 4 }]);
    });

    it.each([false, true])('re-evaluates an updated plan only while paused: %s', (paused) => {
        const { controller, state, selected } = makeController({ onPause: new Map() });
        controller.playbackPaused(1500);
        jest.runAllTimers();
        expect(selected).toEqual([]);
        state.paused = paused;
        controller.replacePlan({ onPause: new Map([[1, 4]]) });
        jest.runAllTimers();
        expect(selected).toEqual([]);
        controller.reevaluatePausedSelection(1500);
        jest.runAllTimers();
        expect(selected).toEqual(paused ? [{ subtitleIndex: 1, tokenStart: 4 }] : []);
    });

    it.each([
        { override: undefined, expected: [{ subtitleIndex: 0, tokenStart: 0 }] },
        { override: new Map<number, number>(), expected: [] },
        { override: new Map([[2, 8]]), expected: [] },
        { override: new Map([[1, 4]]), expected: [{ subtitleIndex: 1, tokenStart: 4 }] },
    ])('uses the automatic override $override without falling back when it is empty', ({ override, expected }) => {
        const { controller, state, selected } = makeController({
            onPause: new Map([[0, 0]]),
            onAutoPause: override,
        });
        state.automaticallyPaused = true;
        controller.autoPaused(1500);
        controller.playbackPaused(1500);
        jest.runAllTimers();
        expect(selected).toEqual(expected);

        controller.playbackStarted();
        state.automaticallyPaused = false;
        controller.playbackPaused(1500);
        jest.runAllTimers();
        expect(selected).toEqual([...expected, { subtitleIndex: 0, tokenStart: 0 }]);
    });

    it.each([
        { automatic: false, visible: false, hideForRepeat: false, selects: false },
        { automatic: true, visible: false, hideForRepeat: false, selects: false },
        { automatic: true, visible: true, hideForRepeat: true, selects: false },
        { automatic: true, visible: true, hideForRepeat: false, selects: true },
        { automatic: false, visible: true, hideForRepeat: true, selects: true },
    ])('respects subtitle visibility on pause: %j', ({ automatic, visible, hideForRepeat, selects }) => {
        const { controller, state, selected } = makeController();
        Object.assign(state, { automaticallyPaused: automatic, subtitlesVisible: visible, hideForRepeat });
        if (automatic) controller.autoPaused(1500);
        else controller.playbackPaused(1500);
        jest.runAllTimers();
        expect(selected).toHaveLength(selects ? 1 : 0);
    });

    it.each([false, true])('selects after seeking only when paused: %s', (paused) => {
        const { controller, state, selected } = makeController({
            onPause: new Map([[0, 0]]),
            onAutoPause: new Map([[1, 4]]),
        });
        state.paused = paused;
        controller.seeked(1500);
        jest.runAllTimers();
        expect(selected).toEqual(paused ? [{ subtitleIndex: 0, tokenStart: 0 }] : []);
    });

    it('clears pause selection and cancels retries when seeking into a gap', () => {
        const { controller, state, selected, cleared } = makeController();
        state.rendered = false;
        controller.playbackPaused(1500);
        jest.advanceTimersByTime(0);
        controller.seeked(2500);
        state.rendered = true;
        jest.runAllTimers();
        expect(selected).toEqual([]);
        expect(cleared()).toBe(1);
    });

    it('retries until the paused subtitle renders', () => {
        const { controller, state, selected } = makeController();
        state.rendered = false;
        controller.playbackPaused(1500);
        jest.advanceTimersByTime(32);
        expect(selected).toEqual([]);
        state.rendered = true;
        jest.runAllTimers();
        expect(selected).toEqual([{ subtitleIndex: 0, tokenStart: 0 }]);
    });

    it('stops retrying when the rendering budget is exhausted', () => {
        const { controller, state, selected, attempts } = makeController();
        state.rendered = false;
        controller.playbackPaused(1500);
        jest.runAllTimers();
        const exhaustedAttempts = attempts();
        expect(exhaustedAttempts).toBeGreaterThan(1);
        state.rendered = true;
        jest.advanceTimersByTime(1000);
        expect(attempts()).toBe(exhaustedAttempts);
        expect(selected).toEqual([]);
    });

    it.each(['cancel', 'resume', 'seek-start', 'replace-plan', 'hidden', 'playing'])(
        'cancels rendering retries after %s',
        (cancellation) => {
            const { controller, state, selected } = makeController();
            state.rendered = false;
            controller.playbackPaused(1500);
            jest.advanceTimersByTime(0);
            if (cancellation === 'cancel') controller.cancel();
            if (cancellation === 'resume') controller.playbackStarted();
            if (cancellation === 'seek-start') controller.seekStarted();
            if (cancellation === 'replace-plan') controller.replacePlan({ onPause: new Map([[1, 4]]) });
            if (cancellation === 'hidden') state.subtitlesVisible = false;
            if (cancellation === 'playing') state.paused = false;
            state.rendered = true;
            jest.runAllTimers();
            expect(selected).toEqual([]);
        }
    );

    it('supersedes a pending manual selection with an automatic selection', () => {
        const { controller, state, selected } = makeController({
            onPause: new Map([[0, 0]]),
            onAutoPause: new Map([[1, 4]]),
        });
        state.rendered = false;
        controller.playbackPaused(1500);
        jest.advanceTimersByTime(0);
        state.automaticallyPaused = true;
        controller.autoPaused(1500);
        state.rendered = true;
        jest.runAllTimers();
        expect(selected).toEqual([{ subtitleIndex: 1, tokenStart: 4 }]);
    });

    it('uses the replacement plan for subsequent pauses and clears pause selection on resume', () => {
        const { controller, selected, cleared } = makeController();
        controller.playbackPaused(1500);
        jest.runAllTimers();
        controller.playbackStarted();
        expect(cleared()).toBe(1);
        controller.replacePlan({ onPause: new Map([[1, 4]]) });
        controller.playbackPaused(1500);
        jest.runAllTimers();
        expect(selected).toEqual([
            { subtitleIndex: 0, tokenStart: 0 },
            { subtitleIndex: 1, tokenStart: 4 },
        ]);
    });
});
