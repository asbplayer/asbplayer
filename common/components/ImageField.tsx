import React, { useState, useEffect } from 'react';
import makeStyles from '@mui/styles/makeStyles';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import { useTranslation } from 'react-i18next';
import { MediaFragment, MediaFragmentErrorCode } from '@project/common';
import { type Theme } from '@mui/material';
import { useImageData } from '../hooks/use-image-data';
import Tooltip from './Tooltip';
import ImageIcon from '@mui/icons-material/Image';

interface StyleProps {
    dataUrl: string;
}

const useStyles = makeStyles<Theme, StyleProps>(() => ({
    root: {
        cursor: 'pointer',
        '& input': {
            cursor: 'pointer',
        },
    },
    imagePreview: ({ dataUrl }) => {
        if (dataUrl) {
            return {
                position: 'relative',
                top: 8,
                borderRadius: 2,
                marginRight: 8,
            };
        }

        return {};
    },
}));

const useImageHelperText = (image?: MediaFragment) => {
    const { t } = useTranslation();
    const [imageHelperText, setImageHelperText] = useState<string>();
    const [imageAvailable, setImageAvailable] = useState<boolean>();

    useEffect(() => {
        if (image) {
            if (image.error === undefined) {
                setImageAvailable(true);
                setImageHelperText(undefined);
            } else if (image.error === MediaFragmentErrorCode.fileLinkLost) {
                setImageAvailable(false);
                setImageHelperText(t('ankiDialog.imageFileLinkLost')!);
            } else if (image.error === MediaFragmentErrorCode.captureFailed) {
                setImageAvailable(false);
                setImageHelperText(t('ankiDialog.imageCaptureFailed')!);
            }
        }
    }, [image, t]);

    return { imageHelperText, imageAvailable };
};

interface Props {
    onViewImage: (e: React.MouseEvent<HTMLDivElement>) => void;
    onCopyImageToClipboard: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    image: MediaFragment;
    copyEnabled: boolean;
}

export default function ImageField({ image, onViewImage, onCopyImageToClipboard, copyEnabled }: Props) {
    const { t } = useTranslation();
    const { dataUrl, width, height } = useImageData({ image, smoothTransition: false });
    const classes = useStyles({ dataUrl });
    const { imageHelperText, imageAvailable } = useImageHelperText(image);
    const resizeRatio = height === 0 ? 0 : 20 / height;
    const copyAllowed = copyEnabled && image.extension !== 'webm';

    return (
        <div className={classes.root} onClick={onViewImage}>
            <TextField
                variant="filled"
                color="primary"
                fullWidth
                value={image.name}
                label={t('ankiDialog.image')}
                helperText={imageHelperText}
                disabled={!imageAvailable}
                slotProps={{
                    input: {
                        startAdornment:
                            dataUrl &&
                            width > 0 &&
                            height > 0 &&
                            (image.extension === 'webm' ? (
                                <video
                                    src={dataUrl}
                                    width={width * resizeRatio}
                                    height={height * resizeRatio}
                                    className={classes.imagePreview}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                />
                            ) : (
                                <img
                                    src={dataUrl}
                                    width={width * resizeRatio}
                                    height={height * resizeRatio}
                                    className={classes.imagePreview}
                                />
                            )),
                        endAdornment: (
                            <InputAdornment position="end">
                                <>
                                    <Tooltip
                                        disabled={!image.canChangeTimestamp || !imageAvailable}
                                        title={t('ankiDialog.imagePreview')!}
                                    >
                                        <span>
                                            <IconButton disabled={!imageAvailable} onClick={() => {}} edge="end">
                                                <ImageIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    {copyAllowed && (
                                        <Tooltip disabled={!imageAvailable} title={t('ankiDialog.copyToClipboard')!}>
                                            <span>
                                                <IconButton
                                                    disabled={!imageAvailable}
                                                    onClick={onCopyImageToClipboard}
                                                    edge="end"
                                                >
                                                    <FileCopyIcon />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    )}
                                </>
                            </InputAdornment>
                        ),
                    },
                }}
            />
        </div>
    );
}
