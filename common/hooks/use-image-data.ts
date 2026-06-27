import { CancelledMediaFragmentDataRenderingError, MediaFragment } from '@project/common';
import { useEffect, useState } from 'react';

const mediaFragmentDimensionsLoader = (
    image: MediaFragment,
    dataUrl: string,
    onLoad: (width: number, height: number) => void
) => {
    if (image.extension === 'webm') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            onLoad(video.videoWidth, video.videoHeight);
        };
        video.src = dataUrl;

        return () => {
            video.onloadedmetadata = null;
            video.removeAttribute('src');
            video.load();
        };
    }

    const img = new Image();
    img.onload = () => {
        onLoad(img.width, img.height);
    };
    img.src = dataUrl;

    return () => {
        img.onload = null;
        img.src = '';
    };
};

export const useImageData = ({ image, smoothTransition }: { image?: MediaFragment; smoothTransition: boolean }) => {
    const [dataUrl, setDataUrl] = useState<string>('');
    const [width, setWidth] = useState<number>(0);
    const [height, setHeight] = useState<number>(0);

    useEffect(() => {
        if (!smoothTransition) {
            setDataUrl('');
            setWidth(0);
            setHeight(0);
        }

        if (!image || image.error !== undefined) {
            return;
        }

        let cancelled = false;
        let cleanupLoadedMedia: (() => void) | undefined;

        image
            .dataUrl()
            .then((nextDataUrl) => {
                if (cancelled) {
                    return;
                }

                cleanupLoadedMedia = mediaFragmentDimensionsLoader(image, nextDataUrl, (nextWidth, nextHeight) => {
                    if (cancelled) {
                        return;
                    }

                    setWidth(nextWidth);
                    setHeight(nextHeight);
                    setDataUrl(nextDataUrl);
                });
            })
            .catch((e) => {
                if (!(e instanceof CancelledMediaFragmentDataRenderingError)) {
                    throw e;
                }
            });

        return () => {
            cancelled = true;
            cleanupLoadedMedia?.();
        };
    }, [image, smoothTransition]);

    return { dataUrl, width, height };
};
