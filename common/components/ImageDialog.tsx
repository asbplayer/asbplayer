import React, { useState, useLayoutEffect } from 'react';
import makeStyles from '@mui/styles/makeStyles';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import { MediaFragment } from '@project/common';
import { useImageData } from '../hooks/use-image-data';
import Slider from '@mui/material/Slider';
import Modal from '@mui/material/Modal';
import { humanReadableTime } from '../util';
import Tooltip from './Tooltip';

interface ImageDimensions {
    width: number;
    height: number;
}

const useStyles = makeStyles(() => ({
    image: ({ width, height }: ImageDimensions) => ({
        width: width,
        height: height,
        backgroundSize: 'contain',
    }),
}));

// https://stackoverflow.com/questions/19014250/rerender-view-on-browser-resize-with-react
function useWindowSize() {
    const [size, setSize] = useState([0, 0]);

    useLayoutEffect(() => {
        function updateSize() {
            setSize([window.innerWidth, window.innerHeight]);
        }

        window.addEventListener('resize', updateSize);
        updateSize();

        return () => window.removeEventListener('resize', updateSize);
    }, []);

    return size;
}

interface Props {
    open: boolean;
    image?: MediaFragment;
    interval?: number[];
    timestampInterval?: number[];
    onClose: () => void;
    onTimestampChange: (timestamp: number) => void;
    onTimestampIntervalChange?: (timestampInterval: number[]) => void;
}

interface ValueLabelComponentProps {
    children: React.ReactElement;
    open: boolean;
    value: number;
}

const ValueLabelComponent = ({ children, open, value }: ValueLabelComponentProps) => {
    return (
        <Tooltip open={open} enterTouchDelay={0} placement="bottom" title={value}>
            {children}
        </Tooltip>
    );
};

export default function ImageDialog({
    open,
    image,
    interval,
    timestampInterval,
    onClose,
    onTimestampChange,
    onTimestampIntervalChange,
}: Props) {
    const { width, height, dataUrl } = useImageData({ image, smoothTransition: true });
    const [windowWidth, windowHeight] = useWindowSize();

    let resizeRatio;

    if (width > 0 && height > 0) {
        resizeRatio = Math.min(1, Math.min(windowWidth / (2 * width), windowHeight / (2 * height)));
    } else {
        resizeRatio = 1;
    }

    const classes = useStyles({ width: width * resizeRatio, height: height * resizeRatio });

    if (!image || !dataUrl || !open) {
        return null;
    }

    const webm = image.extension === 'webm';

    return (
        <div>
            <Modal disableRestoreFocus style={{ width: '100vw', height: '100vh' }} open={open} onClose={onClose}>
                <div
                    style={{
                        position: 'absolute',
                        width: width * resizeRatio,
                        height: height * resizeRatio,
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    <Card>
                        {webm ? (
                            <video
                                className={classes.image}
                                src={dataUrl}
                                title={image.name}
                                controls
                                autoPlay
                                loop
                                muted
                            />
                        ) : (
                            <CardMedia className={classes.image} image={dataUrl} title={image.name} style={{}} />
                        )}
                    </Card>
                    {interval && image.canChangeTimestamp && !webm && (
                        <Slider
                            slots={{ valueLabel: ValueLabelComponent }}
                            color="primary"
                            value={image.timestamp}
                            min={interval[0]}
                            max={interval[1]}
                            onChange={(_: unknown, newValue: number | number[]) =>
                                onTimestampChange(newValue as number)
                            }
                            valueLabelFormat={(v) => humanReadableTime(v, true)}
                            valueLabelDisplay="on"
                            track={false}
                        />
                    )}
                    {webm && interval && timestampInterval && onTimestampIntervalChange && (
                        <Slider
                            slots={{ valueLabel: ValueLabelComponent }}
                            color="primary"
                            value={timestampInterval}
                            min={interval[0]}
                            max={interval[1]}
                            onChange={(_: unknown, newValue: number | number[]) =>
                                onTimestampIntervalChange(newValue as number[])
                            }
                            valueLabelFormat={(v) => humanReadableTime(v, true)}
                            valueLabelDisplay="on"
                        />
                    )}
                </div>
            </Modal>
        </div>
    );
}
