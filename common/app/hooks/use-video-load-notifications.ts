import { useEffect, useRef, useState } from 'react';
import { asbTrace } from '@project/common/util/log';
import { usesConvertedAudio } from '@project/common/audio-transcode';
import type { TranscodedAudioPayload } from '@project/common';

const videoLoadNoticeDelayMs = 3_000;
const conversionNoticeDurationMs = 5_000;
const delayedNoticeMinimumDurationMs = 7_000;

/**
 * Time video startup from actual loading, including loading already underway on attachment.
 * Conversion feedback has one 5s window per active conversion, extended while open if video loading is slow.
 * A deferred loadstart or conversion completion must not restart that window.
 */
export const useVideoLoadNotifications = ({
    video,
    source,
    conversion,
}: {
    video: HTMLVideoElement | undefined;
    source: string;
    conversion: TranscodedAudioPayload;
}) => {
    const [load, setLoad] = useState<{
        video: HTMLVideoElement;
        source: string;
        delayed: boolean;
        ready: boolean;
        failed: boolean;
        loadNoticeMinimumElapsed: boolean;
    }>();
    const [conversionNotice, setConversionNotice] = useState<{
        video: HTMLVideoElement;
        source: string;
        conversionId: number;
        expired: boolean;
    }>();
    const extendConversionRef = useRef<() => void>(undefined);
    const conversionId = usesConvertedAudio(conversion.state) ? conversion.conversionId : undefined;

    useEffect(() => {
        if (!video || !source || conversionId === undefined) {
            extendConversionRef.current = undefined;
            setConversionNotice(undefined);
            return;
        }
        let expired = false;
        const expire = () => {
            expired = true;
            setConversionNotice({ video, source, conversionId, expired: true });
        };
        let conversionTimer = setTimeout(expire, conversionNoticeDurationMs);
        extendConversionRef.current = () => {
            if (expired) return;
            clearTimeout(conversionTimer);
            conversionTimer = setTimeout(expire, delayedNoticeMinimumDurationMs); // Extend an existing conversion notice, without reviving one that already expired.
        };
        setConversionNotice({ video, source, conversionId, expired: false });
        return () => {
            clearTimeout(conversionTimer);
            extendConversionRef.current = undefined;
        };
    }, [video, source, conversionId]);

    useEffect(() => {
        if (!video || !source) {
            setLoad(undefined);
            return;
        }
        let delayTimer: ReturnType<typeof setTimeout> | undefined;
        let minimumTimer: ReturnType<typeof setTimeout> | undefined;
        let delayed = false;
        let ready = false;
        let loadNoticeMinimumElapsed = false;
        const update = () => {
            // Once the first frame has loaded, later buffering is not a startup delay.
            ready ||= video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
            const failed = video.error !== null;
            if (ready || failed) clearTimeout(delayTimer);
            if (failed) clearTimeout(minimumTimer);
            setLoad({ video, source, delayed, ready, failed, loadNoticeMinimumElapsed });
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
                extendConversionRef.current?.();
                asbTrace('playback/video-player', 'Waiting for the browser to load the original video', {
                    readyState: video.readyState,
                    networkState: video.networkState,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                });
                update();
            }, videoLoadNoticeDelayMs);
        };
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
            video.removeEventListener('loadstart', loading);
            video.removeEventListener('loadeddata', update);
            video.removeEventListener('canplay', update);
            video.removeEventListener('error', update);
        };
    }, [video, source]);

    const current = load?.video === video && load?.source === source && !load?.failed;
    const conversionExpired =
        conversionNotice?.video === video &&
        conversionNotice?.source === source &&
        conversionNotice?.conversionId === conversionId &&
        conversionNotice.expired;
    return {
        loading: Boolean(current && load?.delayed && (!load.ready || !load.loadNoticeMinimumElapsed)),
        conversion: Boolean(current && conversionId !== undefined && !conversionExpired),
    };
};
