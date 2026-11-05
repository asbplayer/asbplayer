import RecipeSettings from '@project/common/components/RecipeSettings';
import React, { useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import InputAdornment from '@mui/material/InputAdornment';
import {
    AutoPauseResumeMode,
    SubtitleVisibility,
    isTrackSeekable,
    PauseOnHoverMode,
    updateSeekableTracksValue,
    autoPausePreferenceForCheckboxChange,
    NUM_DICTIONARY_TRACKS,
} from '@project/common/settings';
import type { AsbplayerSettings } from '@project/common/settings';

import { AutoPausePreference } from '@project/common';
import SettingsSection, { SettingsSubSection } from '@project/common/components/SettingsSection';
import ResponsiveSettingsStack from '@project/common/components/ResponsiveSettingsStack';
import LabelWithHoverEffect from '@project/common/components/LabelWithHoverEffect';
import KeyboardShortcutLink from '@project/common/components/KeyboardShortcutLink';
import NumericSettingInput from '@project/common/components/NumericSettingInput';
import SettingsTextField from '@project/common/components/SettingsTextField';
import DictionaryPlaybackSettings from '@project/common/components/DictionaryPlaybackSettings';
import { normalizePlaybackRate, normalizeAutoPauseDurationBounds } from '@project/common/util';

interface Props {
    readOnly?: boolean;
    modes?: React.ReactNode;
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    extensionInstalled?: boolean;
    extensionSupportsPauseOnHover?: boolean;
    extensionSupportsSeekableTrackSetting?: boolean;
    supportsPlaybackEngine: boolean;
    supportsAutoPauseResume: boolean;
    onViewPlaybackModeKeyboardShortcuts: () => void;
    onViewPlaybackRateKeyboardShortcuts: () => void;
    onViewSubtitleKeyboardShortcuts: () => void;
    onAnnotationSettingsClick: () => void;
    supportsDictionaryPlayback: boolean;
    selectedDictionaryTrack: number;
    onSelectedDictionaryTrackChanged: (track: number) => void;
}

const PlaybackSettingsFields: React.FC<Props> = ({
    readOnly = false,
    modes,
    settings,
    onSettingChanged,
    onSettingsChanged,
    extensionInstalled,
    extensionSupportsPauseOnHover,
    extensionSupportsSeekableTrackSetting,
    supportsPlaybackEngine,
    supportsAutoPauseResume,
    onViewPlaybackModeKeyboardShortcuts,
    onViewPlaybackRateKeyboardShortcuts,
    onViewSubtitleKeyboardShortcuts,
    onAnnotationSettingsClick,
    supportsDictionaryPlayback,
    selectedDictionaryTrack,
    onSelectedDictionaryTrackChanged,
}) => {
    const { t } = useTranslation();
    const {
        seekableTracks,
        pauseOnHoverMode,
        autoPausePreference,
        subtitleTriggerStartOffset,
        subtitleTriggerEndOffset,
        subtitleTriggerGapEndOffset,
        subtitleTriggerGapStartOffset,
        playbackRate,
        fastForwardModePlaybackRate,
        fastForwardPlaybackMinimumSkipIntervalMs,
        repeatCountPreference,
        repeatsBeforeShowingSubtitles,
        autoPauseResumeMode,
        autoPauseResumeDelayMs,
        autoPauseFixedDurationMs,
        autoPauseMinimumDurationMs,
        autoPauseMaximumDurationMs,
        autoPauseTimePerCharacterMs,
        subtitleVisibility,
        streamingCondensedPlaybackMinimumSkipIntervalMs,
        dictionaryTracks,
    } = settings;
    const autoPauseAtStart = autoPausePreference !== AutoPausePreference.atEnd;
    const autoPauseAtEnd = autoPausePreference !== AutoPausePreference.atStart;
    const handleAutoPausePreferenceChanged = useCallback(
        (edge: AutoPausePreference.atStart | AutoPausePreference.atEnd, { checked }: { readonly checked: boolean }) => {
            void onSettingChanged(
                'autoPausePreference',
                autoPausePreferenceForCheckboxChange(autoPausePreference, edge, { checked })
            );
        },
        [autoPausePreference, onSettingChanged]
    );
    const handleAutoPauseMinimumDurationChanged = useCallback(
        (minimumDurationMs: number) => {
            const bounds = normalizeAutoPauseDurationBounds(minimumDurationMs, autoPauseMaximumDurationMs);
            onSettingsChanged({
                autoPauseMinimumDurationMs: bounds.minimumDurationMs,
                autoPauseMaximumDurationMs: bounds.maximumDurationMs,
            });
        },
        [autoPauseMaximumDurationMs, onSettingsChanged]
    );
    const handleAutoPauseMaximumDurationChanged = useCallback(
        (maximumDurationMs: number) => {
            const bounds = normalizeAutoPauseDurationBounds(autoPauseMinimumDurationMs, maximumDurationMs);
            onSettingsChanged({
                autoPauseMinimumDurationMs: bounds.minimumDurationMs,
                autoPauseMaximumDurationMs: bounds.maximumDurationMs,
            });
        },
        [autoPauseMinimumDurationMs, onSettingsChanged]
    );
    return (
        <React.Fragment>
            <SettingsSection>{t('extension.settings.playback')}</SettingsSection>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(!extensionInstalled || extensionSupportsSeekableTrackSetting) && (
                    <FormControl>
                        <FormLabel component="legend" sx={{ display: 'flex' }}>
                            {t('settings.seekableTracks')}
                            <KeyboardShortcutLink onClick={onViewSubtitleKeyboardShortcuts} preset="formLabel" />
                        </FormLabel>
                        <FormGroup>
                            {[0, 1, 2].map((trackIndex) => {
                                return (
                                    <FormControlLabel
                                        key={trackIndex}
                                        control={
                                            <Checkbox
                                                disabled={readOnly}
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
                {(!extensionInstalled || extensionSupportsPauseOnHover) && (
                    <FormControl>
                        <FormLabel component="legend">{t('settings.pauseOnHoverMode')}</FormLabel>
                        <RadioGroup row={false}>
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        disabled={readOnly}
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
                                        disabled={readOnly}
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
                                        disabled={readOnly}
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
                <SettingsSection>
                    {t('settings.playbackModes')}
                    <KeyboardShortcutLink onClick={onViewPlaybackModeKeyboardShortcuts} />
                </SettingsSection>
                {modes}
                {supportsPlaybackEngine && (
                    <>
                        <NumericSettingInput
                            disabled={readOnly}
                            fullWidth
                            label={
                                <>
                                    {t('settings.playbackRate')}
                                    <KeyboardShortcutLink
                                        onClick={onViewPlaybackRateKeyboardShortcuts}
                                        preset="numericalInputLabel"
                                    />
                                </>
                            }
                            value={playbackRate}
                            color="primary"
                            normalizeValue={normalizePlaybackRate}
                            onValueChange={(value) => void onSettingChanged('playbackRate', value)}
                            slotProps={{
                                htmlInput: {
                                    min: 0,
                                    step: 0.05,
                                },
                            }}
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
                                            disabled={readOnly}
                                            checked={autoPauseAtStart}
                                            onChange={(event) =>
                                                handleAutoPausePreferenceChanged(AutoPausePreference.atStart, {
                                                    checked: event.target.checked,
                                                })
                                            }
                                        />
                                    }
                                    label={t('settings.autoPauseAtSubtitleStart')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Checkbox
                                            disabled={readOnly}
                                            checked={autoPauseAtEnd}
                                            onChange={(event) =>
                                                handleAutoPausePreferenceChanged(AutoPausePreference.atEnd, {
                                                    checked: event.target.checked,
                                                })
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
                                        disabled={readOnly}
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
                                        disabled={readOnly}
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
                {supportsAutoPauseResume && (
                    <>
                        <FormControl>
                            <FormLabel component="legend" sx={{ display: 'flex' }}>
                                {t('settings.autoPauseResumeMode')}
                                <KeyboardShortcutLink
                                    onClick={onViewPlaybackModeKeyboardShortcuts}
                                    preset="formLabel"
                                />
                            </FormLabel>
                            <RadioGroup>
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            disabled={readOnly}
                                            checked={autoPauseResumeMode === AutoPauseResumeMode.manual}
                                            value={AutoPauseResumeMode.manual}
                                            onChange={(event) =>
                                                event.target.checked &&
                                                void onSettingChanged('autoPauseResumeMode', AutoPauseResumeMode.manual)
                                            }
                                        />
                                    }
                                    label={t('settings.autoPauseResumeModeManual')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            disabled={readOnly}
                                            checked={autoPauseResumeMode === AutoPauseResumeMode.fixed}
                                            value={AutoPauseResumeMode.fixed}
                                            onChange={(event) =>
                                                event.target.checked &&
                                                void onSettingChanged('autoPauseResumeMode', AutoPauseResumeMode.fixed)
                                            }
                                        />
                                    }
                                    label={t('settings.autoPauseResumeModeFixed')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            disabled={readOnly}
                                            checked={autoPauseResumeMode === AutoPauseResumeMode.subtitleLength}
                                            value={AutoPauseResumeMode.subtitleLength}
                                            onChange={(event) =>
                                                event.target.checked &&
                                                void onSettingChanged(
                                                    'autoPauseResumeMode',
                                                    AutoPauseResumeMode.subtitleLength
                                                )
                                            }
                                        />
                                    }
                                    label={t('settings.autoPauseResumeModeSubtitleLength')}
                                />
                            </RadioGroup>
                        </FormControl>
                        {autoPauseResumeMode === AutoPauseResumeMode.fixed && (
                            <ResponsiveSettingsStack>
                                <NumericSettingInput
                                    disabled={readOnly}
                                    color="primary"
                                    fullWidth
                                    label={t('settings.autoPauseFixedDuration')}
                                    value={autoPauseFixedDurationMs}
                                    onValueChange={(value) => void onSettingChanged('autoPauseFixedDurationMs', value)}
                                    slotProps={{
                                        htmlInput: { min: 0, step: 1 },
                                        input: { endAdornment: <InputAdornment position="end">ms</InputAdornment> },
                                    }}
                                />
                                <NumericSettingInput
                                    disabled={readOnly}
                                    color="primary"
                                    fullWidth
                                    label={t('settings.autoPauseResumeDelay')}
                                    value={autoPauseResumeDelayMs}
                                    onValueChange={(value) => void onSettingChanged('autoPauseResumeDelayMs', value)}
                                    slotProps={{
                                        htmlInput: { min: 0, step: 1 },
                                        input: { endAdornment: <InputAdornment position="end">ms</InputAdornment> },
                                    }}
                                />
                            </ResponsiveSettingsStack>
                        )}
                        {autoPauseResumeMode === AutoPauseResumeMode.subtitleLength && (
                            <>
                                <ResponsiveSettingsStack>
                                    <NumericSettingInput
                                        disabled={readOnly}
                                        color="primary"
                                        fullWidth
                                        label={t('settings.autoPauseMinimumDuration')}
                                        value={autoPauseMinimumDurationMs}
                                        onValueChange={handleAutoPauseMinimumDurationChanged}
                                        slotProps={{
                                            htmlInput: { min: 0, step: 1 },
                                            input: { endAdornment: <InputAdornment position="end">ms</InputAdornment> },
                                        }}
                                    />
                                    <NumericSettingInput
                                        disabled={readOnly}
                                        color="primary"
                                        fullWidth
                                        label={t('settings.autoPauseMaximumDuration')}
                                        helperText={t('settings.autoPauseMaximumDurationHelperText')}
                                        value={autoPauseMaximumDurationMs}
                                        onValueChange={handleAutoPauseMaximumDurationChanged}
                                        slotProps={{
                                            htmlInput: { min: 0, step: 1 },
                                            input: { endAdornment: <InputAdornment position="end">ms</InputAdornment> },
                                        }}
                                    />
                                </ResponsiveSettingsStack>
                                <ResponsiveSettingsStack>
                                    <NumericSettingInput
                                        disabled={readOnly}
                                        color="primary"
                                        fullWidth
                                        label={t('settings.autoPauseTimePerCharacter')}
                                        value={autoPauseTimePerCharacterMs}
                                        onValueChange={(value) =>
                                            void onSettingChanged('autoPauseTimePerCharacterMs', value)
                                        }
                                        slotProps={{
                                            htmlInput: { min: 0, step: 1 },
                                            input: { endAdornment: <InputAdornment position="end">ms</InputAdornment> },
                                        }}
                                    />
                                    <NumericSettingInput
                                        disabled={readOnly}
                                        color="primary"
                                        fullWidth
                                        label={t('settings.autoPauseResumeDelay')}
                                        value={autoPauseResumeDelayMs}
                                        onValueChange={(value) =>
                                            void onSettingChanged('autoPauseResumeDelayMs', value)
                                        }
                                        slotProps={{
                                            htmlInput: { min: 0, step: 1 },
                                            input: { endAdornment: <InputAdornment position="end">ms</InputAdornment> },
                                        }}
                                    />
                                </ResponsiveSettingsStack>
                            </>
                        )}
                        <FormControl>
                            <FormLabel component="legend" sx={{ display: 'flex' }}>
                                {t('settings.subtitleVisibility')}
                                <KeyboardShortcutLink
                                    onClick={onViewPlaybackModeKeyboardShortcuts}
                                    preset="formLabel"
                                />
                            </FormLabel>
                            <RadioGroup row>
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            disabled={readOnly}
                                            checked={subtitleVisibility === SubtitleVisibility.whenDue}
                                            value={SubtitleVisibility.whenDue}
                                            onChange={(event) =>
                                                event.target.checked &&
                                                void onSettingChanged('subtitleVisibility', SubtitleVisibility.whenDue)
                                            }
                                        />
                                    }
                                    label={t('settings.subtitleVisibilityWhenDue')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            disabled={readOnly}
                                            checked={subtitleVisibility === SubtitleVisibility.whilePaused}
                                            value={SubtitleVisibility.whilePaused}
                                            onChange={(event) =>
                                                event.target.checked &&
                                                void onSettingChanged(
                                                    'subtitleVisibility',
                                                    SubtitleVisibility.whilePaused
                                                )
                                            }
                                        />
                                    }
                                    label={t('settings.subtitleVisibilityWhilePaused')}
                                />
                                {supportsDictionaryPlayback && (
                                    <LabelWithHoverEffect
                                        control={
                                            <Radio
                                                disabled={readOnly}
                                                checked={subtitleVisibility === SubtitleVisibility.whileManuallyPaused}
                                                value={SubtitleVisibility.whileManuallyPaused}
                                                onChange={(event) =>
                                                    event.target.checked &&
                                                    void onSettingChanged(
                                                        'subtitleVisibility',
                                                        SubtitleVisibility.whileManuallyPaused
                                                    )
                                                }
                                            />
                                        }
                                        label={t('settings.subtitleVisibilityWhileManuallyPaused')}
                                    />
                                )}
                            </RadioGroup>
                        </FormControl>
                    </>
                )}
                {supportsPlaybackEngine && (
                    <>
                        <ResponsiveSettingsStack>
                            <NumericSettingInput
                                disabled={readOnly}
                                color="primary"
                                fullWidth
                                label={t('settings.repeatCountPreference')}
                                commitOnBlur
                                integerOnly
                                helperText={t('settings.repeatCountPreferenceHelperText')}
                                value={repeatCountPreference}
                                normalizeValue={(value) => Math.max(0, Math.floor(value))}
                                onValueChange={(value) =>
                                    onSettingsChanged({
                                        repeatCountPreference: value,
                                        ...(supportsDictionaryPlayback && {
                                            repeatsBeforeShowingSubtitles: value
                                                ? Math.min(repeatsBeforeShowingSubtitles, value)
                                                : repeatsBeforeShowingSubtitles,
                                        }),
                                    })
                                }
                                slotProps={{
                                    htmlInput: {
                                        min: 0,
                                        step: 1,
                                    },
                                }}
                            />
                            {supportsDictionaryPlayback && (
                                <NumericSettingInput
                                    disabled={readOnly}
                                    color="primary"
                                    fullWidth
                                    label={t('settings.repeatsBeforeShowingSubtitles')}
                                    commitOnBlur
                                    integerOnly
                                    value={Math.min(repeatsBeforeShowingSubtitles, repeatCountPreference || Infinity)}
                                    normalizeValue={(value) =>
                                        Math.min(Math.max(0, Math.floor(value)), repeatCountPreference || Infinity)
                                    }
                                    onValueChange={(value) =>
                                        void onSettingChanged('repeatsBeforeShowingSubtitles', value)
                                    }
                                    slotProps={{
                                        htmlInput: { min: 0, max: repeatCountPreference || undefined, step: 1 },
                                    }}
                                />
                            )}
                        </ResponsiveSettingsStack>
                        <ResponsiveSettingsStack>
                            <NumericSettingInput
                                disabled={readOnly}
                                color="primary"
                                fullWidth
                                label={t('settings.subtitleTriggerStartOffset')}
                                value={subtitleTriggerStartOffset}
                                onValueChange={(value) => void onSettingChanged('subtitleTriggerStartOffset', value)}
                                slotProps={{
                                    htmlInput: {
                                        step: 1,
                                    },
                                    input: {
                                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                    },
                                }}
                            />
                            <NumericSettingInput
                                disabled={readOnly}
                                color="primary"
                                fullWidth
                                label={t('settings.subtitleTriggerEndOffset')}
                                value={subtitleTriggerEndOffset}
                                onValueChange={(value) => void onSettingChanged('subtitleTriggerEndOffset', value)}
                                slotProps={{
                                    htmlInput: {
                                        step: 1,
                                    },
                                    input: {
                                        endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                                    },
                                }}
                            />
                        </ResponsiveSettingsStack>
                        <Typography variant="caption" color="textSecondary">
                            {t('settings.subtitleTriggerOffsetHelperText')}
                        </Typography>
                    </>
                )}
                <SettingsSubSection>{t('settings.subtitleGapTriggers')}</SettingsSubSection>
                <ResponsiveSettingsStack>
                    {supportsPlaybackEngine && (
                        <NumericSettingInput
                            disabled={readOnly}
                            color="primary"
                            fullWidth
                            label={t('settings.fastForwardPlaybackMinimumSkipInterval')}
                            value={fastForwardPlaybackMinimumSkipIntervalMs}
                            onValueChange={(value) =>
                                void onSettingChanged('fastForwardPlaybackMinimumSkipIntervalMs', value)
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
                    <NumericSettingInput
                        disabled={readOnly}
                        fullWidth
                        label={t('settings.fastForwardModePlaybackRate')}
                        value={fastForwardModePlaybackRate}
                        color="primary"
                        normalizeValue={normalizePlaybackRate}
                        onValueChange={(value) => void onSettingChanged('fastForwardModePlaybackRate', value)}
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                step: 0.05,
                            },
                        }}
                    />
                </ResponsiveSettingsStack>
                <NumericSettingInput
                    disabled={readOnly}
                    color="primary"
                    fullWidth
                    label={t('settings.condensedPlaybackMinimumSkipInterval')}
                    value={streamingCondensedPlaybackMinimumSkipIntervalMs}
                    onValueChange={(value) =>
                        void onSettingChanged('streamingCondensedPlaybackMinimumSkipIntervalMs', value)
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
                        <ResponsiveSettingsStack>
                            <NumericSettingInput
                                disabled={readOnly}
                                color="primary"
                                fullWidth
                                label={t('settings.subtitleTriggerGapStartOffset')}
                                value={subtitleTriggerGapStartOffset}
                                onValueChange={(value) => void onSettingChanged('subtitleTriggerGapStartOffset', value)}
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
                            <NumericSettingInput
                                disabled={readOnly}
                                color="primary"
                                fullWidth
                                label={t('settings.subtitleTriggerGapEndOffset')}
                                value={subtitleTriggerGapEndOffset}
                                onValueChange={(value) => void onSettingChanged('subtitleTriggerGapEndOffset', value)}
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
                        </ResponsiveSettingsStack>
                        <Typography variant="caption" color="textSecondary">
                            {t('settings.subtitleTriggerGapOffsetHelperText')}
                        </Typography>
                    </>
                )}
            </div>
            {supportsDictionaryPlayback && (
                <div id="dictionary-playback-settings">
                    <SettingsSection docs="docs/reference/settings#playback-annotation">
                        {t('settings.annotation')}
                    </SettingsSection>
                    <Typography variant="caption" color="textSecondary">
                        <Trans
                            i18nKey="settings.dictionaryPlaybackAnnotationDataHelper"
                            values={{ section: t('settings.annotation') }}
                            components={[<Link key={0} component="button" onClick={onAnnotationSettingsClick} />]}
                        />
                    </Typography>
                    <Stack spacing={2}>
                        <SettingsTextField
                            select
                            fullWidth
                            color="primary"
                            variant="outlined"
                            size="small"
                            label={t('settings.subtitleTrack')}
                            value={selectedDictionaryTrack}
                            onChange={(event) => onSelectedDictionaryTrackChanged(Number(event.target.value))}
                        >
                            {[...Array(NUM_DICTIONARY_TRACKS).keys()].map((track) => (
                                <MenuItem key={track} value={track}>
                                    {t('settings.subtitleTrackChoice', { trackNumber: track + 1 })}
                                </MenuItem>
                            ))}
                        </SettingsTextField>
                        <DictionaryPlaybackSettings
                            disabled={readOnly}
                            config={dictionaryTracks[selectedDictionaryTrack].dictionaryPlaybackConfig}
                            onChange={(dictionaryPlaybackConfig) => {
                                const newTracks = [...dictionaryTracks];
                                newTracks[selectedDictionaryTrack] = {
                                    ...newTracks[selectedDictionaryTrack],
                                    dictionaryPlaybackConfig,
                                };
                                void onSettingChanged('dictionaryTracks', newTracks);
                            }}
                        />
                    </Stack>
                </div>
            )}
        </React.Fragment>
    );
};

const PlaybackSettingsTab: React.FC<Props> = (props) =>
    props.supportsDictionaryPlayback ? (
        <RecipeSettings settings={props.settings} onSettingsChanged={props.onSettingsChanged}>
            {(settings, onChange, modes, readOnly) => (
                <PlaybackSettingsFields
                    {...props}
                    settings={settings}
                    modes={modes}
                    readOnly={readOnly}
                    onSettingsChanged={onChange}
                    onSettingChanged={async (key, value) => onChange({ [key]: value })}
                />
            )}
        </RecipeSettings>
    ) : (
        <PlaybackSettingsFields {...props} />
    );

export default PlaybackSettingsTab;
