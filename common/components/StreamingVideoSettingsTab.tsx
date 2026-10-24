import SettingsTextField from '@project/common/components/SettingsTextField';
import NumericSettingInput from '@project/common/components/NumericSettingInput';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRowWithHoverEffect from '@project/common/components/TableRowWithHoverEffect';
import TableCell from '@mui/material/TableCell';
import SwitchLabelWithHoverEffect from '@project/common/components/SwitchLabelWithHoverEffect';
import { useTranslation } from 'react-i18next';
import type { AsbplayerSettings, Page, PageSettings, YoutubePage } from '@project/common/settings';
import { SubtitleListPreference } from '@project/common/settings';
import Paper from '@mui/material/Paper';
import { pageMetadata } from '@project/common/pages';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import TuneIcon from '@mui/icons-material/Tune';
import type { PageConfigMap } from '@project/common/components/SettingsForm';
import { useState } from 'react';
import PageSettingsForm from '@project/common/components/PageSettingsForm';
import SettingsSection from '@project/common/components/SettingsSection';

const pageSettingsHasModifications = (page: Page) => {
    return (
        page.overrides !== undefined ||
        page.additionalHosts !== undefined ||
        (page as YoutubePage).targetLanguages !== undefined
    );
};

const sortedPageKeys = (pageConfigs: PageConfigMap) =>
    Object.keys(pageConfigs)
        .filter((key): key is keyof PageSettings => key in pageMetadata) // Can happen if extension supports more pages than this version of the app
        .sort((a, b) => pageMetadata[a].title.localeCompare(pageMetadata[b].title));

interface Props {
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    insideApp?: boolean;
    extensionSupportsOverlay?: boolean;
    extensionSupportsPageSettings?: boolean;
    extensionSupportsAnimatedImageCapture?: boolean;
    pageConfigs?: PageConfigMap;
}

const StreamingVideoSettingsTab: React.FC<Props> = ({
    settings,
    onSettingChanged,
    onSettingsChanged,
    insideApp,
    extensionSupportsOverlay,
    extensionSupportsPageSettings,
    extensionSupportsAnimatedImageCapture,
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
        streamingMediaFragmentFormat,
        streamingAnimatedImageFps,
        streamingAnimatedImageQuality,
        streamingSubsDragAndDrop,
        streamingAutoSync,
        streamingAutoSyncPromptOnFailure,
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
                            onChange={() =>
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
                {extensionSupportsAnimatedImageCapture && (
                    <TextField
                        select
                        fullWidth
                        label={t('settings.mediaFragmentCaptureFormat')}
                        value={streamingMediaFragmentFormat}
                        onChange={(event) =>
                            onSettingChanged(
                                'streamingMediaFragmentFormat',
                                event.target.value as AsbplayerSettings['streamingMediaFragmentFormat']
                            )
                        }
                    >
                        <MenuItem value="jpeg">{t('settings.mediaFragmentFormatScreenshot')}</MenuItem>
                        <MenuItem value="webp">{t('settings.mediaFragmentFormatAnimatedWebp')}</MenuItem>
                    </TextField>
                )}
                {extensionSupportsAnimatedImageCapture && streamingMediaFragmentFormat === 'webp' && (
                    <>
                        <NumericSettingInput
                            label={t('settings.animatedImageFps')}
                            fullWidth
                            value={streamingAnimatedImageFps}
                            color="primary"
                            integerOnly
                            onValueChange={(value) => void onSettingChanged('streamingAnimatedImageFps', value)}
                            slotProps={{
                                htmlInput: {
                                    min: 1,
                                    max: 60,
                                    step: 1,
                                },
                                input: {
                                    endAdornment: <InputAdornment position="end">fps</InputAdornment>,
                                },
                            }}
                        />
                        <NumericSettingInput
                            label={t('settings.animatedImageQuality')}
                            fullWidth
                            value={streamingAnimatedImageQuality}
                            color="primary"
                            onValueChange={(value) => void onSettingChanged('streamingAnimatedImageQuality', value)}
                            slotProps={{
                                htmlInput: {
                                    min: 0.1,
                                    max: 1,
                                    step: 0.05,
                                },
                            }}
                        />
                    </>
                )}
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
                {pageConfigs && (
                    <>
                        <SettingsSection>{t('settings.pages')}</SettingsSection>
                        <TableContainer variant="outlined" component={Paper} style={{ height: 'auto' }}>
                            <Table>
                                <TableBody>
                                    {sortedPageKeys(pageConfigs).map((key) => {
                                        const pageKey = key;
                                        const metadata = pageMetadata[pageKey];
                                        const page = settings.streamingPages[pageKey];

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
