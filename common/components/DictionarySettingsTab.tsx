import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import RefreshIcon from '@mui/icons-material/Refresh';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import MuiAlert, { type AlertProps } from '@mui/material/Alert';
import {
    AsbplayerSettings,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenReadingAnnotation,
    TokenStyling,
    getFullyKnownTokenStatus,
    NUM_DICTIONARY_TRACKS,
    NUM_TOKEN_STATUSES,
    compareDTField,
    Profile,
    dictionaryStatusCollectionEnabled,
    TokenFrequencyAnnotation,
    TokenStatusConfig,
    textSubtitleSettingsForTrack,
    TextSubtitleSettings,
    TokenStatus,
    DictionaryTrack,
} from '@project/common/settings';
import { Anki } from '../anki';
import { Yomitan } from '../yomitan/yomitan';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import SettingsTextField from './SettingsTextField';
import SettingsSection from './SettingsSection';
import {
    DictionaryBuildAnkiCacheProgress,
    DictionaryBuildAnkiCacheState,
    DictionaryBuildAnkiCacheStateError,
    DictionaryBuildAnkiCacheStateErrorBuildExpirationData,
    DictionaryBuildAnkiCacheStateErrorCode,
    DictionaryBuildAnkiCacheStateErrorTrackNumberData,
    DictionaryBuildAnkiCacheStateType,
    DictionaryBuildAnkiCacheStats,
} from '../src/message';
import { DictionaryProvider } from '../dictionary-db';
import {
    computeStyles,
    ensureStoragePersisted,
    hex2ToPercent,
    humanReadableTime,
    localizedDate,
    percentToHex2,
} from '../util';
import DictionaryImport from './DictionaryImport';
import { applyTokenStyle, InternalToken } from '../subtitle-annotations';
import WordBrowserDialog from './WordBrowserDialog';

const yomitanInstallerUrl = 'https://github.com/yomidevs/yomitan-api';
const yomitanMecabInstallerUrl = 'https://github.com/yomidevs/yomitan-mecab-installer';

const useBuildAnkiCacheState: () => {
    severity: 'error' | 'info';
    msg: string;
    setBuildAnkiCacheState: (state: DictionaryBuildAnkiCacheState | undefined) => void;
} = () => {
    const { t } = useTranslation();
    const [buildAnkiCacheState, setBuildAnkiCacheState] = useState<DictionaryBuildAnkiCacheState>();
    let msg: string = '';

    if (buildAnkiCacheState !== undefined) {
        switch (buildAnkiCacheState.type) {
            case DictionaryBuildAnkiCacheStateType.error:
                const error = buildAnkiCacheState.body as DictionaryBuildAnkiCacheStateError;
                switch (error.code) {
                    case DictionaryBuildAnkiCacheStateErrorCode.concurrentBuild:
                        msg = t('settings.dictionaryBuildInProgress', {
                            time: localizedDate(
                                (error.data as DictionaryBuildAnkiCacheStateErrorBuildExpirationData).expiration
                            ),
                        });
                        break;
                    case DictionaryBuildAnkiCacheStateErrorCode.noAnki:
                        msg = t('settings.dictionaryBuildAnkiError');
                        break;
                    case DictionaryBuildAnkiCacheStateErrorCode.noYomitan:
                        msg = t('settings.dictionaryBuildYomitanError', {
                            trackNumber: (error.data as DictionaryBuildAnkiCacheStateErrorTrackNumberData).track + 1,
                        });
                        break;
                    case DictionaryBuildAnkiCacheStateErrorCode.failedToSyncTrackStates:
                    case DictionaryBuildAnkiCacheStateErrorCode.failedToBuild:
                    default:
                        msg = error.msg ? t('info.error', { message: error.msg }) : t('info.errorNoMessage');
                        break;
                }
                break;
            case DictionaryBuildAnkiCacheStateType.start:
                msg = t('settings.dictionaryBuildAnkiStarted');
                break;
            case DictionaryBuildAnkiCacheStateType.progress:
                const progress = buildAnkiCacheState.body as DictionaryBuildAnkiCacheProgress;
                const rate = progress.current / (Date.now() - progress.buildTimestamp);
                const eta = rate ? Math.ceil((progress.total - progress.current) / rate) : 0;
                msg = `${progress.forAnkiSync ? `${t('settings.dictionaryBuildAnkiStarted')}: ` : ''}${progress.current.toLocaleString('en-US')} / ${t('settings.dictionaryBuildModifiedCards', { numCards: progress.total.toLocaleString('en-US') })} [ETA: ${localizedDate(Date.now() + eta)} (${humanReadableTime(eta)})]`;
                break;
            case DictionaryBuildAnkiCacheStateType.stats:
                const stats = buildAnkiCacheState.body as DictionaryBuildAnkiCacheStats;
                const parts: string[] = [];
                if (stats.tracksToBuild !== undefined) {
                    parts.push(
                        t('settings.dictionaryBuildAnkiTracks', {
                            tracks: stats.tracksToBuild.map((track) => `#${track + 1}`).join(', '),
                        })
                    );
                }
                if (stats.modifiedCards !== undefined) {
                    parts.push(
                        `${t('settings.dictionaryBuildModifiedCards', { numCards: stats.modifiedCards.toLocaleString('en-US') })}`
                    );
                }
                if (stats.tracksToClear?.length && stats.orphanedCards !== undefined) {
                    parts.push(
                        t('settings.dictionaryBuildOrphanedCards', {
                            numCards: stats.orphanedCards.toLocaleString('en-US'),
                            tracks: stats.tracksToClear.map((track) => `#${track + 1}`).join(', '),
                        })
                    );
                }
                const duration = Math.floor((Date.now() - stats.buildTimestamp) / 1000);
                if (duration > 0) {
                    parts.push(`[${duration.toLocaleString('en-US')}s]`);
                }
                msg = parts.join(' | ');
                break;
        }
    }

    return {
        severity: buildAnkiCacheState?.type === DictionaryBuildAnkiCacheStateType.error ? 'error' : 'info',
        msg,
        setBuildAnkiCacheState,
    };
};

const Alert: React.FC<AlertProps> = ({ children, ...props }) => {
    return (
        <MuiAlert
            style={{
                // SettingsDialog applies height: 100vh to .MuiPaper-root - override it here
                height: 'auto',
            }}
            {...props}
        >
            {children}
        </MuiAlert>
    );
};

interface Props {
    settings: AsbplayerSettings;
    dictionaryProvider: DictionaryProvider;
    extensionInstalled: boolean;
    supportsDictionaryBrowser: boolean;
    supportsDictionaryTokenStatusDisplayAlpha: boolean;
    supportsDictionaryYomitanMecab: boolean;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    onViewKeyboardShortcuts: () => void;
    profiles: Profile[];
    activeProfile?: string;
    anki: Anki;
}

const DictionarySettingsTab: React.FC<Props> = ({
    dictionaryProvider,
    settings,
    extensionInstalled,
    supportsDictionaryBrowser,
    supportsDictionaryTokenStatusDisplayAlpha,
    supportsDictionaryYomitanMecab,
    onSettingChanged,
    onViewKeyboardShortcuts,
    profiles,
    activeProfile,
    anki,
}) => {
    const { t } = useTranslation();
    const { ankiConnectUrl, dictionaryTracks } = settings;
    const initialDictionaryTracksRef = useRef(dictionaryTracks);
    const [selectedDictionaryTrack, setSelectedDictionaryTrack] = useState<number>(0);
    const selectedDictionary = dictionaryTracks[selectedDictionaryTrack];

    const getHelperTextForAnkiCacheSettingsDependencies = useCallback(
        (fieldName: string, key: keyof typeof selectedDictionary, error?: React.ReactNode) => {
            if (error) return error;
            const initialTrack = initialDictionaryTracksRef.current[selectedDictionaryTrack];
            if (compareDTField(key, initialTrack, selectedDictionary)) return;
            return t('settings.ankiCacheDependentSettingsHelperText', { field: fieldName });
        },
        [selectedDictionary, selectedDictionaryTrack, t]
    );

    const [deckNames, setDeckNames] = useState<string[]>();
    const [allFieldNames, setAllFieldNames] = useState<string[]>();
    const [ankiError, setAnkiError] = useState<string>();
    const showTokenMatchStrategyPriority = [
        selectedDictionary.dictionaryTokenMatchStrategy,
        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy,
    ].some(
        (s) => s === TokenMatchStrategy.ANY_FORM_COLLECTED || s === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED
    );
    const selectedDictionaryShowThickness =
        selectedDictionary.dictionaryTokenStyling === TokenStyling.UNDERLINE ||
        selectedDictionary.dictionaryTokenStyling === TokenStyling.OVERLINE ||
        selectedDictionary.dictionaryTokenStyling === TokenStyling.OUTLINE;
    const tokenStylingToHide = useMemo(() => {
        if (selectedDictionary.dictionaryColorizeFullyKnownTokens) return;
        return getFullyKnownTokenStatus();
    }, [selectedDictionary.dictionaryColorizeFullyKnownTokens]);

    const [dictionaryYomitanUrlError, setDictionaryYomitanUrlError] = useState<string>();
    const [dictionaryYomitanMecabError, setDictionaryYomitanMecabError] = useState<React.ReactNode>();
    const dictionaryRequestYomitan = useCallback(async () => {
        try {
            const yomitan = new Yomitan(selectedDictionary);
            await yomitan.version();
            setDictionaryYomitanUrlError(undefined);
            if (!supportsDictionaryYomitanMecab) {
                setDictionaryYomitanMecabError(undefined);
                return;
            }
            if (selectedDictionary.dictionaryYomitanParser !== 'mecab' || yomitan.getSupportsMecabLemma()) {
                setDictionaryYomitanMecabError(undefined);
                return;
            }
            if (yomitan.getSupportsMecab()) {
                setDictionaryYomitanMecabError(
                    <Trans
                        i18nKey="settings.dictionaryYomitanMecabLemmaNotSupportedError"
                        components={[<Link key={0} target="_blank" href={yomitanMecabInstallerUrl} />]}
                    />
                );
                return;
            }
            setDictionaryYomitanMecabError(
                <Trans
                    i18nKey="settings.dictionaryYomitanMecabNotSupportedError"
                    components={[<Link key={0} target="_blank" href={yomitanMecabInstallerUrl} />]}
                />
            );
        } catch (e) {
            console.error(e);
            if (e instanceof Error) {
                setDictionaryYomitanUrlError(e.message);
            } else if (typeof e === 'string') {
                setDictionaryYomitanUrlError(e);
            } else {
                setDictionaryYomitanUrlError(String(e));
            }
        }
    }, [selectedDictionary, supportsDictionaryYomitanMecab]);

    useEffect(() => {
        let canceled = false;

        const timeout = setTimeout(async () => {
            if (canceled) {
                return;
            }

            dictionaryRequestYomitan();
        }, 1000);

        return () => {
            canceled = true;
            clearTimeout(timeout);
        };
    }, [dictionaryRequestYomitan]);

    useEffect(() => {
        (async () => {
            try {
                setDeckNames((await anki.deckNames(ankiConnectUrl)).sort((a, b) => a.localeCompare(b)));
                const modelNames = await anki.modelNames(ankiConnectUrl);
                const allFieldNamesSet = new Set<string>();
                for (const modelName of modelNames) {
                    const fieldNames = await anki.modelFieldNames(modelName);
                    for (const fieldName of fieldNames) {
                        allFieldNamesSet.add(fieldName);
                    }
                }
                setAllFieldNames(Array.from(allFieldNamesSet).sort((a, b) => a.localeCompare(b)));
            } catch (e) {
                setDeckNames(undefined);
                setAllFieldNames(undefined);
                setAnkiError(e instanceof Error ? e.message : String(e));
            }
        })();
    }, [anki, ankiConnectUrl]);

    const yomitanSectionRef = useRef<HTMLSpanElement | null>(null);
    const handleYomitanHelperTextClicked = () => {
        yomitanSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const [exportingDictionaryDB, setExportingDictionaryDB] = useState<boolean>();
    const handleExportDictionaryDB = useCallback(async () => {
        void ensureStoragePersisted();
        try {
            setExportingDictionaryDB(true);
            await dictionaryProvider.exportRecordLocalBulk();
        } finally {
            setExportingDictionaryDB(false);
        }
    }, [dictionaryProvider]);

    const buildAnkiCacheDisabled = dictionaryTracks.every((dt) => !dictionaryStatusCollectionEnabled(dt));
    const ankiFieldsEnabled = dictionaryTracks.some(
        (dt) => dt.dictionaryAnkiWordFields.length || dt.dictionaryAnkiSentenceFields.length
    );
    const [buildingAnkiCache, setBuildingAnkiCache] = useState<boolean>(false);
    const { severity: buildMessageSeverity, msg: buildMessage, setBuildAnkiCacheState } = useBuildAnkiCacheState();

    const handleBuildAnkiCache = useCallback(async () => {
        try {
            setBuildingAnkiCache(true);
            setBuildAnkiCacheState(undefined);
            void ensureStoragePersisted();
            await dictionaryProvider.buildAnkiCache(activeProfile, settings);
        } catch (e) {
            console.error('Failed to send build Anki cache message', e);
            setBuildAnkiCacheState({
                type: DictionaryBuildAnkiCacheStateType.error,
                body: {
                    code: DictionaryBuildAnkiCacheStateErrorCode.failedToBuild,
                    msg: e instanceof Error ? e.message : String(e),
                } as DictionaryBuildAnkiCacheStateError,
            });
        } finally {
            setBuildingAnkiCache(false);
        }
    }, [dictionaryProvider, settings, activeProfile, setBuildAnkiCacheState]);

    useEffect(() => {
        return dictionaryProvider.onBuildAnkiCacheStateChange(setBuildAnkiCacheState);
    }, [dictionaryProvider, setBuildAnkiCacheState]);

    const [dictionaryImportOpen, setDictionaryImportOpen] = useState<boolean>(false);
    const [wordBrowserOpen, setWordBrowserOpen] = useState<boolean>(false);
    const ankiSectionRef = useRef<HTMLDivElement | null>(null);
    const handleAnkiHelperTextClicked = () => ankiSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    const subtitleStyles = useMemo(
        () => computeStyles(textSubtitleSettingsForTrack(settings, selectedDictionaryTrack) as TextSubtitleSettings),
        [settings, selectedDictionaryTrack]
    );
    const theme = useTheme();
    return (
        <>
            <DictionaryImport
                open={dictionaryImportOpen}
                onClose={() => setDictionaryImportOpen(false)}
                dictionaryTracks={dictionaryTracks}
                selectedDictionaryTrack={selectedDictionaryTrack}
                dictionaryProvider={dictionaryProvider}
                activeProfile={activeProfile}
                profiles={profiles}
            />
            <WordBrowserDialog
                open={wordBrowserOpen}
                dictionaryProvider={dictionaryProvider}
                activeProfile={activeProfile}
                dictionaryTracks={dictionaryTracks}
                onClose={() => setWordBrowserOpen(false)}
            />
            <Stack spacing={1}>
                {(dictionaryYomitanUrlError || dictionaryYomitanMecabError || !extensionInstalled) && (
                    <Alert severity="info">
                        <Stack spacing={1}>
                            {(dictionaryYomitanUrlError || dictionaryYomitanMecabError) && (
                                <div>
                                    <Trans
                                        i18nKey="settings.annotationHelperText"
                                        components={[
                                            <Link
                                                key={0}
                                                onClick={handleYomitanHelperTextClicked}
                                                sx={{ cursor: 'pointer' }}
                                            />,
                                        ]}
                                    />
                                </div>
                            )}
                            {!extensionInstalled && (
                                <div>
                                    <Trans i18nKey="settings.annotationNoExtensionWarn" />
                                </div>
                            )}
                        </Stack>
                    </Alert>
                )}
                <SettingsSection>{t('settings.manageWords')}</SettingsSection>
                <Stack spacing={1}>
                    {supportsDictionaryBrowser && (
                        <Button variant="contained" color="primary" onClick={() => setWordBrowserOpen(true)}>
                            {t('settings.dictionaryBrowser.title')}
                        </Button>
                    )}
                    <div>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', pb: 0.5, pt: 1 }}>
                            {t('settings.dictionaryLocalWordDatabase')}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                                variant="contained"
                                color="primary"
                                style={{ flex: 1 }}
                                onClick={() => setDictionaryImportOpen(true)}
                            >
                                {t('action.importDictionaryLocalRecords')}
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                style={{ flex: 1 }}
                                onClick={handleExportDictionaryDB}
                                loading={exportingDictionaryDB}
                            >
                                {t('action.exportDictionaryLocalRecords')}
                            </Button>
                        </Stack>
                        <Typography variant="caption" color="textSecondary">
                            <Trans
                                i18nKey={'settings.annotationLocalAnkiHelperText'}
                                components={[
                                    <Link key={0} onClick={onViewKeyboardShortcuts} sx={{ cursor: 'pointer' }} />,
                                ]}
                            />
                        </Typography>
                    </div>
                    <Stack spacing={1}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', pb: 0.5, pt: 1 }}>
                            {t('settings.dictionaryAnkiWordDatabase')}
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            style={{ width: '100%' }}
                            onClick={handleBuildAnkiCache}
                            loading={buildingAnkiCache}
                            disabled={buildAnkiCacheDisabled}
                            startIcon={<RefreshIcon />}
                        >
                            {t('settings.buildAnkiCache')}
                        </Button>
                        <Typography variant="caption" color="textSecondary">
                            {t('settings.buildAnkiCacheHelperText')}{' '}
                            {!ankiFieldsEnabled && (
                                <Trans
                                    i18nKey={'settings.buildAnkiCacheAnkiEnableHelperText'}
                                    components={[
                                        <Link
                                            key={0}
                                            onClick={handleAnkiHelperTextClicked}
                                            sx={{ cursor: 'pointer' }}
                                        />,
                                    ]}
                                />
                            )}
                        </Typography>
                        {buildMessage && buildMessageSeverity && (
                            <div style={{ marginTop: 8 }}>
                                <Alert severity={buildMessageSeverity}>{buildMessage}</Alert>
                            </div>
                        )}
                    </Stack>
                </Stack>
                <SettingsSection docs="docs/reference/settings#annotation">{t('settings.annotation')}</SettingsSection>
                <SettingsTextField
                    select
                    fullWidth
                    color="primary"
                    variant="outlined"
                    size="small"
                    label={t('settings.subtitleTrack')!}
                    value={selectedDictionaryTrack}
                    onChange={(e) => setSelectedDictionaryTrack(Number(e.target.value))}
                >
                    {[...Array(NUM_DICTIONARY_TRACKS).keys()].map((i) => (
                        <MenuItem key={i} value={i}>
                            {t('settings.subtitleTrackChoice', { trackNumber: i + 1 })}
                        </MenuItem>
                    ))}
                </SettingsTextField>
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={selectedDictionary.dictionaryColorizeSubtitles}
                            onChange={(e) => {
                                const newTracks = [...dictionaryTracks];
                                newTracks[selectedDictionaryTrack] = {
                                    ...newTracks[selectedDictionaryTrack],
                                    dictionaryColorizeSubtitles: e.target.checked,
                                };
                                onSettingChanged('dictionaryTracks', newTracks);
                            }}
                        />
                    }
                    label={t('settings.dictionaryColorizeSubtitles')}
                    labelPlacement="start"
                />
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={selectedDictionary.dictionaryAutoGenerateStatistics}
                            onChange={(e) => {
                                const newTracks = [...dictionaryTracks];
                                newTracks[selectedDictionaryTrack] = {
                                    ...newTracks[selectedDictionaryTrack],
                                    dictionaryAutoGenerateStatistics: e.target.checked,
                                };
                                onSettingChanged('dictionaryTracks', newTracks);
                            }}
                        />
                    }
                    label={t('settings.dictionaryAutoGenerateStatistics')}
                    labelPlacement="start"
                />
                <FormControl>
                    <FormLabel component="legend">{t('settings.dictionaryTokenReadingAnnotation')}</FormLabel>
                    <RadioGroup row={false}>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenReadingAnnotation ===
                                        TokenReadingAnnotation.ALWAYS
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenReadingAnnotation: TokenReadingAnnotation.ALWAYS,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenReadingAnnotationAlways')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenReadingAnnotation ===
                                        TokenReadingAnnotation.LEARNING_OR_BELOW
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenReadingAnnotation: TokenReadingAnnotation.LEARNING_OR_BELOW,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenReadingAnnotationLearningOrBelow')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenReadingAnnotation ===
                                        TokenReadingAnnotation.UNKNOWN_OR_BELOW
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenReadingAnnotation: TokenReadingAnnotation.UNKNOWN_OR_BELOW,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenReadingAnnotationUnknownOrBelow')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenReadingAnnotation ===
                                        TokenReadingAnnotation.NEVER
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenReadingAnnotation: TokenReadingAnnotation.NEVER,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenReadingAnnotationNever')}
                        />
                    </RadioGroup>
                </FormControl>
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={selectedDictionary.dictionaryDisplayIgnoredTokenReadings}
                            onChange={(e) => {
                                const newTracks = [...dictionaryTracks];
                                newTracks[selectedDictionaryTrack] = {
                                    ...newTracks[selectedDictionaryTrack],
                                    dictionaryDisplayIgnoredTokenReadings: e.target.checked,
                                };
                                onSettingChanged('dictionaryTracks', newTracks);
                            }}
                        />
                    }
                    label={t('settings.dictionaryDisplayIgnoredTokenReadings')}
                    labelPlacement="start"
                />
                <FormControl>
                    <FormLabel component="legend">{t('settings.dictionaryTokenFrequencyAnnotation')}</FormLabel>
                    <RadioGroup row={false}>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenFrequencyAnnotation ===
                                        TokenFrequencyAnnotation.ALWAYS
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.ALWAYS,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenFrequencyAnnotationAlways')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenFrequencyAnnotation ===
                                        TokenFrequencyAnnotation.UNCOLLECTED_ONLY
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenFrequencyAnnotation:
                                                TokenFrequencyAnnotation.UNCOLLECTED_ONLY,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenFrequencyAnnotationUncollectedOnly')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenFrequencyAnnotation ===
                                        TokenFrequencyAnnotation.NEVER
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.NEVER,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenFrequencyAnnotationNever')}
                        />
                    </RadioGroup>
                </FormControl>
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={selectedDictionary.dictionaryColorizeOnHoverOnly}
                            onChange={(e) => {
                                const newTracks = [...dictionaryTracks];
                                newTracks[selectedDictionaryTrack] = {
                                    ...newTracks[selectedDictionaryTrack],
                                    dictionaryColorizeOnHoverOnly: e.target.checked,
                                };
                                onSettingChanged('dictionaryTracks', newTracks);
                            }}
                        />
                    }
                    label={t('settings.dictionaryColorizeOnHoverOnly')}
                    labelPlacement="start"
                />
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={selectedDictionary.dictionaryHighlightOnHover}
                            onChange={(e) => {
                                const newTracks = [...dictionaryTracks];
                                newTracks[selectedDictionaryTrack] = {
                                    ...newTracks[selectedDictionaryTrack],
                                    dictionaryHighlightOnHover: e.target.checked,
                                };
                                onSettingChanged('dictionaryTracks', newTracks);
                            }}
                        />
                    }
                    label={t('settings.dictionaryHighlightOnHover')}
                    labelPlacement="start"
                />
                <SettingsSection>{t('settings.coloringStrategy')}</SettingsSection>
                <FormControl>
                    <FormLabel component="legend">{t('settings.dictionaryTokenMatchStrategy')}</FormLabel>
                    <RadioGroup row={false}>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategy ===
                                        TokenMatchStrategy.ANY_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyAnyFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategy ===
                                        TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategy:
                                                TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyLemmaOrExactFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategy ===
                                        TokenMatchStrategy.LEMMA_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategy: TokenMatchStrategy.LEMMA_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyLemmaFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategy ===
                                        TokenMatchStrategy.EXACT_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyExactFormCollected')}
                        />
                    </RadioGroup>
                </FormControl>
                {showTokenMatchStrategyPriority && (
                    <FormControl>
                        <FormLabel component="legend">{t('settings.dictionaryTokenMatchStrategyPriority')}</FormLabel>
                        <RadioGroup row={false}>
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={
                                            selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                            TokenMatchStrategyPriority.EXACT
                                        }
                                        onChange={() => {
                                            const newTracks = [...dictionaryTracks];
                                            newTracks[selectedDictionaryTrack] = {
                                                ...newTracks[selectedDictionaryTrack],
                                                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
                                            };
                                            onSettingChanged('dictionaryTracks', newTracks);
                                        }}
                                    />
                                }
                                label={t('settings.dictionaryTokenMatchStrategyPriorityExact')}
                            />
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={
                                            selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                            TokenMatchStrategyPriority.LEMMA
                                        }
                                        onChange={() => {
                                            const newTracks = [...dictionaryTracks];
                                            newTracks[selectedDictionaryTrack] = {
                                                ...newTracks[selectedDictionaryTrack],
                                                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.LEMMA,
                                            };
                                            onSettingChanged('dictionaryTracks', newTracks);
                                        }}
                                    />
                                }
                                label={t('settings.dictionaryTokenMatchStrategyPriorityLemma')}
                            />
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={
                                            selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                            TokenMatchStrategyPriority.BEST_KNOWN
                                        }
                                        onChange={() => {
                                            const newTracks = [...dictionaryTracks];
                                            newTracks[selectedDictionaryTrack] = {
                                                ...newTracks[selectedDictionaryTrack],
                                                dictionaryTokenMatchStrategyPriority:
                                                    TokenMatchStrategyPriority.BEST_KNOWN,
                                            };
                                            onSettingChanged('dictionaryTracks', newTracks);
                                        }}
                                    />
                                }
                                label={t('settings.dictionaryTokenMatchStrategyPriorityBestKnown')}
                            />
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={
                                            selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                            TokenMatchStrategyPriority.LEAST_KNOWN
                                        }
                                        onChange={() => {
                                            const newTracks = [...dictionaryTracks];
                                            newTracks[selectedDictionaryTrack] = {
                                                ...newTracks[selectedDictionaryTrack],
                                                dictionaryTokenMatchStrategyPriority:
                                                    TokenMatchStrategyPriority.LEAST_KNOWN,
                                            };
                                            onSettingChanged('dictionaryTracks', newTracks);
                                        }}
                                    />
                                }
                                label={t('settings.dictionaryTokenMatchStrategyPriorityLeastKnown')}
                            />
                        </RadioGroup>
                    </FormControl>
                )}
                <FormControl>
                    <FormLabel component="legend">{t('settings.dictionaryAnkiSentenceTokenMatchStrategy')}</FormLabel>
                    <RadioGroup row={false}>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                        TokenMatchStrategy.ANY_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryAnkiSentenceTokenMatchStrategy:
                                                TokenMatchStrategy.ANY_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyAnyFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                        TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryAnkiSentenceTokenMatchStrategy:
                                                TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyLemmaOrExactFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                        TokenMatchStrategy.LEMMA_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryAnkiSentenceTokenMatchStrategy:
                                                TokenMatchStrategy.LEMMA_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyLemmaFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                        TokenMatchStrategy.EXACT_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryAnkiSentenceTokenMatchStrategy:
                                                TokenMatchStrategy.EXACT_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyExactFormCollected')}
                        />
                    </RadioGroup>
                </FormControl>
                <SettingsSection ref={yomitanSectionRef}>{t('settings.dictionaryYomitanSection')}</SettingsSection>
                {dictionaryYomitanUrlError && (
                    <Alert severity="info">
                        <Trans
                            i18nKey={t('settings.yomitanHelperText')}
                            components={[<Link key={0} target="_blank" href={yomitanInstallerUrl} />]}
                        />
                    </Alert>
                )}
                <SettingsTextField
                    label={t('settings.dictionaryYomitanUrl')}
                    value={selectedDictionary.dictionaryYomitanUrl}
                    error={Boolean(dictionaryYomitanUrlError)}
                    helperText={getHelperTextForAnkiCacheSettingsDependencies(
                        t('settings.dictionaryYomitanUrl'),
                        'dictionaryYomitanUrl',
                        dictionaryYomitanUrlError
                    )}
                    color="primary"
                    onChange={(e) => {
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            dictionaryYomitanUrl: e.target.value,
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={dictionaryRequestYomitan}>
                                        <RefreshIcon />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                />
                {dictionaryYomitanMecabError && <Alert severity="info">{dictionaryYomitanMecabError}</Alert>}
                {supportsDictionaryYomitanMecab && (
                    <SettingsTextField
                        select
                        label={t('settings.dictionaryYomitanParser')}
                        value={selectedDictionary.dictionaryYomitanParser}
                        error={Boolean(dictionaryYomitanMecabError)}
                        helperText={getHelperTextForAnkiCacheSettingsDependencies(
                            t('settings.dictionaryYomitanParser'),
                            'dictionaryYomitanParser',
                            dictionaryYomitanMecabError
                        )}
                        color="primary"
                        onChange={(e) => {
                            const newTracks = [...dictionaryTracks];
                            newTracks[selectedDictionaryTrack] = {
                                ...newTracks[selectedDictionaryTrack],
                                dictionaryYomitanParser: e.target.value as DictionaryTrack['dictionaryYomitanParser'],
                            };
                            onSettingChanged('dictionaryTracks', newTracks);
                        }}
                    >
                        <MenuItem value="scanning-parser">{t('settings.dictionaryYomitanScanningParser')}</MenuItem>
                        <MenuItem value="mecab">{t('settings.dictionaryYomitanMecabParser')}</MenuItem>
                    </SettingsTextField>
                )}
                {(selectedDictionary.dictionaryYomitanParser === 'scanning-parser' ||
                    !supportsDictionaryYomitanMecab) && (
                    <SettingsTextField
                        type="number"
                        label={t('settings.dictionaryYomitanScanLength')}
                        value={selectedDictionary.dictionaryYomitanScanLength}
                        helperText={getHelperTextForAnkiCacheSettingsDependencies(
                            t('settings.dictionaryYomitanScanLength'),
                            'dictionaryYomitanScanLength'
                        )}
                        color="primary"
                        onChange={(e) => {
                            const newTracks = [...dictionaryTracks];
                            newTracks[selectedDictionaryTrack] = {
                                ...newTracks[selectedDictionaryTrack],
                                dictionaryYomitanScanLength: Number(e.target.value),
                            };
                            onSettingChanged('dictionaryTracks', newTracks);
                        }}
                        slotProps={{
                            htmlInput: { min: 1, max: 128, step: 1 },
                        }}
                    />
                )}
                <SettingsSection ref={ankiSectionRef}>{t('settings.anki')}</SettingsSection>
                <Autocomplete
                    multiple
                    options={deckNames ?? []}
                    value={selectedDictionary.dictionaryAnkiDecks}
                    onChange={(_, newValue) => {
                        const items = newValue as string[];
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            dictionaryAnkiDecks: items,
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                    disableCloseOnSelect
                    renderOption={({ key, ...restOfProps }, option, { selected }) => (
                        <li key={key} {...restOfProps}>
                            <ListItemIcon>
                                <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple />
                            </ListItemIcon>
                            <ListItemText primary={option} />
                        </li>
                    )}
                    renderInput={(params) => (
                        <SettingsTextField
                            {...params}
                            label={t('settings.dictionaryAnkiDecks')}
                            placeholder={t('settings.dictionaryAnkiSelectDecks')}
                            error={Boolean(ankiError)}
                            helperText={getHelperTextForAnkiCacheSettingsDependencies(
                                t('settings.dictionaryAnkiDecks'),
                                'dictionaryAnkiDecks',
                                ankiError
                            )}
                            fullWidth
                        />
                    )}
                />
                <Autocomplete
                    multiple
                    options={allFieldNames ?? []}
                    value={selectedDictionary.dictionaryAnkiWordFields}
                    onChange={(_, newValue) => {
                        const items = newValue as string[];
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            dictionaryAnkiWordFields: items,
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                    disableCloseOnSelect
                    renderOption={(props, option, { selected }) => (
                        <li {...props}>
                            <ListItemIcon>
                                <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple />
                            </ListItemIcon>
                            <ListItemText primary={option} />
                        </li>
                    )}
                    renderInput={(params) => (
                        <SettingsTextField
                            {...params}
                            label={t('settings.dictionaryAnkiWordFields')}
                            placeholder={t('settings.dictionaryAnkiSelectFields')}
                            error={Boolean(ankiError)}
                            helperText={getHelperTextForAnkiCacheSettingsDependencies(
                                t('settings.dictionaryAnkiWordFields'),
                                'dictionaryAnkiWordFields',
                                ankiError
                            )}
                            fullWidth
                        />
                    )}
                />
                <Autocomplete
                    multiple
                    options={allFieldNames ?? []}
                    value={selectedDictionary.dictionaryAnkiSentenceFields}
                    onChange={(_, newValue) => {
                        const items = newValue as string[];
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            dictionaryAnkiSentenceFields: items,
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                    disableCloseOnSelect
                    renderOption={(props, option, { selected }) => (
                        <li {...props}>
                            <ListItemIcon>
                                <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple />
                            </ListItemIcon>
                            <ListItemText primary={option} />
                        </li>
                    )}
                    renderInput={(params) => (
                        <SettingsTextField
                            {...params}
                            label={t('settings.dictionaryAnkiSentenceFields')}
                            placeholder={t('settings.dictionaryAnkiSelectFields')}
                            error={Boolean(ankiError)}
                            helperText={getHelperTextForAnkiCacheSettingsDependencies(
                                t('settings.dictionaryAnkiSentenceFields'),
                                'dictionaryAnkiSentenceFields',
                                ankiError
                            )}
                            fullWidth
                        />
                    )}
                />
                <SettingsTextField
                    type="number"
                    label={t('settings.dictionaryAnkiMatureCutoff')}
                    value={selectedDictionary.dictionaryAnkiMatureCutoff}
                    helperText={getHelperTextForAnkiCacheSettingsDependencies(
                        t('settings.dictionaryAnkiMatureCutoff'),
                        'dictionaryAnkiMatureCutoff'
                    )}
                    color="primary"
                    onChange={(e) => {
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            dictionaryAnkiMatureCutoff: Number(e.target.value),
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                    slotProps={{
                        htmlInput: { min: 1, max: 36500, step: 1 },
                    }}
                />
                <FormControl>
                    <FormLabel component="legend">{t('settings.dictionaryAnkiTreatSuspended')}</FormLabel>
                    <RadioGroup row={false}>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryAnkiTreatSuspended === 'NORMAL'}
                                    onChange={(event) => {
                                        if (!event.target.checked) return;

                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryAnkiTreatSuspended: 'NORMAL',
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryAnkiTreatSuspendedNormal')}
                        />
                        {[...Array(NUM_TOKEN_STATUSES).keys()].map((i) => {
                            const tokenStatus: TokenStatus = NUM_TOKEN_STATUSES - 1 - i;
                            if (tokenStatus === TokenStatus.UNCOLLECTED) return null;
                            return (
                                <LabelWithHoverEffect
                                    key={i}
                                    control={
                                        <Radio
                                            checked={selectedDictionary.dictionaryAnkiTreatSuspended === tokenStatus}
                                            onChange={(event) => {
                                                if (!event.target.checked) return;
                                                const newTracks = [...dictionaryTracks];
                                                newTracks[selectedDictionaryTrack] = {
                                                    ...newTracks[selectedDictionaryTrack],
                                                    dictionaryAnkiTreatSuspended: tokenStatus,
                                                };
                                                onSettingChanged('dictionaryTracks', newTracks);
                                            }}
                                        />
                                    }
                                    label={t(`settings.dictionaryTokenStatus${tokenStatus}`)}
                                />
                            );
                        })}
                    </RadioGroup>
                </FormControl>
                <SettingsSection>{t('settings.styling')}</SettingsSection>
                <FormControl>
                    <FormLabel component="legend">{t('settings.dictionaryTokenStyling')}</FormLabel>
                    <RadioGroup row={false}>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryTokenStyling === TokenStyling.TEXT}
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStyling: TokenStyling.TEXT,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingText')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryTokenStyling === TokenStyling.BACKGROUND}
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStyling: TokenStyling.BACKGROUND,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingBackground')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryTokenStyling === TokenStyling.UNDERLINE}
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStyling: TokenStyling.UNDERLINE,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingUnderline')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryTokenStyling === TokenStyling.OVERLINE}
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStyling: TokenStyling.OVERLINE,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingOverline')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryTokenStyling === TokenStyling.OUTLINE}
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStyling: TokenStyling.OUTLINE,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingOutline')}
                        />
                    </RadioGroup>
                </FormControl>
                {selectedDictionary.dictionaryTokenStyling === TokenStyling.OUTLINE && (
                    <Typography variant="caption" color="textSecondary">
                        {t('settings.dictionaryTokenStylingOutlineHelperText')}
                    </Typography>
                )}
                {selectedDictionaryShowThickness && (
                    <SettingsTextField
                        type="number"
                        label={t('settings.dictionaryTokenStylingThickness')}
                        fullWidth
                        value={selectedDictionary.dictionaryTokenStylingThickness}
                        color="primary"
                        onChange={(e) => {
                            const newTracks = [...dictionaryTracks];
                            newTracks[selectedDictionaryTrack] = {
                                ...newTracks[selectedDictionaryTrack],
                                dictionaryTokenStylingThickness: Number(e.target.value),
                            };
                            onSettingChanged('dictionaryTracks', newTracks);
                        }}
                        slotProps={{
                            htmlInput: {
                                min: 0.1,
                                step: 0.1,
                            },
                            input: {
                                endAdornment: <InputAdornment position="end">px</InputAdornment>,
                            },
                        }}
                    />
                )}
                {supportsDictionaryTokenStatusDisplayAlpha ? (
                    <Stack spacing={1}>
                        {[...Array(NUM_TOKEN_STATUSES).keys()].map((i) => {
                            const tokenStatus: TokenStatus = NUM_TOKEN_STATUSES - 1 - i;
                            const { display, color, alpha } =
                                selectedDictionary.dictionaryTokenStatusConfig[tokenStatus];
                            const updateTokenStatusConfig = (newConfig: TokenStatusConfig) => {
                                const newConfigs = [...selectedDictionary.dictionaryTokenStatusConfig];
                                newConfigs[tokenStatus] = newConfig;
                                const newTracks = [...dictionaryTracks];
                                newTracks[selectedDictionaryTrack] = {
                                    ...newTracks[selectedDictionaryTrack],
                                    dictionaryTokenStatusConfig: newConfigs,
                                    dictionaryTokenStatusColors: newConfigs.map((config) => config.color),
                                    dictionaryColorizeFullyKnownTokens: newConfigs[getFullyKnownTokenStatus()].display,
                                };
                                onSettingChanged('dictionaryTracks', newTracks);
                            };
                            const localizedMaturity = t(`settings.dictionaryTokenStatus${tokenStatus}`);
                            const localizedReading = t(`settings.dictionaryTokenStatusReading${tokenStatus}`);
                            const frequency =
                                tokenStatus === TokenStatus.MATURE
                                    ? 1
                                    : tokenStatus === TokenStatus.YOUNG
                                      ? 23
                                      : tokenStatus === TokenStatus.GRADUATED
                                        ? 456
                                        : tokenStatus === TokenStatus.LEARNING
                                          ? 7890
                                          : tokenStatus === TokenStatus.UNKNOWN
                                            ? 12345
                                            : 678901;
                            const displayingDictionaryTrack: DictionaryTrack = {
                                ...selectedDictionary,
                                dictionaryColorizeSubtitles: true,
                            };
                            return (
                                <Stack
                                    key={i}
                                    direction="row"
                                    sx={{ margin: 0, padding: 0, opacity: display ? 1 : 0.5 }}
                                >
                                    <Stack
                                        sx={{
                                            width: '100%',
                                            '& .asb-reading': {
                                                rubyPosition: 'over',
                                            },
                                            '& .asb-reading rt': {
                                                fontSize: '0.5em',
                                                lineHeight: 1,
                                            },
                                            '& .asb-frequency': {
                                                rubyPosition: 'under',
                                            },
                                            '& .asb-frequency rt': {
                                                fontSize: '0.5em',
                                                lineHeight: 1,
                                            },
                                        }}
                                        spacing={1}
                                    >
                                        <div
                                            style={{
                                                ...subtitleStyles,
                                                fontSize: 24,
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexShrink: 0,
                                                backgroundImage: `linear-gradient(45deg, ${theme.palette.action.disabledBackground} 25%, transparent 25%), linear-gradient(-45deg, ${theme.palette.action.disabledBackground} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${theme.palette.action.disabledBackground} 75%), linear-gradient(-45deg, transparent 75%,${theme.palette.action.disabledBackground} 75%)`,
                                                backgroundSize: '20px 20px',
                                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                                            }}
                                        >
                                            <div
                                                style={{ padding: theme.spacing(1) }}
                                                dangerouslySetInnerHTML={{
                                                    __html: applyTokenStyle(
                                                        localizedMaturity,
                                                        {
                                                            pos: [0, localizedMaturity.length],
                                                            status: tokenStatus,
                                                            states: [],
                                                            readings: [
                                                                {
                                                                    pos: [0, localizedMaturity.length],
                                                                    reading: localizedReading,
                                                                },
                                                            ],
                                                            frequency,
                                                            __internal: true,
                                                        } as InternalToken,
                                                        true,
                                                        displayingDictionaryTrack
                                                    ),
                                                }}
                                            />
                                            <Switch
                                                sx={{ position: 'relative', left: 0 }}
                                                checked={display}
                                                onChange={(e) =>
                                                    updateTokenStatusConfig({
                                                        ...selectedDictionary.dictionaryTokenStatusConfig[tokenStatus],
                                                        display: e.target.checked,
                                                    })
                                                }
                                            />
                                        </div>
                                        <Stack direction="row" spacing={1} sx={{ flexGrow: 1, alignItems: 'center' }}>
                                            <TextField
                                                type="color"
                                                sx={{ width: '50%' }}
                                                value={color}
                                                color="primary"
                                                disabled={!display}
                                                onChange={(e) =>
                                                    updateTokenStatusConfig({
                                                        ...selectedDictionary.dictionaryTokenStatusConfig[tokenStatus],
                                                        color: e.target.value,
                                                    })
                                                }
                                            />
                                            <TextField
                                                type="number"
                                                label={t('settings.dictionaryTokenStatusAlpha')}
                                                sx={{ flexGrow: 1 }}
                                                value={Math.round(hex2ToPercent(alpha) * 100)}
                                                disabled={!display}
                                                onChange={(e) => {
                                                    const parsed = Number(e.target.value);
                                                    if (Number.isNaN(parsed)) return;
                                                    updateTokenStatusConfig({
                                                        ...selectedDictionary.dictionaryTokenStatusConfig[tokenStatus],
                                                        alpha: percentToHex2(Math.max(0, Math.min(100, parsed)) / 100),
                                                    });
                                                }}
                                                slotProps={{
                                                    htmlInput: { min: 0, max: 100, step: 1 },
                                                    input: {
                                                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                                    },
                                                }}
                                            />
                                        </Stack>
                                    </Stack>
                                </Stack>
                            );
                        })}
                    </Stack>
                ) : (
                    <>
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={selectedDictionary.dictionaryColorizeFullyKnownTokens}
                                    onChange={(e) => {
                                        const fullyKnownStatus = getFullyKnownTokenStatus();
                                        const newConfigs = [...selectedDictionary.dictionaryTokenStatusConfig];

                                        newConfigs[fullyKnownStatus] = {
                                            ...newConfigs[fullyKnownStatus],
                                            display: e.target.checked,
                                        };
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryColorizeFullyKnownTokens: e.target.checked,
                                            dictionaryTokenStatusConfig: newConfigs,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryColorizeFullyKnownTokens')}
                            labelPlacement="start"
                        />
                        {[...Array(NUM_TOKEN_STATUSES).keys()].map((i) => {
                            const tokenStatus: TokenStatus = NUM_TOKEN_STATUSES - 1 - i;
                            if (tokenStatus === tokenStylingToHide) return null;
                            return (
                                <SettingsTextField
                                    key={i}
                                    type="color"
                                    label={t(`settings.dictionaryTokenStatus${tokenStatus}`)}
                                    fullWidth
                                    value={selectedDictionary.dictionaryTokenStatusColors[tokenStatus]}
                                    color="primary"
                                    onChange={(e) => {
                                        const newColors = [...selectedDictionary.dictionaryTokenStatusColors];
                                        newColors[tokenStatus] = e.target.value;
                                        const newConfigs = [...selectedDictionary.dictionaryTokenStatusConfig];
                                        newConfigs[tokenStatus] = {
                                            ...newConfigs[tokenStatus],
                                            color: e.target.value,
                                        };

                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStatusColors: newColors,
                                            dictionaryTokenStatusConfig: newConfigs,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            );
                        })}
                    </>
                )}
            </Stack>
        </>
    );
};

export default DictionarySettingsTab;
