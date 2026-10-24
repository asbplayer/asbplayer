import React from 'react';
import { useTranslation } from 'react-i18next';
import Checkbox from '@mui/material/Checkbox';
import List from '@mui/material/List';
import MuiListItem from '@mui/material/ListItem';
import type { ListItemProps } from '@mui/material/ListItem';
import MuiListItemButton from '@mui/material/ListItemButton';
import type { ListItemButtonProps } from '@mui/material/ListItemButton';
import MuiListItemIcon from '@mui/material/ListItemIcon';
import type { ListItemIconProps } from '@mui/material/ListItemIcon';
import Popover from '@mui/material/Popover';
import type { PopoverProps } from '@mui/material/Popover';
import { PlayMode } from '@project/common';
import MuiListItemText from '@mui/material/ListItemText';
import type { ListItemTextProps } from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Radio from '@mui/material/Radio';
import Typography from '@mui/material/Typography';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Tooltip from '@project/common/components/Tooltip';
import type { Recipe } from '@project/common/settings';

interface Props extends PopoverProps {
    open: boolean;
    listStyle?: React.CSSProperties;
    anchorEl?: Element;
    selectedPlayModes: Set<PlayMode>;
    onPlayMode: (playMode: PlayMode) => void;
    onClose: () => void;
    recipes?: readonly Recipe[];
    activeRecipeId?: number | null;
    onRecipeSelect?: (index: number | null) => void;
    playModesEnabled?: boolean;
}

const ListItem = ({ children, ...props }: ListItemProps) => {
    return (
        <MuiListItem disablePadding dense sx={{ width: 'auto' }} {...props}>
            {children}
        </MuiListItem>
    );
};

const ListItemButton = ({ children, ...props }: ListItemButtonProps) => {
    return (
        <MuiListItemButton dense {...props}>
            {children}
        </MuiListItemButton>
    );
};

const ListItemIcon = ({ children, ...props }: ListItemIconProps) => {
    return (
        <MuiListItemIcon sx={{ minWidth: 'auto' }} {...props}>
            {children}
        </MuiListItemIcon>
    );
};

const ListItemText = ({ children, ...props }: ListItemTextProps) => {
    return (
        <MuiListItemText sx={{ whiteSpace: 'nowrap' }} {...props}>
            {children}
        </MuiListItemText>
    );
};

export default function PlayModeSelector({
    listStyle,
    selectedPlayModes,
    onPlayMode,
    open,
    anchorEl,
    onClose,
    recipes,
    activeRecipeId,
    onRecipeSelect,
    playModesEnabled = true,
    ...restOfPopoverProps
}: Props) {
    const { t } = useTranslation();
    const horizontal = listStyle?.flexDirection !== 'column';
    const hasRecipes = !!recipes?.length && !!onRecipeSelect;
    const selectedRecipe = hasRecipes && activeRecipeId != null ? recipes[activeRecipeId] : undefined;
    const modesLockedMessage = t('recipes.settingLocked', { setting: t('settings.playbackModes') });
    const modeList = (
        <List
            aria-label={t('settings.playbackModes')}
            disablePadding
            dense
            sx={{
                ...listStyle,
                display: 'flex',
                flexDirection: horizontal ? 'row' : 'column',
                flexWrap: 'nowrap',
                width: horizontal ? 'max-content' : '100%',
                flexShrink: 0,
            }}
        >
            {(
                [
                    [PlayMode.normal, 'controls.normalMode'],
                    [PlayMode.condensed, 'controls.condensedMode'],
                    [PlayMode.fastForward, 'controls.fastForwardMode'],
                    [PlayMode.autoPause, 'controls.autoPauseMode'],
                    [PlayMode.repeat, 'controls.repeatMode'],
                ] as const
            ).map(([mode, label]) => (
                <ListItem key={mode}>
                    <ListItemButton
                        disabled={!!selectedRecipe}
                        onClick={selectedRecipe ? undefined : () => onPlayMode(mode)}
                    >
                        <ListItemIcon>
                            <Checkbox
                                edge="start"
                                checked={selectedPlayModes.has(mode)}
                                disabled={!!selectedRecipe}
                                disableRipple
                                tabIndex={-1}
                                inputProps={{ 'aria-label': t(label) }}
                            />
                        </ListItemIcon>
                        <ListItemText>{t(label)}</ListItemText>
                    </ListItemButton>
                </ListItem>
            ))}
        </List>
    );
    return (
        <Popover
            disableEnforceFocus={true}
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'center',
            }}
            transformOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
            }}
            {...restOfPopoverProps}
        >
            <Box
                role="dialog"
                aria-label={t('controls.playbackMode')}
                sx={{
                    display: 'flex',
                    flexDirection: horizontal ? 'row' : 'column',
                    width: horizontal ? 'max-content' : 280,
                    maxWidth: 'calc(100vw - 32px)',
                    overflowX: horizontal ? 'auto' : undefined,
                }}
            >
                {hasRecipes && (
                    <>
                        <Box sx={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', flexShrink: 0 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 2,
                                    py: horizontal ? 0 : 1,
                                    color: selectedRecipe ? 'primary.main' : 'text.secondary',
                                }}
                            >
                                <AutoAwesomeMotionIcon fontSize="small" />
                                <Typography variant="overline" sx={{ whiteSpace: 'nowrap', lineHeight: 1.5 }}>
                                    {t('recipes.recipe')}
                                </Typography>
                            </Box>
                            <List
                                aria-label={t('recipes.recipe')}
                                disablePadding
                                dense
                                sx={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column' }}
                            >
                                {[null, ...recipes.map((_, index) => index)].map((index) => {
                                    const selected = index === (selectedRecipe ? activeRecipeId : null);
                                    const label =
                                        index === null
                                            ? t('pauseOnHoverMode.disabled')
                                            : `${index + 1}. ${recipes[index].name}`;
                                    return (
                                        <ListItem key={index ?? 'disabled'}>
                                            <ListItemButton selected={selected} onClick={() => onRecipeSelect(index)}>
                                                <ListItemIcon>
                                                    <Radio
                                                        edge="start"
                                                        checked={selected}
                                                        tabIndex={-1}
                                                        disableRipple
                                                        inputProps={{ 'aria-label': label }}
                                                    />
                                                </ListItemIcon>
                                                <MuiListItemText
                                                    primary={label}
                                                    title={label}
                                                    primaryTypographyProps={{ noWrap: horizontal }}
                                                    sx={{
                                                        minWidth: 0,
                                                        maxWidth: horizontal ? '60vw' : undefined,
                                                        overflowWrap: 'anywhere',
                                                    }}
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </Box>
                        {playModesEnabled && <Divider orientation={horizontal ? 'vertical' : 'horizontal'} flexItem />}
                    </>
                )}
                {playModesEnabled && (
                    <Box sx={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', flexShrink: 0 }}>
                        {hasRecipes && (
                            <Tooltip title={selectedRecipe ? modesLockedMessage : ''}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        px: 2,
                                        py: horizontal ? 0 : 1,
                                    }}
                                >
                                    <Typography
                                        variant="overline"
                                        color="text.secondary"
                                        sx={{ whiteSpace: 'nowrap', lineHeight: 1.5 }}
                                    >
                                        {t('settings.playbackModes')}
                                    </Typography>
                                    {selectedRecipe && <LockOutlinedIcon fontSize="small" color="disabled" />}
                                </Box>
                            </Tooltip>
                        )}
                        {modeList}
                        {selectedRecipe && !horizontal && (
                            <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1 }}>
                                {modesLockedMessage}
                            </Typography>
                        )}
                    </Box>
                )}
            </Box>
        </Popover>
    );
}
