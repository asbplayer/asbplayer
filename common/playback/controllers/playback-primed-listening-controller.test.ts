import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { makeSubtitle } from '@project/common/playback/playback-test-utils';
import type { PlaybackPlanPrimedListening } from '@project/common/playback/plan/playback-plan';
import PlaybackPrimedListeningController, {
    primedListeningReadingTimeMs,
} from '@project/common/playback/controllers/playback-primed-listening-controller';

const primedListening: PlaybackPlanPrimedListening = {
    readingTimePerCharacterMs: 100,
    minimumReadingTimeMs: 500,
    maximumReadingTimeMs: 2000,
    resumeDelayMs: 300,
};

const controllerHarness = (plan: PlaybackPlanPrimedListening | undefined) => {
    const events: string[] = [];
    const controller = new PlaybackPrimedListeningController({
        play: async () => {
            events.push('play');
        },
        showingSubtitlesChanged: () => events.push('showingSubtitlesChanged'),
        onError: (error) => events.push(`error: ${String(error)}`),
    });
    controller.setPrimedListening(plan);
    return { controller, events };
};

const subtitleOfLength = (length: number) => makeSubtitle({ text: 'a'.repeat(length) });

describe('primedListeningReadingTimeMs', () => {
    it('scales with the number of characters being read', () => {
        expect(primedListeningReadingTimeMs(primedListening, [subtitleOfLength(10)])).toBe(1000);
    });

    it('clamps short and long subtitles to the configured bounds', () => {
        expect(primedListeningReadingTimeMs(primedListening, [subtitleOfLength(1)])).toBe(500);
        expect(primedListeningReadingTimeMs(primedListening, [subtitleOfLength(100)])).toBe(2000);
    });

    it('sums the characters of every subtitle being shown', () => {
        expect(primedListeningReadingTimeMs(primedListening, [subtitleOfLength(6), subtitleOfLength(4)])).toBe(1000);
    });
});

describe('PlaybackPrimedListeningController', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it('shows the subtitle, hides it after the reading time, and then resumes playback', () => {
        const { controller, events } = controllerHarness(primedListening);

        controller.paused([subtitleOfLength(10)]);
        expect(controller.subtitlesSuppressed).toBe(false);
        expect(events).toEqual(['showingSubtitlesChanged']);

        jest.advanceTimersByTime(1000);
        expect(controller.subtitlesSuppressed).toBe(true);
        expect(events).toEqual(['showingSubtitlesChanged', 'showingSubtitlesChanged']);

        jest.advanceTimersByTime(300);
        expect(events).toEqual(['showingSubtitlesChanged', 'showingSubtitlesChanged', 'play']);
    });

    it('suppresses subtitles outside of a reading window', () => {
        const { controller } = controllerHarness(primedListening);

        expect(controller.subtitlesSuppressed).toBe(true);
    });

    it('leaves subtitles alone while the mode is off', () => {
        const { controller, events } = controllerHarness(undefined);

        controller.paused([subtitleOfLength(10)]);
        jest.advanceTimersByTime(10_000);

        expect(controller.subtitlesSuppressed).toBe(false);
        expect(events).toEqual([]);
    });

    it('still resumes after the minimum reading time when there is nothing to read', () => {
        const { controller, events } = controllerHarness(primedListening);

        controller.paused([]);
        jest.advanceTimersByTime(500 + 300);

        expect(controller.subtitlesSuppressed).toBe(true);
        expect(events).toEqual(['showingSubtitlesChanged', 'showingSubtitlesChanged', 'play']);
    });

    it('cancels a pending resume and hides the subtitle again', () => {
        const { controller, events } = controllerHarness(primedListening);

        controller.paused([subtitleOfLength(10)]);
        controller.cancel();
        jest.advanceTimersByTime(10_000);

        expect(controller.subtitlesSuppressed).toBe(true);
        expect(events).toEqual(['showingSubtitlesChanged', 'showingSubtitlesChanged']);
    });

    it('restarts the reading window on a subsequent pause', () => {
        const { controller, events } = controllerHarness(primedListening);

        controller.paused([subtitleOfLength(10)]);
        jest.advanceTimersByTime(500);
        controller.paused([subtitleOfLength(1)]);
        jest.advanceTimersByTime(500);
        expect(controller.subtitlesSuppressed).toBe(true);

        jest.advanceTimersByTime(300);
        expect(events.filter((event) => event === 'play')).toEqual(['play']);
    });

    it('cancels any reading window when the mode is turned off', () => {
        const { controller, events } = controllerHarness(primedListening);

        controller.paused([subtitleOfLength(10)]);
        controller.setPrimedListening(undefined);
        jest.advanceTimersByTime(10_000);

        expect(controller.subtitlesSuppressed).toBe(false);
        expect(events).toEqual(['showingSubtitlesChanged', 'showingSubtitlesChanged']);
    });
});
