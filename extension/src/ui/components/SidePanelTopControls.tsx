import IconButton from '@mui/material/IconButton';
import HistoryIcon from '@mui/icons-material/History';
import LoadSubtitlesIcon from '@project/common/components/LoadSubtitlesIcon';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import BarChartIcon from '@mui/icons-material/BarChart';
import TimelineIcon from '@mui/icons-material/Timeline';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import Badge from '@mui/material/Badge';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Popover from '@mui/material/Popover';
import { ForwardedRef, useEffect, useState } from 'react';
import React from 'react';
import Tooltip from '@project/common/components/Tooltip';
import { useTranslation } from 'react-i18next';

interface Props {
    show: boolean;
    canDownloadSubtitles: boolean;
    onLoadSubtitles: () => void;
    onDownloadSubtitles: () => void;
    onDownloadSubtitleTimeline: () => void;
    onBulkExportSubtitles: () => void;
    onShowMiningHistory: () => void;
    miningHistoryCount: number;
    onShowStatistics: () => void;
    disableBulkExport?: boolean;
}

const SidePanelTopControls = React.forwardRef(function SidePanelTopControls(
    {
        show,
        canDownloadSubtitles,
        onLoadSubtitles,
        onDownloadSubtitles,
        onDownloadSubtitleTimeline,
        onBulkExportSubtitles,
        onShowMiningHistory,
        miningHistoryCount,
        onShowStatistics,
        disableBulkExport,
    }: Props,
    ref: ForwardedRef<HTMLDivElement>
) {
    const { t } = useTranslation();
    const [forceShow, setForceShow] = useState<boolean>(true);
    const [downloadMenuAnchorEl, setDownloadMenuAnchorEl] = useState<HTMLElement>();

    useEffect(() => {
        const timeoutId = setTimeout(() => setForceShow(false), 1000);
        return () => clearTimeout(timeoutId);
    }, []);

    return (
        <>
            <Fade in={show || forceShow}>
                <Box ref={ref} style={{ position: 'absolute', top: 12, right: 12 }}>
                    <Grid container direction="column">
                        <Grid item>
                            <Tooltip title={t('action.loadSubtitles')}>
                                <IconButton onClick={onLoadSubtitles}>
                                    <LoadSubtitlesIcon />
                                </IconButton>
                            </Tooltip>
                        </Grid>
                        {canDownloadSubtitles && (
                            <>
                                <Grid item>
                                    <Tooltip title={t('action.downloadSubtitlesAsSrt')}>
                                        <IconButton onClick={(event) => setDownloadMenuAnchorEl(event.currentTarget)}>
                                            <SaveAltIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Grid>
                                <Grid item>
                                    <Tooltip title={t('action.bulkExportSubtitles')} disabled={!!disableBulkExport}>
                                        <span>
                                            <IconButton onClick={onBulkExportSubtitles} disabled={!!disableBulkExport}>
                                                <ImportExportIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Grid>
                            </>
                        )}
                        <Grid item>
                            <IconButton onClick={onShowMiningHistory}>
                                <Tooltip title={t('bar.miningHistory')}>
                                    <Badge badgeContent={miningHistoryCount} color="default" showZero>
                                        <HistoryIcon />
                                    </Badge>
                                </Tooltip>
                            </IconButton>
                        </Grid>
                        <Grid item>
                            <IconButton onClick={onShowStatistics}>
                                <Tooltip title={t('statistics.title')}>
                                    <BarChartIcon />
                                </Tooltip>
                            </IconButton>
                        </Grid>
                    </Grid>
                </Box>
            </Fade>
            <Popover
                open={downloadMenuAnchorEl !== undefined}
                anchorEl={downloadMenuAnchorEl}
                onClose={() => setDownloadMenuAnchorEl(undefined)}
                anchorOrigin={{ vertical: 'center', horizontal: 'left' }}
                transformOrigin={{ vertical: 'center', horizontal: 'right' }}
            >
                <List dense>
                    <ListItem disablePadding>
                        <ListItemButton
                            onClick={() => {
                                setDownloadMenuAnchorEl(undefined);
                                onDownloadSubtitles();
                            }}
                        >
                            <ListItemIcon>
                                <SaveAltIcon />
                            </ListItemIcon>
                            <ListItemText primary={t('action.downloadSubtitlesAsSrt')} />
                        </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                        <ListItemButton
                            onClick={() => {
                                setDownloadMenuAnchorEl(undefined);
                                onDownloadSubtitleTimeline();
                            }}
                        >
                            <ListItemIcon>
                                <TimelineIcon />
                            </ListItemIcon>
                            <ListItemText primary={t('action.downloadSubtitleTimelineAsHtml')} />
                        </ListItemButton>
                    </ListItem>
                </List>
            </Popover>
        </>
    );
});

export default SidePanelTopControls;
