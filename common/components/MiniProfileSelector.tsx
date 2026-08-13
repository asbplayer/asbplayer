import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from '@project/common/settings';

interface Props {
    profiles: Profile[];
    activeProfile?: string;
    onSetActiveProfile: (profile: string | undefined) => void;
}

const MiniProfileSelector = ({ profiles, activeProfile, onSetActiveProfile }: Props) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState<boolean>(false);
    const [anchorEl, setAnchorEl] = useState<HTMLElement>();
    const handleOpen = useCallback((e: React.MouseEvent) => {
        setAnchorEl(e.currentTarget as HTMLElement);
        setOpen(true);
    }, []);
    const handleClose = useCallback(() => setOpen(false), []);
    const handleSelect = useCallback(
        (p: Profile | undefined) => {
            setOpen(false);
            onSetActiveProfile(p?.name);
        },
        [onSetActiveProfile]
    );
    if (profiles.length === 0) {
        return null;
    }

    return (
        <>
            <Popover open={open} anchorEl={anchorEl} onClose={handleClose}>
                <List>
                    <ListItem disablePadding onClick={() => handleSelect(undefined)}>
                        <ListItemButton selected={activeProfile === undefined}>
                            {t('settings.defaultProfile')}
                        </ListItemButton>
                    </ListItem>
                    {profiles.map((p) => (
                        <ListItem disablePadding key={p.name} onClick={() => handleSelect(p)}>
                            <ListItemButton selected={p.name === activeProfile}>{p.name}</ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Popover>
            <Button color="inherit" variant="outlined" onClick={handleOpen}>
                {activeProfile ?? t('settings.defaultProfile')}
            </Button>
        </>
    );
};

export default MiniProfileSelector;
