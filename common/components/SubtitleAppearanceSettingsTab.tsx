import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import UndoIcon from '@mui/icons-material/Undo';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import MenuItem from '@mui/material/MenuItem';
import DeleteIcon from '@mui/icons-material/Delete';
import Radio from '@mui/material/Radio';
import {
    AsbplayerSettings,
    TextSubtitleSettings,
    changeForTextSubtitleSetting,
    textSubtitleSettingsAreDirty,
    textSubtitleSettingsForTrack,
} from '@project/common/settings';
import { isNumeric } from '@project/common/util';
import { CustomStyle } from '@project/common/settings';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import RadioGroup from '@mui/material/RadioGroup';
import Tooltip from './Tooltip';
import Autocomplete from '@mui/material/Autocomplete';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import SubtitleAppearanceTrackSelector from './SubtitleAppearanceTrackSelector';
import SubtitlePreview from './SubtitlePreview';
import Stack from '@mui/material/Stack';
import SettingsTextField from './SettingsTextField';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import SettingsSection from './SettingsSection';

// Filter out keys that look like '0', '1', ... as those are invalid
const cssStyles = Object.keys(document.body.style).filter((s) => !isNumeric(s));

interface AddCustomStyleProps {
    styleKey: string;
    onStyleKey: (styleKey: string) => void;
    onAddCustomStyle: (styleKey: string) => void;
}

function AddCustomStyle({ styleKey, onStyleKey, onAddCustomStyle }: AddCustomStyleProps) {
    const { t } = useTranslation();
    return (
        <Autocomplete
            options={cssStyles}
            value={styleKey}
            fullWidth
            disableClearable
            clearOnEscape
            clearOnBlur
            forcePopupIcon={false}
            onReset={() => onStyleKey('')}
            onChange={(event, newValue) => {
                onStyleKey(newValue ?? '');
            }}
            renderInput={(params) => (
                <SettingsTextField
                    placeholder={t('settings.styleKey')!}
                    label={t('settings.addCustomCss')}
                    color="primary"
                    {...params}
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    disabled={cssStyles.find((s) => s === styleKey) === undefined}
                                    onClick={() => {
                                        onAddCustomStyle(styleKey);
                                        onStyleKey(cssStyles[0]);
                                    }}
                                >
                                    <AddIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            )}
        />
    );
}

interface CustomStyleSettingProps {
    customStyle: CustomStyle;
    onCustomStyle: (style: CustomStyle) => void;
    onDelete: () => void;
}

function CustomStyleSetting({ customStyle, onCustomStyle, onDelete }: CustomStyleSettingProps) {
    const { t } = useTranslation();

    return (
        <SettingsTextField
            color="primary"
            label={t('settings.customCssField', { styleKey: customStyle.key })}
            placeholder={t('settings.styleValue')!}
            value={customStyle.value}
            onChange={(e) => onCustomStyle({ key: customStyle.key, value: e.target.value })}
            slotProps={{
                input: {
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton onClick={onDelete}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ),
                },
            }}
        />
    );
}

interface Props {
    settings: AsbplayerSettings;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    extensionInstalled?: boolean;
    extensionSupportsTrackSpecificSettings?: boolean;
    extensionSupportsSubtitlesWidthSetting?: boolean;
    localFontsAvailable: boolean;
    localFontsPermission?: PermissionState;
    localFontFamilies: string[];
    onUnlockLocalFonts: () => void;
}

const SubtitleAppearanceSettingsTab: React.FC<Props> = ({
    settings,
    onSettingChanged,
    onSettingsChanged,
    extensionInstalled,
    extensionSupportsTrackSpecificSettings,
    extensionSupportsSubtitlesWidthSetting,
    localFontsAvailable,
    localFontsPermission,
    localFontFamilies,
    onUnlockLocalFonts,
}) => {
    const { t } = useTranslation();
    const {
        subtitlePreview,
        imageBasedSubtitleScaleFactor,
        subtitlePositionOffset,
        topSubtitlePositionOffset,
        subtitlesWidth,
    } = settings;
    const [currentStyleKey, setCurrentStyleKey] = useState<string>(cssStyles[0]);
    const [selectedSubtitleAppearanceTrack, setSelectedSubtitleAppearanceTrack] = useState<number>();
    const {
        subtitleSize,
        subtitleColor,
        subtitleThickness,
        subtitleOutlineThickness,
        subtitleOutlineColor,
        subtitleShadowThickness,
        subtitleShadowColor,
        subtitleBackgroundColor,
        subtitleBackgroundOpacity,
        subtitleFontFamily,
        subtitleCustomStyles,
        subtitleBlur,
        subtitleAlignment,
    } = textSubtitleSettingsForTrack(settings, selectedSubtitleAppearanceTrack);
    const handleSubtitleTextSettingChanged = useCallback(
        <K extends keyof TextSubtitleSettings>(key: K, value: TextSubtitleSettings[K]) => {
            // See settings.ts for more info about how/why subtitle settings are interpreted
            const diff = changeForTextSubtitleSetting({ [key]: value }, settings, selectedSubtitleAppearanceTrack);
            onSettingsChanged(diff);
        },
        [selectedSubtitleAppearanceTrack, settings, onSettingsChanged]
    );

    const handleResetSubtitleTrack = useCallback(() => {
        const diff = changeForTextSubtitleSetting(
            textSubtitleSettingsForTrack(settings, 0),
            settings,
            selectedSubtitleAppearanceTrack
        );
        onSettingsChanged(diff);
    }, [settings, selectedSubtitleAppearanceTrack, onSettingsChanged]);

    const selectedSubtitleAppearanceTrackIsDirty =
        selectedSubtitleAppearanceTrack !== undefined &&
        textSubtitleSettingsAreDirty(settings, selectedSubtitleAppearanceTrack);
    return (
        <Stack spacing={1}>
            {(!extensionInstalled || extensionSupportsTrackSpecificSettings) && (
                <>
                    <SubtitleAppearanceTrackSelector
                        track={selectedSubtitleAppearanceTrack === undefined ? 'all' : selectedSubtitleAppearanceTrack}
                        onTrackSelected={(t) => setSelectedSubtitleAppearanceTrack(t === 'all' ? undefined : t)}
                    />
                    {selectedSubtitleAppearanceTrack !== undefined && (
                        <Button
                            startIcon={<UndoIcon />}
                            disabled={!selectedSubtitleAppearanceTrackIsDirty}
                            onClick={handleResetSubtitleTrack}
                            variant="outlined"
                        >
                            {t('settings.reset')}
                        </Button>
                    )}
                </>
            )}
            <SubtitlePreview
                subtitleSettings={settings}
                text={subtitlePreview}
                onTextChanged={(text) => onSettingChanged('subtitlePreview', text)}
            />
            <SettingsSection>{t('settings.styling')}</SettingsSection>
            {subtitleColor !== undefined && (
                <SettingsTextField
                    type="color"
                    label={t('settings.subtitleColor')}
                    fullWidth
                    value={subtitleColor}
                    color="primary"
                    onChange={(event) => handleSubtitleTextSettingChanged('subtitleColor', event.target.value)}
                />
            )}
            {subtitleSize !== undefined && (
                <SettingsTextField
                    type="number"
                    label={t('settings.subtitleSize')}
                    fullWidth
                    value={subtitleSize}
                    color="primary"
                    onChange={(event) => handleSubtitleTextSettingChanged('subtitleSize', Number(event.target.value))}
                    slotProps={{
                        htmlInput: {
                            min: 1,
                            step: 1,
                        },
                    }}
                />
            )}
            {subtitleThickness !== undefined && (
                <>
                    <Typography variant="subtitle2" color="textSecondary">
                        {t('settings.subtitleThickness')}
                    </Typography>
                    <Slider
                        color="primary"
                        value={subtitleThickness}
                        onChange={(event, value) =>
                            handleSubtitleTextSettingChanged('subtitleThickness', value as number)
                        }
                        min={100}
                        max={900}
                        step={100}
                        marks
                        valueLabelDisplay="auto"
                    />
                </>
            )}
            {subtitleOutlineColor !== undefined && (
                <SettingsTextField
                    type="color"
                    label={t('settings.subtitleOutlineColor')}
                    fullWidth
                    value={subtitleOutlineColor}
                    color="primary"
                    onChange={(event) => handleSubtitleTextSettingChanged('subtitleOutlineColor', event.target.value)}
                />
            )}
            {subtitleOutlineThickness !== undefined && (
                <SettingsTextField
                    type="number"
                    label={t('settings.subtitleOutlineThickness')}
                    helperText={t('settings.subtitleOutlineThicknessHelperText')}
                    fullWidth
                    value={subtitleOutlineThickness}
                    onChange={(event) =>
                        handleSubtitleTextSettingChanged('subtitleOutlineThickness', Number(event.target.value))
                    }
                    slotProps={{
                        htmlInput: {
                            min: 0,
                            step: 0.1,
                        },
                    }}
                    color="primary"
                />
            )}
            {subtitleShadowColor !== undefined && (
                <SettingsTextField
                    type="color"
                    label={t('settings.subtitleShadowColor')}
                    fullWidth
                    value={subtitleShadowColor}
                    color="primary"
                    onChange={(event) => handleSubtitleTextSettingChanged('subtitleShadowColor', event.target.value)}
                />
            )}
            {subtitleShadowThickness !== undefined && (
                <SettingsTextField
                    type="number"
                    label={t('settings.subtitleShadowThickness')}
                    fullWidth
                    value={subtitleShadowThickness}
                    onChange={(event) =>
                        handleSubtitleTextSettingChanged('subtitleShadowThickness', Number(event.target.value))
                    }
                    slotProps={{
                        htmlInput: {
                            min: 0,
                            step: 0.1,
                        },
                    }}
                    color="primary"
                />
            )}
            {subtitleBackgroundColor !== undefined && (
                <SettingsTextField
                    type="color"
                    label={t('settings.subtitleBackgroundColor')}
                    fullWidth
                    value={subtitleBackgroundColor}
                    color="primary"
                    onChange={(event) =>
                        handleSubtitleTextSettingChanged('subtitleBackgroundColor', event.target.value)
                    }
                />
            )}
            {subtitleBackgroundOpacity !== undefined && (
                <SettingsTextField
                    type="number"
                    label={t('settings.subtitleBackgroundOpacity')}
                    fullWidth
                    slotProps={{
                        htmlInput: {
                            min: 0,
                            max: 1,
                            step: 0.1,
                        },
                    }}
                    value={subtitleBackgroundOpacity}
                    color="primary"
                    onChange={(event) =>
                        handleSubtitleTextSettingChanged('subtitleBackgroundOpacity', Number(event.target.value))
                    }
                />
            )}
            {subtitleFontFamily !== undefined && (
                <FormControl fullWidth>
                    <FormLabel>{t('settings.subtitleFontFamily')}</FormLabel>
                    <SettingsTextField
                        type="text"
                        select={localFontFamilies.length > 0}
                        // label={t('settings.subtitleFontFamily')}
                        fullWidth
                        value={subtitleFontFamily}
                        color="primary"
                        onChange={(event) => handleSubtitleTextSettingChanged('subtitleFontFamily', event.target.value)}
                        slotProps={{
                            input: {
                                endAdornment:
                                    localFontFamilies.length === 0 &&
                                    localFontsAvailable &&
                                    localFontsPermission === 'prompt' ? (
                                        <Tooltip title={t('settings.unlockLocalFonts')!}>
                                            <IconButton onClick={onUnlockLocalFonts}>
                                                <LockIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    ) : null,
                            },
                        }}
                    >
                        {localFontFamilies.length > 0
                            ? localFontFamilies.map((f) => (
                                  <MenuItem key={f} value={f}>
                                      {f}
                                  </MenuItem>
                              ))
                            : null}
                    </SettingsTextField>
                </FormControl>
            )}

            {subtitleCustomStyles !== undefined && (
                <>
                    {subtitleCustomStyles.map((customStyle, index) => {
                        return (
                            <CustomStyleSetting
                                key={index}
                                customStyle={customStyle}
                                onCustomStyle={(newCustomStyle: CustomStyle) => {
                                    const newValue = [...settings.subtitleCustomStyles];
                                    newValue[index] = { ...newCustomStyle };
                                    handleSubtitleTextSettingChanged('subtitleCustomStyles', newValue);
                                }}
                                onDelete={() => {
                                    const newValue: CustomStyle[] = [];
                                    for (let j = 0; j < settings.subtitleCustomStyles.length; ++j) {
                                        if (j !== index) {
                                            newValue.push(settings.subtitleCustomStyles[j]);
                                        }
                                    }
                                    handleSubtitleTextSettingChanged('subtitleCustomStyles', newValue);
                                }}
                            />
                        );
                    })}
                    <AddCustomStyle
                        styleKey={currentStyleKey}
                        onStyleKey={setCurrentStyleKey}
                        onAddCustomStyle={(styleKey) =>
                            handleSubtitleTextSettingChanged('subtitleCustomStyles', [
                                ...settings.subtitleCustomStyles,
                                { key: styleKey, value: '' },
                            ])
                        }
                    />
                </>
            )}

            {subtitleBlur !== undefined && (
                <Tooltip placement="bottom-end" title={t('settings.subtitleBlurDescription')!}>
                    <SwitchLabelWithHoverEffect
                        control={
                            <Switch
                                checked={subtitleBlur}
                                onChange={(e) => {
                                    handleSubtitleTextSettingChanged('subtitleBlur', e.target.checked);
                                }}
                            />
                        }
                        label={t('settings.subtitleBlur')}
                        labelPlacement="start"
                    />
                </Tooltip>
            )}

            {selectedSubtitleAppearanceTrack === undefined && (
                <SettingsTextField
                    type="number"
                    label={t('settings.imageBasedSubtitleScaleFactor')}
                    placeholder="Inherited"
                    fullWidth
                    slotProps={{
                        htmlInput: {
                            min: 0,
                            max: 1,
                            step: 0.1,
                        },
                    }}
                    value={imageBasedSubtitleScaleFactor}
                    color="primary"
                    onChange={(event) => onSettingChanged('imageBasedSubtitleScaleFactor', Number(event.target.value))}
                />
            )}

            <SettingsSection>{t('settings.layout')}</SettingsSection>
            {subtitleAlignment !== undefined && (
                <FormControl>
                    <FormLabel component="legend">{t('settings.subtitleAlignment')}</FormLabel>
                    <RadioGroup row>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={subtitleAlignment === 'bottom'}
                                    value={'bottom'}
                                    onChange={(event) =>
                                        event.target.checked &&
                                        handleSubtitleTextSettingChanged('subtitleAlignment', 'bottom')
                                    }
                                />
                            }
                            label={t('settings.subtitleAlignmentBottom')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={subtitleAlignment === 'top'}
                                    value={'top'}
                                    onChange={(event) =>
                                        event.target.checked &&
                                        handleSubtitleTextSettingChanged('subtitleAlignment', 'top')
                                    }
                                />
                            }
                            label={t('settings.subtitleAlignmentTop')}
                        />
                    </RadioGroup>
                </FormControl>
            )}

            {selectedSubtitleAppearanceTrack === undefined && (
                <>
                    <SettingsTextField
                        type="number"
                        color="primary"
                        fullWidth
                        label={t('settings.subtitlePositionOffset')}
                        value={subtitlePositionOffset}
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                step: 1,
                            },
                        }}
                        onChange={(e) => onSettingChanged('subtitlePositionOffset', Number(e.target.value))}
                    />
                    <SettingsTextField
                        type="number"
                        color="primary"
                        fullWidth
                        label={t('settings.topSubtitlePositionOffset')}
                        value={topSubtitlePositionOffset}
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                step: 1,
                            },
                        }}
                        onChange={(e) => onSettingChanged('topSubtitlePositionOffset', Number(e.target.value))}
                    />
                    {(!extensionInstalled || extensionSupportsSubtitlesWidthSetting) && (
                        <SettingsTextField
                            color="primary"
                            fullWidth
                            label={t('settings.subtitlesWidth')}
                            disabled={subtitlesWidth === -1}
                            value={subtitlesWidth === -1 ? 'auto' : subtitlesWidth}
                            onChange={(e) => {
                                const numberValue = Number(e.target.value);

                                if (!Number.isNaN(numberValue) && numberValue >= 0 && numberValue <= 100) {
                                    onSettingChanged('subtitlesWidth', numberValue);
                                }
                            }}
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <>
                                            {subtitlesWidth === -1 && (
                                                <InputAdornment position="end">
                                                    <IconButton onClick={() => onSettingChanged('subtitlesWidth', 100)}>
                                                        <EditIcon />
                                                    </IconButton>
                                                </InputAdornment>
                                            )}
                                            {subtitlesWidth !== -1 && (
                                                <>
                                                    <InputAdornment position="end">%</InputAdornment>
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => onSettingChanged('subtitlesWidth', -1)}
                                                        >
                                                            <ClearIcon />
                                                        </IconButton>
                                                    </InputAdornment>
                                                </>
                                            )}
                                        </>
                                    ),
                                },
                            }}
                        />
                    )}
                </>
            )}
        </Stack>
    );
};

export default SubtitleAppearanceSettingsTab;
