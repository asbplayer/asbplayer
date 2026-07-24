import type { InputProps } from '@mui/material/Input';
import React, { MutableRefObject } from 'react';
import VideoControlInput from './VideoControlInput';
import { minimumPlaybackRate, normalizePlaybackRate } from '../playback/playback-mode-controller';

interface Props extends InputProps {
    inputRef: MutableRefObject<HTMLInputElement | undefined>;
    playbackRate: number;
    onPlaybackRate: (playbackRate: number) => void;
    disableKeyEvents?: boolean;
}

const valueToPrettyString = (v: number) => '×' + String(v.toFixed(3));
const stringToValue = (s: string) => Number(s);
const rejectValue = (v: number) => v < minimumPlaybackRate;
const placeholder = '×' + Number(1).toFixed(3);

export default React.forwardRef(function PlaybackRateInput(
    { inputRef, playbackRate, onPlaybackRate, ...rest }: Props,
    ref
) {
    return (
        <VideoControlInput
            ref={ref}
            inputRef={inputRef}
            defaultNumberValue={1}
            valueToPrettyString={valueToPrettyString}
            stringToValue={stringToValue}
            numberValue={playbackRate}
            onNumberValue={(value) => {
                const normalized = normalizePlaybackRate(value);
                if (normalized !== undefined) onPlaybackRate(normalized);
            }}
            rejectValue={rejectValue}
            placeholder={placeholder}
            {...rest}
        />
    );
});
