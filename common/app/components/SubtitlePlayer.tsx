import React, { ForwardedRef, useCallback, useEffect, useState, useRef, createRef, RefObject, ReactNode } from 'react';
import { makeStyles } from '@mui/styles';
import { type Theme } from '@mui/material';
import { keysAreEqual } from '../services/util';
import { useResize } from '../hooks/use-resize';
import { ScreenLocation, useDragging } from '../hooks/use-dragging';
import { useTranslation } from 'react-i18next';
import {
    PostMineAction,
    SubtitleModel,
    SubtitleHtml,
    AutoPauseContext,
    CopySubtitleWithAdditionalFieldsMessage,
    CardTextFieldValues,
    RichSubtitleModel,
} from '@project/common';
import { AsbplayerSettings } from '@project/common/settings';
import {
    surroundingSubtitles,
    mockSurroundingSubtitles,
    surroundingSubtitlesAroundInterval,
    extractText,
} from '@project/common/util';
import { SubtitleCollection } from '@project/common/subtitle-collection';
import { SubtitleAnnotations } from '@project/common/subtitle-annotations';
import { KeyBinder } from '@project/common/key-binder';
import SubtitleTextImage from '@project/common/components/SubtitleTextImage';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow, { TableRowProps } from '@mui/material/TableRow';
import Tooltip from '../../components/Tooltip';
import Typography from '@mui/material/Typography';
import Clock from '../services/clock';
import { useAppBarHeight } from '../../hooks/use-app-bar-height';
import { MineSubtitleParams } from '../hooks/use-app-web-socket-client';
import { isMobile } from 'react-device-detect';
import ChromeExtension, { ExtensionMessage } from '../services/chrome-extension';
import { MineSubtitleCommand, WebSocketClient } from '../../web-socket-client';
import { clampSubtitlePlayerWidth } from './video-subtitle-split';
import './subtitles.css';

let lastKnownWidth: number | undefined;
export const minSubtitlePlayerWidth = 200;
const calculateInitialWidth = () => lastKnownWidth ?? Math.max(350, 0.25 * window.innerWidth);

const lineIntersects = (a1: number, b1: number, a2: number, b2: number) => {
    if (a1 === a2 || b1 === b2) {
        return true;
    }

    if (a1 < a2) {
        return b1 >= a2;
    }

    return b2 >= a1;
};

const intersects = (
    startLocation: ScreenLocation,
    endLocation: ScreenLocation,
    tableRow: React.RefObject<HTMLElement | null>
) => {
    const element = tableRow.current;

    if (!element) {
        return false;
    }

    const selectionRect = {
        x: Math.min(startLocation.clientX, endLocation.clientX),
        y: Math.min(startLocation.clientY, endLocation.clientY),
        width: Math.abs(startLocation.clientX - endLocation.clientX),
        height: Math.abs(startLocation.clientY - endLocation.clientY),
    };
    const elementRect = element.getBoundingClientRect();
    return (
        lineIntersects(
            selectionRect.x,
            selectionRect.x + selectionRect.width,
            elementRect.x,
            elementRect.x + elementRect.width
        ) &&
        lineIntersects(
            selectionRect.y,
            selectionRect.y + selectionRect.height,
            elementRect.y,
            elementRect.y + elementRect.height
        )
    );
};

interface StylesProps {
    resizable: boolean;
    appBarHidden: boolean;
    appBarHeight: number;
}

const useSubtitlePlayerStyles = makeStyles<Theme, StylesProps, string>((theme) => ({
    container: {
        height: ({ appBarHidden, appBarHeight }) => (appBarHidden ? '100vh' : `calc(100vh - ${appBarHeight}px)`),
        position: 'relative',
        overflowX: 'hidden',
        backgroundColor: theme.palette.background.default,
        width: ({ resizable }) => (resizable ? 'auto' : '100%'),
        '&:focus': {
            outline: 'none',
        },
    },
    table: {
        backgroundColor: theme.palette.background.default,
        marginBottom: 75, // so the last row doesn't collide with controls
    },
    unselectableTable: {
        userSelect: 'none',
    },
    noSubtitles: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
        textAlign: 'center',
    },
}));

const useSubtitleRowStyles = makeStyles<Theme>((theme) => ({
    subtitleRow: {
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
        },
        minWidth: 250,
    },
    selectedSubtitleRow: {
        minWidth: 250,
        '& td': {
            borderColor: theme.palette.background.paper,
        },
        animation: `$select-subtitle-row 300ms ${theme.transitions.easing.easeInOut} forwards`,
    },
    '@keyframes select-subtitle-row': {
        '100%': {
            backgroundColor: theme.palette.background.paper,
        },
    },
    unselectedSubtitleRow: {
        minWidth: 250,
        animation: `$unselect-subtitle-row 300ms ${theme.transitions.easing.easeInOut} forwards`,
    },
    '@keyframes unselect-subtitle-row': {
        '100%': {
            filter: 'brightness(.7)',
            backgroundColor: theme.palette.action.disabledBackground,
        },
    },
    subtitle: {
        fontSize: 20,
        paddingRight: 0,
        width: '100%',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
        '& .asb-frequency rt': {
            fontSize: '0.5em',
        },
        '& .asb-frequency-hover rt': {
            fontSize: '0.5em',
        },
    },
    compressedSubtitle: {
        fontSize: 16,
        paddingRight: 0,
        width: '100%',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
        '& .asb-frequency rt': {
            fontSize: '0.5em',
        },
        '& .asb-frequency-hover rt': {
            fontSize: '0.5em',
        },
    },
    disabledSubtitle: {
        color: 'transparent',
        backgroundColor: theme.palette.action.disabledBackground,
        borderRadius: 5,
    },
    unselectableSubtitle: {
        userSelect: 'none',
    },
    timestamp: {
        fontSize: 14,
        color: '#aaaaaa',
        textAlign: 'right',
        paddingRight: 15,
        paddingLeft: 5,
        userSelect: 'none',
    },
    copyButton: {
        textAlign: 'right',
        padding: 0,
    },
}));

export interface DisplaySubtitleModel extends RichSubtitleModel {
    displayTime: string;
}

enum SelectionState {
    insideSelection = 1,
    outsideSelection = 2,
}

interface SubtitleRowProps extends TableRowProps {
    index: number;
    compressed: boolean;
    selectionState?: SelectionState;
    disabled: boolean;
    subtitle: DisplaySubtitleModel;
    showCopyButton: boolean;
    subtitleRef: RefObject<HTMLTableRowElement | null>;
    onClickSubtitle: (index: number) => void;
    onCopySubtitle: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, index: number) => void;
    onMouseOver: (e: React.MouseEvent) => void;
    onMouseOut: (e: React.MouseEvent) => void;
    subtitleHtml: SubtitleHtml;
}

const SubtitleRow = React.memo(function SubtitleRow({
    index,
    selectionState,
    subtitleRef,
    onClickSubtitle,
    onCopySubtitle,
    onMouseOver,
    onMouseOut,
    compressed,
    disabled,
    subtitle,
    showCopyButton,
    subtitleHtml,
}: SubtitleRowProps) {
    const classes = useSubtitleRowStyles();
    const textRef = useRef<HTMLSpanElement>(null);
    const [textSelected, setTextSelected] = useState<boolean>(false);
    const className = compressed ? classes.compressedSubtitle : classes.subtitle;
    const disabledClassName = disabled ? classes.disabledSubtitle : '';
    const { t } = useTranslation();

    if (subtitle.start < 0 || subtitle.end < 0) {
        return null;
    }

    function handleMouseUp() {
        const selection = document.getSelection();
        const selected =
            selection?.type === 'Range' && textRef.current?.isSameNode(selection.anchorNode?.parentNode ?? null);
        setTextSelected(selected ?? false);
    }

    const content = subtitle.textImage ? (
        <SubtitleTextImage availableWidth={window.screen.availWidth / 2} subtitle={subtitle} scale={1} />
    ) : (
        <span
            ref={textRef}
            className={disabledClassName}
            dangerouslySetInnerHTML={{ __html: subtitle.richText ?? subtitle.text }}
            data-track={subtitle.track}
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
        />
    );

    let rowClassName: string;

    if (selectionState === undefined) {
        rowClassName = classes.subtitleRow;
    } else if (selectionState === SelectionState.insideSelection) {
        rowClassName = classes.selectedSubtitleRow;
    } else {
        rowClassName = classes.unselectedSubtitleRow;
    }

    return (
        <TableRow
            onClick={() => !textSelected && onClickSubtitle(index)}
            onMouseUp={handleMouseUp}
            ref={subtitleRef}
            className={rowClassName}
        >
            {selectionState === undefined && (
                <Tooltip
                    disabled={!showCopyButton}
                    enterDelay={1500}
                    enterNextDelay={1500}
                    title={t('subtitlePlayer.multiSubtitleSelectHelp')!}
                    placement="top"
                >
                    <TableCell className={className}>{content}</TableCell>
                </Tooltip>
            )}
            {selectionState !== undefined && <TableCell className={className}>{content}</TableCell>}
            {showCopyButton && (
                <TableCell className={classes.copyButton}>
                    <IconButton disabled={selectionState !== undefined} onClick={(e) => onCopySubtitle(e, index)}>
                        <NoteAddIcon fontSize={compressed ? 'small' : 'medium'} />
                    </IconButton>
                </TableCell>
            )}
            <TableCell className={classes.timestamp}>
                <div>
                    <span style={{ display: 'none' }}>.</span>
                    {`\n${subtitle.displayTime}\n`}
                    <span style={{ display: 'none' }}>.</span>
                </div>
            </TableCell>
        </TableRow>
    );
});

interface ResizeHandleProps extends React.HTMLAttributes<HTMLDivElement> {
    isResizing: boolean;
}

const ResizeHandle = React.forwardRef(function ResizeHandle(
    { isResizing, style, ...rest }: ResizeHandleProps,
    ref: ForwardedRef<HTMLDivElement>
) {
    return (
        <div
            ref={ref}
            style={{
                ...style,
                position: 'absolute',
                width: isResizing ? 30 : isMobile ? 20 : 5,
                left: isResizing ? -15 : -2.5,
                height: '100%',
                cursor: 'col-resize',
            }}
            {...rest}
        />
    );
});

interface SubtitlePlayerProps {
    clock: Clock;
    extension: ChromeExtension;
    onSeek: (progress: number, shouldPlay: boolean) => void;
    onCopy: (
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        postMineAction: PostMineAction,
        forceUseGivenSubtitle?: boolean,
        cardTextFieldValues?: CardTextFieldValues
    ) => void;
    onOffsetChange: (offset: number) => void;
    onToggleSubtitleTrack: (track: number) => void;
    onSubtitlesHighlighted: (subtitles: SubtitleModel[]) => void;
    onMouseOver: (e: React.MouseEvent) => void;
    onMouseOut: (e: React.MouseEvent) => void;
    onResizeStart?: () => void;
    onResizeEnd?: (width: number) => void;
    autoPauseContext: AutoPauseContext;
    subtitles?: DisplaySubtitleModel[];
    subtitleCollection: SubtitleAnnotations | SubtitleCollection<DisplaySubtitleModel>;
    length: number;
    jumpToSubtitle?: SubtitleModel;
    onJumpToSubtitleHandled?: () => void;
    compressed: boolean;
    resizable: boolean;
    showCopyButton: boolean;
    enableMultiSelectMining?: boolean;
    loading: boolean;
    drawerOpen: boolean;
    appBarHidden: boolean;
    displayHelp?: string;
    disableKeyEvents: boolean;
    disableMiningBinds: boolean;
    lastJumpToTopTimestamp: number;
    hidden: boolean;
    disabledSubtitleTracks: { [track: number]: boolean };
    settings: AsbplayerSettings;
    keyBinder: KeyBinder;
    maxResizeWidth: number;
    initialWidth?: number;
    webSocketClient?: WebSocketClient;
}

export default function SubtitlePlayer({
    clock,
    extension,
    onSeek,
    onCopy,
    onOffsetChange,
    onToggleSubtitleTrack,
    onSubtitlesHighlighted,
    onMouseOver,
    onMouseOut,
    onResizeStart,
    onResizeEnd,
    autoPauseContext,
    subtitles,
    subtitleCollection,
    length,
    jumpToSubtitle,
    onJumpToSubtitleHandled,
    compressed,
    resizable,
    showCopyButton,
    enableMultiSelectMining = false,
    loading,
    drawerOpen,
    appBarHidden,
    displayHelp,
    disableKeyEvents,
    disableMiningBinds,
    lastJumpToTopTimestamp,
    hidden,
    disabledSubtitleTracks,
    settings,
    keyBinder,
    maxResizeWidth,
    initialWidth,
    webSocketClient,
}: SubtitlePlayerProps) {
    const { t } = useTranslation();
    const clockRef = useRef<Clock>(clock);
    clockRef.current = clock;
    const subtitleListRef = useRef<DisplaySubtitleModel[]>(undefined);
    subtitleListRef.current = subtitles;

    // Maintain a stable array of refs across subtitle list changes so that
    // individual row refs don't get a new identity on every subtitles update.
    // This prevents jumping to subtitle when their color is updated.
    const subtitleRefsRef = useRef<RefObject<HTMLTableRowElement | null>[]>([]);
    const subtitleRefs = subtitleRefsRef.current;
    if (subtitles) {
        while (subtitleRefs.length < subtitles.length) {
            subtitleRefs.push(createRef<HTMLTableRowElement>());
        }
        while (subtitleRefs.length > subtitles.length) {
            subtitleRefs.pop();
        }
    } else {
        subtitleRefsRef.current.length = 0;
    }

    const subtitleCollectionRef = useRef<SubtitleAnnotations | SubtitleCollection<DisplaySubtitleModel>>(
        subtitleCollection
    );
    subtitleCollectionRef.current = subtitleCollection;

    const highlightedSubtitleIndexesRef = useRef<{ [index: number]: boolean }>({});
    const [selectedSubtitleIndexes, setSelectedSubtitleIndexes] = useState<boolean[]>();
    const [highlightedJumpToSubtitleIndex, setHighlightedJumpToSubtitleIndex] = useState<number>();
    const lengthRef = useRef<number>(0);
    lengthRef.current = length;
    const hiddenRef = useRef<boolean>(false);
    hiddenRef.current = hidden;
    const lastScrollTimestampRef = useRef<number>(0);
    const requestAnimationRef = useRef<number>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);
    const drawerOpenRef = useRef<boolean>(undefined);
    drawerOpenRef.current = drawerOpen;
    const appBarHeight = useAppBarHeight();
    const classes = useSubtitlePlayerStyles({ resizable, appBarHidden, appBarHeight });
    const autoPauseContextRef = useRef<AutoPauseContext>(undefined);
    autoPauseContextRef.current = autoPauseContext;
    const onSubtitlesHighlightedRef = useRef<(subtitles: SubtitleModel[]) => void>(undefined);
    onSubtitlesHighlightedRef.current = onSubtitlesHighlighted;

    // Performance optimization: Set highlight style via refs rather than React state to avoid re-renders
    const updateHighlightedSubtitleRows = () => {
        const highlightedIndexes = highlightedSubtitleIndexesRef.current;
        for (let index = 0; index < subtitleRefsRef.current.length; ++index) {
            const classList = subtitleRefsRef.current[index].current?.classList;

            if (index in highlightedIndexes) {
                classList?.add('Mui-selected');
            } else {
                classList?.remove('Mui-selected');
            }
        }
    };

    // This effect should be scheduled only once as re-scheduling seems to cause performance issues.
    // Therefore all of the state it operates on is contained in refs.
    useEffect(() => {
        const update = () => {
            const subtitleRefs = subtitleRefsRef.current;
            const clock = clockRef.current;
            const currentSubtitleIndexes: { [index: number]: boolean } = {};
            const timestamp = clock.time(lengthRef.current);

            let slice = subtitleCollectionRef.current.subtitlesAt(timestamp);
            const showing = slice.showing.length === 0 ? (slice.lastShown ?? []) : slice.showing;
            let smallestIndex: number | undefined;

            for (const s of showing) {
                currentSubtitleIndexes[s.index] = true;

                if (smallestIndex === undefined || s.index < smallestIndex) {
                    smallestIndex = s.index;
                }
            }

            if (!keysAreEqual(currentSubtitleIndexes, highlightedSubtitleIndexesRef.current)) {
                highlightedSubtitleIndexesRef.current = currentSubtitleIndexes;
                updateHighlightedSubtitleRows();
                onSubtitlesHighlightedRef.current?.(showing);

                if (smallestIndex !== undefined) {
                    const scrollToSubtitleRef = subtitleRefs[smallestIndex];
                    const allowScroll = !hiddenRef.current && Date.now() - lastScrollTimestampRef.current > 5000;

                    if (scrollToSubtitleRef?.current && allowScroll) {
                        scrollToSubtitleRef.current.scrollIntoView({
                            block: 'center',
                            inline: 'nearest',
                            behavior: 'smooth',
                        });
                    }
                }
            }

            if (slice.startedShowing !== undefined) {
                autoPauseContextRef.current?.startedShowing(slice.startedShowing);
            }

            if (slice.willStopShowing !== undefined) {
                autoPauseContextRef.current?.willStopShowing(slice.willStopShowing);
            }

            requestAnimationRef.current = requestAnimationFrame(update);
        };

        requestAnimationRef.current = requestAnimationFrame(update);

        return () => {
            if (requestAnimationRef.current !== undefined) {
                cancelAnimationFrame(requestAnimationRef.current);
            }
        };
    }, []);

    const scrollToCurrentSubtitle = useCallback(() => {
        const highlightedSubtitleIndexes = highlightedSubtitleIndexesRef.current;

        if (!highlightedSubtitleIndexes) {
            return;
        }

        const indexes = Object.keys(highlightedSubtitleIndexes);

        if (indexes.length === 0) {
            return;
        }

        const scrollToSubtitleRef = subtitleRefs[Number(indexes[0])];

        scrollToSubtitleRef?.current?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth',
        });
    }, [subtitleRefs]);

    useEffect(() => {
        if (hidden) {
            return;
        }

        function scrollIfVisible() {
            if (document.visibilityState === 'visible') {
                scrollToCurrentSubtitle();
            }
        }

        document.addEventListener('visibilitychange', scrollIfVisible);

        return () => document.removeEventListener('visibilitychange', scrollIfVisible);
    }, [hidden, subtitleRefs, scrollToCurrentSubtitle]);

    useEffect(() => {
        if (!hidden) {
            scrollToCurrentSubtitle();
        }
    }, [hidden, scrollToCurrentSubtitle]);

    useEffect(() => {
        if (hiddenRef.current) {
            return;
        }

        const subtitleRefs = subtitleRefsRef.current;

        if (!subtitleRefs || subtitleRefs.length === 0) {
            return;
        }

        const firstSubtitleRef = subtitleRefs[0];
        firstSubtitleRef?.current?.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'smooth',
        });
    }, [lastJumpToTopTimestamp]);

    useEffect(() => {
        return keyBinder.bindAdjustOffset(
            (event, offset) => {
                event.preventDefault();
                event.stopPropagation();
                onOffsetChange(offset);
            },
            () => disableKeyEvents,
            () => subtitles
        );
    }, [keyBinder, onOffsetChange, disableKeyEvents, subtitles]);

    useEffect(() => {
        return keyBinder.bindResetOffet(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                onOffsetChange(0);
            },
            () => disableKeyEvents
        );
    }, [keyBinder, onOffsetChange, disableKeyEvents]);

    useEffect(() => {
        return keyBinder.bindOffsetToSubtitle(
            (event, offset) => {
                event.preventDefault();
                event.stopPropagation();
                onOffsetChange(offset);
            },
            () => disableKeyEvents,
            () => clock.time(length),
            () => subtitles,
            () => settings.seekableTracks
        );
    }, [keyBinder, onOffsetChange, disableKeyEvents, clock, subtitles, length, settings.seekableTracks]);

    useEffect(() => {
        return keyBinder.bindSeekToSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                event.stopPropagation();
                onSeek(subtitle.start, clock.running ?? false);
            },
            () => disableKeyEvents,
            () => clock.time(length),
            () => subtitles,
            () => settingsRef.current.seekableTracks
        );
    }, [keyBinder, onSeek, subtitles, disableKeyEvents, clock, length]);

    useEffect(() => {
        return keyBinder.bindSeekToBeginningOfCurrentSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                event.stopPropagation();
                onSeek(subtitle.start, settings.alwaysPlayOnSubtitleRepeat || clock.running);
            },
            () => disableKeyEvents,
            () => clock.time(length),
            () => subtitles,
            () => settingsRef.current.seekableTracks
        );
    }, [keyBinder, onSeek, subtitles, disableKeyEvents, clock, length, settings.alwaysPlayOnSubtitleRepeat]);

    useEffect(() => {
        return keyBinder.bindSeekBackwardOrForward(
            (event, forward) => {
                event.stopPropagation();
                event.preventDefault();
                if (forward) {
                    onSeek(Math.min(length, clock.time(length) + settings.seekDuration * 1000), clock.running);
                } else {
                    onSeek(Math.max(0, clock.time(length) - settings.seekDuration * 1000), clock.running);
                }
            },
            () => disableKeyEvents
        );
    }, [keyBinder, clock, length, disableKeyEvents, settings.seekDuration, onSeek]);

    useEffect(() => {
        function handleScroll() {
            lastScrollTimestampRef.current = Date.now();
        }

        const table = containerRef.current;
        table?.addEventListener('wheel', handleScroll, { passive: true });

        return () => table?.removeEventListener('wheel', handleScroll);
    }, [containerRef, lastScrollTimestampRef]);

    useEffect(() => {
        if (!jumpToSubtitle || !subtitles) {
            return;
        }

        let jumpToIndex = -1;
        let i = 0;
        for (const s of subtitles) {
            if (s.originalStart === jumpToSubtitle.originalStart && jumpToSubtitle.text.includes(s.text)) {
                jumpToIndex = i;
                break;
            }
            ++i;
        }

        const target = jumpToIndex !== -1 ? subtitles[jumpToIndex] : jumpToSubtitle;
        onSeek(target.start, clock.running);
        onJumpToSubtitleHandled?.();

        if (!hiddenRef.current && jumpToIndex !== -1) {
            subtitleRefs[jumpToIndex]?.current?.scrollIntoView({
                block: 'center',
                inline: 'nearest',
                behavior: 'smooth',
            });
            setHighlightedJumpToSubtitleIndex(jumpToIndex);
            setTimeout(() => setHighlightedJumpToSubtitleIndex(undefined), 1000);
        }
    }, [jumpToSubtitle, subtitles, subtitleRefs, onSeek, onJumpToSubtitleHandled, clock]);

    const currentMockSubtitle = useCallback(() => {
        const timestamp = clock.time(length);
        const end = Math.min(timestamp + 5000, length);
        return {
            text: '',
            start: timestamp,
            originalStart: timestamp,
            end: end,
            originalEnd: end,
            track: 0,
        };
    }, [clock, length]);

    const calculateSurroundingSubtitlesForIndex = useCallback(
        (index: number) => {
            if (!subtitles || subtitles.length === 0) {
                return mockSurroundingSubtitles(currentMockSubtitle(), length, 5000);
            }

            return surroundingSubtitles(
                subtitles,
                index,
                settings.surroundingSubtitlesCountRadius,
                settings.surroundingSubtitlesTimeRadius
            );
        },
        [
            length,
            subtitles,
            currentMockSubtitle,
            settings.surroundingSubtitlesCountRadius,
            settings.surroundingSubtitlesTimeRadius,
        ]
    );

    const calculateSurroundingSubtitles = useCallback(() => {
        if (!highlightedSubtitleIndexesRef.current) {
            return [];
        }

        const index = Math.min(...Object.keys(highlightedSubtitleIndexesRef.current).map((i) => Number(i)));
        return calculateSurroundingSubtitlesForIndex(index);
    }, [calculateSurroundingSubtitlesForIndex]);

    const calculateCurrentSubtitle = useCallback(() => {
        if (!subtitles || subtitles.length === 0) {
            const timestamp = clock.time(length);
            const end = Math.min(timestamp + 5000, length);
            return {
                text: '',
                start: timestamp,
                originalStart: timestamp,
                end: end,
                originalEnd: end,
                track: 0,
            };
        }

        if (!highlightedSubtitleIndexesRef.current) {
            return undefined;
        }

        const subtitleIndexes = Object.keys(highlightedSubtitleIndexesRef.current).map((i) => Number(i));

        if (subtitleIndexes.length === 0) {
            return undefined;
        }

        const index = Math.min(...subtitleIndexes);
        return subtitles[index];
    }, [clock, subtitles, length]);

    useEffect(() => {
        return keyBinder.bindCopy(
            (event, subtitle) => {
                event.preventDefault();
                event.stopPropagation();
                onCopy(subtitle, calculateSurroundingSubtitles(), PostMineAction.none);
            },
            () => disableKeyEvents || disableMiningBinds,
            () => calculateCurrentSubtitle()
        );
    }, [
        keyBinder,
        disableKeyEvents,
        disableMiningBinds,
        calculateCurrentSubtitle,
        calculateSurroundingSubtitles,
        onCopy,
    ]);

    const copyFromWebSocketClient = useCallback(
        ({ postMineAction, text, word, definition, customFieldValues }: MineSubtitleParams) => {
            if (!subtitles || subtitles.length === 0) {
                return false;
            }

            let index = -1;

            if (text) {
                index = subtitles.findIndex((s) => s.text === text);

                if (index === -1) {
                    const trimmedText = text.trim();
                    index =
                        subtitles.filter((s) => s.text.includes(trimmedText)).length === 1
                            ? subtitles.findIndex((s) => s.text.includes(trimmedText))
                            : -1;
                }
            }

            const subtitle = index === -1 ? calculateCurrentSubtitle() : subtitles![index];

            if (subtitle) {
                const surroundingSubtitles =
                    index === -1 ? calculateSurroundingSubtitles() : calculateSurroundingSubtitlesForIndex(index);
                const cardTextFieldValues = {
                    text: index === -1 ? text : extractText(subtitle, surroundingSubtitles),
                    word,
                    definition,
                    customFieldValues,
                };
                onCopy(subtitle, surroundingSubtitles, postMineAction, true, cardTextFieldValues);
                return true;
            }

            return false;
        },
        [
            onCopy,
            calculateCurrentSubtitle,
            calculateSurroundingSubtitles,
            calculateSurroundingSubtitlesForIndex,
            subtitles,
        ]
    );

    useEffect(() => {
        if (!webSocketClient || extension.supportsWebSocketClient) {
            // Do not handle mining commands here if the extension supports the web socket client.
            // The extension will handle the commands for us.
            return;
        }

        webSocketClient.onMineSubtitle = async ({
            body: { fields: receivedFields, postMineAction: receivedPostMineAction },
        }: MineSubtitleCommand) => {
            const fields = receivedFields ?? {};
            const word = fields[settings.wordField] || undefined;
            const definition = fields[settings.definitionField] || undefined;
            const text = fields[settings.sentenceField] || undefined;
            const customFieldValues = Object.fromEntries(
                Object.entries(settings.customAnkiFields)
                    .map(([asbplayerFieldName, ankiFieldName]) => {
                        const fieldValue = fields[ankiFieldName];

                        if (fieldValue === undefined) {
                            return undefined;
                        }

                        return [asbplayerFieldName, fieldValue];
                    })
                    .filter((entry) => entry !== undefined) as string[][]
            );
            const postMineAction = receivedPostMineAction ?? PostMineAction.showAnkiDialog;
            return copyFromWebSocketClient({ postMineAction, text, word, definition, customFieldValues });
        };
    }, [webSocketClient, extension, settings, copyFromWebSocketClient]);

    useEffect(() => {
        if (extension.installed) {
            return extension.subscribe((message: ExtensionMessage) => {
                if (!document.hasFocus() || message.data.command !== 'copy-subtitle-with-additional-fields') {
                    return;
                }

                const copySubtitleMessage = message.data as CopySubtitleWithAdditionalFieldsMessage;
                copyFromWebSocketClient(copySubtitleMessage);
            });
        }
    }, [extension, copyFromWebSocketClient]);

    useEffect(() => {
        return keyBinder.bindToggleSubtitleTrackInList(
            (event, track) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleSubtitleTrack(track);
            },
            () => disableKeyEvents
        );
    }, [keyBinder, disableKeyEvents, onToggleSubtitleTrack]);

    const mineCard = useCallback(
        (event: KeyboardEvent, postMineAction: PostMineAction) => {
            event.preventDefault();
            event.stopPropagation();
            const currentSubtitle = calculateCurrentSubtitle();

            if (currentSubtitle) {
                onCopy(currentSubtitle, calculateSurroundingSubtitles(), postMineAction);
            }
        },
        [onCopy, calculateCurrentSubtitle, calculateSurroundingSubtitles]
    );

    useEffect(() => {
        return keyBinder.bindAnkiExport(
            (event) => mineCard(event, PostMineAction.showAnkiDialog),
            () => disableKeyEvents || disableMiningBinds
        );
    }, [mineCard, keyBinder, disableKeyEvents, disableMiningBinds]);

    useEffect(() => {
        return keyBinder.bindUpdateLastCard(
            (event) => mineCard(event, PostMineAction.updateLastCard),
            () => disableKeyEvents || disableMiningBinds
        );
    }, [mineCard, keyBinder, disableKeyEvents, disableMiningBinds]);

    useEffect(() => {
        return keyBinder.bindExportCard(
            (event) => mineCard(event, PostMineAction.exportCard),
            () => disableKeyEvents || disableMiningBinds
        );
    }, [mineCard, keyBinder, disableKeyEvents, disableMiningBinds]);

    const handleClick = useCallback((index: number) => {
        const currentSubtitles = subtitleListRef.current;
        if (!currentSubtitles) {
            return;
        }

        const highlightedSubtitleIndexes = highlightedSubtitleIndexesRef.current || {};
        onSeekRef.current(
            currentSubtitles[index].start,
            !clockRef.current.running && index in highlightedSubtitleIndexes
        );
    }, []);

    // Avoid re-rendering the entire subtitle table by having handleCopy operate on refs
    const calculateSurroundingSubtitlesForIndexRef = useRef(calculateSurroundingSubtitlesForIndex);
    calculateSurroundingSubtitlesForIndexRef.current = calculateSurroundingSubtitlesForIndex;
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const onCopyRef = useRef(onCopy);
    onCopyRef.current = onCopy;
    const onSeekRef = useRef(onSeek);
    onSeekRef.current = onSeek;

    const handleCopy = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>, index: number) => {
        e.preventDefault();
        e.stopPropagation();

        const currentSubtitles = subtitleListRef.current;
        if (!currentSubtitles) {
            return;
        }

        onCopyRef.current(
            currentSubtitles[index],
            calculateSurroundingSubtitlesForIndexRef.current(index),
            settingsRef.current.clickToMineDefaultAction,
            true
        );
    }, []);

    const resizeHandleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!resizable) {
            return;
        }

        const interval = setInterval(() => {
            const resizeHandleDiv = resizeHandleRef.current;

            if (resizeHandleDiv) {
                resizeHandleDiv.style.top = `${containerRef.current?.scrollTop ?? 0}px`;
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [resizable]);

    const { width, setWidth, enableResize, isResizing } = useResize({
        initialWidth: calculateInitialWidth,
        minWidth: minSubtitlePlayerWidth,
        maxWidth: maxResizeWidth,
        onResizeStart,
        onResizeEnd,
    });
    const canMultiSelectMine = showCopyButton || enableMultiSelectMining;

    useEffect(() => {
        if (!resizable || initialWidth === undefined || maxResizeWidth < minSubtitlePlayerWidth) {
            return;
        }

        const clampedInitialWidth = clampSubtitlePlayerWidth(initialWidth, minSubtitlePlayerWidth, maxResizeWidth);
        setWidth(clampedInitialWidth);
    }, [resizable, initialWidth, maxResizeWidth, setWidth]);

    // Scroll to selected subtitle when layout changes
    useEffect(() => {
        // Small delay to allow layout to settle
        const timer = setTimeout(() => {
            scrollToCurrentSubtitle();
        }, 50);
        return () => clearTimeout(timer);
    }, [width, scrollToCurrentSubtitle]);

    useEffect(() => {
        lastKnownWidth = width;
    }, [width, maxResizeWidth]);

    const { dragging, draggingStartLocation, draggingCurrentLocation } = useDragging({ holdToDragMs: 750 });

    useEffect(() => {
        if (
            !dragging ||
            !draggingStartLocation ||
            !draggingCurrentLocation ||
            !subtitleRefs ||
            isResizing ||
            !canMultiSelectMine ||
            disableKeyEvents
        ) {
            setSelectedSubtitleIndexes(undefined);
            return;
        }

        setSelectedSubtitleIndexes(
            subtitleRefs.map((ref) => {
                return intersects(draggingStartLocation, draggingCurrentLocation, ref);
            })
        );
    }, [
        dragging,
        draggingStartLocation,
        draggingCurrentLocation,
        subtitleRefs,
        isResizing,
        canMultiSelectMine,
        disableKeyEvents,
    ]);

    useEffect(() => {
        if (
            subtitles !== undefined &&
            !dragging &&
            selectedSubtitleIndexes !== undefined &&
            selectedSubtitleIndexes.length > 0
        ) {
            const selectedSubtitles = selectedSubtitleIndexes
                .map((selected, index) => (selected ? subtitles[index] : undefined))
                .filter((s) => s !== undefined)
                .filter((s) => !disabledSubtitleTracks[s!.track]) as SubtitleModel[];

            if (selectedSubtitles.length > 0) {
                const startTimestamp = Math.min(...selectedSubtitles.map((s) => s.start));
                const endTimestamp = Math.max(...selectedSubtitles.map((s) => s.end));
                const { surroundingSubtitles } = surroundingSubtitlesAroundInterval(
                    subtitles,
                    startTimestamp,
                    endTimestamp,
                    settings.surroundingSubtitlesCountRadius,
                    settings.surroundingSubtitlesTimeRadius
                );

                if (surroundingSubtitles) {
                    const mergedSubtitle = {
                        text: selectedSubtitles.map((s) => s.text).join('\n'),
                        start: startTimestamp,
                        end: endTimestamp,
                        originalStart: Math.min(...selectedSubtitles.map((s) => s.originalStart)),
                        originalEnd: Math.max(...selectedSubtitles.map((s) => s.originalEnd)),
                        track: 0,
                    };
                    onCopy(mergedSubtitle, surroundingSubtitles, PostMineAction.showAnkiDialog, true);
                }
            }
        }

        updateHighlightedSubtitleRows();
    }, [
        dragging,
        disabledSubtitleTracks,
        selectedSubtitleIndexes,
        subtitles,
        settings.surroundingSubtitlesCountRadius,
        settings.surroundingSubtitlesTimeRadius,
        onCopy,
    ]);

    let subtitleTable: ReactNode | null = null;

    if (!subtitles || subtitles.length === 0) {
        if (!loading && displayHelp) {
            subtitleTable = !loading && displayHelp && (
                <div className={classes.noSubtitles}>
                    <Typography variant="h6">{displayHelp}</Typography>
                </div>
            );
        } else if (subtitles && subtitles.length === 0) {
            subtitleTable = (
                <div className={classes.noSubtitles}>
                    <Typography variant="h6">{t('landing.noSubtitles')}</Typography>
                </div>
            );
        }
    } else {
        const selectableTableClassName = isResizing || dragging ? classes.unselectableTable : '';

        subtitleTable = (
            <TableContainer className={`${classes.table} ${selectableTableClassName}`}>
                <Table>
                    <TableBody>
                        {subtitles.map((s: SubtitleModel, index: number) => {
                            let selectionState: SelectionState | undefined;

                            if (selectedSubtitleIndexes !== undefined) {
                                selectionState = selectedSubtitleIndexes[index]
                                    ? SelectionState.insideSelection
                                    : SelectionState.outsideSelection;
                            }

                            if (highlightedJumpToSubtitleIndex !== undefined) {
                                selectionState =
                                    highlightedJumpToSubtitleIndex === index
                                        ? SelectionState.insideSelection
                                        : SelectionState.outsideSelection;
                            }

                            return (
                                <SubtitleRow
                                    key={index}
                                    index={index}
                                    compressed={compressed}
                                    selectionState={selectionState}
                                    showCopyButton={showCopyButton}
                                    disabled={disabledSubtitleTracks[s.track]}
                                    subtitle={subtitles[index]}
                                    subtitleRef={subtitleRefs[index]}
                                    onClickSubtitle={handleClick}
                                    onCopySubtitle={handleCopy}
                                    onMouseOver={onMouseOver}
                                    onMouseOut={onMouseOut}
                                    subtitleHtml={settings.subtitleHtml}
                                />
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }

    return (
        <Paper
            square
            ref={containerRef}
            className={`${classes.container} asbplayer-token-container`}
            tabIndex={-1}
            style={{ width: resizable ? width : 'auto' }}
        >
            {subtitleTable}
            {resizable && (
                <ResizeHandle
                    isResizing={isResizing}
                    onMouseDown={enableResize}
                    onTouchStart={enableResize}
                    ref={resizeHandleRef}
                />
            )}
        </Paper>
    );
}
