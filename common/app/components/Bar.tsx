import { makeStyles } from '@mui/styles';
import { type Theme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import BugReportIcon from '@mui/icons-material/BugReport';
import TutorialIcon from '@project/common/components/TutorialIcon';
import IconButton from '@mui/material/IconButton';
import HistoryIcon from '@mui/icons-material/History';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import Toolbar from '@mui/material/Toolbar';
import type { TooltipProps } from '@mui/material/Tooltip';
import Tooltip from '../../components/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback, useState } from 'react';
import GitHubIcon from '@mui/icons-material/GitHub';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import MuiLink, { LinkProps as MuiLinkProps } from '@mui/material/Link';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Popover from '@mui/material/Popover';
import ErrorIcon from '@mui/icons-material/Error';
import BarChartIcon from '@mui/icons-material/BarChart';

interface BarProps {
    drawerWidth: number;
    drawerOpen: boolean;
    hidden: boolean;
    title: string;
    subtitleFiles?: File[];
    lastError?: any;
    onFileSelector?: () => void;
    onDownloadSubtitleFilesAsSrt: () => void;
    onOpenSettings: () => void;
    onOpenCopyHistory: () => void;
    onCopyLastError: (error: string) => void;
    onOpenStatistics?: () => void;
}

interface StyleProps {
    drawerWidth: number;
}

const useStyles = makeStyles<Theme, StyleProps, string>((theme) => ({
    title: {
        flexGrow: 1,
    },
    leftButton: {
        marginRight: theme.spacing(1),
    },
    appBar: {
        background: 'linear-gradient(150deg, #ff1f62, #49007a 160%)',
        transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
    },
    appBarShift: {
        width: ({ drawerWidth }) => `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginRight: ({ drawerWidth }) => drawerWidth,
    },
    drawerButton: {
        transform: 'scaleX(1)',
        width: 40,
        padding: 8,
        transition: theme.transitions.create(['transform', 'padding', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
    },
    drawerButtonShift: {
        transform: 'scaleX(0)',
        width: 0,
        padding: 0,
        transition: theme.transitions.create(['transform', 'padding', 'width'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
    },
    hide: {
        display: 'none',
    },
    menu: {
        '& .MuiLink-root': {
            textDecoration: 'none',
        },
    },
}));

interface CopyHistoryTooltipStylesProps {
    show: boolean;
}

interface CopyHistoryTooltipProps extends TooltipProps {
    show: boolean;
}

const useCopyHistoryTooltipStyles = makeStyles<Theme, CopyHistoryTooltipStylesProps, string>((theme) => ({
    tooltip: ({ show }) => ({
        display: show ? 'block' : 'none',
    }),
}));

function CopyHistoryTooltip({ show, ...toolTipProps }: CopyHistoryTooltipProps) {
    const classes = useCopyHistoryTooltipStyles({ show: show });
    return <Tooltip classes={classes} {...toolTipProps} />;
}

const Link = ({ children, ...props }: MuiLinkProps) => {
    return (
        <MuiLink component="a" target="_blank" rel="noreferrer" color="inherit" {...props}>
            {children}
        </MuiLink>
    );
};
export default function Bar({
    drawerWidth,
    drawerOpen,
    hidden,
    title,
    subtitleFiles,
    lastError,
    onOpenSettings,
    onOpenCopyHistory,
    onDownloadSubtitleFilesAsSrt,
    onCopyLastError,
    onOpenStatistics,
}: BarProps) {
    const classes = useStyles({ drawerWidth });
    const canSaveAsSrt =
        subtitleFiles !== undefined && subtitleFiles.find((f) => !f.name.endsWith('.sup')) !== undefined;
    const { t } = useTranslation();

    const handleDownloadSubtitleFilesAsSrt = useCallback(() => {
        onDownloadSubtitleFilesAsSrt();
    }, [onDownloadSubtitleFilesAsSrt]);

    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement>();
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const handleMenuClose = useCallback(() => {
        setMenuOpen(false);
    }, []);
    const handleMenuOpen = useCallback((e: React.UIEvent) => {
        setMenuAnchorEl(e.currentTarget as HTMLElement);
        setMenuOpen(true);
    }, []);
    const handleCopyLastError = useCallback(async () => {
        if (!lastError) {
            return;
        }

        let errorString: string;

        if (lastError instanceof Error) {
            errorString = `${lastError.message}\n${lastError.stack}`;
        } else {
            errorString = String(lastError);
        }

        await navigator.clipboard.writeText(errorString);
        onCopyLastError(errorString);
    }, [lastError, onCopyLastError]);

    return (
        <>
            <AppBar
                position="static"
                className={clsx(classes.appBar, {
                    [classes.appBarShift]: drawerOpen,
                    [classes.hide]: hidden,
                })}
            >
                <Toolbar>
                    {canSaveAsSrt && (
                        <Tooltip title={t('action.downloadSubtitlesAsSrt')!}>
                            <IconButton
                                edge="start"
                                color="inherit"
                                className={classes.leftButton}
                                onClick={handleDownloadSubtitleFilesAsSrt}
                            >
                                <SaveAltIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Typography variant="h6" noWrap className={classes.title}>
                        {title}
                    </Typography>
                    <IconButton edge="end" color="inherit" onClick={handleMenuOpen}>
                        <GitHubIcon />
                    </IconButton>
                    <Tooltip title={t('bar.settings')!}>
                        <IconButton edge="end" color="inherit" onClick={onOpenSettings}>
                            <SettingsIcon />
                        </IconButton>
                    </Tooltip>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CopyHistoryTooltip title={t('bar.miningHistory')!} show={!drawerOpen}>
                            <IconButton
                                edge="end"
                                color="inherit"
                                className={clsx(classes.drawerButton, {
                                    [classes.drawerButtonShift]: drawerOpen,
                                })}
                                onClick={onOpenCopyHistory}
                            >
                                <HistoryIcon />
                            </IconButton>
                        </CopyHistoryTooltip>
                        {onOpenStatistics && (
                            <Tooltip title={t('statistics.title')!}>
                                <IconButton
                                    edge="end"
                                    color="inherit"
                                    onClick={onOpenStatistics}
                                    className={clsx(classes.drawerButton, {
                                        [classes.drawerButtonShift]: drawerOpen,
                                    })}
                                >
                                    <BarChartIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                </Toolbar>
            </AppBar>
            <Popover
                disableEnforceFocus={true}
                open={menuOpen}
                anchorEl={menuAnchorEl}
                onClose={handleMenuClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <List className={classes.menu} onMouseLeave={handleMenuClose} dense>
                    <Link href="https://docs.asbplayer.dev/docs/intro">
                        <ListItem disablePadding>
                            <ListItemButton>
                                <ListItemIcon>
                                    <TutorialIcon />
                                </ListItemIcon>
                                <ListItemText primary={t('action.userGuide')!} />
                            </ListItemButton>
                        </ListItem>
                    </Link>
                    <Link href="https://github.com/asbplayer/asbplayer/issues">
                        <ListItem disablePadding>
                            <ListItemButton>
                                <ListItemIcon>
                                    <BugReportIcon />
                                </ListItemIcon>
                                <ListItemText primary={t('bar.submitIssue')!} />
                            </ListItemButton>
                        </ListItem>
                    </Link>
                    {lastError && (
                        <ListItem disablePadding>
                            <ListItemButton onClick={handleCopyLastError}>
                                <ListItemIcon>
                                    <ErrorIcon />
                                </ListItemIcon>
                                <ListItemText primary={t('bar.copyLastError')!} />
                            </ListItemButton>
                        </ListItem>
                    )}
                </List>
            </Popover>
        </>
    );
}
