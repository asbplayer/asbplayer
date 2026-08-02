import { describe, expect, it } from '@jest/globals';
import InterpolatedContentClock from './interpolated-content-clock';

describe('InterpolatedContentClock', () => {
    it('reports whether content time has been anchored and supports reset', () => {
        const clock = new InterpolatedContentClock();

        expect(clock.hasAnchor).toBe(false);
        clock.updateAnchor(1000, 0);
        expect(clock.hasAnchor).toBe(true);

        clock.reset();
        expect(clock.hasAnchor).toBe(false);
        expect(clock.timeAt(1000)).toBe(0);
    });

    it('rebases across rate and playback-state changes without discontinuities', () => {
        const clock = new InterpolatedContentClock();

        clock.updateAnchor(100_000, 0);
        clock.updateAdvancing(true, 0);
        expect(clock.timeAt(10_000)).toBe(110_000);

        clock.updateRate(2, 10_000);
        expect(clock.timeAt(10_000)).toBe(110_000);
        expect(clock.timeAt(15_000)).toBe(120_000);

        clock.updateAdvancing(false, 15_000);
        expect(clock.timeAt(100_000)).toBe(120_000);

        clock.updateRate(0.5, 100_000);
        clock.updateAdvancing(true, 100_000);
        expect(clock.timeAt(104_000)).toBe(122_000);
    });
});
