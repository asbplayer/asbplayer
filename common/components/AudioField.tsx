import React, { useState, useEffect } from 'react';
import makeStyles from '@mui/styles/makeStyles';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from './Tooltip';
import IconButton from '@mui/material/IconButton';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DownloadIcon from '@mui/icons-material/Download';
import { AudioClip } from '../audio-clip';
import { useTranslation } from 'react-i18next';
import Badge from '@mui/material/Badge';

const useStyles = makeStyles(() => ({
    root: {
        cursor: 'pointer',
        '& input': {
            cursor: 'pointer',
        },
    },
}));

interface Props {
    audioClip: AudioClip;
    timestampIntervalSelectionNotApplied: boolean;
    onPlayAudio: (e: React.MouseEvent<HTMLDivElement>) => void;
    onRerecord?: () => void;
}

const useAudioHelperText = (audioClip?: AudioClip, onRerecord?: () => void) => {
    const { t } = useTranslation();
    const [audioHelperText, setAudioHelperText] = useState<string>();
    const [audioClipPlayable, setAudioClipPlayable] = useState<boolean>();

    useEffect(() => {
        if (audioClip) {
            const playable = audioClip.error === undefined;
            setAudioClipPlayable(playable);

            if (playable) {
                if (onRerecord === undefined && !audioClip.isSliceable()) {
                    setAudioHelperText(t('ankiDialog.cannotUpdateAudio')!);
                } else {
                    setAudioHelperText(undefined);
                }
            } else {
                setAudioHelperText(t(audioClip.errorLocKey!)!);
            }
        }
    }, [audioClip, onRerecord, t]);

    return { audioHelperText, audioClipPlayable };
};

export default function AudioField({
    audioClip,
    timestampIntervalSelectionNotApplied,
    onPlayAudio,
    onRerecord,
}: Props) {
    const classes = useStyles();
    const { t } = useTranslation();
    const [playing, setPlaying] = useState<boolean>(false);
    let audioActionElement: React.JSX.Element | undefined = undefined;

    useEffect(() => setPlaying(audioClip.playing), [audioClip]);
    useEffect(() => audioClip.onEvent('play', () => setPlaying(true)), [audioClip]);
    useEffect(() => audioClip.onEvent('pause', () => setPlaying(false)), [audioClip]);

    audioActionElement = (
        <>
            <Tooltip title={t('action.downloadAudio')!}>
                <span>
                    <IconButton
                        disabled={audioClip?.error !== undefined}
                        onClick={(e) => {
                            e.stopPropagation();
                            audioClip.download();
                        }}
                        edge="end"
                    >
                        <DownloadIcon />
                    </IconButton>
                </span>
            </Tooltip>
            <IconButton disabled={audioClip?.error !== undefined} onClick={() => {}} edge="end">
                {playing && <PauseIcon />}
                {!playing && <PlayArrowIcon />}
            </IconButton>
            {onRerecord !== undefined && (
                <Tooltip
                    title={
                        timestampIntervalSelectionNotApplied
                            ? t('ankiDialog.rerecordAndApplySelection')!
                            : t('ankiDialog.rerecord')!
                    }
                >
                    <span>
                        <Badge invisible={!timestampIntervalSelectionNotApplied} badgeContent="!" color="error">
                            <IconButton
                                disabled={audioClip?.error !== undefined}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRerecord?.();
                                }}
                                edge="end"
                            >
                                <FiberManualRecordIcon />
                            </IconButton>
                        </Badge>
                    </span>
                </Tooltip>
            )}
        </>
    );

    const { audioHelperText, audioClipPlayable } = useAudioHelperText(audioClip, onRerecord);

    return (
        <div className={classes.root} onClick={onPlayAudio}>
            <TextField
                variant="filled"
                color="primary"
                fullWidth
                value={audioClip.name}
                label={t('ankiDialog.audio')}
                helperText={audioHelperText}
                disabled={!audioClipPlayable}
                slotProps={{
                    input: {
                        endAdornment: audioActionElement && (
                            <InputAdornment position="end">{audioActionElement}</InputAdornment>
                        ),
                    },
                }}
            />
        </div>
    );
}
