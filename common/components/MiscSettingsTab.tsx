import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Checkbox from '@mui/material/Checkbox';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import SettingsTextField from './SettingsTextField';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import {
    AsbplayerSettings,
    autoPausePreferenceForCheckboxChange,
    exportSettings,
    isTrackAutoCopyable,
    isTrackSeekable,
    PauseOnHoverMode,
    updateAutoCopyableTracksValue,
    updateSeekableTracksValue,
    validateSettings,
} from '../settings';
import { Trans, useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AutoPausePreference, SubtitleHtml } from '..';
import { WebSocketClient } from '../web-socket-client';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsSection, { SettingsSubSection } from './SettingsSection';
import { VideoSubtitleSplitBehavior } from '../settings';

function regexIsValid(regex: string) {
    try {
        new RegExp(regex.trim());
        return true;
    } catch {
        return false;
    }
}

const responsiveSettingsStackSx = {
    flexWrap: 'wrap',
    '& > *': {
        flex: '1 1 280px',
        minWidth: 'min(100%, 280px)',
    },
} as const;

interface Props {
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    supportedLanguages: string[];
    insideApp?: boolean;
    extensionInstalled?: boolean;
    extensionSupportsPauseOnHover?: boolean;
    extensionSupportsSeekableTrackSetting?: boolean;
    extensionSupportsAutoCopyableTrackSetting?: boolean;
    supportsPlaybackEngine: boolean;
    onViewPlaybackModeKeyboardShortcuts: () => void;
}

const MiscSettingTab: React.FC<Props> = ({
    settings,
    onSettingChanged,
    onSettingsChanged,
    supportedLanguages,
    insideApp,
    extensionInstalled,
    extensionSupportsPauseOnHover,
    extensionSupportsSeekableTrackSetting,
    extensionSupportsAutoCopyableTrackSetting,
    supportsPlaybackEngine,
    onViewPlaybackModeKeyboardShortcuts,
}) => {
    const { t } = useTranslation();
    const {
        themeType,
        videoSubtitleSplitBehavior,
        language,
        rememberSubtitleOffset,
        autoCopyCurrentSubtitle,
        seekableTracks,
        autoCopyableTracks,
        miningHistoryStorageLimit,
        subtitleRegexFilter,
        tabName,
        subtitleRegexFilterTextReplacement,
        subtitleHtml,
        convertNetflixRuby,
        pauseOnHoverMode,
        webSocketClientEnabled,
        webSocketServerUrl,
        subtitleAboveThumbnail,
        thumbnailPreview,
        autoPausePreference,
        playbackModeStartOffset,
        playbackModeEndOffset,
        playbackModesStartGap,
        playbackModesEndGap,
        playbackRate,
        playbackRateNotificationEnabled,
        rememberPlaybackRate,
        fastForwardModePlaybackRate,
        fastForwardPlaybackMinimumSkipIntervalMs,
        repeatCountPreference,
        rememberPlaybackModes,
        streamingCondensedPlaybackMinimumSkipIntervalMs,
    } = settings;
    const autoPauseAtStart = autoPausePreference !== AutoPausePreference.atEnd;
    const autoPauseAtEnd = autoPausePreference !== AutoPausePreference.atStart;
    const handleAutoPausePreferenceChanged = useCallback(
        (edge: AutoPausePreference.atStart | AutoPausePreference.atEnd, checked: boolean) => {
            void onSettingChanged(
                'autoPausePreference',
                autoPausePreferenceForCheckboxChange(autoPausePreference, edge, checked)
            );
        },
        [autoPausePreference, onSettingChanged]
    );
    const validRegex = useMemo(() => regexIsValid(subtitleRegexFilter), [subtitleRegexFilter]);
    const [webSocketConnectionSucceeded, setWebSocketConnectionSucceeded] = useState<boolean>();
    const pingWebSocketServer = useCallback(() => {
        const client = new WebSocketClient();
        client
            .bind(webSocketServerUrl)
            .then(() => client.ping())
            .then(() => setWebSocketConnectionSucceeded(true))
            .catch((e) => {
                console.error(e);
                setWebSocketConnectionSucceeded(false);
            })
            .finally(() => client.unbind());
    }, [webSocketServerUrl]);
    useEffect(() => {
        if (webSocketClientEnabled && webSocketServerUrl) {
            pingWebSocketServer();
        }
    }, [pingWebSocketServer, webSocketClientEnabled, webSocketServerUrl]);

    let webSocketServerUrlHelperText: string | null | undefined = undefined;

    if (webSocketClientEnabled) {
        if (webSocketConnectionSucceeded) {
            webSocketServerUrlHelperText = t('info.connectionSucceeded');
        } else if (webSocketConnectionSucceeded === false) {
            webSocketServerUrlHelperText = t('info.connectionFailed');
        }
    }

    const settingsFileInputRef = useRef<HTMLInputElement>(null);
    const handleSettingsFileInputChange = useCallback(async () => {
        try {
            const file = settingsFileInputRef.current?.files?.[0];

            if (file === undefined) {
                return;
            }

            const importedSettings = JSON.parse(await file.text());
            const validatedSettings = validateSettings(importedSettings);
            onSettingsChanged(validatedSettings);
        } catch (e) {
            console.error(e);
        }
    }, [onSettingsChanged]);

    const handleImportSettings = useCallback(() => {
        settingsFileInputRef.current?.click();
    }, []);
    const handleExportSettings = useCallback(() => {
        exportSettings(settings);
    }, [settings]);

    return (
        <>
            <Stack spacing={1}>
                <SettingsSection>{t('settings.ui')}</SettingsSection>
                <Stack direction="row" spacing={1}>
                    <Button variant="contained" color="primary" style={{ flex: 1 }} onClick={handleImportSettings}>
                        {t('action.importSettings')}
                    </Button>
                    <Button variant="contained" color="primary" style={{ flex: 1 }} onClick={handleExportSettings}>
                        {t('action.exportSettings')}
                    </Button>
                </Stack>
                <FormControl>
                    <FormLabel>{t('settings.theme')}</FormLabel>
                    <RadioGroup row>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={themeType === 'light'}
                                    value="light"
                                    onChange={(event) =>
                                        event.target.checked && void onSettingChanged('themeType', 'light')
                                    }
                                />
                            }
                            label={t('settings.themeLight')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={themeType === 'dark'}
                                    value="dark"
                                    onChange={(event) =>
                                        event.target.checked && void onSettingChanged('themeType', 'dark')
                                    }
                                />
                            }
                            label={t('settings.themeDark')}
                        />
                    </RadioGroup>
                </FormControl>
                <SettingsTextField
                    select
                    label={t('settings.language')}
                    value={language}
                    color="primary"
                    onChange={(event) => onSettingChanged('language', event.target.value)}
                >
                    {supportedLanguages.map((s) => (
                        <MenuItem key={s} value={s}>
                            {s}
                        </MenuItem>
                    ))}
                </SettingsTextField>
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={videoSubtitleSplitBehavior === VideoSubtitleSplitBehavior.autoMaximizeVideo}
                            onChange={(event) =>
                                onSettingChanged(
                                    'videoSubtitleSplitBehavior',
                                    event.target.checked
                                        ? VideoSubtitleSplitBehavior.autoMaximizeVideo
                                        : VideoSubtitleSplitBehavior.rememberSplitPosition
                                )
                            }
                        />
                    }
                    label={t('videoSubtitleSplitBehavior.autoMaximizeVideo')}
                    labelPlacement="start"
                />
                <SettingsSection>{t('settings.subtitles')}</SettingsSection>
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={rememberSubtitleOffset}
                            onChange={(event) => onSettingChanged('rememberSubtitleOffset', event.target.checked)}
                        />
                    }
                    label={t('settings.rememberSubtitleOffset')}
                    labelPlacement="start"
                />
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={autoCopyCurrentSubtitle}
                            onChange={(event) => onSettingChanged('autoCopyCurrentSubtitle', event.target.checked)}
                        />
                    }
                    label={t('settings.autoCopy')}
                    labelPlacement="start"
                />
                {(!extensionInstalled || extensionSupportsAutoCopyableTrackSetting) && (
                    <FormControl>
                        <FormLabel component="legend">{t('settings.autoCopyableTracks')}</FormLabel>
                        <FormGroup>
                            {[0, 1, 2].map((trackIndex) => {
                                return (
                                    <FormControlLabel
                                        key={trackIndex}
                                        control={
                                            <Checkbox
                                                checked={isTrackAutoCopyable(autoCopyableTracks, trackIndex)}
                                                onChange={(event) => {
                                                    void onSettingChanged(
                                                        'autoCopyableTracks',
                                                        updateAutoCopyableTracksValue(
                                                            autoCopyableTracks,
                                                            trackIndex,
                                                            event.target.checked
                                                        )
                                                    );
                                                }}
                                            />
                                        }
                                        label={t('settings.subtitleTrackChoice', { trackNumber: trackIndex + 1 })}
                                    />
                                );
                            })}
                        </FormGroup>
                    </FormControl>
                )}
                {(!extensionInstalled || extensionSupportsSeekableTrackSetting) && (
                    <FormControl>
                        <FormLabel component="legend">{t('settings.seekableTracks')}</FormLabel>
                        <FormGroup>
                            {[0, 1, 2].map((trackIndex) => {
                                return (
                                    <FormControlLabel
                                        key={trackIndex}
                                        control={
                                            <Checkbox
                                                checked={isTrackSeekable(seekableTracks, trackIndex)}
                                                onChange={(event) => {
                                                    void onSettingChanged(
                                                        'seekableTracks',
                                                        updateSeekableTracksValue(
                                                            seekableTracks,
                                                            trackIndex,
                                                            event.target.checked
                                                        )
                                                    );
                                                }}
                                            />
                                        }
                                        label={t('settings.subtitleTrackChoice', { trackNumber: trackIndex + 1 })}
                                    />
                                );
                            })}
                        </FormGroup>
                    </FormControl>
                )}
                {insideApp && (
                    <>
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={thumbnailPreview}
                                    onChange={() => onSettingChanged('thumbnailPreview', !thumbnailPreview)}
                                />
                            }
                            label={t('settings.thumbnailPreview')}
                            labelPlacement="start"
                        />
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={subtitleAboveThumbnail}
                                    onChange={() => onSettingChanged('subtitleAboveThumbnail', !subtitleAboveThumbnail)}
                                    disabled={!thumbnailPreview}
                                />
                            }
                            label={t('settings.subtitleAboveThumbnail')}
                            labelPlacement="start"
                        />
                    </>
                )}
                <SettingsTextField
                    label={t('settings.subtitleRegexFilter')}
                    fullWidth
                    value={subtitleRegexFilter}
                    color="primary"
                    error={!validRegex}
                    helperText={validRegex ? undefined : 'Invalid regular expression'}
                    onChange={(event) => onSettingChanged('subtitleRegexFilter', event.target.value)}
                />
                <SettingsTextField
                    label={t('settings.subtitleRegexFilterTextReplacement')}
                    fullWidth
                    value={subtitleRegexFilterTextReplacement}
                    color="primary"
                    onChange={(event) => onSettingChanged('subtitleRegexFilterTextReplacement', event.target.value)}
                />
                <FormControl>
                    <FormLabel>{t('settings.subtitleHtml')}</FormLabel>
                    <RadioGroup row>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={subtitleHtml === SubtitleHtml.remove}
                                    value={SubtitleHtml.remove}
                                    onChange={(event) =>
                                        event.target.checked &&
                                        void onSettingChanged('subtitleHtml', SubtitleHtml.remove)
                                    }
                                />
                            }
                            label={t('settings.subtitleHtmlRemove')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={subtitleHtml === SubtitleHtml.render}
                                    value={SubtitleHtml.render}
                                    onChange={(event) =>
                                        event.target.checked &&
                                        void onSettingChanged('subtitleHtml', SubtitleHtml.render)
                                    }
                                />
                            }
                            label={t('settings.subtitleHtmlRender')}
                        />
                    </RadioGroup>
                </FormControl>
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={convertNetflixRuby}
                            onChange={(event) => onSettingChanged('convertNetflixRuby', event.target.checked)}
                        />
                    }
                    label={t('settings.convertNetflixRuby')}
                    labelPlacement="start"
                />
                {(!extensionInstalled || extensionSupportsPauseOnHover) && (
                    <FormControl>
                        <FormLabel component="legend">{t('settings.pauseOnHoverMode')}</FormLabel>
                        <RadioGroup row={false}>
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={pauseOnHoverMode === PauseOnHoverMode.disabled}
                                        value={PauseOnHoverMode.disabled}
                                        onChange={(event) =>
                                            event.target.checked &&
                                            void onSettingChanged('pauseOnHoverMode', PauseOnHoverMode.disabled)
                                        }
                                    />
                                }
                                label={t('pauseOnHoverMode.disabled')}
                            />
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={pauseOnHoverMode === PauseOnHoverMode.inAndOut}
                                        value={PauseOnHoverMode.inAndOut}
                                        onChange={(event) =>
                                            event.target.checked &&
                                            void onSettingChanged('pauseOnHoverMode', PauseOnHoverMode.inAndOut)
                                        }
                                    />
                                }
                                label={t('pauseOnHoverMode.inAndOut')}
                            />
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={pauseOnHoverMode === PauseOnHoverMode.inNotOut}
                                        value={PauseOnHoverMode.inNotOut}
                                        onChange={(event) =>
                                            event.target.checked &&
                                            void onSettingChanged('pauseOnHoverMode', PauseOnHoverMode.inNotOut)
                                        }
                                    />
                                }
                                label={t('pauseOnHoverMode.inNotOut')}
                            />
                        </RadioGroup>
                    </FormControl>
                )}
                <SettingsSection>{t('settings.playbackModes')}</SettingsSection>
                <Typography variant="caption" color="textSecondary">
                    <Trans
                        i18nKey="settings.playbackModesHelperText"
                        components={[
                            <Link key={0} onClick={onViewPlaybackModeKeyboardShortcuts} sx={{ cursor: 'pointer' }} />,
                        ]}
                    />
                </Typography>
                {supportsPlaybackEngine && (
                    <>
                        <SettingsTextField
                            type="number"
                            fullWidth
                            label={t('settings.playbackRate')}
                            value={playbackRate}
                            color="primary"
                            onChange={(event) => onSettingChanged('playbackRate', Number(event.target.value))}
                            slotProps={{
                                htmlInput: {
                                    min: 0.1,
                                    max: 5,
                                    step: 0.1,
                                },
                            }}
                        />
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={playbackRateNotificationEnabled}
                                    onChange={(event) =>
                                        onSettingChanged('playbackRateNotificationEnabled', event.target.checked)
                                    }
                                />
                            }
                            label={t('settings.playbackRateNotificationEnabled')}
                            labelPlacement="start"
                        />
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={rememberPlaybackRate}
                                    onChange={(event) => onSettingChanged('rememberPlaybackRate', event.target.checked)}
                                />
                            }
                            label={t('settings.rememberPlaybackRate')}
                            labelPlacement="start"
                        />
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={rememberPlaybackModes}
                                    onChange={(event) =>
                                        onSettingChanged('rememberPlaybackModes', event.target.checked)
                                    }
                                />
                            }
                            label={t('settings.rememberPlaybackModes')}
                            labelPlacement="start"
                        />
                    </>
                )}
                <SettingsSubSection>{t('settings.subtitleTriggers')}</SettingsSubSection>
                <FormControl>
                    <FormLabel component="legend">{t('settings.autoPausePreference')}</FormLabel>
                    {supportsPlaybackEngine ? (
                        <>
                            <FormGroup row>
                                <LabelWithHoverEffect
                                    control={
                                        <Checkbox
                                            checked={autoPauseAtStart}
                                            onChange={(event) =>
                                                handleAutoPausePreferenceChanged(
                                                    AutoPausePreference.atStart,
                                                    event.target.checked
                                                )
                                            }
                                        />
                                    }
                                    label={t('settings.autoPauseAtSubtitleStart')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Checkbox
                                            checked={autoPauseAtEnd}
                                            onChange={(event) =>
                                                handleAutoPausePreferenceChanged(
                                                    AutoPausePreference.atEnd,
                                                    event.target.checked
                                                )
                                            }
                                        />
                                    }
                                    label={t('settings.autoPauseAtSubtitleEnd')}
                                />
                            </FormGroup>
                            <Typography variant="caption" color="textSecondary">
                                {t('settings.autoPausePreferenceHelperText')}
                            </Typography>
                        </>
                    ) : (
                        <RadioGroup row>
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={autoPausePreference === AutoPausePreference.atStart}
                                        value={AutoPausePreference.atStart}
                                        onChange={(event) =>
                                            event.target.checked &&
                                            void onSettingChanged('autoPausePreference', AutoPausePreference.atStart)
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
                                            void onSettingChanged('autoPausePreference', AutoPausePreference.atEnd)
                                        }
                                    />
                                }
                                label={t('settings.autoPauseAtSubtitleEnd')}
                            />
                        </RadioGroup>
                    )}
                </FormControl>
                {supportsPlaybackEngine && (
                    <>
                        <SettingsTextField
                            type="number"
                            color="primary"
                            fullWidth
                            label={t('settings.repeatCountPreference')}
                            helperText={t('settings.repeatCountPreferenceHelperText')}
                            value={repeatCountPreference}
                            onChange={(event) => onSettingChanged('repeatCountPreference', Number(event.target.value))}
                            slotProps={{
                                htmlInput: {
                                    min: 0,
                                    step: 1,
                                },
                            }}
                        />
                        <Stack direction="row" spacing={1} useFlexGap sx={responsiveSettingsStackSx}>
                            <SettingsTextField
                                type="number"
                                color="primary"
                                fullWidth
                                label={t('settings.playbackModeStartOffset')}
                                value={playbackModeStartOffset}
                                onChange={(event) =>
                                    onSettingChanged('playbackModeStartOffset', Number(event.target.value))
                                }
                                slotProps={{
                                    htmlInput: {
                                        step: 1,
                                    },
                                    input: {
                                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                    },
                                }}
                            />
                            <SettingsTextField
                                type="number"
                                color="primary"
                                fullWidth
                                label={t('settings.playbackModeEndOffset')}
                                value={playbackModeEndOffset}
                                onChange={(event) =>
                                    onSettingChanged('playbackModeEndOffset', Number(event.target.value))
                                }
                                slotProps={{
                                    htmlInput: {
                                        step: 1,
                                    },
                                    input: {
                                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                    },
                                }}
                            />
                        </Stack>
                        <Typography variant="caption" color="textSecondary">
                            {t('settings.playbackModeOffsetHelperText')}
                        </Typography>
                    </>
                )}
                <SettingsSubSection>{t('settings.gapTriggers')}</SettingsSubSection>
                <Stack direction="row" spacing={1} useFlexGap sx={responsiveSettingsStackSx}>
                    {supportsPlaybackEngine && (
                        <SettingsTextField
                            type="number"
                            color="primary"
                            fullWidth
                            label={t('settings.fastForwardPlaybackMinimumSkipInterval')}
                            value={fastForwardPlaybackMinimumSkipIntervalMs}
                            onChange={(event) =>
                                onSettingChanged('fastForwardPlaybackMinimumSkipIntervalMs', Number(event.target.value))
                            }
                            slotProps={{
                                htmlInput: {
                                    min: 0,
                                    step: 1,
                                },
                                input: {
                                    endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                },
                            }}
                        />
                    )}
                    <SettingsTextField
                        type="number"
                        fullWidth
                        label={t('settings.fastForwardModePlaybackRate')}
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
                </Stack>
                <SettingsTextField
                    type="number"
                    color="primary"
                    fullWidth
                    label={t('settings.condensedPlaybackMinimumSkipInterval')}
                    value={streamingCondensedPlaybackMinimumSkipIntervalMs}
                    onChange={(event) =>
                        onSettingChanged('streamingCondensedPlaybackMinimumSkipIntervalMs', Number(event.target.value))
                    }
                    slotProps={{
                        htmlInput: {
                            min: 0,
                            step: 1,
                        },
                        input: {
                            endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                        },
                    }}
                />
                {supportsPlaybackEngine && (
                    <>
                        <Stack direction="row" spacing={1} useFlexGap sx={responsiveSettingsStackSx}>
                            <SettingsTextField
                                type="number"
                                color="primary"
                                fullWidth
                                label={t('settings.playbackModesStartGap')}
                                value={playbackModesStartGap}
                                onChange={(event) =>
                                    onSettingChanged('playbackModesStartGap', Number(event.target.value))
                                }
                                slotProps={{
                                    htmlInput: {
                                        max: 0,
                                        step: 1,
                                    },
                                    input: {
                                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                    },
                                }}
                            />
                            <SettingsTextField
                                type="number"
                                color="primary"
                                fullWidth
                                label={t('settings.playbackModesEndGap')}
                                value={playbackModesEndGap}
                                onChange={(event) =>
                                    onSettingChanged('playbackModesEndGap', Number(event.target.value))
                                }
                                slotProps={{
                                    htmlInput: {
                                        min: 0,
                                        step: 1,
                                    },
                                    input: {
                                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                    },
                                }}
                            />
                        </Stack>
                        <Typography variant="caption" color="textSecondary">
                            {t('settings.playbackModesGapHelperText')}
                        </Typography>
                    </>
                )}
                <SettingsSection>{t('settings.webSocketInterface')}</SettingsSection>
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={webSocketClientEnabled}
                            onChange={(e) => onSettingChanged('webSocketClientEnabled', e.target.checked)}
                        />
                    }
                    label={t('settings.webSocketClientEnabled')}
                    labelPlacement="start"
                />
                <SettingsTextField
                    color="primary"
                    fullWidth
                    label={t('settings.webSocketServerUrl')}
                    value={webSocketServerUrl}
                    disabled={!webSocketClientEnabled}
                    onChange={(e) => onSettingChanged('webSocketServerUrl', e.target.value)}
                    error={webSocketClientEnabled && webSocketConnectionSucceeded === false}
                    helperText={webSocketServerUrlHelperText}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={pingWebSocketServer}>
                                        <RefreshIcon />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                />
                <SettingsSection>{t('settings.mining')}</SettingsSection>
                <SettingsTextField
                    type="number"
                    label={t('settings.miningHistoryStorageLimit')}
                    fullWidth
                    value={miningHistoryStorageLimit}
                    color="primary"
                    onChange={(event) => onSettingChanged('miningHistoryStorageLimit', Number(event.target.value))}
                    slotProps={{
                        htmlInput: {
                            min: 0,
                            step: 1,
                        },
                    }}
                />
                {insideApp && (
                    <SettingsTextField
                        label={t('settings.tabName')}
                        fullWidth
                        value={tabName}
                        color="primary"
                        onChange={(event) => onSettingChanged('tabName', event.target.value)}
                    />
                )}
            </Stack>
            <input
                ref={settingsFileInputRef}
                onChange={handleSettingsFileInputChange}
                type="file"
                accept=".json"
                multiple
                hidden
            />
        </>
    );
};

export default MiscSettingTab;
