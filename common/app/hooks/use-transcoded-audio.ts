import { useCallback, useEffect, useRef, useState } from 'react';
import { transcodeAudioTrack } from '@project/common/audio-transcode';
import type { AudioTranscodeHost } from '@project/common/audio-transcode';
import type { FileWithId } from '@project/common/file-selector';
import { audioCodecDisplayName, audioTrackRequiringTranscode } from '@project/common/media-probe';
import type { ProbedAudioTrack } from '@project/common/media-probe';
import { asbError, asbTrace, asbWarn } from '@project/common/util/log';

/** Conversion data is carried only by the state that can use it. */
export type TranscodedAudioState =
    | { readonly state: 'idle'; readonly blob?: never; readonly error?: never }
    | { readonly state: 'transcoding'; readonly blob?: Blob; readonly error?: never }
    | { readonly state: 'ready'; readonly blob: Blob; readonly error?: never }
    | { readonly state: 'failed'; readonly blob?: never; readonly error: unknown };

export type TranscodedAudio = TranscodedAudioState & {
    /** The original audio cannot be recorded, even if conversion is unavailable or fails. */
    readonly required: boolean;
    /** Display name of the codec the browser cannot decode, e.g. "E-AC-3". */
    readonly codecName?: string;
    /** True once every encoded chunk has arrived. Playback may start earlier. */
    readonly complete: boolean;
    readonly clearFailure: () => void;
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
    const [conversion, setConversion] = useState<TranscodedAudioState>({ state: 'idle' });
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
            const blob = await transcodeAudioTrack({
                file: videoFile.file,
                trackIndex,
                host,
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
            asbError('audio/transcode', 'Failed to transcode audio', { fileId: videoFile.id, trackIndex, error });
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
                if (!host.supportsAudioPlayback()) return;
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

    const clearFailure = useCallback(() => {
        setConversion((conversion) => (conversion.state === 'failed' ? { state: 'idle' } : conversion));
    }, []);

    return {
        ...conversion,
        required: track !== undefined,
        codecName: track === undefined ? undefined : audioCodecDisplayName(track.codec),
        complete: conversion.state === 'ready',
        clearFailure,
        fail,
    };
};
