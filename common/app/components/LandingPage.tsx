import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { makeStyles } from '@mui/styles';
import gt from 'semver/functions/gt';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ChromeExtension from '../services/chrome-extension';
import { useTheme, type Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useAppBarHeight } from '../../hooks/use-app-bar-height';
import { VideoTabModel } from '../..';
import VideoElementSelector from './VideoElementSelector';
import LoadSubtitlesIcon from '../../components/LoadSubtitlesIcon';
import RestoreIcon from '@mui/icons-material/Restore';

interface StylesProps {
    appBarHidden: boolean;
    appBarHeight: number;
}

const useStyles = makeStyles<Theme, StylesProps>({
    background: ({ appBarHidden, appBarHeight }) => ({
        position: 'absolute',
        height: appBarHidden ? '100vh' : `calc(100vh - ${appBarHeight}px)`,
        width: '100%',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
        textAlign: 'center',
    }),
    browseLink: {
        cursor: 'pointer',
    },
});

interface Props {
    extension: ChromeExtension;
    latestExtensionVersion: string;
    extensionUrl: string;
    loading: boolean;
    dragging: boolean;
    appBarHidden: boolean;
    videoElements: VideoTabModel[];
    canRestoreLastSession: boolean;
    onFileSelector: React.MouseEventHandler<HTMLAnchorElement> &
        React.MouseEventHandler<HTMLSpanElement> &
        React.MouseEventHandler<HTMLLabelElement>;
    onVideoElementSelected: (videoElement: VideoTabModel) => void;
    onRestoreLastSession: () => void;
    onOpenSubtitleTrackSelector: () => void;
}

export default function LandingPage({
    extension,
    latestExtensionVersion,
    extensionUrl,
    loading,
    dragging,
    appBarHidden,
    videoElements,
    canRestoreLastSession,
    onFileSelector,
    onVideoElementSelected,
    onRestoreLastSession,
    onOpenSubtitleTrackSelector,
}: Props) {
    const { t } = useTranslation();
    const appBarHeight = useAppBarHeight();
    const classes = useStyles({ appBarHidden, appBarHeight });
    const extensionUpdateAvailable = extension.version && gt(latestExtensionVersion, extension.version);
    const theme = useTheme();
    const smallScreen = useMediaQuery(theme.breakpoints.down(500));
    const showVideoElementSelector =
        extension.supportsLandingPageStreamingVideoElementSelector && videoElements.length > 0;
    let buttonCount = 1;
    if (canRestoreLastSession) {
        buttonCount++;
    }
    if (showVideoElementSelector) {
        buttonCount++;
    }

    return (
        <Paper square className={classes.background}>
            <Fade in={!loading && !dragging} timeout={500}>
                <div style={{ minWidth: smallScreen ? window.innerWidth : 'auto' }}>
                    <Typography variant="h6">
                        <Trans i18nKey={'landing.cta'}>
                            Drag and drop subtitle and media files, or
                            <Link
                                className={classes.browseLink}
                                onClick={onFileSelector}
                                color="primary"
                                component="label"
                            >
                                browse
                            </Link>
                            .
                        </Trans>
                        <br />
                        {!extension.installed && (
                            <Trans i18nKey="landing.extensionNotInstalled">
                                Install the
                                <Link color="primary" target="_blank" rel="noreferrer" href={extensionUrl}>
                                    Chrome extension
                                </Link>
                                to sync subtitles with streaming video.
                            </Trans>
                        )}
                        {extensionUpdateAvailable && (
                            <Trans i18nKey="landing.extensionUpdateAvailable">
                                An extension
                                <Link color="primary" target="_blank" rel="noreferrer" href={extensionUrl}>
                                    update
                                </Link>{' '}
                                is available.
                            </Trans>
                        )}
                    </Typography>
                    {(canRestoreLastSession ||
                        (extension.supportsLandingPageStreamingVideoElementSelector && videoElements.length > 0)) && (
                        <Box
                            sx={{
                                position: 'absolute',
                                display: 'flex',
                                flexDirection: 'column',
                                bottom: 0,
                                left: 0,
                                padding: 1.5,
                                width: '100%',
                                gap: 1.5,
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: `repeat(${buttonCount}, 1fr)` },
                                    gap: 1.5,
                                }}
                            >
                                <Button
                                    variant="outlined"
                                    color="primary"
                                    startIcon={<LoadSubtitlesIcon fontSize="small" />}
                                    onClick={onOpenSubtitleTrackSelector}
                                    fullWidth
                                >
                                    {t('action.loadSubtitles')}
                                </Button>
                                {canRestoreLastSession && (
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        startIcon={<RestoreIcon />}
                                        onClick={onRestoreLastSession}
                                        fullWidth
                                    >
                                        {t('landing.restoreLastSession')}
                                    </Button>
                                )}
                                {showVideoElementSelector && videoElements.length > 0 && (
                                    <VideoElementSelector
                                        videoElements={videoElements}
                                        onVideoElementSelected={onVideoElementSelected}
                                    />
                                )}
                            </Box>
                        </Box>
                    )}
                </div>
            </Fade>
        </Paper>
    );
}
