import { useEffect, useRef } from 'react';
import type VideoChannel from '@project/common/app/services/video-channel';

/** Pause the picker’s media, restoring its original play/pause state when the picker closes. */
export const useSubtitlePickerPlayback = (open: boolean, channel: VideoChannel | undefined) => {
    const saved = useRef<{ channel: VideoChannel; paused: boolean }>(undefined);

    useEffect(() => {
        if (!open) {
            const previous = saved.current;
            saved.current = undefined;
            if (previous && previous.channel === channel) {
                const remove = previous.channel.onReady(() => {
                    if (previous.paused) previous.channel.pause();
                    else void previous.channel.play();
                });
                remove();
            }
            return;
        }

        if (saved.current?.channel !== channel) saved.current = undefined;
        return channel?.onReady((paused) => {
            saved.current ??= { channel, paused };
            channel.pause();
        });
    }, [open, channel]);
};
