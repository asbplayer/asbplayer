import { useState, FC, useCallback } from 'react';
import VideocamIcon from '@mui/icons-material/Videocam';
import { useTranslation } from 'react-i18next';
import { VideoTabModel } from '../..';
import Button, { type ButtonProps } from '@mui/material/Button';
import VideoElementFavicon from './VideoElementFavicon';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Popover from '@mui/material/Popover';
import ListItemButton from '@mui/material/ListItemButton';

interface Props {
    onVideoElementSelected: (element: VideoTabModel) => void;
    videoElements: VideoTabModel[];
}

const NoWrapButton: FC<ButtonProps & { label?: string }> = ({ children, label, ...props }) => {
    return (
        <Button variant="outlined" {...props}>
            {children}
            <Typography variant="button" sx={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {label}
            </Typography>
        </Button>
    );
};

const VideoElementSelector = ({ videoElements, onVideoElementSelected }: Props) => {
    const { t } = useTranslation();
    const [listOpen, setListOpen] = useState<boolean>(false);
    const [anchorEl, setAnchorEl] = useState<HTMLElement>();
    const handleOpenList = useCallback((e: React.UIEvent) => {
        setAnchorEl(e.currentTarget as HTMLElement);
        setListOpen(true);
    }, []);
    const handleVideoElementSelectedFromList = (element: VideoTabModel) => {
        setListOpen(false);
        onVideoElementSelected(element);
    };

    if (videoElements.length === 1) {
        const videoElement = videoElements[0];
        return (
            <NoWrapButton label={videoElement.title} onClick={() => onVideoElementSelected(videoElement)}>
                <VideoElementFavicon videoElement={videoElement} />
            </NoWrapButton>
        );
    }

    return (
        <>
            <NoWrapButton
                onClick={handleOpenList}
                label={t('controls.selectVideoElement')}
                startIcon={<VideocamIcon />}
            />
            <Popover anchorEl={anchorEl} open={listOpen} onClose={() => setListOpen(false)}>
                <List dense disablePadding sx={{ width: '100%' }}>
                    {videoElements.map((v) => (
                        <ListItem sx={{ pl: 0, pr: 0 }} key={v.src} value={v.src}>
                            <ListItemButton onClick={() => handleVideoElementSelectedFromList(v)}>
                                <VideoElementFavicon videoElement={v} />
                                <Typography sx={{ textOverflow: 'elipses', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                    {v.title}
                                </Typography>
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Popover>
        </>
    );
};

export default VideoElementSelector;
