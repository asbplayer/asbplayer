import { useCallback, useEffect, useState } from 'react';
import type { TranscodedAudioModel } from '@project/common';
import type { AudioClip } from '@project/common/audio-clip';
import { asbInfo } from '@project/common/util/log';

/** Bound dialog timestamps to one immutable converted-audio snapshot. */
export const useClampTimestampInterval = ({
    open,
    audioClip,
    source,
}: {
    open: boolean;
    audioClip: Pick<AudioClip, 'sourceDurationMs'> | undefined;
    source: TranscodedAudioModel | undefined;
}) => {
    const [duration, setDuration] = useState<{ source: TranscodedAudioModel; durationMs: number }>();
    useEffect(() => {
        if (!open || !audioClip || !source) return;
        let cancelled = false;
        void audioClip
            .sourceDurationMs()
            .then((durationMs) => {
                if (!cancelled) setDuration({ source, durationMs: Math.floor(durationMs ?? 0) });
            })
            .catch((error) => asbInfo('anki/ui', error));
        return () => {
            cancelled = true;
        };
    }, [open, audioClip, source]);
    const end = source === undefined ? undefined : duration?.source === source ? duration.durationMs : 0;
    return useCallback(
        (interval: number[]) =>
            end === undefined ? interval : interval.map((timestamp) => Math.max(0, Math.min(end, timestamp))),
        [end]
    );
};
