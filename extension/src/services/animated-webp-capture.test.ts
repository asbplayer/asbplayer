import { describe, expect, it } from '@jest/globals';
import { cropDimensions } from '@project/extension/src/services/animated-webp-capture';

const viewport = { width: 1000, height: 500, devicePixelRatio: 2 };

describe('cropDimensions', () => {
    it('maps the CSS pixel rect onto the captured frame using the viewport size', () => {
        const rect = { left: 100, top: 50, width: 400, height: 200 };

        expect(cropDimensions(2000, 1000, viewport, rect, 0, 0)).toEqual({
            sx: 200,
            sy: 100,
            sw: 800,
            sh: 400,
            dw: 800,
            dh: 400,
        });
    });

    it('scales the crop down to the max width and height', () => {
        const rect = { left: 0, top: 0, width: 1000, height: 500 };

        expect(cropDimensions(2000, 1000, viewport, rect, 500, 0)).toMatchObject({
            sw: 2000,
            sh: 1000,
            dw: 500,
            dh: 250,
        });
    });

    it('uses the whole frame when the rect is empty', () => {
        const rect = { left: 0, top: 0, width: 0, height: 0 };

        expect(cropDimensions(2000, 1000, viewport, rect, 0, 0)).toMatchObject({ sw: 2000, sh: 1000 });
    });
});
