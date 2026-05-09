import React from 'react';
import MuiDrawer, { type DrawerProps } from '@mui/material/Drawer';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { useAppBarHeight } from '../hooks/use-app-bar-height';

interface Props extends DrawerProps {
    children: React.ReactNode;
    showBackButton: boolean;
    label?: React.ReactNode;
    drawerWidth?: number;
    onClose: () => void;
}

const Drawer: React.FC<Props> = ({ children, showBackButton, label, onClose, drawerWidth, ...rest }) => {
    const width = drawerWidth === undefined ? '100%' : drawerWidth;
    const appBarHeight = useAppBarHeight();
    const showHeader = showBackButton || label !== undefined;

    return (
        <MuiDrawer
            variant="persistent"
            anchor="right"
            sx={{
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
            }}
            slotProps={{
                paper: { sx: { width } },
            }}
            {...rest}
        >
            {showHeader && (
                <>
                    <Paper
                        square
                        sx={{
                            height: appBarHeight === 0 ? 52 : appBarHeight,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            px: 1,
                        }}
                    >
                        {showBackButton && (
                            <IconButton onClick={onClose}>
                                <ChevronRightIcon />
                            </IconButton>
                        )}
                        {label !== undefined && (
                            <Typography variant="h6" sx={{ flexGrow: 1, pl: 1 }}>
                                {label}
                            </Typography>
                        )}
                    </Paper>
                    {label !== undefined && <Divider />}
                </>
            )}
            {children}
        </MuiDrawer>
    );
};

export default Drawer;
