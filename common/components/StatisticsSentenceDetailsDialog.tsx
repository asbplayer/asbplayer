import React, { createRef, RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import {
    DictionaryStatisticsSentence,
    DictionaryStatisticsSentenceBucketEntry,
    DictionaryStatisticsSentenceSort,
    DictionaryStatisticsSentenceSortState,
    defaultDictionaryStatisticsSentenceSortState,
    dictionaryStatisticsComprehensionBands,
    nextDictionaryStatisticsSentenceSortCategory,
    nextDictionaryStatisticsSentenceSortDirection,
    percentDisplay,
    sortDictionaryStatisticsSentenceBucketEntries,
} from '@project/common/dictionary-statistics';
import { timeDurationDisplay } from '@project/common/util';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import { alpha, useTheme } from '@mui/material/styles';
import Tooltip from './Tooltip';
import { useTranslation } from 'react-i18next';
import useMediaQuery from '@mui/material/useMediaQuery';
import ButtonGroup from '@mui/material/ButtonGroup';
import SortIcon from '@mui/icons-material/Sort';
import Toolbar from '@mui/material/Toolbar';
import '../app/components/subtitles.css';

interface Props {
    open: boolean;
    title: string;
    subtitles: string[];
    entries: DictionaryStatisticsSentenceBucketEntry[];
    totalSentences: number;
    miningEnabled: boolean;
    highlightedSentenceIndex?: number;
    miningDisabledReason?: string;
    onClose: () => void;
    onSeekToSentence: (sentence: DictionaryStatisticsSentence) => void;
    onMineSentence: (sentence: DictionaryStatisticsSentence) => void;
}

const Subtitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Typography noWrap variant={'subtitle2'}>
        {children}
    </Typography>
);

interface SentenceProps {
    entry: DictionaryStatisticsSentenceBucketEntry;
    ref: RefObject<HTMLDivElement | null>;
    small: boolean;
    highlighted: boolean;
    mineTooltip: string;
    miningEnabled: boolean;
    maximumDisplayedTimestamp: number;
    onSeekToSentence: (sentence: DictionaryStatisticsSentence) => void;
    onMineSentence: (sentence: DictionaryStatisticsSentence) => void;
}

const Sentence: React.FC<SentenceProps> = React.memo(function Sentence({
    entry,
    ref,
    small,
    highlighted,
    miningEnabled,
    mineTooltip,
    maximumDisplayedTimestamp,
    onSeekToSentence,
    onMineSentence,
}) {
    const { t } = useTranslation();
    const sentence = entry.sentence;
    const comprehensionBand =
        dictionaryStatisticsComprehensionBands[entry.comprehensionBandIndex] ??
        dictionaryStatisticsComprehensionBands[dictionaryStatisticsComprehensionBands.length - 1];
    return (
        <Paper
            key={sentence.index}
            variant="outlined"
            ref={ref}
            sx={{
                display: 'flex',
                alignItems: 'stretch',
                overflow: 'hidden',
                transition: (theme) =>
                    theme.transitions.create(['background-color', 'border-color'], {
                        duration: 1000,
                    }),
                backgroundColor: (theme) => (highlighted ? alpha(theme.palette.primary.main, 0.16) : 'transparent'),
                borderColor: (theme) => (highlighted ? theme.palette.primary.main : undefined),
            }}
        >
            <Box
                role="button"
                tabIndex={0}
                sx={{
                    flex: 1,
                    minWidth: 0,
                    px: 2,
                    py: 1.5,
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.hover' },
                }}
                onClick={() => onSeekToSentence(sentence)}
                onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onSeekToSentence(sentence);
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 2,
                        alignItems: 'flex-start',
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            flexShrink: 0,
                            minWidth: small ? 'auto' : 72,
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            {`#${sentence.index + 1}`}
                        </Typography>
                        <Tooltip title={t('statistics.comprehension')}>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: comprehensionBand.color,
                                    lineHeight: 1.2,
                                    fontWeight: 600,
                                    width: 'fit-content',
                                }}
                            >
                                {percentDisplay(entry.comprehensionPercent)}
                            </Typography>
                        </Tooltip>
                    </Box>
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                            '& .asb-frequency rt': { fontSize: '0.5em' },
                            '& .asb-frequency-hover rt': { fontSize: '0.5em' },
                        }}
                    >
                        <span
                            dangerouslySetInnerHTML={{
                                __html: sentence.richText ?? sentence.text,
                            }}
                        />
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            flexShrink: 0,
                            ml: 'auto',
                        }}
                    >
                        <Tooltip title={mineTooltip!}>
                            <span>
                                <IconButton
                                    disabled={!miningEnabled}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        onMineSentence(sentence);
                                    }}
                                >
                                    <NoteAddIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        {!small && (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ whiteSpace: 'nowrap', pl: 0.5, textAlign: 'right' }}
                            >
                                {timeDurationDisplay(sentence.start, maximumDisplayedTimestamp, true)}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
        </Paper>
    );
});

export default function StatisticsSentenceDetailsDialog({
    open,
    title,
    subtitles,
    entries,
    totalSentences,
    miningEnabled,
    highlightedSentenceIndex,
    miningDisabledReason,
    onClose,
    onSeekToSentence,
    onMineSentence,
}: Props) {
    const { t } = useTranslation();
    const [sortState, setSortState] = useState<DictionaryStatisticsSentenceSortState>(
        defaultDictionaryStatisticsSentenceSortState()
    );
    const [activeHighlightedSentenceIndex, setActiveHighlightedSentenceIndex] = useState<number>();
    const entryRefs = useMemo(() => {
        const refs: Record<number, RefObject<HTMLDivElement | null>> = {};
        for (const entry of entries) {
            refs[entry.sentence.index] = createRef<HTMLDivElement | null>();
        }
        return refs;
    }, [entries]);
    const mineTooltip = miningEnabled ? t('action.mine') : (miningDisabledReason ?? t('action.mine'));
    const maximumDisplayedTimestamp = useMemo(
        () => entries.reduce((maximum, entry) => Math.max(maximum, entry.sentence.end), 0),
        [entries]
    );

    useEffect(() => {
        if (!open || highlightedSentenceIndex === undefined) {
            setActiveHighlightedSentenceIndex(undefined);
            return;
        }

        setActiveHighlightedSentenceIndex(highlightedSentenceIndex);
        const scrollTimeout = window.setTimeout(() => {
            entryRefs[highlightedSentenceIndex].current?.scrollIntoView({
                block: 'center',
            });
        }, 0);
        const highlightTimeout = window.setTimeout(() => {
            setActiveHighlightedSentenceIndex((current) =>
                current === highlightedSentenceIndex ? undefined : current
            );
        }, 5000);

        return () => {
            window.clearTimeout(scrollTimeout);
            window.clearTimeout(highlightTimeout);
        };
    }, [open, entryRefs, highlightedSentenceIndex]);

    const sortedEntries = useMemo(() => {
        return sortDictionaryStatisticsSentenceBucketEntries(entries, sortState);
    }, [entries, sortState]);

    const sortOptions: { sort: DictionaryStatisticsSentenceSort; label: string }[] = [
        { sort: 'index', label: t('statistics.sentenceIndex') },
        { sort: 'comprehension', label: t('statistics.comprehension') },
        { sort: 'frequency', label: t('statistics.frequency') },
        { sort: 'occurrences', label: t('statistics.occurrences') },
    ];

    const [bottomOffset, setBottomOffset] = useState<number>(0);
    const handleCaptionBoxRef = useCallback((div: HTMLDivElement | null) => {
        if (!div) {
            setBottomOffset(0);
            return;
        }
        setBottomOffset(div.getBoundingClientRect().height);
    }, []);
    const theme = useTheme();
    const smallScreen = useMediaQuery(theme.breakpoints.down(450));
    const sortLabel = sortOptions.find((s) => s.sort === sortState.sort)!.label;
    const ArrowIcon = sortState.direction === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon;

    return (
        <Dialog fullWidth maxWidth="md" open={open} onClose={onClose}>
            <Toolbar>
                <div style={{ flexGrow: 1 }}>
                    <Typography variant="h6">{title}</Typography>
                </div>
                <IconButton aria-label={t('action.cancel')} onClick={onClose} edge="end">
                    <CloseIcon />
                </IconButton>
            </Toolbar>

            <DialogContent>
                <Box
                    ref={handleCaptionBoxRef}
                    sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        p: 1.5,
                    }}
                >
                    <Box
                        sx={{
                            position: 'relative',
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%',
                            gap: 1.5,
                            zIndex: (theme) => theme.zIndex.modal + 1,
                            p: 1.5,
                            borderRadius: 1,
                            background: (theme) => alpha(theme.palette.background.paper, 0.7),
                            alignItems: 'center',
                            flexWrap: 'wrap',
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                flexGrow: 1,
                            }}
                        >
                            {subtitles.length > 0 && (
                                <Box sx={{ display: 'flex', direction: 'row', flexWrap: 'wrap' }}>
                                    {subtitles.map((subtitle, i) => {
                                        if (i === subtitles.length - 1) {
                                            return <Subtitle key={i}>{subtitle}</Subtitle>;
                                        }
                                        return <Subtitle key={i}>{subtitle}&nbsp;·&nbsp;</Subtitle>;
                                    })}
                                </Box>
                            )}
                            <Typography noWrap variant="caption" color="text.secondary">
                                {t('statistics.matchingSentences', { number: `${entries.length}/${totalSentences}` })}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'end', minWidth: 200, flexGrow: 1 }}>
                            <ButtonGroup fullWidth>
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="primary"
                                    startIcon={<SortIcon fontSize="small" />}
                                    fullWidth
                                    onClick={() => setSortState(nextDictionaryStatisticsSentenceSortCategory)}
                                >
                                    {sortLabel}
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    sx={{ '& .MuiButton-startIcon': { margin: 0 }, maxWidth: 48 }}
                                    startIcon={<ArrowIcon fontSize="small" />}
                                    onClick={() => setSortState(nextDictionaryStatisticsSentenceSortDirection)}
                                />
                            </ButtonGroup>
                        </Box>
                    </Box>
                </Box>
                {sortedEntries.length === 0 ? (
                    <Typography color="text.secondary">{t('statistics.sentenceDetailsEmpty')}</Typography>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {sortedEntries.map((entry) => {
                            const isHighlighted = activeHighlightedSentenceIndex === entry.sentence.index;
                            return (
                                <Sentence
                                    key={entry.sentence.index}
                                    ref={entryRefs[entry.sentence.index]}
                                    entry={entry}
                                    small={smallScreen}
                                    highlighted={isHighlighted}
                                    maximumDisplayedTimestamp={maximumDisplayedTimestamp}
                                    mineTooltip={mineTooltip!}
                                    miningEnabled={miningEnabled}
                                    onMineSentence={onMineSentence}
                                    onSeekToSentence={onSeekToSentence}
                                />
                            );
                        })}
                        <Box sx={{ height: bottomOffset }} />
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
