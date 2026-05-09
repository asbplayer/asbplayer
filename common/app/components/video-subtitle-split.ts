import { useEffect, useState } from 'react';
import { VideoSubtitleSplitBehavior } from '../../settings';

interface ResolveVideoSubtitleSplitLayoutArgs {
    behavior: VideoSubtitleSplitBehavior;
    persistedWidth?: number;
    autoWidth?: number;
}

export function clampSubtitlePlayerWidth(width: number, minWidth: number, maxWidth: number) {
    return Math.min(maxWidth, Math.max(minWidth, width));
}

export function resolveVideoSubtitleSplitLayout({
    behavior,
    persistedWidth,
    autoWidth,
}: ResolveVideoSubtitleSplitLayoutArgs) {
    if (behavior === VideoSubtitleSplitBehavior.rememberSplitPosition) {
        return persistedWidth;
    }

    return autoWidth;
}

export function useVideoAspectRatio(videoFileUrl: string | undefined, enabled: boolean) {
    const [videoAspectRatio, setVideoAspectRatio] = useState<number>();

    useEffect(() => {
        setVideoAspectRatio(undefined);

        if (!enabled || !videoFileUrl) {
            return;
        }

        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            setVideoAspectRatio(video.videoWidth / video.videoHeight);
        };
        video.src = videoFileUrl;

        return () => {
            video.onloadedmetadata = null;
            video.removeAttribute('src');
            video.load();
        };
    }, [videoFileUrl, enabled]);

    return videoAspectRatio;
}
