import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { DictionaryProvider } from '../dictionary-db';
import {
    DictionarySimplifiedStatisticsTrackSnapshot,
    dictionaryStatisticsComprehensionBandForPercent,
    DictionaryStatisticsSentenceBucketEntry,
    DictionaryStatisticsSnapshot,
    percentDisplay,
    processSimplifiedDictionaryStatistics,
} from '../dictionary-statistics';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import Paper from '@mui/material/Paper';
import { alpha, SxProps, Theme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import BarChartIcon from '@mui/icons-material/BarChart';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import StatisticsSentenceDetailsDialog from './StatisticsSentenceDetailsDialog';
import LogoIcon from './LogoIcon';
import LinearProgress from '@mui/material/LinearProgress';

interface StatisticProps {
    label: string;
    value: string | number;
    onClick?: () => void;
    valueSx?: SxProps<Theme>;
}

const Statistic: React.FC<StatisticProps> = ({ label, value, onClick, valueSx }) => {
    const hoverProps: SxProps<Theme> =
        onClick === undefined
            ? {}
            : {
                  cursor: 'pointer',
                  background: (theme: Theme) => alpha(theme.palette.action.hover, theme.palette.action.hoverOpacity),
              };
    const textDecoration = onClick === undefined ? 'auto' : 'underline';
    return (
        <Box
            data-statistics-overlay-interactive={onClick !== undefined ? 'true' : undefined}
            sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                pl: 0.75,
                pr: 0.75,
                borderRadius: 1,
                '&:hover': hoverProps,
            }}
            onClick={onClick}
        >
            <Typography variant="subtitle2">{label}</Typography>
            <Typography variant="subtitle2" sx={{ textDecoration, ...(valueSx ?? {}) }}>
                {value}
            </Typography>
        </Box>
    );
};

export interface StatisticsOverlayProps {
    dictionaryProvider: DictionaryProvider;
    open: boolean;
    onOpenStatistics: () => void;
    onReceivedSnapshot: (mediaId: string, trackIndex: number) => void;
    onSnapshotCleared?: () => void;
    onClose: (mediaId?: string) => void;
    onMoveBy?: (deltaX: number, deltaY: number) => void;
    onOpenSentenceDetails?: (entries: DictionaryStatisticsSentenceBucketEntry[], totalSentences: number) => void;
    sx?: SxProps<Theme>;
}

const calculateBestTrackSnapshot = (
    trackSnapshots: DictionarySimplifiedStatisticsTrackSnapshot[]
): [DictionarySimplifiedStatisticsTrackSnapshot | undefined, number] => {
    if (trackSnapshots === undefined || trackSnapshots.length === 0) {
        return [undefined, -1];
    }
    let best = trackSnapshots[0];
    let bestIndex = 0;
    for (let i = 0; i < trackSnapshots.length; ++i) {
        const s = trackSnapshots[i];
        if (s.comprehensionPercent > best.comprehensionPercent) {
            best = s;
            bestIndex = i;
        }
    }
    return [best, bestIndex];
};

const StatisticsOverlay = React.forwardRef<HTMLDivElement, StatisticsOverlayProps>(function StatisticsOverlay(
    {
        dictionaryProvider,
        open,
        onOpenStatistics,
        onReceivedSnapshot,
        onSnapshotCleared,
        onClose,
        onMoveBy,
        onOpenSentenceDetails,
        sx,
    },
    ref
) {
    const { t } = useTranslation();
    const [bestTrackSnapshot, setBestTrackSnapshot] = useState<DictionarySimplifiedStatisticsTrackSnapshot>();
    const [dragging, setDragging] = useState<boolean>(false);
    const [mediaId, setMediaId] = useState<string>();
    const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number } | undefined>(undefined);
    const onReceivedSnapshotRef = useRef<(mediaId: string, trackIndex: number) => void>(onReceivedSnapshot);
    onReceivedSnapshotRef.current = onReceivedSnapshot;
    const onSnapshotClearedRef = useRef<(() => void) | undefined>(onSnapshotCleared);
    onSnapshotClearedRef.current = onSnapshotCleared;
    useEffect(() => {
        const unsubscribeStatistics = dictionaryProvider.onStatisticsSnapshot(
            (snapshot?: DictionaryStatisticsSnapshot) => {
                if (!snapshot) {
                    setMediaId(undefined);
                    setBestTrackSnapshot(undefined);
                    onSnapshotClearedRef.current?.();
                    return;
                }

                const nextTrackSnapshots = processSimplifiedDictionaryStatistics(snapshot);
                setMediaId(snapshot.mediaId);
                const [bestSnapshot, bestIndex] = calculateBestTrackSnapshot(nextTrackSnapshots);
                if (bestSnapshot !== undefined) {
                    setBestTrackSnapshot(bestSnapshot);
                    onReceivedSnapshotRef.current?.(snapshot.mediaId, bestIndex);
                } else {
                    setBestTrackSnapshot(undefined);
                    onSnapshotClearedRef.current?.();
                }
            }
        );
        void dictionaryProvider.requestStatisticsSnapshot();
        return () => {
            unsubscribeStatistics();
        };
    }, [dictionaryProvider]);

    const iPlusOneSentenceBucket = bestTrackSnapshot?.sentenceBuckets.uncollected.find((b) => b.tokenCount === 1);
    const iPlusOneSentenceCount = iPlusOneSentenceBucket?.entries?.length ?? 0;
    const comprehensionBand = bestTrackSnapshot
        ? dictionaryStatisticsComprehensionBandForPercent(bestTrackSnapshot.comprehensionPercent)
        : undefined;

    const handlePointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (onMoveBy === undefined || event.button !== 0) {
                return;
            }

            const target = event.target as HTMLElement | null;
            if (
                target?.closest(
                    '[data-statistics-overlay-interactive="true"],button,a,input,textarea,select,[role="button"]'
                )
            ) {
                return;
            }

            dragRef.current = {
                pointerId: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY,
            };
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
        },
        [onMoveBy]
    );
    const handlePointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            const drag = dragRef.current;

            if (drag === undefined || drag.pointerId !== event.pointerId || onMoveBy === undefined) {
                return;
            }

            const deltaX = event.clientX - drag.clientX;
            const deltaY = event.clientY - drag.clientY;

            if (deltaX === 0 && deltaY === 0) {
                return;
            }

            dragRef.current = {
                pointerId: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY,
            };

            // If movement properties are available, use those instead, since event.clientX and event.clientY
            // changes if the containing window moves (e.g. iframe in the case of the extension), which results
            // in jittering.

            if (typeof event.movementX === 'number' && typeof event.movementY === 'number') {
                onMoveBy(event.movementX, event.movementY);
            } else {
                onMoveBy(deltaX, deltaY);
            }
        },
        [onMoveBy]
    );
    const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) {
            return;
        }

        dragRef.current = undefined;
        setDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }, []);
    const handlePointerCancel = useCallback(() => {
        dragRef.current = undefined;
        setDragging(false);
    }, []);

    return (
        <Fade in={bestTrackSnapshot !== undefined && open} timeout={250}>
            <Paper
                ref={ref}
                variant="elevation"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                sx={{
                    background: (theme) => alpha(theme.palette.background.paper, 0.7),
                    zIndex: (theme) => theme.zIndex.modal,
                    p: 1,
                    position: 'relative',
                    cursor: onMoveBy === undefined ? 'auto' : dragging ? 'grabbing' : 'grab',
                    touchAction: onMoveBy === undefined ? 'auto' : 'none',
                    userSelect: 'none',
                    ...(sx ?? {}),
                }}
            >
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <LogoIcon sx={{ m: 0.5 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {bestTrackSnapshot && (
                            <Statistic
                                label={t('statistics.comprehension')}
                                value={percentDisplay(bestTrackSnapshot.comprehensionPercent)}
                                valueSx={{ color: comprehensionBand?.color, fontWeight: 600 }}
                            />
                        )}
                        <Statistic
                            label={`1 ${t('settings.dictionaryTokenStatus0')}`}
                            value={iPlusOneSentenceCount}
                            onClick={
                                iPlusOneSentenceCount > 0 &&
                                iPlusOneSentenceBucket !== undefined &&
                                bestTrackSnapshot !== undefined
                                    ? () =>
                                          onOpenSentenceDetails?.(
                                              iPlusOneSentenceBucket.entries,
                                              bestTrackSnapshot.progress.total
                                          )
                                    : undefined
                            }
                        />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }} data-statistics-overlay-interactive="true">
                        <IconButton onClick={onOpenStatistics} data-statistics-overlay-interactive="true">
                            <BarChartIcon />
                        </IconButton>
                        <IconButton onClick={() => onClose(mediaId)} data-statistics-overlay-interactive="true">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </Box>
                {bestTrackSnapshot && bestTrackSnapshot.progress.current < bestTrackSnapshot.progress.total && (
                    <LinearProgress
                        variant={bestTrackSnapshot.progress.current > 0 ? 'determinate' : 'indeterminate'}
                        value={(bestTrackSnapshot.progress.current / bestTrackSnapshot.progress.total) * 100}
                        sx={{
                            position: 'absolute',
                            width: (theme) => `calc(100% - ${theme.spacing(0.5)})`,
                            left: (theme) => theme.spacing(0.25),
                            bottom: -1,
                            borderRadius: 0,
                            height: 2,
                        }}
                    />
                )}
            </Paper>
        </Fade>
    );
});

export default StatisticsOverlay;
