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
import SettingsTextField from './SettingsTextField';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import { AsbplayerSettings, exportSettings, PauseOnHoverMode, validateSettings } from '../settings';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SubtitleHtml } from '..';
import { WebSocketClient } from '../web-socket-client';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsSection from './SettingsSection';
import { VideoSubtitleSplitBehavior } from '../settings';

function regexIsValid(regex: string) {
    try {
        new RegExp(regex.trim());
        return true;
    } catch (e) {
        return false;
    }
}

interface Props {
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    supportedLanguages: string[];
    insideApp?: boolean;
    extensionInstalled?: boolean;
    extensionSupportsPauseOnHover?: boolean;
}

const MiscSettingTab: React.FC<Props> = ({
    settings,
    onSettingChanged,
    onSettingsChanged,
    supportedLanguages,
    insideApp,
    extensionInstalled,
    extensionSupportsPauseOnHover,
}) => {
    const { t } = useTranslation();
    const {
        themeType,
        videoSubtitleSplitBehavior,
        language,
        rememberSubtitleOffset,
        autoCopyCurrentSubtitle,
        seekableTracks,
        miningHistoryStorageLimit,
        subtitleRegexFilter,
        tabName,
        subtitleRegexFilterTextReplacement,
        subtitleHtml,
        convertNetflixRuby,
        pauseOnHoverMode,
        webSocketClientEnabled,
        webSocketServerUrl,
    } = settings;
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
                <FormControl>
                    <FormLabel>{t('settings.theme')}</FormLabel>
                    <RadioGroup row>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={themeType === 'light'}
                                    value="light"
                                    onChange={(event) => event.target.checked && onSettingChanged('themeType', 'light')}
                                />
                            }
                            label={t('settings.themeLight')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={themeType === 'dark'}
                                    value="dark"
                                    onChange={(event) => event.target.checked && onSettingChanged('themeType', 'dark')}
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
                <FormControl>
                    <FormLabel component="legend">{t('settings.seekableTracks')}</FormLabel>
                    <FormGroup>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={seekableTracks[0]}
                                    onChange={(event) => {
                                        onSettingChanged('seekableTracks', [
                                            event.target.checked,
                                            seekableTracks[1],
                                            seekableTracks[2],
                                        ]);
                                    }}
                                />
                            }
                            label={t('settings.subtitleTrackChoice', { trackNumber: 1 })}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={seekableTracks[1]}
                                    onChange={(event) => {
                                        onSettingChanged('seekableTracks', [
                                            seekableTracks[0],
                                            event.target.checked,
                                            seekableTracks[2],
                                        ]);
                                    }}
                                />
                            }
                            label={t('settings.subtitleTrackChoice', { trackNumber: 2 })}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={seekableTracks[2]}
                                    onChange={(event) => {
                                        onSettingChanged('seekableTracks', [
                                            seekableTracks[0],
                                            seekableTracks[1],
                                            event.target.checked,
                                        ]);
                                    }}
                                />
                            }
                            label={t('settings.subtitleTrackChoice', { trackNumber: 3 })}
                        />
                    </FormGroup>
                </FormControl>
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
                                        event.target.checked && onSettingChanged('subtitleHtml', SubtitleHtml.remove)
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
                                        event.target.checked && onSettingChanged('subtitleHtml', SubtitleHtml.render)
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
                                            onSettingChanged('pauseOnHoverMode', PauseOnHoverMode.disabled)
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
                                            onSettingChanged('pauseOnHoverMode', PauseOnHoverMode.inAndOut)
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
                                            onSettingChanged('pauseOnHoverMode', PauseOnHoverMode.inNotOut)
                                        }
                                    />
                                }
                                label={t('pauseOnHoverMode.inNotOut')}
                            />
                        </RadioGroup>
                    </FormControl>
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
                <SettingsSection>{t('settings.title')}</SettingsSection>
                <Stack direction="row" spacing={1}>
                    <Button variant="contained" color="primary" style={{ flex: 1 }} onClick={handleImportSettings}>
                        {t('action.importSettings')}
                    </Button>
                    <Button variant="contained" color="primary" style={{ flex: 1 }} onClick={handleExportSettings}>
                        {t('action.exportSettings')}
                    </Button>
                </Stack>
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
