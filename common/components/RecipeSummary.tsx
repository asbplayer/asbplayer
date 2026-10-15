import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Stack,
    Typography,
    IconButton,
    TableContainer,
    Paper,
    Table,
    TableBody,
    TableRow,
    TableCell,
    MenuItem,
    Chip,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { recipeSettingGroups, NUM_DICTIONARY_TRACKS } from '@project/common/settings';
import type { Recipe, SubtitleVisibility, AutoPauseResumeMode } from '@project/common/settings';
import SettingsTextField from '@project/common/components/SettingsTextField';

import { playbackModeLabelLocKey } from '@project/common/playback/controllers/playback-mode-controller';
import { subtitleVisibilityLocKey } from '@project/common/playback/controllers/subtitle-visibility-controller';
import { autoPauseResumeModeLocKey } from '@project/common/playback/controllers/auto-pause-controller';
import { AutoPausePreference } from '@project/common';

const labels: Record<string, string> = {
    autoPauseFixedDurationMs: 'settings.autoPauseFixedDuration',
    fastForwardPlaybackMinimumSkipIntervalMs: 'settings.fastForwardPlaybackMinimumSkipInterval',
    streamingCondensedPlaybackMinimumSkipIntervalMs: 'settings.condensedPlaybackMinimumSkipInterval',
    autoPauseMinimumDurationMs: 'settings.autoPauseMinimumDuration',
    autoPauseMaximumDurationMs: 'settings.autoPauseMaximumDuration',
    autoPauseTimePerCharacterMs: 'settings.autoPauseTimePerCharacter',
    autoPauseResumeDelayMs: 'settings.autoPauseResumeDelay',
    fastForward: 'settings.dictionaryPlaybackFastForward',
    autoPause: 'settings.dictionaryPlaybackAutoPause',
    repeat: 'settings.dictionaryPlaybackRepeat',
    condensed: 'settings.dictionaryPlaybackCondensed',
    wordVisibility: 'settings.dictionaryPlaybackWordVisibility',
    minWords: 'settings.dictionaryPlaybackMinWords',
    maxWords: 'settings.dictionaryPlaybackMaxWords',
    minFrequency: 'settings.dictionaryPlaybackMinFrequency',
    maxFrequency: 'settings.dictionaryPlaybackMaxFrequency',
    enabled: 'pauseOnHoverMode.inNotOut',
    rateByComprehension: 'settings.dictionaryPlaybackFastForwardComprehension',
    hideWordsIndividuallyUntilThreshold: 'settings.dictionaryPlaybackHideWordsIndividuallyUntilThreshold',
    wholeSubtitleMatchThreshold: 'settings.dictionaryPlaybackWholeSubtitleMatchThreshold',
};

const groupLabels: Record<keyof typeof recipeSettingGroups, string> = {
    playback: 'extension.settings.playback',
    subtitleTriggers: 'settings.subtitleTriggers',
    autoPauseResumeMode: 'settings.autoPauseResumeMode',
    subtitleVisibility: 'settings.subtitleVisibility',
    repeat: 'controls.repeatMode',
    fastForward: 'controls.fastForwardMode',
    condensed: 'controls.condensedMode',
};

interface Props {
    recipe: Recipe;
    onRemove?: (path: string[]) => void;
}

export default function RecipeSummary({ recipe, onRemove }: Props) {
    const { t } = useTranslation();
    const [selectedTrack, setSelectedTrack] = useState(0);
    const includedTracks =
        recipe.settings.dictionaryTracks
            ?.map((track, index) => ({ track, index }))
            .filter(
                ({ track }) => track.dictionaryPlaybackConfig && Object.keys(track.dictionaryPlaybackConfig).length > 0
            ) ?? [];
    const trackIndex = includedTracks.some(({ index }) => index === selectedTrack)
        ? selectedTrack
        : includedTracks[0]?.index;
    const trackConfig =
        trackIndex === undefined ? undefined : recipe.settings.dictionaryTracks?.[trackIndex]?.dictionaryPlaybackConfig;
    const settingLabel = (key: string) => t(labels[key] ?? `settings.${key}`);
    const valueText = (key: string, value: unknown): string => {
        if (typeof value === 'boolean') return t(value ? 'pauseOnHoverMode.inNotOut' : 'pauseOnHoverMode.disabled');
        if (key === 'autoPausePreference') {
            return value === AutoPausePreference.atStart
                ? t('settings.autoPauseAtSubtitleStart')
                : value === AutoPausePreference.atEnd
                  ? t('settings.autoPauseAtSubtitleEnd')
                  : `${t('settings.autoPauseAtSubtitleStart')} + ${t('settings.autoPauseAtSubtitleEnd')}`;
        }
        if (key === 'pauseOnHoverMode') {
            return t(`pauseOnHoverMode.${['disabled', 'inAndOut', 'inNotOut'][Number(value)]}`);
        }
        if (key === 'subtitleVisibility') {
            return t(subtitleVisibilityLocKey(value as SubtitleVisibility));
        }
        if (key === 'autoPauseResumeMode') {
            return t(autoPauseResumeModeLocKey(value as AutoPauseResumeMode));
        }
        if (key === 'seekableTracks') {
            return (
                Array.from({ length: NUM_DICTIONARY_TRACKS }, (_, i) => i)
                    .filter((i) => (Number(value) & (1 << i)) !== 0)
                    .map((i) => t('settings.subtitleTrackChoice', { trackNumber: i + 1 }))
                    .join(', ') || t('pauseOnHoverMode.disabled')
            );
        }
        if (key === 'wholeSubtitleMatchThreshold') return `${Number(value) * 100}%`;
        return String(value);
    };
    const row = (label: string, key: string, value: unknown, path: string[]) => (
        <TableRow key={path.join('.')} sx={{ '&:last-child > *': { borderBottom: 0 } }}>
            <TableCell component="th" scope="row" sx={{ px: 1, overflowWrap: 'break-word' }}>
                {label}
            </TableCell>
            <TableCell align="right" sx={{ px: 1, overflowWrap: 'break-word' }}>
                {valueText(key, value)}
            </TableCell>
            {onRemove && (
                <TableCell sx={{ width: 40, boxSizing: 'border-box', px: 0.5 }}>
                    <IconButton
                        size="small"
                        aria-label={`${t('action.delete')} ${label}`}
                        onClick={() => onRemove(path)}
                    >
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                </TableCell>
            )}
        </TableRow>
    );
    const group = (key: string, label: string, rows: React.ReactNode[]) =>
        rows.length > 0 && (
            <Stack key={key} spacing={0.5}>
                <Typography variant="subtitle2" component="h3">
                    {label}
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ boxSizing: 'border-box' }}>
                    <Table size="small" aria-label={label} sx={{ tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: onRemove ? '55%' : '60%' }} />
                            <col />
                            {onRemove && <col style={{ width: 40 }} />}
                        </colgroup>
                        <TableBody>{rows}</TableBody>
                    </Table>
                </TableContainer>
            </Stack>
        );
    const dictionaryRows = (value: unknown, path: string[], label: string): React.ReactNode[] => {
        if (value === undefined || value === null) return [];
        if (typeof value !== 'object') return [row(label, path.at(-1)!, value, path)];
        return Object.entries(value).flatMap(([key, child]) => {
            let childLabel = settingLabel(key);
            if (path.at(-1) === 'onStatuses') {
                childLabel = t(`settings.dictionaryTokenStatus${key}`);
            } else if (path.at(-1) === 'onStates') {
                childLabel = t('settings.dictionaryTokenStateIgnored');
            } else if (
                key === 'rules' ||
                key === 'onStatuses' ||
                key === 'onStates' ||
                key === 'dictionaryPlaybackConfig'
            ) {
                childLabel = '';
            }
            return dictionaryRows(
                child,
                [...path, key],
                key === 'enabled' ? label : [label, childLabel].filter(Boolean).join(' — ')
            );
        });
    };
    return (
        <Stack spacing={2}>
            <Stack spacing={0.5}>
                <Typography variant="subtitle2" component="h3">
                    {t('settings.playbackModes')}
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                    {recipe.playbackModes.map((mode) => (
                        <Chip key={mode} size="small" label={t(playbackModeLabelLocKey(mode))} />
                    ))}
                </Stack>
            </Stack>
            {Object.entries(recipeSettingGroups).map(([key, keys]) => {
                const included = keys.filter((key) => recipe.settings[key] !== undefined);
                return group(
                    key,
                    t(groupLabels[key as keyof typeof recipeSettingGroups]),
                    included.map((key) => row(settingLabel(key), key, recipe.settings[key], [key]))
                );
            })}
            {trackIndex !== undefined && (
                <SettingsTextField
                    select
                    fullWidth
                    size="small"
                    label={t('settings.subtitleTrack')}
                    value={trackIndex}
                    onChange={(event) => setSelectedTrack(Number(event.target.value))}
                >
                    {includedTracks.map(({ index }) => (
                        <MenuItem key={index} value={index}>
                            {t('settings.subtitleTrackChoice', { trackNumber: index + 1 })}
                        </MenuItem>
                    ))}
                </SettingsTextField>
            )}
            {trackConfig &&
                Object.entries(trackConfig).map(([feature, config]) =>
                    group(
                        feature,
                        settingLabel(feature),
                        dictionaryRows(
                            config,
                            ['dictionaryTracks', String(trackIndex), 'dictionaryPlaybackConfig', feature],
                            ''
                        )
                    )
                )}
        </Stack>
    );
}
