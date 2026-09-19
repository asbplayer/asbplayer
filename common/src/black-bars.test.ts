import { describe, expect, it } from '@jest/globals';
import { detectBlackBars } from '@project/common/src/black-bars';

interface Bars {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
}

const makeFrame = (width: number, height: number, bars: Bars = {}, contentColor = 120, barColor = 0) => {
    const { top = 0, bottom = 0, left = 0, right = 0 } = bars;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const offset = (y * width + x) * 4;
            const inBar = y < top || y >= height - bottom || x < left || x >= width - right;
            const color = inBar ? barColor : contentColor;
            data[offset] = color;
            data[offset + 1] = color;
            data[offset + 2] = color;
            data[offset + 3] = 255;
        }
    }

    return { data, width, height };
};

describe('detectBlackBars', () => {
    it('detects letterbox bars', () => {
        // 2.39:1 content inside a 16:9 frame
        const frame = makeFrame(1920, 1080, { top: 138, bottom: 138 });
        expect(detectBlackBars(frame)).toEqual({ x: 0, y: 138, width: 1920, height: 804 });
    });

    it('detects pillarbox bars', () => {
        // 4:3 content inside a 16:9 frame
        const frame = makeFrame(1920, 1080, { left: 240, right: 240 });
        expect(detectBlackBars(frame)).toEqual({ x: 240, y: 0, width: 1440, height: 1080 });
    });

    it('detects bars on all sides', () => {
        const frame = makeFrame(1280, 720, { top: 60, bottom: 60, left: 160, right: 160 });
        expect(detectBlackBars(frame)).toEqual({ x: 160, y: 60, width: 960, height: 600 });
    });

    it('treats near-black compression noise as part of the bar', () => {
        const frame = makeFrame(1280, 720, { top: 90, bottom: 90 }, 120, 12);
        expect(detectBlackBars(frame)).toEqual({ x: 0, y: 90, width: 1280, height: 540 });
    });

    it('does not crop when there are no bars', () => {
        expect(detectBlackBars(makeFrame(1280, 720))).toBeUndefined();
    });

    it('does not crop when the bars are negligible', () => {
        // ~0.6% of the area
        expect(detectBlackBars(makeFrame(1280, 720, { top: 2, bottom: 2 }))).toBeUndefined();
    });

    it('crops thin bars that are still clearly bars', () => {
        // ~4% of the area, like a game captured with slight pillarboxing
        expect(detectBlackBars(makeFrame(1280, 720, { left: 24, right: 24 }))).toEqual({
            x: 24,
            y: 0,
            width: 1232,
            height: 720,
        });
    });

    it('does not crop an entirely black frame', () => {
        expect(detectBlackBars(makeFrame(1280, 720, {}, 0))).toBeUndefined();
    });

    it('does not crop when the detected content is a tiny region', () => {
        // Probably a dark scene with a small bright spot rather than bars
        expect(detectBlackBars(makeFrame(1280, 720, { top: 300, bottom: 300, left: 500, right: 500 }))).toBeUndefined();
    });

    it('allows aggressive pillarboxing when the full height is kept', () => {
        // Very narrow 3DS-like content
        const frame = makeFrame(1920, 1080, { left: 720, right: 720 });
        expect(detectBlackBars(frame)).toEqual({ x: 720, y: 0, width: 480, height: 1080 });
    });

    it('rejects large aspect ratio changes that do not match a known aspect ratio', () => {
        // 1280x330 -> aspect ~3.88, not a known ratio, area ratio ~0.46
        expect(detectBlackBars(makeFrame(1280, 720, { top: 195, bottom: 195 }))).toBeUndefined();
    });

    it('accepts large aspect ratio changes that match a known aspect ratio', () => {
        // 1280x360 -> 32:9, area ratio 0.5
        expect(detectBlackBars(makeFrame(1280, 720, { top: 180, bottom: 180 }))).toEqual({
            x: 0,
            y: 180,
            width: 1280,
            height: 360,
        });
    });

    it('keeps even dimensions', () => {
        const frame = makeFrame(1280, 720, { top: 101, bottom: 100 });
        expect(detectBlackBars(frame)).toEqual({ x: 0, y: 101, width: 1280, height: 518 });
    });

    it('does not treat a thin bright edge as a bar', () => {
        const frame = makeFrame(1280, 720, { top: 100, bottom: 100 });
        // A single bright pixel at the right end of the first row, which stride sampling could skip
        frame.data[(1280 - 1) * 4] = 255;
        expect(detectBlackBars(frame)).toEqual({ x: 0, y: 0, width: 1280, height: 620 });
    });

    it('returns undefined for degenerate input', () => {
        expect(detectBlackBars({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toBeUndefined();
        expect(detectBlackBars({ data: new Uint8ClampedArray(16), width: 8, height: 8 })).toBeUndefined();
    });
});
