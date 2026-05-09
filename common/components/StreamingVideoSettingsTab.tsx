import SettingsTextField from './SettingsTextField';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRowWithHoverEffect from './TableRowWithHoverEffect';
import TableCell from '@mui/material/TableCell';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import { useTranslation } from 'react-i18next';
import { AsbplayerSettings, Page, PageSettings, SubtitleListPreference, YoutubePage } from '../settings';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import { pageMetadata } from '../pages';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import TuneIcon from '@mui/icons-material/Tune';
import { PageConfigMap } from './SettingsForm';
import { useState } from 'react';
import PageSettingsForm from './PageSettingsForm';
import SettingsSection from './SettingsSection';

const pageSettingsHasModifications = (page: Page) => {
    return (
        page.overrides !== undefined ||
        page.additionalHosts !== undefined ||
        (page as YoutubePage).targetLanguages !== undefined
    );
};

interface Props {
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    insideApp?: boolean;
    extensionSupportsOverlay?: boolean;
    extensionSupportsPageSettings?: boolean;
    pageConfigs?: PageConfigMap;
}

const StreamingVideoSettingsTab: React.FC<Props> = ({
    settings,
    onSettingChanged,
    onSettingsChanged,
    insideApp,
    extensionSupportsOverlay,
    extensionSupportsPageSettings,
    pageConfigs,
}) => {
    const { t } = useTranslation();
    const {
        streamingSubtitleListPreference,
        streamingEnableOverlay,
        streamingDisplaySubtitles,
        streamingRecordMedia,
        streamingTakeScreenshot,
        streamingCleanScreenshot,
        streamingCropScreenshot,
        streamingSubsDragAndDrop,
        streamingAutoSync,
        streamingAutoSyncPromptOnFailure,
        streamingCondensedPlaybackMinimumSkipIntervalMs,
        streamingAppUrl,
        streamingPages,
    } = settings;
    const [pageSettingsFormKey, setPageSettingsFormKey] = useState<keyof PageSettings>('netflix');
    const [pageSettingsFormOpen, setPageSettingsFormOpen] = useState<boolean>(false);
    return (
        <>
            {extensionSupportsPageSettings && pageConfigs && pageSettingsFormKey && (
                <PageSettingsForm
                    open={pageSettingsFormOpen}
                    pageKey={pageSettingsFormKey}
                    page={settings.streamingPages[pageSettingsFormKey]}
                    hasModifications={pageSettingsHasModifications(settings.streamingPages[pageSettingsFormKey])}
                    defaultPageConfig={pageConfigs[pageSettingsFormKey]}
                    onClose={() => setPageSettingsFormOpen(false)}
                    onPageChanged={(key, page) =>
                        onSettingsChanged({ streamingPages: { ...streamingPages, [key]: page } })
                    }
                />
            )}
            <Stack spacing={1}>
                <SettingsSection>{t('settings.appIntegration')}</SettingsSection>
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={streamingSubtitleListPreference !== SubtitleListPreference.noSubtitleList}
                            onChange={(e) =>
                                onSettingChanged(
                                    'streamingSubtitleListPreference',
                                    streamingSubtitleListPreference === SubtitleListPreference.noSubtitleList
                                        ? SubtitleListPreference.app
                                        : SubtitleListPreference.noSubtitleList
                                )
                            }
                        />
                    }
                    label={t('extension.settings.openSubtitleList')}
                    labelPlacement="start"
                />
                {!insideApp && (
                    <SettingsTextField
                        color="primary"
                        fullWidth
                        label={t('extension.settings.asbplayerUrl')}
                        value={streamingAppUrl}
                        onChange={(e) => onSettingChanged('streamingAppUrl', e.target.value)}
                    />
                )}
                <SettingsSection>{t('settings.ui')}</SettingsSection>
                {extensionSupportsOverlay && (
                    <SwitchLabelWithHoverEffect
                        control={
                            <Switch
                                checked={streamingEnableOverlay}
                                onChange={(e) => onSettingChanged('streamingEnableOverlay', e.target.checked)}
                            />
                        }
                        label={t('extension.settings.enableOverlay')}
                        labelPlacement="start"
                    />
                )}
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={streamingDisplaySubtitles}
                            onChange={(e) => onSettingChanged('streamingDisplaySubtitles', e.target.checked)}
                        />
                    }
                    label={t('extension.settings.displaySubtitles')}
                    labelPlacement="start"
                />
                <SettingsSection>{t('settings.mining')}</SettingsSection>
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={streamingRecordMedia}
                            onChange={(e) => onSettingChanged('streamingRecordMedia', e.target.checked)}
                        />
                    }
                    label={t('extension.settings.recordAudio')}
                    labelPlacement="start"
                />
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={streamingTakeScreenshot}
                            onChange={(e) => onSettingChanged('streamingTakeScreenshot', e.target.checked)}
                        />
                    }
                    label={t('extension.settings.takeScreenshot')}
                    labelPlacement="start"
                />
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={streamingCleanScreenshot}
                            onChange={(e) => onSettingChanged('streamingCleanScreenshot', e.target.checked)}
                        />
                    }
                    label={t('extension.settings.cleanScreenshot')}
                    labelPlacement="start"
                />
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={streamingCropScreenshot}
                            onChange={(e) => onSettingChanged('streamingCropScreenshot', e.target.checked)}
                        />
                    }
                    label={t('extension.settings.cropScreenshot')}
                    labelPlacement="start"
                />
                <SettingsSection>{t('settings.subtitles')}</SettingsSection>
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={streamingSubsDragAndDrop}
                            onChange={(e) => onSettingChanged('streamingSubsDragAndDrop', e.target.checked)}
                        />
                    }
                    label={t('extension.settings.dragAndDrop')}
                    labelPlacement="start"
                />
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={streamingAutoSync}
                            onChange={(e) => onSettingChanged('streamingAutoSync', e.target.checked)}
                        />
                    }
                    label={t('extension.settings.autoLoadDetectedSubs')}
                    labelPlacement="start"
                />
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={streamingAutoSyncPromptOnFailure}
                            onChange={(e) => onSettingChanged('streamingAutoSyncPromptOnFailure', e.target.checked)}
                        />
                    }
                    label={t('extension.settings.autoLoadDetectedSubsFailure')}
                    labelPlacement="start"
                />
                <SettingsSection>{t('settings.misc')}</SettingsSection>
                <SettingsTextField
                    type="number"
                    color="primary"
                    fullWidth
                    label={t('extension.settings.condensedPlaybackMinSkipInterval')}
                    value={streamingCondensedPlaybackMinimumSkipIntervalMs}
                    onChange={(e) =>
                        onSettingChanged('streamingCondensedPlaybackMinimumSkipIntervalMs', Number(e.target.value))
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
                {pageConfigs && (
                    <>
                        <SettingsSection>{t('settings.pages')}</SettingsSection>
                        <TableContainer variant="outlined" component={Paper} style={{ height: 'auto' }}>
                            <Table>
                                <TableBody>
                                    {Object.keys(pageConfigs).map((key) => {
                                        const pageKey = key as keyof PageSettings;
                                        const metadata = pageMetadata[pageKey];
                                        const page = settings.streamingPages[pageKey];

                                        if (metadata === undefined || page === undefined) {
                                            // Can happen if extension supports more pages than this version of the app
                                            return null;
                                        }

                                        return (
                                            <TableRowWithHoverEffect
                                                key={key}
                                                onClick={() => {
                                                    setPageSettingsFormKey(pageKey);
                                                    setPageSettingsFormOpen(true);
                                                }}
                                            >
                                                <TableCell
                                                    sx={{
                                                        width: 48,
                                                        background: `url(${pageConfigs[pageKey].faviconUrl})`,
                                                        backgroundRepeat: 'no-repeat',
                                                        backgroundPosition: '75%',
                                                        backgroundSize: 24,
                                                    }}
                                                />
                                                <TableCell align="left">{metadata.title}</TableCell>
                                                <TableCell align="right">
                                                    <Badge
                                                        invisible={!pageSettingsHasModifications(page)}
                                                        color="warning"
                                                        badgeContent=" "
                                                        variant="dot"
                                                    >
                                                        <IconButton>
                                                            <TuneIcon />
                                                        </IconButton>
                                                    </Badge>
                                                </TableCell>
                                            </TableRowWithHoverEffect>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </Stack>
        </>
    );
};

export default StreamingVideoSettingsTab;
