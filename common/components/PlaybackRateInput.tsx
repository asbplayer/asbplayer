import type { InputProps } from '@mui/material/Input';
import React, { MutableRefObject, useCallback } from 'react';
import VideoControlInput from '@project/common/components/VideoControlInput';
import {
    minimumPlaybackRate,
    normalizePlaybackRate,
} from '@project/common/playback/controllers/playback-mode-controller';

interface Props extends InputProps {
    inputRef: MutableRefObject<HTMLInputElement | undefined>;
    playbackRate: number;
    onPlaybackRate: (playbackRate: number) => void;
    disableKeyEvents?: boolean;
}

const valueToPrettyString = (v: number) => '×' + String(v.toFixed(2));
const stringToValue = (s: string) => Number(s);
const rejectValue = (v: number) => v < minimumPlaybackRate;
const placeholder = '×' + Number(1).toFixed(2);

export default React.forwardRef(function PlaybackRateInput(
    { inputRef, playbackRate, onPlaybackRate, ...rest }: Props,
    ref
) {
    const handleNumberValue = useCallback(
        (value: number) => {
            const normalized = normalizePlaybackRate(value);
            if (normalized !== undefined) onPlaybackRate(normalized);
        },
        [onPlaybackRate]
    );

    return (
        <VideoControlInput
            ref={ref}
            inputRef={inputRef}
            defaultNumberValue={1}
            valueToPrettyString={valueToPrettyString}
            stringToValue={stringToValue}
            numberValue={playbackRate}
            onNumberValue={handleNumberValue}
            rejectValue={rejectValue}
            placeholder={placeholder}
            {...rest}
        />
    );
});
