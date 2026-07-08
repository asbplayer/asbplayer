import { detectSubtitleOffset } from './offset';

describe('detectSubtitleOffset', () => {
    // Irregular cue spacing so the cross-correlation has a single unambiguous peak.
    const starts = [
        1000, 3500, 4200, 8000, 9100, 12000, 15000, 15800, 20000, 23000, 24500, 28000, 31000, 33000, 37000, 40000,
        41200, 45000, 48000, 52000,
    ];
    const cues = (offset: number) => starts.map((s) => ({ originalStart: s + offset, originalEnd: s + offset + 700 }));

    it('recovers a positive offset when the reference is ahead of the primary', () => {
        const primary = cues(0);
        const reference = cues(2000); // reference dialogue occurs 2s later than the primary

        const result = detectSubtitleOffset(primary, reference);

        expect(result.offset).toBeGreaterThan(1800);
        expect(result.offset).toBeLessThan(2200);
        expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('recovers a negative offset when the reference is behind the primary', () => {
        const primary = cues(1500); // primary dialogue occurs 1.5s later than the reference
        const reference = cues(0);

        const result = detectSubtitleOffset(primary, reference);

        expect(result.offset).toBeLessThan(-1300);
        expect(result.offset).toBeGreaterThan(-1700);
        expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('returns zero offset and high confidence for already-aligned tracks', () => {
        const primary = cues(0);
        const reference = cues(0);

        const result = detectSubtitleOffset(primary, reference);

        expect(result.offset).toBe(0);
        expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('returns zero confidence when either track is empty', () => {
        expect(detectSubtitleOffset([], cues(0)).confidence).toBe(0);
        expect(detectSubtitleOffset(cues(0), []).confidence).toBe(0);
    });
});
