import { useCallback, useEffect, useRef, useState } from 'react';
import Clock from '../services/clock';
import MediaAdapter from '../services/media-adapter';
import VideoChannel from '../services/video-channel';
import {
    PlaybackPositionRecord,
    loadPlaybackPositions,
    upsertPlaybackPosition,
} from '../services/playback-position-store';

const saveIntervalMs = 10000;
const resumeRewindMs = 3000;

interface Params {
    videoFile?: File;
    channel?: VideoChannel;
    clock: Clock;
    calculateLength: () => number;
    seek: (time: number, clock: Clock, forwardToMedia: boolean, isUserInitiated?: boolean) => Promise<void>;
    play: (clock: Clock, mediaAdapter: MediaAdapter, forwardToMedia: boolean) => void;
    mediaAdapter: MediaAdapter;
}

export const usePlaybackPositionMemory = ({
    videoFile,
    channel,
    clock,
    calculateLength,
    seek,
    play,
    mediaAdapter,
}: Params) => {
    const playbackPositionsRef = useRef<PlaybackPositionRecord[]>(undefined);

    if (playbackPositionsRef.current === undefined) {
        playbackPositionsRef.current = loadPlaybackPositions();
    }

    const restoredFileNameRef = useRef<string>(undefined);
    const [pendingResume, setPendingResume] = useState<PlaybackPositionRecord>();

    const savePlaybackPosition = useCallback(() => {
        if (!videoFile) {
            return;
        }

        const position = clock.time(calculateLength()) - resumeRewindMs;

        if (position <= 0) {
            return;
        }

        playbackPositionsRef.current = upsertPlaybackPosition(playbackPositionsRef.current!, {
            fileName: videoFile.name,
            position,
        });
    }, [videoFile, clock]);

    useEffect(() => {
        if (!videoFile) {
            return;
        }

        const interval = setInterval(savePlaybackPosition, saveIntervalMs);
        return () => clearInterval(interval);
    }, [videoFile, savePlaybackPosition]);

    useEffect(() => clock.onEvent('stop', savePlaybackPosition), [clock, savePlaybackPosition]);

    useEffect(() => {
        if (!channel || !videoFile) {
            return;
        }

        return channel.onReady(() => {
            if (restoredFileNameRef.current === videoFile.name) {
                return;
            }

            restoredFileNameRef.current = videoFile.name;
            const saved = playbackPositionsRef.current!.find((p) => p.fileName === videoFile.name);

            if (saved && saved.position > 0) {
                setPendingResume(saved);
            }
        });
    }, [channel, videoFile]);

    const onConfirmResume = useCallback(async () => {
        if (!pendingResume) {
            return;
        }

        setPendingResume(undefined);
        await seek(pendingResume.position, clock, true, true);
        play(clock, mediaAdapter, true);
    }, [pendingResume, seek, play, clock, mediaAdapter]);

    const onDismissResume = useCallback(() => setPendingResume(undefined), []);

    return { pendingResume, onConfirmResume, onDismissResume };
};
