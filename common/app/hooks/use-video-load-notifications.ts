import { useEffect, useState } from 'react';
import { asbTrace } from '@project/common/util/log';

const videoLoadNoticeDelayMs = 3_000;
const conversionNoticeDurationMs = 5_000;
const delayedNoticeMinimumDurationMs = 7_000;

/**
 * Time video startup from actual loading, including loading already underway on attachment.
 * Conversion feedback has one window per source: 5s, extended while open if video loading is slow.
 * A deferred loadstart or conversion completion must not restart that window.
 */
export const useVideoLoadNotifications = ({
    video,
    source,
    conversionActive,
}: {
    video: HTMLVideoElement | undefined;
    source: string;
    /** Includes completed conversion so its notice can keep the same display deadline. */
    conversionActive: boolean;
}) => {
    const [load, setLoad] = useState<{
        video: HTMLVideoElement;
        source: string;
        delayed: boolean;
        ready: boolean;
        failed: boolean;
        loadNoticeMinimumElapsed: boolean;
        conversionNoticeExpired: boolean;
    }>();

    useEffect(() => {
        if (!video || !source) {
            setLoad(undefined);
            return;
        }
        let delayTimer: ReturnType<typeof setTimeout> | undefined;
        let minimumTimer: ReturnType<typeof setTimeout> | undefined;
        let conversionTimer: ReturnType<typeof setTimeout> | undefined;
        let delayed = false;
        let ready = false;
        let loadNoticeMinimumElapsed = false;
        let conversionNoticeExpired = false;
        const update = () => {
            // Once the first frame has loaded, later buffering is not a startup delay.
            ready ||= video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
            const failed = video.error !== null;
            if (ready || failed) clearTimeout(delayTimer);
            if (failed) clearTimeout(minimumTimer);
            setLoad({ video, source, delayed, ready, failed, loadNoticeMinimumElapsed, conversionNoticeExpired });
        };
        const expireConversion = () => {
            conversionNoticeExpired = true;
            update();
        };
        const loading = () => {
            clearTimeout(delayTimer);
            clearTimeout(minimumTimer);
            delayed = false;
            ready = false;
            loadNoticeMinimumElapsed = false;
            update();
            if (video.error) return;
            if (ready) return;
            delayTimer = setTimeout(() => {
                if (video.error || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                    update();
                    return;
                }
                delayed = true;
                minimumTimer = setTimeout(() => {
                    loadNoticeMinimumElapsed = true;
                    update();
                }, delayedNoticeMinimumDurationMs);
                if (!conversionNoticeExpired) {
                    clearTimeout(conversionTimer);
                    conversionTimer = setTimeout(expireConversion, delayedNoticeMinimumDurationMs); // Extend an existing conversion notice, without reviving one that already expired.
                }
                asbTrace('playback/video-player', 'Waiting for the browser to load the original video', {
                    readyState: video.readyState,
                    networkState: video.networkState,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                });
                update();
            }, videoLoadNoticeDelayMs);
        };
        conversionTimer = setTimeout(expireConversion, conversionNoticeDurationMs);
        if (
            video.networkState === HTMLMediaElement.NETWORK_LOADING ||
            video.networkState === HTMLMediaElement.NETWORK_IDLE ||
            video.readyState >= HTMLMediaElement.HAVE_METADATA
        ) {
            loading();
        } else {
            update(); // NETWORK_EMPTY before the first Play is deferred initialization, not a slow load.
        }
        video.addEventListener('loadstart', loading);
        video.addEventListener('loadeddata', update);
        video.addEventListener('canplay', update);
        video.addEventListener('error', update);
        return () => {
            clearTimeout(delayTimer);
            clearTimeout(minimumTimer);
            clearTimeout(conversionTimer);
            video.removeEventListener('loadstart', loading);
            video.removeEventListener('loadeddata', update);
            video.removeEventListener('canplay', update);
            video.removeEventListener('error', update);
        };
    }, [video, source]);

    const current = load?.video === video && load?.source === source && !load?.failed;
    return {
        loading: Boolean(current && load?.delayed && (!load.ready || !load.loadNoticeMinimumElapsed)),
        conversion: Boolean(current && conversionActive && !load?.conversionNoticeExpired),
    };
};
