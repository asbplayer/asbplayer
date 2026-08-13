import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { type AudioTranscodeProgress } from '../../audio-transcode';

interface AudioConversionModalProps {
    open: boolean;
    progress?: AudioTranscodeProgress;
    onCancel: () => void;
}

export default function AudioConversionModal({ open, progress, onCancel }: AudioConversionModalProps) {
    const { t } = useTranslation();
    const percent = Math.round((progress?.ratio ?? 0) * 100);
    // Several seconds pass while the converters start up before there is anything to report, so
    // show movement rather than a bar sitting at zero.
    const starting = percent === 0;

    return (
        <Dialog
            open={open}
            onClose={(event, reason) => {
                if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
                onCancel();
            }}
            fullWidth
            maxWidth="sm"
            aria-labelledby="audio-conversion-title"
            aria-describedby="audio-conversion-description"
            disableEscapeKeyDown
            sx={{
                '& .MuiDialog-paper': {
                    bgcolor: 'background.default',
                },
            }}
        >
            <DialogTitle id="audio-conversion-title">{t('info.audioConversionTitle')}</DialogTitle>
            <DialogContent dividers>
                <Typography id="audio-conversion-description" variant="body1" align="center" gutterBottom>
                    {starting
                        ? t('info.startingAudioConverter')
                        : t(
                              progress?.stage === 'loadingDecoder'
                                  ? 'info.loadingAudioConverter'
                                  : 'info.convertingAudio',
                              { percent }
                          )}
                </Typography>
                <Box width="100%" mt={3}>
                    <LinearProgress
                        variant={starting ? 'indeterminate' : 'determinate'}
                        value={percent}
                        sx={{ height: 10, borderRadius: 5 }}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center' }}>
                <Button onClick={onCancel} variant="outlined" color="primary">
                    {t('action.cancel')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
