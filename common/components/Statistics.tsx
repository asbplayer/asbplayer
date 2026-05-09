import { DictionaryProvider } from '@project/common/dictionary-db';
import {
    averageDisplay,
    clampPercent,
    countPercentOccurrencesDisplay,
    dictionaryStatisticsComprehensionBandForPercent,
    DictionaryStatisticsAnkiTrackSnapshot,
    DictionaryStatisticsFrequencyBucketStatusCounts,
    dictionaryStatisticsComprehensionBands,
    DictionaryStatisticsSentenceDialogBucket,
    DictionaryStatisticsTrackSnapshot,
    DictionaryStatisticsSentence,
    DictionaryStatisticsSentenceBucketEntry,
    DictionaryStatisticsSentenceBuckets,
    DictionaryStatisticsSentenceComprehensionPoint,
    percent,
    percentDisplay,
    DictionaryStatisticsSnapshot,
    processDictionaryStatisticsAnkiTrackSnapshot,
    processDictionaryStatisticsSnapshot,
    selectedRewatchSnapshotForTrack,
    sentenceComprehensionPointLabel,
    sentenceComprehensionXAxisLabels,
    sentenceDialogBucketData,
    statusSentenceBucketLabel,
} from '@project/common/dictionary-statistics';
import { AsbplayerSettings, dictionaryTrackEnabled, TokenStatus } from '@project/common/settings';
import StatisticsSentenceDetailsDialog from '@project/common/components/StatisticsSentenceDetailsDialog';
import { Trans, useTranslation } from 'react-i18next';
import { type MouseEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography, { type TypographyProps } from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import Tooltip from '@mui/material/Tooltip';
import { timeDurationDisplay } from '@project/common/util/util';
import { SxProps, type Theme } from '@mui/material/styles';
import Stack from '@mui/material/Stack';
import BarChartIcon from '@mui/icons-material/BarChart';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt';
import Link from '@mui/material/Link';

export interface MediaInfo {
    sourceString: string;
}

export interface StatisticsProps {
    dictionaryProvider: DictionaryProvider;
    settings: AsbplayerSettings;
    hasSubtitles: boolean;
    onOpenInNewWindow?: () => void;
    onOpenOverlay: (mediaId: string) => void;
    onViewAnnotationSettings: () => void;
    onSeekWasRequested?: (mediaId: string) => Promise<void>;
    onMineWasRequested?: (mediaId: string) => Promise<void>;
    mediaInfoFetcher?: (mediaId: string) => Promise<MediaInfo>;
    sx?: SxProps<Theme>;
}

const CenteredBox: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <Box
            sx={{
                display: 'flex',
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                alignContent: 'center',
                justifyItems: 'center',
            }}
        >
            {children}
        </Box>
    );
};

interface SentenceDialogState {
    title: string;
    subtitles: string[];
    entries: DictionaryStatisticsSentenceBucketEntry[];
    totalSentences: number;
    miningEnabled: boolean;
    highlightedSentenceIndex?: number;
}

const statusOrder: TokenStatus[] = [
    TokenStatus.MATURE,
    TokenStatus.YOUNG,
    TokenStatus.GRADUATED,
    TokenStatus.LEARNING,
    TokenStatus.UNKNOWN,
    TokenStatus.UNCOLLECTED,
];

const emptySentenceBuckets: DictionaryStatisticsSentenceBuckets = {
    allKnown: {
        count: 0,
        entries: [],
    },
    uncollected: [],
    unknown: [],
};
const distributionBarHeight = 6;
const sentenceComprehensionGraphHeight = 120;
const sentenceComprehensionGraphTicks = Array.from({ length: 11 }, (_, index) => 100 - index * 10);

function ComprehensionScale({ value }: { value: number }) {
    const clampedValue = clampPercent(value);
    return (
        <Box>
            <Box sx={{ position: 'relative', pt: 0.5 }}>
                <Box
                    sx={{
                        display: 'flex',
                        height: 28,
                        overflow: 'hidden',
                        borderRadius: 2,
                    }}
                >
                    {dictionaryStatisticsComprehensionBands.map((band) => (
                        <Box
                            key={band.label}
                            sx={{
                                width: `${band.max - band.min}%`,
                                backgroundColor: band.color,
                                textAlign: 'center',
                                alignItems: 'center',
                                height: '100%',
                            }}
                        >
                            <Typography variant="caption" sx={{ color: 'inherit', fontSize: 10, lineHeight: 1 }}>
                                {band.label}
                            </Typography>
                        </Box>
                    ))}
                </Box>
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        bottom: -3,
                        left: `${clampedValue}%`,
                        width: 3,
                        transform: 'translateX(-50%)',
                        backgroundColor: 'text.primary',
                    }}
                />
            </Box>
        </Box>
    );
}

function FrequencyDistributionBar({
    totalPercent,
    count,
    statusCounts,
    statusColors,
    statusLabels,
    totalConsideredCount,
}: {
    totalPercent: number;
    count: number;
    statusCounts: DictionaryStatisticsFrequencyBucketStatusCounts;
    statusColors: DictionaryStatisticsTrackSnapshot['statusColors'];
    statusLabels: Record<TokenStatus, string>;
    totalConsideredCount: number;
}) {
    const clampedTotalPercent = clampPercent(totalPercent);
    return (
        <Box
            sx={{
                position: 'relative',
                height: distributionBarHeight,
                overflow: 'hidden',
                borderRadius: 999,
                backgroundColor: 'grey.700',
            }}
        >
            {clampedTotalPercent > 0 && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        width: `${clampedTotalPercent}%`,
                        display: 'flex',
                        overflow: 'hidden',
                    }}
                >
                    {statusOrder.map((status) => {
                        const statusCount = statusCounts.get(status)!;
                        if (statusCount.numUnique <= 0 || count <= 0) return null;
                        return (
                            <Tooltip
                                key={status}
                                placement="top"
                                title={`${statusLabels[status]}: ${countPercentOccurrencesDisplay(
                                    statusCount.numUnique,
                                    totalConsideredCount,
                                    statusCount.numOccurrences
                                )}`}
                            >
                                <Box
                                    sx={{
                                        width: `${(statusCount.numUnique / count) * 100}%`,
                                        backgroundColor: statusColors[status],
                                    }}
                                />
                            </Tooltip>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}

function StatusDistributionBar({ value, color }: { value: number; color: string }) {
    const clampedValue = clampPercent(value);
    return (
        <Box
            sx={{
                position: 'relative',
                height: distributionBarHeight,
                overflow: 'hidden',
                borderRadius: 999,
                backgroundColor: 'grey.700',
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    width: `${clampedValue}%`,
                    backgroundColor: color,
                }}
            />
        </Box>
    );
}

function SentenceComprehensionGraph({
    points,
    onOpenSentenceDetails,
}: {
    points: DictionaryStatisticsSentenceComprehensionPoint[];
    onOpenSentenceDetails: (point: DictionaryStatisticsSentenceComprehensionPoint) => void;
}) {
    const handleChartClick = useCallback(
        (event: MouseEvent<SVGSVGElement>) => {
            if (!points.length) return;

            const bounds = event.currentTarget.getBoundingClientRect();
            if (bounds.width <= 0) return;

            const clampedOffsetX = Math.max(0, Math.min(event.clientX - bounds.left, bounds.width));
            const index = Math.min(points.length - 1, Math.floor((clampedOffsetX / bounds.width) * points.length));
            onOpenSentenceDetails(points[index]);
        },
        [onOpenSentenceDetails, points]
    );

    const maximumSentenceStart = points.length ? points[points.length - 1].sentence.start : 0;
    const xAxisLabels = sentenceComprehensionXAxisLabels(points);

    return (
        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    height: sentenceComprehensionGraphHeight,
                    pt: 0.75,
                }}
            >
                {sentenceComprehensionGraphTicks.map((tick) => (
                    <Typography key={tick} variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                        {tick}%
                    </Typography>
                ))}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, pb: 0.5 }}>
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        height: sentenceComprehensionGraphHeight + 28,
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            left: 6,
                            right: 6,
                            top: 6,
                            bottom: 22,
                        }}
                    >
                        <Box
                            component="svg"
                            viewBox={`0 0 ${Math.max(points.length, 1)} ${sentenceComprehensionGraphHeight}`}
                            preserveAspectRatio="none"
                            onClick={handleChartClick}
                            sx={{
                                display: 'block',
                                width: '100%',
                                height: '100%',
                                color: 'primary.main',
                                cursor: points.length ? 'pointer' : 'default',
                            }}
                        >
                            {sentenceComprehensionGraphTicks
                                .filter((tick) => tick > 0 && tick < 100)
                                .map((tick) => (
                                    <line
                                        key={tick}
                                        x1={0}
                                        x2={Math.max(points.length, 1)}
                                        y1={
                                            sentenceComprehensionGraphHeight -
                                            (tick / 100) * sentenceComprehensionGraphHeight
                                        }
                                        y2={
                                            sentenceComprehensionGraphHeight -
                                            (tick / 100) * sentenceComprehensionGraphHeight
                                        }
                                        stroke="rgba(127, 127, 127, 0.16)"
                                        strokeWidth={0.5}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                ))}
                            {points.map((point, index) => {
                                const barHeight = Math.max(
                                    1,
                                    (clampPercent(point.comprehensionPercent) / 100) * sentenceComprehensionGraphHeight
                                );
                                return (
                                    <g key={point.sentence.index}>
                                        <title>
                                            {`${sentenceComprehensionPointLabel(point)} · ${timeDurationDisplay(
                                                point.sentence.start,
                                                maximumSentenceStart,
                                                true
                                            )}`}
                                        </title>
                                        <rect
                                            x={index}
                                            y={sentenceComprehensionGraphHeight - barHeight}
                                            width={1}
                                            height={barHeight}
                                            fill="currentColor"
                                            opacity={0.82}
                                            shapeRendering="crispEdges"
                                        />
                                    </g>
                                );
                            })}
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            position: 'absolute',
                            left: 8,
                            right: 8,
                            bottom: 4,
                            height: 18,
                        }}
                    >
                        {xAxisLabels.map(({ value, position }) => (
                            <Typography
                                key={value}
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    position: 'absolute',
                                    left: `${position}%`,
                                    transform:
                                        position === 0
                                            ? 'none'
                                            : position === 100
                                              ? 'translateX(-100%)'
                                              : 'translateX(-50%)',
                                    lineHeight: 1,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {value}
                            </Typography>
                        ))}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

function StatisticsInfoTooltip({ label, lines }: { label: string; lines: string[] }) {
    return (
        <Tooltip
            placement="top"
            title={
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {lines.map((line) => (
                        <Typography key={line} variant="caption" sx={{ color: 'inherit', lineHeight: 1.4 }}>
                            {line}
                        </Typography>
                    ))}
                </Box>
            }
        >
            <IconButton aria-label={label} size="small" sx={{ p: 0.25, color: 'text.secondary' }}>
                <InfoOutlinedIcon sx={{ fontSize: 24 }} />
            </IconButton>
        </Tooltip>
    );
}

function StatisticsSectionHeading({ title, infoLines }: { title: string; infoLines?: string[] }) {
    return (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h6">{title}</Typography>
            {infoLines !== undefined && <StatisticsInfoTooltip label={title} lines={infoLines} />}
        </Box>
    );
}

function StatisticsSectionSubHeading({ children }: { children: React.ReactNode }) {
    return (
        <Typography variant="body1" sx={{ mb: 1, fontWeight: 500 }}>
            {children}
        </Typography>
    );
}

interface SentenceStatsPanelProps {
    title: string;
    totalSentences: number;
    sentenceBuckets: DictionaryStatisticsSentenceBuckets;
    uncollectedLabel: string;
    unknownLabel: string;
    uniqueWordsPerSentenceLabel: string;
    uniqueWordsPerSentence: number;
    knownWordsPerSentenceLabel: string;
    knownWordsPerSentence: number;
    knownSentencesLabel: string;
    knownWordsCount: number;
    knownWordsLabel: string;
    knownWordsPercent: number;
    comprehensionLabel: string;
    comprehensionPercent: number;
    globalKnownLabel: string;
    globalKnownCount: number;
    onOpenSentenceBucketDetails: (bucket: DictionaryStatisticsSentenceDialogBucket) => void;
    headerAction?: ReactNode;
    emptyMessage?: string;
}

interface SentenceStatProps {
    label: string;
    value: string | number;
    typographyVariant?: TypographyProps['variant'];
    sx?: SxProps<Theme>;
    valueSx?: SxProps<Theme>;
}

function StatRow({ label: fieldName, value, sx, typographyVariant, valueSx }: SentenceStatProps) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', ...(sx ?? {}) }}>
            <Typography variant={typographyVariant ?? 'body2'}>{fieldName}</Typography>
            <Typography variant={typographyVariant ?? 'body2'} sx={valueSx}>
                {value}
            </Typography>
        </Box>
    );
}

interface Stat {
    label: string;
    value: string | number;
}

interface StatBoxesProps {
    keyPrefix: string;
    stats: Stat[];
}

function StatBoxes({ keyPrefix, stats }: StatBoxesProps) {
    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 1,
            }}
        >
            {stats.map(({ label, value }) => (
                <Box
                    key={`${keyPrefix}-${label}`}
                    sx={{
                        p: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Typography variant="caption" color="text.secondary">
                        {label}
                    </Typography>
                    <Typography variant="subtitle1">{value}</Typography>
                </Box>
            ))}
        </Box>
    );
}

function SentenceStatsPanel({
    title,
    totalSentences,
    sentenceBuckets,
    uncollectedLabel,
    unknownLabel,
    uniqueWordsPerSentenceLabel,
    uniqueWordsPerSentence,
    knownWordsPerSentenceLabel,
    knownWordsPerSentence,
    knownSentencesLabel,
    knownWordsCount,
    knownWordsLabel,
    knownWordsPercent,
    comprehensionLabel,
    comprehensionPercent,
    globalKnownLabel,
    globalKnownCount,
    headerAction,
    emptyMessage,
    onOpenSentenceBucketDetails,
}: SentenceStatsPanelProps) {
    const uncollectedSentenceBuckets = useMemo(
        () =>
            sentenceBuckets.uncollected.map((bucket, groupIndex) => ({
                bucket: { kind: 'uncollected', groupIndex } as const,
                label: statusSentenceBucketLabel(bucket, uncollectedLabel),
                count: bucket.count,
                entries: bucket.entries,
            })),
        [sentenceBuckets, uncollectedLabel]
    );
    const unknownSentenceBuckets = useMemo(
        () =>
            sentenceBuckets.unknown.map((bucket, groupIndex) => ({
                bucket: { kind: 'unknown', groupIndex } as const,
                label: statusSentenceBucketLabel(bucket, unknownLabel),
                count: bucket.count,
                entries: bucket.entries,
            })),
        [sentenceBuckets, unknownLabel]
    );

    const renderSentenceBucketRow = useCallback(
        (
            bucket: DictionaryStatisticsSentenceDialogBucket,
            label: string,
            count: number,
            entries: DictionaryStatisticsSentenceBucketEntry[]
        ) => {
            const canOpen = entries.length > 0;

            return (
                <ButtonBase
                    disabled={!canOpen}
                    sx={{
                        width: '100%',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderRadius: 1,
                        px: 1,
                        py: 0.75,
                        border: '1px solid',
                        borderColor: 'divider',
                        color: canOpen ? 'text.primary' : 'text.disabled',
                        textAlign: 'left',
                        transition: (theme) => theme.transitions.create(['background-color', 'border-color']),
                        '&:hover': {
                            backgroundColor: 'action.hover',
                            borderColor: 'text.secondary',
                        },
                    }}
                    onClick={() => onOpenSentenceBucketDetails(bucket)}
                >
                    <StatRow
                        label={label}
                        value={`${count} · ${percentDisplay(percent(count, totalSentences))}`}
                        sx={{ width: '100%' }}
                        typographyVariant="body2"
                    />
                    {canOpen && (
                        <ChevronRightRoundedIcon sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                    )}
                </ButtonBase>
            );
        },
        [onOpenSentenceBucketDetails, totalSentences]
    );

    const comprehensionBand = dictionaryStatisticsComprehensionBandForPercent(comprehensionPercent);

    return (
        <Box
            sx={{
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                height: '100%',
            }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                    <StatisticsSectionSubHeading>{title}</StatisticsSectionSubHeading>
                </Box>
                {headerAction && <Box sx={{ mb: 1.5 }}>{headerAction}</Box>}
                {emptyMessage ? (
                    <Typography typography="body2" color="text.secondary">
                        {emptyMessage}
                    </Typography>
                ) : (
                    <>
                        <StatRow
                            label={comprehensionLabel}
                            value={percentDisplay(comprehensionPercent)}
                            valueSx={{ color: comprehensionBand.color, fontWeight: 600 }}
                        />
                        <StatRow
                            label={knownWordsLabel}
                            value={`${knownWordsCount} · ${percentDisplay(knownWordsPercent)}`}
                        />
                        <StatRow label={globalKnownLabel} value={`${globalKnownCount}`} />
                        <StatRow label={uniqueWordsPerSentenceLabel} value={averageDisplay(uniqueWordsPerSentence)} />
                        <StatRow label={knownWordsPerSentenceLabel} value={averageDisplay(knownWordsPerSentence)} />
                        {renderSentenceBucketRow(
                            { kind: 'allKnown' },
                            knownSentencesLabel,
                            sentenceBuckets.allKnown.count,
                            sentenceBuckets.allKnown.entries
                        )}
                        {uncollectedSentenceBuckets.map(({ bucket, label, count, entries }, index) => (
                            <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {renderSentenceBucketRow(bucket, label, count, entries)}
                                {unknownSentenceBuckets[index] !== undefined &&
                                    renderSentenceBucketRow(
                                        unknownSentenceBuckets[index].bucket,
                                        unknownSentenceBuckets[index].label,
                                        unknownSentenceBuckets[index].count,
                                        unknownSentenceBuckets[index].entries
                                    )}
                            </Box>
                        ))}
                    </>
                )}
            </Box>
        </Box>
    );
}

function AnkiStatisticsSection({
    snapshot,
    statusLabels,
    statusColors,
    title,
    infoLines,
    dueByTodayLabel,
    dueByTomorrowLabel,
    dueByWeekLabel,
    suspendedCardsLabel,
    deckFrequencyBreakdownLabel,
    modelBreakdownLabel,
    uniqueWordsLabel,
    frequencyLabel,
    unavailableMessage,
    emptyDeckBreakdownMessage,
}: {
    snapshot: DictionaryStatisticsAnkiTrackSnapshot;
    statusLabels: Record<TokenStatus, string>;
    statusColors: DictionaryStatisticsTrackSnapshot['statusColors'];
    title: string;
    infoLines?: string[];
    dueByTodayLabel: string;
    dueByTomorrowLabel: string;
    dueByWeekLabel: string;
    suspendedCardsLabel: string;
    deckFrequencyBreakdownLabel: string;
    modelBreakdownLabel: string;
    uniqueWordsLabel: (count: number) => string;
    frequencyLabel: string;
    unavailableMessage: string;
    emptyDeckBreakdownMessage: string;
}) {
    const { t } = useTranslation();
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <StatisticsSectionHeading title={title} infoLines={infoLines} />

            {snapshot.progress !== undefined &&
                snapshot.progress.total > 0 &&
                snapshot.progress.current < snapshot.progress.total && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">
                            {percentDisplay(snapshot.progressPercent)}
                        </Typography>
                        <LinearProgress
                            value={snapshot.progressPercent}
                            variant="determinate"
                            sx={{ height: 6, borderRadius: 999 }}
                        />
                    </Box>
                )}

            {snapshot.available === false ? (
                <Typography color="text.secondary">{unavailableMessage}</Typography>
            ) : (
                <>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {snapshot.deckSnapshots.length === 0 ? (
                            <Typography color="text.secondary">{emptyDeckBreakdownMessage}</Typography>
                        ) : (
                            snapshot.deckSnapshots.map((deckSnapshot) => (
                                <Box
                                    key={deckSnapshot.deckName}
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 1.5,
                                    }}
                                >
                                    <StatisticsSectionSubHeading>{deckSnapshot.deckName}</StatisticsSectionSubHeading>

                                    <StatBoxes
                                        keyPrefix={deckSnapshot.deckName}
                                        stats={[
                                            { label: dueByTodayLabel, value: deckSnapshot.dueCounts.today },
                                            { label: dueByTomorrowLabel, value: deckSnapshot.dueCounts.tomorrow },
                                            { label: dueByWeekLabel, value: deckSnapshot.dueCounts.week },
                                            { label: suspendedCardsLabel, value: deckSnapshot.suspendedCards },
                                        ]}
                                    />

                                    {deckSnapshot.modelSnapshots.length > 0 && (
                                        <Box>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                                {deckSnapshot.modelSnapshots.map((modelSnapshot) => (
                                                    <Box
                                                        key={`${deckSnapshot.deckName}-${modelSnapshot.modelName}`}
                                                        sx={{
                                                            p: 1.5,
                                                            borderRadius: 1,
                                                            border: '1px solid',
                                                            borderColor: 'divider',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 1,
                                                        }}
                                                    >
                                                        <StatisticsSectionSubHeading>
                                                            {modelSnapshot.modelName}
                                                        </StatisticsSectionSubHeading>
                                                        <StatRow
                                                            label={t('statistics.uniqueWords')}
                                                            value={modelSnapshot.uniqueWords}
                                                        />
                                                        <Box>
                                                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                                                {frequencyLabel}
                                                            </Typography>
                                                            {modelSnapshot.frequencyBuckets
                                                                .filter((bucket) => bucket.count > 0)
                                                                .map((bucket) => {
                                                                    const bucketLabel =
                                                                        bucket.label === 'Unknown'
                                                                            ? statusLabels[TokenStatus.UNKNOWN]
                                                                            : bucket.label;

                                                                    return (
                                                                        <Box
                                                                            key={`${deckSnapshot.deckName}-${modelSnapshot.modelName}-${bucket.label}`}
                                                                            sx={{ mb: 1 }}
                                                                        >
                                                                            <Box
                                                                                sx={{
                                                                                    display: 'flex',
                                                                                    justifyContent: 'space-between',
                                                                                    mb: 0.5,
                                                                                }}
                                                                            >
                                                                                <Typography variant="body2">
                                                                                    {bucketLabel}
                                                                                </Typography>
                                                                                <Typography
                                                                                    variant="body2"
                                                                                    color="text.secondary"
                                                                                >
                                                                                    {countPercentOccurrencesDisplay(
                                                                                        bucket.count,
                                                                                        modelSnapshot.uniqueWords,
                                                                                        bucket.numOccurrences
                                                                                    )}
                                                                                </Typography>
                                                                            </Box>
                                                                            <FrequencyDistributionBar
                                                                                totalPercent={bucket.percent}
                                                                                count={bucket.count}
                                                                                statusCounts={bucket.statusCounts}
                                                                                statusColors={statusColors}
                                                                                statusLabels={statusLabels}
                                                                                totalConsideredCount={
                                                                                    modelSnapshot.uniqueWords
                                                                                }
                                                                            />
                                                                        </Box>
                                                                    );
                                                                })}
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            ))
                        )}
                    </Box>
                </>
            )}
        </Box>
    );
}

function TrackSnapshotSelector({
    selectedIndex,
    onSelectedIndex,
    count,
}: {
    selectedIndex: number;
    onSelectedIndex: (index: number) => void;
    count: number;
}) {
    const { t } = useTranslation();
    return (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {new Array(count).fill(0).map((_, i) => {
                return (
                    <div key={i}>
                        <Button
                            variant={selectedIndex === i ? 'contained' : 'outlined'}
                            startIcon={<BarChartIcon />}
                            onClick={() => onSelectedIndex(i)}
                            size="small"
                        >
                            {t('settings.subtitleTrackChoice', { trackNumber: i + 1 })}
                        </Button>
                    </div>
                );
            })}
        </Box>
    );
}

function TrackSnapshot({
    trackSnapshot,
    statisticsSnapshot,
    selectedRewatchesByTrack,
    onSelectedRewatchChanged,
    onSentenceDialogState,
}: {
    trackSnapshot: DictionaryStatisticsTrackSnapshot;
    statisticsSnapshot: DictionaryStatisticsSnapshot;
    selectedRewatchesByTrack: Record<number, number>;
    onSelectedRewatchChanged: (track: number, rewatch: number) => void;
    onSentenceDialogState: (state: SentenceDialogState) => void;
}) {
    const { t } = useTranslation();
    const statusLabels = useMemo(
        () => ({
            [TokenStatus.UNCOLLECTED]: t('settings.dictionaryTokenStatus0'),
            [TokenStatus.UNKNOWN]: t('settings.dictionaryTokenStatus1'),
            [TokenStatus.LEARNING]: t('settings.dictionaryTokenStatus2'),
            [TokenStatus.GRADUATED]: t('settings.dictionaryTokenStatus3'),
            [TokenStatus.YOUNG]: t('settings.dictionaryTokenStatus4'),
            [TokenStatus.MATURE]: t('settings.dictionaryTokenStatus5'),
        }),
        [t]
    );
    const comprehensionInfoLines = useMemo(() => [t('statistics.info.comprehension')], [t]);
    const globalKnownInfoLines = useMemo(() => [t('statistics.info.globalKnownWords')], [t]);
    const wordDistributionInfoLines = useMemo(
        () => [t('statistics.info.wordDistribution'), t('statistics.info.occurrences'), t('statistics.info.frequency')],
        [t]
    );
    const sentenceStatisticsInfoLines = useMemo(
        () => [
            t('statistics.info.sentenceStatistics'),
            `${t('statistics.projectedRewatch')}: ${t('statistics.info.projectedRewatch')}`,
        ],
        [t]
    );
    const uniqueWordsPerSentenceLabel = t('statistics.uniqueWordsPerSentence');
    const knownWordsPerSentenceLabel = t('statistics.knownWordsPerSentence');
    const uncollectedLabel = statusLabels[TokenStatus.UNCOLLECTED];
    const unknownLabel = statusLabels[TokenStatus.UNKNOWN];
    const currentWatchTitle = t('statistics.currentWatch');
    const ankiStatisticsTitle = t('statistics.anki.ankiStatistics');
    const ankiStatisticsInfoLines = useMemo(() => [t('statistics.anki.info.ankiStatistics')], [t]);
    const dueByTodayLabel = t('statistics.anki.dueByToday');
    const dueByTomorrowLabel = t('statistics.anki.dueByTomorrow');
    const dueByWeekLabel = t('statistics.anki.dueByWeek');
    const suspendedCardsLabel = t('statistics.anki.suspended');
    const deckFrequencyBreakdownLabel = t('statistics.anki.deckBreakdown');
    const modelBreakdownLabel = t('statistics.anki.modelBreakdown');
    const ankiUnavailableMessage = t('statistics.anki.ankiNeedsToBeRunning');
    const emptyDeckBreakdownMessage = t('statistics.anki.noDeckBreakdown');
    const deckUniqueWordsLabel = useCallback((count: number) => `${count} ${t('statistics.uniqueWords')}`, [t]);

    const totalSentences = trackSnapshot.progress.total;
    const selectedRewatchSnapshot = selectedRewatchSnapshotForTrack(trackSnapshot, selectedRewatchesByTrack);
    const maxRewatches = trackSnapshot.rewatchSnapshots.length;
    const projectedSentenceBuckets = selectedRewatchSnapshot?.sentenceBuckets ?? emptySentenceBuckets;
    const projectedKnownCount = selectedRewatchSnapshot?.numKnownTokens ?? 0;
    const projectedGlobalKnownCount = selectedRewatchSnapshot?.numDictionaryKnownTokens ?? 0;
    const projectedAverageWordsPerSentence = selectedRewatchSnapshot?.averageWordsPerSentence ?? 0;
    const projectedAverageKnownWordsPerSentence = selectedRewatchSnapshot?.averageKnownWordsPerSentence ?? 0;
    const projectedKnownPercent = selectedRewatchSnapshot?.knownPercent ?? 0;
    const projectedComprehension = selectedRewatchSnapshot?.comprehensionPercent ?? 0;
    const miningEnabled = trackSnapshot.progress.current >= trackSnapshot.progress.total;
    const ankiTrackSnapshot = processDictionaryStatisticsAnkiTrackSnapshot(statisticsSnapshot, trackSnapshot.track);
    const comprehensionBand = dictionaryStatisticsComprehensionBandForPercent(trackSnapshot.comprehensionPercent);

    return (
        <Box key={trackSnapshot.track} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(!trackSnapshot.progress.current || trackSnapshot.progress.current < totalSentences) && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                        {`${trackSnapshot.progress.current} / ${totalSentences} · ${percentDisplay(trackSnapshot.progressPercent)}`}
                    </Typography>
                    <LinearProgress
                        variant={totalSentences > 0 ? 'determinate' : 'indeterminate'}
                        value={trackSnapshot.progressPercent}
                        sx={{ height: 6, borderRadius: 999 }}
                    />
                </Box>
            )}

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 2,
                    flexWrap: 'wrap',
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <StatisticsSectionHeading
                        title={t('statistics.globalKnownWords')}
                        infoLines={globalKnownInfoLines}
                    />
                    <Typography variant="h6">{trackSnapshot.numDictionaryKnownTokens}</Typography>
                    <Typography color="text.secondary">
                        {`${t('settings.dictionaryTokenStateIgnored')}: ${trackSnapshot.numDictionaryIgnoredTokens}`}
                    </Typography>
                </Box>
            </Box>

            <Box>
                <StatisticsSectionHeading title={t('statistics.comprehension')} infoLines={comprehensionInfoLines} />
                <Typography variant="h6" sx={{ mb: 1, color: comprehensionBand.color, fontWeight: 600 }}>
                    {percentDisplay(trackSnapshot.comprehensionPercent)}
                </Typography>
                <ComprehensionScale value={trackSnapshot.comprehensionPercent} />
            </Box>

            <SentenceComprehensionGraph
                points={trackSnapshot.sentenceComprehensionPoints}
                onOpenSentenceDetails={(point) =>
                    onSentenceDialogState({
                        title: t('statistics.comprehension'),
                        subtitles: [currentWatchTitle, t('statistics.comprehension')],
                        entries: trackSnapshot.allSentenceEntries,
                        totalSentences,
                        miningEnabled,
                        highlightedSentenceIndex: point.sentence.index,
                    })
                }
            />

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 2,
                }}
            >
                <Box>
                    <Typography variant="subtitle2">{t('statistics.totalSentences')}</Typography>
                    <Typography variant="h5">{totalSentences}</Typography>
                </Box>
                <Box>
                    <Typography variant="subtitle2">{t('statistics.uniqueWords')}</Typography>
                    <Typography variant="h5">{trackSnapshot.numUniqueTokens}</Typography>
                </Box>
                <Box>
                    <Typography variant="subtitle2">{t('statistics.knownWords')}</Typography>
                    <Typography variant="h5">{trackSnapshot.numKnownTokens}</Typography>
                    <Typography color="text.secondary">{percentDisplay(trackSnapshot.knownPercent)}</Typography>
                </Box>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 2,
                }}
            >
                <Box sx={{ gridColumn: '1 / -1' }}>
                    <StatisticsSectionHeading
                        title={t('statistics.wordDistribution')}
                        infoLines={wordDistributionInfoLines}
                    />
                </Box>
                <Box>
                    <StatisticsSectionSubHeading>{t('statistics.statusDistribution')}</StatisticsSectionSubHeading>
                    {[
                        ...statusOrder.map((status) => ({
                            key: `${status}`,
                            label: statusLabels[status],
                            count: trackSnapshot.statusCounts.get(status)!.numUnique,
                            occurrences: trackSnapshot.statusCounts.get(status)!.numOccurrences,
                            color: trackSnapshot.statusColors[status],
                        })),
                        {
                            key: 'ignored',
                            label: t('settings.dictionaryTokenStateIgnored'),
                            count: trackSnapshot.numIgnoredTokens,
                            occurrences: trackSnapshot.numIgnoredOccurrences,
                            color: '#e0e0e0',
                        },
                    ].map((statusRow) => (
                        <Box key={statusRow.key} sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2">{statusRow.label}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {countPercentOccurrencesDisplay(
                                        statusRow.count,
                                        trackSnapshot.numUniqueTokens,
                                        statusRow.occurrences
                                    )}
                                </Typography>
                            </Box>
                            <StatusDistributionBar
                                value={percent(statusRow.count, trackSnapshot.numUniqueTokens)}
                                color={statusRow.color}
                            />
                        </Box>
                    ))}
                </Box>
                <Box>
                    <StatisticsSectionSubHeading>{t('statistics.frequency')}</StatisticsSectionSubHeading>
                    {trackSnapshot.frequencyBuckets.map((bucket) => {
                        const bucketLabel =
                            bucket.label === 'Unknown' ? statusLabels[TokenStatus.UNKNOWN] : bucket.label;

                        return (
                            <Box key={bucket.label} sx={{ mb: 1 }}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        mb: 0.5,
                                    }}
                                >
                                    <Typography variant="body2">{bucketLabel}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {countPercentOccurrencesDisplay(
                                            bucket.count,
                                            trackSnapshot.consideredTokens,
                                            bucket.numOccurrences
                                        )}
                                    </Typography>
                                </Box>
                                <FrequencyDistributionBar
                                    totalPercent={bucket.percent}
                                    count={bucket.count}
                                    statusCounts={bucket.statusCounts}
                                    statusColors={trackSnapshot.statusColors}
                                    statusLabels={statusLabels}
                                    totalConsideredCount={trackSnapshot.consideredTokens}
                                />
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gap: 2,
                }}
            >
                <Box sx={{ gridColumn: '1 / -1' }}>
                    <StatisticsSectionHeading
                        title={t('statistics.sentenceStatistics')}
                        infoLines={sentenceStatisticsInfoLines}
                    />
                </Box>
                <Box>
                    <SentenceStatsPanel
                        title={currentWatchTitle}
                        totalSentences={totalSentences}
                        sentenceBuckets={trackSnapshot.sentenceBuckets}
                        uncollectedLabel={uncollectedLabel}
                        unknownLabel={unknownLabel}
                        uniqueWordsPerSentenceLabel={uniqueWordsPerSentenceLabel}
                        uniqueWordsPerSentence={trackSnapshot.averageWordsPerSentence}
                        knownWordsPerSentenceLabel={knownWordsPerSentenceLabel}
                        knownWordsPerSentence={trackSnapshot.averageKnownWordsPerSentence}
                        knownSentencesLabel={t('statistics.knownSentences')}
                        knownWordsCount={trackSnapshot.numKnownTokens}
                        knownWordsLabel={t('statistics.knownWords')}
                        knownWordsPercent={trackSnapshot.knownPercent}
                        comprehensionLabel={t('statistics.comprehension')}
                        comprehensionPercent={trackSnapshot.comprehensionPercent}
                        globalKnownLabel={t('statistics.globalKnownWords')}
                        globalKnownCount={trackSnapshot.numDictionaryKnownTokens}
                        onOpenSentenceBucketDetails={(bucket) => {
                            const bucketData = sentenceDialogBucketData(bucket, trackSnapshot.sentenceBuckets, {
                                knownSentencesLabel: t('statistics.knownSentences'),
                                uncollectedLabel,
                                unknownLabel,
                            });
                            if (!bucketData) return;
                            onSentenceDialogState({
                                title: bucketData.label,
                                subtitles: [currentWatchTitle, bucketData.label],
                                entries: bucketData.entries,
                                totalSentences,
                                miningEnabled,
                            });
                        }}
                    />
                </Box>
                <Box>
                    <SentenceStatsPanel
                        title={t('statistics.projectedRewatch')}
                        totalSentences={totalSentences}
                        sentenceBuckets={projectedSentenceBuckets}
                        uncollectedLabel={uncollectedLabel}
                        unknownLabel={unknownLabel}
                        uniqueWordsPerSentenceLabel={uniqueWordsPerSentenceLabel}
                        uniqueWordsPerSentence={projectedAverageWordsPerSentence}
                        knownWordsPerSentenceLabel={knownWordsPerSentenceLabel}
                        knownWordsPerSentence={projectedAverageKnownWordsPerSentence}
                        knownSentencesLabel={t('statistics.knownSentences')}
                        knownWordsCount={projectedKnownCount}
                        knownWordsLabel={t('statistics.knownWords')}
                        knownWordsPercent={projectedKnownPercent}
                        comprehensionLabel={t('statistics.comprehension')}
                        comprehensionPercent={projectedComprehension}
                        globalKnownLabel={t('statistics.globalKnownWords')}
                        globalKnownCount={projectedGlobalKnownCount}
                        headerAction={
                            selectedRewatchSnapshot !== undefined ? (
                                <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    value={selectedRewatchSnapshot.rewatch}
                                    onChange={(event) =>
                                        onSelectedRewatchChanged(trackSnapshot.track, Number(event.target.value))
                                    }
                                >
                                    {trackSnapshot.rewatchSnapshots.map((rewatchSnapshot) => (
                                        <MenuItem key={rewatchSnapshot.rewatch} value={rewatchSnapshot.rewatch}>
                                            {t('statistics.rewatchOption', {
                                                rewatch: rewatchSnapshot.rewatch,
                                            })}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            ) : undefined
                        }
                        emptyMessage={maxRewatches === 0 ? t('statistics.noMoreRewatches') : undefined}
                        onOpenSentenceBucketDetails={(bucket) => {
                            if (selectedRewatchSnapshot === undefined) return;
                            const bucketData = sentenceDialogBucketData(
                                bucket,
                                selectedRewatchSnapshot.sentenceBuckets,
                                {
                                    knownSentencesLabel: t('statistics.knownSentences'),
                                    uncollectedLabel,
                                    unknownLabel,
                                }
                            );
                            if (!bucketData) return;
                            onSentenceDialogState({
                                title: bucketData.label,
                                subtitles: [
                                    t('statistics.projectedRewatch'),
                                    t('statistics.rewatchOption', {
                                        rewatch: selectedRewatchSnapshot.rewatch,
                                    }),
                                    bucketData.label,
                                ],
                                entries: bucketData.entries,
                                totalSentences,
                                miningEnabled,
                            });
                        }}
                    />
                </Box>
            </Box>

            <AnkiStatisticsSection
                snapshot={ankiTrackSnapshot}
                statusLabels={statusLabels}
                statusColors={trackSnapshot.statusColors}
                title={ankiStatisticsTitle}
                infoLines={ankiStatisticsInfoLines}
                dueByTodayLabel={dueByTodayLabel}
                dueByTomorrowLabel={dueByTomorrowLabel}
                dueByWeekLabel={dueByWeekLabel}
                suspendedCardsLabel={suspendedCardsLabel}
                deckFrequencyBreakdownLabel={deckFrequencyBreakdownLabel}
                modelBreakdownLabel={modelBreakdownLabel}
                uniqueWordsLabel={deckUniqueWordsLabel}
                frequencyLabel={t('statistics.frequency')}
                unavailableMessage={ankiUnavailableMessage}
                emptyDeckBreakdownMessage={emptyDeckBreakdownMessage}
            />
        </Box>
    );
}

export default function Statistics({
    dictionaryProvider,
    settings,
    hasSubtitles,
    mediaInfoFetcher,
    onOpenInNewWindow,
    onOpenOverlay,
    onViewAnnotationSettings,
    onSeekWasRequested,
    onMineWasRequested,
    sx,
}: StatisticsProps) {
    const { t } = useTranslation();
    const [mediaId, setMediaId] = useState<string>();
    const [mediaInfo, setMediaInfo] = useState<MediaInfo>();
    const [statisticsSnapshot, setStatisticsSnapshot] = useState<DictionaryStatisticsSnapshot>();
    const [trackSnapshots, setTrackSnapshots] = useState<DictionaryStatisticsTrackSnapshot[]>();
    const [selectedTrackSnapshotIndex, setSelectedTrackSnapshotIndex] = useState<number>(0);
    const [generationRequested, setGenerationRequested] = useState(false);
    const [selectedRewatchesByTrack, setSelectedRewatchesByTrack] = useState<Record<number, number>>({});
    const [sentenceDialogState, setSentenceDialogState] = useState<SentenceDialogState>();
    const hasSnapshots = trackSnapshots && trackSnapshots.length > 0;
    const loadingSnapshots = trackSnapshots === undefined;
    const allTrackProgressComplete = useMemo(
        () => hasSnapshots && trackSnapshots.every((s) => s.progress.current >= s.progress.total),
        [hasSnapshots, trackSnapshots]
    );
    const isGenerating = generationRequested && (!hasSnapshots || !allTrackProgressComplete);

    useEffect(() => {
        const unsubscribeStatistics = dictionaryProvider.onStatisticsSnapshot(
            (snapshot?: DictionaryStatisticsSnapshot) => {
                if (!snapshot) {
                    setMediaId(undefined);
                    setMediaInfo(undefined);
                    setStatisticsSnapshot(undefined);
                    setTrackSnapshots([]);
                    setGenerationRequested(false);
                    return;
                }

                setMediaId(snapshot.mediaId);
                if (mediaInfoFetcher) {
                    mediaInfoFetcher(snapshot.mediaId).then(setMediaInfo);
                } else {
                    setMediaInfo(undefined);
                }
                setStatisticsSnapshot(snapshot);
                const nextTrackSnapshots = processDictionaryStatisticsSnapshot(snapshot);
                setTrackSnapshots(nextTrackSnapshots);
                if (
                    nextTrackSnapshots.length &&
                    nextTrackSnapshots.every(
                        (trackSnapshot) => trackSnapshot.progress.current >= trackSnapshot.progress.total
                    )
                ) {
                    setGenerationRequested(false);
                }
            }
        );
        const unsubscribeGeneration = dictionaryProvider.onRequestStatisticsGeneration(() => {
            setGenerationRequested(true);
        });
        void dictionaryProvider.requestStatisticsSnapshot();
        return () => {
            unsubscribeStatistics();
            unsubscribeGeneration();
        };
    }, [dictionaryProvider, mediaInfoFetcher]);

    useEffect(() => setSelectedTrackSnapshotIndex(0), [mediaId]);

    const handleGenerate = useCallback(() => {
        setGenerationRequested(true);
        void dictionaryProvider.requestStatisticsGeneration(mediaId);
    }, [dictionaryProvider, mediaId]);

    useEffect(() => {
        if (!generationRequested) return;
        if (hasSnapshots) return;
        const timeout = setTimeout(() => {
            setGenerationRequested(false);
        }, 5000);
        return () => clearTimeout(timeout);
    }, [generationRequested, hasSnapshots, trackSnapshots]);

    const handleSelectedRewatchChanged = useCallback((track: number, rewatch: number) => {
        setSelectedRewatchesByTrack((current) => ({ ...current, [track]: rewatch }));
    }, []);
    const handleCloseSentenceBucketDetails = useCallback(() => setSentenceDialogState(undefined), []);
    const handleSeekSentence = useCallback(
        (sentence: DictionaryStatisticsSentence) => {
            if (mediaId === undefined) return;
            void dictionaryProvider.requestStatisticsSeek(mediaId, sentence.start);
            onSeekWasRequested?.(mediaId);
        },
        [dictionaryProvider, mediaId, onSeekWasRequested]
    );
    const handleMineSentence = useCallback(
        async (sentence: DictionaryStatisticsSentence) => {
            if (mediaId === undefined) return;
            const trackSnapshot = trackSnapshots?.find((candidate) => candidate.track === sentence.track);
            if (!trackSnapshot || trackSnapshot.progress.current < trackSnapshot.progress.total) return;
            await onMineWasRequested?.(mediaId);
            await Promise.resolve(dictionaryProvider.requestStatisticsMineSentences(mediaId, [sentence.index]));
        },
        [dictionaryProvider, onMineWasRequested, trackSnapshots, mediaId]
    );
    const canGenerateStatistics = useMemo(
        () => settings.dictionaryTracks.some((dt) => dictionaryTrackEnabled(dt)),
        [settings]
    );
    const trackSnapshot = trackSnapshots?.[selectedTrackSnapshotIndex];

    return (
        <Paper
            square
            sx={{
                display: 'flex',
                flexDirection: 'column',
                flexGrow: 1,
                gap: 2,
                boxShadow: 'none',
                ...(sx ?? {}),
            }}
        >
            {!loadingSnapshots && !hasSnapshots && (
                <Stack
                    spacing={2}
                    sx={{
                        p: 2,
                        display: 'flex',
                        width: '100%',
                        height: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Typography variant="h6" align="center">
                        {canGenerateStatistics && hasSubtitles && t('statistics.empty')}
                        {canGenerateStatistics && !hasSubtitles && t('landing.noSubtitles')}
                        {!canGenerateStatistics && (
                            <Trans
                                i18nKey={'statistics.gettingStarted'}
                                components={[
                                    <Link key={0} href={'#'} onClick={onViewAnnotationSettings}>
                                        settings
                                    </Link>,
                                ]}
                            />
                        )}
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={handleGenerate}
                        disabled={!hasSubtitles || !canGenerateStatistics}
                        loading={isGenerating}
                        startIcon={<BarChartIcon />}
                    >
                        {t('statistics.generate')}
                    </Button>
                </Stack>
            )}

            {loadingSnapshots && (
                <CenteredBox>
                    <CircularProgress />
                </CenteredBox>
            )}

            {hasSnapshots && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 0.5, flexGrow: 1 }}>
                            {mediaInfo?.sourceString && <Typography variant="h5">{mediaInfo?.sourceString}</Typography>}
                            {trackSnapshots.length > 0 && (
                                <TrackSnapshotSelector
                                    selectedIndex={selectedTrackSnapshotIndex}
                                    onSelectedIndex={setSelectedTrackSnapshotIndex}
                                    count={trackSnapshots.length}
                                />
                            )}
                        </Box>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 0.5,
                            }}
                        >
                            {mediaId && (
                                <Box>
                                    <IconButton>
                                        <PictureInPictureAltIcon onClick={() => onOpenOverlay(mediaId)} />
                                    </IconButton>
                                </Box>
                            )}
                            {onOpenInNewWindow && (
                                <Box>
                                    <IconButton>
                                        <OpenInNewIcon onClick={onOpenInNewWindow} />
                                    </IconButton>
                                </Box>
                            )}
                        </Box>
                    </Box>
                    {trackSnapshot && statisticsSnapshot && (
                        <TrackSnapshot
                            trackSnapshot={trackSnapshot}
                            statisticsSnapshot={statisticsSnapshot}
                            onSelectedRewatchChanged={handleSelectedRewatchChanged}
                            onSentenceDialogState={setSentenceDialogState}
                            selectedRewatchesByTrack={selectedRewatchesByTrack}
                        />
                    )}
                </Box>
            )}
            {sentenceDialogState !== undefined && (
                <StatisticsSentenceDetailsDialog
                    open
                    title={sentenceDialogState.title}
                    subtitles={sentenceDialogState.subtitles}
                    entries={sentenceDialogState.entries}
                    totalSentences={sentenceDialogState.totalSentences}
                    miningEnabled={sentenceDialogState.miningEnabled}
                    highlightedSentenceIndex={sentenceDialogState.highlightedSentenceIndex}
                    miningDisabledReason={t('statistics.miningDisabledUntilComplete')}
                    onClose={handleCloseSentenceBucketDetails}
                    onSeekToSentence={handleSeekSentence}
                    onMineSentence={handleMineSentence}
                />
            )}
        </Paper>
    );
}
