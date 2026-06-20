import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ContextProp,
    ItemProps,
    ListRange,
    TableBodyProps,
    TableComponents,
    TableProps,
    TableVirtuoso,
    TableVirtuosoHandle,
} from 'react-virtuoso';
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
import {
    getAnnotationsHtml,
    renderRichTextWindow,
    emptyRichTextWindow,
    RichTextWindow,
    RenderedRichText,
    renderRichTextForSubtitle,
} from '@project/common/subtitle-annotations';
import { timeDurationDisplay } from '@project/common/util';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
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
import { DictionaryTrack, TokenAnnotationConfig, tokenAnnotationStyleValues } from '@project/common/settings';
import '../app/components/subtitles.css';

interface Props {
    open: boolean;
    title: string;
    subtitles: string[];
    entries: DictionaryStatisticsSentenceBucketEntry[];
    totalSentences: number;
    miningEnabled: boolean;
    dictionaryTracks: DictionaryTrack[];
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

interface SentenceTableContext {
    small: boolean;
    miningEnabled: boolean;
    mineTooltip: string;
    maximumDisplayedTimestamp: number;
    dictionaryTracks: DictionaryTrack[];
    richTextWindowRef: React.RefObject<RichTextWindow>;
    activeHighlightedSentenceIndex?: number;
    onSeekToSentence: (sentence: DictionaryStatisticsSentence) => void;
    onMineSentence: (sentence: DictionaryStatisticsSentence) => void;
}

const SentenceTable = ({ style, context, ...rest }: TableProps & ContextProp<SentenceTableContext>) => (
    <Table {...rest} style={style} />
);

const SentenceTableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps & ContextProp<SentenceTableContext>>(
    function SentenceTableBody({ context, ...rest }, ref) {
        return <TableBody {...rest} ref={ref} />;
    }
);

const SentenceTableRow = ({
    item,
    context,
    ...props
}: ItemProps<DictionaryStatisticsSentenceBucketEntry> & ContextProp<SentenceTableContext>) => {
    const sentence = item.sentence;
    const highlighted = context.activeHighlightedSentenceIndex === sentence.index;
    return (
        <TableRow
            {...props}
            role="button"
            tabIndex={0}
            sx={{
                cursor: 'pointer',
                backgroundColor: (theme) => (highlighted ? alpha(theme.palette.primary.main, 0.16) : undefined),
                '&:hover': {
                    backgroundColor: (theme) =>
                        highlighted ? alpha(theme.palette.primary.main, 0.24) : theme.palette.action.hover,
                },
                '& .asb-token-highlight:hover': {
                    backgroundColor: 'rgb(0, 123, 255)',
                },
            }}
            onClick={(event) => {
                const selection = document.getSelection();
                const row = event.currentTarget;
                const selectingText =
                    selection !== null &&
                    selection.type === 'Range' &&
                    !selection.isCollapsed &&
                    selection.anchorNode !== null &&
                    row.contains(selection.anchorNode);
                if (selectingText) return;
                context.onSeekToSentence(sentence);
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }
                event.preventDefault();
                context.onSeekToSentence(sentence);
            }}
        />
    );
};

interface SentenceRowCellsProps {
    entry: DictionaryStatisticsSentenceBucketEntry;
    small: boolean;
    miningEnabled: boolean;
    mineTooltip: string;
    maximumDisplayedTimestamp: number;
    tokenAnnotationConfig?: TokenAnnotationConfig;
    rendered?: RenderedRichText;
    onMineSentence: (sentence: DictionaryStatisticsSentence) => void;
}

// Memoized with stable props so that frequent statistics-snapshot updates don't re-render.
const SentenceRowCells = React.memo(function SentenceRowCells({
    entry,
    small,
    miningEnabled,
    mineTooltip,
    maximumDisplayedTimestamp,
    tokenAnnotationConfig,
    rendered,
    onMineSentence,
}: SentenceRowCellsProps) {
    const { t } = useTranslation();
    const sentence = entry.sentence;
    const comprehensionBand =
        dictionaryStatisticsComprehensionBands[entry.comprehensionBandIndex] ??
        dictionaryStatisticsComprehensionBands[dictionaryStatisticsComprehensionBands.length - 1];
    return (
        <>
            <TableCell sx={{ verticalAlign: 'top', whiteSpace: 'nowrap', width: small ? 'auto' : 72 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
            </TableCell>
            <TableCell
                className="asb-subtitles"
                sx={{
                    verticalAlign: 'top',
                    width: '100%',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'pre-wrap',
                }}
            >
                <span
                    style={tokenAnnotationStyleValues(tokenAnnotationConfig) as React.CSSProperties}
                    dangerouslySetInnerHTML={{
                        __html: getAnnotationsHtml(sentence.text, rendered?.richText, rendered?.richTextOnHover),
                    }}
                />
            </TableCell>
            <TableCell sx={{ verticalAlign: 'top', p: 0.5, textAlign: 'center' }}>
                <Tooltip title={mineTooltip}>
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
            </TableCell>
            {!small && (
                <TableCell
                    sx={{
                        verticalAlign: 'top',
                        whiteSpace: 'nowrap',
                        textAlign: 'right',
                        color: 'text.secondary',
                    }}
                >
                    {timeDurationDisplay(sentence.start, maximumDisplayedTimestamp, true)}
                </TableCell>
            )}
        </>
    );
});

const renderSentence = (
    _index: number,
    entry: DictionaryStatisticsSentenceBucketEntry,
    context: SentenceTableContext
) => (
    <SentenceRowCells
        entry={entry}
        small={context.small}
        miningEnabled={context.miningEnabled}
        mineTooltip={context.mineTooltip}
        maximumDisplayedTimestamp={context.maximumDisplayedTimestamp}
        tokenAnnotationConfig={
            context.dictionaryTracks[entry.sentence.track]?.dictionaryTokenAnnotationConfig.subtitlePlayer
        }
        rendered={renderRichTextForSubtitle(
            context.richTextWindowRef.current,
            entry.sentence,
            'subtitlePlayer',
            context.dictionaryTracks
        )}
        onMineSentence={context.onMineSentence}
    />
);

const computeSentenceItemKey = (_index: number, entry: DictionaryStatisticsSentenceBucketEntry) => entry.sentence.index;

const sentenceTableComponents: TableComponents<DictionaryStatisticsSentenceBucketEntry, SentenceTableContext> = {
    Table: SentenceTable,
    TableBody: SentenceTableBody,
    TableRow: SentenceTableRow,
};

export default function StatisticsSentenceDetailsDialog({
    open,
    title,
    subtitles,
    entries,
    totalSentences,
    miningEnabled,
    dictionaryTracks,
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
    const mineTooltip = miningEnabled ? t('action.mine') : (miningDisabledReason ?? t('action.mine'));
    const maximumDisplayedTimestamp = useMemo(
        () => entries.reduce((maximum, entry) => Math.max(maximum, entry.sentence.end), 0),
        [entries]
    );

    const sortedEntries = useMemo(() => {
        return sortDictionaryStatisticsSentenceBucketEntries(entries, sortState);
    }, [entries, sortState]);
    const sortedEntriesRef = useRef(sortedEntries);
    sortedEntriesRef.current = sortedEntries;
    const virtuosoRef = useRef<TableVirtuosoHandle>(null);

    const richTextWindowRef = useRef<RichTextWindow>(emptyRichTextWindow());

    const handleRangeChanged = useCallback(
        (range: ListRange) => {
            const entries = sortedEntriesRef.current;
            if (!entries.length) return;
            const windowSentences = entries.slice(range.startIndex, range.endIndex + 1).map((e) => e.sentence);
            richTextWindowRef.current = renderRichTextWindow(
                richTextWindowRef.current,
                windowSentences,
                'subtitlePlayer',
                dictionaryTracks
            );
        },
        [dictionaryTracks]
    );

    useEffect(() => {
        const range = richTextWindowRef.current.range;
        richTextWindowRef.current = emptyRichTextWindow();
        if (range && sortedEntries.length) {
            const windowSentences = sortedEntries.slice(range.min, range.max + 1).map((e) => e.sentence);
            richTextWindowRef.current = renderRichTextWindow(
                richTextWindowRef.current,
                windowSentences,
                'subtitlePlayer',
                dictionaryTracks
            );
        }
    }, [sortedEntries, dictionaryTracks]);

    useEffect(() => {
        if (!open || highlightedSentenceIndex === undefined) {
            setActiveHighlightedSentenceIndex(undefined);
            return;
        }

        setActiveHighlightedSentenceIndex(highlightedSentenceIndex);
        const scrollTimeout = window.setTimeout(() => {
            const index = sortedEntriesRef.current.findIndex(
                (entry) => entry.sentence.index === highlightedSentenceIndex
            );
            if (index !== -1) {
                virtuosoRef.current?.scrollToIndex({ index, align: 'center' });
            }
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
    }, [open, highlightedSentenceIndex]);

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
    const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);
    const theme = useTheme();
    const smallScreen = useMediaQuery(theme.breakpoints.down(450));
    const sortLabel = sortOptions.find((s) => s.sort === sortState.sort)!.label;
    const ArrowIcon = sortState.direction === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon;
    const onSeekToSentenceRef = useRef(onSeekToSentence);
    onSeekToSentenceRef.current = onSeekToSentence;
    const onMineSentenceRef = useRef(onMineSentence);
    onMineSentenceRef.current = onMineSentence;
    const handleSeekToSentence = useCallback(
        (sentence: DictionaryStatisticsSentence) => onSeekToSentenceRef.current(sentence),
        []
    );
    const handleMineSentence = useCallback(
        (sentence: DictionaryStatisticsSentence) => onMineSentenceRef.current(sentence),
        []
    );
    const listContext = useMemo<SentenceTableContext>(
        () => ({
            small: smallScreen,
            miningEnabled,
            mineTooltip: mineTooltip!,
            maximumDisplayedTimestamp,
            dictionaryTracks,
            richTextWindowRef,
            activeHighlightedSentenceIndex,
            onSeekToSentence: handleSeekToSentence,
            onMineSentence: handleMineSentence,
        }),
        [
            smallScreen,
            miningEnabled,
            mineTooltip,
            maximumDisplayedTimestamp,
            dictionaryTracks,
            activeHighlightedSentenceIndex,
            handleSeekToSentence,
            handleMineSentence,
        ]
    );

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

            <DialogContent ref={setScrollParent}>
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
                    scrollParent && (
                        <>
                            <TableVirtuoso
                                ref={virtuosoRef}
                                customScrollParent={scrollParent}
                                data={sortedEntries}
                                context={listContext}
                                components={sentenceTableComponents}
                                computeItemKey={computeSentenceItemKey}
                                itemContent={renderSentence}
                                rangeChanged={handleRangeChanged}
                                increaseViewportBy={{ top: window.innerHeight, bottom: window.innerHeight }} // pre-load for fast scrolling
                            />
                            <Box sx={{ height: bottomOffset }} />
                        </>
                    )
                )}
            </DialogContent>
        </Dialog>
    );
}
