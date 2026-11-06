import { useEffect, useRef, useState } from 'react';
import useSnackbar from '@project/common/hooks/use-snackbar';
import { snapshotWebmAudio } from '@project/common/audio-transcode/mining-audio';
import { asbWarn } from '@project/common/util/log';

/** Retain a timed-out resume offer until conversion makes its saved position available. */
export const useResumePlaybackSnackbar = ({
    position,
    source,
    audio,
    required,
    complete,
    onDismiss,
}: {
    position: number | undefined;
    source: string;
    audio: Blob | undefined;
    required: boolean;
    complete: boolean;
    onDismiss: () => void;
}) => {
    const [available, setAvailable] = useState<{ source: string; position: number }>();
    const latestAudio = useRef(audio);
    latestAudio.current = audio;
    const hasAudio = audio !== undefined;
    // Completion also permits resuming into a video's silent tail after audio EOF.
    const ready = !required || complete || (available?.source === source && available.position === position);
    const snackbar = useSnackbar({
        open: position !== undefined,
        refreshKey: ready,
        onClose: onDismiss,
        onTimeout: () => {
            if (ready) onDismiss();
        },
    });

    useEffect(() => {
        if (position === undefined || !required) {
            setAvailable(undefined);
            return;
        }
        if (ready || !hasAudio) return;
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
    }, [position, source, hasAudio, required, ready]);

    return snackbar;
};
