import { useEffect, useState } from 'react';
import { asbTrace } from '@project/common/util/log';

const videoLoadNoticeDelayMs = 3_000;
const conversionNoticeDurationMs = 5_000;
const delayedNoticeMinimumDurationMs = 7_000;

/**
 * Detect slow startup and retain its notice until both the first frame and the minimum duration.
 * From loadstart, conversion notices expire at 5s, or 10s when startup is slow.
 * Conversion completion does not change that deadline.
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
        noticeDeadlineReached: boolean;
    }>();

    useEffect(() => {
        if (!video || !source) {
            setLoad(undefined);
            return;
        }
        let delayTimer: ReturnType<typeof setTimeout> | undefined;
        let noticeTimer: ReturnType<typeof setTimeout> | undefined;
        let delayed = false;
        let ready = false;
        let noticeDeadlineReached = false;
        const update = () => {
            // Once the first frame has loaded, later buffering is not a startup delay.
            ready ||= video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
            const failed = video.error !== null;
            if (ready || failed) clearTimeout(delayTimer);
            if (failed) clearTimeout(noticeTimer);
            setLoad({ video, source, delayed, ready, failed, noticeDeadlineReached });
        };
        const expireNotices = () => {
            noticeDeadlineReached = true;
            update();
        };
        const loading = () => {
            clearTimeout(delayTimer);
            clearTimeout(noticeTimer);
            delayed = false;
            ready = false;
            noticeDeadlineReached = false;
            update();
            if (video.error) return;
            noticeTimer = setTimeout(expireNotices, conversionNoticeDurationMs);
            if (ready) return;
            delayTimer = setTimeout(() => {
                if (video.error || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                    update();
                    return;
                }
                delayed = true;
                clearTimeout(noticeTimer);
                noticeTimer = setTimeout(expireNotices, delayedNoticeMinimumDurationMs);
                asbTrace('playback/video-player', 'Waiting for the browser to load the original video', {
                    readyState: video.readyState,
                    networkState: video.networkState,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                });
                update();
            }, videoLoadNoticeDelayMs);
        };
        loading();
        video.addEventListener('loadstart', loading);
        video.addEventListener('loadeddata', update);
        video.addEventListener('canplay', update);
        video.addEventListener('error', update);
        return () => {
            clearTimeout(delayTimer);
            clearTimeout(noticeTimer);
            video.removeEventListener('loadstart', loading);
            video.removeEventListener('loadeddata', update);
            video.removeEventListener('canplay', update);
            video.removeEventListener('error', update);
        };
    }, [video, source]);

    const current = load?.video === video && load?.source === source && !load?.failed;
    return {
        loading: Boolean(current && load?.delayed && (!load.ready || !load.noticeDeadlineReached)),
        conversion: Boolean(current && conversionActive && !load?.noticeDeadlineReached),
    };
};
