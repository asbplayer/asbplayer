import { describe, expect, it } from '@jest/globals';
import Clock from '@project/common/playback/clock';

describe('Clock', () => {
    it('tracks monotonic playback time in milliseconds across rate changes and pauses', () => {
        let nowMs = 10_000;
        const clock = new Clock(() => nowMs);

        clock.start();
        nowMs = 11_500;
        expect(clock.time(Number.POSITIVE_INFINITY)).toBe(1_500);

        clock.rate = 2;
        nowMs = 12_500;
        expect(clock.time(Number.POSITIVE_INFINITY)).toBe(3_500);

        clock.stop();
        nowMs = 20_000;
        expect(clock.time(Number.POSITIVE_INFINITY)).toBe(3_500);
    });

    it('does not lose elapsed time when start is called while already running', () => {
        let nowMs = 0;
        const clock = new Clock(() => nowMs);

        clock.start();
        nowMs = 1_000;
        clock.start();
        nowMs = 2_000;

        expect(clock.time(Number.POSITIVE_INFINITY)).toBe(2_000);
    });

    it('seeks in milliseconds and reports progress against a millisecond duration', () => {
        const clock = new Clock(() => 0);

        clock.setTime(2_500);

        expect(clock.time(Number.POSITIVE_INFINITY)).toBe(2_500);
        expect(clock.time(2_000)).toBe(2_000);
        expect(clock.progress(10_000)).toBe(0.25);
        expect(clock.progress(0)).toBe(0);
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
});
