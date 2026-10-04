import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import { PostMineAction } from '@project/common';
import { useTranslation } from 'react-i18next';

interface Props {
    disabled: boolean;
    postMineAction: PostMineAction;
    emptySubtitleTrack: boolean;
    recordingAudio: boolean;
    audioRecordingEnabled: boolean;
    onMineSubtitle: () => void;
}

const SidePanelBottomControls = ({
    disabled,
    postMineAction,
    emptySubtitleTrack,
    recordingAudio,
    audioRecordingEnabled,
    onMineSubtitle,
}: Props) => {
    const { t } = useTranslation();

    function buttonActionLabel() {
        if (emptySubtitleTrack) {
            if (audioRecordingEnabled) {
                return recordingAudio ? t('action.stopRecording') : t('action.startRecording');
            }

            return t('action.mine');
        }

        switch (postMineAction) {
            case PostMineAction.exportCard:
            case PostMineAction.showAnkiDialog:
            case PostMineAction.none:
                return t('action.mine');
            case PostMineAction.updateLastCard:
                return t('action.updateLastCard');
            case PostMineAction.showUpdateCardDialog:
                return t('postMineAction.showUpdateCardDialog');
        }
    }

    if (!emptySubtitleTrack) {
        // Mining buttons will be available on each subtitle row
        return null;
    }

    return (
        <Box p={2} style={{ position: 'absolute', bottom: 0, width: '100%' }}>
            <Button
                disabled={disabled || (recordingAudio && !emptySubtitleTrack)}
                variant="contained"
                color="primary"
                startIcon={<NoteAddIcon />}
                onClick={onMineSubtitle}
                style={{ width: '100%' }}
            >
                {buttonActionLabel()}
            </Button>
        </Box>
    );
};

export default SidePanelBottomControls;
