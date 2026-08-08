import { useCallback, useEffect, useRef, useState } from 'react';
import { type AudioTranscodeProgress, audioTranscodingAvailable, transcodeAudioTrack } from '../../audio-transcode';
import { createBlobUrl, revokeBlobUrl } from '../../blob-url';
import { FileWithId } from '../../file-selector';
import { audioCodecDisplayName, audioTrackRequiringTranscode } from '../../media-probe';

export type TranscodedAudioState = 'idle' | 'prompting' | 'transcoding' | 'ready' | 'failed';

export interface TranscodedAudio {
    readonly state: TranscodedAudioState;
    /** Display name of the codec the browser cannot decode, e.g. "E-AC-3". */
    readonly codecName?: string;
    readonly progress?: AudioTranscodeProgress;
    /** Blob URL of the transcoded audio, for playback alongside the muted video. */
    readonly url?: string;
    /** The transcoded audio itself, so mined cards can be given their own blob URL. */
    readonly blob?: Blob;
    readonly start: () => void;
    readonly dismiss: () => void;
}

/**
 * Detects audio tracks the browser cannot decode - Dolby formats like E-AC-3, most commonly - and
 * transcodes one into a playable format when the user asks for it.
 */
export const useTranscodedAudio = (videoFile: FileWithId | undefined): TranscodedAudio => {
    const [state, setState] = useState<TranscodedAudioState>('idle');
    const [codecName, setCodecName] = useState<string>();
    const [progress, setProgress] = useState<AudioTranscodeProgress>();
    const [url, setUrl] = useState<string>();
    const [blob, setBlob] = useState<Blob>();
    const trackIndexRef = useRef<number>(undefined);
    const abortControllerRef = useRef<AbortController>(undefined);
    const urlRef = useRef<string>(undefined);

    const revokeUrl = useCallback(() => {
        if (urlRef.current !== undefined) {
            revokeBlobUrl(urlRef.current);
            urlRef.current = undefined;
        }
    }, []);

    useEffect(() => {
        setState('idle');
        setCodecName(undefined);
        setProgress(undefined);
        setBlob(undefined);
        revokeUrl();
        setUrl(undefined);
        trackIndexRef.current = undefined;

        if (videoFile === undefined) {
            return;
        }

        let cancelled = false;

        audioTrackRequiringTranscode(videoFile.file)
            .then(async (track) => {
                // Nothing to do when the file already plays.
                if (cancelled || track === undefined) {
                    return;
                }

                // An offline browser with no cached decoder should behave exactly as it always has.
                if (!(await audioTranscodingAvailable()) || cancelled) {
                    return;
                }

                trackIndexRef.current = track.index;
                setCodecName(audioCodecDisplayName(track.codec));
                setState('prompting');
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [videoFile, revokeUrl]);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
            revokeUrl();
        };
    }, [revokeUrl]);

    const start = useCallback(() => {
        const trackIndex = trackIndexRef.current;

        if (videoFile === undefined || trackIndex === undefined) {
            return;
        }

        const abortController = new AbortController();
        abortControllerRef.current?.abort();
        abortControllerRef.current = abortController;
        setProgress(undefined);
        setState('transcoding');

        transcodeAudioTrack({
            file: videoFile.file,
            trackIndex,
            onProgress: (progress) => {
                if (!abortController.signal.aborted) {
                    setProgress(progress);
                }
            },
            signal: abortController.signal,
        })
            .then(({ blob }) => {
                if (abortController.signal.aborted) {
                    return;
                }

                revokeUrl();
                urlRef.current = createBlobUrl(blob);
                setBlob(blob);
                setUrl(urlRef.current);
                setState('ready');
            })
            .catch((e) => {
                if (abortController.signal.aborted) {
                    return;
                }

                console.error('Failed to transcode audio:', e);
                setState('failed');
            });
    }, [videoFile, revokeUrl]);

    const dismiss = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = undefined;
        setProgress(undefined);
        setState('idle');
    }, []);

    return { state, codecName, progress, url, blob, start, dismiss };
};
