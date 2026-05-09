import TextField from './SettingsTextField';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormLabel from '@mui/material/FormLabel';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import Radio from '@mui/material/Radio';
import { isWebmMediaFragmentSupported, PostMineAction, PostMinePlayback } from '@project/common';
import { AsbplayerSettings } from '@project/common/settings';
import Switch from '@mui/material/Switch';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import FormControl from '@mui/material/FormControl';
import SettingsSection from './SettingsSection';

interface Props {
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    showWebmMediaFragmentSettings?: boolean;
}

const integerValueRegex = /^-?\d+$/;

const MiningSettingsTab: React.FC<Props> = ({ settings, onSettingChanged, showWebmMediaFragmentSettings = true }) => {
    const { t } = useTranslation();
    const webmCaptureSupported = showWebmMediaFragmentSettings && isWebmMediaFragmentSupported();
    const {
        audioPaddingStart,
        audioPaddingEnd,
        maxImageWidth,
        maxImageHeight,
        mediaFragmentFormat,
        mediaFragmentTrimStart,
        mediaFragmentTrimEnd,
        mediaFragmentMaxClipLength,
        streamingScreenshotDelay,
        surroundingSubtitlesCountRadius,
        surroundingSubtitlesTimeRadius,
        clickToMineDefaultAction,
        postMiningPlaybackState,
        recordWithAudioPlayback,
        preferMp3,
        copyToClipboardOnMine,
    } = settings;
    const [screenshotDelayInput, setScreenshotDelayInput] = useState(String(streamingScreenshotDelay));

    useEffect(() => {
        setScreenshotDelayInput(String(streamingScreenshotDelay));
    }, [streamingScreenshotDelay]);

    return (
        <Stack spacing={1}>
            <FormControl>
                <FormLabel component="legend">{t('settings.clickToMineDefaultAction')}</FormLabel>
                <RadioGroup row={false}>
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={clickToMineDefaultAction === PostMineAction.showAnkiDialog}
                                value={PostMineAction.showAnkiDialog}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('clickToMineDefaultAction', PostMineAction.showAnkiDialog)
                                }
                            />
                        }
                        label={t('postMineAction.showAnkiDialog')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={clickToMineDefaultAction === PostMineAction.updateLastCard}
                                value={PostMineAction.updateLastCard}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('clickToMineDefaultAction', PostMineAction.updateLastCard)
                                }
                            />
                        }
                        label={t('postMineAction.updateLastCard')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={clickToMineDefaultAction === PostMineAction.exportCard}
                                value={PostMineAction.exportCard}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('clickToMineDefaultAction', PostMineAction.exportCard)
                                }
                            />
                        }
                        label={t('postMineAction.exportCard')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={clickToMineDefaultAction === PostMineAction.none}
                                value={PostMineAction.none}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('clickToMineDefaultAction', PostMineAction.none)
                                }
                            />
                        }
                        label={t('postMineAction.none')}
                    />
                </RadioGroup>
            </FormControl>

            <FormControl>
                <FormLabel component="legend">{t('settings.postMinePlayback')}</FormLabel>
                <RadioGroup row={false}>
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={postMiningPlaybackState === PostMinePlayback.remember}
                                value={PostMinePlayback.remember}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('postMiningPlaybackState', PostMinePlayback.remember)
                                }
                            />
                        }
                        label={t('postMinePlayback.remember')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={postMiningPlaybackState === PostMinePlayback.play}
                                value={PostMinePlayback.play}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('postMiningPlaybackState', PostMinePlayback.play)
                                }
                            />
                        }
                        label={t('postMinePlayback.play')}
                    />
                    <LabelWithHoverEffect
                        control={
                            <Radio
                                checked={postMiningPlaybackState === PostMinePlayback.pause}
                                value={PostMinePlayback.pause}
                                onChange={(event) =>
                                    event.target.checked &&
                                    onSettingChanged('postMiningPlaybackState', PostMinePlayback.pause)
                                }
                            />
                        }
                        label={t('postMinePlayback.pause')}
                    />
                </RadioGroup>
            </FormControl>
            <SwitchLabelWithHoverEffect
                control={
                    <Switch
                        checked={copyToClipboardOnMine}
                        onChange={(event) => onSettingChanged('copyToClipboardOnMine', event.target.checked)}
                    />
                }
                label={t('settings.copyOnMine')}
                labelPlacement="start"
            />
            <SettingsSection>{t('settings.audio')}</SettingsSection>
            <SwitchLabelWithHoverEffect
                control={
                    <Switch
                        checked={recordWithAudioPlayback}
                        onChange={(event) => onSettingChanged('recordWithAudioPlayback', event.target.checked)}
                    />
                }
                label={t('settings.recordWithAudioPlayback')}
                labelPlacement="start"
            />
            <SwitchLabelWithHoverEffect
                control={
                    <Switch
                        checked={preferMp3}
                        onChange={(event) => onSettingChanged('preferMp3', event.target.checked)}
                    />
                }
                label={t('settings.mp3Preference')}
                labelPlacement="start"
            />

            <TextField
                type="number"
                label={t('settings.audioPaddingStart')}
                fullWidth
                value={audioPaddingStart}
                color="primary"
                onChange={(event) => onSettingChanged('audioPaddingStart', Number(event.target.value))}
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
            <TextField
                type="number"
                label={t('settings.audioPaddingEnd')}
                fullWidth
                value={audioPaddingEnd}
                color="primary"
                onChange={(event) => onSettingChanged('audioPaddingEnd', Number(event.target.value))}
                slotProps={{
                    htmlInput: {
                        step: 1,
                        min: 0,
                    },
                    input: {
                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                    },
                }}
            />
            <SettingsSection>{t('settings.screenshots')}</SettingsSection>
            {showWebmMediaFragmentSettings && webmCaptureSupported && (
                <TextField
                    select
                    fullWidth
                    label={t('settings.mediaFragmentCaptureFormat')}
                    value={mediaFragmentFormat}
                    onChange={(event) =>
                        onSettingChanged(
                            'mediaFragmentFormat',
                            event.target.value as AsbplayerSettings['mediaFragmentFormat']
                        )
                    }
                >
                    <MenuItem value="jpeg">{t('settings.mediaFragmentFormatScreenshot')}</MenuItem>
                    <MenuItem value="webm">{t('settings.mediaFragmentFormatVideoClip')}</MenuItem>
                </TextField>
            )}
            <TextField
                type="number"
                label={t('settings.maxImageWidth')}
                fullWidth
                value={maxImageWidth}
                color="primary"
                onChange={(event) => onSettingChanged('maxImageWidth', Number(event.target.value))}
                slotProps={{
                    htmlInput: {
                        min: 0,
                        step: 1,
                    },
                }}
            />
            <TextField
                type="number"
                label={t('settings.maxImageHeight')}
                fullWidth
                value={maxImageHeight}
                color="primary"
                onChange={(event) => onSettingChanged('maxImageHeight', Number(event.target.value))}
                slotProps={{
                    htmlInput: {
                        min: 0,
                        step: 1,
                    },
                }}
            />
            {showWebmMediaFragmentSettings && mediaFragmentFormat === 'webm' && webmCaptureSupported && (
                <>
                    <TextField
                        type="number"
                        label={t('settings.mediaFragmentTrimStart')}
                        fullWidth
                        value={mediaFragmentTrimStart}
                        color="primary"
                        onChange={(event) => onSettingChanged('mediaFragmentTrimStart', Number(event.target.value))}
                        slotProps={{
                            htmlInput: {
                                step: 100,
                            },
                            input: {
                                endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                            },
                        }}
                    />
                    <TextField
                        type="number"
                        label={t('settings.mediaFragmentTrimEnd')}
                        fullWidth
                        value={mediaFragmentTrimEnd}
                        color="primary"
                        onChange={(event) => onSettingChanged('mediaFragmentTrimEnd', Number(event.target.value))}
                        slotProps={{
                            htmlInput: {
                                step: 100,
                            },
                            input: {
                                endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                            },
                        }}
                    />
                    <TextField
                        type="number"
                        label={t('settings.mediaFragmentMaxClipLength')}
                        fullWidth
                        value={mediaFragmentMaxClipLength}
                        color="primary"
                        onChange={(event) => onSettingChanged('mediaFragmentMaxClipLength', Number(event.target.value))}
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                step: 1000,
                            },
                            input: {
                                endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                            },
                        }}
                    />
                </>
            )}
            {(!showWebmMediaFragmentSettings || mediaFragmentFormat === 'jpeg') && (
                <TextField
                    type="number"
                    label={t('extension.settings.screenshotCaptureDelay')}
                    fullWidth
                    value={screenshotDelayInput}
                    color="primary"
                    onChange={(event) => {
                        const value = event.target.value;
                        setScreenshotDelayInput(value);

                        if (integerValueRegex.test(value)) {
                            onSettingChanged('streamingScreenshotDelay', Number(value));
                        }
                    }}
                    onBlur={() => {
                        if (!integerValueRegex.test(screenshotDelayInput)) {
                            setScreenshotDelayInput(String(streamingScreenshotDelay));
                        }
                    }}
                    slotProps={{
                        htmlInput: {
                            step: 100,
                        },
                        input: {
                            endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                        },
                    }}
                />
            )}
            <SettingsSection>{t('settings.exportDialog')}</SettingsSection>
            <TextField
                type="number"
                label={t('settings.surroundingSubtitlesCountRadius')}
                fullWidth
                value={surroundingSubtitlesCountRadius}
                color="primary"
                onChange={(event) => onSettingChanged('surroundingSubtitlesCountRadius', Number(event.target.value))}
                slotProps={{
                    htmlInput: {
                        min: 1,
                        step: 1,
                    },
                }}
            />
            <TextField
                type="number"
                label={t('settings.surroundingSubtitlesTimeRadius')}
                fullWidth
                value={surroundingSubtitlesTimeRadius}
                color="primary"
                onChange={(event) => onSettingChanged('surroundingSubtitlesTimeRadius', Number(event.target.value))}
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
    );
};

export default MiningSettingsTab;
