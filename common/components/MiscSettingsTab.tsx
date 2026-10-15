import { asbError } from '@project/common/util/log';
import type { LogProvider } from '@project/common/util/log';
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
import Tooltip from '@mui/material/Tooltip';
import SettingsTextField from '@project/common/components/SettingsTextField';
import SwitchLabelWithHoverEffect from '@project/common/components/SwitchLabelWithHoverEffect';
import LabelWithHoverEffect from '@project/common/components/LabelWithHoverEffect';
import type { AsbplayerSettings } from '@project/common/settings';
import {
    isTrackAutoCopyable,
    SubtitleListTimestampDisplay,
    updateAutoCopyableTracksValue,
    VideoSubtitleSplitBehavior,
} from '@project/common/settings';
import { exportSettings, mergeImportedSettings, validateSettings } from '@project/common/settings/import-export';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SubtitleHtml } from '@project/common';
import { WebSocketClient } from '@project/common/web-socket-client';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsSection from '@project/common/components/SettingsSection';
import InfoIcon from '@mui/icons-material/Info';
import NumericSettingInput from '@project/common/components/NumericSettingInput';
import LogViewerDialog from '@project/common/components/LogViewerDialog';
import BuildIcon from '@mui/icons-material/Build';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import ButtonGroup from '@mui/material/ButtonGroup';
import NoWrapButton from '@project/common/components/NoWrapButton';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

function regexIsValid(regex: string) {
    try {
        new RegExp(regex.trim());
        return true;
    } catch {
        return false;
    }
}

interface Props {
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    logProvider: LogProvider;
    supportedLanguages: string[];
    insideApp?: boolean;
    extensionInstalled?: boolean;
    extensionSupportsAutoCopyableTrackSetting?: boolean;
    supportsSubtitleListCustomization: boolean;
    supportsPlaybackEngine: boolean;
}

const MiscSettingTab: React.FC<Props> = ({
    settings,
    onSettingChanged,
    onSettingsChanged,
    logProvider,
    supportedLanguages,
    insideApp,
    extensionInstalled,
    extensionSupportsAutoCopyableTrackSetting,
    supportsSubtitleListCustomization,
    supportsPlaybackEngine,
}) => {
    const { t } = useTranslation();
    const {
        themeType,
        videoSubtitleSplitBehavior,
        showSubtitleListMiningButton,
        subtitleListTimestampDisplay,
        language,
        rememberSubtitleOffset,
        rememberPlaybackRate,
        rememberPlaybackModes,
        playbackRateNotificationEnabled,
        autoCopyCurrentSubtitle,
        autoCopyableTracks,
        miningHistoryStorageLimit,
        subtitleRegexFilter,
        tabName,
        subtitleRegexFilterTextReplacement,
        subtitleHtml,
        convertNetflixRuby,
        webSocketClientEnabled,
        webSocketServerUrl,
        subtitleAboveThumbnail,
        thumbnailPreview,
    } = settings;
    const validRegex = useMemo(() => regexIsValid(subtitleRegexFilter), [subtitleRegexFilter]);
    const [webSocketConnectionSucceeded, setWebSocketConnectionSucceeded] = useState<boolean>();
    const [logViewerOpen, setLogViewerOpen] = useState(false);
    const pingWebSocketServer = useCallback(() => {
        const client = new WebSocketClient();
        client
            .bind(webSocketServerUrl)
            .then(() => client.ping())
            .then(() => setWebSocketConnectionSucceeded(true))
            .catch((e) => {
                asbError('settings/web-socket', e);
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
            const validatedSettings = validateSettings(mergeImportedSettings(importedSettings, settings));
            onSettingsChanged(validatedSettings);
        } catch (e) {
            asbError('settings/import', e);
        }
    }, [onSettingsChanged, settings]);

    const handleImportSettings = useCallback(() => {
        settingsFileInputRef.current?.click();
    }, []);
    const handleExportSettings = useCallback(() => {
        exportSettings(settings);
    }, [settings]);
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));

    return (
        <>
            <Stack spacing={1}>
                <SettingsSection>{t('settings.tools')}</SettingsSection>
                <ButtonGroup size="small" variant="contained" orientation={isSmallScreen ? 'vertical' : 'horizontal'}>
                    <NoWrapButton fullWidth startIcon={<UploadIcon />} onClick={handleImportSettings}>
                        {t('action.importSettings')}
                    </NoWrapButton>
                    <NoWrapButton fullWidth startIcon={<DownloadIcon />} onClick={handleExportSettings}>
                        {t('action.exportSettings')}
                    </NoWrapButton>
                    <NoWrapButton fullWidth startIcon={<BuildIcon />} onClick={() => setLogViewerOpen(true)}>
                        {t('settings.logs')}
                    </NoWrapButton>
                </ButtonGroup>

                <SettingsSection>{t('settings.ui')}</SettingsSection>
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
                {supportsSubtitleListCustomization && (
                    <>
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={showSubtitleListMiningButton}
                                    onChange={(event) =>
                                        onSettingChanged('showSubtitleListMiningButton', event.target.checked)
                                    }
                                />
                            }
                            label={t('settings.showSubtitleListMiningButton')}
                            labelPlacement="start"
                        />
                        <FormControl>
                            <FormLabel>{t('settings.subtitleListTimestamps')}</FormLabel>
                            <RadioGroup
                                row
                                value={subtitleListTimestampDisplay}
                                onChange={(event) =>
                                    onSettingChanged(
                                        'subtitleListTimestampDisplay',
                                        event.target.value as SubtitleListTimestampDisplay
                                    )
                                }
                            >
                                {Object.values(SubtitleListTimestampDisplay).map((value) => (
                                    <LabelWithHoverEffect
                                        key={value}
                                        control={<Radio value={value} />}
                                        label={t(`subtitleListTimestampDisplay.${value}`)}
                                    />
                                ))}
                            </RadioGroup>
                        </FormControl>
                    </>
                )}
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
                {supportsPlaybackEngine && (
                    <>
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
                {supportsPlaybackEngine && (
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
                    helperText={!validRegex ? 'Invalid regular expression' : undefined}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Tooltip title={t('settings.subtitleRegexFilterDocs')}>
                                        <IconButton
                                            component="a"
                                            href="https://docs.asbplayer.dev/docs/guides/subtitle-text-filtering"
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={t('settings.subtitleRegexFilterDocs')}
                                        >
                                            <InfoIcon />
                                        </IconButton>
                                    </Tooltip>
                                </InputAdornment>
                            ),
                        },
                    }}
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
                <NumericSettingInput
                    label={t('settings.miningHistoryStorageLimit')}
                    fullWidth
                    value={miningHistoryStorageLimit}
                    color="primary"
                    onValueChange={(value) => void onSettingChanged('miningHistoryStorageLimit', value)}
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
            <LogViewerDialog open={logViewerOpen} onClose={() => setLogViewerOpen(false)} logProvider={logProvider} />
        </>
    );
};

export default MiscSettingTab;
