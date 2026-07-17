import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import VideoDataSyncDialog, {
    useVideoDataSyncDialogState,
    emptySubtitleTrack,
} from '@project/common/components/VideoDataSyncDialog';
import Bridge from '../bridge';
import {
    ConfirmedVideoDataSubtitleTrack,
    Message,
    SerializedSubtitleFile,
    UpdateStateMessage,
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
import { DefaultFileSelector, FileWithId } from '@project/common/file-selector';

interface Props {
    bridge: Bridge;
}

export default function VideoDataSyncUi({ bridge }: Props) {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [suggestedName, setSuggestedName] = useState<string>('');
    const [defaultCheckboxState, setDefaultCheckboxState] = useState<boolean>(false);
    const [openReason, setOpenReason] = useState<VideoDataUiOpenReason>(VideoDataUiOpenReason.userRequested);
    const [openedFromAsbplayerId, setOpenedFromAsbplayerId] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [themeType, setThemeType] = useState<string>();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [activeProfile, setActiveProfile] = useState<string>();
    const [hasSeenFtue, setHasSeenFtue] = useState<boolean>();
    const [hideRememberTrackPreferenceToggle, setHideRememberTrackPreferenceToggle] = useState<boolean>();
    const [onlineSubtitleSourceConfig, setOnlineSubtitleSourceConfig] = useState<OnlineSubtitleSourceConfig>({
        jimakuApiKey: '',
        jimakuSearchCategory: 'anime',
    });
    const trackedLocalObjectUrlsRef = useRef(new Set<string>());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileSelector = useMemo<DefaultFileSelector>(
        () => new DefaultFileSelector(() => fileInputRef.current?.click()),
        []
    );

    const handleFileInputChange = useCallback(() => {
        const files = fileInputRef.current?.files;

        if (files && files.length > 0) {
            fileSelector.publishFiles([...files].map((file) => ({ file, id: uuidv4() })));
        }
    }, [fileSelector]);

    const {
        subtitleTrackSelectorOpen,
        openSubtitleTrackSelector,
        closeSubtitleTrackSelector,
        subtitleTrackSelectorSelectedTrackIds,
        setSubtitleTrackSelectorSelectedTrackIds,
        subtitleTrackSelectorTracks,
        setSubtitleTrackSelectorTracks,
        subtitleTrackSelectorDisabled,
        setSubtitleTrackSelectorDisabled,
    } = useVideoDataSyncDialogState();

    const theme = useMemo(() => createTheme((themeType || 'dark') as PaletteMode), [themeType]);

    const handleOpenSettings = useCallback(() => {
        bridge.sendMessageFromServer({ command: 'openSettings' });
    }, [bridge]);
    const handleCancel = useCallback(() => {
        closeSubtitleTrackSelector();
        bridge.sendMessageFromServer({ command: 'cancel' });
    }, [bridge, closeSubtitleTrackSelector]);
    const handleConfirm = useCallback(
        (data: ConfirmedVideoDataSubtitleTrack[], shouldRememberTrackChoices: boolean) => {
            closeSubtitleTrackSelector();

            // Create blob URLs for content script to consume and track them so we can revoke later.
            for (const t of data) {
                if (t.file !== undefined) {
                    if (t.url === undefined) {
                        t.url = URL.createObjectURL(t.file);
                        trackedLocalObjectUrlsRef.current.add(t.url);
                    }
                }
            }

            const message: VideoDataUiBridgeConfirmMessage = {
                command: 'confirm',
                data,
                shouldRememberTrackChoices,
                syncWithAsbplayerId: openedFromAsbplayerId.length > 0 ? openedFromAsbplayerId : undefined,
            };
            bridge.sendMessageFromServer(message);
        },
        [bridge, closeSubtitleTrackSelector, openedFromAsbplayerId]
    );

    useEffect(() => {
        bridge.addClientMessageListener((message: Message) => {
            if (message.command !== 'updateState') {
                return;
            }

            const model = (message as UpdateStateMessage).state as VideoDataUiModel;

            if (model.open !== undefined) {
                if (model.open) {
                    openSubtitleTrackSelector();
                } else {
                    closeSubtitleTrackSelector();
                }
            }

            if (model.isLoading !== undefined) {
                setIsLoading(model.isLoading);
            }

            if (model.suggestedName !== undefined) {
                setSuggestedName(model.suggestedName);
            }

            if (model.subtitles !== undefined) {
                const newSubtitles = [emptySubtitleTrack(t), ...model.subtitles];
                setSubtitleTrackSelectorSelectedTrackIds((currentSelectedTrackIds) => {
                    return currentSelectedTrackIds.map((currentSelectedTrackId) => {
                        const stillSelected = newSubtitles.find((t) => t.id === currentSelectedTrackId);

                        if (stillSelected) {
                            return currentSelectedTrackId;
                        }

                        return '-';
                    });
                });
                setSubtitleTrackSelectorTracks(newSubtitles);
            }

            if (model.selectedSubtitle !== undefined) {
                setSubtitleTrackSelectorSelectedTrackIds(model.selectedSubtitle);
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
    }, [
        bridge,
        openSubtitleTrackSelector,
        closeSubtitleTrackSelector,
        setSubtitleTrackSelectorTracks,
        setSubtitleTrackSelectorSelectedTrackIds,
        t,
    ]);

    useEffect(() => bridge.serverIsReady(), [bridge]);

    useEffect(() => {
        // Revoke tracked blob URLs once they are no longer referenced by subtitle tracks.
        const currentObjectUrlsByTrackId = new Map<string, string>();
        for (const t of subtitleTrackSelectorTracks) {
            if (t.file !== undefined && typeof t.url === 'string') {
                currentObjectUrlsByTrackId.set(t.id, t.url);
            }
        }

        for (const [trackId, trackedUrl] of trackedLocalObjectUrlsRef.current.entries()) {
            const trackIsNoLongerReferenced = !currentObjectUrlsByTrackId.has(trackId);
            if (trackIsNoLongerReferenced && trackedLocalObjectUrlsRef.current.has(trackedUrl)) {
                URL.revokeObjectURL(trackedUrl);
                trackedLocalObjectUrlsRef.current.delete(trackedUrl);
            }
        }
    }, [subtitleTrackSelectorTracks]);

    useEffect(
        () => () => {
            // Safety net for cancel/close/navigation paths where sync never consumes these URLs.
            for (const url of trackedLocalObjectUrlsRef.current) {
                URL.revokeObjectURL(url);
            }

            trackedLocalObjectUrlsRef.current.clear();
        },
        []
    );

    const handleOpenFiles = useCallback(
        async (files: FileWithId[]) => {
            setSubtitleTrackSelectorDisabled(true);

            try {
                const subtitles: SerializedSubtitleFile[] = [];

                for (let i = 0; i < files.length; ++i) {
                    const f = files[i].file;
                    const base64 = bufferToBase64(await f.arrayBuffer());

                    subtitles.push({
                        name: f.name,
                        base64: base64,
                    });
                }

                closeSubtitleTrackSelector();
                const message: VideoDataUiBridgeOpenFileMessage = { command: 'openFile', subtitles };
                bridge.sendMessageFromServer(message);
            } finally {
                setSubtitleTrackSelectorDisabled(false);
            }
        },
        [bridge, setSubtitleTrackSelectorDisabled, closeSubtitleTrackSelector]
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
                    open={subtitleTrackSelectorOpen}
                    disabled={subtitleTrackSelectorDisabled}
                    isLoading={isLoading}
                    suggestedName={suggestedName || document.title}
                    subtitleTracks={subtitleTrackSelectorTracks}
                    onSubtitleTracks={setSubtitleTrackSelectorTracks}
                    selectedSubtitleTrackIds={subtitleTrackSelectorSelectedTrackIds}
                    onSelectedSubtitleTrackIds={setSubtitleTrackSelectorSelectedTrackIds}
                    defaultCheckboxState={defaultCheckboxState}
                    openReason={openReason}
                    error={error}
                    profiles={profiles}
                    activeProfile={activeProfile}
                    onlineSubtitleSourceConfig={onlineSubtitleSourceConfig}
                    hasSeenFtue={hasSeenFtue}
                    hideRememberTrackPreferenceToggle={hideRememberTrackPreferenceToggle}
                    fileSelector={fileSelector}
                    onCancel={handleCancel}
                    onOpenFiles={handleOpenFiles}
                    onOpenSettings={handleOpenSettings}
                    onOnlineSourceConfigChanged={handleOnlineSubtitleSourceConfigChanged}
                    onConfirm={handleConfirm}
                    onSetActiveProfile={handleSetActiveProfile}
                    onDismissFtue={handleDismissFtue}
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
