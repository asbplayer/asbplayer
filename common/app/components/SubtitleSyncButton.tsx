import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import Tooltip from '../../components/Tooltip';
import { SubtitleModel } from '@project/common';
import { SubtitleReader } from '@project/common/subtitle-reader';
import SubtitleSyncDialog from './SubtitleSyncDialog';

export interface SubtitleSyncData {
    subtitles: SubtitleModel[];
    subtitleFileNames: string[];
    subtitleReader: SubtitleReader;
    onApplyOffset: (offset: number) => void;
}

interface Props extends SubtitleSyncData {
    color?: IconButtonProps['color'];
    className?: string;
}

const SubtitleSyncButton = ({
    subtitles,
    subtitleFileNames,
    subtitleReader,
    onApplyOffset,
    color,
    className,
}: Props) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    if (subtitles.length === 0) {
        return null;
    }

    return (
        <>
            <Tooltip title={t('controls.subtitleSync')!}>
                <IconButton color={color} onClick={() => setOpen(true)}>
                    <SyncAltIcon className={className} />
                </IconButton>
            </Tooltip>
            {open && (
                <SubtitleSyncDialog
                    subtitles={subtitles}
                    subtitleFileNames={subtitleFileNames}
                    subtitleReader={subtitleReader}
                    onApplyOffset={onApplyOffset}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
};

export default SubtitleSyncButton;
