import { useEffect, useRef, useState } from 'react';
import useSnackbar from '@project/common/hooks/use-snackbar';
import { snapshotWebmAudio } from '@project/common/audio-transcode/mining-audio';
import { asbWarn } from '@project/common/util/log';
import type { TranscodedAudioPayload } from '@project/common';

/** Retain a timed-out resume offer until audio and subtitles reach its saved position. */
export const useResumePlaybackSnackbar = ({
    position,
    source,
    conversion,
    subtitlesReady,
    onDismiss,
}: {
    position: number | undefined;
    source: string;
    conversion: TranscodedAudioPayload;
    subtitlesReady: boolean;
    onDismiss: () => void;
}) => {
    const [available, setAvailable] = useState<{ source: string; position: number }>();
    const latestAudio = useRef(conversion.audio);
    latestAudio.current = conversion.audio;
    const hasAudio = conversion.audio !== undefined;
    // Only ongoing conversion restricts resuming. Failure/unavailability permits video-only playback;
    // completion also permits resuming into the video's silent tail after audio EOF.
    const audioReady =
        conversion.state !== 'transcoding' || (available?.source === source && available.position === position);
    const ready = audioReady && subtitlesReady;
    const snackbar = useSnackbar({
        open: position !== undefined,
        refreshKey: ready,
        onClose: onDismiss,
        onTimeout: () => {
            if (ready) onDismiss();
        },
    });

    useEffect(() => {
        if (position === undefined || conversion.state !== 'transcoding') {
            setAvailable(undefined);
            return;
        }
        if (audioReady || !hasAudio) return;
        let cancelled = false;
        let reading = false;
        let checkedAudio: Blob | undefined;
        const check = async () => {
            const audio = latestAudio.current;
            if (reading || audio === undefined || audio === checkedAudio) return;
            reading = true;
            checkedAudio = audio;
            try {
                // Encoded audio can extend beyond MSE's two-minute look-ahead buffer.
                const snapshot = await snapshotWebmAudio(audio);
                if (!cancelled && snapshot !== undefined && snapshot.durationMs >= position) {
                    setAvailable({ source, position });
                }
            } catch (error) {
                if (!cancelled) asbWarn('audio/playback', 'Could not check converted audio for resuming', { error });
            } finally {
                reading = false;
            }
        };
        // Check at most once a second, without restarting a read for every encoded chunk.
        void check();
        const interval = setInterval(() => void check(), 1_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [position, source, hasAudio, conversion.state, audioReady]);

    return snackbar;
};
