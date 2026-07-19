import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import makeStyles from '@mui/styles/makeStyles';
import Switch from '@mui/material/Switch';
import LabelWithHoverEffect from '@project/common/components/LabelWithHoverEffect';
import { ConfirmedVideoDataSubtitleTrack, VideoDataSubtitleTrack, VideoDataUiOpenReason } from '@project/common';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MiniProfileSelector from '@project/common/components/MiniProfileSelector';
import type { Profile } from '@project/common/settings';
import Alert from '@mui/material/Alert';
import { type ButtonBaseActions } from '@mui/material';
import { OnlineSubtitleSourceConfig } from '../global-state';
import OnlineSubtitleSourceDialog from './OnlineSubtitleSourceDialog';
import { TFunction } from 'i18next';
import { FileSelector, FileWithId } from '@project/common/file-selector';

const createClasses = makeStyles(() => ({
    relative: {
        position: 'relative',
    },
    spinner: {
        position: 'absolute',
        right: 'calc(1em + 14px)',
        top: 'calc(50% - 13px)',
        fontSize: '1.5em',
    },
    hide: {
        display: 'none',
    },
}));

// An auto-calculated video name based on selected track
function calculateVideoName(baseName: string, label: string, localFile: boolean | undefined) {
    if (baseName === '' && label) {
        return label;
    }

    if (label && !baseName.includes(label) && localFile !== true) {
        return `${baseName} - ${label}`;
    }

    return baseName;
}

const normalizeOnlineSubtitleFileName = (name: string, sourceUrl: string) => {
    const trimmedName = name.trim();
    const defaultExtension = 'srt';
    const sourceUrlPath = (() => {
        try {
            return new URL(sourceUrl).pathname;
        } catch {
            return sourceUrl;
        }
    })();
    const sourceUrlFileName = sourceUrlPath.split('/').pop() ?? '';
    const sourceUrlLastDotIndex = sourceUrlFileName.lastIndexOf('.');
    const sourceUrlExtension =
        sourceUrlLastDotIndex > 0 && sourceUrlLastDotIndex < sourceUrlFileName.length - 1
            ? sourceUrlFileName.substring(sourceUrlLastDotIndex + 1)
            : undefined;

    if (trimmedName.length === 0) {
        // Handle incomplete source metadata (empty display name) deterministically.
        const fallbackExtension = sourceUrlExtension ?? defaultExtension;
        return {
            normalizedName: `subtitle.${fallbackExtension}`,
            extension: fallbackExtension,
        };
    }

    const lastDotIndex = trimmedName.lastIndexOf('.');
    if (lastDotIndex > 0 && lastDotIndex < trimmedName.length - 1) {
        return {
            normalizedName: trimmedName,
            extension: trimmedName.substring(lastDotIndex + 1),
        };
    }

    // Keep name/extension consistent when display name has no extension but URL still has one.
    const fallbackExtension = sourceUrlExtension ?? defaultExtension;
    return {
        normalizedName: `${trimmedName}.${fallbackExtension}`,
        extension: fallbackExtension,
    };
};

export const emptySubtitleTrack = (t: TFunction) => {
    return {
        id: '-',
        language: '-',
        url: '-',
        label: t('extension.videoDataSync.emptySubtitleTrack'),
        extension: 'srt',
    };
};

const initialTrackIds = ['-', '-', '-'];

export const useVideoDataSyncDialogState = () => {
    const { t } = useTranslation();
    const [subtitleTrackSelectorOpen, setSubtitleTrackSelectorOpen] = useState<boolean>(false);
    const [subtitleTrackSelectorDisabled, setSubtitleTrackSelectorDisabled] = useState<boolean>(false);
    const [subtitleTrackSelectorTracks, setSubtitleTrackSelectorTracks] = useState<VideoDataSubtitleTrack[]>([
        emptySubtitleTrack(t),
    ]);
    useEffect(() => {
        for (const track of subtitleTrackSelectorTracks) {
            if (track.id === '-') {
                track.label = t('extension.videoDataSync.emptySubtitleTrack');
            }
        }
    }, [t, subtitleTrackSelectorTracks]);
    const [subtitleTrackSelectorSelectedTrackIds, setSubtitleTrackSelectorSelectedTrackIds] =
        useState<string[]>(initialTrackIds);
    const openSubtitleTrackSelector = useCallback(() => setSubtitleTrackSelectorOpen(true), []);
    const closeSubtitleTrackSelector = useCallback(() => setSubtitleTrackSelectorOpen(false), []);

    return {
        subtitleTrackSelectorOpen,
        openSubtitleTrackSelector,
        closeSubtitleTrackSelector,
        subtitleTrackSelectorSelectedTrackIds,
        setSubtitleTrackSelectorSelectedTrackIds,
        subtitleTrackSelectorTracks,
        setSubtitleTrackSelectorTracks,
        subtitleTrackSelectorDisabled,
        setSubtitleTrackSelectorDisabled,
    };
};

interface Props {
    open: boolean;
    disabled: boolean;
    isLoading: boolean;
    // The video name automatically supplied by asbplayer's content script
    // Not to be confused with the auto-calculated video name when user selects a subtitle track
    suggestedName: string;
    subtitleTracks: VideoDataSubtitleTrack[];
    selectedSubtitleTrackIds: string[];
    defaultCheckboxState: boolean;
    error: string;
    openReason: VideoDataUiOpenReason;
    profiles: Profile[];
    activeProfile?: string;
    onlineSubtitleSourceConfig: OnlineSubtitleSourceConfig;
    hasSeenFtue?: boolean;
    hideRememberTrackPreferenceToggle?: boolean;
    hideVideoNameTextField?: boolean;
    fileSelector: FileSelector;
    onCancel: () => void;
    onOpenSettings: () => void;
    onConfirm: (track: ConfirmedVideoDataSubtitleTrack[], shouldRememberTrackChoices: boolean) => void;
    onSetActiveProfile: (profile: string | undefined) => void;
    onOnlineSourceConfigChanged: (state: Partial<OnlineSubtitleSourceConfig>) => void;
    onDismissFtue: () => void;
    onOpenFiles: (files: FileWithId[]) => void;
    onSubtitleTracks: (tracks: VideoDataSubtitleTrack[]) => void;
    onSelectedSubtitleTrackIds: (trackIds: string[]) => void;
}

export default function VideoDataSyncDialog({
    open,
    disabled,
    isLoading,
    suggestedName,
    subtitleTracks,
    selectedSubtitleTrackIds,
    defaultCheckboxState,
    error,
    openReason,
    profiles,
    activeProfile,
    onlineSubtitleSourceConfig,
    hasSeenFtue,
    hideRememberTrackPreferenceToggle,
    hideVideoNameTextField,
    fileSelector,
    onCancel,
    onOpenSettings,
    onConfirm,
    onSetActiveProfile,
    onOnlineSourceConfigChanged,
    onDismissFtue,
    onOpenFiles,
    onSubtitleTracks,
    onSelectedSubtitleTrackIds,
}: Props) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [shouldRememberTrackChoices, setShouldRememberTrackChoices] = useState(false);
    const trimmedName = name.trim();
    const classes = createClasses();

    useEffect(() => {
        if (open) {
            setShouldRememberTrackChoices(defaultCheckboxState);
        }
    }, [open, defaultCheckboxState]);

    useEffect(() => {
        setName((name) => {
            if (!subtitleTracks) {
                // Unable to calculate the video name
                return name;
            }

            // If the video name is not calculated yet,
            // or has already been calculated and not changed by the user,
            // then calculate it (possibly again)
            if (
                !name ||
                name === suggestedName ||
                subtitleTracks.find(
                    (track) =>
                        track.url !== '-' &&
                        name === calculateVideoName(suggestedName, track.label, track.file !== undefined)
                )
            ) {
                const selectedTrack = subtitleTracks.find((track) => track.id === selectedSubtitleTrackIds[0]);

                if (selectedTrack === undefined || selectedTrack.url === '-') {
                    return suggestedName;
                }

                return calculateVideoName(suggestedName, selectedTrack.label, selectedTrack.file !== undefined);
            }

            // Otherwise, let the name be whatever the user set it to
            return name;
        });
    }, [suggestedName, selectedSubtitleTrackIds, subtitleTracks]);

    function handleOkButtonClick() {
        const selectedSubtitleTracks: ConfirmedVideoDataSubtitleTrack[] = allSelectedSubtitleTracks();
        onConfirm(selectedSubtitleTracks, shouldRememberTrackChoices);
    }

    function handleRememberTrackChoices() {
        setShouldRememberTrackChoices(!shouldRememberTrackChoices);
    }

    function allSelectedSubtitleTracks() {
        const selectedSubtitleTracks: ConfirmedVideoDataSubtitleTrack[] = selectedSubtitleTrackIds
            .map((selected): ConfirmedVideoDataSubtitleTrack | undefined => {
                const subtitle = subtitleTracks.find((subtitle) => subtitle.id === selected);
                if (subtitle) {
                    const { file, label } = subtitle;
                    const trackName =
                        file !== undefined
                            ? // Remove extension. The content script will add it back when rendering the file name on top of the video.
                              label.substring(0, label.lastIndexOf('.'))
                            : calculateVideoName(trimmedName, label, false);

                    return {
                        name: trackName,
                        ...subtitle,
                    };
                }
            })
            .filter((track): track is ConfirmedVideoDataSubtitleTrack => track !== undefined);

        return selectedSubtitleTracks;
    }

    function generateSubtitleTrackSelectors(numberOfSubtitleTrackSelectors: number) {
        const subtitleTrackSelectors = [];
        for (let i = 0; i < numberOfSubtitleTrackSelectors; i++) {
            subtitleTrackSelectors.push(
                <Grid item key={i} style={{ width: '100%' }}>
                    <div className={classes.relative}>
                        <TextField
                            select
                            fullWidth
                            key={i}
                            error={!!error}
                            color="primary"
                            variant="filled"
                            label={`${t('extension.videoDataSync.subtitleTrack')} ${i + 1}`}
                            helperText={error || ''}
                            value={subtitleTracks.find((track) => track.id === selectedSubtitleTrackIds[i])?.id ?? '-'}
                            disabled={isLoading || disabled}
                            onChange={(e) => {
                                const newSelectedSubtitles = [...selectedSubtitleTrackIds];
                                newSelectedSubtitles[i] = e.target.value;
                                onSelectedSubtitleTrackIds(newSelectedSubtitles);
                            }}
                        >
                            {subtitleTracks.map((subtitle) => (
                                <MenuItem value={subtitle.id} key={subtitle.id}>
                                    {subtitle.label}
                                </MenuItem>
                            ))}
                            <MenuItem onClick={() => handleOpenFile(i)}>{t('action.openFiles')}</MenuItem>
                            <MenuItem onClick={() => handleOpenOnline(i)}>
                                {t('onlineSubtitleSources.searchOnlineSubtitles')}
                            </MenuItem>
                        </TextField>
                        {isLoading && (
                            <span className={classes.spinner}>
                                <CircularProgress size={20} color="primary" />
                            </span>
                        )}
                    </div>
                </Grid>
            );
        }
        return subtitleTrackSelectors;
    }

    const threeSubtitleTrackSelectors = generateSubtitleTrackSelectors(3);
    const okActionRef = useRef<ButtonBaseActions | null>(null);
    const videoNameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open && trimmedName && !videoNameRef.current?.contains(document.activeElement) && !disabled) {
            okActionRef.current?.focusVisible();
        }
    }, [open, trimmedName, disabled]);

    const [fileInputTrackNumber, setFileInputTrackNumber] = useState<number>();
    const [onlineDialogOpen, setOnlineDialogOpen] = useState(false);
    const [onlineDialogTrackNumber, setOnlineDialogTrackNumber] = useState<number>();
    const detectedTitleHint = useMemo(() => suggestedName.trim(), [suggestedName]);

    useEffect(() => {
        return fileSelector.onFilesSelected((files) => {
            if (!files || files.length === 0) {
                return;
            }

            if (fileInputTrackNumber === undefined) {
                onOpenFiles(files);
            } else {
                const fileTracks: VideoDataSubtitleTrack[] = [...files].map((fileWithId) => {
                    const { file, id } = fileWithId;
                    const extension = file.name.substring(file.name.lastIndexOf('.') + 1, file.name.length);
                    return {
                        label: file.name,
                        id,
                        file,
                        extension,
                    };
                });

                if (fileTracks.length > 0) {
                    onSubtitleTracks([...subtitleTracks, ...fileTracks]);
                    const selectedIdsByTrackNumber = [...selectedSubtitleTrackIds];
                    selectedIdsByTrackNumber[fileInputTrackNumber] = fileTracks[0].id;
                    onSelectedSubtitleTrackIds(selectedIdsByTrackNumber);
                }
            }
        });
    }, [
        fileSelector,
        fileInputTrackNumber,
        subtitleTracks,
        selectedSubtitleTrackIds,
        onOpenFiles,
        onSubtitleTracks,
        onSelectedSubtitleTrackIds,
    ]);

    const handleOpenFile = useCallback(
        (track?: number) => {
            setFileInputTrackNumber(track);
            fileSelector.open();
        },
        [fileSelector]
    );

    const handleOpenOnline = useCallback((track?: number) => {
        setOnlineDialogTrackNumber(track);
        setOnlineDialogOpen(true);
    }, []);

    const handleOnlineDialogClose = useCallback(() => {
        setOnlineDialogOpen(false);
    }, []);

    const handleImportOnlineFile = useCallback(
        async ({ name, url }: { name: string; url: string }) => {
            const { normalizedName, extension } = normalizeOnlineSubtitleFileName(name, url);
            const track = {
                label: normalizedName,
                id: url,
                url,
                extension,
            } satisfies VideoDataSubtitleTrack;

            onSubtitleTracks([...subtitleTracks, track]);
            const newSelectedSubtitleTrackIds = [...selectedSubtitleTrackIds];
            if (onlineDialogTrackNumber !== undefined) {
                newSelectedSubtitleTrackIds[onlineDialogTrackNumber] = track.id;
            } else {
                const firstEmptyIndex = newSelectedSubtitleTrackIds.findIndex((id) => id === '-');
                if (firstEmptyIndex >= 0) {
                    newSelectedSubtitleTrackIds[firstEmptyIndex] = track.id;
                } else {
                    newSelectedSubtitleTrackIds[0] = track.id;
                }
            }
            onSelectedSubtitleTrackIds(newSelectedSubtitleTrackIds);
        },
        [
            subtitleTracks,
            selectedSubtitleTrackIds,
            onlineDialogTrackNumber,
            onSubtitleTracks,
            onSelectedSubtitleTrackIds,
        ]
    );

    return (
        <>
            <Dialog disableRestoreFocus disableEnforceFocus fullWidth maxWidth="sm" open={open} onClose={onCancel}>
                <Toolbar>
                    <Typography variant="h6" style={{ flexGrow: 1 }}>
                        {t('extension.videoDataSync.selectSubtitles')}
                    </Typography>
                    <MiniProfileSelector
                        profiles={profiles}
                        activeProfile={activeProfile}
                        onSetActiveProfile={onSetActiveProfile}
                    />
                    {onOpenSettings && (
                        <IconButton edge="end" onClick={onOpenSettings}>
                            <SettingsIcon />
                        </IconButton>
                    )}
                    {onCancel && (
                        <IconButton edge="end" onClick={() => onCancel()}>
                            <CloseIcon />
                        </IconButton>
                    )}
                </Toolbar>
                <DialogContent>
                    {openReason === VideoDataUiOpenReason.miningCommand && (
                        <DialogContentText>{t('extension.videoDataSync.loadSubtitlesFirst')}</DialogContentText>
                    )}
                    {openReason === VideoDataUiOpenReason.failedToAutoLoadPreferredTrack && (
                        <DialogContentText>{t('extension.videoDataSync.failedToAutoLoad')}</DialogContentText>
                    )}
                    <form>
                        <Grid container direction="column" spacing={2}>
                            {!hasSeenFtue && (
                                <Grid item>
                                    <Alert
                                        severity="info"
                                        action={
                                            <Button onClick={onDismissFtue} size="small">
                                                {t('action.ok')}
                                            </Button>
                                        }
                                    >
                                        {t('extension.videoDataSync.ftue')}
                                    </Alert>
                                </Grid>
                            )}
                            {!hideVideoNameTextField && (
                                <Grid item>
                                    <TextField
                                        ref={videoNameRef}
                                        fullWidth
                                        multiline
                                        color="primary"
                                        variant="filled"
                                        label={t('extension.videoDataSync.videoName')}
                                        value={name}
                                        disabled={disabled}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </Grid>
                            )}
                            {threeSubtitleTrackSelectors}
                            {!hideRememberTrackPreferenceToggle && (
                                <Grid item>
                                    <LabelWithHoverEffect
                                        control={
                                            <Switch
                                                checked={shouldRememberTrackChoices}
                                                onChange={handleRememberTrackChoices}
                                                color="primary"
                                            />
                                        }
                                        label={t('extension.videoDataSync.rememberTrackPreference')}
                                        labelPlacement="start"
                                        style={{
                                            display: 'flex',
                                            marginLeft: 'auto',
                                            marginRight: '-13px',
                                            width: 'fit-content',
                                        }}
                                    />
                                </Grid>
                            )}
                        </Grid>
                    </form>
                </DialogContent>
                <DialogActions>
                    <Button disabled={disabled} onClick={() => handleOpenFile()}>
                        {t('action.openFiles')}
                    </Button>
                    <Button disabled={disabled} onClick={() => handleOpenOnline(undefined)}>
                        {t('onlineSubtitleSources.searchOnlineSubtitles')}
                    </Button>
                    <Button
                        action={okActionRef}
                        disabled={(!hideVideoNameTextField && !trimmedName) || disabled}
                        onClick={handleOkButtonClick}
                    >
                        {t('action.ok')}
                    </Button>
                </DialogActions>
            </Dialog>
            <OnlineSubtitleSourceDialog
                open={onlineDialogOpen}
                onClose={handleOnlineDialogClose}
                onImport={handleImportOnlineFile}
                detectedTitleHint={detectedTitleHint}
                jimakuApiKey={onlineSubtitleSourceConfig.jimakuApiKey}
                onJimakuApiKeyChange={(jimakuApiKey) =>
                    onOnlineSourceConfigChanged({
                        jimakuApiKey,
                        jimakuRecentWorks: [],
                    })
                }
                jimakuSearchCategory={onlineSubtitleSourceConfig.jimakuSearchCategory}
                onJimakuSearchCategoryChange={(jimakuSearchCategory) =>
                    onOnlineSourceConfigChanged({ jimakuSearchCategory })
                }
                jimakuRecentWorks={onlineSubtitleSourceConfig.jimakuRecentWorks ?? []}
                onJimakuRecentWorksChange={(jimakuRecentWorks) => onOnlineSourceConfigChanged({ jimakuRecentWorks })}
            />
        </>
    );
}
