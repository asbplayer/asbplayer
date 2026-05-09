import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { ChromeExtension } from '@project/common/app';
import { useTranslation } from 'react-i18next';
import CenteredGridItem from './CenteredGridItem';
import CenteredGridContainer from './CenteredGridContainer';
import LoadSubtitlesIcon from '@project/common/components/LoadSubtitlesIcon';
import HistoryIcon from '@mui/icons-material/History';
import ButtonGroup from '@mui/material/ButtonGroup';
import TutorialIcon from '@project/common/components/TutorialIcon';

interface Props {
    extension: ChromeExtension;
    videoElementCount: number;
    miningHistoryCount: number;
    onLoadSubtitles: () => void;
    onShowMiningHistory: () => void;
    onOpenUserGuide: () => void;
}

const VideoElementInfoText = ({ videoElementCount }: { videoElementCount: number }) => {
    const { t } = useTranslation();
    return (
        <Box p={3}>
            <Typography align="center" variant="h6">
                {videoElementCount === 0 ? t('landing.noVideoElementsDetected') : t('landing.videoElementsDetected')}
            </Typography>
        </Box>
    );
};

const SidePanelHome = ({
    videoElementCount,
    miningHistoryCount,
    onLoadSubtitles,
    onShowMiningHistory,
    onOpenUserGuide,
}: Props) => {
    const { t } = useTranslation();

    return (
        <CenteredGridContainer direction="column">
            <CenteredGridItem>
                <VideoElementInfoText videoElementCount={videoElementCount} />
            </CenteredGridItem>
            <CenteredGridItem>
                <ButtonGroup variant="contained" color="primary" orientation="vertical">
                    <Button
                        startIcon={<LoadSubtitlesIcon />}
                        disabled={videoElementCount === 0}
                        onClick={onLoadSubtitles}
                    >
                        {t('action.loadSubtitles')}
                    </Button>
                    <Button startIcon={<HistoryIcon />} onClick={onShowMiningHistory}>
                        {`${t('bar.miningHistory')} (${miningHistoryCount})`}
                    </Button>
                    <Button startIcon={<TutorialIcon />} onClick={onOpenUserGuide}>
                        {t('action.userGuide')}
                    </Button>
                </ButtonGroup>
            </CenteredGridItem>
        </CenteredGridContainer>
    );
};

export default SidePanelHome;
