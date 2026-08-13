import { useEffect } from 'react';

// Correcting means seeking the audio element, which is audible, so the dead zone has to be wider
// than the offset playback naturally settles into - otherwise it corrects several times a second
// forever. Audio trailing the picture by this much is below the threshold of perception.
const driftToleranceSeconds = 0.15;
// Past this the audio is not recognizably related to the picture, so restart it rather than nudge.
const resyncThresholdSeconds = 0.5;
const driftCheckIntervalMs = 250;

/**
 * Plays an audio element in lockstep with a video element.
 *
 * Used when the video's own audio track is in a format the browser cannot decode: the video is
 * muted and the separately transcoded audio takes its place.
 */
export const useExternalAudioTrack = ({
    video,
    audio,
}: {
    video: HTMLVideoElement | undefined;
    audio: HTMLAudioElement | null;
}) => {
    useEffect(() => {
        if (!video || !audio) {
            return;
        }

        // The video's own audio track is either silent or undecodable - either way it must not play.
        video.muted = true;

        const synchronizeTime = () => {
            if (Math.abs(audio.currentTime - video.currentTime) > driftToleranceSeconds) {
                audio.currentTime = video.currentTime;
            }
        };

        const play = () => {
            synchronizeTime();
            void audio.play().catch(() => {});
        };

        const pause = () => audio.pause();

        const synchronizeRate = () => {
            audio.playbackRate = video.playbackRate;
            // Keep pitch handling consistent with the video, since playback rate changes are common.
            audio.preservesPitch = video.preservesPitch;
        };

        const seeked = () => {
            audio.currentTime = video.currentTime;

            if (!video.paused) {
                void audio.play().catch(() => {});
            }
        };

        const correctDrift = () => {
            if (video.paused || audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
                return;
            }

            const drift = Math.abs(audio.currentTime - video.currentTime);

            if (drift > resyncThresholdSeconds) {
                audio.currentTime = video.currentTime;
                void audio.play().catch(() => {});
            } else if (drift > driftToleranceSeconds) {
                audio.currentTime = video.currentTime;
            }
        };

        synchronizeRate();
        // Inherit whatever volume the video was already at, including the forced volume on mobile.
        audio.volume = video.volume;
        audio.currentTime = video.currentTime;

        if (!video.paused) {
            play();
        }

        video.addEventListener('play', play);
        video.addEventListener('playing', play);
        video.addEventListener('pause', pause);
        video.addEventListener('seeked', seeked);
        video.addEventListener('ratechange', synchronizeRate);
        video.addEventListener('waiting', pause);
        video.addEventListener('ended', pause);

        const driftInterval = setInterval(correctDrift, driftCheckIntervalMs);

        return () => {
            clearInterval(driftInterval);
            video.removeEventListener('play', play);
            video.removeEventListener('playing', play);
            video.removeEventListener('pause', pause);
            video.removeEventListener('seeked', seeked);
            video.removeEventListener('ratechange', synchronizeRate);
            video.removeEventListener('waiting', pause);
            video.removeEventListener('ended', pause);
            audio.pause();
            video.muted = false;
        };
    }, [video, audio]);
};
