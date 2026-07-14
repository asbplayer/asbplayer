import { timeDurationDisplay } from '../../util';

const horizontalPadding = 10;

interface HorizontalBounds {
    left: number;
    right: number;
}

export function progressBarTrackWidth(bounds: HorizontalBounds): number {
    return Math.max(0, bounds.right - bounds.left - 2 * horizontalPadding);
}

export function progressBarProgress(pointerX: number, bounds: HorizontalBounds): number {
    const width = progressBarTrackWidth(bounds);

    if (width <= 0) {
        return 0;
    }

    return Math.min(1, Math.max(0, (pointerX - bounds.left - horizontalPadding) / width));
}

export function centeredProgressBarPreviewLeft(progress: number, trackWidth: number, previewWidth: number): number {
    const unclampedLeft = progress * trackWidth + horizontalPadding - previewWidth / 2;
    return clampProgressBarPreviewLeft(unclampedLeft, trackWidth, previewWidth);
}

export function clampProgressBarPreviewLeft(left: number, trackWidth: number, previewWidth: number): number {
    const totalWidth = trackWidth + 2 * horizontalPadding;
    return Math.min(Math.max(0, left), Math.max(0, totalWidth - previewWidth));
}

export function formatProgressTimestamp(progress: number, length: number): string | undefined {
    if (!Number.isFinite(length) || length <= 0) {
        return undefined;
    }

    const timestamp = Math.min(1, Math.max(0, progress)) * length;
    return timeDurationDisplay(timestamp, length, false);
}
