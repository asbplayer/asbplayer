import { makeStyles } from '@mui/styles';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsTextField from './SettingsTextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import MenuItem from '@mui/material/MenuItem';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { type Theme } from '@mui/material';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Popover from '@mui/material/Popover';
import { Direction } from './settings-model';

const useSelectableSettingStyles = makeStyles<Theme>((theme) => ({
    formControl: {
        marginLeft: theme.spacing(1),
        marginBottom: theme.spacing(1),
        minWidth: 120,
    },
    root: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'end',
        alignItems: 'flex-end',
    },
    hidden: {
        opacity: 0.5,
    },
}));

interface SelectableSettingProps extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    label: string;
    value: string;
    selections?: string[];
    removable?: boolean;
    display?: boolean;
    onDisplayChange?: (displaying: boolean) => void;
    onValueChange: (value: string) => void;
    disabledDirection?: Direction;
    onOrderChange?: (direction: Direction) => void;
    onRemoval?: () => void;
    onOpen?: () => void;
}

const AnkiSelect = React.forwardRef<HTMLDivElement, SelectableSettingProps>(function SelectableSetting(
    {
        label,
        value,
        selections,
        removable,
        display,
        onDisplayChange,
        disabledDirection,
        onValueChange,
        onOrderChange,
        onRemoval,
        onOpen,
        ...props
    },
    ref
) {
    const classes = useSelectableSettingStyles();
    const { t } = useTranslation();
    const [optionsMenuOpen, setOptionsMenuOpen] = useState<boolean>(false);
    const [optionsMenuAnchorEl, setOptionsMenuAnchorEl] = useState<Element>();
    const [selectionMenuOpen, setSelectionMenuOpen] = useState<boolean>(false);
    const [selectionMenuAnchorEl, setSelectionMenuAnchorEl] = useState<Element>();
    const handleOrderChange = (direction: Direction) => {
        setOptionsMenuOpen(false);
        onOrderChange?.(direction);
    };
    const handleOpenSelectionMenu = (element: HTMLElement) => {
        if (selections === undefined) {
            return;
        }

        setSelectionMenuAnchorEl(element);
        setSelectionMenuOpen(true);
        onOpen?.();
    };

    const className = display === false ? `${classes.root} ${classes.hidden}` : classes.root;
    const error = selections !== undefined && value !== '' && !selections.includes(value);

    return (
        <div ref={ref} className={className} {...props}>
            <SettingsTextField
                label={label}
                value={value}
                onClick={(e) => handleOpenSelectionMenu(e.currentTarget)}
                onChange={(e) => onValueChange(e.target.value)}
                fullWidth
                error={error}
                helperText={error ? t('settings.missingFieldError', { field: value }) : ''}
                color="primary"
                slotProps={{
                    input: {
                        endAdornment: (
                            <InputAdornment style={{ marginRight: -12 }} position="end">
                                {(removable || onOrderChange) && (
                                    <IconButton
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOptionsMenuAnchorEl(e.currentTarget);
                                            setOptionsMenuOpen(true);
                                        }}
                                    >
                                        <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                )}
                                <IconButton
                                    disabled={!selections}
                                    onClick={(e) => handleOpenSelectionMenu(e.currentTarget)}
                                >
                                    {selectionMenuOpen && <ArrowDropUpIcon fontSize="small" />}
                                    {!selectionMenuOpen && <ArrowDropDownIcon fontSize="small" />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    },
                }}
            >
                {selections &&
                    ['', ...selections].map((s) => (
                        <MenuItem key={s} value={s}>
                            {s === '' ? ' ' : s}
                        </MenuItem>
                    ))}
            </SettingsTextField>
            <Popover
                disableEnforceFocus={true}
                open={selections !== undefined && selectionMenuOpen}
                anchorEl={selectionMenuAnchorEl}
                onClose={() => setSelectionMenuOpen(false)}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'center',
                    horizontal: 'center',
                }}
            >
                <List>
                    {selections &&
                        ['', ...selections].map((s) => (
                            <ListItem disablePadding key={s}>
                                <ListItemButton
                                    onClick={() => {
                                        onValueChange(s);
                                        setSelectionMenuOpen(false);
                                    }}
                                >
                                    {s === '' ? ' ' : s}
                                </ListItemButton>
                            </ListItem>
                        ))}
                </List>
            </Popover>
            {optionsMenuOpen && (
                <Popover
                    disableEnforceFocus={true}
                    open={optionsMenuOpen}
                    anchorEl={optionsMenuAnchorEl}
                    onClose={() => setOptionsMenuOpen(false)}
                    anchorOrigin={{
                        vertical: 'center',
                        horizontal: 'center',
                    }}
                    transformOrigin={{
                        vertical: 'center',
                        horizontal: 'right',
                    }}
                >
                    <List>
                        {disabledDirection !== Direction.up && onOrderChange !== undefined && (
                            <ListItem disablePadding onClick={() => handleOrderChange(Direction.up)}>
                                <ListItemButton>
                                    <ListItemIcon>
                                        <ArrowUpwardIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>{t('settings.moveUpInCardCreator')}</ListItemText>
                                </ListItemButton>
                            </ListItem>
                        )}
                        {display !== undefined && onDisplayChange !== undefined && (
                            <ListItem disablePadding onClick={() => onDisplayChange(!display)}>
                                <ListItemButton>
                                    <ListItemIcon>
                                        {display === false && <VisibilityOffIcon fontSize="small" />}
                                        {display === true && <VisibilityIcon fontSize="small" />}
                                    </ListItemIcon>
                                    <ListItemText>
                                        {display ? t('settings.hideInCardCreator') : t('settings.showInCardCreator')}
                                    </ListItemText>
                                </ListItemButton>
                            </ListItem>
                        )}
                        {disabledDirection !== Direction.down && onOrderChange !== undefined && (
                            <ListItem disablePadding onClick={() => handleOrderChange(Direction.down)}>
                                <ListItemButton>
                                    <ListItemIcon>
                                        <ArrowDownwardIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>{t('settings.moveDownInCardCreator')}</ListItemText>
                                </ListItemButton>
                            </ListItem>
                        )}
                        {removable && (
                            <ListItem disablePadding onClick={() => onRemoval?.()}>
                                <ListItemButton>
                                    <ListItemIcon>
                                        <DeleteIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText>{t('action.delete')}</ListItemText>
                                </ListItemButton>
                            </ListItem>
                        )}
                    </List>
                </Popover>
            )}
        </div>
    );
});

export default AnkiSelect;
