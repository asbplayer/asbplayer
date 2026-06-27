import { AsbplayerSettings, KeyBindName, TokenStatus } from '../settings';
import { useTranslation } from 'react-i18next';
import { isMacOs } from 'react-device-detect';
import { makeStyles, useTheme } from '@mui/styles';
import { type Theme } from '@mui/material';
import { useOutsideClickListener } from '@project/common/hooks';
import hotkeys from 'hotkeys-js';
import Grid2 from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Switch from '@mui/material/Switch';
import EditIcon from '@mui/icons-material/Edit';
import SettingsTextField from './SettingsTextField';
import { isFirefox } from '../browser-detection';
import React, { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import KeyBindRelatedSetting from './KeyBindRelatedSetting';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import { AutoPausePreference } from '..';

type AllKeyNames = KeyBindName | 'selectSubtitleTrack';

interface KeyBindProperties {
    label: string;
    boundViaBrowser: boolean;
    hide?: boolean;
    additionalControl?: React.ReactNode;
}

// hotkeys only returns strings for a Mac while requiring the OS-specific keys for the actual binds
const modifierKeyReplacements: { [key: string]: string } = isMacOs
    ? {}
    : {
          '⌃': 'ctrl',
          '⇧': 'shift',
          '⌥': 'alt',
      };

const modifierKeys = ['⌃', '⇧', '⌥', 'ctrl', 'shift', 'alt', 'option', 'control', 'command', '⌘'];

const useKeyBindFieldStyles = makeStyles<Theme>((theme) => ({
    container: {
        marginBottom: theme.spacing(1),
    },
    labelItem: {
        marginTop: theme.spacing(1),
    },
}));

interface KeyBindFieldProps {
    label: string;
    keys: string;
    boundViaChrome: boolean;
    onKeysChange: (keys: string) => void;
    onOpenExtensionShortcuts: () => void;
}

function KeyBindField({ label, keys, boundViaChrome, onKeysChange, onOpenExtensionShortcuts }: KeyBindFieldProps) {
    const { t } = useTranslation();
    const theme = useTheme<Theme>();
    const classes = useKeyBindFieldStyles();
    const [currentKeyString, setCurrentKeyString] = useState<string>(keys);
    const currentKeyStringRef = useRef<string>(undefined);
    currentKeyStringRef.current = currentKeyString;
    const onKeysChangeRef = useRef<(keys: string) => void>(undefined);
    onKeysChangeRef.current = onKeysChange;
    const [editing, setEditing] = useState<boolean>(false);

    useEffect(() => setCurrentKeyString(keys), [keys]);

    const handleEditKeyBinding = useCallback(
        (event: React.MouseEvent) => {
            if (event.nativeEvent.detail === 0) {
                return;
            }

            if (boundViaChrome) {
                onOpenExtensionShortcuts();
                return;
            }

            setCurrentKeyString('');
            setEditing(true);
        },
        [onOpenExtensionShortcuts, boundViaChrome]
    );

    const ref = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!editing) {
            return;
        }

        const handler = (event: KeyboardEvent) => {
            if (event.type === 'keydown') {
                // The ts declaration is missing getPressedKeyString()
                // @ts-ignore
                const pressed = hotkeys.getPressedKeyString() as string[];
                setCurrentKeyString(
                    pressed
                        .map((key) => {
                            return modifierKeyReplacements[key] ?? key;
                        })
                        .sort((a, b) => {
                            const isAModifier = modifierKeys.includes(a);
                            const isBModifier = modifierKeys.includes(b);

                            if (isAModifier && !isBModifier) {
                                return -1;
                            }

                            if (!isAModifier && isBModifier) {
                                return 1;
                            }

                            return 0;
                        })
                        .join('+')
                );
            } else if (event.type === 'keyup') {
                setEditing(false);

                // Need to use refs because hotkeys returns the wrong keys
                // if the handler is bound/unbound.
                if (currentKeyStringRef.current) {
                    onKeysChangeRef.current!(currentKeyStringRef.current);
                }
            }
        };

        hotkeys('*', { keyup: true }, handler);
        return () => hotkeys.unbind('*', handler);
    }, [editing]);

    useOutsideClickListener(
        ref,
        useCallback(() => {
            if (editing) {
                setEditing(false);
                setCurrentKeyString('');
                onKeysChange('');
            }
        }, [editing, onKeysChange])
    );

    let placeholder: string;

    if (editing) {
        placeholder = t('settings.recordingBind');
    } else if (boundViaChrome) {
        placeholder = t('settings.extensionOverriddenBind');
    } else {
        placeholder = t('settings.unboundBind');
    }

    const firefoxExtensionShortcut = isFirefox && boundViaChrome;

    return (
        <Grid2 container className={classes.container} wrap={'nowrap'} spacing={1}>
            <Grid2
                sx={{ '&:hover': { background: theme.palette.action.hover }, p: 1 }}
                container
                direction="row"
                size={12}
            >
                <Grid2 className={classes.labelItem} size={7.5}>
                    <Typography>{label}</Typography>
                </Grid2>
                <Grid2 size="grow">
                    <SettingsTextField
                        placeholder={placeholder}
                        size="small"
                        contentEditable={false}
                        disabled={boundViaChrome}
                        helperText={boundViaChrome ? t('settings.extensionShortcut') : undefined}
                        value={currentKeyString}
                        title={currentKeyString}
                        color="primary"
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <InputAdornment position="end">
                                        {!firefoxExtensionShortcut && (
                                            <IconButton
                                                ref={ref}
                                                sx={{ marginRight: -1 }}
                                                onClick={handleEditKeyBinding}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                        {firefoxExtensionShortcut && (
                                            <Tooltip title={t('settings.firefoxExtensionShortcutHelp')!}>
                                                <span>
                                                    <IconButton disabled={true}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        )}
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />
                </Grid2>
            </Grid2>
        </Grid2>
    );
}

interface Props {
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    chromeKeyBinds: { [key: string]: string | undefined };
    extensionInstalled?: boolean;
    extensionSupportsExportCardBind?: boolean;
    extensionSupportsSidePanel?: boolean;
    onOpenChromeExtensionShortcuts: () => void;
}

const KeyboardShortcutsSettingsTab: React.FC<Props> = ({
    settings,
    onSettingChanged,
    chromeKeyBinds,
    extensionInstalled,
    extensionSupportsExportCardBind,
    extensionSupportsSidePanel,
    onOpenChromeExtensionShortcuts,
}) => {
    const { t } = useTranslation();
    const {
        autoPausePreference,
        fastForwardModePlaybackRate,
        seekDuration,
        alwaysPlayOnSubtitleRepeat,
        speedChangeStep,
        keyBindSet,
    } = settings;
    const keyBindProperties = useMemo<{ [key in AllKeyNames]: KeyBindProperties }>(
        () => ({
            copySubtitle: { label: t('binds.copySubtitle')!, boundViaBrowser: true },
            ankiExport: { label: t('binds.ankiExport')!, boundViaBrowser: true },
            updateLastCard: {
                label: t('binds.updateLastCard')!,
                boundViaBrowser: true,
            },
            updateSelectedCard: {
                label: t('binds.updateSelectedCard')!,
                boundViaBrowser: true,
            },
            exportCard: {
                label: t('binds.exportCard')!,
                boundViaBrowser: true,
                hide: extensionInstalled && !extensionSupportsExportCardBind,
            },
            takeScreenshot: {
                label: t('binds.takeScreenshot')!,
                boundViaBrowser: true,
            },
            toggleRecording: {
                label: t('binds.extensionToggleRecording')!,
                boundViaBrowser: true,
            },
            selectSubtitleTrack: {
                label: t('binds.extensionSelectSubtitleTrack')!,
                boundViaBrowser: true,
                hide: !extensionInstalled,
            },
            toggleSidePanel: {
                label: t('binds.toggleSidePanel')!,
                boundViaBrowser: isFirefox,
                hide: !extensionInstalled || !extensionSupportsSidePanel,
            },
            togglePlay: { label: t('binds.togglePlay')!, boundViaBrowser: false },
            toggleAutoPause: {
                label: t('binds.toggleAutoPause')!,
                boundViaBrowser: false,
                additionalControl: (
                    <KeyBindRelatedSetting
                        label={t('settings.autoPausePreference')}
                        control={
                            <Grid2>
                                <RadioGroup row>
                                    <LabelWithHoverEffect
                                        control={
                                            <Radio
                                                checked={autoPausePreference === AutoPausePreference.atStart}
                                                value={AutoPausePreference.atStart}
                                                onChange={(event) =>
                                                    event.target.checked &&
                                                    onSettingChanged('autoPausePreference', AutoPausePreference.atStart)
                                                }
                                            />
                                        }
                                        label={t('settings.autoPauseAtSubtitleStart')}
                                    />
                                    <LabelWithHoverEffect
                                        control={
                                            <Radio
                                                checked={autoPausePreference === AutoPausePreference.atEnd}
                                                value={AutoPausePreference.atEnd}
                                                onChange={(event) =>
                                                    event.target.checked &&
                                                    onSettingChanged('autoPausePreference', AutoPausePreference.atEnd)
                                                }
                                            />
                                        }
                                        label={t('settings.autoPauseAtSubtitleEnd')}
                                    />
                                </RadioGroup>
                            </Grid2>
                        }
                    />
                ),
            },
            toggleCondensedPlayback: { label: t('binds.toggleCondensedPlayback')!, boundViaBrowser: false },
            toggleFastForwardPlayback: {
                label: t('binds.toggleFastForwardPlayback')!,
                boundViaBrowser: false,
                additionalControl: (
                    <KeyBindRelatedSetting
                        label={t('settings.fastForwardModePlaybackRate')}
                        control={
                            <SettingsTextField
                                type="number"
                                fullWidth
                                value={fastForwardModePlaybackRate}
                                color="primary"
                                onChange={(event) =>
                                    onSettingChanged('fastForwardModePlaybackRate', Number(event.target.value))
                                }
                                slotProps={{
                                    htmlInput: {
                                        min: 0.1,
                                        max: 5,
                                        step: 0.1,
                                    },
                                }}
                            />
                        }
                    />
                ),
            },
            toggleRepeat: { label: t('binds.toggleRepeat')!, boundViaBrowser: false },
            toggleSubtitles: { label: t('binds.toggleSubtitles')!, boundViaBrowser: false },
            toggleVideoSubtitleTrack1: { label: t('binds.toggleVideoSubtitleTrack1')!, boundViaBrowser: false },
            toggleVideoSubtitleTrack2: { label: t('binds.toggleVideoSubtitleTrack2')!, boundViaBrowser: false },
            toggleVideoSubtitleTrack3: { label: t('binds.toggleVideoSubtitleTrack3')!, boundViaBrowser: false },
            toggleAsbplayerSubtitleTrack1: {
                label: t('binds.toggleAsbplayerSubtitleTrack1')!,
                boundViaBrowser: false,
            },
            toggleAsbplayerSubtitleTrack2: {
                label: t('binds.toggleAsbplayerSubtitleTrack2')!,
                boundViaBrowser: false,
            },
            toggleAsbplayerSubtitleTrack3: {
                label: t('binds.toggleAsbplayerSubtitleTrack3')!,
                boundViaBrowser: false,
            },
            unblurAsbplayerTrack1: {
                label: t('binds.unblurAsbplayerTrack', { trackNumber: 1 })!,
                boundViaBrowser: false,
            },
            unblurAsbplayerTrack2: {
                label: t('binds.unblurAsbplayerTrack', { trackNumber: 2 })!,
                boundViaBrowser: false,
            },
            unblurAsbplayerTrack3: {
                label: t('binds.unblurAsbplayerTrack', { trackNumber: 3 })!,
                boundViaBrowser: false,
            },
            seekBackward: { label: t('binds.seekBackward')!, boundViaBrowser: false },
            seekForward: {
                label: t('binds.seekForward')!,
                boundViaBrowser: false,
                additionalControl: (
                    <KeyBindRelatedSetting
                        label={t('settings.seekDuration')}
                        control={
                            <SettingsTextField
                                type="number"
                                size="small"
                                fullWidth
                                value={seekDuration}
                                color="primary"
                                onChange={(event) => onSettingChanged('seekDuration', Number(event.target.value))}
                                slotProps={{
                                    htmlInput: {
                                        min: 1,
                                        max: 60,
                                        step: 1,
                                    },
                                }}
                            />
                        }
                    />
                ),
            },
            seekToPreviousSubtitle: { label: t('binds.seekToPreviousSubtitle')!, boundViaBrowser: false },
            seekToNextSubtitle: { label: t('binds.seekToNextSubtitle')!, boundViaBrowser: false },
            seekToBeginningOfCurrentSubtitle: {
                label: t('binds.seekToBeginningOfCurrentOrPreviousSubtitle')!,
                boundViaBrowser: false,
                additionalControl: (
                    <KeyBindRelatedSetting
                        label={t('settings.alwaysPlayOnSubtitleRepeat')}
                        control={
                            <Switch
                                checked={alwaysPlayOnSubtitleRepeat}
                                onChange={(event) =>
                                    onSettingChanged('alwaysPlayOnSubtitleRepeat', event.target.checked)
                                }
                            />
                        }
                    />
                ),
            },
            adjustOffsetToPreviousSubtitle: {
                label: t('binds.adjustOffsetToPreviousSubtitle')!,
                boundViaBrowser: false,
            },
            adjustOffsetToNextSubtitle: {
                label: t('binds.adjustOffsetToNextSubtitle')!,
                boundViaBrowser: false,
            },
            increaseOffset: { label: t('binds.increaseOffset')!, boundViaBrowser: false },
            decreaseOffset: { label: t('binds.decreaseOffset')!, boundViaBrowser: false },
            resetOffset: { label: t('binds.resetOffset')!, boundViaBrowser: false },
            increasePlaybackRate: { label: t('binds.increasePlaybackRate')!, boundViaBrowser: false },
            decreasePlaybackRate: {
                label: t('binds.decreasePlaybackRate')!,
                boundViaBrowser: false,
                additionalControl: (
                    <KeyBindRelatedSetting
                        label={t('settings.speedChangeStep')}
                        control={
                            <SettingsTextField
                                type="number"
                                fullWidth
                                value={speedChangeStep}
                                color="primary"
                                onChange={(event) => onSettingChanged('speedChangeStep', Number(event.target.value))}
                                slotProps={{
                                    htmlInput: {
                                        min: 0.1,
                                        max: 1,
                                        step: 0.1,
                                    },
                                }}
                            />
                        }
                    />
                ),
            },
            moveBottomSubtitlesUp: {
                label: t('binds.moveBottomSubtitlesUp')!,
                boundViaBrowser: false,
            },
            moveBottomSubtitlesDown: {
                label: t('binds.moveBottomSubtitlesDown')!,
                boundViaBrowser: false,
            },
            moveTopSubtitlesUp: {
                label: t('binds.moveTopSubtitlesUp')!,
                boundViaBrowser: false,
            },
            moveTopSubtitlesDown: {
                label: t('binds.moveTopSubtitlesDown')!,
                boundViaBrowser: false,
            },
            markHoveredToken5: {
                label: t('binds.markHoveredToken', { tokenStatus: t('settings.dictionaryTokenStatus5') })!,
                boundViaBrowser: false,
            },
            markHoveredToken4: {
                label: t('binds.markHoveredToken', { tokenStatus: t('settings.dictionaryTokenStatus4') })!,
                boundViaBrowser: false,
            },
            markHoveredToken3: {
                label: t('binds.markHoveredToken', { tokenStatus: t('settings.dictionaryTokenStatus3') })!,
                boundViaBrowser: false,
            },
            markHoveredToken2: {
                label: t('binds.markHoveredToken', { tokenStatus: t('settings.dictionaryTokenStatus2') })!,
                boundViaBrowser: false,
            },
            markHoveredToken1: {
                label: t('binds.markHoveredToken', { tokenStatus: t('settings.dictionaryTokenStatus1') })!,
                boundViaBrowser: false,
            },
            markHoveredToken0: {
                label: t('binds.markHoveredToken', { tokenStatus: t('settings.dictionaryTokenStatus0') })!,
                boundViaBrowser: false,
            },
            toggleHoveredTokenIgnored: {
                label: t('binds.toggleHoveredTokenIgnored')!,
                boundViaBrowser: false,
            },
            openStatistics: {
                label: t('binds.openStatistics')!,
                boundViaBrowser: false,
            },
        }),
        [
            t,
            extensionInstalled,
            extensionSupportsSidePanel,
            extensionSupportsExportCardBind,
            onSettingChanged,
            seekDuration,
            alwaysPlayOnSubtitleRepeat,
            autoPausePreference,
            speedChangeStep,
            fastForwardModePlaybackRate,
        ]
    );

    const handleKeysChange = useCallback(
        (keys: string, keyBindName: KeyBindName) => {
            onSettingChanged('keyBindSet', { ...settings.keyBindSet, [keyBindName]: { keys } });
        },
        [settings.keyBindSet, onSettingChanged]
    );

    return Object.keys(keyBindProperties).map((key) => {
        const keyBindName = key as KeyBindName;
        const properties = keyBindProperties[keyBindName];

        if (properties.hide) {
            return null;
        }

        return (
            <div key={key}>
                <KeyBindField
                    key={key}
                    label={properties.label}
                    keys={
                        extensionInstalled && properties.boundViaBrowser
                            ? (chromeKeyBinds[keyBindName] ?? '')
                            : keyBindSet[keyBindName].keys
                    }
                    boundViaChrome={Boolean(extensionInstalled) && properties.boundViaBrowser}
                    onKeysChange={(keys) => handleKeysChange(keys, keyBindName)}
                    onOpenExtensionShortcuts={onOpenChromeExtensionShortcuts}
                />
                {properties.additionalControl}
            </div>
        );
    });
};

export default KeyboardShortcutsSettingsTab;
