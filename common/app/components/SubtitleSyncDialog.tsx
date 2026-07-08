import { ChangeEvent, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { SubtitleModel, SubtitleSyncResult, detectSubtitleOffset } from '@project/common';
import { SubtitleReader } from '@project/common/subtitle-reader';

const UPLOAD = 'upload';
const LOW_CONFIDENCE = 0.5;

type Cue = Pick<SubtitleModel, 'originalStart' | 'originalEnd'>;

interface Props {
    subtitles: SubtitleModel[];
    subtitleFileNames: string[];
    subtitleReader: SubtitleReader;
    onApplyOffset: (offset: number) => void;
    onClose: () => void;
}

const SubtitleSyncDialog = ({ subtitles, subtitleFileNames, subtitleReader, onApplyOffset, onClose }: Props) => {
    const { t } = useTranslation();
    const tracks = useMemo(() => Array.from(new Set(subtitles.map((s) => s.track))).sort((a, b) => a - b), [subtitles]);
    const trackLabel = useCallback(
        (track: number) => subtitleFileNames[track] ?? t('subtitleSync.trackLabel', { number: track + 1 }),
        [subtitleFileNames, t]
    );

    const [primaryTrack, setPrimaryTrack] = useState(tracks[0] ?? 0);
    const [reference, setReference] = useState(UPLOAD);
    const [file, setFile] = useState<File>();
    const [result, setResult] = useState<SubtitleSyncResult>();
    const [previousOffset, setPreviousOffset] = useState<number>();
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);

    const applied = previousOffset !== undefined;
    const detected = result !== undefined && result.confidence > 0;
    const canDetect = reference !== UPLOAD || file !== undefined;

    const resetDetection = () => {
        setResult(undefined);
        setError(false);
    };

    const handlePrimaryChange = (value: string) => {
        setPrimaryTrack(Number(value));
        if (reference === value) {
            setReference(UPLOAD);
        }
        resetDetection();
    };

    const handleReferenceChange = (value: string) => {
        setReference(value);
        resetDetection();
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file
        if (selected) {
            setFile(selected);
            resetDetection();
        }
    };

    const handleDetect = async () => {
        setError(false);
        setLoading(true);

        try {
            const primaryCues = subtitles.filter((s) => s.track === primaryTrack);
            let referenceCues: Cue[];

            if (reference === UPLOAD) {
                if (!file) {
                    return;
                }

                const nodes = await subtitleReader.subtitles([file]);
                referenceCues = nodes.map((n) => ({ originalStart: n.start, originalEnd: n.end }));
            } else {
                referenceCues = subtitles.filter((s) => s.track === Number(reference));
            }

            setResult(detectSubtitleOffset(primaryCues, referenceCues));
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = () => {
        if (!result) {
            return;
        }

        setPreviousOffset(subtitles.length > 0 ? subtitles[0].start - subtitles[0].originalStart : 0);
        onApplyOffset(result.offset);
    };

    const handleUndo = () => {
        if (previousOffset === undefined) {
            return;
        }

        onApplyOffset(previousOffset);
        setPreviousOffset(undefined);
    };

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>{t('subtitleSync.title')}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t('subtitleSync.description')}
                    </Typography>
                    {tracks.length > 1 && (
                        <TextField
                            select
                            fullWidth
                            disabled={applied}
                            label={t('subtitleSync.primaryTrack')}
                            value={String(primaryTrack)}
                            onChange={(e) => handlePrimaryChange(e.target.value)}
                        >
                            {tracks.map((track) => (
                                <MenuItem key={track} value={String(track)}>
                                    {trackLabel(track)}
                                </MenuItem>
                            ))}
                        </TextField>
                    )}
                    <TextField
                        select
                        fullWidth
                        disabled={applied}
                        label={t('subtitleSync.reference')}
                        value={reference}
                        onChange={(e) => handleReferenceChange(e.target.value)}
                    >
                        <MenuItem value={UPLOAD}>{t('subtitleSync.uploadFile')}</MenuItem>
                        {tracks
                            .filter((track) => track !== primaryTrack)
                            .map((track) => (
                                <MenuItem key={track} value={String(track)}>
                                    {trackLabel(track)}
                                </MenuItem>
                            ))}
                    </TextField>
                    {reference === UPLOAD && (
                        <Button variant="outlined" component="label" disabled={applied}>
                            {file?.name ?? t('subtitleSync.chooseFile')}
                            <input type="file" hidden onChange={handleFileChange} />
                        </Button>
                    )}
                    {loading && <CircularProgress size={24} sx={{ alignSelf: 'center' }} />}
                    {error && <Alert severity="error">{t('subtitleSync.fileError')}</Alert>}
                    {!applied &&
                        result &&
                        (result.confidence > 0 ? (
                            <Stack spacing={1}>
                                <Typography>{t('subtitleSync.detectedOffset', { offset: result.offset })}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t('subtitleSync.confidence', { percent: Math.round(result.confidence * 100) })}
                                </Typography>
                                {result.confidence < LOW_CONFIDENCE && (
                                    <Alert severity="warning">{t('subtitleSync.lowConfidence')}</Alert>
                                )}
                            </Stack>
                        ) : (
                            <Alert severity="warning">{t('subtitleSync.noMatch')}</Alert>
                        ))}
                    {applied && result && (
                        <Alert severity="success">{t('subtitleSync.applied', { offset: result.offset })}</Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('action.close')}</Button>
                {applied ? (
                    <Button onClick={handleUndo}>{t('subtitleSync.undo')}</Button>
                ) : (
                    <>
                        <Button onClick={handleDetect} disabled={!canDetect || loading}>
                            {t('subtitleSync.detect')}
                        </Button>
                        <Button variant="contained" onClick={handleApply} disabled={!detected}>
                            {t('subtitleSync.apply')}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default SubtitleSyncDialog;
