import React, { useEffect, useState, useMemo, useCallback, useRef, useImperativeHandle, MutableRefObject } from 'react';
import { makeStyles } from '@mui/styles';
import { type Theme } from '@mui/material';
import { v4 as uuidv4 } from 'uuid';
import {
    AudioTrackModel,
    CardModel,
    CardTextFieldValues,
    AutoPausePreference,
    IndexedSubtitleModel,
    PlayMode,
    PostMineAction,
    PostMinePlayback,
    RequestSubtitlesResponse,
    SubtitleModel,
    DisplaySubtitleModel,
    TokenizedSubtitleModel,
    VideoTabModel,
} from '@project/common';
import {
    ApplyStrategy,
    AsbplayerSettings,
    isTrackAutoCopyable,
    SettingsProvider,
    TokenState,
    VideoSubtitleSplitBehavior,
} from '@project/common/settings';
import { DictionaryProvider } from '@project/common/dictionary-db';
import { SubtitleCollection } from '@project/common/subtitle-collection';
import { HoveredToken, SubtitleAnnotations } from '@project/common/annotations';
import { SubtitleReader } from '@project/common/subtitle-reader';
import { KeyBinder } from '@project/common/key-binder';
import { clampMediaTimestamp, download, surroundingSubtitles, timeDurationDisplay } from '@project/common/util';
import BroadcastChannelVideoProtocol from '../services/broadcast-channel-video-protocol';
import ChromeTabVideoProtocol from '../services/chrome-tab-video-protocol';
import Clock from '@project/common/playback/clock';
import Controls, { Point } from './Controls';
import Grid from '@mui/material/Grid';
import MediaAdapter from '../services/media-adapter';
import SubtitlePlayer, { minSubtitlePlayerWidth } from './SubtitlePlayer';
import VideoChannel from '../services/video-channel';
import ChromeExtension from '../services/chrome-extension';
import PlaybackPreferences from '../services/playback-preferences';
import { useWindowSize } from '../hooks/use-window-size';
import { useAppBarHeight } from '../../hooks/use-app-bar-height';
import { createBlobUrl } from '../../blob-url';
import { MiningContext } from '../services/mining-context';
import { SeekTimestampCommand, WebSocketClient } from '../../web-socket-client';
import { ensureStoragePersisted } from '../../util';
import { resolveVideoSubtitleSplitLayout, useVideoAspectRatio } from './video-subtitle-split';
import { FileWithId } from '../../file-selector';
import AnimationFrameTimingDriver from '@project/common/playback/animation-frame-timing-driver';
import PlaybackEngine from '@project/common/playback/playback-engine';
import {
    buildPlaybackTimelineExportPlan,
    type PlaybackTimelineModeLabels,
    type PlaybackTimelineOptionLabels,
    playbackTimelineSettingsSummary,
    playbackTimelineToHtml,
} from '@project/common/playback/playback-timeline-html';
import { createTheme } from '../../theme/theme';

const minVideoPlayerWidth = 300;
const subtitleCollectionOptions = { returnLastShown: true, returnNextToShow: true, showingCheckRadiusMs: 150 };
interface StylesProps {
    appBarHidden: boolean;
    appBarHeight: number;
}

const useStyles = makeStyles<Theme, StylesProps>(() => ({
    root: ({ appBarHidden, appBarHeight }) => ({
        height: appBarHidden ? '100vh' : `calc(100vh - ${appBarHeight}px)`,
        position: 'relative',
        overflowX: 'hidden',
    }),
    container: {
        width: '100%',
        height: '100%',
    },
    videoFrame: {
        width: '100%',
        height: '100%',
        border: 0,
        display: 'block',
    },
}));

function trackLengthMs(videoDuration: number | undefined, subtitles: SubtitleModel[] | undefined): number {
    let subtitlesLength;
    if (subtitles && subtitles.length > 0) {
        subtitlesLength = subtitles[subtitles.length - 1].originalEnd;
    } else {
        subtitlesLength = 0;
    }

    const videoLength = videoDuration ? 1000 * videoDuration : 0;
    return Math.max(videoLength, subtitlesLength);
}

function subtitlesForPlayer<T extends IndexedSubtitleModel>(subtitles: T[]): T[] {
    return subtitles.map((subtitle) => ({ ...subtitle }));
}

function pause(clock: Clock, mediaAdapter: MediaAdapter, forwardToMedia: boolean) {
    clock.stop();

    if (forwardToMedia) {
        mediaAdapter.pause();
    }
}

export interface MediaSources {
    subtitleFiles: FileWithId[];
    flattenSubtitleFiles?: boolean;
    videoFile?: FileWithId;
    videoFileUrl?: string;
}

interface PlayerProps {
    sources?: MediaSources;
    subtitles: DisplaySubtitleModel[];
    mediaId?: string;
    subtitleReader: SubtitleReader;
    dictionaryProvider: DictionaryProvider;
    settingsProvider: SettingsProvider;
    settings: AsbplayerSettings;
    playbackPreferences: PlaybackPreferences;
    keyBinder: KeyBinder;
    extension: ChromeExtension;
    videoFrameRef?: MutableRefObject<HTMLIFrameElement | null>;
    videoChannelRef?: MutableRefObject<VideoChannel | null>;
    drawerOpen: boolean;
    appBarHidden: boolean;
    showCopyButton: boolean;
    videoFullscreen: boolean;
    hideSubtitlePlayer: boolean;
    videoPopOut: boolean;
    tab?: VideoTabModel;
    availableTabs: VideoTabModel[];
    miningContext: MiningContext;
    origin: string;
    statisticsOverlay?: React.ReactNode;
    onError: (error: any) => void;
    onUnloadVideo: (url: string) => void;
    onCopy: (card: CardModel, postMineAction: PostMineAction | undefined, id: string | undefined) => void;
    onLoaded: (file: File[]) => void;
    onTabSelected: (tab: VideoTabModel) => void;
    onAnkiDialogRequest: () => void;
    onAnkiDialogRewind: () => void;
    onAppBarToggle: () => void;
    onHideSubtitlePlayer: () => void;
    onVideoPopOut: () => void;
    onSubtitles: React.Dispatch<React.SetStateAction<DisplaySubtitleModel[] | undefined>>;
    onLoadFiles?: () => void;
    onLoadSubtitles?: () => void;
    disableKeyEvents: boolean;
    jumpToSubtitle?: SubtitleModel;
    onJumpToSubtitleHandled?: () => void;
    rewindSubtitle?: SubtitleModel;
    hideControls?: boolean;
    forceCompressedMode?: boolean;
    webSocketClient?: WebSocketClient;
    playbackTimelineFileName?: string;
    playbackTimelineModeLabels: PlaybackTimelineModeLabels;
    playbackTimelineOptionLabels: PlaybackTimelineOptionLabels;
}

export interface PlayerRef {
    downloadSubtitleTimeline: () => void;
}

const Player = React.memo(React.forwardRef<PlayerRef, PlayerProps>(PlayerComponent));

function PlayerComponent(
    {
        sources,
        subtitles,
        mediaId,
        subtitleReader,
        dictionaryProvider,
        settingsProvider,
        settings,
        playbackPreferences,
        keyBinder,
        extension,
        videoFrameRef,
        videoChannelRef,
        drawerOpen,
        appBarHidden,
        showCopyButton,
        videoFullscreen,
        hideSubtitlePlayer,
        videoPopOut,
        tab,
        availableTabs,
        miningContext,
        origin,
        statisticsOverlay,
        onError,
        onUnloadVideo,
        onCopy,
        onLoaded,
        onTabSelected,
        onAnkiDialogRequest,
        onAppBarToggle,
        onHideSubtitlePlayer,
        onVideoPopOut,
        onSubtitles,
        onLoadFiles,
        onLoadSubtitles,
        disableKeyEvents,
        jumpToSubtitle,
        onJumpToSubtitleHandled,
        rewindSubtitle,
        hideControls,
        forceCompressedMode,
        webSocketClient,
        playbackTimelineFileName,
        playbackTimelineModeLabels,
        playbackTimelineOptionLabels,
    }: PlayerProps,
    ref: React.ForwardedRef<PlayerRef>
) {
    const [playModes, setPlayModes] = useState<Set<PlayMode>>(() => new Set([PlayMode.normal]));
    const playModesRef = useRef<Set<PlayMode>>(playModes);
    playModesRef.current = playModes;
    const [subtitlesSentThroughChannel, setSubtitlesSentThroughChannel] = useState<boolean>();
    const subtitlesRef = useRef<DisplaySubtitleModel[]>(undefined);
    subtitlesRef.current = subtitles;
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const [subtitleCollection, setSubtitleCollection] = useState<
        SubtitleAnnotations | SubtitleCollection<DisplaySubtitleModel>
    >(SubtitleCollection.empty<DisplaySubtitleModel>());
    const subtitleCollectionRef = useRef<SubtitleAnnotations | SubtitleCollection<DisplaySubtitleModel>>(
        subtitleCollection
    );
    subtitleCollectionRef.current = subtitleCollection;

    const subtitleFiles = sources?.subtitleFiles;
    const flattenSubtitleFiles = sources?.flattenSubtitleFiles;
    const videoFile = sources?.videoFile;
    const videoFileUrl = sources?.videoFileUrl;
    const syntheticPlayback = videoFileUrl === undefined && tab === undefined;
    const playModeEnabled = subtitles && subtitles.length > 0 && Boolean(videoFileUrl);
    const [subtitlePlayerResizing, setSubtitlePlayerResizing] = useState<boolean>(false);
    const [loadingSubtitles, setLoadingSubtitles] = useState<boolean>(false);
    const [lastJumpToTopTimestamp, setLastJumpToTopTimestamp] = useState<number>(0);
    const [offset, setOffset] = useState<number>(0);
    const [playbackRate, setPlaybackRate] = useState<number>(settings.playbackRate);
    const [audioTracks, setAudioTracks] = useState<AudioTrackModel[]>();
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>();
    const [channelId, setChannelId] = useState<string>();
    const [channel, setChannel] = useState<VideoChannel>();
    const videoDurationRef = useRef<number>(0);
    const channelRef = useRef<VideoChannel>(undefined);
    channelRef.current = channel;
    const playbackPreferencesRef = useRef<PlaybackPreferences>(undefined);
    playbackPreferencesRef.current = playbackPreferences;
    const [wasPlayingWhenMiningStarted, setWasPlayingWhenMiningStarted] = useState<boolean>();
    const hideSubtitlePlayerRef = useRef<boolean>(undefined);
    hideSubtitlePlayerRef.current = hideSubtitlePlayer;
    const [disabledSubtitleTracks, setDisabledSubtitleTracks] = useState<{ [track: number]: boolean }>({});
    const mousePositionRef = useRef<Point>({ x: 0, y: 0 });
    const mediaAdapter = useMemo(() => {
        if (videoFileUrl || tab) {
            return new MediaAdapter({ current: channel });
        }

        return new MediaAdapter({ current: undefined });
    }, [channel, videoFileUrl, tab]);
    const clock = useMemo<Clock>(() => new Clock(() => performance.now()), []);
    const clockRef = useRef<Clock>(clock);
    clockRef.current = clock;
    const syntheticPlaybackEngineRef = useRef<PlaybackEngine<DisplaySubtitleModel>>(undefined);
    const [syntheticShowingSubtitles, setSyntheticShowingSubtitles] = useState<readonly DisplaySubtitleModel[]>([]);
    const appBarHeight = useAppBarHeight();
    const classes = useStyles({ appBarHidden, appBarHeight });
    const calculateLengthMs = (videoDurationRef: MutableRefObject<number>, playerSubtitles = subtitlesRef.current) =>
        trackLengthMs(videoDurationRef.current, playerSubtitles);

    const handleDownloadSubtitleTimeline = useCallback(() => {
        const displaySubtitles = subtitlesRef.current ?? [];
        const timelineSettingsSummary = playbackTimelineSettingsSummary(settings, playbackTimelineOptionLabels);
        const timelineTracks = [...new Set(displaySubtitles.map((subtitle) => subtitle.track))]
            .sort((left, right) => left - right)
            .map((track) => ({
                track,
                label: playbackTimelineOptionLabels.subtitleTrack(track + 1),
            }));
        const selectedTrack = timelineTracks[0]?.track;
        const playbackSubtitles =
            selectedTrack === undefined ? [] : displaySubtitles.filter((subtitle) => subtitle.track === selectedTrack);
        const currentPlayModes = playModesRef.current;
        const playbackPlan = buildPlaybackTimelineExportPlan({
            subtitles: playbackSubtitles,
            durationMs: calculateLengthMs(videoDurationRef, displaySubtitles),
            settings,
            playbackRate,
        });
        const title = playbackTimelineFileName ?? 'Subtitle playback timeline';
        download(
            new Blob(
                [
                    playbackTimelineToHtml({
                        plan: playbackPlan,
                        themeColor: createTheme(settings.themeType).palette.primary.main,
                        title,
                        modeLabels: playbackTimelineModeLabels,
                        timelineOptionsTitle: timelineSettingsSummary.title,
                        timelineOptions: timelineSettingsSummary.options,
                        timelineSettings: timelineSettingsSummary.settings,
                        timelineTracks,
                        initialModeVisibility: {
                            normal: currentPlayModes.has(PlayMode.normal),
                            fastForward: currentPlayModes.has(PlayMode.fastForward),
                            condensed: currentPlayModes.has(PlayMode.condensed),
                            autoPauseAtStart:
                                currentPlayModes.has(PlayMode.autoPause) &&
                                settings.autoPausePreference !== AutoPausePreference.atEnd,
                            autoPauseAtEnd:
                                currentPlayModes.has(PlayMode.autoPause) &&
                                settings.autoPausePreference !== AutoPausePreference.atStart,
                            repeat: currentPlayModes.has(PlayMode.repeat),
                        },
                        timelineSubtitles: displaySubtitles,
                    }),
                ],
                { type: 'text/html' }
            ),
            `${title}.html`
        );
    }, [playbackRate, playbackTimelineFileName, playbackTimelineModeLabels, playbackTimelineOptionLabels, settings]);

    useImperativeHandle(ref, () => ({ downloadSubtitleTimeline: handleDownloadSubtitleTimeline }), [
        handleDownloadSubtitleTimeline,
    ]);

    const seek = useCallback(
        async (time: number, clock: Clock, forwardToMedia: boolean) => {
            const clampedTime = clampMediaTimestamp(time, (channelRef.current?.duration ?? 0) * 1000);
            clock.setTime(clampedTime);

            if (forwardToMedia) {
                await mediaAdapter.seek(clampedTime / 1000);
            }
        },
        [mediaAdapter]
    );

    const handleSubtitlePlayerResizeStart = useCallback(() => setSubtitlePlayerResizing(true), []);
    const handleSubtitlePlayerResizeEnd = useCallback(
        (width: number) => {
            setSubtitlePlayerResizing(false);

            if (settings.videoSubtitleSplitBehavior === VideoSubtitleSplitBehavior.rememberSplitPosition) {
                playbackPreferences.subtitlePlayerWidth = width;
            }
        },
        [playbackPreferences, settings.videoSubtitleSplitBehavior]
    );

    const updatePlaybackRate = useCallback(
        (playbackRate: number, forwardToMedia: boolean) => {
            if (clock.rate !== playbackRate) {
                clock.rate = playbackRate;
                setPlaybackRate(playbackRate);
                if (forwardToMedia) mediaAdapter.playbackRate(playbackRate);
            }
        },
        [clock, mediaAdapter]
    );

    useEffect(() => {
        if (!syntheticPlayback) {
            setSyntheticShowingSubtitles([]);
            return;
        }

        const playbackEngine = new PlaybackEngine({
            settings: settingsRef.current,
            subtitles: subtitlesRef.current ?? [],
            ready: { settings: true },
            playbackModesSuppressed: true,
            timingDriver: new AnimationFrameTimingDriver({
                paused: () => !clock.running,
                durationMs: () => trackLengthMs(undefined, subtitlesRef.current),
                currentTimeMs: () => clock.time(Number.POSITIVE_INFINITY),
                requestAnimationFrameCallback: (callback) => requestAnimationFrame(callback),
                cancelAnimationFrameCallback: (handle) => cancelAnimationFrame(handle),
                addEventListener: (type, listener) => {
                    switch (type) {
                        case 'play':
                            clock.onEvent('start', listener);
                            break;
                        case 'pause':
                            clock.onEvent('stop', listener);
                            break;
                        case 'seeked':
                            clock.onEvent('settime', listener);
                            break;
                    }
                },
                removeEventListener: (type, listener) => {
                    switch (type) {
                        case 'play':
                            clock.removeEvent('start', listener);
                            break;
                        case 'pause':
                            clock.removeEvent('stop', listener);
                            break;
                        case 'seeked':
                            clock.removeEvent('settime', listener);
                            break;
                    }
                },
            }),
            callbacks: {
                pause: () => clock.stop(),
                play: async () => {
                    clock.start();
                },
                seek: async (timestampMs) => {
                    clock.setTime(timestampMs);
                },
                setPlaybackRate: (rate) => updatePlaybackRate(rate, false),
                showingSubtitlesChanged: setSyntheticShowingSubtitles,
                saveSettings: (settings) => {
                    void settingsProvider.set(settings).catch(onError);
                },
                playbackModesChanged: (transition) => {
                    const modes = new Set(transition.modes);
                    playModesRef.current = modes;
                    setPlayModes(modes);
                },
                onError,
            },
        });
        syntheticPlaybackEngineRef.current = playbackEngine;
        playbackEngine.bind();

        return () => {
            playbackEngine.unbind();
            if (syntheticPlaybackEngineRef.current === playbackEngine) {
                syntheticPlaybackEngineRef.current = undefined;
            }
        };
    }, [clock, onError, settingsProvider, syntheticPlayback, updatePlaybackRate]);

    useEffect(() => {
        if (!syntheticPlayback) return;
        syntheticPlaybackEngineRef.current?.settingsChanged(settings);
    }, [settings, syntheticPlayback]);

    useEffect(() => {
        if (!syntheticPlayback) return;
        syntheticPlaybackEngineRef.current?.subtitlesChanged(subtitles);
    }, [subtitles, syntheticPlayback]);

    const applyOffset = useCallback(
        (offset: number, forwardToVideo: boolean) => {
            setOffset(offset);

            if (!subtitles) {
                return;
            }

            const length = subtitles.length > 0 ? subtitles[subtitles.length - 1].end + offset : 0;

            const newSubtitles = subtitles.map((s, i) => ({
                text: s.text,
                textImage: s.textImage,
                start: s.originalStart + offset,
                originalStart: s.originalStart,
                end: s.originalEnd + offset,
                originalEnd: s.originalEnd,
                displayTime: timeDurationDisplay(s.originalStart + offset, length),
                track: s.track,
                index: i,
                tokenization: s.tokenization,
            }));

            if (forwardToVideo) {
                if (channel !== undefined) {
                    channel.offset(offset);

                    // Older versions of extension don't support the offset message
                    if (tab !== undefined && extension.installed && !extension.supportsOffsetMessage) {
                        channel.subtitles(newSubtitles, subtitleFiles?.map((f) => f.file.name) ?? ['']);
                    }
                }
            }

            onSubtitles(newSubtitles);
            playbackPreferences.offset = offset;
        },
        [subtitleFiles, subtitles, extension, playbackPreferences, tab, channel, onSubtitles]
    );

    useEffect(() => {
        if (!videoFile && !tab) {
            return;
        }

        let channel: VideoChannel;

        if (videoFile) {
            const channelId = uuidv4();
            channel = new VideoChannel(new BroadcastChannelVideoProtocol(channelId));
            setChannelId(channelId);
            onLoaded([videoFile.file]);
        } else {
            channel = new VideoChannel(new ChromeTabVideoProtocol(tab!.id, tab!.src, extension));
            channel.init();
        }

        if (videoChannelRef) {
            videoChannelRef.current = channel;
        }

        setChannel(channel);

        return () => {
            clock.setTime(0);
            clock.stop();
            channel.close();
        };
    }, [clock, videoPopOut, videoFile, tab, extension, videoChannelRef, onLoaded]);

    useEffect(() => {
        async function init() {
            const offset = playbackPreferencesRef.current?.offset ?? 0;
            setOffset(offset);
            let subtitles: DisplaySubtitleModel[] | undefined;

            if (subtitleFiles !== undefined && subtitleFiles.length > 0) {
                setLoadingSubtitles(true);

                try {
                    const nodes = await subtitleReader.subtitles(
                        subtitleFiles.map((f) => f.file),
                        flattenSubtitleFiles
                    );
                    const length = nodes.length > 0 ? nodes[nodes.length - 1].end + offset : 0;

                    subtitles = nodes.map((s, i) => ({
                        text: s.text,
                        textImage: s.textImage,
                        start: s.start + offset,
                        originalStart: s.start,
                        end: s.end + offset,
                        originalEnd: s.end,
                        displayTime: timeDurationDisplay(s.start + offset, length),
                        track: s.track,
                        index: i,
                        tokenization: s.tokenization,
                    }));

                    setSubtitlesSentThroughChannel(false);
                    onSubtitles(subtitles);
                } catch (e) {
                    onError(e);
                    onSubtitles([]);
                } finally {
                    setLoadingSubtitles(false);
                }
            } else {
                subtitles = undefined;
            }
        }

        void init().then(() => onLoaded(subtitleFiles?.map((f) => f.file) ?? []));
    }, [subtitleReader, onLoaded, onError, subtitleFiles, flattenSubtitleFiles, onSubtitles]);

    useEffect(() => {
        if (tab) {
            const newCol = new SubtitleCollection<DisplaySubtitleModel>(subtitleCollectionOptions);
            newCol.setSubtitles(subtitlesRef.current ?? []);
            setSubtitleCollection(newCol);
            subtitleCollectionRef.current = newCol;
            return; // Handled by extension
        }
        if (!mediaId) return;

        const subtitleAnnotations = new SubtitleAnnotations(
            dictionaryProvider,
            settingsProvider,
            subtitleCollectionOptions,
            mediaId,
            (updatedSubtitles) => {
                const playerSubtitles = subtitlesForPlayer(updatedSubtitles);
                if (channel) channel.subtitlesUpdated(updatedSubtitles);
                onSubtitles((prevSubtitles) => {
                    if (!prevSubtitles?.length) return prevSubtitles;
                    const allSubtitles = prevSubtitles.slice();
                    for (const s of playerSubtitles) {
                        allSubtitles[s.index] = {
                            ...allSubtitles[s.index],
                            text: s.text,
                            tokenization: s.tokenization,
                        };
                    }
                    return allSubtitles;
                });
            },
            () => clockRef.current.time(calculateLengthMs(videoDurationRef))
        );
        if (subtitlesRef.current) subtitleAnnotations.setSubtitles(subtitlesRef.current);
        subtitleAnnotations.bind();
        setSubtitleCollection(subtitleAnnotations);
        subtitleCollectionRef.current = subtitleAnnotations;
        return () => {
            if (!(subtitleCollectionRef.current instanceof SubtitleAnnotations)) return;
            subtitleCollectionRef.current.unbind();
        };
    }, [channel, dictionaryProvider, settingsProvider, mediaId, tab, onSubtitles]);

    useEffect(() => {
        if (!subtitleCollectionRef.current) return;
        subtitleCollectionRef.current.setSubtitles(subtitles);
    }, [subtitles]);

    useEffect(() => {
        if (!(subtitleCollectionRef.current instanceof SubtitleAnnotations)) return;
        subtitleCollectionRef.current.settingsUpdated(settings);
    }, [settings]);

    useEffect(() => {
        return channel?.onSubtitlesUpdated((updatedSubtitles) => {
            const playerSubtitles = subtitlesForPlayer(updatedSubtitles);
            onSubtitles((prevSubtitles) => {
                if (!prevSubtitles?.length) return prevSubtitles;
                const allSubtitles = prevSubtitles.slice();
                for (const s of playerSubtitles) {
                    // FIXME: Primitive check to ensure we don't apply a color update from a completely different subtitle or subtitle file.
                    // We should probably have a hash or ID associated with the subtitle file this color update is for.
                    const updatedText = (s as TokenizedSubtitleModel).originalText ?? s.text;
                    const prevText =
                        (allSubtitles[s.index] as TokenizedSubtitleModel)?.originalText ?? allSubtitles[s.index]?.text;
                    if (updatedText === prevText) {
                        allSubtitles[s.index] = {
                            ...allSubtitles[s.index],
                            text: s.text,
                            tokenization: s.tokenization,
                        };
                    }
                }
                return allSubtitles;
            });
        });
    }, [channel, onSubtitles]);

    useEffect(() => {
        if (!tab) return; // Only matters for extension

        // If the user is on the app's tab in the same window where the chrome side panel is now displaying
        // the mining history, the subtitle side panel on the video will not receive the updated subtitles.
        // Once the subtitle side panel is active, we only need to refresh the colors once to get anything missed.
        void (async () => {
            if (!subtitlesRef.current) return;
            const response = (await extension.requestSubtitles(tab.id, tab.src)) as
                | RequestSubtitlesResponse
                | undefined;
            if (!response) return;
            const { subtitles: updatedSubtitles } = response;
            const playerSubtitles = subtitlesForPlayer(updatedSubtitles);
            onSubtitles((prevSubtitles) => {
                if (!prevSubtitles?.length) return prevSubtitles;
                const allSubtitles = prevSubtitles.slice();
                for (const s of playerSubtitles) {
                    // FIXME: Primitive check to ensure we don't apply a color update from a completely different subtitle or subtitle file.
                    // We should probably have a hash or ID associated with the subtitle file this color update is for.
                    const updatedText = (s as TokenizedSubtitleModel).originalText ?? s.text;
                    const prevText =
                        (allSubtitles[s.index] as TokenizedSubtitleModel).originalText ?? allSubtitles[s.index].text;
                    if (updatedText === prevText) {
                        allSubtitles[s.index] = {
                            ...allSubtitles[s.index],
                            text: s.text,
                            tokenization: s.tokenization,
                        };
                    }
                }
                return allSubtitles;
            });
        })();

        const removeCardUpdatedDialog = channel?.onCardUpdatedDialog(() =>
            extension.cardUpdatedDialog(tab.id, tab.src)
        );
        const removeCardExportedDialog = channel?.onCardExportedDialog(() =>
            extension.cardExportedDialog(tab.id, tab.src)
        );
        return () => {
            if (removeCardUpdatedDialog) removeCardUpdatedDialog();
            if (removeCardExportedDialog) removeCardExportedDialog();
        };
    }, [channel, extension, tab, onSubtitles]);

    const hoveredToken = useMemo(() => new HoveredToken(), []);

    const handleMouseOver = useCallback(
        (e: React.MouseEvent) => hoveredToken.handleMouseOver(e.nativeEvent),
        [hoveredToken]
    );

    const handleMouseOut = useCallback(
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
                const applyStates = ApplyStrategy.ADD;
                if (subtitleCollectionRef.current instanceof SubtitleAnnotations) {
                    void subtitleCollectionRef.current.saveTokenLocal(
                        res.track,
                        res.token,
                        tokenStatus,
                        [],
                        applyStates
                    );
                    return;
                }
                if (!tab) return;
                void extension.saveTokenLocal(tab.id, tab.src, res.track, res.token, tokenStatus, [], applyStates);
            },
            () => disableKeyEvents
        );
    }, [hoveredToken, keyBinder, disableKeyEvents, tab, extension]);

    useEffect(() => {
        return keyBinder.bindToggleHoveredTokenIgnored(
            (event) => {
                const res = hoveredToken.parse();
                if (!res) return;
                void ensureStoragePersisted();
                event.preventDefault();
                event.stopImmediatePropagation();
                const states = [TokenState.IGNORED];
                const applyStates = ApplyStrategy.TOGGLE;
                if (subtitleCollectionRef.current instanceof SubtitleAnnotations) {
                    void subtitleCollectionRef.current.saveTokenLocal(res.track, res.token, null, states, applyStates);
                    return;
                }
                if (!tab) return;
                void extension.saveTokenLocal(tab.id, tab.src, res.track, res.token, null, states, applyStates);
            },
            () => disableKeyEvents
        );
    }, [hoveredToken, keyBinder, disableKeyEvents, tab, extension]);

    useEffect(() => {
        return channel?.onSaveTokenLocal((track, token, status, states, applyStates) => {
            if (!(subtitleCollectionRef.current instanceof SubtitleAnnotations)) return;
            void subtitleCollectionRef.current.saveTokenLocal(track, token, status, states, applyStates);
        });
    }, [channel]);

    useEffect(() => {
        setSubtitlesSentThroughChannel(false);
    }, [channel]);

    useEffect(
        () => channel?.onExit(() => videoFileUrl && onUnloadVideo(videoFileUrl)),
        [channel, onUnloadVideo, videoFileUrl]
    );
    useEffect(() => channel?.onPopOutToggle(() => onVideoPopOut()), [channel, onVideoPopOut]);
    useEffect(() => channel?.onHideSubtitlePlayerToggle(onHideSubtitlePlayer), [channel, onHideSubtitlePlayer]);
    useEffect(() => channel?.onAppBarToggle(onAppBarToggle), [channel, onAppBarToggle]);
    useEffect(
        () =>
            channel?.onReady(() => {
                videoDurationRef.current = channel.duration;
                return channel?.ready(calculateLengthMs(videoDurationRef, subtitles), videoFile?.file?.name);
            }),
        [channel, subtitles, videoFile]
    );
    useEffect(() => {
        if (
            channel === undefined ||
            subtitles === undefined ||
            subtitlesSentThroughChannel ||
            subtitleFiles === undefined ||
            subtitleFiles.length === 0
        ) {
            return;
        }

        return channel.onReady(() => {
            setSubtitlesSentThroughChannel(true);
            channel.subtitles(
                subtitles,
                flattenSubtitleFiles ? [subtitleFiles[0].file.name] : subtitleFiles.map((f) => f.file.name)
            );
        });
    }, [subtitles, channel, flattenSubtitleFiles, subtitleFiles, subtitlesSentThroughChannel]);
    useEffect(() => channel?.onReady(() => channel?.subtitleSettings(settings)), [channel, settings]);
    useEffect(
        () => channel?.onReady(() => channel?.hideSubtitlePlayerToggle(hideSubtitlePlayer)),
        [channel, hideSubtitlePlayer]
    );
    useEffect(() => channel?.ankiSettings(settings), [channel, settings]);
    useEffect(() => channel?.miscSettings(settings), [channel, settings]);
    useEffect(
        () =>
            channel?.onReady(() => {
                if (channel?.audioTracks && channel?.audioTracks?.length > 1) {
                    setAudioTracks(channel?.audioTracks);
                    setSelectedAudioTrack(channel?.selectedAudioTrack);
                } else {
                    setAudioTracks(undefined);
                    setSelectedAudioTrack(undefined);
                }
            }),
        [channel]
    );
    useEffect(
        () =>
            channel?.onReady((paused) => {
                if (channel) {
                    clock.setTime(channel.currentTime * 1000);
                }

                if (paused) {
                    clock.stop();
                } else {
                    clock.start();
                }

                if (channel?.playbackRate) {
                    clock.rate = channel.playbackRate;
                    setPlaybackRate(channel.playbackRate);
                }
            }),
        [channel, clock]
    );
    useEffect(
        () =>
            channel?.onDuration(() => {
                videoDurationRef.current = channel.duration;
            }),
        [channel]
    );
    const play = useCallback((clock: Clock, mediaAdapter: MediaAdapter, forwardToMedia: boolean) => {
        clock.start();

        if (forwardToMedia) {
            mediaAdapter.play();
        }
    }, []);

    useEffect(
        () => channel?.onPlay((forwardToMedia) => play(clock, mediaAdapter, forwardToMedia)),
        [channel, mediaAdapter, clock, play]
    );
    useEffect(
        () => channel?.onPause((forwardToMedia) => pause(clock, mediaAdapter, forwardToMedia)),
        [channel, mediaAdapter, clock]
    );
    useEffect(() => {
        return channel?.onOffset((offset) =>
            applyOffset(Math.max(-calculateLengthMs(videoDurationRef) || 0, offset), false)
        );
    }, [channel, applyOffset]);
    useEffect(() => channel?.onPlaybackRate(updatePlaybackRate), [channel, updatePlaybackRate]);
    useEffect(
        () =>
            channel?.onCopy(
                (
                    subtitle,
                    surroundingSubtitles,
                    cardTextFieldValues,
                    audio,
                    image,
                    url,
                    postMineAction,
                    id,
                    mediaTimestamp
                ) =>
                    onCopy(
                        {
                            subtitle,
                            surroundingSubtitles,
                            subtitleFileName: subtitle ? (subtitleFiles?.[subtitle.track]?.file?.name ?? '') : '',
                            ...cardTextFieldValues,
                            mediaTimestamp: mediaTimestamp ?? 0,
                            file: videoFile
                                ? {
                                      name: videoFile.file.name,
                                      blobUrl: createBlobUrl(videoFile.file),
                                      audioTrack: channel?.selectedAudioTrack,
                                      playbackRate: channel?.playbackRate,
                                  }
                                : undefined,
                            audio,
                            image,
                            url,
                        },
                        postMineAction,
                        id
                    )
            ),
        [channel, onCopy, videoFile, subtitleFiles]
    );
    useEffect(
        () =>
            channel?.onPlayModes((playModes) => {
                playModesRef.current = playModes;
                setPlayModes(playModes);
            }),
        [channel]
    );
    useEffect(
        () =>
            channel?.onCurrentTime((currentTime, forwardToMedia) => {
                void (async () => {
                    const playing = clock.running;

                    if (playing) {
                        clock.stop();
                    }

                    await seek(currentTime * 1000, clock, forwardToMedia);

                    if (playing) {
                        clock.start();
                    }
                })();
            }),
        [channel, clock, seek]
    );
    useEffect(
        () =>
            channel?.onAudioTrackSelected((id) => {
                void (async () => {
                    const playing = clock.running;

                    if (playing) {
                        clock.stop();
                    }

                    await mediaAdapter.onReady();
                    if (playing) {
                        clock.start();
                    }

                    setSelectedAudioTrack(id);
                })();
            }),
        [channel, clock, mediaAdapter]
    );
    useEffect(() => channel?.onAnkiDialogRequest(() => onAnkiDialogRequest()), [channel, onAnkiDialogRequest]);
    useEffect(
        () =>
            channel?.onToggleSubtitleTrackInList((track) =>
                setDisabledSubtitleTracks((tracks) => {
                    const newTracks = { ...tracks };
                    newTracks[track] = !tracks[track];
                    return newTracks;
                })
            ),
        [channel]
    );
    useEffect(() => channel?.onLoadFiles(() => onLoadFiles?.()), [channel, onLoadFiles]);
    useEffect(() => channel?.onLoadSubtitles(() => onLoadSubtitles?.()), [channel, onLoadSubtitles]);
    useEffect(() => {
        return miningContext.onEvent('stopped-mining', () => {
            switch (settings.postMiningPlaybackState) {
                case PostMinePlayback.play:
                    play(clock, mediaAdapter, true);
                    break;
                case PostMinePlayback.pause:
                    pause(clock, mediaAdapter, true);
                    break;
                case PostMinePlayback.remember:
                    if (wasPlayingWhenMiningStarted) {
                        play(clock, mediaAdapter, true);
                    }
                    break;
            }
        });
    }, [miningContext, settings, wasPlayingWhenMiningStarted, clock, mediaAdapter, play]);

    useEffect(() => {
        return miningContext.onEvent('started-mining', () => {
            if (clock.running) {
                pause(clock, mediaAdapter, true);
                setWasPlayingWhenMiningStarted(true);
            } else {
                setWasPlayingWhenMiningStarted(false);
            }
        });
    }, [miningContext, clock, mediaAdapter]);

    useEffect(() => {
        if (videoPopOut && videoFileUrl && channelId) {
            window.open(
                origin + '?video=' + encodeURIComponent(videoFileUrl) + '&channel=' + channelId + '&popout=true',
                'asbplayer-video-' + videoFileUrl,
                'resizable,width=800,height=450'
            );
        }

        setLastJumpToTopTimestamp(Date.now());
    }, [videoPopOut, channelId, videoFileUrl, videoFrameRef, videoChannelRef, origin]);

    const handlePlay = useCallback(() => play(clock, mediaAdapter, true), [clock, mediaAdapter, play]);
    const handlePause = useCallback(() => pause(clock, mediaAdapter, true), [clock, mediaAdapter]);
    const handleSeek = useCallback(
        async (progress: number) => {
            const playing = clock.running;

            if (playing) {
                clock.stop();
            }

            await seek(progress * calculateLengthMs(videoDurationRef), clock, true);

            if (playing) {
                clock.start();
            }
        },
        [clock, seek]
    );

    const handleSeekToTimestamp = useCallback(
        async (time: number, shouldPlay: boolean) => {
            if (!shouldPlay) {
                pause(clock, mediaAdapter, true);
            }

            await seek(time, clock, true);

            if (shouldPlay && !clock.running) {
                // play method will start the clock again
                play(clock, mediaAdapter, true);
            }
        },
        [clock, seek, play, mediaAdapter]
    );

    const handleCopyFromSubtitlePlayer = useCallback(
        async (
            subtitle: SubtitleModel,
            surroundingSubtitles: SubtitleModel[],
            postMineAction: PostMineAction,
            forceUseGivenSubtitle?: boolean,
            cardTextFieldValues?: CardTextFieldValues
        ) => {
            if (videoFileUrl) {
                if (forceUseGivenSubtitle) {
                    channel?.copy(postMineAction, subtitle, surroundingSubtitles, cardTextFieldValues);
                } else {
                    // Let VideoPlayer do the copying to ensure copied subtitle is consistent with the VideoPlayer clock
                    channel?.copy(postMineAction);
                }
            } else {
                onCopy(
                    {
                        subtitle,
                        surroundingSubtitles,
                        subtitleFileName: subtitleFiles?.[subtitle.track]?.file?.name ?? '',
                        mediaTimestamp: clock.time(calculateLengthMs(videoDurationRef)),
                        file:
                            videoFile === undefined
                                ? undefined
                                : {
                                      name: videoFile.file.name,
                                      audioTrack: selectedAudioTrack,
                                      playbackRate,
                                      blobUrl: createBlobUrl(videoFile.file),
                                  },
                        ...cardTextFieldValues,
                    },
                    postMineAction,
                    undefined
                );
            }
        },
        [channel, onCopy, clock, videoFile, videoFileUrl, subtitleFiles, selectedAudioTrack, playbackRate]
    );

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        mousePositionRef.current.x = e.screenX;
        mousePositionRef.current.y = e.screenY;
    }, []);

    const handleAudioTrackSelected = useCallback(
        async (id: string) => {
            channel?.audioTrackSelected(id);
            pause(clock, mediaAdapter, true);

            await seek(0, clock, true);

            if (clock.running) {
                play(clock, mediaAdapter, true);
            }
        },
        [channel, clock, mediaAdapter, seek, play]
    );

    const handleOffsetChange = useCallback(
        (offset: number) => {
            const length = calculateLengthMs(videoDurationRef);
            applyOffset(Math.max(-length || 0, offset), true);
        },
        [applyOffset]
    );

    const handlePlaybackRateChange = useCallback(
        (playbackRate: number) => {
            if (syntheticPlaybackEngineRef.current) {
                syntheticPlaybackEngineRef.current.playbackRateChanged(playbackRate);
                return;
            }
            updatePlaybackRate(playbackRate, true);
        },
        [updatePlaybackRate]
    );

    const handlePlayMode = useCallback(
        (targetMode: PlayMode) => {
            channel?.playMode(targetMode);
        },
        [channel]
    );

    const handleToggleSubtitleTrack = useCallback(
        (track: number) =>
            setDisabledSubtitleTracks((tracks) => {
                const newTracks = { ...tracks };
                newTracks[track] = !tracks[track];
                return newTracks;
            }),
        []
    );

    const handleSubtitlesHighlighted = useCallback(
        (subtitles: SubtitleModel[]) => {
            if (subtitles.length === 0 || !settings.autoCopyCurrentSubtitle || !document.hasFocus()) {
                return;
            }

            const text = subtitles
                .filter((s) => isTrackAutoCopyable(settings.autoCopyableTracks, s.track))
                .map((s) => s.text)
                .join('\n');

            if (text) {
                navigator.clipboard.writeText(text).catch(() => {
                    // ignore
                });
            }
        },
        [settings.autoCopyCurrentSubtitle, settings.autoCopyableTracks]
    );

    useEffect(() => {
        if (tab) {
            return;
        }

        const interval = setInterval(() => {
            void (async () => {
                const progress = clock.progress(calculateLengthMs(videoDurationRef));

                if (progress >= 1) {
                    pause(clock, mediaAdapter, true);
                }
            })();
        }, 1000);

        return () => clearInterval(interval);
    }, [clock, mediaAdapter, seek, tab]);

    useEffect(() => {
        const unbind = keyBinder.bindPlay(
            (event) => {
                event.preventDefault();

                if (clock.running) {
                    pause(clock, mediaAdapter, true);
                } else {
                    play(clock, mediaAdapter, true);
                }
            },
            () => disableKeyEvents
        );

        return () => unbind();
    }, [keyBinder, clock, mediaAdapter, disableKeyEvents, play]);

    useEffect(() => {
        return keyBinder.bindAdjustPlaybackRate(
            (event, increase) => {
                event.preventDefault();
                if (increase) {
                    handlePlaybackRateChange(playbackRate + settings.speedChangeStep);
                } else {
                    handlePlaybackRateChange(playbackRate - settings.speedChangeStep);
                }
            },
            () => disableKeyEvents
        );
    }, [handlePlaybackRateChange, playbackRate, settings.speedChangeStep, disableKeyEvents, keyBinder]);

    const togglePlayMode = useCallback(
        (event: KeyboardEvent, targetMode: PlayMode) => {
            if (!playModeEnabled) return;
            event.preventDefault();
            channel?.playMode(targetMode);
        },
        [playModeEnabled, channel]
    );

    useEffect(() => {
        return keyBinder.bindAutoPause(
            (event) => togglePlayMode(event, PlayMode.autoPause),
            () => disableKeyEvents
        );
    }, [togglePlayMode, keyBinder, disableKeyEvents]);

    useEffect(() => {
        return keyBinder.bindCondensedPlayback(
            (event) => togglePlayMode(event, PlayMode.condensed),
            () => disableKeyEvents
        );
    }, [togglePlayMode, keyBinder, disableKeyEvents]);

    useEffect(() => {
        return keyBinder.bindFastForwardPlayback(
            (event) => togglePlayMode(event, PlayMode.fastForward),
            () => disableKeyEvents
        );
    }, [togglePlayMode, keyBinder, disableKeyEvents]);

    useEffect(() => {
        return keyBinder.bindToggleRepeat(
            (event) => togglePlayMode(event, PlayMode.repeat),
            () => disableKeyEvents
        );
    }, [keyBinder, disableKeyEvents, togglePlayMode]);

    useEffect(() => channel?.appBarToggle(appBarHidden), [channel, appBarHidden]);
    useEffect(() => channel?.fullscreenToggle(videoFullscreen), [channel, videoFullscreen]);

    useEffect(() => {
        if (rewindSubtitle?.start === undefined) {
            return;
        }

        pause(clock, mediaAdapter, true);

        void seek(rewindSubtitle.start, clock, true);
    }, [clock, rewindSubtitle?.start, mediaAdapter, seek]);

    useEffect(() => {
        const unsubscribeSeek = dictionaryProvider.onRequestStatisticsSeek((timestamp) => {
            void seek(timestamp, clock, true);
        });
        const unsubscribeMine = dictionaryProvider.onRequestStatisticsMineSentences((_mediaId, indexes) => {
            const subtitleIndex = indexes[0];
            if (subtitleIndex === undefined) return;
            const subtitles = subtitlesRef.current;
            const subtitle = subtitles?.[subtitleIndex];
            if (!subtitle) return;
            void handleCopyFromSubtitlePlayer(
                subtitle,
                surroundingSubtitles(
                    subtitles,
                    subtitle.index,
                    settings.surroundingSubtitlesCountRadius,
                    settings.surroundingSubtitlesTimeRadius
                ),
                settings.clickToMineDefaultAction,
                true
            );
        });

        return () => {
            unsubscribeSeek();
            unsubscribeMine();
        };
    }, [clock, dictionaryProvider, handleCopyFromSubtitlePlayer, seek, settings]);

    useEffect(() => {
        if (!webSocketClient) {
            return;
        }

        webSocketClient.onSeekTimestamp = async ({ body: { timestamp } }: SeekTimestampCommand) => {
            void seek(timestamp * 1000, clock, true);
        };
    }, [webSocketClient, extension, seek, clock]);

    const [windowWidth, windowHeight] = useWindowSize(true);

    const videoInWindow = Boolean(videoFileUrl && !videoPopOut);
    const shouldLoadVideoAspectRatio =
        videoInWindow && settings.videoSubtitleSplitBehavior !== VideoSubtitleSplitBehavior.rememberSplitPosition;
    const videoAspectRatio = useVideoAspectRatio(videoFileUrl, shouldLoadVideoAspectRatio);
    const loaded = videoFileUrl || subtitles;
    const playerHeight = appBarHidden ? windowHeight : Math.max(0, windowHeight - appBarHeight);
    const aspectFitVideoWidth = videoAspectRatio
        ? Math.max(minVideoPlayerWidth, Math.round(playerHeight * videoAspectRatio))
        : undefined;
    const autoSubtitlePlayerInitialWidth =
        videoInWindow && aspectFitVideoWidth !== undefined ? Math.max(0, windowWidth - aspectFitVideoWidth) : undefined;
    const subtitlePlayerInitialWidth = resolveVideoSubtitleSplitLayout({
        behavior: settings.videoSubtitleSplitBehavior,
        persistedWidth: playbackPreferences.subtitlePlayerWidth,
        autoWidth: autoSubtitlePlayerInitialWidth,
    });
    const subtitlePlayerMaxResizeWidth = Math.max(0, windowWidth - minVideoPlayerWidth);
    const notEnoughSpaceForSubtitlePlayer = subtitlePlayerMaxResizeWidth < minSubtitlePlayerWidth;
    const actuallyHideSubtitlePlayer =
        videoInWindow &&
        (hideSubtitlePlayer || !subtitles || subtitles?.length === 0 || notEnoughSpaceForSubtitlePlayer);

    return (
        <div onMouseMove={handleMouseMove} className={classes.root}>
            {!videoInWindow && statisticsOverlay}
            <Grid container direction="row" wrap="nowrap" className={classes.container}>
                {videoInWindow && (
                    <Grid item style={{ flexGrow: 1, minWidth: minVideoPlayerWidth, position: 'relative' }}>
                        {statisticsOverlay}
                        <iframe
                            ref={videoFrameRef}
                            className={classes.videoFrame}
                            style={{
                                pointerEvents: subtitlePlayerResizing ? 'none' : 'auto',
                            }}
                            src={
                                origin +
                                '?video=' +
                                encodeURIComponent(videoFileUrl!) +
                                '&channel=' +
                                channelId +
                                '&popout=false'
                            }
                            title="asbplayer"
                        />
                    </Grid>
                )}

                <Grid
                    item
                    hidden={actuallyHideSubtitlePlayer}
                    style={{
                        flexGrow: videoInWindow ? 0 : 1,
                        width: 'auto',
                    }}
                >
                    {loaded && !(videoFileUrl && !videoPopOut) && !hideControls && (
                        <Controls
                            mousePositionRef={mousePositionRef}
                            clock={clock}
                            length={calculateLengthMs(videoDurationRef)}
                            displayLength={calculateLengthMs(videoDurationRef, subtitles)}
                            audioTracks={audioTracks}
                            selectedAudioTrack={selectedAudioTrack}
                            tabs={(!videoFileUrl && availableTabs) || undefined}
                            selectedTab={tab}
                            offsetEnabled={true}
                            offset={offset}
                            playbackRate={playbackRate}
                            playbackRateEnabled={!tab || extension.supportsPlaybackRateMessage}
                            onPlaybackRateChange={handlePlaybackRateChange}
                            playModeEnabled={playModeEnabled}
                            playModes={playModes}
                            onPlay={handlePlay}
                            onPause={handlePause}
                            onSeek={handleSeek}
                            onAudioTrackSelected={handleAudioTrackSelected}
                            onTabSelected={onTabSelected}
                            onOffsetChange={handleOffsetChange}
                            onPlayMode={handlePlayMode}
                            onLoadSubtitles={onLoadSubtitles}
                            disableKeyEvents={disableKeyEvents}
                            playbackPreferences={playbackPreferences}
                            showOnMouseMovement={true}
                            previewEnabled={false}
                        />
                    )}
                    <SubtitlePlayer
                        subtitles={subtitles}
                        subtitleCollection={subtitleCollection}
                        timelineShowingSubtitles={syntheticPlayback ? syntheticShowingSubtitles : undefined}
                        clock={clock}
                        extension={extension}
                        length={calculateLengthMs(videoDurationRef)}
                        jumpToSubtitle={jumpToSubtitle}
                        onJumpToSubtitleHandled={onJumpToSubtitleHandled}
                        drawerOpen={drawerOpen}
                        appBarHidden={appBarHidden}
                        compressed={videoInWindow || (forceCompressedMode ?? false)}
                        resizable={videoInWindow}
                        showCopyButton={showCopyButton}
                        loading={loadingSubtitles}
                        displayHelp={(videoPopOut && videoFile?.file?.name) || undefined}
                        disableKeyEvents={disableKeyEvents}
                        // On later versions of the extension, VideoPlayer will receive the mining commands instead
                        disableMiningBinds={extension.supportsVideoPlayerMiningCommands && videoFile !== undefined}
                        lastJumpToTopTimestamp={lastJumpToTopTimestamp}
                        hidden={actuallyHideSubtitlePlayer}
                        disabledSubtitleTracks={disabledSubtitleTracks}
                        onSeek={handleSeekToTimestamp}
                        onCopy={handleCopyFromSubtitlePlayer}
                        onMouseOver={handleMouseOver}
                        onMouseOut={handleMouseOut}
                        onOffsetChange={handleOffsetChange}
                        onToggleSubtitleTrack={handleToggleSubtitleTrack}
                        onSubtitlesHighlighted={handleSubtitlesHighlighted}
                        onResizeStart={handleSubtitlePlayerResizeStart}
                        onResizeEnd={handleSubtitlePlayerResizeEnd}
                        maxResizeWidth={subtitlePlayerMaxResizeWidth}
                        settings={settings}
                        keyBinder={keyBinder}
                        webSocketClient={webSocketClient}
                        initialWidth={subtitlePlayerInitialWidth}
                    />
                </Grid>
            </Grid>
        </div>
    );
}

export default Player;
