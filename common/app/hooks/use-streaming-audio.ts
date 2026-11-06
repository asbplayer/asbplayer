import { useEffect, useRef, useState } from 'react';
import { createBlobUrl, revokeBlobUrl } from '@project/common/blob-url';
import { createStreamingAudio, supportsStreamingAudio } from '@project/common/audio-transcode/streaming-audio';
import type { AudioSeekableRange, StreamingAudioSource } from '@project/common/audio-transcode/streaming-audio';
import { asbTrace } from '@project/common/util/log';

/** MSE stays in the document that owns the audio element, so moving to a pop-out can replay the prefix. */
export const useStreamingAudio = ({
    audio,
    complete,
    active,
    video,
    onBuffered,
    onError,
}: {
    audio: Blob | undefined;
    complete: boolean;
    active: boolean;
    video: HTMLVideoElement | undefined;
    onBuffered: (range: AudioSeekableRange | undefined) => void;
    onError: (error: unknown) => void;
}) => {
    const [url, setUrl] = useState<string>();
    const stream = useRef<StreamingAudioSource>(undefined);
    const latest = useRef({ audio, video, onBuffered, onError });
    latest.current = { audio, video, onBuffered, onError };

    useEffect(() => {
        if (!active) {
            setUrl(undefined);
            latest.current.onBuffered(undefined);
            return;
        }
        if (complete) {
            const blob = latest.current.audio;
            if (blob === undefined) return;
            const url = createBlobUrl(blob);
            asbTrace('audio/streaming', 'Using completed audio Blob', { url, bytes: blob.size, type: blob.type });
            setUrl(url);
            latest.current.onBuffered(undefined);
            return () => revokeBlobUrl(url);
        }
        if (!supportsStreamingAudio()) {
            asbTrace('audio/streaming', 'Progressive audio unavailable; waiting for completed conversion');
            // Keep playback waiting for the completed Blob on browsers without MSE (e.g iPhone).
            setUrl(undefined);
            latest.current.onBuffered({ start: 0, end: 0 });
            return;
        }
        const source = createStreamingAudio({
            currentTimeMs: () => (latest.current.video?.currentTime ?? 0) * 1000,
            onBuffered: (range) => latest.current.onBuffered(range),
            onError: (error) => latest.current.onError(error),
        });
        stream.current = source;
        asbTrace('audio/streaming', 'Using progressive MediaSource audio', { url: source.url });
        setUrl(source.url);
        latest.current.onBuffered({ start: 0, end: 0 });
        if (latest.current.audio !== undefined) source.append(latest.current.audio);
        return () => {
            source.dispose();
            stream.current = undefined;
        };
    }, [active, complete]);

    useEffect(() => {
        if (audio !== undefined && !complete) stream.current?.append(audio);
    }, [audio, complete]);

    return url;
};
