import SrtParser from '@qgustavor/srt-parser';

// Extracted from subtitle-reader.ts so it can be used in service worker
export const subtitlesToSrt = (subtitles: { start: number; end: number; text: string }[]) => {
    const parser = new SrtParser({ numericTimestamps: true });
    const nodes = subtitles.map((subtitle, i) => {
        return {
            id: String(i),
            startTime: subtitle.start,
            endTime: subtitle.end,
            text: subtitle.text,
        };
    });
    return parser.toSrt(nodes);
};
