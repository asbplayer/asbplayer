import { makeStyles } from '@mui/styles';
import PlaybackRateInput from './PlaybackRateInput';
import SubtitleOffsetInput from './SubtitleOffsetInput';
import TimeDisplay from './TimeDisplay';
import { MutableRefObject, useCallback, useRef, useState } from 'react';
import { ControlType } from '..';

const containerHeight = 40;
const scrollThreshold = containerHeight / 2 + 1;

const useStyles = makeStyles(() => {
    return {
        container: {
            height: containerHeight,
            overflowY: 'scroll',
            scrollSnapType: 'y mandatory',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': {
                display: 'none',
            },
            textAlign: 'center',
        },
        child: {
            scrollbarWidth: 'none',
            scrollSnapAlign: 'center',
            '&::-webkit-scrollbar': {
                display: 'none',
            },
            scrollSnapStop: 'always',
        },
    };
});

interface Props {
    offset: number;
    currentMilliseconds: number;
    totalMilliseconds?: number;
    playbackRate: number;
    offsetInputRef: MutableRefObject<HTMLInputElement | undefined>;
    onOffset: (offset: number) => void;
    playbackRateInputRef: MutableRefObject<HTMLInputElement | undefined>;
    onPlaybackRate: (playbackRate: number) => void;
    initialControlType?: ControlType;
    onScrollTo: (controlType: ControlType) => void;
}

enum InitialScrollState {
    notStarted = 0,
    started = 1,
    ended = 2,
}

const ScrollableNumberControls = ({
    currentMilliseconds,
    totalMilliseconds,
    offset,
    offsetInputRef,
    onOffset,
    playbackRate,
    playbackRateInputRef,
    onPlaybackRate,
    initialControlType,
    onScrollTo,
}: Props) => {
    const classes = useStyles();
    const [controlType, setControlType] = useState<ControlType>(ControlType.timeDisplay);
    const lastScrollTop = useRef<number>(0);
    const [initialScroll, setInitialScroll] = useState<InitialScrollState>(InitialScrollState.notStarted);
    const initialScrollRef = useRef<InitialScrollState>(undefined);
    initialScrollRef.current = initialScroll;
    const containerRef = useRef<HTMLDivElement>(undefined);
    const programmaticallyScrollingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const controlTypeRef = useRef<number>(controlType);
    const onScrollToRef = useRef<(controlType: ControlType) => void>(undefined);
    onScrollToRef.current = onScrollTo;
    controlTypeRef.current = controlType;

    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const currentScrollTop = e.currentTarget.scrollTop;
            const goingDown = currentScrollTop > lastScrollTop.current;
            const newControlType = goingDown
                ? Math.ceil(Math.floor(currentScrollTop) / containerHeight)
                : Math.floor(currentScrollTop / containerHeight);

            if (initialScroll === InitialScrollState.ended && newControlType !== controlType) {
                onScrollTo(newControlType);
                setControlType(newControlType);
            }

            lastScrollTop.current = currentScrollTop;
        },
        [onScrollTo, initialScroll, controlType]
    );

    const handleWheel = useCallback((e: WheelEvent) => {
        if (programmaticallyScrollingTimeoutRef.current !== undefined) {
            // Programmatic scroll already started
            e.preventDefault();
            return;
        }

        if (Number.isInteger(e.deltaY) || e.deltaX !== 0 || Math.abs(e.deltaY) < 1) {
            // Probably from a touchpad, let this through
            return;
        }

        // Only allow programmatic scroll to the next control
        e.preventDefault();

        const goingDown = e.deltaY > 0;
        let didProgrammaticallyScroll = false;

        if (goingDown && controlTypeRef.current < 2) {
            containerRef.current?.scrollBy({ top: scrollThreshold, behavior: 'smooth' });
            didProgrammaticallyScroll = true;
        } else if (!goingDown && controlTypeRef.current > 0) {
            containerRef.current?.scrollBy({ top: -scrollThreshold, behavior: 'smooth' });
            didProgrammaticallyScroll = true;
        }

        if (didProgrammaticallyScroll) {
            if (programmaticallyScrollingTimeoutRef.current !== undefined) {
                clearTimeout(programmaticallyScrollingTimeoutRef.current);
            }

            // Ensure the scrolling flag is reset so that we don't block all wheel operations
            programmaticallyScrollingTimeoutRef.current = setTimeout(() => {
                programmaticallyScrollingTimeoutRef.current = undefined;
            }, 500);
        }
    }, []);

    const handleDivRef = useCallback(
        (div: HTMLDivElement) => {
            if (initialScroll > InitialScrollState.notStarted) {
                return;
            }

            if (div) {
                if (initialControlType === undefined) {
                    setInitialScroll(InitialScrollState.ended);
                } else {
                    setTimeout(() => {
                        div.scrollTop = containerHeight * 2;
                        const transitionThroughScroll = (top: number, destinationControlType: ControlType) => {
                            div.scroll({ top, behavior: 'smooth' });
                            div.addEventListener('scrollend', (e: Event) => {
                                if ((e.currentTarget as HTMLDivElement)?.scrollTop >= containerHeight * 2) {
                                    // This is a result of the initial scrollTop = containerHeight * 2
                                    // to begin  the initial scroll - do not transition yet
                                    return;
                                }

                                // We can transition now that we are actually coming out of the initial scroll
                                if (initialScrollRef.current === InitialScrollState.started) {
                                    onScrollToRef.current?.(destinationControlType);
                                    setControlType(destinationControlType);
                                    setInitialScroll(InitialScrollState.ended);
                                }
                            });
                            setInitialScroll(InitialScrollState.started);
                        };

                        if (initialControlType === 1) {
                            transitionThroughScroll(containerHeight + 1, initialControlType);
                        } else if (initialControlType === 0) {
                            transitionThroughScroll(0, initialControlType);
                        } else {
                            setInitialScroll(InitialScrollState.ended);
                        }
                    }, 0);
                }

                div.addEventListener('wheel', handleWheel, { passive: false });
                div.addEventListener('scrollend', () => {
                    programmaticallyScrollingTimeoutRef.current = undefined;
                });
                containerRef.current = div;
            }
        },
        [initialScroll, initialControlType, handleWheel]
    );

    return (
        <div ref={handleDivRef} onScroll={handleScroll} className={classes.container}>
            <TimeDisplay
                currentMilliseconds={currentMilliseconds}
                totalMilliseconds={totalMilliseconds}
                className={classes.child}
            />
            <SubtitleOffsetInput
                inputRef={offsetInputRef}
                offset={offset}
                onOffset={onOffset}
                className={classes.child}
            />
            <PlaybackRateInput
                inputRef={playbackRateInputRef}
                playbackRate={playbackRate}
                onPlaybackRate={onPlaybackRate}
                className={classes.child}
            />
        </div>
    );
};

export default ScrollableNumberControls;
