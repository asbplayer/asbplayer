import { useEffect, useRef, useState } from 'react';
import { createBlobUrl, revokeBlobUrl } from '@project/common/blob-url';
import { createStreamingAudio, supportsStreamingAudio } from '@project/common/audio-transcode/streaming-audio';
import type { AudioSeekableRange, StreamingAudioSource } from '@project/common/audio-transcode/streaming-audio';
import { asbTrace } from '@project/common/util/log';
import { usesConvertedAudio } from '@project/common/audio-transcode';
import type { TranscodedAudioPayload } from '@project/common';

/** MSE stays in the document that owns the audio element, so moving to a pop-out can replay the prefix. */
export const useStreamingAudio = ({
    conversion,
    video,
    onBuffered,
    onError,
}: {
    conversion: TranscodedAudioPayload;
    video: HTMLVideoElement | undefined;
    onBuffered: (range: AudioSeekableRange | undefined) => void;
    onError: (error: unknown) => void;
}) => {
    const [url, setUrl] = useState<string>();
    const stream = useRef<StreamingAudioSource>(undefined);
    const latest = useRef({ conversion, video, onBuffered, onError });
    latest.current = { conversion, video, onBuffered, onError };
    const { state, audio } = conversion;

    useEffect(() => {
        const conversion = latest.current.conversion;
        if (!usesConvertedAudio(conversion.state)) {
            setUrl(undefined);
            latest.current.onBuffered(undefined);
            return;
        }
        if (conversion.state === 'ready') {
            const blob = conversion.audio;
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
        if (conversion.audio !== undefined) source.append(conversion.audio);
        return () => {
            source.dispose();
            stream.current = undefined;
        };
    }, [state]);

    useEffect(() => {
        if (audio !== undefined && state === 'transcoding') stream.current?.append(audio);
    }, [audio, state]);

    return url;
};
