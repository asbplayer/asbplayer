import React, { useMemo, useRef, useState } from 'react';
import makeStyles from '@mui/styles/makeStyles';
import type { Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import Slider from '@mui/material/Slider';
import type { SubtitleModel } from '@project/common';
import Tooltip from '@project/common/components/Tooltip';
import { humanReadableTime } from '@project/common/util';

const useStyles = makeStyles<Theme>((theme) => ({
    container: {
        position: 'relative',
        width: '100%',
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
        userSelect: 'none',
        touchAction: 'none',
    },
    backgroundContainer: {
        position: 'absolute',
        inset: 0,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
        overflow: 'hidden',
    },
    gridLines: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: 0.2,
    },
    gridLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        borderLeft: `1px solid ${theme.palette.divider}`,
    },
    tracksContainer: {
        position: 'absolute',
        inset: 0,
    },
    subtitleBlock: {
        position: 'absolute',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
        fontSize: 10,
        color: '#ffffff',
        padding: '0 4px',
        lineHeight: 1.2,
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        overflow: 'hidden',
        '&:hover': {
            opacity: 1,
            border: '1px solid rgba(255, 255, 255, 0.6)',
        },
    },
    subtitleText: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
    },
    unselectedDimmer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: '#000000',
        opacity: 0.4,
        zIndex: 10,
        pointerEvents: 'none',
    },
    selectionOverlay: {
        position: 'absolute',
        height: '100%',
        borderTop: `2px solid ${theme.palette.primary.main}`,
        borderBottom: `2px solid ${theme.palette.primary.main}`,
        pointerEvents: 'none',
        zIndex: 20,
    },
    handle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 24,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
    },
    handleInner: {
        width: 8,
        height: '100%',
        backgroundColor: theme.palette.primary.main,
        borderRadius: 4,
        boxShadow: theme.shadows[2],
        border: `1px solid ${theme.palette.primary.dark}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    handleBar: {
        width: 2,
        height: 12,
        backgroundColor: '#ffffff',
        borderRadius: 2,
        opacity: 0.7,
    },
    invisibleSlider: {
        position: 'absolute',
        inset: 0,
        height: '100% !important',
        padding: '0 !important',
        margin: 0,
        opacity: 0,
        zIndex: 30, // Above everything to capture events
        pointerEvents: 'none', // Let mouse events pass through to subtitle blocks
        '& .MuiSlider-thumb': {
            pointerEvents: 'auto', // Re-enable for dragging handles
            width: 24, // Matches our visual handle width
            height: '100% !important',
            top: '0 !important',
            transform: 'translateX(-50%) !important',
            borderRadius: 0,
            cursor: 'ew-resize',
        },
        '& .MuiSlider-rail': { display: 'none' },
        '& .MuiSlider-track': { display: 'none' },
        '& .MuiSlider-mark': { display: 'none' },
    },
}));

const sliderValueLabelFormat = (ms: number) => {
    return humanReadableTime(ms, true);
};

interface ValueLabelComponentProps {
    children: React.ReactElement;
    open: boolean;
    value: number;
}

const ValueLabelComponent = ({ children, open, value }: ValueLabelComponentProps) => {
    return (
        <Tooltip open={open} enterTouchDelay={0} placement="top" title={value}>
            {children}
        </Tooltip>
    );
};

interface Props {
    boundaryInterval: number[];
    timestampInterval: number[];
    subtitles: SubtitleModel[];
    onChange: (event: Event, newValue: number | number[]) => void;
}

interface SubtitleBlockProps {
    sub: SubtitleModel;
    track: number;
    heightPct: number;
    min: number;
    span: number;
    color: string;
    onClick: (start: number, end: number) => void;
}

const SubtitleBlock = ({ sub, track, heightPct, min, span, color, onClick }: SubtitleBlockProps) => {
    const classes = useStyles();
    const [isOverflowing, setIsOverflowing] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        if (textRef.current) {
            setIsOverflowing(textRef.current.scrollWidth > textRef.current.clientWidth);
        }
    };

    const max = min + span;
    const subLeft = Math.max(0, Math.min(100, ((sub.start - min) / span) * 100));
    const subRight = Math.max(0, Math.min(100, ((max - sub.end) / span) * 100));

    return (
        <Tooltip title={isOverflowing ? sub.text : ''} placement="top" disableInteractive>
            <div
                onClick={() => onClick(sub.start, sub.end)}
                className={classes.subtitleBlock}
                style={{
                    top: `${track * heightPct}%`,
                    height: `${heightPct}%`,
                    left: `${subLeft}%`,
                    right: `${subRight}%`,
                    backgroundColor: color,
                }}
            >
                <span ref={textRef} onMouseEnter={handleMouseEnter} className={classes.subtitleText}>
                    {sub.text}
                </span>
            </div>
        </Tooltip>
    );
};

export default function SubtitleTimeline({ boundaryInterval, timestampInterval, subtitles, onChange }: Props) {
    const classes = useStyles();

    const theme = useTheme();

    const min = boundaryInterval[0];
    const max = boundaryInterval[1];
    const span = max - min || 1; // prevent div by zero

    const trackCount = useMemo(() => {
        let maxTrack = 0;
        for (const sub of subtitles) {
            if (sub.track !== undefined && sub.track > maxTrack) {
                maxTrack = sub.track;
            }
        }
        return maxTrack + 1;
    }, [subtitles]);

    const opacitySuffix = theme.palette.mode === 'dark' ? 'b3' : 'e6';

    const trackColors = [
        `${theme.palette.primary.main}${opacitySuffix}`, // Track 0
        `#2196f3${opacitySuffix}`, // Blue (Track 1)
        `#ff9800${opacitySuffix}`, // Orange (Track 2)
    ];

    // Give each track 24px height, max 3 tracks
    const containerHeight = Math.min(trackCount * 24, 72);
    const heightPct = 100 / trackCount;

    const visibleSubtitles = useMemo(() => {
        return subtitles.filter((s) => s.end >= min && s.start <= max && s.text.trim() !== '');
    }, [subtitles, min, max]);

    const selStart = timestampInterval[0];
    const selEnd = timestampInterval[1];

    const leftPct = Math.max(0, Math.min(100, ((selStart - min) / span) * 100));
    const rightPct = Math.max(0, Math.min(100, ((max - selEnd) / span) * 100));

    const handleSubtitleClick = (start: number, end: number) => {
        onChange(null as any, [start, end]);
    };

    return (
        <div className={classes.container} style={{ height: containerHeight }}>
            <div className={classes.backgroundContainer}>
                <div className={classes.gridLines}>
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((pct) => (
                        <div key={pct} className={classes.gridLine} style={{ left: `${pct}%` }} />
                    ))}
                </div>

                <div className={classes.tracksContainer}>
                    {visibleSubtitles.map((sub, idx) => {
                        const track = sub.track ?? 0;
                        return (
                            <SubtitleBlock
                                key={`${sub.start}-${sub.end}-${idx}`}
                                sub={sub}
                                track={track}
                                heightPct={heightPct}
                                min={min}
                                span={span}
                                color={trackColors[track % trackColors.length]}
                                onClick={handleSubtitleClick}
                            />
                        );
                    })}
                </div>
            </div>

            <div className={classes.unselectedDimmer} style={{ left: 0, right: `${100 - leftPct}%` }} />
            <div className={classes.unselectedDimmer} style={{ left: `${100 - rightPct}%`, right: 0 }} />

            <div className={classes.selectionOverlay} style={{ left: `${leftPct}%`, right: `${rightPct}%` }}>
                <div className={classes.handle} style={{ left: 0, marginLeft: -12 }}>
                    <div className={classes.handleInner}>
                        <div className={classes.handleBar} />
                    </div>
                </div>
                <div className={classes.handle} style={{ right: 0, marginRight: -12 }}>
                    <div className={classes.handleInner}>
                        <div className={classes.handleBar} />
                    </div>
                </div>
            </div>

            <Slider
                className={classes.invisibleSlider}
                slots={{ valueLabel: ValueLabelComponent }}
                value={timestampInterval}
                valueLabelFormat={sliderValueLabelFormat}
                onChange={onChange}
                min={min}
                max={max}
                step={1}
                valueLabelDisplay="auto"
                disableSwap
            />
        </div>
    );
}
