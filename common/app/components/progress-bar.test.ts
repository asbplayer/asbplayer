import {
    centeredProgressBarPreviewLeft,
    clampProgressBarPreviewLeft,
    formatProgressTimestamp,
    progressBarProgress,
    progressBarTrackWidth,
} from './progress-bar';

const bounds = { left: 100, right: 300 };

it('calculates the inner progress bar width excluding horizontal padding', () => {
    expect(progressBarTrackWidth(bounds)).toBe(180);
});

it('calculates progress from a pointer x coordinate', () => {
    expect(progressBarProgress(110, bounds)).toBe(0);
    expect(progressBarProgress(200, bounds)).toBe(0.5);
    expect(progressBarProgress(290, bounds)).toBe(1);
});

it('clamps progress to the valid range', () => {
    expect(progressBarProgress(50, bounds)).toBe(0);
    expect(progressBarProgress(400, bounds)).toBe(1);
});

it('returns zero progress when the track has no usable width', () => {
    expect(progressBarProgress(200, { left: 100, right: 110 })).toBe(0);
});

it('centers and clamps preview left positions', () => {
    expect(centeredProgressBarPreviewLeft(0, 180, 58)).toBe(0);
    expect(centeredProgressBarPreviewLeft(0.5, 180, 58)).toBe(71);
    expect(centeredProgressBarPreviewLeft(1, 180, 58)).toBe(142);
});

it('clamps explicit preview left positions', () => {
    expect(clampProgressBarPreviewLeft(-10, 180, 58)).toBe(0);
    expect(clampProgressBarPreviewLeft(71, 180, 58)).toBe(71);
    expect(clampProgressBarPreviewLeft(200, 180, 58)).toBe(142);
});

it('formats hover timestamps using media length', () => {
    expect(formatProgressTimestamp(0.5, 10 * 60 * 1000)).toBe('05:00');
    expect(formatProgressTimestamp(0.5, 2 * 60 * 60 * 1000)).toBe('01:00:00');
});

it('does not format timestamps for invalid media lengths', () => {
    expect(formatProgressTimestamp(0.5, 0)).toBeUndefined();
    expect(formatProgressTimestamp(0.5, Number.NaN)).toBeUndefined();
    expect(formatProgressTimestamp(0.5, Number.POSITIVE_INFINITY)).toBeUndefined();
});
