import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { makeStyles } from '@mui/styles';
import { timeDurationDisplay } from '@project/common/util';
import { clipboardWrite } from '@project/common/util/clipboard';
import { asbError } from '@project/common/util/log';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Popover from '@mui/material/Popover';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import Tooltip from '@project/common/components/Tooltip';
import Typography from '@mui/material/Typography';
import type { Theme } from '@mui/material/styles';
import type { CopyHistoryItem } from '@project/common';
import { AudioClip } from '@project/common/audio-clip';
import { MediaFragment } from '@project/common';
import type { MediaSources } from '@project/common/app/services/media-sources';

interface CopyHistoryListProps {
    open: boolean;
    forceShowDownloadOptions?: boolean;
    items: CopyHistoryItem[];
    sources?: MediaSources;
    onClose: () => void;
    onDelete: (item: CopyHistoryItem) => void;
    onDeleteAll: () => void;
    onAnki: (item: CopyHistoryItem) => void;
    onSelect?: (item: CopyHistoryItem) => void;
    onClipAudio: (item: CopyHistoryItem) => void;
    onDownloadImage: (item: CopyHistoryItem) => void;
    onDownloadSectionAsSrt?: (name: string, items: CopyHistoryItem[]) => void;
}

const useStyles = makeStyles<Theme>((theme) => ({
    listContainer: {
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
    },
    list: {
        flexGrow: 1,
    },
    clearButton: {
        margin: theme.spacing(2),
    },
    listItem: {
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
        },
    },
    jumpableListItem: {
        cursor: 'pointer',
    },
    jumpableText: {
        cursor: 'text',
    },
    listItemGutters: {
        paddingLeft: 5,
        paddingRight: 5,
    },
    listItemIconRoot: {
        minWidth: 20,
    },
    emptyState: {
        display: 'flex',
        flexGrow: 1,
        justifyContent: 'center',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: 15,
    },
    text: {
        flexGrow: 1,
    },
    emptyText: {
        flexGrow: 1,
        color: theme.palette.text.secondary,
    },
    timestamp: {
        paddingRight: 15,
        paddingLeft: 15,
        color: theme.palette.text.secondary,
    },
}));

const useAudioAvailability = (item: CopyHistoryItem) => {
    const [isAudioAvailable, setIsAudioAvailable] = useState<boolean>();

    useEffect(() => {
        const clip = AudioClip.fromCard(item, 0, 0, false);

        if (clip) {
            setIsAudioAvailable(clip.error === undefined);
        } else {
            setIsAudioAvailable(false);
        }
    }, [item]);

    return { isAudioAvailable };
};

const useImageAvailability = (item: CopyHistoryItem) => {
    const [isImageAvailable, setIsImageAvailable] = useState<boolean>();

    useEffect(() => {
        const image = MediaFragment.fromCard(item, 0, 0);

        if (image) {
            setIsImageAvailable(image.error === undefined);
        } else {
            setIsImageAvailable(false);
        }
    }, [item]);

    return { isImageAvailable };
};

interface MenuProps {
    open: boolean;
    item: CopyHistoryItem;
    anchorEl?: Element;
    forceShowDownloadOptions?: boolean;
    jumpPossible?: boolean;
    onClose: () => void;
    onSelect?: (item: CopyHistoryItem) => void;
    onClipAudio: (item: CopyHistoryItem) => void;
    onDownloadImage: (item: CopyHistoryItem) => void;
    onDelete: (item: CopyHistoryItem) => void;
}

function Menu({
    open,
    anchorEl,
    forceShowDownloadOptions,
    jumpPossible = false,
    onClose,
    onSelect,
    onClipAudio,
    onDownloadImage,
    onDelete,
    item,
}: MenuProps) {
    const { t } = useTranslation();
    const handleCopy = useCallback(() => {
        void clipboardWrite(item.subtitle.text).catch((error) => asbError('app/clipboard', error));
        onClose();
    }, [item, onClose]);

    const handleJumpTo = useCallback(() => {
        if (onSelect === undefined || !jumpPossible) {
            return;
        }
        onSelect(item);
        onClose();
    }, [item, onSelect, jumpPossible, onClose]);

    const handleClipAudio = useCallback(() => {
        onClipAudio(item);
        onClose();
    }, [item, onClipAudio, onClose]);

    const handleDownloadImage = useCallback(() => {
        onDownloadImage(item);
        onClose();
    }, [item, onDownloadImage, onClose]);

    const handleDelete = useCallback(() => {
        onDelete(item);
        onClose();
    }, [item, onDelete, onClose]);

    const { isImageAvailable } = useImageAvailability(item);
    const { isAudioAvailable } = useAudioAvailability(item);

    return (
        <Popover
            disableEnforceFocus={true}
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{
                vertical: 'center',
                horizontal: 'center',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
        >
            <List>
                <ListItem disablePadding onClick={handleCopy}>
                    <ListItemButton>
                        <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={t('action.copy')} />
                    </ListItemButton>
                </ListItem>
                {onSelect && jumpPossible && (
                    <ListItem disablePadding onClick={handleJumpTo}>
                        <ListItemButton>
                            <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={t('action.jumpTo')} />
                        </ListItemButton>
                    </ListItem>
                )}
                {(isAudioAvailable || forceShowDownloadOptions) && (
                    <ListItem disablePadding onClick={handleClipAudio}>
                        <ListItemButton>
                            <ListItemText
                                primaryTypographyProps={{ variant: 'body2' }}
                                primary={t('action.downloadAudio')}
                            />
                        </ListItemButton>
                    </ListItem>
                )}
                {(isImageAvailable || forceShowDownloadOptions) && (
                    <ListItem disablePadding onClick={handleDownloadImage}>
                        <ListItemButton>
                            <ListItemText
                                primaryTypographyProps={{ variant: 'body2' }}
                                primary={t('action.downloadImage')}
                            />
                        </ListItemButton>
                    </ListItem>
                )}
                <ListItem disablePadding onClick={handleDelete}>
                    <ListItemButton>
                        <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={t('action.delete')} />
                    </ListItemButton>
                </ListItem>
            </List>
        </Popover>
    );
}

export default function CopyHistoryList({
    open,
    items,
    forceShowDownloadOptions,
    sources,
    onSelect,
    onClipAudio,
    onDownloadImage,
    onDelete,
    onDeleteAll,
    onDownloadSectionAsSrt,
    onAnki,
}: CopyHistoryListProps) {
    const classes = useStyles();
    const listContainerRef = useRef<HTMLDivElement | null>(null);
    const bottomElementRef = useRef<HTMLElement | null>(null);
    const scrollToBottomRefCallback = useCallback((bottomElement: HTMLElement | null) => {
        if (bottomElement) {
            // Scroll to bottom on first mount.
            const isMounting = !bottomElementRef.current;
            bottomElementRef.current = bottomElement;

            if (isMounting) {
                bottomElement.scrollIntoView();
            }
        }

        if (!bottomElement || !listContainerRef.current) {
            return;
        }

        // Stick to bottom if already at bottom and a new item is added.
        const listElement = listContainerRef.current;
        const threshold = 20;
        const distanceToBottom =
            listElement.scrollHeight - listElement.scrollTop - listElement.clientHeight - bottomElement.clientHeight;
        const shouldAutoScroll = distanceToBottom <= threshold;

        if (shouldAutoScroll) {
            bottomElement.scrollIntoView();
        }
    }, []);

    const [menuItem, setMenuItem] = useState<CopyHistoryItem>();
    const [menuJumpPossible, setMenuJumpPossible] = useState<boolean>(false);
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const [menuAnchorEl, setMenuAnchorEl] = useState<Element>();
    const { t } = useTranslation();

    const handleMenu = useCallback((e: React.MouseEvent, item: CopyHistoryItem, jumpPossible: boolean) => {
        setMenuItem(item);
        setMenuJumpPossible(jumpPossible);
        setMenuOpen(true);
        setMenuAnchorEl(e.currentTarget);
    }, []);

    const handleMenuClosed = useCallback(() => {
        setMenuItem(undefined);
        setMenuJumpPossible(false);
        setMenuOpen(false);
        setMenuAnchorEl(undefined);
    }, []);

    const handleDelete = useCallback(
        (item: CopyHistoryItem) => {
            onDelete(item);
        },
        [onDelete]
    );

    let content;

    if (items.length > 0) {
        const elements: React.JSX.Element[] = [];
        let lastSeenItemName: string | null = null;
        let i = 0;
        const itemNameCounters: { [name: string]: number } = {};
        const itemsBySection: { [key: string]: CopyHistoryItem[] } = {};
        let currentKey: string | undefined;

        for (const item of items) {
            if (lastSeenItemName === null || lastSeenItemName !== item.subtitleFileName) {
                if (item.subtitleFileName in itemNameCounters) {
                    itemNameCounters[item.subtitleFileName]++;
                } else {
                    itemNameCounters[item.subtitleFileName] = 0;
                }

                const key = item.subtitleFileName + '-' + itemNameCounters[item.subtitleFileName];
                itemsBySection[key] = [];
                lastSeenItemName = item.subtitleFileName;
                currentKey = key;

                elements.push(
                    <ListItem key={key}>
                        <Typography color="textSecondary">{item.subtitleFileName}</Typography>
                        {onDownloadSectionAsSrt && (
                            <ListItemSecondaryAction>
                                <Tooltip title={t('copyHistory.downloadMinedSubsAsSrt')}>
                                    <IconButton
                                        onClick={() =>
                                            onDownloadSectionAsSrt?.(item.subtitleFileName, itemsBySection[key])
                                        }
                                        edge="end"
                                    >
                                        <SaveAltIcon />
                                    </IconButton>
                                </Tooltip>
                            </ListItemSecondaryAction>
                        )}
                    </ListItem>
                );
            }

            itemsBySection[currentKey!].push(item);
            const ref = i === items.length - 1 ? scrollToBottomRefCallback : null;

            const jumpPossible = onSelect !== undefined && (sources?.hasSubtitleFile(item.subtitleFileName) ?? false);
            elements.push(
                <ListItem
                    ref={ref}
                    key={item.id}
                    className={`${classes.listItem} ${jumpPossible ? classes.jumpableListItem : ''}`}
                    classes={{ gutters: classes.listItemGutters }}
                    onClick={
                        jumpPossible
                            ? (event) => {
                                  const selection = document.getSelection();
                                  const row = event.currentTarget;
                                  const selectingText =
                                      selection !== null &&
                                      selection.type === 'Range' &&
                                      !selection.isCollapsed &&
                                      selection.anchorNode !== null &&
                                      row.contains(selection.anchorNode);
                                  if (selectingText) return;
                                  onSelect?.(item);
                              }
                            : undefined
                    }
                >
                    <ListItemIcon classes={{ root: classes.listItemIconRoot }}>
                        <Tooltip title={t('copyHistory.exportToAnki')}>
                            <IconButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAnki(item);
                                }}
                            >
                                <NoteAddIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </ListItemIcon>
                    <ListItemIcon classes={{ root: classes.listItemIconRoot }}>
                        <IconButton
                            onClick={(e) => {
                                e.stopPropagation();
                                handleMenu(e, item, jumpPossible);
                            }}
                        >
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </ListItemIcon>
                    <Tooltip title={t('action.jumpTo')} disabled={!jumpPossible}>
                        <ListItemText
                            primary={
                                <Grid wrap="nowrap" container>
                                    <Grid item className={item.subtitle.text === '' ? classes.emptyText : classes.text}>
                                        <span className={jumpPossible ? classes.jumpableText : undefined}>
                                            {item.subtitle.text === '' ? t('copyHistory.blank') : item.subtitle.text}
                                        </span>
                                    </Grid>
                                    <Grid item className={classes.timestamp}>
                                        {timeDurationDisplay(item.subtitle.start, item.subtitle.start, false)}
                                    </Grid>
                                </Grid>
                            }
                        />
                    </Tooltip>
                </ListItem>
            );

            ++i;
        }

        content = (
            <Paper square className={classes.listContainer} ref={listContainerRef}>
                <List className={classes.list}>{elements}</List>
                <Button
                    variant="contained"
                    color="primary"
                    className={classes.clearButton}
                    startIcon={<DeleteIcon />}
                    onClick={onDeleteAll}
                >
                    {t('copyHistory.deleteAll')}
                </Button>
            </Paper>
        );
    } else {
        content = (
            <Paper square className={classes.emptyState}>
                <Typography variant="h6">{t('copyHistory.miningHistoryEmpty')}</Typography>
            </Paper>
        );
    }

    return (
        <>
            {content}
            {menuItem && (
                <Menu
                    open={open && menuOpen}
                    forceShowDownloadOptions={forceShowDownloadOptions}
                    anchorEl={menuAnchorEl}
                    item={menuItem}
                    jumpPossible={menuJumpPossible}
                    onClose={handleMenuClosed}
                    onSelect={onSelect}
                    onClipAudio={onClipAudio}
                    onDownloadImage={onDownloadImage}
                    onDelete={handleDelete}
                />
            )}
        </>
    );
}
