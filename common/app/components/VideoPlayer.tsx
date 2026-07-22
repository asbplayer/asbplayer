import React, { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { makeStyles } from '@mui/styles';
import { useWindowSize } from '../hooks/use-window-size';
import {
    SubtitleModel,
    AudioTrackModel,
    PostMineAction,
    PlayMode,
    OffscreenDomCache,
    CardTextFieldValues,
    PostMinePlayback,
    ControlType,
    IndexedSubtitleModel,
} from '@project/common';
import {
    MiscSettings,
    SubtitleSettings,
    AnkiSettings,
    AsbplayerSettings,
    SubtitleAlignment,
    changeForTextSubtitleSetting,
    textSubtitleSettingsForTrack,
    PauseOnHoverMode,
    allTextSubtitleSettings,
    TokenState,
    ApplyStrategy,
    DictionaryTrack,
} from '@project/common/settings';
import {
    arrayEquals,
    compareSubtitlesForDisplay,
    surroundingSubtitles,
    mockSurroundingSubtitles,
    seekWithNudge,
    surroundingSubtitlesAroundInterval,
    ensureStoragePersisted,
    subtitleTimestampWithDelay,
    errorMessageFromVideo,
} from '@project/common/util';
import { SubtitleCollection } from '@project/common/subtitle-collection';
import {
    HoveredToken,
    renderRichTextOntoSubtitles,
    getAnnotationsHtml,
    ANNOTATIONS_VIDEO_RENDER_BEHIND_MS,
    ANNOTATIONS_VIDEO_RENDER_AHEAD_MS,
} from '@project/common/annotations';
import Clock from '@project/common/playback/clock';
import { hasEnabledPlaybackModes, playbackModeNotifications } from '@project/common/playback/playback-mode-controller';
import PlaybackEngine from '@project/common/playback/playback-engine';
import VideoFrameTimingDriver from '@project/common/playback/video-frame-timing-driver';
import Controls, { Point } from './Controls';
import PlayerChannel from '../services/player-channel';
import ChromeExtension from '../services/chrome-extension';
import { type AlertColor } from '@mui/material/Alert';
import Alert from './Alert';
import { useSubtitleDomCache } from '../hooks/use-subtitle-dom-cache';
import { useAppKeyBinder } from '../hooks/use-app-key-binder';
import { Direction, useSwipe } from '../hooks/use-swipe';
import './subtitles.css';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { adjacentSubtitle } from '../../key-binder';
import { usePlaybackPreferences } from '../hooks/use-playback-preferences';
import { MiningContext } from '../services/mining-context';
import { useSubtitleStyles } from '../hooks/use-subtitle-styles';
import { useFullscreen } from '../hooks/use-fullscreen';
import MobileVideoOverlay from '@project/common/components/MobileVideoOverlay';
import BlurOverlay from './BlurOverlay';
import { CachedLocalStorage } from '../services/cached-local-storage';
import useLastScrollableControlType from '../../hooks/use-last-scrollable-control-type';
import { type Theme } from '@mui/material/styles';

const overlayContainerHeight = 48;
interface ExperimentalHTMLVideoElement extends HTMLVideoElement {
    readonly audioTracks: any;
}

const useStyles = makeStyles<Theme>((theme) => ({
    root: {
        position: 'relative',
        backgroundColor: 'black',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {
        margin: 'auto',
    },
    cursorHidden: {
        cursor: 'none',
    },
    mobileOverlay: {
        position: 'absolute',
        zIndex: 10,
        bottom: theme.spacing(1.5),
    },
}));

function notifyReady(
    element: ExperimentalHTMLVideoElement,
    playerChannel: PlayerChannel,
    setAudioTracks: React.Dispatch<React.SetStateAction<AudioTrackModel[] | undefined>>,
    setSelectedAudioTrack: React.Dispatch<React.SetStateAction<string | undefined>>
) {
    if (window.outerWidth && element.videoWidth > 0 && element.videoHeight > 0) {
        const availWidth = window.screen.availWidth - (window.outerWidth - window.innerWidth);
        const availHeight = window.screen.availHeight - (window.outerHeight - window.innerHeight);
        const resizeRatio = Math.min(1, Math.min(availWidth / element.videoWidth, availHeight / element.videoHeight));

        window.resizeTo(
            resizeRatio * element.videoWidth + (window.outerWidth - window.innerWidth),
            resizeRatio * element.videoHeight + (window.outerHeight - window.innerHeight)
        );
    }

    let tracks: AudioTrackModel[] | undefined;
    let selectedTrack: string | undefined;

    if (element.audioTracks) {
        tracks = [];

        for (const t of element.audioTracks) {
            tracks.push({
                id: t.id,
                label: t.label,
                language: t.language,
            });

            if (t.enabled) {
                selectedTrack = t.id;
            }
        }
    } else {
        tracks = undefined;
        selectedTrack = undefined;
    }

    setAudioTracks(tracks);
    setSelectedAudioTrack(selectedTrack);
    playerChannel.ready(element.duration, element.paused, element.playbackRate, tracks, selectedTrack);
}

const showingSubtitleHtml = (
    subtitle: IndexedSubtitleModel,
    videoRef: MutableRefObject<ExperimentalHTMLVideoElement | undefined>,
    subtitleStyles: string,
    subtitleClasses: string,
    imageBasedSubtitleScaleFactor: number,
    dictionaryTracks: DictionaryTrack[]
) => {
    if (subtitle.textImage) {
        const imageScale =
            (imageBasedSubtitleScaleFactor * (videoRef.current?.width ?? window.screen.availWidth)) /
            subtitle.textImage.screen.width;
        const width = imageScale * subtitle.textImage.image.width;
        return `
<div style="max-width:${width}px;margin:auto;">
<img
    style="width:100%;"
    alt="subtitle"
    src="${subtitle.textImage.dataUrl}"
    class="${subtitleClasses}"
/>
</div>
`;
    }
    const allSubtitleClasses = subtitleClasses ? `${subtitleClasses} asbplayer-subtitles` : 'asbplayer-subtitles';
    const rendered = renderRichTextOntoSubtitles([subtitle], 'video', dictionaryTracks)?.get(subtitle.index);
    return `<span class="${allSubtitleClasses}" style="${subtitleStyles}" data-track="${subtitle.track}">${getAnnotationsHtml(
        subtitle.text,
        rendered?.richText,
        rendered?.richTextOnHover
    )}</span>`;
};

interface CachedShowingSubtitleProps {
    subtitle: IndexedSubtitleModel;
    domCache: OffscreenDomCache;
    renderHtml: (subtitle: IndexedSubtitleModel) => string;
    className?: string;
    onMouseOver: React.MouseEventHandler<HTMLDivElement>;
    onMouseOut: React.MouseEventHandler<HTMLDivElement>;
}

const CachedShowingSubtitle = React.memo(function CachedShowingSubtitle({
    subtitle,
    domCache,
    renderHtml,
    className,
    onMouseOver,
    onMouseOut,
}: CachedShowingSubtitleProps) {
    return (
        <div
            className={className ? className : ''}
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
            ref={(ref) => {
                if (!ref) {
                    return;
                }

                while (ref.firstChild) {
                    domCache.return(ref.lastChild! as HTMLElement);
                }

                ref.appendChild(domCache.get(String(subtitle.index), () => renderHtml(subtitle)));
            }}
        />
    );
});

const useSubtitleContainerStyles = makeStyles(() => ({
    subtitleContainer: {
        position: 'absolute',
        zIndex: 6,
        paddingLeft: 20,
        paddingRight: 20,
        textAlign: 'center',
        whiteSpace: 'normal',
        lineHeight: 'inherit',
    },
}));

interface SubtitleContainerProps {
    subtitleSettings: SubtitleSettings;
    alignment: SubtitleAlignment;
    subtitleZIndex: boolean;
    baseOffset: number;
    children: React.ReactNode;
}

const SubtitleContainer = React.forwardRef<HTMLDivElement, SubtitleContainerProps>(function SubtitleContainer(
    { subtitleSettings, alignment, baseOffset, children, subtitleZIndex }: SubtitleContainerProps,
    ref
) {
    const classes = useSubtitleContainerStyles();
    return (
        <div
            ref={ref}
            className={classes.subtitleContainer}
            style={{
                ...(alignment === 'bottom'
                    ? { bottom: subtitleSettings.subtitlePositionOffset + baseOffset }
                    : { top: subtitleSettings.topSubtitlePositionOffset + baseOffset }),
                ...(subtitleSettings.subtitlesWidth === -1 ? {} : { width: `${subtitleSettings.subtitlesWidth}%` }),
                zIndex: subtitleZIndex ? 12 : 0,
            }}
        >
            {children}
        </div>
    );
});

export interface SeekRequest {
    timestamp: number;
}

interface Props {
    settings: AsbplayerSettings;
    extension: ChromeExtension;
    videoFile: string;
    channel: string;
    popOut: boolean;
    miningContext: MiningContext;
    ankiDialogOpen: boolean;
    seekRequest?: SeekRequest;
    onAnkiDialogRequest: (
        videoFileUrl: string,
        videoFileName: string,
        selectedAudioTrack: string | undefined,
        playbackRate: number,
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        cardTextFieldValues: CardTextFieldValues,
        timestamp: number
    ) => void;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    onAnkiDialogRewind: () => void;
    onError: (error: string) => void;
}

interface MinedRecord {
    videoFileUrl: string;
    videoFileName: string;
    selectedAudioTrack: string | undefined;
    playbackRate: number;
    subtitle: SubtitleModel;
    surroundingSubtitles: SubtitleModel[];
    timestamp: number;
}

const allSubtitleAlignments = (subtitleSettings: SubtitleSettings) => {
    return allTextSubtitleSettings(subtitleSettings).map((s) => s.subtitleAlignment);
};

const lastControlTypeKey = 'lastScrollableControlType';
const storage = new CachedLocalStorage();

const fetchLastControlType = async (): Promise<ControlType | undefined> => {
    const val = storage.get(lastControlTypeKey);

    if (val == null) {
        return undefined;
    }

    return parseInt(val);
};

const saveLastControlType = async (controlType: ControlType): Promise<void> => {
    storage.set(lastControlTypeKey, String(controlType));
};

export default function VideoPlayer({
    settings,
    extension,
    videoFile,
    channel,
    popOut,
    miningContext,
    ankiDialogOpen,
    seekRequest,
    onAnkiDialogRequest,
    onError,
    onAnkiDialogRewind,
    onSettingsChanged,
}: Props) {
    const classes = useStyles();
    const { t } = useTranslation();
    const poppingInRef = useRef<boolean>(undefined);
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const onSettingsChangedRef = useRef(onSettingsChanged);
    onSettingsChangedRef.current = onSettingsChanged;
    const videoRef = useRef<ExperimentalHTMLVideoElement>(undefined);
    const [video, setVideo] = useState<ExperimentalHTMLVideoElement>();
    const playbackEngineRef = useRef<PlaybackEngine<IndexedSubtitleModel>>(undefined);
    const hiddenVideoRef = useRef<HTMLVideoElement | null>(null); // seek preview thumbnail
    const [hiddenVideoReady, setHiddenVideoReady] = useState(false);
    const [windowWidth, windowHeight] = useWindowSize(true);
    if (videoRef.current) {
        videoRef.current.width = windowWidth;
        videoRef.current.height = windowHeight;
    }
    const playerChannel = useMemo(() => new PlayerChannel(channel), [channel]);
    const [playerChannelSubscribed, setPlayerChannelSubscribed] = useState<boolean>(false);
    const { fullscreen, requestFullscreen } = useFullscreen();
    const playing = () => !videoRef.current?.paused || false;
    const [lengthMs, setLengthMs] = useState<number>(0);
    const lengthMsRef = useRef(lengthMs);
    lengthMsRef.current = lengthMs;
    const [videoFileName, setVideoFileName] = useState<string>();
    const [videoWidth, setVideoWidth] = useState<number>(); // width and height are original width and height from metadata
    const [videoHeight, setVideoHeight] = useState<number>();
    const [offset, setOffset] = useState<number>(0);
    const offsetRef = useRef(offset);
    offsetRef.current = offset;
    const [audioTracks, setAudioTracks] = useState<AudioTrackModel[]>();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>();
    const [wasPlayingOnAnkiDialogRequest, setWasPlayingOnAnkiDialogRequest] = useState<boolean>(false);
    const [subtitles, setSubtitles] = useState<IndexedSubtitleModel[]>([]);
    const subtitlesRef = useRef(subtitles);
    subtitlesRef.current = subtitles;
    const subtitleCollection = useMemo<SubtitleCollection<IndexedSubtitleModel>>(() => {
        const newCol = new SubtitleCollection<IndexedSubtitleModel>({
            showingCheckRadiusMs: 150,
            returnLastShown: true,
            returnNextToShow: true,
        });
        newCol.setSubtitles(subtitles);
        return newCol;
    }, [subtitles]);
    const [showSubtitles, setShowSubtitles] = useState<IndexedSubtitleModel[]>([]);
    const [miscSettings, setMiscSettings] = useState<MiscSettings>(settings);
    const miscSettingsRef = useRef(miscSettings);
    miscSettingsRef.current = miscSettings;
    const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(settings);
    const [ankiSettings, setAnkiSettings] = useState<AnkiSettings>(settings);
    const playbackPreferences = usePlaybackPreferences({ ...miscSettings, ...subtitleSettings }, extension);
    const [displaySubtitles, setDisplaySubtitles] = useState(playbackPreferences.displaySubtitles);
    const [disabledSubtitleTracks, setDisabledSubtitleTracks] = useState<{ [index: number]: boolean }>({});
    const disabledSubtitleTracksRef = useRef(disabledSubtitleTracks);
    disabledSubtitleTracksRef.current = disabledSubtitleTracks;
    const [playModes, setPlayModes] = useState<Set<PlayMode>>(() => new Set([PlayMode.normal]));
    const playModesRef = useRef(playModes);
    playModesRef.current = playModes;
    const [playModeSelectorRequest, setPlayModeSelectorRequest] = useState<number>();
    const playModeSelectorOpen = useRef(false);
    const rememberedPlaybackModesOverlayRequestedRef = useRef(false);
    const requestRememberedPlaybackModesOverlay = useCallback(() => {
        if (rememberedPlaybackModesOverlayRequestedRef.current) return;

        rememberedPlaybackModesOverlayRequestedRef.current = true;
        setPlayModeSelectorRequest((request) => (request ?? 0) + 1);
    }, []);
    const synchronizePlaybackModes = useCallback(
        (modes: ReadonlySet<PlayMode>) => {
            const synchronizedModes = new Set(modes);
            playModesRef.current = synchronizedModes;
            setPlayModes(synchronizedModes);
            playerChannel.playModes(synchronizedModes);
        },
        [playerChannel]
    );
    const [subtitlePlayerHidden, setSubtitlePlayerHidden] = useState<boolean>(false);
    const [appBarHidden, setAppBarHidden] = useState<boolean>(playbackPreferences.theaterMode);
    const [subtitleAlignments, setSubtitleAlignments] = useState<SubtitleAlignment[]>(
        allSubtitleAlignments(subtitleSettings)
    );
    const [, setBottomSubtitlePositionOffset] = useState<number>(subtitleSettings.subtitlePositionOffset);
    const [, setTopSubtitlePositionOffset] = useState<number>(subtitleSettings.topSubtitlePositionOffset);
    const showSubtitlesRef = useRef<IndexedSubtitleModel[]>([]);
    showSubtitlesRef.current = showSubtitles;
    const timelineShowingSubtitlesRef = useRef<readonly IndexedSubtitleModel[]>([]);
    const showingSubtitlesChangedRef = useRef<(subtitles: readonly IndexedSubtitleModel[]) => void>(() => {});
    const subtitleCollectionRef = useRef(subtitleCollection);
    subtitleCollectionRef.current = subtitleCollection;
    const clock = useMemo<Clock>(() => new Clock(() => performance.now()), []);
    const mousePositionRef = useRef<Point | undefined>(undefined);
    const [showCursor, setShowCursor] = useState<boolean>(isMobile);
    const lastMouseMovementTimestamp = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [alertOpen, setAlertOpen] = useState<boolean>(false);
    const [alertMessage, setAlertMessage] = useState<string>('');
    const [alertSeverity, setAlertSeverity] = useState<AlertColor>('info');
    const [alertDisableAutoHide, setAlertDisableAutoHide] = useState<boolean>(false);
    const [lastMinedRecord, setLastMinedRecord] = useState<MinedRecord>();
    const [trackCount, setTrackCount] = useState<number>(0);
    const [, forceRender] = useState<any>();
    const [mineIntervalStartTimestamp, setMineIntervalStartTimestamp] = useState<number>();
    const [blurOverlayVisible, setBlurOverlayVisible] = useState<boolean>(false);
    const handleBlurOverlayToggle = useCallback(() => setBlurOverlayVisible((v) => !v), []);
    const mobileOverlayRef = useRef<HTMLDivElement>(null);
    const bottomSubtitleContainerRef = useRef<HTMLDivElement>(null);
    const domCacheRef = useRef<OffscreenDomCache | undefined>(undefined);
    const refreshSubtitleDomCacheForSubtitlesRef = useRef<
        ((windowSubtitles: IndexedSubtitleModel[]) => void) | undefined
    >(undefined);
    const updateSubtitleDomCacheRef = useRef<((windowSubtitles: IndexedSubtitleModel[]) => void) | undefined>(
        undefined
    );
    const thumbnailsRef = useRef<Map<number, string>>(new Map()); // cache thumbnails, in intervals of 5s
    const isGeneratingRef = useRef(false); // avoid subsequent calls to generate thumbnail while generating one

    useEffect(() => {
        setMiscSettings(settings);
        setSubtitleSettings(settings);
        setAnkiSettings(settings);
    }, [settings]);

    useEffect(() => {
        setSubtitleAlignments(allSubtitleAlignments(subtitleSettings));
        setBottomSubtitlePositionOffset(subtitleSettings.subtitlePositionOffset);
        setTopSubtitlePositionOffset(subtitleSettings.topSubtitlePositionOffset);
    }, [subtitleSettings]);

    const keyBinder = useAppKeyBinder(miscSettings.keyBindSet, extension);

    useEffect(() => {
        if (i18n.language !== miscSettings.language) {
            void i18n.changeLanguage(miscSettings.language);
        }
    }, [miscSettings]);

    const updatePlayerState = useCallback(() => {
        const video = videoRef.current;

        if (!video) {
            return;
        }

        if (video.paused) {
            playerChannel.pause(false);
        } else {
            playerChannel.play(false);
        }

        playerChannel.playbackRate(video.playbackRate, false);
        playerChannel.currentTime(video.currentTime, false);
        forceRender({});

        if (!video.paused) {
            isPausedDueToHoverRef.current = false;
        }
    }, [playerChannel]);

    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    const notifyPlaybackRate = useCallback((options: { notify: boolean; playbackRate: number }) => {
        if (!options.notify) return;
        setAlertSeverity('info');
        const text = i18n.t('info.playbackRate', { rate: options.playbackRate.toFixed(1) });
        setAlertMessage(text);
        setAlertOpen(true);
    }, []);

    const updatePlaybackRate = useCallback(
        (playbackRate: number, forwardToPlayer: boolean) => {
            if (forwardToPlayer) playerChannel.playbackRate(playbackRate);
            const playbackEngine = playbackEngineRef.current;
            if (!playbackEngine) return;

            notifyPlaybackRate(playbackEngine.playbackRateChanged(playbackRate));
        },
        [notifyPlaybackRate, playerChannel]
    );
    const synchronizePlaybackModesRef = useRef(synchronizePlaybackModes);
    synchronizePlaybackModesRef.current = synchronizePlaybackModes;

    const handlePlaybackRateChanged = useCallback(
        (playbackRate: number) => {
            playerChannel.playbackRate(playbackRate, false);
            const playbackEngine = playbackEngineRef.current;
            if (!playbackEngine) return;

            notifyPlaybackRate(playbackEngine.playbackRateChanged(playbackRate));
        },
        [notifyPlaybackRate, playerChannel]
    );
    const handleDurationChanged = useCallback(
        (durationMs: number) => {
            setLengthMs(durationMs);
            playerChannel.duration(durationMs / 1000);
            playbackEngineRef.current?.durationChanged(durationMs);
        },
        [playerChannel]
    );

    const videoRefCallback = useCallback(
        (element: HTMLVideoElement | null) => {
            if (!element) {
                videoRef.current = undefined;
                setVideo(undefined);
                return;
            }
            if (element === videoRef.current) return;

            const videoElement = element as ExperimentalHTMLVideoElement;
            videoRef.current = videoElement;
            setVideo(videoElement);

            if (videoElement.readyState === 4) {
                notifyReady(videoElement, playerChannel, setAudioTracks, setSelectedAudioTrack);
                setVideoWidth(videoElement.videoWidth);
                setVideoHeight(videoElement.videoHeight);
            } else {
                videoElement.onloadeddata = () => {
                    notifyReady(videoElement, playerChannel, setAudioTracks, setSelectedAudioTrack);
                    setVideoWidth(videoElement.videoWidth);
                    setVideoHeight(videoElement.videoHeight);
                };
                videoElement.ondurationchange = () =>
                    notifyReady(videoElement, playerChannel, setAudioTracks, setSelectedAudioTrack);
            }

            videoElement.oncanplay = () => {
                playerChannel.readyState(4);

                if (playing()) {
                    clock.start();
                }
            };

            if (isMobile) videoElement.volume = 1; // Force volume to 1 on mobile - users can control device volume
        },
        [clock, playerChannel]
    );

    useEffect(() => {
        if (!video) return;

        const playbackEngine = new PlaybackEngine({
            settings: { ...settingsRef.current, ...miscSettingsRef.current },
            subtitles: subtitlesRef.current,
            ready: { settings: true },
            subtitleOffsetMs: offsetRef.current,
            playbackModesSuppressed: false,
            timingDriver: new VideoFrameTimingDriver(
                {
                    paused: () => video.paused,
                    playbackRate: () => video.playbackRate,
                    durationMs: () => video.duration * 1000,
                    currentTimeMs: () => video.currentTime * 1000,
                    frameTimestampMs: () => undefined,
                    requestVideoFrameCallback: (callback) => video.requestVideoFrameCallback(callback),
                    cancelVideoFrameCallback: (handle) => video.cancelVideoFrameCallback(handle),
                    addEventListener: (type, listener) => video.addEventListener(type, listener),
                    removeEventListener: (type, listener) => video.removeEventListener(type, listener),
                },
                {
                    onPlay: () => {
                        clock.start();
                        updatePlayerState();
                    },
                    onPause: () => {
                        clock.stop();
                        updatePlayerState();
                    },
                    onSeeked: (timestampMs) => {
                        clock.setTime(timestampMs); // rVFC may not run during pause
                        updatePlayerState();
                    },
                    onPlaybackRateChanged: handlePlaybackRateChanged,
                    onDurationChanged: handleDurationChanged,
                    onTimeUpdate: (timestampMs) => clock.setTime(timestampMs),
                    onError: () => onErrorRef.current?.(errorMessageFromVideo(video)),
                }
            ),
            callbacks: {
                pause: () => {
                    video.pause();
                    clock.stop();
                },
                play: async () => {
                    await video.play();
                    clock.start();
                },
                seek: async (timestampMs) => {
                    video.currentTime = timestampMs / 1000;
                    clock.setTime(timestampMs);
                },
                setPlaybackRate: (playbackRate) => {
                    if (video.playbackRate !== playbackRate) video.playbackRate = playbackRate;
                },
                showingSubtitlesChanged: (showingSubtitles) => showingSubtitlesChangedRef.current(showingSubtitles),
                saveSettings: (settings) => onSettingsChangedRef.current(settings),
                playbackModesChanged: (transition) => {
                    synchronizePlaybackModesRef.current(transition.modes);
                    if (!transition.added.size && !transition.removed.size) return;

                    const { notifications, join } = playbackModeNotifications(transition);
                    if (notifications.length) {
                        setAlertSeverity('info');
                        setAlertMessage(notifications.map((n) => t(n)).join(join));
                        setAlertOpen(true);
                    }
                    if (!playModeSelectorOpen.current) setPlayModeSelectorRequest((request) => (request ?? 0) + 1);
                },
                onError: (error) => onErrorRef.current?.(String(error)),
            },
        });

        playbackEngineRef.current = playbackEngine;
        playbackEngine.bind();

        return () => {
            playbackEngine.unbind();
            if (playbackEngineRef.current === playbackEngine) {
                playbackEngineRef.current = undefined;
            }
        };
    }, [clock, handleDurationChanged, handlePlaybackRateChanged, playerChannel, t, updatePlayerState, video]);

    function selectAudioTrack(id: string) {
        const audioTracks = videoRef.current?.audioTracks;

        if (!audioTracks) {
            return;
        }

        for (const t of audioTracks) {
            if (t.id === id) {
                t.enabled = true;
            } else {
                t.enabled = false;
            }
        }
    }

    const updateSubtitlesWithOffset = useCallback((offset: number) => {
        const previousOffset = offsetRef.current;
        offsetRef.current = offset;
        setOffset(offset);
        setAlertSeverity('info');
        const addedSign = offset >= 0 ? '+' : '';
        setAlertMessage(`${addedSign}${offset} ms`);
        setAlertOpen(true);

        if (offset === previousOffset) return;

        const shiftedSubtitles = subtitlesRef.current.map((s, i) => ({
            text: s.text,
            textImage: s.textImage,
            start: s.originalStart + offset,
            originalStart: s.originalStart,
            end: s.originalEnd + offset,
            originalEnd: s.originalEnd,
            track: s.track,
            index: i,
            tokenization: s.tokenization,
        }));
        subtitlesRef.current = shiftedSubtitles;
        setSubtitles(shiftedSubtitles);

        playbackEngineRef.current?.subtitleOffsetChanged(offset);
        showingSubtitlesChangedRef.current(timelineShowingSubtitlesRef.current);
    }, []);

    const togglePlaybackMode = useCallback((targetMode: PlayMode) => {
        playbackEngineRef.current?.togglePlaybackMode(targetMode);
    }, []);

    useEffect(() => {
        const playbackEngine = playbackEngineRef.current;
        if (!playerChannelSubscribed || !playbackEngine) return;
        playbackEngine.settingsChanged({ ...settings, ...miscSettings });
    }, [miscSettings, playerChannelSubscribed, settings, video]);

    useEffect(() => {
        const playbackEngine = playbackEngineRef.current;
        if (!playerChannelSubscribed || !playbackEngine) return;
        playbackEngine.subtitleOffsetChanged(offset);
    }, [offset, playerChannelSubscribed, video]);

    useEffect(() => {
        const playbackEngine = playbackEngineRef.current;
        if (!playerChannelSubscribed || !playbackEngine) return;
        playbackEngine.subtitlesChanged(subtitles);
    }, [playerChannelSubscribed, subtitles, video]);

    useEffect(() => {
        playerChannel.onReady((duration, videoFileName) => {
            setLengthMs(duration);
            setVideoFileName(videoFileName);
            if (miscSettingsRef.current.rememberPlaybackModes && hasEnabledPlaybackModes(playModesRef.current)) {
                requestRememberedPlaybackModesOverlay();
            }
        });

        playerChannel.onPlay(() => {
            void (async () => {
                await videoRef.current?.play();
                clock.start();
            })();
        });

        playerChannel.onPause(() => {
            videoRef.current?.pause();
            clock.stop();
        });

        playerChannel.onCurrentTime((currentTime) => {
            let actualCurrentTime = currentTime;

            if (videoRef.current) {
                actualCurrentTime = seekWithNudge(videoRef.current, currentTime);
            }

            if (videoRef.current?.readyState === 4) {
                playerChannel.readyState(4);
            }

            clock.stop();
            clock.setTime(actualCurrentTime * 1000);
        });

        playerChannel.onAudioTrackSelected((id) => {
            selectAudioTrack(id);
            setSelectedAudioTrack(id);
            playerChannel.audioTrackSelected(id);
        });

        playerChannel.onClose(() => {
            playerChannel.close();
            window.close();
        });

        playerChannel.onSubtitles((subtitles) => {
            const videoSubtitles = subtitles.map((s, i) => ({ ...s, index: i }));
            subtitlesRef.current = videoSubtitles;
            setSubtitles(videoSubtitles);
            setTrackCount(Math.max(...videoSubtitles.map((s) => s.track)) + 1);

            if (videoSubtitles.length > 0) {
                const s = videoSubtitles[0];
                const offset = s.start - s.originalStart;
                offsetRef.current = offset;
                setOffset(offset);
            }

            setShowSubtitles([]);
        });
        playerChannel.onSubtitlesUpdated((updatedSubtitles) => {
            updateSubtitleDomCacheRef.current?.(updatedSubtitles);

            const updatedByIndex = new Map(updatedSubtitles.map((s) => [s.index, s] as const));
            if (showSubtitlesRef.current.some((s) => updatedByIndex.has(s.index))) {
                setShowSubtitles((prevShowSubtitles) =>
                    prevShowSubtitles.map((showSubtitle) => {
                        const updatedShowSubtitle = updatedByIndex.get(showSubtitle.index);
                        if (!updatedShowSubtitle) return showSubtitle;
                        return {
                            ...showSubtitle,
                            text: updatedShowSubtitle.text,
                            tokenization: updatedShowSubtitle.tokenization,
                        };
                    })
                );
            }

            if (!subtitlesRef.current.length) return;
            const allSubtitles = subtitlesRef.current.slice();
            for (const s of updatedSubtitles) {
                allSubtitles[s.index] = {
                    ...allSubtitles[s.index],
                    text: s.text,
                    tokenization: s.tokenization,
                };
            }
            subtitlesRef.current = allSubtitles;
            setSubtitles(allSubtitles);
        });

        playerChannel.onPlayMode((targetMode) => togglePlaybackMode(targetMode));
        playerChannel.onHideSubtitlePlayerToggle((hidden) => setSubtitlePlayerHidden(hidden));
        playerChannel.onAppBarToggle((hidden) => setAppBarHidden(hidden));
        playerChannel.onFullscreenToggle((fullscreen) => requestFullscreen(fullscreen));
        playerChannel.onSubtitleSettings(setSubtitleSettings);
        playerChannel.onMiscSettings(setMiscSettings);
        playerChannel.onAnkiSettings(setAnkiSettings);
        playerChannel.onOffset(updateSubtitlesWithOffset);
        playerChannel.onPlaybackRate((playbackRate) => {
            updatePlaybackRate(playbackRate, false);
        });
        playerChannel.onAlert((message, severity) => {
            setAlertOpen(true);
            setAlertMessage(message);
            setAlertSeverity(severity as AlertColor);
        });

        window.onbeforeunload = () => {
            if (!poppingInRef.current) {
                playerChannel.close();
            }
        };

        setPlayerChannelSubscribed(true);
        playerChannel.playModes(playModesRef.current);
        return () => playerChannel.close();
    }, [
        clock,
        playerChannel,
        requestFullscreen,
        requestRememberedPlaybackModesOverlay,
        togglePlaybackMode,
        updateSubtitlesWithOffset,
        updatePlaybackRate,
    ]);

    const handlePlay = useCallback(() => {
        if (videoRef.current) {
            playerChannel.play();
        }
    }, [playerChannel]);

    const handlePause = useCallback(() => playerChannel.pause(), [playerChannel]);

    const handleSeek = useCallback(
        (progress: number) => {
            if (!Number.isFinite(lengthMs)) {
                return;
            }

            if (playing()) {
                clock.stop();
            }

            const time = progress * lengthMs;
            // get a screenshot of this time when hovered
            playerChannel.currentTime(time / 1000);
        },
        [lengthMs, clock, playerChannel]
    );

    const handleSeekPreview = useCallback(
        (progress: number): string | undefined => {
            if (!Number.isFinite(lengthMs)) {
                return;
            }

            if (!hiddenVideoRef.current) {
                return;
            }

            const time = progress * lengthMs;
            const video = hiddenVideoRef.current;

            const thumbnailKey = Math.floor(time / 1000 / 5);

            // cached url found, return url
            if (thumbnailsRef.current.has(thumbnailKey)) {
                return thumbnailsRef.current.get(thumbnailKey);
            }

            if (isGeneratingRef.current) return;
            // if not in cache, generate new one in the background
            isGeneratingRef.current = true;

            const onSeeked = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth * 0.7;
                canvas.height = video.videoHeight * 0.7;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

                const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
                thumbnailsRef.current.set(thumbnailKey, thumbnailUrl);
                isGeneratingRef.current = false;
            };

            video.addEventListener('seeked', onSeeked, { once: true });
            video.currentTime = time / 1000;

            return;
        },
        [lengthMs]
    );

    // load or unload preview thumbnail
    useEffect(() => {
        const videoPreview = hiddenVideoRef.current;

        if (!videoPreview) return;

        if (settings.thumbnailPreview) {
            videoPreview.src = videoFile;
            videoPreview.load();
        } else {
            videoPreview.pause();
            videoPreview.removeAttribute('src');
            videoPreview.load();
        }
    }, [settings.thumbnailPreview, videoFile, hiddenVideoReady]);

    const handleSeekByTimestamp = useCallback(
        (timestampMs: number) => {
            playerChannel.currentTime(timestampMs / 1000);
        },
        [playerChannel]
    );

    useEffect(() => {
        if (seekRequest !== undefined) {
            handleSeek(seekRequest.timestamp / lengthMs);
        }
    }, [handleSeek, seekRequest, lengthMs]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        lastMouseMovementTimestamp.current = Date.now();

        if (!containerRef.current) {
            return;
        }

        const bounds = containerRef.current.getBoundingClientRect();
        mousePositionRef.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
    }, []);

    const handleMouseLeave = useCallback(() => {
        mousePositionRef.current = undefined;
    }, []);

    const handleAudioTrackSelected = useCallback(
        (id: string) => {
            if (playing()) {
                clock.stop();
                playerChannel.pause();
            }

            selectAudioTrack(id);
            setSelectedAudioTrack(id);
            playerChannel.currentTime(0);
            playerChannel.audioTrackSelected(id);
        },
        [playerChannel, clock]
    );

    const handleLoadFiles = useCallback(() => {
        playerChannel.loadFiles();
    }, [playerChannel]);

    const handleLoadSubtitles = useCallback(() => {
        playerChannel.loadSubtitles();
    }, [playerChannel]);

    showingSubtitlesChangedRef.current = (timelineSubtitles) => {
        timelineShowingSubtitlesRef.current = timelineSubtitles;
        const showingSubtitles = timelineSubtitles
            .filter((subtitle) => !disabledSubtitleTracksRef.current[subtitle.track])
            .map((subtitle) => subtitlesRef.current[subtitle.index] ?? subtitle)
            .slice()
            .sort(compareSubtitlesForDisplay);
        if (arrayEquals(showingSubtitles, showSubtitlesRef.current, (left, right) => left === right)) {
            return;
        }

        showSubtitlesRef.current = showingSubtitles;
        setShowSubtitles(showingSubtitles);
        if (showingSubtitles.length > 0 && miscSettingsRef.current.autoCopyCurrentSubtitle && document.hasFocus()) {
            navigator.clipboard.writeText(showingSubtitles.map((subtitle) => subtitle.text).join('\n')).catch(() => {
                // ignore
            });
        }

        const nowMs =
            videoRef.current?.currentTime === undefined ? clock.time(lengthMs) : videoRef.current.currentTime * 1000;
        const collection = subtitleCollectionRef.current;
        const windowSubtitles = collection.subtitlesIn(
            nowMs - ANNOTATIONS_VIDEO_RENDER_BEHIND_MS,
            nowMs + ANNOTATIONS_VIDEO_RENDER_AHEAD_MS
        );
        if (!windowSubtitles.length) {
            const { lastShown, nextToShow } = collection.subtitlesAt(nowMs);
            for (const subtitle of lastShown ?? []) windowSubtitles.push(subtitle);
            for (const subtitle of nextToShow ?? []) windowSubtitles.push(subtitle);
        }
        refreshSubtitleDomCacheForSubtitlesRef.current?.(windowSubtitles);
    };

    useEffect(() => {
        showingSubtitlesChangedRef.current(timelineShowingSubtitlesRef.current);
    }, [disabledSubtitleTracks]);

    const handleOffsetChange = useCallback(
        (offset: number) => {
            updateSubtitlesWithOffset(offset);
            playerChannel.offset(offset);
        },
        [playerChannel, updateSubtitlesWithOffset]
    );

    const handlePlaybackRateChange = useCallback(
        (playbackRate: number) => {
            updatePlaybackRate(playbackRate, true);
        },
        [updatePlaybackRate]
    );

    useEffect(() => {
        return keyBinder.bindSeekToSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                playerChannel.currentTime(subtitle.start / 1000);
            },
            () => !videoRef.current,
            () => clock.time(lengthMs),
            () => subtitles,
            () => settings.seekableTracks
        );
    }, [keyBinder, playerChannel, subtitles, lengthMs, clock, settings]);

    useEffect(() => {
        return keyBinder.bindSeekToBeginningOfCurrentSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                playerChannel.currentTime(subtitle.start / 1000);

                if (settings.alwaysPlayOnSubtitleRepeat) {
                    playerChannel.play();
                }
            },
            () => !videoRef.current,
            () => clock.time(lengthMs),
            () => subtitles,
            () => settings.seekableTracks
        );
    }, [keyBinder, playerChannel, subtitles, lengthMs, clock, settings]);

    useEffect(() => {
        return keyBinder.bindSeekBackwardOrForward(
            (event, forward) => {
                event.preventDefault();
                const timestamp = clock.time(lengthMs);
                const seekDuration = miscSettings.seekDuration * 1000;

                if (forward) {
                    playerChannel.currentTime(Math.min(lengthMs / 1000, (timestamp + seekDuration) / 1000));
                } else {
                    playerChannel.currentTime(Math.max(0, (timestamp - seekDuration) / 1000));
                }
            },
            () => !videoRef.current
        );
    }, [keyBinder, playerChannel, lengthMs, clock, miscSettings]);

    const calculateSurroundingSubtitles = useCallback(
        (index: number) => {
            return surroundingSubtitles(
                subtitles,
                index,
                ankiSettings.surroundingSubtitlesCountRadius,
                ankiSettings.surroundingSubtitlesTimeRadius
            );
        },
        [subtitles, ankiSettings.surroundingSubtitlesCountRadius, ankiSettings.surroundingSubtitlesTimeRadius]
    );

    useEffect(() => {
        return keyBinder.bindAdjustOffset(
            (event, offset) => {
                event.preventDefault();
                handleOffsetChange(offset);
            },
            () => false,
            () => subtitles
        );
    }, [keyBinder, handleOffsetChange, subtitles]);

    useEffect(() => {
        return keyBinder.bindResetOffet(
            (event) => {
                event.preventDefault();
                handleOffsetChange(0);
            },
            () => false
        );
    }, [keyBinder, handleOffsetChange]);

    useEffect(() => {
        return keyBinder.bindAdjustPlaybackRate(
            (event, increase) => {
                const playbackEngine = playbackEngineRef.current;
                if (!playbackEngine) return;
                event.preventDefault();

                notifyPlaybackRate(
                    playbackEngine.adjustPlaybackRate(
                        increase ? miscSettings.speedChangeStep : -miscSettings.speedChangeStep
                    )
                );
            },
            () => false
        );
    }, [updatePlaybackRate, keyBinder, miscSettings, notifyPlaybackRate]);

    useEffect(() => {
        return keyBinder.bindToggleSubtitles(
            (event) => {
                event.preventDefault();
                setDisplaySubtitles(!displaySubtitles);
                playbackPreferences.displaySubtitles = !displaySubtitles;
            },
            () => false
        );
    }, [keyBinder, displaySubtitles, playbackPreferences]);

    useEffect(() => {
        return keyBinder.bindToggleSubtitleTrackInVideo(
            (event, track) => {
                event.preventDefault();
                setDisabledSubtitleTracks((tracks) => {
                    const newTracks = { ...tracks };
                    newTracks[track] = !tracks[track];
                    return newTracks;
                });
            },
            () => false
        );
    }, [keyBinder]);

    useEffect(() => {
        return keyBinder.bindAdjustSubtitlePositionOffset(
            (event, increase) => {
                const newSubtitleSettings = { ...subtitleSettings };

                event.preventDefault();
                if (increase) {
                    newSubtitleSettings.subtitlePositionOffset = subtitleSettings.subtitlePositionOffset + 20;
                } else {
                    newSubtitleSettings.subtitlePositionOffset = subtitleSettings.subtitlePositionOffset - 20;
                }

                onSettingsChanged(newSubtitleSettings);
                setSubtitleSettings(newSubtitleSettings);
            },
            () => false
        );
    }, [keyBinder, subtitleSettings, onSettingsChanged]);

    useEffect(() => {
        return keyBinder.bindAdjustTopSubtitlePositionOffset(
            (event, increase) => {
                const newSubtitleSettings = { ...subtitleSettings };

                event.preventDefault();
                if (increase) {
                    newSubtitleSettings.topSubtitlePositionOffset = subtitleSettings.topSubtitlePositionOffset + 20;
                } else {
                    newSubtitleSettings.topSubtitlePositionOffset = subtitleSettings.topSubtitlePositionOffset - 20;
                }

                onSettingsChanged(newSubtitleSettings);
                setSubtitleSettings(newSubtitleSettings);
            },
            () => false
        );
    }, [keyBinder, subtitleSettings, onSettingsChanged]);

    useEffect(() => {
        return keyBinder.bindToggleSubtitleTrackInList(
            (event, track) => {
                event.preventDefault();
                playerChannel.toggleSubtitleTrackInList(track);
            },
            () => false
        );
    }, [keyBinder, playerChannel]);

    useEffect(() => {
        return keyBinder.bindUnblurTrack(
            (event, targetTrack) => {
                event.preventDefault();
                let newSubtitleSettings = { ...subtitleSettings };

                for (let currentTrack = 0; currentTrack < trackCount; ++currentTrack) {
                    const originalValue = textSubtitleSettingsForTrack(subtitleSettings, currentTrack).subtitleBlur!;
                    const targetValue = currentTrack === targetTrack ? !originalValue : originalValue;
                    const change = changeForTextSubtitleSetting(
                        { subtitleBlur: targetValue },
                        newSubtitleSettings,
                        currentTrack
                    );
                    newSubtitleSettings = { ...newSubtitleSettings, ...change };
                }

                onSettingsChanged(newSubtitleSettings);
                setSubtitleSettings(newSubtitleSettings);
            },
            () => false
        );
    }, [keyBinder, subtitleSettings, trackCount, onSettingsChanged]);

    useEffect(() => {
        return keyBinder.bindOffsetToSubtitle(
            (event, offset) => {
                event.preventDefault();
                handleOffsetChange(offset);
            },
            () => false,
            () => clock.time(lengthMs),
            () => subtitles,
            () => miscSettings.seekableTracks
        );
    }, [keyBinder, handleOffsetChange, subtitles, clock, lengthMs, miscSettings.seekableTracks]);

    const extractSubtitles = useCallback(() => {
        if (!subtitles || subtitles.length === 0) {
            const timestamp = clock.time(lengthMs);
            const end = Math.min(timestamp + 5000, lengthMs);
            const currentSubtitle = {
                text: '',
                start: timestamp,
                originalStart: timestamp,
                end: end,
                originalEnd: end,
                track: 0,
            };

            return { currentSubtitle, surroundingSubtitles: mockSurroundingSubtitles(currentSubtitle, lengthMs, 5000) };
        } else if (showSubtitlesRef.current && showSubtitlesRef.current.length > 0) {
            const currentSubtitle = showSubtitlesRef.current[0];
            return { currentSubtitle, surroundingSubtitles: calculateSurroundingSubtitles(currentSubtitle.index) };
        }

        return undefined;
    }, [subtitles, calculateSurroundingSubtitles, lengthMs, clock]);

    const mineSubtitle = useCallback(
        (
            postMineAction: PostMineAction,
            videoFileUrl: string,
            videoFileName: string,
            selectedAudioTrack: string | undefined,
            playbackRate: number,
            subtitle: SubtitleModel,
            surroundingSubtitles: SubtitleModel[],
            cardTextFieldValues: CardTextFieldValues,
            timestamp: number
        ) => {
            switch (postMineAction) {
                case PostMineAction.showAnkiDialog:
                    playerChannel.copy(
                        subtitle,
                        surroundingSubtitles,
                        cardTextFieldValues,
                        videoFileName ?? '',
                        timestamp,
                        PostMineAction.none
                    );
                    onAnkiDialogRequest(
                        videoFileUrl,
                        videoFileName ?? '',
                        selectedAudioTrack,
                        playbackRate,
                        subtitle,
                        surroundingSubtitles,
                        cardTextFieldValues,
                        timestamp
                    );

                    if (playing()) {
                        playerChannel.pause();
                        setWasPlayingOnAnkiDialogRequest(true);
                    } else {
                        setWasPlayingOnAnkiDialogRequest(false);
                    }
                    break;
                default:
                    playerChannel.copy(
                        subtitle,
                        surroundingSubtitles,
                        cardTextFieldValues,
                        videoFileName ?? '',
                        timestamp,
                        postMineAction
                    );
            }

            setLastMinedRecord({
                videoFileUrl,
                videoFileName: videoFileName ?? '',
                selectedAudioTrack,
                playbackRate,
                subtitle,
                surroundingSubtitles,
                timestamp,
            });
        },
        [onAnkiDialogRequest, playerChannel]
    );

    const mineCurrentSubtitle = useCallback(
        (
            postMineAction: PostMineAction,
            subtitle?: SubtitleModel,
            surroundingSubtitles?: SubtitleModel[],
            cardTextFieldValues?: CardTextFieldValues
        ) => {
            const video = videoRef.current;

            if (!video) {
                return;
            }

            const currentTimestamp = clock.time(lengthMs);
            let mediaTimestamp: number;

            if (subtitle === undefined || surroundingSubtitles === undefined) {
                const extracted = extractSubtitles();

                if (extracted === undefined) {
                    return;
                }

                subtitle = extracted.currentSubtitle;
                surroundingSubtitles = extracted.surroundingSubtitles;
                mediaTimestamp = currentTimestamp;
            } else if (currentTimestamp >= subtitle.start && currentTimestamp <= subtitle.end) {
                mediaTimestamp = currentTimestamp;
            } else {
                mediaTimestamp = subtitleTimestampWithDelay(subtitle, settings.streamingScreenshotDelay);
            }

            mineSubtitle(
                postMineAction,
                videoFile,
                videoFileName ?? '',
                selectedAudioTrack,
                video.playbackRate,
                subtitle,
                surroundingSubtitles,
                cardTextFieldValues ?? {},
                mediaTimestamp
            );
        },
        [
            mineSubtitle,
            extractSubtitles,
            clock,
            settings.streamingScreenshotDelay,
            selectedAudioTrack,
            videoFile,
            videoFileName,
            lengthMs,
        ]
    );

    const toggleSelectMiningInterval = useCallback(
        (postMineAction: PostMineAction, cardTextFieldValues?: CardTextFieldValues) => {
            if (mineIntervalStartTimestamp === undefined) {
                setMineIntervalStartTimestamp(clock.time(lengthMs));

                if (!playing()) {
                    playerChannel.play();
                }

                if (!isMobile) {
                    setAlertSeverity('info');
                    setAlertMessage(t('info.manualMiningIntervalPrompt'));
                    setAlertDisableAutoHide(true);
                    setAlertOpen(true);
                }
            } else {
                setAlertDisableAutoHide(false);
                setAlertOpen(false);
                const video = videoRef.current;

                if (!video) {
                    return;
                }

                const endTimestamp = clock.time(lengthMs);

                if (endTimestamp > mineIntervalStartTimestamp) {
                    let currentSubtitle: SubtitleModel = {
                        text: '',
                        start: mineIntervalStartTimestamp,
                        originalStart: mineIntervalStartTimestamp,
                        end: endTimestamp,
                        originalEnd: endTimestamp,
                        track: 0,
                    };
                    let surroundingSubtitles: SubtitleModel[];

                    if (subtitles.length === 0) {
                        surroundingSubtitles = mockSurroundingSubtitles(currentSubtitle, lengthMs, 5000);
                    } else {
                        const calculated = surroundingSubtitlesAroundInterval(
                            subtitles,
                            mineIntervalStartTimestamp,
                            endTimestamp,
                            settings.surroundingSubtitlesCountRadius,
                            settings.surroundingSubtitlesTimeRadius
                        );
                        currentSubtitle = {
                            ...currentSubtitle,
                            text: calculated.subtitle?.text ?? '',
                        };
                        surroundingSubtitles = calculated.surroundingSubtitles ?? [];
                    }

                    mineSubtitle(
                        postMineAction,
                        videoFile,
                        videoFileName ?? '',
                        selectedAudioTrack,
                        video.playbackRate,
                        currentSubtitle,
                        surroundingSubtitles,
                        cardTextFieldValues ?? {},
                        mineIntervalStartTimestamp
                    );
                }

                setMineIntervalStartTimestamp(undefined);
            }
        },
        [
            t,
            mineSubtitle,
            playerChannel,
            mineIntervalStartTimestamp,
            clock,
            lengthMs,
            selectedAudioTrack,
            videoFile,
            videoFileName,
            subtitles,
            settings.surroundingSubtitlesCountRadius,
            settings.surroundingSubtitlesTimeRadius,
        ]
    );

    const inferAndExecuteMiningBehavior = useCallback(
        (
            postMineAction: PostMineAction,
            subtitle?: SubtitleModel,
            surroundingSubtitles?: SubtitleModel[],
            cardTextFieldValues?: CardTextFieldValues
        ) => {
            if (!subtitle && !surroundingSubtitles && subtitles.length === 0) {
                toggleSelectMiningInterval(postMineAction, cardTextFieldValues);
            } else {
                if (mineIntervalStartTimestamp !== undefined) {
                    // Edge case: user started manually recording but are now using an "automatic" mining shortcut
                    // Cancel the "recording" operation
                    setAlertDisableAutoHide(false);
                    setAlertOpen(false);
                    setMineIntervalStartTimestamp(undefined);
                }

                mineCurrentSubtitle(postMineAction, subtitle, surroundingSubtitles, cardTextFieldValues);
            }
        },
        [mineCurrentSubtitle, toggleSelectMiningInterval, mineIntervalStartTimestamp, subtitles]
    );

    useEffect(() => {
        return playerChannel.onCopy(inferAndExecuteMiningBehavior);
    }, [playerChannel, inferAndExecuteMiningBehavior]);

    useEffect(() => {
        return keyBinder.bindAnkiExport(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                inferAndExecuteMiningBehavior(PostMineAction.showAnkiDialog);
            },
            () => false
        );
    }, [inferAndExecuteMiningBehavior, keyBinder]);

    useEffect(() => {
        return miningContext.onEvent('stopped-mining', () => {
            switch (miscSettings.postMiningPlaybackState) {
                case PostMinePlayback.play:
                    playerChannel.play();
                    break;
                case PostMinePlayback.pause:
                    playerChannel.pause();
                    break;
                case PostMinePlayback.remember:
                    if (wasPlayingOnAnkiDialogRequest) {
                        playerChannel.play();
                    }
                    break;
            }
        });
    }, [miningContext, wasPlayingOnAnkiDialogRequest, miscSettings, playerChannel]);

    useEffect(() => {
        return keyBinder.bindUpdateLastCard(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                inferAndExecuteMiningBehavior(PostMineAction.updateLastCard);
            },
            () => false
        );
    }, [inferAndExecuteMiningBehavior, keyBinder]);

    useEffect(() => {
        return keyBinder.bindExportCard(
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                inferAndExecuteMiningBehavior(PostMineAction.exportCard);
            },
            () => false
        );
    }, [inferAndExecuteMiningBehavior, keyBinder]);

    useEffect(() => {
        return keyBinder.bindTakeScreenshot(
            (event) => {
                event.preventDefault();

                if (ankiDialogOpen) {
                    onAnkiDialogRewind();
                } else if (lastMinedRecord) {
                    const currentTimestamp = clock.time(lengthMs);
                    mineSubtitle(
                        PostMineAction.showAnkiDialog,
                        lastMinedRecord.videoFileUrl,
                        lastMinedRecord.videoFileName,
                        lastMinedRecord.selectedAudioTrack,
                        lastMinedRecord.playbackRate,
                        lastMinedRecord.subtitle,
                        lastMinedRecord.surroundingSubtitles,
                        {},
                        currentTimestamp
                    );
                }
            },
            () => false
        );
    }, [clock, lengthMs, keyBinder, lastMinedRecord, mineSubtitle, popOut, ankiDialogOpen, onAnkiDialogRewind]);

    useEffect(() => {
        return keyBinder.bindToggleRecording(
            (event) => {
                event.preventDefault();
                toggleSelectMiningInterval(PostMineAction.showAnkiDialog);
            },
            () => false
        );
    }, [keyBinder, toggleSelectMiningInterval]);

    useEffect(() => {
        return keyBinder.bindCopy(
            (event) => {
                event.preventDefault();
                inferAndExecuteMiningBehavior(PostMineAction.none);
            },
            () => false,
            () => {
                const extracted = extractSubtitles();

                if (extracted === undefined) {
                    return undefined;
                }

                return extracted.currentSubtitle;
            }
        );
    }, [extractSubtitles, inferAndExecuteMiningBehavior, keyBinder]);

    useEffect(() => {
        return keyBinder.bindPlay(
            (event) => {
                event.preventDefault();

                if (playing()) {
                    playerChannel.pause();
                } else {
                    playerChannel.play();
                }
            },
            () => false
        );
    }, [keyBinder, playerChannel]);

    useEffect(() => {
        return keyBinder.bindAutoPause(
            (event) => {
                event.preventDefault();
                togglePlaybackMode(PlayMode.autoPause);
            },
            () => false
        );
    }, [keyBinder, togglePlaybackMode]);

    useEffect(() => {
        return keyBinder.bindCondensedPlayback(
            (event) => {
                event.preventDefault();
                togglePlaybackMode(PlayMode.condensed);
            },
            () => false
        );
    }, [keyBinder, togglePlaybackMode]);

    useEffect(() => {
        return keyBinder.bindFastForwardPlayback(
            (event) => {
                event.preventDefault();
                togglePlaybackMode(PlayMode.fastForward);
            },
            () => false
        );
    }, [keyBinder, togglePlaybackMode]);

    useEffect(() => {
        return keyBinder.bindToggleRepeat(
            (event) => {
                event.preventDefault();
                togglePlaybackMode(PlayMode.repeat);
            },
            () => false
        );
    }, [keyBinder, togglePlaybackMode]);

    const handleSubtitlesToggle = useCallback(() => {
        setDisplaySubtitles(!displaySubtitles);
        playbackPreferences.displaySubtitles = !displaySubtitles;
    }, [displaySubtitles, playbackPreferences]);

    const handleFullscreenToggle = useCallback(() => {
        requestFullscreen(!fullscreen);
    }, [fullscreen, requestFullscreen]);

    const handleVolumeChange = useCallback((volume: number) => {
        if (videoRef.current) {
            videoRef.current.volume = volume;
        }
    }, []);

    const handlePopOutToggle = useCallback(() => {
        playerChannel.popOutToggle();
        if (popOut) {
            poppingInRef.current = true;
            window.close();
        }
    }, [playerChannel, popOut]);

    const handlePlayMode = useCallback((targetMode: PlayMode) => togglePlaybackMode(targetMode), [togglePlaybackMode]);

    const handlePlayModeSelectorOpened = useCallback(() => {
        playModeSelectorOpen.current = true;
    }, []);

    const handlePlayModeSelectorClosed = useCallback(() => {
        playModeSelectorOpen.current = false;
    }, []);

    const handleMobilePlayModeSelectorClosed = useCallback(() => {
        handlePlayModeSelectorClosed();
        setPlayModeSelectorRequest(undefined);
    }, [handlePlayModeSelectorClosed]);

    const handleClose = useCallback(() => {
        playerChannel.close();
        window.close();
    }, [playerChannel]);

    const handleHideSubtitlePlayerToggle = useCallback(() => {
        playerChannel.hideSubtitlePlayerToggle();
    }, [playerChannel]);

    const handleTheaterModeToggle = useCallback(() => {
        playerChannel.appBarToggle();
    }, [playerChannel]);

    const handleSubtitleAlignment = useCallback(
        (alignment: SubtitleAlignment) => {
            let change: Partial<SubtitleSettings> = {};

            for (let track = 0; track < subtitleAlignments.length; ++track) {
                change = {
                    ...change,
                    ...changeForTextSubtitleSetting({ subtitleAlignment: alignment }, subtitleSettings, track),
                };
            }

            const newSubtitleSettings = { ...subtitleSettings, ...change };
            setSubtitleAlignments([alignment]);
            onSettingsChanged(newSubtitleSettings);
            setSubtitleSettings(newSubtitleSettings);
        },
        [onSettingsChanged, subtitleSettings, subtitleAlignments]
    );

    const handleClick = useCallback(() => {
        if (playing()) {
            playerChannel.pause();
        } else {
            playerChannel.play();
        }
    }, [playerChannel]);

    const handleDoubleClick = useCallback(() => handleFullscreenToggle(), [handleFullscreenToggle]);

    useEffect(() => {
        if (isMobile) {
            return;
        }

        const interval = setInterval(() => {
            if (Date.now() - lastMouseMovementTimestamp.current > 300) {
                if (showCursor) {
                    setShowCursor(false);
                }
            } else if (!showCursor) {
                setShowCursor(true);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [showCursor]);

    const handleAlertClosed = useCallback(() => {
        setAlertDisableAutoHide(false);
        setAlertOpen(false);
    }, []);
    const trackStyles = useSubtitleStyles(subtitleSettings, trackCount ?? 1, settings.dictionaryTracks, 'video');

    const getSubtitleHtml = useCallback(
        (subtitle: IndexedSubtitleModel) =>
            showingSubtitleHtml(
                subtitle,
                videoRef,
                trackStyles[subtitle.track]?.styleString ?? trackStyles[0]?.styleString ?? '',
                trackStyles[subtitle.track]?.classes ?? trackStyles[0]?.classes ?? '',
                subtitleSettings.imageBasedSubtitleScaleFactor,
                settings.dictionaryTracks
            ),
        [trackStyles, settings.dictionaryTracks, subtitleSettings.imageBasedSubtitleScaleFactor]
    );

    const { getSubtitleDomCache, refreshSubtitleDomCacheForSubtitles, updateSubtitleDomCache } = useSubtitleDomCache(
        subtitles,
        getSubtitleHtml
    );

    domCacheRef.current = getSubtitleDomCache();
    refreshSubtitleDomCacheForSubtitlesRef.current = refreshSubtitleDomCacheForSubtitles;
    updateSubtitleDomCacheRef.current = updateSubtitleDomCache;

    const handleSwipe = useCallback(
        (direction: Direction) => {
            const subtitle = adjacentSubtitle(
                direction === 'right',
                clock.time(lengthMs),
                subtitles,
                miscSettings.seekableTracks
            );
            if (subtitle) {
                playerChannel.currentTime(subtitle.start / 1000);
            }
        },
        [clock, lengthMs, subtitles, playerChannel, miscSettings.seekableTracks]
    );

    useSwipe({
        onSwipe: handleSwipe,
        distance: 50,
        ms: 500,
    });

    const isPausedDueToHoverRef = useRef<boolean>(undefined);

    const hoveredToken = useMemo(() => new HoveredToken(), []);

    const handleSubtitleMouseOver = useCallback(
        (e: React.MouseEvent) => {
            if (miscSettings.pauseOnHoverMode !== PauseOnHoverMode.disabled && videoRef.current?.paused === false) {
                playerChannel.pause();
                isPausedDueToHoverRef.current = true;
            }
            hoveredToken.handleMouseOver(e.nativeEvent);
        },
        [hoveredToken, miscSettings.pauseOnHoverMode, playerChannel]
    );

    const handleSubtitleMouseOut = useCallback(
        (e: React.MouseEvent) => hoveredToken.handleMouseOut(e.nativeEvent),
        [hoveredToken]
    );

    useEffect(() => {
        return keyBinder.bindMarkHoveredToken(
            (event, tokenStatus) => {
                const res = hoveredToken.parse();
                if (!res) return;
                void ensureStoragePersisted();
                event.preventDefault();
                event.stopImmediatePropagation();
                playerChannel.saveTokenLocal(res.track, res.token, tokenStatus, [], ApplyStrategy.ADD);
            },
            () => false
        );
    }, [hoveredToken, keyBinder, playerChannel]);

    useEffect(() => {
        return keyBinder.bindToggleHoveredTokenIgnored(
            (event) => {
                const res = hoveredToken.parse();
                if (!res) return;
                void ensureStoragePersisted();
                event.preventDefault();
                event.stopImmediatePropagation();
                playerChannel.saveTokenLocal(res.track, res.token, null, [TokenState.IGNORED], ApplyStrategy.TOGGLE);
            },
            () => false
        );
    }, [hoveredToken, keyBinder, playerChannel]);

    const inBetweenMobileOverlayAndBottomSubtitles = (e: React.MouseEvent<HTMLVideoElement>) => {
        if (!mobileOverlayRef.current || !bottomSubtitleContainerRef.current || !videoRef.current) {
            return;
        }

        const mobileOverlayRect = mobileOverlayRef.current.getBoundingClientRect();
        const subtitleContainerRect = bottomSubtitleContainerRef.current.getBoundingClientRect();
        const videoRect = videoRef.current.getBoundingClientRect();
        const bottom = videoRect.height + videoRect.y;
        const top = subtitleContainerRect.y;
        const left = Math.min(subtitleContainerRect.x, mobileOverlayRect.x);
        const right = Math.max(
            subtitleContainerRect.x + subtitleContainerRect.width,
            mobileOverlayRect.x + mobileOverlayRect.width
        );
        return e.clientY <= bottom && e.clientY >= top && e.clientX >= left && e.clientX <= right;
    };

    const handleVideoMouseOver = useCallback(
        (e: React.MouseEvent<HTMLVideoElement>) => {
            if (
                miscSettings.pauseOnHoverMode === PauseOnHoverMode.inAndOut &&
                isPausedDueToHoverRef.current &&
                !inBetweenMobileOverlayAndBottomSubtitles(e)
            ) {
                playerChannel.play();
                isPausedDueToHoverRef.current = false;
            }
        },
        [miscSettings.pauseOnHoverMode, playerChannel]
    );

    const { lastControlType, setLastControlType } = useLastScrollableControlType({
        isMobile,
        fetchLastControlType,
        saveLastControlType,
    });

    // If the video player is taking up the entire screen, then the subtitle player isn't showing
    // This code assumes some behavior in Player, namely that the subtitle player is automatically hidden
    // (and therefore the VideoPlayer takes up all the space) when there isn't enough room for the subtitle player
    // to be displayed.
    const notEnoughRoomForSubtitlePlayer =
        !subtitlePlayerHidden &&
        parent?.document?.body !== undefined &&
        parent.document.body.clientWidth === document.body.clientWidth;

    const subtitleAlignmentForTrack = (track: number) => subtitleAlignments[track] ?? subtitleAlignments[0];
    const elementForSubtitle = (subtitle: IndexedSubtitleModel) => (
        <CachedShowingSubtitle
            key={subtitle.index}
            subtitle={subtitle}
            domCache={domCacheRef.current ?? getSubtitleDomCache()}
            renderHtml={getSubtitleHtml}
            onMouseOver={handleSubtitleMouseOver}
            onMouseOut={handleSubtitleMouseOut}
        />
    );

    const subtitleElementsWithAlignment = (alignment: SubtitleAlignment) =>
        showSubtitles.filter((s) => subtitleAlignmentForTrack(s.track) === alignment).map(elementForSubtitle);
    const topSubtitleElements = displaySubtitles ? subtitleElementsWithAlignment('top') : [];
    const bottomSubtitleElements = displaySubtitles ? subtitleElementsWithAlignment('bottom') : [];
    const mobileOverlayModel = () => {
        if (
            playModeSelectorRequest === undefined &&
            (!isMobile || (playing() && mineIntervalStartTimestamp === undefined))
        ) {
            return undefined;
        }

        const timestamp = clock.time(lengthMs);

        return {
            offset,
            playbackRate: videoRef.current?.playbackRate ?? 1,
            emptySubtitleTrack: subtitles.length === 0,
            recordingEnabled: true,
            recording: mineIntervalStartTimestamp !== undefined,
            previousSubtitleTimestamp:
                adjacentSubtitle(false, timestamp, subtitles, miscSettings.seekableTracks)?.originalStart ?? undefined,
            nextSubtitleTimestamp:
                adjacentSubtitle(true, timestamp, subtitles, miscSettings.seekableTracks)?.originalStart ?? undefined,
            currentTimestamp: timestamp,
            postMineAction: settings.clickToMineDefaultAction,
            subtitleDisplaying: showSubtitles.length > 0,
            subtitlesAreVisible: displaySubtitles,
            playModes: Array.from(playModes),
            playModeSelectorRequest,
            themeType: settings.themeType,
        };
    };
    const baseBottomSubtitleOffset = !playing() && isMobile ? overlayContainerHeight : 0;
    const alertAnchor = subtitleAlignments[0] === 'top' ? 'bottom' : 'top';

    if (!playerChannelSubscribed || lastControlType === undefined) {
        return null;
    }

    return (
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`${classes.root} asbplayer-token-container`}
            tabIndex={-1}
        >
            <Alert
                open={alertOpen}
                disableAutoHide={alertDisableAutoHide}
                onClose={handleAlertClosed}
                autoHideDuration={3000}
                severity={alertSeverity}
                anchor={alertAnchor}
            >
                {alertMessage}
            </Alert>
            <MobileVideoOverlay
                ref={mobileOverlayRef}
                model={mobileOverlayModel()}
                className={classes.mobileOverlay}
                anchor="bottom"
                tooltipsEnabled={true}
                initialControlType={lastControlType}
                onScrollToControlType={setLastControlType}
                onMineSubtitle={() => inferAndExecuteMiningBehavior(settings.clickToMineDefaultAction)}
                onOffset={handleOffsetChange}
                onPlaybackRate={handlePlaybackRateChange}
                onPlayModeSelected={handlePlayMode}
                onSeek={handleSeekByTimestamp}
                onToggleSubtitles={handleSubtitlesToggle}
                onPlayModeSelectorOpened={handlePlayModeSelectorOpened}
                playModeSelectorRequest={playModeSelectorRequest}
                onPlayModeSelectorClosed={handleMobilePlayModeSelectorClosed}
            />
            <video
                preload="auto"
                controls={false}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                className={showCursor ? classes.video : `${classes.cursorHidden} ${classes.video}`}
                ref={videoRefCallback}
                src={videoFile}
                onMouseOver={handleVideoMouseOver}
            />
            {/* Optional blur mask overlay; constrained to the video bounds within the player container */}
            {blurOverlayVisible && <BlurOverlay anchorRef={containerRef} containerRef={videoRef} />}
            {/* this video is for getting the seek preview below */}
            {miscSettings.thumbnailPreview && (
                <video
                    src={videoFile}
                    muted
                    preload="none"
                    autoPlay={false}
                    style={{ position: 'absolute', left: '-9999px' }}
                    ref={(node) => {
                        hiddenVideoRef.current = node;
                        if (node) {
                            setHiddenVideoReady(true);
                        }
                    }}
                />
            )}
            {topSubtitleElements.length > 0 && (
                <SubtitleContainer
                    alignment={'top'}
                    subtitleSettings={subtitleSettings}
                    baseOffset={0}
                    subtitleZIndex={settings.subtitleAboveThumbnail}
                >
                    {topSubtitleElements}
                </SubtitleContainer>
            )}
            {bottomSubtitleElements.length > 0 && (
                <SubtitleContainer
                    ref={bottomSubtitleContainerRef}
                    alignment={'bottom'}
                    subtitleSettings={subtitleSettings}
                    baseOffset={baseBottomSubtitleOffset}
                    subtitleZIndex={settings.subtitleAboveThumbnail}
                >
                    {bottomSubtitleElements}
                </SubtitleContainer>
            )}
            <Controls
                videoWidth={videoWidth}
                videoHeight={videoHeight}
                mousePositionRef={mousePositionRef}
                clock={clock}
                length={lengthMs}
                audioTracks={audioTracks}
                selectedAudioTrack={selectedAudioTrack}
                subtitlesToggle={subtitles && subtitles.length > 0}
                subtitlesEnabled={displaySubtitles}
                offsetEnabled={true}
                offset={offset}
                playbackRate={videoRef.current?.playbackRate ?? 1}
                playbackRateEnabled={true}
                fullscreenEnabled={true}
                fullscreen={fullscreen}
                closeEnabled={!popOut}
                popOut={popOut}
                volumeEnabled={true}
                popOutEnabled={!isMobile}
                playModeEnabled={subtitles && subtitles.length > 0}
                playModes={playModes}
                previewEnabled={settings.thumbnailPreview}
                hideSubtitlePlayerToggleEnabled={
                    subtitles?.length > 0 && !popOut && !fullscreen && !notEnoughRoomForSubtitlePlayer
                }
                subtitlePlayerHidden={subtitlePlayerHidden}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onSeekPreview={handleSeekPreview}
                onAudioTrackSelected={handleAudioTrackSelected}
                onSubtitlesToggle={handleSubtitlesToggle}
                onFullscreenToggle={handleFullscreenToggle}
                onVolumeChange={handleVolumeChange}
                onOffsetChange={handleOffsetChange}
                onPlaybackRateChange={handlePlaybackRateChange}
                onPopOutToggle={handlePopOutToggle}
                onPlayMode={handlePlayMode}
                onPlayModeSelectorOpened={handlePlayModeSelectorOpened}
                onPlayModeSelectorClosed={handlePlayModeSelectorClosed}
                onClose={handleClose}
                onHideSubtitlePlayerToggle={handleHideSubtitlePlayerToggle}
                playbackPreferences={playbackPreferences}
                showOnMouseMovement={false}
                theaterModeToggleEnabled={!popOut && !fullscreen}
                theaterModeEnabled={appBarHidden}
                onTheaterModeToggle={handleTheaterModeToggle}
                subtitleAlignment={subtitleAlignments[0]}
                subtitleAlignmentEnabled={subtitleAlignments.length === 1}
                onSubtitleAlignment={handleSubtitleAlignment}
                hideToolbar={isMobile}
                onLoadFiles={popOut ? undefined : handleLoadFiles}
                onLoadSubtitles={popOut ? undefined : handleLoadSubtitles}
                blurOverlayEnabled={blurOverlayVisible}
                onBlurOverlayToggle={handleBlurOverlayToggle}
                timestampPreviewEnabled={!isMobile}
            />
        </div>
    );
}
