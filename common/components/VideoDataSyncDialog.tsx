import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import SubtitlesOutlinedIcon from '@mui/icons-material/SubtitlesOutlined';
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
import type { ConfirmedVideoDataSubtitleTrack, VideoDataSubtitleTrack } from '@project/common';
import { VideoDataUiOpenReason } from '@project/common';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MiniProfileSelector from '@project/common/components/MiniProfileSelector';
import type { Profile } from '@project/common/settings';
import Alert from '@mui/material/Alert';
import type { ButtonBaseActions } from '@mui/material/ButtonBase';
import type { GenericParseType, OnlineSubtitleSourceConfig } from '@project/common/global-state';
import OnlineSubtitleSourceDialog from '@project/common/components/OnlineSubtitleSourceDialog';
import type { TFunction } from 'i18next';
import type { FileSelector, FileWithId } from '@project/common/file-selector';
import { AUDIO_EXT_SET, VIDEO_EXT_SET, getExtension } from '@project/common/app/services/media-sources';

const downloadedSubtitleIdPattern = /^https?:/;

const isFileSubtitle = (subtitle: VideoDataSubtitleTrack) =>
    subtitle.file !== undefined || downloadedSubtitleIdPattern.test(subtitle.id);

const subtitleTrackIcon = (subtitle: VideoDataSubtitleTrack) => {
    if (subtitle.embedded) return MovieOutlinedIcon;
    if (downloadedSubtitleIdPattern.test(subtitle.id)) return CloudOutlinedIcon;
    if (subtitle.url) return SubtitlesOutlinedIcon;
    return DescriptionOutlinedIcon;
};

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
function calculateVideoName(baseName: string, label: string, fileSubtitle: boolean) {
    if (baseName === '' && label) {
        return label;
    }

    if (label && !baseName.includes(label) && !fileSubtitle) {
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

export const useVideoDataSyncDialogState = (files?: FileWithId[]) => {
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
    const openSubtitleTrackSelectorWithFiles = useCallback(
        (candidates?: FileWithId[]) => {
            if (candidates !== undefined) {
                const loadedTracks = new Map<string, VideoDataSubtitleTrack>();
                for (const { file, id, embedded } of candidates) {
                    if (id === '-') continue;
                    loadedTracks.set(id, {
                        id,
                        embedded,
                        label: file.name,
                        file,
                        extension: file.name.substring(file.name.lastIndexOf('.') + 1),
                    });
                }
                // A zero-byte SRT preserves empty slots without making confirmation fetch the "-" URL.
                setSubtitleTrackSelectorTracks([
                    { ...emptySubtitleTrack(t), file: new File([''], '.srt') },
                    ...loadedTracks.values(),
                ]);
                setSubtitleTrackSelectorSelectedTrackIds(
                    initialTrackIds.map((_, index) => candidates[index]?.id ?? '-')
                );
            }
            setSubtitleTrackSelectorOpen(true);
        },
        [t]
    );
    const openSubtitleTrackSelector = useCallback(
        () => openSubtitleTrackSelectorWithFiles(files),
        [files, openSubtitleTrackSelectorWithFiles]
    );
    const closeSubtitleTrackSelector = useCallback(() => setSubtitleTrackSelectorOpen(false), []);

    return {
        subtitleTrackSelectorOpen,
        openSubtitleTrackSelector,
        openSubtitleTrackSelectorWithFiles,
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
    discovering?: boolean;
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
    clientId: string;
    hasSeenFtue?: boolean;
    hideRememberTrackPreferenceToggle?: boolean;
    hideVideoNameTextField?: boolean;
    isGenericPage?: boolean;
    showGenericPageOption?: boolean;
    genericSubtitleParser?: GenericParseType;
    fileSelector: FileSelector;
    onCancel: () => void;
    onOpenSettings: () => void;
    onConfirm: (track: ConfirmedVideoDataSubtitleTrack[], shouldRememberTrackChoices: boolean) => void;
    onSetActiveProfile: (profile: string | undefined) => void;
    onOnlineSourceConfigChanged: (state: Partial<OnlineSubtitleSourceConfig>) => void;
    onDismissFtue: () => void;
    onGenericSubtitleParserChange?: (parse: GenericParseType) => void;
    onOpenFiles: (files: FileWithId[]) => void;
    onSubtitleTracks: (tracks: VideoDataSubtitleTrack[]) => void;
    onSelectedSubtitleTrackIds: (trackIds: string[]) => void;
}

export default function VideoDataSyncDialog({
    open,
    disabled,
    isLoading,
    discovering,
    suggestedName,
    subtitleTracks,
    selectedSubtitleTrackIds,
    defaultCheckboxState,
    error,
    openReason,
    profiles,
    activeProfile,
    onlineSubtitleSourceConfig,
    clientId,
    hasSeenFtue,
    hideRememberTrackPreferenceToggle,
    hideVideoNameTextField,
    isGenericPage,
    showGenericPageOption,
    genericSubtitleParser,
    fileSelector,
    onCancel,
    onOpenSettings,
    onConfirm,
    onSetActiveProfile,
    onOnlineSourceConfigChanged,
    onDismissFtue,
    onGenericSubtitleParserChange,
    onOpenFiles,
    onSubtitleTracks,
    onSelectedSubtitleTrackIds,
}: Props) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [shouldRememberTrackChoices, setShouldRememberTrackChoices] = useState(false);
    const [genericSubtitleParserChanged, setGenericSubtitleParserChanged] = useState(false);
    const trimmedName = name.trim();
    const classes = createClasses();

    useEffect(() => {
        if (open) {
            setShouldRememberTrackChoices(defaultCheckboxState);
        }
    }, [open, defaultCheckboxState]);

    useEffect(() => {
        if (open) setGenericSubtitleParserChanged(false);
    }, [open]);

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
                        name === calculateVideoName(suggestedName, track.label, isFileSubtitle(track))
                )
            ) {
                const selectedTrack = subtitleTracks.find((track) => track.id === selectedSubtitleTrackIds[0]);

                if (selectedTrack === undefined || selectedTrack.url === '-') {
                    return suggestedName;
                }

                return calculateVideoName(suggestedName, selectedTrack.label, isFileSubtitle(selectedTrack));
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

    function handleGenericSubtitleParserChange(parse: GenericParseType) {
        onGenericSubtitleParserChange?.(parse);
        setGenericSubtitleParserChanged(true);
    }

    function allSelectedSubtitleTracks() {
        const selectedSubtitleTracks: ConfirmedVideoDataSubtitleTrack[] = selectedSubtitleTrackIds
            .map((selected): ConfirmedVideoDataSubtitleTrack | undefined => {
                const subtitle = subtitleTracks.find((subtitle) => subtitle.id === selected);
                if (subtitle) {
                    const { file, label } = subtitle;
                    if (subtitle.disabledReason) return undefined;
                    const fileName = file?.name ?? label;
                    const trackName = isFileSubtitle(subtitle)
                        ? // Confirmed names omit the extension; download consumers add it back.
                          fileName.substring(0, fileName.lastIndexOf('.'))
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
                                if (e.target.value === undefined) return;
                                const newSelectedSubtitles = [...selectedSubtitleTrackIds];
                                newSelectedSubtitles[i] = e.target.value;
                                onSelectedSubtitleTrackIds(newSelectedSubtitles);
                                setFocusOkAfterFileSelection(true);
                            }}
                        >
                            {[
                                ...subtitleTracks.filter((track) => !track.embedded),
                                ...subtitleTracks.filter((track) => track.embedded),
                            ].map((subtitle) => {
                                const Icon = subtitleTrackIcon(subtitle);
                                return (
                                    <MenuItem
                                        value={subtitle.id}
                                        key={subtitle.id}
                                        disabled={!!subtitle.disabledReason}
                                    >
                                        {subtitle.id !== '-' && (
                                            <Icon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                                        )}
                                        {subtitle.label}
                                        {subtitle.disabledReason ? ` — ${subtitle.disabledReason}` : ''}
                                    </MenuItem>
                                );
                            })}
                            <MenuItem onClick={() => handleOpenFile(i)}>{t('action.openFiles')}</MenuItem>
                            <MenuItem onClick={() => handleOpenOnline(i)}>
                                {t('onlineSubtitleSources.searchOnlineSubtitles')}
                            </MenuItem>
                        </TextField>
                        {(isLoading || discovering) && (
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
    const [focusOkAfterFileSelection, setFocusOkAfterFileSelection] = useState(false);

    useEffect(() => {
        if (!open) {
            setFocusOkAfterFileSelection(false);
            return;
        }

        if (
            (hideVideoNameTextField || trimmedName) &&
            (focusOkAfterFileSelection || !videoNameRef.current?.contains(document.activeElement)) &&
            !disabled
        ) {
            okActionRef.current?.focusVisible();
            setFocusOkAfterFileSelection(false);
        }
    }, [open, trimmedName, disabled, hideVideoNameTextField, focusOkAfterFileSelection]);

    const [fileInputTrackNumber, setFileInputTrackNumber] = useState<number>();
    const [onlineDialogOpen, setOnlineDialogOpen] = useState(false);
    const [onlineDialogTrackNumber, setOnlineDialogTrackNumber] = useState<number>();
    const detectedTitleHint = useMemo(() => suggestedName.trim(), [suggestedName]);

    useEffect(() => {
        return fileSelector.onFilesSelected((files) => {
            if (!files || files.length === 0) {
                return;
            }

            setFocusOkAfterFileSelection(true);

            if (
                fileInputTrackNumber === undefined ||
                files.some(({ file }) => {
                    const extension = getExtension(file.name);
                    return VIDEO_EXT_SET.has(extension) || AUDIO_EXT_SET.has(extension);
                })
            ) {
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
                                        onChange={(e) => {
                                            setFocusOkAfterFileSelection(false);
                                            setName(e.target.value);
                                        }}
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
                            {showGenericPageOption && (
                                <>
                                    <Grid item>
                                        <LabelWithHoverEffect
                                            control={
                                                <Switch
                                                    checked={genericSubtitleParser !== 'off'}
                                                    disabled={genericSubtitleParser === 'aggressive'}
                                                    onChange={(event) =>
                                                        handleGenericSubtitleParserChange(
                                                            event.target.checked ? 'base' : 'off'
                                                        )
                                                    }
                                                    color="primary"
                                                />
                                            }
                                            label={t('extension.videoDataSync.genericPage')}
                                            labelPlacement="start"
                                            style={{
                                                display: 'flex',
                                                marginLeft: 'auto',
                                                marginRight: '-13px',
                                                width: 'fit-content',
                                            }}
                                        />
                                    </Grid>
                                    {genericSubtitleParser !== 'off' && (
                                        <Grid item>
                                            <LabelWithHoverEffect
                                                control={
                                                    <Switch
                                                        checked={genericSubtitleParser === 'aggressive'}
                                                        onChange={(event) =>
                                                            handleGenericSubtitleParserChange(
                                                                event.target.checked ? 'aggressive' : 'base'
                                                            )
                                                        }
                                                        color="primary"
                                                    />
                                                }
                                                label={t('extension.videoDataSync.aggressiveGenericPage')}
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
                                    <Grid item>
                                        <Alert
                                            severity={
                                                genericSubtitleParserChanged || !isGenericPage ? 'info' : 'warning'
                                            }
                                        >
                                            {genericSubtitleParserChanged
                                                ? t('info.refreshForChangesToTakeEffect')
                                                : t(
                                                      isGenericPage
                                                          ? 'extension.videoDataSync.genericPageWarning'
                                                          : 'extension.videoDataSync.genericPageInfo'
                                                  )}
                                        </Alert>
                                    </Grid>
                                </>
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
                        disabled={
                            (!hideVideoNameTextField && !trimmedName) ||
                            disabled ||
                            selectedSubtitleTrackIds.some(
                                (id) => !subtitleTracks.some((track) => track.id === id && !track.disabledReason)
                            )
                        }
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
                clientId={clientId}
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
                jimakuEpisodeRegex={onlineSubtitleSourceConfig.jimakuEpisodeRegex ?? ''}
                onJimakuEpisodeRegexChange={(jimakuEpisodeRegex) => onOnlineSourceConfigChanged({ jimakuEpisodeRegex })}
            />
        </>
    );
}
