import { useCallback, useEffect, useRef, useState } from 'react';

interface Position {
    x: number;
    y: number;
}

interface Size {
    width: number;
    height: number;
}

export interface OverlayBounds {
    left: number;
    top: number;
    width: number;
    height: number;
    viewportLeft: number;
    viewportTop: number;
}

interface Params {
    anchorRef: React.RefObject<HTMLElement | null | undefined>;
    containerRef: React.RefObject<HTMLElement | null | undefined>;
    pos: Position;
    size: Size;
    setPos: React.Dispatch<React.SetStateAction<Position>>;
    setSize: React.Dispatch<React.SetStateAction<Size>>;
    minWidth: number;
    minHeight: number;
}

const renderedVideoRect = (videoRect: DOMRect, videoElement: HTMLVideoElement) => {
    const { videoWidth, videoHeight } = videoElement;

    if (videoWidth <= 0 || videoHeight <= 0) {
        return {
            left: videoRect.left,
            top: videoRect.top,
            width: videoRect.width,
            height: videoRect.height,
        };
    }

    const scale = Math.min(videoRect.width / videoWidth, videoRect.height / videoHeight);
    const width = videoWidth * scale;
    const height = videoHeight * scale;
    return {
        left: videoRect.left + (videoRect.width - width) / 2,
        top: videoRect.top + (videoRect.height - height) / 2,
        width,
        height,
    };
};

export const useOverlayBounds = ({
    anchorRef,
    containerRef,
    pos,
    size,
    setPos,
    setSize,
    minWidth,
    minHeight,
}: Params) => {
    const [bounds, setBounds] = useState<OverlayBounds>();
    const boundsRef = useRef<OverlayBounds | undefined>(undefined);
    const previousBoundsRef = useRef<OverlayBounds | undefined>(undefined);
    const posRef = useRef<Position>(pos);
    const sizeRef = useRef<Size>(size);

    useEffect(() => {
        posRef.current = pos;
    }, [pos]);

    useEffect(() => {
        sizeRef.current = size;
    }, [size]);

    useEffect(() => {
        boundsRef.current = bounds;
    }, [bounds]);

    const containerBounds = useCallback((): OverlayBounds | null => {
        const anchorElement = anchorRef.current;
        const containerElement = containerRef.current;

        if (!anchorElement || !containerElement) {
            return null;
        }

        const anchorRect = anchorElement.getBoundingClientRect();
        const containerRect = containerElement.getBoundingClientRect();

        if (containerRect.width <= 0 || containerRect.height <= 0) {
            return null;
        }

        // For <video>, only constrain to rendered content (exclude letterbox black bars).
        const targetRect =
            containerElement instanceof HTMLVideoElement
                ? renderedVideoRect(containerRect, containerElement)
                : {
                      left: containerRect.left,
                      top: containerRect.top,
                      width: containerRect.width,
                      height: containerRect.height,
                  };

        return {
            left: targetRect.left - anchorRect.left,
            top: targetRect.top - anchorRect.top,
            width: targetRect.width,
            height: targetRect.height,
            viewportLeft: targetRect.left,
            viewportTop: targetRect.top,
        };
    }, [anchorRef, containerRef]);

    const syncBounds = useCallback(() => {
        const nextBounds = containerBounds();
        if (!nextBounds) {
            return;
        }

        setBounds((currentBounds) => {
            if (
                currentBounds &&
                currentBounds.left === nextBounds.left &&
                currentBounds.top === nextBounds.top &&
                currentBounds.width === nextBounds.width &&
                currentBounds.height === nextBounds.height &&
                currentBounds.viewportLeft === nextBounds.viewportLeft &&
                currentBounds.viewportTop === nextBounds.viewportTop
            ) {
                return currentBounds;
            }

            return nextBounds;
        });
    }, [containerBounds]);

    const clampSizeToBounds = useCallback(
        (sourceSize: Size, activeBounds?: OverlayBounds): Size => {
            const nextBounds = activeBounds ?? boundsRef.current ?? containerBounds();
            if (!nextBounds) {
                return sourceSize;
            }

            return {
                width: Math.min(nextBounds.width, Math.max(minWidth, sourceSize.width)),
                height: Math.min(nextBounds.height, Math.max(minHeight, sourceSize.height)),
            };
        },
        [containerBounds, minWidth, minHeight]
    );

    const clampPos = useCallback(
        (x: number, y: number, w: number, h: number): Position => {
            const activeBounds = boundsRef.current ?? containerBounds();
            if (!activeBounds) return { x, y };
            return {
                x: Math.max(0, Math.min(x, activeBounds.width - w)),
                y: Math.max(0, Math.min(y, activeBounds.height - h)),
            };
        },
        [containerBounds]
    );

    useEffect(() => {
        syncBounds();

        const resizeObserver = new ResizeObserver(() => {
            syncBounds();
        });

        if (anchorRef.current) {
            resizeObserver.observe(anchorRef.current);
        }

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        const onLayoutChange = () => syncBounds();
        window.addEventListener('resize', onLayoutChange);
        window.addEventListener('transitionend', onLayoutChange, true);
        window.addEventListener('scroll', onLayoutChange, true);
        document.addEventListener('fullscreenchange', onLayoutChange);

        const videoElement = containerRef.current instanceof HTMLVideoElement ? containerRef.current : undefined;
        if (videoElement) {
            videoElement.addEventListener('loadedmetadata', onLayoutChange);
        }

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', onLayoutChange);
            window.removeEventListener('transitionend', onLayoutChange, true);
            window.removeEventListener('scroll', onLayoutChange, true);
            document.removeEventListener('fullscreenchange', onLayoutChange);
            if (videoElement) {
                videoElement.removeEventListener('loadedmetadata', onLayoutChange);
            }
        };
    }, [anchorRef, containerRef, syncBounds]);

    useEffect(() => {
        if (!bounds) {
            return;
        }

        const previousBounds = previousBoundsRef.current;
        const currentPos = posRef.current;
        const currentSize = sizeRef.current;

        if (previousBounds) {
            const widthRatio = previousBounds.width > 0 ? currentSize.width / previousBounds.width : 0;
            const heightRatio = previousBounds.height > 0 ? currentSize.height / previousBounds.height : 0;
            const xRatio = previousBounds.width > 0 ? currentPos.x / previousBounds.width : 0;
            const yRatio = previousBounds.height > 0 ? currentPos.y / previousBounds.height : 0;

            const scaledSize = clampSizeToBounds(
                { width: widthRatio * bounds.width, height: heightRatio * bounds.height },
                bounds
            );
            const scaledPos = clampPos(
                xRatio * bounds.width,
                yRatio * bounds.height,
                scaledSize.width,
                scaledSize.height
            );

            setSize(scaledSize);
            setPos(scaledPos);
        } else {
            const clampedSize = clampSizeToBounds(currentSize, bounds);
            setSize(clampedSize);
            setPos(clampPos(currentPos.x, currentPos.y, clampedSize.width, clampedSize.height));
        }

        previousBoundsRef.current = bounds;
    }, [bounds, clampPos, clampSizeToBounds, setPos, setSize]);

    return {
        bounds,
        boundsRef,
        containerBounds,
        clampPos,
        clampSizeToBounds,
    };
};
