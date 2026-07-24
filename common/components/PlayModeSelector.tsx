import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Checkbox from '@mui/material/Checkbox';
import List from '@mui/material/List';
import MuiListItem, { type ListItemProps } from '@mui/material/ListItem';
import MuiListItemButton, { type ListItemButtonProps } from '@mui/material/ListItemButton';
import MuiListItemIcon, { type ListItemIconProps } from '@mui/material/ListItemIcon';
import Popover from '@mui/material/Popover';
import type { PopoverProps } from '@mui/material/Popover';
import { PlayMode } from '@project/common';
import MuiListItemText, { type ListItemTextProps } from '@mui/material/ListItemText';

interface Props extends PopoverProps {
    open: boolean;
    listStyle?: React.CSSProperties;
    anchorEl?: Element;
    selectedPlayModes: Set<PlayMode>;
    onPlayMode: (playMode: PlayMode) => void;
    onClose: () => void;
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
    ...restOfPopoverProps
}: Props) {
    const { t } = useTranslation();
    const listRef = useRef<HTMLUListElement>(null);
    const [listElement, setListElement] = useState<HTMLUListElement | null>(null);
    const [useColumnLayout, setUseColumnLayout] = useState(false);
    const handleListRef = useCallback((element: HTMLUListElement | null) => {
        listRef.current = element;
        setListElement(element);
    }, []);

    const updateListLayout = useCallback(() => {
        const list = listRef.current;
        if (!list) return;

        const previousDirection = list.style.flexDirection;
        const previousWidth = list.style.width;
        const previousMaxWidth = list.style.maxWidth;
        list.style.flexDirection = 'row';
        list.style.width = 'max-content';
        list.style.maxWidth = 'none';
        const rowWidth = [...list.children].reduce((width, item) => width + item.getBoundingClientRect().width, 0);
        const viewportWidth = window.innerWidth - 16;
        const paperWidth = list.parentElement?.getBoundingClientRect().width;
        const availableWidth = Math.min(paperWidth || viewportWidth, viewportWidth);
        list.style.flexDirection = previousDirection;
        list.style.width = previousWidth;
        list.style.maxWidth = previousMaxWidth;

        setUseColumnLayout(rowWidth > availableWidth);
    }, []);

    useLayoutEffect(() => {
        if (!open) return;

        if (!listElement) return;

        const resizeObserver = new ResizeObserver(updateListLayout);
        resizeObserver.observe(listElement);
        if (listElement.parentElement) resizeObserver.observe(listElement.parentElement);
        window.addEventListener('resize', updateListLayout);
        const animationFrame = requestAnimationFrame(updateListLayout);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateListLayout);
            cancelAnimationFrame(animationFrame);
        };
    }, [listElement, open, updateListLayout]);

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
            <List
                ref={handleListRef}
                disablePadding
                dense
                sx={{
                    ...listStyle,
                    flexDirection: useColumnLayout ? 'column' : 'row',
                    flexWrap: 'nowrap',
                    width: 'max-content',
                    maxWidth: '100%',
                }}
            >
                <ListItem onClick={() => onPlayMode(PlayMode.normal)}>
                    <ListItemButton>
                        <ListItemIcon>
                            <Checkbox
                                edge="start"
                                checked={selectedPlayModes.has(PlayMode.normal)}
                                disableRipple
                                tabIndex={-1}
                            />
                        </ListItemIcon>
                        <ListItemText>{t('controls.normalMode')}</ListItemText>
                    </ListItemButton>
                </ListItem>
                <ListItem onClick={() => onPlayMode(PlayMode.condensed)}>
                    <ListItemButton>
                        <ListItemIcon>
                            <Checkbox
                                edge="start"
                                checked={selectedPlayModes.has(PlayMode.condensed)}
                                disableRipple
                                tabIndex={-1}
                            />
                        </ListItemIcon>
                        <ListItemText>{t('controls.condensedMode')}</ListItemText>
                    </ListItemButton>
                </ListItem>
                <ListItem onClick={() => onPlayMode(PlayMode.fastForward)}>
                    <ListItemButton>
                        <ListItemIcon>
                            <Checkbox
                                edge="start"
                                checked={selectedPlayModes.has(PlayMode.fastForward)}
                                disableRipple
                                tabIndex={-1}
                            />
                        </ListItemIcon>
                        <ListItemText>{t('controls.fastForwardMode')}</ListItemText>
                    </ListItemButton>
                </ListItem>
                <ListItem onClick={() => onPlayMode(PlayMode.autoPause)}>
                    <ListItemButton>
                        <ListItemIcon>
                            <Checkbox
                                edge="start"
                                checked={selectedPlayModes.has(PlayMode.autoPause)}
                                disableRipple
                                tabIndex={-1}
                            />
                        </ListItemIcon>
                        <ListItemText>{t('controls.autoPauseMode')}</ListItemText>
                    </ListItemButton>
                </ListItem>
                <ListItem onClick={() => onPlayMode(PlayMode.repeat)}>
                    <ListItemButton>
                        <ListItemIcon>
                            <Checkbox
                                edge="start"
                                checked={selectedPlayModes.has(PlayMode.repeat)}
                                disableRipple
                                tabIndex={-1}
                            />
                        </ListItemIcon>
                        <ListItemText>{t('controls.repeatMode')}</ListItemText>
                    </ListItemButton>
                </ListItem>
            </List>
        </Popover>
    );
}
