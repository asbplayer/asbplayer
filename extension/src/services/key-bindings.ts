import {
    OpenAsbplayerSettingsMessage,
    OpenStatisticsMessage,
    PlayMode,
    SettingsUpdatedMessage,
    ToggleSubtitlesInListFromVideoMessage,
    ToggleSubtitlesMessage,
    VideoToExtensionCommand,
} from '@project/common';
import { ApplyStrategy, KeyBindSet, TokenState } from '@project/common/settings';
import { DefaultKeyBinder } from '@project/common/key-binder';
import Binding from './binding';
import { ensureStoragePersisted } from '@project/common/util';

type Unbinder = (() => void) | false;

export default class KeyBindings {
    private _keyBinder: DefaultKeyBinder | undefined;

    private _unbindPlay: Unbinder = false;
    private _unbindAutoPause: Unbinder = false;
    private _unbindCondensedPlayback: Unbinder = false;
    private _unbindFastForwardPlayback: Unbinder = false;
    private _unbindSeekToSubtitle: Unbinder = false;
    private _unbindSeekToBeginningOfCurrentSubtitle?: Unbinder = false;
    private _unbindSeekBackwardOrForward?: Unbinder = false;
    private _unbindToggleSubtitles: Unbinder = false;
    private _unbindToggleSubtitleTrackInVideo?: Unbinder = false;
    private _unbindToggleSubtitleTrackInList?: Unbinder = false;
    private _unbindUnblurTrack?: Unbinder = false;
    private _unbindOffsetToSubtitle?: Unbinder = false;
    private _unbindAdjustOffset?: Unbinder = false;
    private _unbindResetOffset?: Unbinder = false;
    private _unbindAdjustPlaybackRate?: Unbinder = false;
    private _unbindToggleRepeat: Unbinder = false;
    private _unbindAdjustSubtitlePositionOffset: Unbinder = false;
    private _unbindAdjustTopSubtitlePositionOffset: Unbinder = false;
    private _unbindMarkHoveredToken?: Unbinder = false;
    private _unbindToggleHoveredTokenIgnored?: Unbinder = false;
    private _unbindOpenStatistics?: Unbinder = false;

    private _bound: boolean;

    constructor() {
        this._bound = false;
    }

    setKeyBindSet(context: Binding, keyBindSet: KeyBindSet) {
        this._keyBinder = new DefaultKeyBinder(keyBindSet);
        this.unbind();
        this.bind(context);
    }

    bind(context: Binding) {
        if (!this._keyBinder) {
            return;
        }

        if (this._bound) {
            this.unbind();
        }

        this._unbindPlay = this._keyBinder.bindPlay(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                if (context.video.paused) {
                    context.play();
                } else {
                    context.pause();
                }
            },
            () => !context.synced,
            true
        );

        this._unbindAutoPause = this._keyBinder.bindAutoPause(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                context.togglePlayMode(PlayMode.autoPause);
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindCondensedPlayback = this._keyBinder.bindCondensedPlayback(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                context.togglePlayMode(PlayMode.condensed);
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindToggleRepeat = this._keyBinder.bindToggleRepeat(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                const [currentSubtitle] = context.subtitleController.currentSubtitle();

                if (currentSubtitle) {
                    context.togglePlayMode(PlayMode.repeat);
                }
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindFastForwardPlayback = this._keyBinder.bindFastForwardPlayback(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                context.togglePlayMode(PlayMode.fastForward);
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindSeekToSubtitle = this._keyBinder.bindSeekToSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.seek(subtitle.start / 1000);
            },
            () => context.subtitleController.subtitles.length === 0,
            () => context.video.currentTime * 1000,
            () => context.subtitleController.subtitles,
            () => context.seekableTracks,
            true
        );

        this._unbindSeekBackwardOrForward = this._keyBinder.bindSeekBackwardOrForward(
            (event, forward) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                if (forward) {
                    context.seek(Math.min(context.video.duration, context.video.currentTime + context.seekDuration));
                } else {
                    context.seek(Math.max(0, context.video.currentTime - context.seekDuration));
                }
            },
            () => !context.synced,
            true
        );

        this._unbindSeekToBeginningOfCurrentSubtitle = this._keyBinder.bindSeekToBeginningOfCurrentSubtitle(
            (event, subtitle) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.seek(subtitle.start / 1000);
                if (context.alwaysPlayOnSubtitleRepeat) context.play();
            },
            () => context.subtitleController.subtitles.length === 0,
            () => context.video.currentTime * 1000,
            () => context.subtitleController.subtitles,
            () => context.seekableTracks,
            true
        );

        this._unbindToggleSubtitles = this._keyBinder.bindToggleSubtitles(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                const toggleSubtitlesCommand: VideoToExtensionCommand<ToggleSubtitlesMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'toggle-subtitles',
                    },
                    src: context.video.src,
                };

                browser.runtime.sendMessage(toggleSubtitlesCommand);
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindToggleSubtitleTrackInVideo = this._keyBinder.bindToggleSubtitleTrackInVideo(
            (event, track) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.subtitleController.disabledSubtitleTracks[track] =
                    !context.subtitleController.disabledSubtitleTracks[track];
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindUnblurTrack = this._keyBinder.bindUnblurTrack(
            (event, track) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.subtitleController.unblur(track);
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindMarkHoveredToken = this._keyBinder.bindMarkHoveredToken(
            (event, tokenStatus) => {
                const res = context.hoveredToken.parse();
                if (!res) return;
                void ensureStoragePersisted();
                event.preventDefault();
                event.stopImmediatePropagation();
                void context.subtitleController.subtitleAnnotations.saveTokenLocal(
                    res.track,
                    res.token,
                    tokenStatus,
                    [],
                    ApplyStrategy.ADD
                );
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindToggleHoveredTokenIgnored = this._keyBinder.bindToggleHoveredTokenIgnored(
            (event) => {
                const res = context.hoveredToken.parse();
                if (!res) return;
                void ensureStoragePersisted();
                event.preventDefault();
                event.stopImmediatePropagation();
                void context.subtitleController.subtitleAnnotations.saveTokenLocal(
                    res.track,
                    res.token,
                    null,
                    [TokenState.IGNORED],
                    ApplyStrategy.TOGGLE
                );
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindOpenStatistics = this._keyBinder.bindOpenStatistics(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                const command: VideoToExtensionCommand<OpenStatisticsMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'open-statistics',
                    },
                    src: context.video.src,
                };

                browser.runtime.sendMessage(command);
            },
            () => false,
            true
        );

        this._unbindToggleSubtitleTrackInList = this._keyBinder.bindToggleSubtitleTrackInList(
            (event, track) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                const command: VideoToExtensionCommand<ToggleSubtitlesInListFromVideoMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'toggleSubtitleTrackInList',
                        track: track,
                    },
                    src: context.video.src,
                };
                browser.runtime.sendMessage(command);
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindOffsetToSubtitle = this._keyBinder.bindOffsetToSubtitle(
            (event, offset) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.subtitleController.offset(offset);
            },
            () => context.subtitleController.subtitles.length === 0,
            () => context.video.currentTime * 1000,
            () => context.subtitleController.subtitles,
            true
        );

        this._unbindAdjustOffset = this._keyBinder.bindAdjustOffset(
            (event, offset) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.subtitleController.offset(offset);
            },
            () => context.subtitleController.subtitles.length === 0,
            () => context.subtitleController.subtitles,
            true
        );

        this._unbindResetOffset = this._keyBinder.bindResetOffet(
            (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                context.subtitleController.offset(0);
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindAdjustPlaybackRate = this._keyBinder.bindAdjustPlaybackRate(
            (event, increase) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                const currentSpeed = context.video.playbackRate;
                const speedOffset = context.speedChangeStep * 10;

                context.togglePlayMode(PlayMode.normal);
                if (increase) {
                    context.video.playbackRate = Math.min(5, Math.round(currentSpeed * 10 + speedOffset) / 10);
                } else {
                    context.video.playbackRate = Math.max(0.1, Math.round(currentSpeed * 10 - speedOffset) / 10);
                }
            },
            () => !context.synced,
            true
        );

        this._unbindAdjustSubtitlePositionOffset = this._keyBinder.bindAdjustSubtitlePositionOffset(
            (event, increase) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                const currentOffset = context.subtitleController.bottomSubtitlePositionOffset;
                const newOffset = currentOffset + (increase ? 20 : -20);

                context.settings
                    .set({ subtitlePositionOffset: newOffset })
                    .then(() => {
                        const settingsUpdatedCommand: VideoToExtensionCommand<SettingsUpdatedMessage> = {
                            sender: 'asbplayer-video',
                            message: {
                                command: 'settings-updated',
                            },
                            src: context.video.src,
                        };
                        browser.runtime.sendMessage(settingsUpdatedCommand);
                    })
                    .catch(console.error);
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._unbindAdjustTopSubtitlePositionOffset = this._keyBinder.bindAdjustTopSubtitlePositionOffset(
            (event, increase) => {
                event.preventDefault();
                event.stopImmediatePropagation();

                const currentOffset = context.subtitleController.topSubtitlePositionOffset;

                const newOffset = currentOffset + (increase ? 20 : -20);

                context.settings
                    .set({ topSubtitlePositionOffset: newOffset })
                    .then(() => {
                        const settingsUpdatedCommand: VideoToExtensionCommand<SettingsUpdatedMessage> = {
                            sender: 'asbplayer-video',
                            message: {
                                command: 'settings-updated',
                            },
                            src: context.video.src,
                        };
                        browser.runtime.sendMessage(settingsUpdatedCommand);
                    })
                    .catch(console.error);
            },
            () => context.subtitleController.subtitles.length === 0,
            true
        );

        this._bound = true;
    }

    unbind() {
        if (this._unbindPlay) {
            this._unbindPlay();
            this._unbindPlay = false;
        }

        if (this._unbindAutoPause) {
            this._unbindAutoPause();
            this._unbindAutoPause = false;
        }

        if (this._unbindCondensedPlayback) {
            this._unbindCondensedPlayback();
            this._unbindCondensedPlayback = false;
        }

        if (this._unbindFastForwardPlayback) {
            this._unbindFastForwardPlayback();
            this._unbindFastForwardPlayback = false;
        }

        if (this._unbindSeekToSubtitle) {
            this._unbindSeekToSubtitle();
            this._unbindSeekToSubtitle = false;
        }

        if (this._unbindSeekToBeginningOfCurrentSubtitle) {
            this._unbindSeekToBeginningOfCurrentSubtitle();
            this._unbindSeekToBeginningOfCurrentSubtitle = false;
        }

        if (this._unbindSeekBackwardOrForward) {
            this._unbindSeekBackwardOrForward();
            this._unbindSeekBackwardOrForward = false;
        }

        if (this._unbindToggleSubtitles) {
            this._unbindToggleSubtitles();
            this._unbindToggleSubtitles = false;
        }

        if (this._unbindToggleSubtitleTrackInVideo) {
            this._unbindToggleSubtitleTrackInVideo();
            this._unbindToggleSubtitleTrackInVideo = false;
        }

        if (this._unbindToggleSubtitleTrackInList) {
            this._unbindToggleSubtitleTrackInList();
            this._unbindToggleSubtitleTrackInList = false;
        }

        if (this._unbindUnblurTrack) {
            this._unbindUnblurTrack();
            this._unbindUnblurTrack = false;
        }

        if (this._unbindOffsetToSubtitle) {
            this._unbindOffsetToSubtitle();
            this._unbindOffsetToSubtitle = false;
        }

        if (this._unbindAdjustOffset) {
            this._unbindAdjustOffset();
            this._unbindAdjustOffset = false;
        }

        if (this._unbindResetOffset) {
            this._unbindResetOffset();
            this._unbindResetOffset = false;
        }

        if (this._unbindToggleRepeat) {
            this._unbindToggleRepeat();
            this._unbindToggleRepeat = false;
        }

        if (this._unbindAdjustPlaybackRate) {
            this._unbindAdjustPlaybackRate();
            this._unbindAdjustPlaybackRate = false;
        }

        if (this._unbindAdjustSubtitlePositionOffset) {
            this._unbindAdjustSubtitlePositionOffset();
            this._unbindAdjustSubtitlePositionOffset = false;
        }

        if (this._unbindAdjustTopSubtitlePositionOffset) {
            this._unbindAdjustTopSubtitlePositionOffset();
            this._unbindAdjustTopSubtitlePositionOffset = false;
        }

        if (this._unbindMarkHoveredToken) {
            this._unbindMarkHoveredToken();
            this._unbindMarkHoveredToken = false;
        }

        if (this._unbindToggleHoveredTokenIgnored) {
            this._unbindToggleHoveredTokenIgnored();
            this._unbindToggleHoveredTokenIgnored = false;
        }

        if (this._unbindOpenStatistics) {
            this._unbindOpenStatistics();
            this._unbindOpenStatistics = false;
        }

        this._bound = false;
    }
}
