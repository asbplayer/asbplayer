import { describe, expect, it, jest } from '@jest/globals';
import Clock from '@project/common/playback/timing/clock';

describe('Clock', () => {
    it('tracks monotonic playback time in milliseconds across rate changes and pauses', () => {
        let nowMs = 10_000;
        const clock = new Clock(() => nowMs);

        clock.start();
        nowMs = 11_500;
        expect(clock.time({ maxMs: Number.POSITIVE_INFINITY })).toBe(1_500);

        clock.rate = 2;
        nowMs = 12_500;
        expect(clock.time({ maxMs: Number.POSITIVE_INFINITY })).toBe(3_500);

        clock.stop();
        nowMs = 20_000;
        expect(clock.time({ maxMs: Number.POSITIVE_INFINITY })).toBe(3_500);
    });

    it('does not lose elapsed time when start is called while already running', () => {
        let nowMs = 0;
        const clock = new Clock(() => nowMs);

        clock.start();
        nowMs = 1_000;
        clock.start();
        nowMs = 2_000;

        expect(clock.time({ maxMs: Number.POSITIVE_INFINITY })).toBe(2_000);
    });

    it('seeks in milliseconds and reports progress against a millisecond duration', () => {
        const clock = new Clock(() => 0);

        clock.setTime(2_500, { paused: !clock.running });

        expect(clock.time({ maxMs: Number.POSITIVE_INFINITY })).toBe(2_500);
        expect(clock.time({ maxMs: 2_000 })).toBe(2_000);
        expect(clock.progress({ durationMs: 10_000 })).toBe(0.25);
        expect(clock.progress({ durationMs: 0 })).toBe(0);
    });

    it('sets the playback state atomically with the timestamp when requested', () => {
        let nowMs = 0;
        const clock = new Clock(() => nowMs);
        const runningDuringSetTime: boolean[] = [];
        const playbackEvents: string[] = [];
        clock.onEvent('settime', () => runningDuringSetTime.push(clock.running));
        clock.onEvent('start', () => playbackEvents.push('start'));
        clock.onEvent('stop', () => playbackEvents.push('stop'));

        clock.start();
        nowMs = 100;
        clock.setTime(500, { paused: true });
        nowMs = 200;

        expect(clock.running).toBe(false);
        expect(clock.time({ maxMs: Number.POSITIVE_INFINITY })).toBe(500);

        clock.setTime(1_000, { paused: false });
        nowMs = 300;

        expect(clock.running).toBe(true);
        expect(clock.time({ maxMs: Number.POSITIVE_INFINITY })).toBe(1_100);
        expect(runningDuringSetTime).toEqual([false, true]);
        expect(playbackEvents).toEqual(['start', 'stop', 'start']);
    });

    it('notifies every listener when one listener unsubscribes during dispatch', () => {
        const clock = new Clock(() => 0);
        const events: string[] = [];
        const unsubscribeFirst = clock.onEvent('start', () => {
            events.push('first');
            unsubscribeFirst();
        });
        clock.onEvent('start', () => events.push('second'));

        clock.start();

        expect(events).toEqual(['first', 'second']);
    });

    it('notifies timeupdate listeners periodically and stops after the last listener is removed', () => {
        jest.useFakeTimers();
        try {
            const clock = new Clock(() => 0);
            const listener = jest.fn();
            const unsubscribe = clock.onEvent('timeupdate', listener);
            clock.start();

            jest.advanceTimersByTime(700);
            expect(listener).toHaveBeenCalledTimes(14);

            clock.stop();
            unsubscribe();
            jest.advanceTimersByTime(700);
            expect(listener).toHaveBeenCalledTimes(14);
        } finally {
            jest.useRealTimers();
        }
    });

    it('continues notifying timeupdate listeners while paused for hidden discontinuities', () => {
        jest.useFakeTimers();
        try {
            const clock = new Clock(() => 0);
            const listener = jest.fn();
            clock.onEvent('timeupdate', listener);

            clock.setTime(500, { paused: true });
            jest.advanceTimersByTime(100);

            expect(listener).toHaveBeenCalledTimes(2);
        } finally {
            jest.useRealTimers();
        }
    });
});
