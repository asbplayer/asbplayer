import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    MediaFragmentModel,
    AudioModel,
    SubtitleModel,
    AnkiUiState,
    AnkiUiResumeState,
    AnkiUiSavedState,
    AnkiUiBridgeRerecordMessage,
    AnkiUiBridgeResumeMessage,
    AnkiUiBridgeRewindMessage,
    CopyToClipboardMessage,
    Message,
    UpdateStateMessage,
    FileModel,
    EncodeMp3Message,
    AnkiDialogSettingsMessage,
    ActiveProfileMessage,
    AnkiDialogSettings,
    AnkiUiBridgeExportedMessage,
    AnkiDialogDismissedQuickSelectFtueMessage,
    CardUpdatedDialogMessage,
    CardExportedDialogMessage,
} from '@project/common';
import { createTheme } from '@project/common/theme';
import type { Profile } from '@project/common/settings';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import Alert, { AlertColor } from '@mui/material/Alert';
import CssBaseline from '@mui/material/CssBaseline';
import AnkiDialog from '@project/common/components/AnkiDialog';
import Snackbar from '@mui/material/Snackbar';
import Bridge from '../bridge';
import type { PaletteMode } from '@mui/material/styles';
import { AnkiDialogState } from '@project/common/components/AnkiDialog';
import { BridgeFetcher } from '../bridge-fetcher';
import { Anki, ExportParams } from '@project/common/anki';
import { v4 as uuidv4 } from 'uuid';
import { base64ToBlob, blobToBase64 } from '@project/common/base64';
import { isMobile } from '@project/common/device-detection/mobile';
import { StyledEngineProvider } from '@mui/material/styles';

interface Props {
    bridge: Bridge;
}

const blobToDataUrl = async (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
        var reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as string);
        };
        reader.readAsDataURL(blob);
    });
};

export default function AnkiUi({ bridge }: Props) {
    const [open, setOpen] = useState<boolean>(false);
    const [disabled, setDisabled] = useState<boolean>(false);
    const [canRerecord, setCanRerecord] = useState<boolean>(false);
    const [subtitle, setSubtitle] = useState<SubtitleModel>();
    const [surroundingSubtitles, setSurroundingSubtitles] = useState<SubtitleModel[]>();
    const [text, setText] = useState<string>();
    const [serializedAudio, setSerializedAudio] = useState<AudioModel>();
    const [serializedImage, setSerializedImage] = useState<MediaFragmentModel>();
    const [file, setFile] = useState<FileModel>();
    const [source, setSource] = useState<string>('');
    const [url, setUrl] = useState<string>('');
    const [definition, setDefinition] = useState('');
    const [word, setWord] = useState('');
    const [customFieldValues, setCustomFieldValues] = useState<{ [key: string]: string }>({});
    const [initialTimestampInterval, setInitialTimestampInterval] = useState<number[]>();
    const [timestampInterval, setTimestampInterval] = useState<number[]>();
    const [timestampBoundaryInterval, setTimestampBoundaryInterval] = useState<number[]>();
    const [lastAppliedTimestampIntervalToText, setLastAppliedTimestampIntervalToText] = useState<number[]>();
    const [lastAppliedTimestampIntervalToAudio, setLastAppliedTimestampIntervalToAudio] = useState<number[]>();
    const [settings, setSettings] = useState<AnkiDialogSettings>();
    const [alertSeverity, setAlertSeverity] = useState<AlertColor>('error');
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alert, setAlert] = useState<string>('');
    const [dialogRequestedTimestamp, setDialogRequestedTimestamp] = useState<number>(0);
    const [profiles, setProfiles] = useState<Profile[]>();
    const [activeProfile, setActiveProfile] = useState<string>();
    const [ftueHasSeenAnkiDialogQuickSelect, setFtueHasSeenAnkiDialogQuickSelect] = useState<boolean>();
    const [inTutorial, setInTutorial] = useState<boolean>(false);

    const theme = useMemo(() => createTheme((settings?.themeType ?? 'dark') as PaletteMode), [settings?.themeType]);
    const anki = useMemo(
        () => (settings ? new Anki(settings, new BridgeFetcher(bridge)) : undefined),
        [settings, bridge]
    );
    const dialogStateRef = useRef<AnkiDialogState>(undefined);

    const savedState = useCallback(() => {
        const dialogState = dialogStateRef.current!;
        const savedState: AnkiUiSavedState = {
            subtitle: subtitle!,
            text: dialogState.text,
            surroundingSubtitles: dialogState.surroundingSubtitles,
            definition: dialogState.definition,
            image: serializedImage,
            audio: serializedAudio,
            file,
            word: dialogState.word,
            source: dialogState.source,
            url: dialogState.url,
            customFieldValues: dialogState.customFieldValues,
            initialTimestampInterval: dialogState.initialTimestampInterval!,
            timestampInterval: dialogState.timestampInterval!,
            timestampBoundaryInterval: dialogState.timestampBoundaryInterval,
            lastAppliedTimestampIntervalToText: dialogState.lastAppliedTimestampIntervalToText!,
            lastAppliedTimestampIntervalToAudio: dialogState.lastAppliedTimestampIntervalToAudio,
            dialogRequestedTimestamp: dialogRequestedTimestamp,
        };
        return savedState;
    }, [subtitle, serializedImage, serializedAudio, file, dialogRequestedTimestamp]);

    useEffect(() => {
        return bridge.addClientMessageListener((message: Message) => {
            if (message.command !== 'updateState') {
                return;
            }

            const s = (message as UpdateStateMessage).state as AnkiUiState;

            if (s.type === 'initial') {
                setTimestampInterval((s.audio?.start && s.audio?.end && [s.audio.start, s.audio.end]) || undefined);
                setTimestampBoundaryInterval(undefined);
                setInitialTimestampInterval(undefined);
                setLastAppliedTimestampIntervalToText(undefined);
                setLastAppliedTimestampIntervalToAudio(undefined);
            } else if (s.type === 'resume') {
                const state = s as AnkiUiResumeState;
                setInitialTimestampInterval(state.initialTimestampInterval);
                setTimestampInterval(state.timestampInterval);
                setTimestampBoundaryInterval(state.timestampBoundaryInterval);
                setLastAppliedTimestampIntervalToText(state.lastAppliedTimestampIntervalToText);
                setLastAppliedTimestampIntervalToAudio(state.lastAppliedTimestampIntervalToAudio);
            }

            setText(s.text);
            setDefinition(s.definition ?? '');
            setWord(s.word ?? '');
            setCustomFieldValues(s.customFieldValues ?? {});
            setCanRerecord(s.canRerecord);
            setSubtitle(s.subtitle);
            setSurroundingSubtitles(s.surroundingSubtitles);
            setSource(s.source);
            setUrl(s.url ?? '');
            setDialogRequestedTimestamp(s.dialogRequestedTimestamp);
            setSerializedAudio(s.audio);
            setSerializedImage(s.image);
            setFile(s.file);
            setDisabled(false);
            setSettings(s.settings);
            setActiveProfile(s.activeProfile);
            setProfiles(s.profiles);
            setOpen(s.open);
            setFtueHasSeenAnkiDialogQuickSelect(s.ftueHasSeenAnkiDialogQuickSelect);
            setInTutorial(s.inTutorial);
        });
    }, [bridge]);

    useEffect(() => bridge.serverIsReady(), [bridge]);

    const handleProceed = useCallback(
        async (params: ExportParams) => {
            setDisabled(true);

            try {
                await anki!.export(params);

                const message: AnkiUiBridgeExportedMessage = {
                    command: 'exported',
                    mode: params.mode,
                };
                bridge.sendMessageFromServer(message);

                if (params.mode !== 'gui') {
                    setOpen(false);
                    const message: AnkiUiBridgeResumeMessage = {
                        command: 'resume',
                        uiState: savedState(),
                        cardExported: true,
                    };
                    bridge.sendMessageFromServer(message);
                }

                if (params.mode === 'updateLast') {
                    bridge.sendMessageFromServer({ command: 'card-updated-dialog' } as CardUpdatedDialogMessage);
                } else if (params.mode === 'default') {
                    bridge.sendMessageFromServer({ command: 'card-exported-dialog' } as CardExportedDialogMessage);
                }
            } catch (e) {
                console.error(e);
                setAlertSeverity('error');

                if (e instanceof Error) {
                    setAlert((e as Error).message);
                } else {
                    setAlert(String(e));
                }

                setAlertOpen(true);
            } finally {
                setDisabled(false);
            }
        },
        [anki, bridge, savedState]
    );

    const handleCancel = useCallback(() => {
        setOpen(false);
        const message: AnkiUiBridgeResumeMessage = { command: 'resume', uiState: savedState(), cardExported: false };
        bridge.sendMessageFromServer(message);
    }, [bridge, savedState]);

    const handleRewind = useCallback(() => {
        setOpen(false);
        const message: AnkiUiBridgeRewindMessage = { command: 'rewind', uiState: savedState() };
        bridge.sendMessageFromServer(message);
    }, [bridge, savedState]);

    const handleRerecord = useCallback(() => {
        setOpen(false);

        const state = savedState();
        const message: AnkiUiBridgeRerecordMessage = {
            command: 'rerecord',
            uiState: state,
            recordStart: state.timestampInterval![0],
            recordEnd: state.timestampInterval![1],
        };

        bridge.sendMessageFromServer(message);
    }, [bridge, savedState]);

    const handleOpenSettings = useCallback(() => {
        bridge.sendMessageFromServer({ command: 'openSettings' });
    }, [bridge]);

    const handleSetActiveProfile = useCallback(
        (profile: string | undefined) => {
            const message: ActiveProfileMessage = { command: 'activeProfile', profile: profile };
            bridge.sendMessageFromServer(message);
        },
        [bridge]
    );

    const handleDismissShowQuickSelectFtue = useCallback(() => {
        setFtueHasSeenAnkiDialogQuickSelect(true);
        const message: AnkiDialogDismissedQuickSelectFtueMessage = {
            command: 'dismissedQuickSelectFtue',
        };
        bridge.sendMessageFromServer(message);
    }, [bridge]);

    const lastFocusOutRef = useRef<HTMLElement>(undefined);

    const handleFocusOut = useCallback((event: FocusEvent) => {
        if (event.target instanceof HTMLElement) {
            lastFocusOutRef.current = event.target;
        }
    }, []);

    const handleCopyToClipboard = useCallback(
        async (blob: Blob) => {
            const message: CopyToClipboardMessage = {
                command: 'copy-to-clipboard',
                dataUrl: await blobToDataUrl(blob),
            };
            bridge.sendMessageFromServer(message);
        },
        [bridge]
    );

    useEffect(() => {
        return bridge.addClientMessageListener((message) => {
            if (message.command === 'focus') {
                lastFocusOutRef.current?.focus();
            } else if (message.command === 'settings') {
                const settingsMessage = message as AnkiDialogSettingsMessage;
                setSettings(settingsMessage.settings);
                setProfiles(settingsMessage.profiles);
                setActiveProfile(settingsMessage.activeProfile);
            } else if (message.command === 'rewind') {
                handleRewind();
            }
        });
    }, [bridge, handleRewind]);

    useEffect(() => {
        if (open) {
            window.removeEventListener('focusout', handleFocusOut);
            window.addEventListener('focusout', handleFocusOut);
        } else {
            window.removeEventListener('focusout', handleFocusOut);
        }
    }, [open, handleFocusOut]);

    const card = useMemo(() => {
        if (!subtitle || !surroundingSubtitles) {
            return undefined;
        }

        return {
            subtitle,
            surroundingSubtitles,
            url,
            audio: serializedAudio,
            image: serializedImage,
            file,
            subtitleFileName: source,
            mediaTimestamp: serializedAudio?.start ?? subtitle.start,
            text,
            word,
            definition,
            customFieldValues,
        };
    }, [
        file,
        source,
        subtitle,
        surroundingSubtitles,
        url,
        serializedImage,
        serializedAudio,
        text,
        word,
        definition,
        customFieldValues,
    ]);

    const mp3Encoder = useCallback(
        async (blob: Blob, extension: string) => {
            const encodeMp3Message: EncodeMp3Message = {
                command: 'encode-mp3',
                base64: await blobToBase64(blob),
                extension,
                messageId: uuidv4(),
            };
            const { base64 } = await bridge.sendMessageFromServerAndExpectResponse(encodeMp3Message, 60_000);
            return await base64ToBlob(base64, 'audio/mp3');
        },
        [bridge]
    );

    const showAnkiDialogQuickSelectFtue = !isMobile && ftueHasSeenAnkiDialogQuickSelect === false;

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Snackbar
                    anchorOrigin={{ horizontal: 'center', vertical: 'top' }}
                    open={alertOpen}
                    autoHideDuration={5000}
                    onClose={() => setAlertOpen(false)}
                >
                    <Alert onClose={() => setAlertOpen(false)} severity={alertSeverity}>
                        {alert}
                    </Alert>
                </Snackbar>
                {settings && card && anki && (
                    <AnkiDialog
                        open={open}
                        disabled={disabled}
                        card={card}
                        settings={settings}
                        profiles={profiles}
                        activeProfile={activeProfile}
                        onSetActiveProfile={handleSetActiveProfile}
                        anki={anki}
                        onProceed={handleProceed}
                        onRerecord={canRerecord ? handleRerecord : undefined}
                        onCancel={handleCancel}
                        onOpenSettings={handleOpenSettings}
                        onCopyToClipboard={handleCopyToClipboard}
                        source={source}
                        initialTimestampInterval={initialTimestampInterval}
                        timestampBoundaryInterval={timestampBoundaryInterval}
                        timestampInterval={timestampInterval}
                        lastAppliedTimestampIntervalToText={lastAppliedTimestampIntervalToText}
                        lastAppliedTimestampIntervalToAudio={lastAppliedTimestampIntervalToAudio}
                        showQuickSelectFtue={showAnkiDialogQuickSelectFtue}
                        onDismissShowQuickSelectFtue={handleDismissShowQuickSelectFtue}
                        stateRef={dialogStateRef}
                        mp3Encoder={mp3Encoder}
                        lastSelectedExportMode={settings.lastSelectedAnkiExportMode}
                        inTutorial={inTutorial}
                    />
                )}
            </ThemeProvider>
        </StyledEngineProvider>
    );
}
