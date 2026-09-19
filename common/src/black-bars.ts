// Detects letterbox/pillarbox black bars in a captured frame so they can be cropped out.
// The heuristics follow ffmpeg's cropdetect filter (limit=16, round=2) with additional sanity
// checks, adapted to run on raw canvas pixel data.

export interface PixelData {
    readonly data: Uint8ClampedArray | Uint8Array | number[];
    readonly width: number;
    readonly height: number;
}

export interface CropRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

// Matches ffmpeg's cropdetect default of limit=16: a pixel is "black" if every channel is <= 16
export const blackBarPixelLimit = 16;

// If the crop would keep more than this fraction of the frame, the bars are too thin to bother
// (e.g. a couple of pixels of encoder padding). 1% still catches ~7px bars on each side of a 720p frame.
const minimalCropAreaRatio = 0.99;
// If the crop would keep less than this fraction of the frame, it's probably a dark scene rather than bars
const excessiveCropAreaRatio = 0.25;
// Crops that change the aspect ratio by more than this must snap to a well known aspect ratio
const maxAspectRatioChange = 0.3;
const knownAspectRatioTolerance = 0.05;
const knownAspectRatios = [
    4 / 3,
    5 / 4,
    3 / 2,
    16 / 10,
    16 / 9,
    18 / 9,
    19.5 / 9,
    21 / 9,
    24 / 10,
    32 / 9,
    9 / 16,
    3 / 4,
    1,
];

// Sample at most this many pixels along a row/column when checking whether it is black
const maxSamplesPerLine = 256;

const isKnownAspectRatio = (aspectRatio: number) =>
    knownAspectRatios.some((known) => Math.abs(aspectRatio - known) / known < knownAspectRatioTolerance);

const roundDownToEven = (value: number) => (value % 2 === 0 ? value : value - 1);

export const detectBlackBars = (
    { data, width, height }: PixelData,
    limit: number = blackBarPixelLimit
): CropRect | undefined => {
    if (width < 4 || height < 4 || data.length < width * height * 4) {
        return undefined;
    }

    const xStride = Math.max(1, Math.floor(width / maxSamplesPerLine));
    const yStride = Math.max(1, Math.floor(height / maxSamplesPerLine));

    const isBlackPixel = (x: number, y: number) => {
        const offset = (y * width + x) * 4;
        return data[offset] <= limit && data[offset + 1] <= limit && data[offset + 2] <= limit;
    };

    const isBlackRow = (y: number, fromX: number, toX: number) => {
        for (let x = fromX; x < toX; x += xStride) {
            if (!isBlackPixel(x, y)) {
                return false;
            }
        }

        // Always check the last pixel so that thin content at the edge is not skipped by the stride
        return isBlackPixel(toX - 1, y);
    };

    const isBlackColumn = (x: number, fromY: number, toY: number) => {
        for (let y = fromY; y < toY; y += yStride) {
            if (!isBlackPixel(x, y)) {
                return false;
            }
        }

        return isBlackPixel(x, toY - 1);
    };

    let top = 0;

    while (top < height && isBlackRow(top, 0, width)) {
        ++top;
    }

    if (top >= height) {
        // Entirely black frame - nothing sensible to crop
        return undefined;
    }

    let bottom = height;

    while (bottom > top && isBlackRow(bottom - 1, 0, width)) {
        --bottom;
    }

    let left = 0;

    while (left < width && isBlackColumn(left, top, bottom)) {
        ++left;
    }

    let right = width;

    while (right > left && isBlackColumn(right - 1, top, bottom)) {
        --right;
    }

    // Like cropdetect's round=2, keep even dimensions
    const cropWidth = roundDownToEven(right - left);
    const cropHeight = roundDownToEven(bottom - top);

    if (cropWidth <= 0 || cropHeight <= 0) {
        return undefined;
    }

    if (cropWidth === width && cropHeight === height) {
        return undefined;
    }

    const areaRatio = (cropWidth * cropHeight) / (width * height);

    if (areaRatio > minimalCropAreaRatio) {
        return undefined;
    }

    // cropdetect-style rounding can lose a pixel or two even when only pillarboxing is removed
    const isPillarboxOnlyCrop = cropHeight >= height - 2;

    if (areaRatio < excessiveCropAreaRatio && !isPillarboxOnlyCrop) {
        return undefined;
    }

    const originalAspectRatio = width / height;
    const cropAspectRatio = cropWidth / cropHeight;
    const aspectRatioChange = Math.abs(originalAspectRatio - cropAspectRatio) / originalAspectRatio;

    if (aspectRatioChange > maxAspectRatioChange && !isPillarboxOnlyCrop && !isKnownAspectRatio(cropAspectRatio)) {
        return undefined;
    }

    return { x: left, y: top, width: cropWidth, height: cropHeight };
};
