import React, { useCallback, useEffect, useState, useRef, MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { makeStyles, withStyles } from '@mui/styles';
import { useTheme } from '@mui/material/styles';
import { type Theme } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import BlurOffIcon from '@mui/icons-material/BlurOff';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';
import Fade from '@mui/material/Fade';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Popover from '@mui/material/Popover';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import Slider from '@mui/material/Slider';
import TuneIcon from '@mui/icons-material/Tune';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import VideocamIcon from '@mui/icons-material/Videocam';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { AudioTrackModel, PlayMode, VideoTabModel } from '@project/common';
import { SubtitleAlignment } from '@project/common/settings';
import Clock from '../services/clock';
import PlaybackPreferences from '../services/playback-preferences';
import Tooltip from '../../components/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useMediaQuery from '@mui/material/useMediaQuery';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { isMobile } from 'react-device-detect';
import SubtitleOffsetInput from '../../components/SubtitleOffsetInput';
import PlaybackRateInput from '../../components/PlaybackRateInput';
import VideoElementFavicon from './VideoElementFavicon';
import PlayModeSelector from '../../components/PlayModeSelector';
import TimeDisplay from '../../components/TimeDisplay';

const useControlStyles = makeStyles<Theme>((theme) => ({
    container: {
        position: 'absolute',
        left: '50%',
        width: '50%',
        bottom: 0,
        pointerEvents: 'none',
        color: '#fff',
    },
    buttonContainer: {
        flexDirection: 'row',
    },
    numberInput: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        fontSize: 20,
        marginLeft: 10,
        width: 100,
        color: '#fff',
        pointerEvents: 'auto',
    },
    volumeInputContainerShown: {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        marginRight: 5,
        pointerEvents: 'auto',
    },
    volumeInputContainerHidden: {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        marginRight: 0,
        pointerEvents: 'auto',
    },
    volumeInputHidden: {
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        width: 0,
        opacity: 0,
        pointerEvents: 'auto',
    },
    volumeInputShown: {
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.short,
        }),
        width: 100,
        opacity: 1,
        pointerEvents: 'auto',
    },
    volumeInputThumbHidden: {
        transition: theme.transitions.create('visibility', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        opacity: 0,
        pointerEvents: 'auto',
    },
    volumeInputThumbShown: {
        transition: theme.transitions.create('visibility', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.short,
        }),
        opacity: 1,
        pointerEvents: 'auto',
    },
    volumeInputRailHidden: {
        transition: theme.transitions.create('visibility', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.short,
        }),
        opacity: 0,
        pointerEvents: 'auto',
    },
    volumeInputRailShown: {
        transition: theme.transitions.create('visibility', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.short,
        }),
        opacity: 1,
        pointerEvents: 'auto',
    },
    subContainer: {
        background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, .4) 40%, rgba(0, 0, 0, 0.7))',
        position: 'relative',
        left: '-100%',
        width: '200%',
        zIndex: 10,
    },
    button: {
        pointerEvents: 'auto',
    },
    inactiveButton: {
        color: 'rgba(120, 120, 120, 0.7)',
        pointerEvents: 'auto',
    },
    inactiveTopButton: {
        color: 'rgba(255, 255, 255, 0.5)',
        pointerEvents: 'auto',
    },
    progress: {
        margin: 5,
    },
    topButton: {
        pointerEvents: 'auto',
        color: '#fff',
    },
    gridContainer: {
        pointerEvents: 'auto',
        padding: 2,
    },
}));

const useProgressBarStyles = makeStyles<Theme>((theme) => ({
    root: {
        height: 10,
    },
    container: {
        height: 10,
        pointerEvents: 'auto',
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        position: 'absolute',
        width: 'calc(100% - 20px)',
        marginLeft: 10,
    },
    mouseEventListener: {
        zIndex: 1,
        height: 10,
        cursor: 'pointer',
        pointerEvents: 'auto',
        position: 'absolute',
        width: '100%',
    },
    fillContainer: {
        background: 'rgba(30,30,30,0.7)',
        width: '100%',
        height: 5,
        position: 'relative',
    },
    fillContainerThick: {
        transition: theme.transitions.create('height', {
            easing: theme.transitions.easing.easeInOut,
            duration: 50,
        }),
        height: 8,
    },
    fill: {
        background: 'linear-gradient(to left, #ff1f62, #49007a)',
        height: '100%',
    },
    handleContainer: {
        position: 'absolute',
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        height: '100%',
        bottom: 0,
    },
    handle: {
        borderRadius: '50%',
        width: 16,
        height: 16,
        opacity: 0,
        left: -8,
        background: 'white',
        position: 'absolute',
    },
    handleOn: {
        opacity: 1,
        transition: theme.transitions.create('opacity', {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.shortest,
        }),
    },
}));

const VolumeSlider = withStyles((theme) => ({
    root: {
        color: 'white',
        verticalAlign: 'middle',
    },
    thumb: {
        backgroundColor: 'white',
        color: 'white',
        '&:focus': {
            boxShadow: 'inherit',
        },
        '&:hover, &$active': {
            boxShadow: '0px 0px 0px 8px rgba(255, 255, 255, 0.1)',
        },
    },
    active: {
        color: 'white',
    },
}))(Slider);

function elementWidth(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    return rect.right - rect.left;
}

interface ProgressBarProps {
    onSeek: (progress: number) => void;
    value: number;
}

function ProgressBar({ onSeek, value }: ProgressBarProps) {
    const classes = useProgressBarStyles();
    const [mouseOver, setMouseOver] = useState(false);
    const containerRef = useRef(null);

    const handleClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            // Account for margins by subtracting 10 from left/right sides
            const width = rect.right - rect.left - 20;
            const progress = Math.min(1, Math.max(0, (e.pageX - rect.left - 10) / width));
            onSeek(progress);
        },
        [onSeek]
    );

    const handleMouseOver = useCallback(() => setMouseOver(true), []);
    const handleMouseOut = useCallback(() => setMouseOver(false), []);
    const progressWidth =
        Number.isFinite(value) && containerRef.current ? (elementWidth(containerRef.current) * value) / 100 : 0;
    const fillStyle = { width: progressWidth };
    const handleStyle = { marginLeft: progressWidth };
    const fillContainerClassName = mouseOver
        ? classes.fillContainer + ' ' + classes.fillContainerThick
        : classes.fillContainer;
    const handleClassName = mouseOver ? classes.handle + ' ' + classes.handleOn : classes.handle;

    return (
        <div className={classes.root}>
            <div ref={containerRef} className={classes.container}>
                <div className={fillContainerClassName}>
                    <div className={classes.fill} style={fillStyle}></div>
                    <div className={classes.handleContainer}>
                        <div className={handleClassName} style={handleStyle} />
                    </div>
                </div>
            </div>
            <div
                className={classes.mouseEventListener}
                onClick={handleClick}
                onMouseOver={handleMouseOver}
                onMouseOut={handleMouseOut}
            ></div>
        </div>
    );
}

interface AudioTrackSelectorProps {
    open: boolean;
    anchorEl?: Element;
    audioTracks?: AudioTrackModel[];
    selectedAudioTrack?: string;
    onAudioTrackSelected: (id: string) => void;
    onClose: () => void;
}

function AudioTrackSelector({
    open,
    anchorEl,
    audioTracks,
    selectedAudioTrack,
    onAudioTrackSelected,
    onClose,
}: AudioTrackSelectorProps) {
    if (!audioTracks || audioTracks.length === 0) {
        return null;
    }

    const list = audioTracks.map((t) => {
        return (
            <ListItem key={t.id} disablePadding onClick={() => onAudioTrackSelected(t.id)}>
                <ListItemButton selected={t.id === selectedAudioTrack}>
                    <ListItemText>
                        {t.language} {t.label}
                    </ListItemText>
                </ListItemButton>
            </ListItem>
        );
    });

    return (
        <div>
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
            >
                <List>{list}</List>
            </Popover>
        </div>
    );
}

interface TabSelectorProps {
    open: boolean;
    anchorEl?: Element;
    tabs?: VideoTabModel[];
    selectedTab?: VideoTabModel;
    onTabSelected: (tab: VideoTabModel) => void;
    onClose: () => void;
}

function TabSelector({ open, anchorEl, onClose, tabs, selectedTab, onTabSelected }: TabSelectorProps) {
    if (!tabs || tabs.length === 0) {
        return null;
    }

    const list = tabs.map((t) => {
        return (
            <ListItem key={`${t.id}:${t.src}`} disablePadding onClick={() => onTabSelected(t)}>
                <ListItemButton selected={selectedTab && t.id === selectedTab.id && t.src === selectedTab.src}>
                    <VideoElementFavicon videoElement={t} /> {t.title}
                </ListItemButton>
            </ListItem>
        );
    });

    return (
        <div>
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
            >
                <List>{list}</List>
            </Popover>
        </div>
    );
}

interface MediaUnloaderProps {
    open: boolean;
    anchorEl?: Element;
    file?: string;
    onUnload: () => void;
    onClose: () => void;
}

interface ResponsiveButtonGroupProps {
    children: React.ReactNode[];
}

const ResponsiveButtonGroup = ({ children }: ResponsiveButtonGroupProps) => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down(600));
    const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement>();

    const handleCloseMenu = () => {
        setAnchorEl(undefined);
    };

    const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setAnchorEl(e.currentTarget);
    };

    const anchorExists = anchorEl !== undefined && document.body.contains(anchorEl);
    const definedChildren = children.filter((c) => c !== undefined && c !== false);

    if (isSmallScreen && definedChildren.length > 1) {
        return (
            <>
                <Grid item>
                    <IconButton color="inherit" onClick={handleOpenMenu}>
                        <MoreVertIcon />
                    </IconButton>
                </Grid>
                <Menu anchorEl={anchorExists ? anchorEl : undefined} open={anchorExists} onClose={handleCloseMenu}>
                    {definedChildren.map((child, i) => {
                        return <MenuItem key={i}>{child}</MenuItem>;
                    })}
                </Menu>
            </>
        );
    }

    return (
        <>
            {children.map((child, i) => {
                return (
                    <Grid item key={i}>
                        {child}
                    </Grid>
                );
            })}
        </>
    );
};

export interface Point {
    x: number;
    y: number;
}

interface ControlsProps {
    clock: Clock;
    length: number;
    offsetEnabled?: boolean;
    displayLength?: number;
    offset: number;
    playbackRate: number;
    playbackRateEnabled?: boolean;
    onAudioTrackSelected: (id: string) => void;
    onSeek: (progress: number) => void;
    mousePositionRef: MutableRefObject<Point | undefined>;
    onShow?: (show: boolean) => void;
    onPause: () => void;
    onPlay: () => void;
    onTabSelected?: (tab: VideoTabModel) => void;
    onUnloadVideo?: () => void;
    onOffsetChange: (offset: number) => void;
    onPlaybackRateChange: (playbackRate: number) => void;
    onVolumeChange?: (volume: number) => void;
    disableKeyEvents?: boolean;
    playbackPreferences: PlaybackPreferences;
    closeEnabled?: boolean;
    onClose?: () => void;
    volumeEnabled?: boolean;
    playModes?: Set<PlayMode>;
    playModeEnabled?: boolean;
    onPlayMode?: (playMode: PlayMode) => void;
    subtitlesEnabled?: boolean;
    subtitlesToggle?: boolean;
    onSubtitlesToggle?: () => void;
    audioTracks?: AudioTrackModel[];
    selectedAudioTrack?: string;
    tabs?: VideoTabModel[];
    selectedTab?: VideoTabModel;
    popOutEnabled?: boolean;
    popOut?: boolean;
    onPopOutToggle?: () => void;
    fullscreenEnabled?: boolean;
    fullscreen?: boolean;
    onFullscreenToggle?: () => void;
    hideSubtitlePlayerToggleEnabled?: boolean;
    subtitlePlayerHidden?: boolean;
    onHideSubtitlePlayerToggle?: () => void;
    showOnMouseMovement: boolean;
    theaterModeToggleEnabled?: boolean;
    theaterModeEnabled?: boolean;
    onTheaterModeToggle?: () => void;
    subtitleAlignmentEnabled?: boolean;
    subtitleAlignment?: SubtitleAlignment;
    onSubtitleAlignment?: (alignment: SubtitleAlignment) => void;
    hideToolbar?: boolean;
    onLoadFiles?: () => void;
    blurOverlayEnabled?: boolean;
    onBlurOverlayToggle?: () => void;
}

export default function Controls({
    clock,
    length,
    offsetEnabled,
    displayLength,
    offset,
    playbackRate,
    playbackRateEnabled,
    onAudioTrackSelected,
    onSeek,
    mousePositionRef,
    onShow,
    onPause,
    onPlay,
    onTabSelected,
    onUnloadVideo,
    onOffsetChange,
    onPlaybackRateChange,
    onVolumeChange,
    disableKeyEvents,
    playbackPreferences,
    closeEnabled,
    onClose,
    volumeEnabled,
    playModes,
    playModeEnabled,
    onPlayMode,
    subtitlesEnabled,
    subtitlesToggle,
    onSubtitlesToggle,
    audioTracks,
    selectedAudioTrack,
    tabs,
    selectedTab,
    popOutEnabled,
    popOut,
    onPopOutToggle,
    fullscreenEnabled,
    fullscreen,
    onFullscreenToggle,
    hideSubtitlePlayerToggleEnabled,
    subtitlePlayerHidden,
    onHideSubtitlePlayerToggle,
    showOnMouseMovement,
    theaterModeToggleEnabled,
    theaterModeEnabled,
    onTheaterModeToggle,
    subtitleAlignment,
    subtitleAlignmentEnabled,
    onSubtitleAlignment,
    hideToolbar,
    onLoadFiles,
    blurOverlayEnabled,
    onBlurOverlayToggle,
}: ControlsProps) {
    const classes = useControlStyles();
    const { t } = useTranslation();
    const [show, setShow] = useState<boolean>(true);
    const [audioTrackSelectorOpen, setAudioTrackSelectorOpen] = useState<boolean>(false);
    const [audioTrackSelectorAnchorEl, setAudioTrackSelectorAnchorEl] = useState<Element>();
    const [tabSelectorOpen, setTabSelectorOpen] = useState<boolean>(false);
    const [tabSelectorAnchorEl, setTabSelectorAnchorEl] = useState<Element>();
    const [playModeSelectorOpen, setPlayModeSelectorOpen] = useState<boolean>(false);
    const [playModeSelectorAnchorEl, setPlayModeSelectorAnchorEl] = useState<Element>();
    const [showVolumeBar, setShowVolumeBar] = useState<boolean>(false);
    const [volume, setVolume] = useState<number>(100);
    const [lastCommittedVolume, setLastCommittedVolume] = useState<number>(100);
    const theme = useTheme();
    const isReallySmallScreen = useMediaQuery(theme.breakpoints.down(380));
    const lastMousePositionRef = useRef<Point | undefined>(undefined);
    const lastShowTimestampRef = useRef<number>(Date.now());
    const lastNumberInputChangeTimestampRef = useRef<number>(Date.now());
    const lastShowRef = useRef<boolean>(true);
    const forceShowRef = useRef<boolean>(false);
    const offsetInputRef = useRef<HTMLInputElement>(undefined);
    const playbackRateInputRef = useRef<HTMLInputElement>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);
    const [, updateState] = useState<any>();
    const forceUpdate = useCallback(() => updateState({}), []);

    const handleSeek = useCallback(
        (progress: number) => {
            onSeek(progress);
        },
        [onSeek]
    );

    function handleMouseOver() {
        forceShowRef.current = true;
    }

    function handleMouseOut() {
        forceShowRef.current = false;
    }

    useEffect(() => {
        const savedVolume = Number(playbackPreferences.volume);
        setVolume(savedVolume);
        onVolumeChange?.(savedVolume / 100);

        if (savedVolume > 0) {
            setLastCommittedVolume(savedVolume);
        }
    }, [playbackPreferences, onVolumeChange]);

    const [playing, setPlaying] = useState<boolean>(clock.running);
    useEffect(() => {
        clock.onEvent('start', () => setPlaying(true));
        setPlaying(clock.running);
    }, [clock]);
    useEffect(() => {
        clock.onEvent('stop', () => setPlaying(false));
        setPlaying(clock.running);
    }, [clock]);

    useEffect(() => {
        const interval = setInterval(() => {
            let currentShow: boolean;

            if (showOnMouseMovement) {
                currentShow =
                    Date.now() - lastShowTimestampRef.current < 2000 ||
                    (mousePositionRef.current !== undefined &&
                        lastMousePositionRef.current !== undefined &&
                        Math.pow(mousePositionRef.current.x - lastMousePositionRef.current.x, 2) +
                            Math.pow(mousePositionRef.current.y - lastMousePositionRef.current.y, 2) >
                            100);
            } else {
                currentShow =
                    mousePositionRef.current !== undefined &&
                    ((containerRef.current !== null &&
                        mousePositionRef.current.y > containerRef.current.offsetTop - 20) ||
                        mousePositionRef.current.y < 70);
            }

            currentShow =
                currentShow ||
                forceShowRef.current ||
                offsetInputRef.current === document.activeElement ||
                playbackRateInputRef.current === document.activeElement ||
                (!playing && isMobile) ||
                Date.now() - lastNumberInputChangeTimestampRef.current < 2000;

            if (currentShow && !lastShowRef.current) {
                lastShowTimestampRef.current = Date.now();
                setShow(currentShow);
            } else if (!currentShow && lastShowRef.current) {
                setShow(currentShow);
            }

            lastShowRef.current = currentShow;
            lastMousePositionRef.current = { x: mousePositionRef.current?.x ?? 0, y: mousePositionRef.current?.y ?? 0 };
        }, 100);
        return () => clearInterval(interval);
    }, [mousePositionRef, showOnMouseMovement, playing]);

    useEffect(() => onShow?.(show), [onShow, show]);

    const handleOffsetChange = useCallback(
        (offset: number) => {
            lastNumberInputChangeTimestampRef.current = Date.now();
            onOffsetChange(offset);
        },
        [onOffsetChange]
    );

    const handlePlaybackRateChange = useCallback(
        (playbackRate: number) => {
            lastNumberInputChangeTimestampRef.current = Date.now();
            onPlaybackRateChange(playbackRate);
        },
        [onPlaybackRateChange]
    );

    useEffect(() => {
        clock.onEvent('settime', () => forceUpdate());
    }, [clock, forceUpdate]);

    useEffect(() => {
        if (!show || !playing) {
            return;
        }

        const interval = setInterval(() => forceUpdate(), 100);
        return () => clearInterval(interval);
    }, [show, playing, forceUpdate]);

    const handleAudioTrackSelectorClosed = useCallback(() => {
        setAudioTrackSelectorAnchorEl(undefined);
        setAudioTrackSelectorOpen(false);
    }, []);

    const handleAudioTrackSelectorOpened = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setAudioTrackSelectorAnchorEl(e.currentTarget);
        setAudioTrackSelectorOpen(true);
    }, []);

    const handleAudioTrackSelected = useCallback(
        (id: string) => {
            onAudioTrackSelected(id);
            setAudioTrackSelectorAnchorEl(undefined);
            setAudioTrackSelectorOpen(false);
        },
        [onAudioTrackSelected]
    );

    const handleTabSelectorClosed = useCallback(() => {
        setTabSelectorAnchorEl(undefined);
        setTabSelectorOpen(false);
    }, []);

    const handleTabSelectorOpened = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setTabSelectorAnchorEl(e.currentTarget);
        setTabSelectorOpen(true);
    }, []);

    const handleTabSelected = useCallback(
        (tab: VideoTabModel) => {
            onTabSelected?.(tab);
            setTabSelectorAnchorEl(undefined);
            setTabSelectorOpen(false);
        },
        [onTabSelected]
    );

    const handlePlayModeSelectorClosed = useCallback(() => {
        setPlayModeSelectorAnchorEl(undefined);
        setPlayModeSelectorOpen(false);
    }, []);

    const handlePlayModeSelectorOpened = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        setPlayModeSelectorAnchorEl(e.currentTarget);
        setPlayModeSelectorOpen(true);
    }, []);

    const handlePlayModeSelected = useCallback(
        (playMode: PlayMode) => {
            onPlayMode?.(playMode);
        },
        [onPlayMode]
    );

    const handleVolumeMouseOut = useCallback(() => setShowVolumeBar(false), []);
    const handleVolumeMouseOver = useCallback(() => setShowVolumeBar(true), []);

    const handleVolumeChange = useCallback(
        (_: Event, value: number | number[]) => {
            if (typeof value !== 'number') {
                return;
            }

            setVolume(value);
            onVolumeChange?.(value / 100);
        },
        [onVolumeChange]
    );

    const handleVolumeChangeCommitted = useCallback(
        (_: Event | React.SyntheticEvent, value: number | number[]) => {
            if (typeof value !== 'number') {
                return;
            }

            if (value > 0) {
                setLastCommittedVolume(value);
            }

            playbackPreferences.volume = value;
        },
        [playbackPreferences]
    );

    const handleVolumeToggle = useCallback(() => {
        setVolume((volume) => {
            const newVolume = volume > 0 ? 0 : lastCommittedVolume;
            onVolumeChange?.(newVolume / 100);
            return newVolume;
        });
    }, [onVolumeChange, lastCommittedVolume]);

    const handleSubtitleAlignment = useCallback(() => {
        if (!subtitleAlignmentEnabled || subtitleAlignment === undefined || onSubtitleAlignment === undefined) {
            return;
        }

        const newAlignment = subtitleAlignment === 'top' ? 'bottom' : 'top';
        onSubtitleAlignment(newAlignment);
    }, [subtitleAlignment, subtitleAlignmentEnabled, onSubtitleAlignment]);

    const progress = clock.progress(length);

    return (
        <React.Fragment>
            <Fade in={show} timeout={200}>
                <Grid container style={{ position: 'absolute', top: 0 }}>
                    <Grid item>
                        {closeEnabled && (
                            <Tooltip title={t('controls.unloadVideo')!}>
                                <IconButton
                                    color="inherit"
                                    className={classes.topButton}
                                    onClick={onClose}
                                    onMouseOver={handleMouseOver}
                                    onMouseOut={handleMouseOut}
                                >
                                    <CloseIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Grid>
                    {onLoadFiles && (
                        <Grid item>
                            <IconButton
                                color="inherit"
                                className={classes.topButton}
                                onClick={onLoadFiles}
                                onMouseOver={handleMouseOver}
                                onMouseOut={handleMouseOut}
                            >
                                <FolderIcon />
                            </IconButton>
                        </Grid>
                    )}
                    <Grid item style={{ flexGrow: 1 }} />
                    <Grid item>
                        {theaterModeToggleEnabled && (
                            <Tooltip title={t('controls.toggleTheaterMode')!}>
                                <IconButton
                                    color="inherit"
                                    className={theaterModeEnabled ? classes.topButton : classes.inactiveTopButton}
                                    onClick={onTheaterModeToggle}
                                    onMouseOver={handleMouseOver}
                                    onMouseOut={handleMouseOut}
                                >
                                    <AspectRatioIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                        {fullscreenEnabled && (
                            <Tooltip title={t('controls.toggleFullscreen')!}>
                                <IconButton color="inherit" onClick={onFullscreenToggle}>
                                    {fullscreen ? (
                                        <FullscreenExitIcon className={classes.topButton} />
                                    ) : (
                                        <FullscreenIcon className={classes.topButton} />
                                    )}
                                </IconButton>
                            </Tooltip>
                        )}
                        {hideSubtitlePlayerToggleEnabled && (
                            <Tooltip
                                title={
                                    subtitlePlayerHidden
                                        ? t('controls.showSubtitlePlayer')!
                                        : t('controls.hideSubtitlePlayer')!
                                }
                            >
                                <IconButton
                                    color="inherit"
                                    className={classes.topButton}
                                    onClick={onHideSubtitlePlayerToggle}
                                    onMouseOver={handleMouseOver}
                                    onMouseOut={handleMouseOut}
                                >
                                    {subtitlePlayerHidden ? <ArrowBackIcon /> : <ArrowForwardIcon />}
                                </IconButton>
                            </Tooltip>
                        )}
                    </Grid>
                </Grid>
            </Fade>
            <div
                ref={containerRef}
                className={classes.container}
                onMouseOver={handleMouseOver}
                onMouseOut={handleMouseOut}
            >
                <Fade in={show} timeout={200}>
                    <div className={classes.subContainer}>
                        <ProgressBar onSeek={handleSeek} value={progress * 100} />
                        {!hideToolbar && (
                            <Grid container className={classes.gridContainer} direction="row" wrap="nowrap">
                                <Grid item>
                                    <IconButton color="inherit" onClick={() => (playing ? onPause() : onPlay())}>
                                        {playing ? (
                                            <PauseIcon className={classes.button} />
                                        ) : (
                                            <PlayArrowIcon className={classes.button} />
                                        )}
                                    </IconButton>
                                </Grid>
                                {volumeEnabled && (
                                    <Grid
                                        item
                                        onMouseOver={handleVolumeMouseOver}
                                        onMouseOut={handleVolumeMouseOut}
                                        className={
                                            showVolumeBar
                                                ? classes.volumeInputContainerShown
                                                : classes.volumeInputContainerHidden
                                        }
                                    >
                                        <Grid container spacing={0} direction="row" wrap="nowrap">
                                            <Grid item>
                                                <IconButton color="inherit" onClick={handleVolumeToggle}>
                                                    {volume === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
                                                </IconButton>
                                            </Grid>
                                            <Grid
                                                item
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <VolumeSlider
                                                    onChange={handleVolumeChange}
                                                    onChangeCommitted={handleVolumeChangeCommitted}
                                                    value={volume}
                                                    defaultValue={100}
                                                    classes={{
                                                        root: showVolumeBar
                                                            ? classes.volumeInputShown
                                                            : classes.volumeInputHidden,
                                                        thumb: showVolumeBar
                                                            ? classes.volumeInputThumbShown
                                                            : classes.volumeInputThumbHidden,
                                                    }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                )}
                                {Number.isFinite(length) && (
                                    <Grid item style={{ marginLeft: 10 }}>
                                        <TimeDisplay
                                            currentMilliseconds={progress * length}
                                            totalMilliseconds={displayLength || length}
                                        />
                                    </Grid>
                                )}
                                {offsetEnabled && !showVolumeBar && !isReallySmallScreen && (
                                    <Tooltip title={t('controls.subtitleOffset')!}>
                                        <Grid item style={{ marginLeft: 10 }}>
                                            <SubtitleOffsetInput
                                                inputRef={offsetInputRef}
                                                offset={offset}
                                                onOffset={handleOffsetChange}
                                                disableKeyEvents={disableKeyEvents}
                                            />
                                        </Grid>
                                    </Tooltip>
                                )}
                                {playbackRateEnabled && !showVolumeBar && !isReallySmallScreen && (
                                    <Grid item style={{ marginLeft: 10 }}>
                                        <Tooltip title={t('controls.playbackRate')!}>
                                            <PlaybackRateInput
                                                inputRef={playbackRateInputRef}
                                                playbackRate={playbackRate}
                                                onPlaybackRate={handlePlaybackRateChange}
                                            />
                                        </Tooltip>
                                    </Grid>
                                )}
                                <Grid item style={{ flexGrow: 1 }}></Grid>
                                <ResponsiveButtonGroup>
                                    {subtitleAlignmentEnabled && subtitleAlignment !== undefined && (
                                        <Tooltip title={t('controls.subtitleAlignment')!}>
                                            <IconButton color="inherit" onClick={handleSubtitleAlignment}>
                                                {subtitleAlignment === 'top' ? (
                                                    <VerticalAlignTopIcon />
                                                ) : (
                                                    <VerticalAlignBottomIcon />
                                                )}
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    {subtitlesToggle && (
                                        <Tooltip title={t('controls.toggleSubtitles')!}>
                                            <IconButton color="inherit" onClick={onSubtitlesToggle}>
                                                <SubtitlesIcon
                                                    className={
                                                        subtitlesEnabled ? classes.button : classes.inactiveButton
                                                    }
                                                />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    {audioTracks && audioTracks.length > 1 && (
                                        <Tooltip title={t('controls.selectAudioTrack')!}>
                                            <IconButton color="inherit" onClick={handleAudioTrackSelectorOpened}>
                                                <QueueMusicIcon className={classes.button} />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    {tabs && tabs.length > 0 && (
                                        <Tooltip title={t('controls.selectVideoElement')!}>
                                            <IconButton color="inherit" onClick={handleTabSelectorOpened}>
                                                <VideocamIcon
                                                    className={selectedTab ? classes.button : classes.inactiveButton}
                                                />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    {playModeEnabled && (
                                        <Tooltip title={t('controls.playbackMode')!}>
                                            <IconButton color="inherit" onClick={handlePlayModeSelectorOpened}>
                                                <TuneIcon
                                                    className={
                                                        playModeEnabled ? classes.button : classes.inactiveButton
                                                    }
                                                />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    {popOutEnabled && (
                                        <Tooltip title={popOut ? t('controls.popIn')! : t('controls.popOut')!}>
                                            <IconButton color="inherit" onClick={onPopOutToggle}>
                                                <OpenInNewIcon
                                                    className={classes.button}
                                                    style={popOut ? { transform: 'rotateX(180deg)' } : {}}
                                                />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                    {onBlurOverlayToggle && (
                                        <Tooltip
                                            title={
                                                blurOverlayEnabled
                                                    ? t('controls.hideBlurOverlay')
                                                    : t('controls.showBlurOverlay')
                                            }
                                        >
                                            <IconButton color="inherit" onClick={onBlurOverlayToggle}>
                                                {blurOverlayEnabled ? (
                                                    <BlurOnIcon className={classes.button} />
                                                ) : (
                                                    <BlurOffIcon className={classes.inactiveButton} />
                                                )}
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </ResponsiveButtonGroup>
                            </Grid>
                        )}
                    </div>
                </Fade>
                <TabSelector
                    open={tabSelectorOpen && show}
                    anchorEl={tabSelectorAnchorEl}
                    tabs={tabs}
                    selectedTab={selectedTab}
                    onClose={handleTabSelectorClosed}
                    onTabSelected={handleTabSelected}
                />
                <AudioTrackSelector
                    open={audioTrackSelectorOpen && show}
                    anchorEl={audioTrackSelectorAnchorEl}
                    audioTracks={audioTracks}
                    selectedAudioTrack={selectedAudioTrack}
                    onClose={handleAudioTrackSelectorClosed}
                    onAudioTrackSelected={handleAudioTrackSelected}
                />
                <PlayModeSelector
                    open={playModeSelectorOpen && show}
                    anchorEl={playModeSelectorAnchorEl}
                    selectedPlayModes={playModes || new Set()}
                    onClose={handlePlayModeSelectorClosed}
                    onPlayMode={handlePlayModeSelected}
                />
            </div>
        </React.Fragment>
    );
}
