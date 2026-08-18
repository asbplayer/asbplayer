import KeyboardIcon from '@mui/icons-material/Keyboard';
import Box, { type BoxProps } from '@mui/material/Box';
import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import type { SxProps, Theme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import { useTranslation } from 'react-i18next';

type Preset = 'formLabel' | 'numericalInputLabel';
type PresetValue = { iconButton: IconButtonProps; box: BoxProps };

interface Props {
    onClick: () => void;
    sx?: SxProps<Theme>;
    preset?: Preset;
}

const presets: Record<Preset, PresetValue> = {
    numericalInputLabel: {
        box: { display: 'inline-block', ml: 1 },
        iconButton: {
            size: 'small',
            disableRipple: true,
            disableFocusRipple: true,
            sx: {
                p: 0,
                mb: 0.3,
            },
        },
    },
    formLabel: {
        box: {},
        iconButton: {
            size: 'small',
            disableRipple: true,
            disableFocusRipple: true,
            sx: {
                p: 0,
            },
        },
    },
};

const emptyPreset: PresetValue = { iconButton: {}, box: {} };

export default function KeyboardShortcutLink({ onClick, sx, preset }: Props) {
    const presetValue = preset === undefined ? emptyPreset : presets[preset];
    const { t } = useTranslation();
    return (
        <Box sx={{ display: 'flex', ...presetValue.box, ...sx }}>
            <Tooltip title={t('settings.keyboardShortcuts')}>
                <IconButton
                    sx={{ display: 'flex' }}
                    type="button"
                    color="inherit"
                    aria-label={t('settings.keyboardShortcuts')}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onClick();
                    }}
                    {...presetValue.iconButton}
                >
                    <KeyboardIcon />
                </IconButton>
            </Tooltip>
        </Box>
    );
}
