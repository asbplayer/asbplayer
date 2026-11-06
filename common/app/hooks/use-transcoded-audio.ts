import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioTranscodeHost, AudioConversion } from '@project/common/audio-transcode';
import type { FileWithId } from '@project/common/file-selector';
import { audioCodecDisplayName, audioTrackRequiringTranscode } from '@project/common/media-probe';
import type { ProbedAudioTrack } from '@project/common/media-probe';
import { asbError, asbTrace, asbWarn } from '@project/common/util/log';

type TranscodedAudio = AudioConversion & {
    /** The original audio cannot be recorded, even if conversion is unavailable or fails. */
    readonly required: boolean;
    /** Display name of the codec the browser cannot decode, e.g. "E-AC-3". */
    readonly codecName?: string;
    readonly fail: (error: unknown) => void;
};

/**
 * Detects audio tracks the browser cannot decode - Dolby formats like E-AC-3, most commonly - and
 * automatically transcodes one into a playable format in the background.
 */
export const useTranscodedAudio = (
    videoFile: FileWithId | undefined,
    host: AudioTranscodeHost | undefined
): TranscodedAudio => {
    const [conversion, setConversion] = useState<AudioConversion>({ state: 'idle' });
    const [track, setTrack] = useState<ProbedAudioTrack>();
    const abortControllerRef = useRef<AbortController>(undefined);

    /** Never rejects: failures become the 'failed' state unless the conversion was superseded. */
    const convert = useCallback(async (videoFile: FileWithId, trackIndex: number, host: AudioTranscodeHost) => {
        const abortController = new AbortController();
        abortControllerRef.current?.abort();
        abortControllerRef.current = abortController;
        const { signal } = abortController;
        setConversion({ state: 'transcoding' });

        try {
            const blob = await host.transcodeAudio({
                file: videoFile.file,
                fileId: videoFile.id,
                trackIndex,
                onAudio: (audio) => {
                    if (signal.aborted) return;
                    setConversion({ state: 'transcoding', blob: audio });
                },
                signal,
            });
            if (signal.aborted) return;

            setConversion({ state: 'ready', blob });
            asbTrace('audio/transcode', 'Converted audio is ready for playback', {
                fileId: videoFile.id,
                outputBytes: blob.size,
            });
        } catch (error) {
            if (signal.aborted) return;
            asbError('audio/transcode', 'Failed to transcode audio', {
                fileId: videoFile.id,
                trackIndex,
                errorCode: error instanceof Error && 'code' in error ? error.code : undefined,
                error,
            });
            setConversion({ state: 'failed', error });
        }
    }, []);

    useEffect(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = undefined;
        setConversion({ state: 'idle' });
        setTrack(undefined);
        if (videoFile === undefined || host === undefined) return;

        let cancelled = false;
        const detectAndConvert = async () => {
            let track: ProbedAudioTrack | undefined;
            try {
                track = await audioTrackRequiringTranscode(videoFile.file);
                if (cancelled || track === undefined) return;
                setTrack(track); // Mining must avoid the original track even when conversion cannot start.
                if (!host.supportsAudioPlayback()) {
                    asbWarn('audio/transcode', 'Skipping audio conversion: converted audio playback is unsupported', {
                        fileId: videoFile.id,
                        codec: track.codec,
                    });
                    return;
                }
            } catch (error) {
                if (!cancelled) {
                    asbWarn('audio/transcode', 'Could not determine whether audio needs conversion', {
                        fileId: videoFile.id,
                        error,
                    });
                }
                return;
            }
            asbTrace('audio/transcode', 'Starting audio conversion', {
                fileId: videoFile.id,
                trackIndex: track.index,
                codec: track.codec,
            });
            await convert(videoFile, track.index, host);
        };
        void detectAndConvert();

        return () => {
            cancelled = true;
            abortControllerRef.current?.abort();
        };
    }, [videoFile, host, convert]);

    const fail = useCallback((error: unknown) => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = undefined;
        setConversion({ state: 'failed', error });
    }, []);

    return useMemo(
        () => ({
            ...conversion,
            required: track !== undefined,
            codecName: track === undefined ? undefined : audioCodecDisplayName(track.codec),
            fail,
        }),
        [conversion, track, fail]
    );
};
