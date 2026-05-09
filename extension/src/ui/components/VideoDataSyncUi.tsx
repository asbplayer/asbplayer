import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import VideoDataSyncDialog from './VideoDataSyncDialog';
import Bridge from '../bridge';
import {
    ConfirmedVideoDataSubtitleTrack,
    Message,
    SerializedSubtitleFile,
    UpdateStateMessage,
    VideoDataSubtitleTrack,
    VideoDataUiBridgeConfirmMessage,
    VideoDataUiBridgeOpenFileMessage,
    VideoDataUiBridgeSetOnlineSubtitleSourceConfigMessage,
    VideoDataUiModel,
    VideoDataUiOpenReason,
    ActiveProfileMessage,
} from '@project/common';
import type { OnlineSubtitleSourceConfig } from '@project/common/global-state';
import { createTheme } from '@project/common/theme';
import { type PaletteMode } from '@mui/material/styles';
import { bufferToBase64 } from '@project/common/base64';
import { useTranslation } from 'react-i18next';
import type { Profile } from '@project/common/settings';
import { StyledEngineProvider } from '@mui/material/styles';
import OnlineSubtitleSourceDialog from './OnlineSubtitleSourceDialog';

interface Props {
    bridge: Bridge;
}

const initialTrackIds = ['-', '-', '-'];

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

const detectOnlineSubtitleTitleHint = (suggestedName: string) => {
    const normalizedSuggestedName = suggestedName.trim();

    if (normalizedSuggestedName.length > 0) {
        return normalizedSuggestedName;
    }

    if (typeof document === 'undefined') {
        return '';
    }

    return document.title.trim();
};

export default function VideoDataSyncUi({ bridge }: Props) {
    const { t } = useTranslation();
    const [open, setOpen] = useState<boolean>(false);
    const [disabled, setDisabled] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [suggestedName, setSuggestedName] = useState<string>('');
    const [showSubSelect, setShowSubSelect] = useState<boolean>(true);
    const [subtitles, setSubtitles] = useState<VideoDataSubtitleTrack[]>([
        { id: '-', language: '-', url: '-', label: t('extension.videoDataSync.emptySubtitleTrack'), extension: 'srt' },
    ]);
    const [selectedSubtitleTrackIds, setSelectedSubtitleTrackIds] = useState<string[]>(initialTrackIds);
    const [defaultCheckboxState, setDefaultCheckboxState] = useState<boolean>(false);
    const [openReason, setOpenReason] = useState<VideoDataUiOpenReason>(VideoDataUiOpenReason.userRequested);
    const [openedFromAsbplayerId, setOpenedFromAsbplayerId] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [themeType, setThemeType] = useState<string>();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [activeProfile, setActiveProfile] = useState<string>();
    const [fileInputTrackNumber, setFileInputTrackNumber] = useState<number>();
    const [hasSeenFtue, setHasSeenFtue] = useState<boolean>();
    const [hideRememberTrackPreferenceToggle, setHideRememberTrackPreferenceToggle] = useState<boolean>();
    const [onlineSubtitleSourceConfig, setOnlineSubtitleSourceConfig] = useState<OnlineSubtitleSourceConfig>({
        jimakuApiKey: '',
    });
    const [onlineDialogOpen, setOnlineDialogOpen] = useState(false);
    const [onlineDialogTrackNumber, setOnlineDialogTrackNumber] = useState<number>();
    const detectedTitleHint = useMemo(() => detectOnlineSubtitleTitleHint(suggestedName), [suggestedName]);
    // Tracks blob URLs created here so we only revoke URLs owned by this component.
    const trackedLocalObjectUrlsRef = useRef(new Set<string>());
    // Previous render's local blob URLs to detect removed/replaced tracks.
    const previousLocalObjectUrlsRef = useRef(new Set<string>());

    const theme = useMemo(() => createTheme((themeType || 'dark') as PaletteMode), [themeType]);

    const handleOpenSettings = useCallback(() => {
        bridge.sendMessageFromServer({ command: 'openSettings' });
    }, [bridge]);
    const handleCancel = useCallback(() => {
        setOpen(false);
        bridge.sendMessageFromServer({ command: 'cancel' });
    }, [bridge]);
    const handleConfirm = useCallback(
        (data: ConfirmedVideoDataSubtitleTrack[], shouldRememberTrackChoices: boolean) => {
            setOpen(false);
            const message: VideoDataUiBridgeConfirmMessage = {
                command: 'confirm',
                data,
                shouldRememberTrackChoices,
                syncWithAsbplayerId: openedFromAsbplayerId.length > 0 ? openedFromAsbplayerId : undefined,
            };
            bridge.sendMessageFromServer(message);
        },
        [bridge, openedFromAsbplayerId]
    );

    useEffect(() => {
        bridge.addClientMessageListener((message: Message) => {
            if (message.command !== 'updateState') {
                return;
            }

            const model = (message as UpdateStateMessage).state as VideoDataUiModel;

            if (model.open !== undefined) {
                setOpen(model.open);
            }

            if (model.isLoading !== undefined) {
                setIsLoading(model.isLoading);
            }

            if (model.suggestedName !== undefined) {
                setSuggestedName(model.suggestedName);
            }

            if (model.showSubSelect !== undefined) {
                setShowSubSelect(model.showSubSelect);
            }

            if (model.subtitles !== undefined) {
                const newSubtitles = [
                    {
                        id: '-',
                        language: '-',
                        url: '-',
                        label: t('extension.videoDataSync.emptySubtitleTrack'),
                        extension: 'srt',
                    },
                    ...model.subtitles,
                ];
                setSelectedSubtitleTrackIds((currentSelectedTrackIds) => {
                    return currentSelectedTrackIds.map((currentSelectedTrackId) => {
                        const stillSelected = newSubtitles.find((t) => t.id === currentSelectedTrackId);

                        if (stillSelected) {
                            return currentSelectedTrackId;
                        }

                        return '-';
                    });
                });
                setSubtitles(newSubtitles);
            }

            if (model.selectedSubtitle !== undefined) {
                setSelectedSubtitleTrackIds(model.selectedSubtitle);
            }

            if (model.defaultCheckboxState !== undefined) {
                setDefaultCheckboxState(model.defaultCheckboxState);
            }

            if (model.error !== undefined) {
                setError(model.error);
            }

            if (model.openReason !== undefined) {
                setOpenReason(model.openReason);
            }

            if (model.openedFromAsbplayerId !== undefined) {
                setOpenedFromAsbplayerId(model.openedFromAsbplayerId);
            }

            if (model.settings !== undefined) {
                setThemeType(model.settings.themeType);
                setProfiles(model.settings.profiles);
                setActiveProfile(model.settings.activeProfile);
            }

            if (model.hasSeenFtue !== undefined) {
                setHasSeenFtue(model.hasSeenFtue);
            }

            if (model.hideRememberTrackPreferenceToggle !== undefined) {
                setHideRememberTrackPreferenceToggle(model.hideRememberTrackPreferenceToggle);
            }

            if (model.onlineSubtitleSourceConfig !== undefined) {
                setOnlineSubtitleSourceConfig(model.onlineSubtitleSourceConfig);
            }
        });
    }, [bridge, t]);

    useEffect(() => bridge.serverIsReady(), [bridge]);

    useEffect(() => {
        // Revoke tracked blob URLs once they are no longer referenced by subtitle tracks.
        const currentLocalObjectUrls = new Set(
            subtitles
                .filter(
                    (track) =>
                        track.localFile === true && typeof track.url === 'string' && track.url.startsWith('blob:')
                )
                .map((track) => track.url as string)
        );

        for (const trackedUrl of previousLocalObjectUrlsRef.current) {
            if (!currentLocalObjectUrls.has(trackedUrl) && trackedLocalObjectUrlsRef.current.has(trackedUrl)) {
                URL.revokeObjectURL(trackedUrl);
                trackedLocalObjectUrlsRef.current.delete(trackedUrl);
            }
        }

        previousLocalObjectUrlsRef.current = currentLocalObjectUrls;
    }, [subtitles]);

    useEffect(
        () => () => {
            // Safety net for cancel/close/navigation paths where sync never consumes these URLs.
            for (const url of trackedLocalObjectUrlsRef.current) {
                URL.revokeObjectURL(url);
            }

            trackedLocalObjectUrlsRef.current.clear();
            previousLocalObjectUrlsRef.current.clear();
        },
        []
    );

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileInputChange = useCallback(async () => {
        const files = fileInputRef.current?.files;

        if (files && files.length > 0) {
            try {
                setDisabled(true);

                if (fileInputTrackNumber === undefined) {
                    const subtitles: SerializedSubtitleFile[] = [];

                    for (let i = 0; i < files.length; ++i) {
                        const f = files[i];
                        const base64 = await bufferToBase64(await f.arrayBuffer());

                        subtitles.push({
                            name: f.name,
                            base64: base64,
                        });
                    }

                    setOpen(false);
                    const message: VideoDataUiBridgeOpenFileMessage = { command: 'openFile', subtitles };
                    bridge.sendMessageFromServer(message);
                } else {
                    const fileTracks: VideoDataSubtitleTrack[] = [...files].map((f) => {
                        const url = URL.createObjectURL(f);
                        trackedLocalObjectUrlsRef.current.add(url);
                        const extension = f.name.substring(f.name.lastIndexOf('.') + 1, f.name.length);
                        return {
                            label: f.name,
                            id: url,
                            url,
                            extension,
                            localFile: true,
                        };
                    });

                    if (fileTracks.length > 0) {
                        setSubtitles((s) => [...s, ...fileTracks]);
                        setSelectedSubtitleTrackIds((s) => {
                            const selectedIdsByTrackNumber = [...s];
                            selectedIdsByTrackNumber[fileInputTrackNumber] = fileTracks[0].id;
                            return selectedIdsByTrackNumber;
                        });
                    }
                }
            } finally {
                setDisabled(false);

                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        }
    }, [bridge, fileInputTrackNumber]);

    const handleOpenFile = useCallback((track?: number) => {
        setFileInputTrackNumber(track);
        fileInputRef.current?.click();
    }, []);

    const handleOpenOnline = useCallback((track?: number) => {
        setOnlineDialogTrackNumber(track);
        setOnlineDialogOpen(true);
    }, []);

    const handleOnlineDialogClose = useCallback(() => {
        setOnlineDialogOpen(false);
    }, []);

    const handleImportOnlineFile = useCallback(
        async ({ name, url }: { name: string; url: string }) => {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Subtitle retrieval failed with status ${response.status} (${response.statusText}).`);
            }

            const blob = await response.blob();
            const { normalizedName, extension } = normalizeOnlineSubtitleFileName(name, url);
            const file = new File([blob], normalizedName);
            const objectUrl = URL.createObjectURL(file);
            trackedLocalObjectUrlsRef.current.add(objectUrl);
            const track = {
                label: normalizedName,
                id: objectUrl,
                url: objectUrl,
                extension,
                localFile: true,
            };

            setSubtitles((s) => [...s, track]);
            setSelectedSubtitleTrackIds((s) => {
                const next = [...s];

                if (onlineDialogTrackNumber !== undefined) {
                    next[onlineDialogTrackNumber] = track.id;
                } else {
                    const firstEmptyIndex = next.findIndex((id) => id === '-');
                    if (firstEmptyIndex >= 0) {
                        next[firstEmptyIndex] = track.id;
                    } else {
                        next[0] = track.id;
                    }
                }

                return next;
            });
        },
        [onlineDialogTrackNumber]
    );

    const handleSetActiveProfile = useCallback(
        (profile: string | undefined) => {
            const message: ActiveProfileMessage = { command: 'activeProfile', profile: profile };
            bridge.sendMessageFromServer(message);
        },
        [bridge]
    );

    const handleDismissFtue = useCallback(() => {
        setHasSeenFtue(true);
        bridge.sendMessageFromServer({ command: 'dismissFtue' });
    }, [bridge]);
    const handleOnlineSubtitleSourceConfigChanged = useCallback(
        (state: Partial<OnlineSubtitleSourceConfig>) => {
            setOnlineSubtitleSourceConfig((current) => ({ ...current, ...state }));
            const message: VideoDataUiBridgeSetOnlineSubtitleSourceConfigMessage = {
                command: 'setOnlineSubtitleSourceConfig',
                state,
            };
            bridge.sendMessageFromServer(message);
        },
        [bridge]
    );

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <VideoDataSyncDialog
                    open={open}
                    disabled={disabled}
                    isLoading={isLoading}
                    suggestedName={suggestedName}
                    showSubSelect={showSubSelect}
                    subtitleTracks={subtitles}
                    selectedSubtitleTrackIds={selectedSubtitleTrackIds}
                    defaultCheckboxState={defaultCheckboxState}
                    openReason={openReason}
                    error={error}
                    profiles={profiles}
                    activeProfile={activeProfile}
                    hasSeenFtue={hasSeenFtue}
                    hideRememberTrackPreferenceToggle={hideRememberTrackPreferenceToggle}
                    onCancel={handleCancel}
                    onOpenFile={handleOpenFile}
                    onOpenOnline={handleOpenOnline}
                    onOpenSettings={handleOpenSettings}
                    onConfirm={handleConfirm}
                    onSetActiveProfile={handleSetActiveProfile}
                    onDismissFtue={handleDismissFtue}
                />
                <OnlineSubtitleSourceDialog
                    open={onlineDialogOpen}
                    onClose={handleOnlineDialogClose}
                    onImport={handleImportOnlineFile}
                    detectedTitleHint={detectedTitleHint}
                    jimakuApiKey={onlineSubtitleSourceConfig.jimakuApiKey}
                    onJimakuApiKeyChange={(jimakuApiKey) => handleOnlineSubtitleSourceConfigChanged({ jimakuApiKey })}
                />
                <input
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    type="file"
                    accept=".srt,.ass,.vtt,.sup,.dfxp,.ttml2"
                    multiple
                    hidden
                />
            </ThemeProvider>
        </StyledEngineProvider>
    );
}
