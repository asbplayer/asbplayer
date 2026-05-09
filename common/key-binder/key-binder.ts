import { SeekableTracks, SubtitleModel } from '../src/model';
import hotkeys from 'hotkeys-js';
import { KeyBindSet, TokenStatus } from '../settings/settings';

export function adjacentSubtitle(forward: boolean, time: number, subtitles: SubtitleModel[]) {
    const now = time;
    let adjacentSubtitleIndex = -1;
    let minDiff = Number.MAX_SAFE_INTEGER;

    for (let i = 0; i < subtitles.length; ++i) {
        const s = subtitles[i];
        const diff = forward ? s.start - now : now - s.start;

        if (minDiff <= diff) {
            continue;
        }

        if (forward && now < s.start) {
            minDiff = diff;
            adjacentSubtitleIndex = i;
        } else if (!forward && now > s.start) {
            minDiff = diff;
            adjacentSubtitleIndex = now < s.end ? Math.max(0, i - 1) : i;
        }
    }

    if (adjacentSubtitleIndex !== -1) {
        return subtitles[adjacentSubtitleIndex];
    }

    return null;
}

export interface KeyBinder {
    bindCopy<T extends SubtitleModel = SubtitleModel>(
        onCopy: (event: KeyboardEvent, subtitle: T) => void,
        disabledGetter: () => boolean,
        subtitleGetter: () => T | undefined,
        capture?: boolean
    ): () => void;
    bindAnkiExport(
        onAnkiExport: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindUpdateLastCard(
        onUpdateLastCard: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindExportCard(
        onExportCard: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindTakeScreenshot(
        onTakeScreenshot: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindSeekToSubtitle(
        onSeekToSubtitle: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        seekableTracksGetter: () => SeekableTracks,
        capture?: boolean
    ): () => void;
    bindSeekToBeginningOfCurrentSubtitle(
        onSeekToBeginningOfCurrentSubtitle: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        seekableTracksGetter: () => SeekableTracks,
        capture?: boolean
    ): () => void;
    bindSeekBackwardOrForward(
        onSeekBackwardOrForward: (event: KeyboardEvent, forward: boolean) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindOffsetToSubtitle(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        capture?: boolean
    ): () => void;
    bindAdjustOffset(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        capture?: boolean
    ): () => void;
    bindResetOffet(
        onResetOffset: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindAdjustPlaybackRate(
        onAdjustPlaybackRate: (event: KeyboardEvent, increase: boolean) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindToggleSubtitles(
        onToggleSubtitles: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindToggleSubtitleTrackInVideo(
        onToggleSubtitleTrack: (event: KeyboardEvent, extra: any) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindToggleSubtitleTrackInList(
        onToggleSubtitleTrackInList: (event: KeyboardEvent, extra: any) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindUnblurTrack(
        onUnblurTrack: (event: KeyboardEvent, track: number) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindPlay(onPlay: (event: KeyboardEvent) => void, disabledGetter: () => boolean, capture?: boolean): () => void;
    bindAutoPause(
        onAutoPause: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindCondensedPlayback(
        onCondensedPlayback: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindFastForwardPlayback(
        onFastForwardPlayback: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindToggleSidePanel(
        onToggleSidePanel: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindToggleRepeat(
        onToggleRepeat: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindToggleRecording(
        onToggleRecording: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindAdjustSubtitlePositionOffset(
        onAdjustSubtitlePositionOffset: (event: KeyboardEvent, increase: boolean) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindAdjustTopSubtitlePositionOffset(
        onAdjustTopSubtitlePositionOffset: (event: KeyboardEvent, increase: boolean) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindMarkHoveredToken(
        onMarkHoveredToken: (event: KeyboardEvent, tokenStatus: TokenStatus) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindToggleHoveredTokenIgnored(
        onToggleHoveredTokenIgnored: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
    bindOpenStatistics(
        onOpenStatistics: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean
    ): () => void;
}

export class DefaultKeyBinder implements KeyBinder {
    private readonly keyBindSet: KeyBindSet;

    constructor(keyBindSet: KeyBindSet) {
        this.keyBindSet = keyBindSet;
    }
    bindCopy<T extends SubtitleModel = SubtitleModel>(
        onCopy: (event: KeyboardEvent, subtitle: T) => void,
        disabledGetter: () => boolean,
        subtitleGetter: () => T | undefined,
        capture = false
    ) {
        const shortcut = this.keyBindSet.copySubtitle.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = this.copyHandler(onCopy, disabledGetter, subtitleGetter);
        return this._bind(shortcut, capture, handler);
    }

    copyHandler<T extends SubtitleModel>(
        onCopy: (event: KeyboardEvent, subtitle: T) => void,
        disabledGetter: () => boolean,
        subtitleGetter: () => T | undefined
    ) {
        return (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            const subtitle = subtitleGetter();

            if (!subtitle) {
                return false;
            }

            onCopy(event, subtitle);
            return true;
        };
    }

    bindAnkiExport(onAnkiExport: (event: KeyboardEvent) => void, disabledGetter: () => boolean, capture = false) {
        const shortcut = this.keyBindSet.ankiExport.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = this.ankiExportHandler(onAnkiExport, disabledGetter);
        return this._bind(shortcut, capture, handler);
    }

    ankiExportHandler(onAnkiExport: (event: KeyboardEvent) => void, disabledGetter: () => boolean) {
        return (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onAnkiExport(event);
            return true;
        };
    }

    bindUpdateLastCard(
        onUpdateLastCard: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcut = this.keyBindSet.updateLastCard.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = this.updateLastCardHandler(onUpdateLastCard, disabledGetter);
        return this._bind(shortcut, capture, handler);
    }

    updateLastCardHandler(onUpdateLastCard: (event: KeyboardEvent) => void, disabledGetter: () => boolean) {
        return (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onUpdateLastCard(event);
            return true;
        };
    }

    bindExportCard(onExportCard: (event: KeyboardEvent) => void, disabledGetter: () => boolean, capture = false) {
        const shortcut = this.keyBindSet.exportCard.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = this.exportCardHandler(onExportCard, disabledGetter);
        return this._bind(shortcut, capture, handler);
    }

    exportCardHandler(onExportCard: (event: KeyboardEvent) => void, disabledGetter: () => boolean) {
        return (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onExportCard(event);
            return true;
        };
    }

    bindTakeScreenshot(
        onTakeScreenshot: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcut = this.keyBindSet.takeScreenshot.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = this.takeScreenshotHandler(onTakeScreenshot, disabledGetter);
        return this._bind(shortcut, capture, handler);
    }

    takeScreenshotHandler(onTakeScreenshot: (event: KeyboardEvent) => void, disabledGetter: () => boolean) {
        return (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onTakeScreenshot(event);
            return true;
        };
    }

    bindToggleRecording(
        onToggleRecording: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcut = this.keyBindSet.toggleRecording.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = this.takeScreenshotHandler(onToggleRecording, disabledGetter);
        return this._bind(shortcut, capture, handler);
    }

    toggleRecordingHandler(onToggleRecording: (event: KeyboardEvent) => void, disabledGetter: () => boolean) {
        return (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onToggleRecording(event);
            return true;
        };
    }

    bindSeekToSubtitle(
        onSeekToSubtitle: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        seekableTracksGetter: () => SeekableTracks,
        capture = false
    ) {
        const delegate = (event: KeyboardEvent, forward: boolean) => {
            if (disabledGetter()) {
                return false;
            }

            const seekableTracks = seekableTracksGetter();

            const subtitles = subtitlesGetter()?.filter((s) => seekableTracks[s.track]);

            if (!subtitles || subtitles.length === 0) {
                return false;
            }

            const subtitle = adjacentSubtitle(forward, timeGetter(), subtitles);

            if (subtitle !== null && subtitle.start >= 0 && subtitle.end >= 0) {
                onSeekToSubtitle(event, subtitle);
                return true;
            }

            return false;
        };
        const previousShortcut = this.keyBindSet.seekToPreviousSubtitle.keys;
        const nextShortcut = this.keyBindSet.seekToNextSubtitle.keys;
        const previousHandler = (event: KeyboardEvent) => delegate(event, false);
        const nextHandler = (event: KeyboardEvent) => delegate(event, true);

        let unbindPrevious: (() => void) | undefined;
        let unbindNext: (() => void) | undefined;

        if (previousShortcut) {
            unbindPrevious = this._bind(previousShortcut, capture, previousHandler);
        }

        if (nextShortcut) {
            unbindNext = this._bind(nextShortcut, capture, nextHandler);
        }

        return () => {
            unbindPrevious?.();
            unbindNext?.();
        };
    }

    bindSeekToBeginningOfCurrentSubtitle(
        onSeekToBeginningOfCurrentSubtitle: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        seekableTracksGetter: () => SeekableTracks,
        capture = false
    ) {
        const shortcut = this.keyBindSet.seekToBeginningOfCurrentSubtitle.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            const seekableTracks = seekableTracksGetter();

            const subtitles = subtitlesGetter()?.filter((s) => seekableTracks[s.track]);

            if (!subtitles || subtitles.length === 0) {
                return false;
            }

            const subtitle = this._currentOrPreviousSubtitle(timeGetter(), subtitles);

            if (subtitle !== undefined && subtitle.start >= 0 && subtitle.end >= 0) {
                onSeekToBeginningOfCurrentSubtitle(event, subtitle);
                return true;
            }

            return false;
        };
        return this._bind(shortcut, capture, handler);
    }

    _currentOrPreviousSubtitle(time: number, subtitles: SubtitleModel[]) {
        const now = time;
        let currentSubtitle: SubtitleModel | undefined;
        let previousSubtitle: SubtitleModel | undefined;
        let minDiff = Number.MAX_SAFE_INTEGER;

        for (let i = 0; i < subtitles.length; ++i) {
            const s = subtitles[i];

            if (s.start < 0 || s.end < 0) {
                continue;
            }

            const diff = now - s.start;

            if (now >= s.start && now < s.end) {
                if (diff < minDiff) {
                    currentSubtitle = s;
                    minDiff = diff;
                }
            } else if (now > s.end) {
                previousSubtitle = s;
            }
        }

        return currentSubtitle ? currentSubtitle : previousSubtitle;
    }

    bindSeekBackwardOrForward(
        onSeekBackwardOrForward: (event: KeyboardEvent, forward: boolean) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const delegate = (event: KeyboardEvent, forward: boolean) => {
            if (disabledGetter()) {
                return false;
            }

            onSeekBackwardOrForward(event, forward);
            return true;
        };
        const backShortcut = this.keyBindSet.seekBackward.keys;
        const nextShortcut = this.keyBindSet.seekForward.keys;
        const backHandler = (event: KeyboardEvent) => delegate(event, false);
        const nextHandler = (event: KeyboardEvent) => delegate(event, true);

        let unbindBack: (() => void) | undefined;
        let unbindNext: (() => void) | undefined;

        if (backShortcut) {
            unbindBack = this._bind(backShortcut, capture, backHandler);
        }

        if (nextShortcut) {
            unbindNext = this._bind(nextShortcut, capture, nextHandler);
        }

        return () => {
            unbindBack?.();
            unbindNext?.();
        };
    }

    bindOffsetToSubtitle(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        capture = false
    ) {
        const delegate = (event: KeyboardEvent, forward: boolean) => {
            if (disabledGetter()) {
                return false;
            }

            const subtitles = subtitlesGetter();

            if (!subtitles || subtitles.length === 0) {
                return false;
            }

            const time = timeGetter();
            const subtitle = adjacentSubtitle(forward, time, subtitles);

            if (subtitle !== null) {
                const subtitleStart = subtitle.originalStart;
                const newOffset = time - subtitleStart;
                onOffsetChange(event, newOffset);
                return true;
            }

            return false;
        };
        const previousShortcut = this.keyBindSet.adjustOffsetToPreviousSubtitle.keys;
        const nextShortcut = this.keyBindSet.adjustOffsetToNextSubtitle.keys;
        const previousHandler = (event: KeyboardEvent) => delegate(event, false);
        const nextHandler = (event: KeyboardEvent) => delegate(event, true);

        let unbindPrevious: (() => void) | undefined;
        let unbindNext: (() => void) | undefined;

        if (previousShortcut) {
            unbindPrevious = this._bind(previousShortcut, capture, previousHandler);
        }

        if (nextShortcut) {
            unbindNext = this._bind(nextShortcut, capture, nextHandler);
        }

        return () => {
            unbindPrevious?.();
            unbindNext?.();
        };
    }

    bindAdjustOffset(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        capture = false
    ) {
        const delegate = (event: KeyboardEvent, increase: boolean) => {
            if (disabledGetter()) {
                return false;
            }

            const subtitles = subtitlesGetter();

            if (!subtitles || subtitles.length === 0) {
                return false;
            }

            const currentOffset = subtitles[0].start - subtitles[0].originalStart;
            const newOffset = currentOffset + (increase ? 100 : -100);
            onOffsetChange(event, newOffset);
            return true;
        };

        const decreaseShortcut = this.keyBindSet.decreaseOffset.keys;
        const increaseShortcut = this.keyBindSet.increaseOffset.keys;
        const decreaseHandler = (event: KeyboardEvent) => delegate(event, false);
        const increaseHandler = (event: KeyboardEvent) => delegate(event, true);

        const unbindDecrease = decreaseShortcut ? this._bind(decreaseShortcut, capture, decreaseHandler) : () => {};
        const unbindIncrease = increaseShortcut ? this._bind(increaseShortcut, capture, increaseHandler) : () => {};
        return () => {
            unbindDecrease();
            unbindIncrease();
        };
    }

    bindResetOffet(
        onResetOffset: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture?: boolean | undefined
    ) {
        const shortcut = this.keyBindSet.resetOffset.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onResetOffset(event);
            return true;
        };

        return this._bind(shortcut, capture ?? false, handler);
    }

    bindAdjustPlaybackRate(
        onAdjustPlaybackRate: (event: KeyboardEvent, increase: boolean) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const delegate = (event: KeyboardEvent, increase: boolean) => {
            if (disabledGetter()) {
                return false;
            }

            onAdjustPlaybackRate(event, increase);
            return true;
        };
        const increaseShortcut = this.keyBindSet.increasePlaybackRate.keys;
        const decreaseShortcut = this.keyBindSet.decreasePlaybackRate.keys;
        const decreaseHandler = (event: KeyboardEvent) => delegate(event, false);
        const increaseHandler = (event: KeyboardEvent) => delegate(event, true);
        let unbindDecrease: (() => void) | undefined;
        let unbindIncrease: (() => void) | undefined;

        if (decreaseShortcut) {
            unbindDecrease = this._bind(decreaseShortcut, capture, decreaseHandler);
        }

        if (increaseShortcut) {
            unbindIncrease = this._bind(increaseShortcut, capture, increaseHandler);
        }

        return () => {
            unbindDecrease?.();
            unbindIncrease?.();
        };
    }

    bindAdjustSubtitlePositionOffset(
        onAdjustSubtitlePositionOffset: (event: KeyboardEvent, increase: boolean) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const delegate = (event: KeyboardEvent, increase: boolean) => {
            if (disabledGetter()) {
                return false;
            }

            onAdjustSubtitlePositionOffset(event, increase);
            return true;
        };

        const increaseShortcut = this.keyBindSet.moveBottomSubtitlesUp.keys;
        const decreaseShortcut = this.keyBindSet.moveBottomSubtitlesDown.keys;

        const decreaseHandler = (event: KeyboardEvent) => delegate(event, false);
        const increaseHandler = (event: KeyboardEvent) => delegate(event, true);

        const unbindDecrease = decreaseShortcut ? this._bind(decreaseShortcut, capture, decreaseHandler) : () => {};
        const unbindIncrease = increaseShortcut ? this._bind(increaseShortcut, capture, increaseHandler) : () => {};

        return () => {
            unbindDecrease();
            unbindIncrease();
        };
    }

    bindAdjustTopSubtitlePositionOffset(
        onAdjustTopSubtitlePositionOffset: (event: KeyboardEvent, increase: boolean) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const delegate = (event: KeyboardEvent, increase: boolean) => {
            if (disabledGetter()) {
                return false;
            }

            onAdjustTopSubtitlePositionOffset(event, increase);
            return true;
        };

        const increaseShortcut = this.keyBindSet.moveTopSubtitlesDown.keys;
        const decreaseShortcut = this.keyBindSet.moveTopSubtitlesUp.keys;

        const decreaseHandler = (event: KeyboardEvent) => delegate(event, false);
        const increaseHandler = (event: KeyboardEvent) => delegate(event, true);

        const unbindDecrease = decreaseShortcut ? this._bind(decreaseShortcut, capture, decreaseHandler) : () => {};
        const unbindIncrease = increaseShortcut ? this._bind(increaseShortcut, capture, increaseHandler) : () => {};

        return () => {
            unbindDecrease();
            unbindIncrease();
        };
    }

    bindToggleSubtitles(
        onToggleSubtitles: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcut = this.keyBindSet.toggleSubtitles.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onToggleSubtitles(event);
            return true;
        };
        return this._bind(shortcut, capture, handler);
    }

    bindToggleSubtitleTrackInVideo(
        onToggleSubtitleTrack: (event: KeyboardEvent, extra: any) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcuts = [
            this.keyBindSet.toggleVideoSubtitleTrack1.keys,
            this.keyBindSet.toggleVideoSubtitleTrack2.keys,
            this.keyBindSet.toggleVideoSubtitleTrack3.keys,
        ].filter((s) => s);

        if (shortcuts.length === 0) {
            return () => {};
        }

        const delegate = (event: KeyboardEvent, track: number) => {
            if (disabledGetter()) {
                return false;
            }

            onToggleSubtitleTrack(event, track);
            return true;
        };
        let unbindHandlers: (() => void)[] = [];

        for (let i = 0; i < shortcuts.length; ++i) {
            const handler = (event: KeyboardEvent) => delegate(event, i);
            const unbindHandler = shortcuts[i] ? this._bind(shortcuts[i], capture, handler) : () => {};
            unbindHandlers.push(unbindHandler);
        }

        return () => {
            for (let i = 0; i < shortcuts.length; ++i) {
                const unbindHandler = unbindHandlers[i];
                unbindHandler();
            }
        };
    }

    bindToggleSubtitleTrackInList(
        onToggleSubtitleTrackInList: (event: KeyboardEvent, extra: any) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcuts = [
            this.keyBindSet.toggleAsbplayerSubtitleTrack1.keys,
            this.keyBindSet.toggleAsbplayerSubtitleTrack2.keys,
            this.keyBindSet.toggleAsbplayerSubtitleTrack3.keys,
        ].filter((s) => s);

        if (shortcuts.length === 0) {
            return () => {};
        }

        const delegate = (event: KeyboardEvent, track: number) => {
            if (disabledGetter()) {
                return false;
            }

            onToggleSubtitleTrackInList(event, track);
            return true;
        };

        let unbindHandlers: (() => void)[] = [];

        for (let i = 0; i < 9; ++i) {
            const handler = (event: KeyboardEvent) => delegate(event, i);
            const unbindHandler = shortcuts[i] ? this._bind(shortcuts[i], capture, handler) : () => {};
            unbindHandlers.push(unbindHandler);
        }

        return () => {
            for (let i = 0; i < 9; ++i) {
                const unbindHandler = unbindHandlers[i];
                unbindHandler();
            }
        };
    }

    bindUnblurTrack(
        onUnblurTrack: (event: KeyboardEvent, track: number) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcuts = [
            this.keyBindSet.unblurAsbplayerTrack1.keys,
            this.keyBindSet.unblurAsbplayerTrack2.keys,
            this.keyBindSet.unblurAsbplayerTrack3.keys,
        ].filter((s) => s);

        if (shortcuts.length === 0) {
            return () => {};
        }

        const delegate = (event: KeyboardEvent, track: number) => {
            if (disabledGetter()) {
                return false;
            }

            onUnblurTrack(event, track);
            return true;
        };
        let unbindHandlers: (() => void)[] = [];

        for (let i = 0; i < shortcuts.length; ++i) {
            const handler = (event: KeyboardEvent) => delegate(event, i);
            const unbindHandler = shortcuts[i] ? this._bind(shortcuts[i], capture, handler) : () => {};
            unbindHandlers.push(unbindHandler);
        }

        return () => {
            for (let i = 0; i < shortcuts.length; ++i) {
                const unbindHandler = unbindHandlers[i];
                unbindHandler();
            }
        };
    }

    bindPlay(onPlay: (event: KeyboardEvent) => void, disabledGetter: () => boolean, capture = false) {
        const shortcut = this.keyBindSet.togglePlay.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onPlay(event);
            return true;
        };

        return this._bind(shortcut, capture, handler);
    }

    bindAutoPause(onAutoPause: (event: KeyboardEvent) => void, disabledGetter: () => boolean, capture = false) {
        const shortcut = this.keyBindSet.toggleAutoPause.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onAutoPause(event);
            return true;
        };

        return this._bind(shortcut, capture, handler);
    }

    bindCondensedPlayback(
        onCondensedPlayback: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcut = this.keyBindSet.toggleCondensedPlayback.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onCondensedPlayback(event);
            return true;
        };

        return this._bind(shortcut, capture, handler);
    }

    bindFastForwardPlayback(
        onFastForwardPlayback: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcut = this.keyBindSet.toggleFastForwardPlayback.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onFastForwardPlayback(event);
            return true;
        };

        return this._bind(shortcut, capture, handler);
    }

    bindToggleSidePanel(
        onToggleSidePanel: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcut = this.keyBindSet.toggleSidePanel.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onToggleSidePanel(event);
            return true;
        };

        return this._bind(shortcut, capture, handler);
    }

    bindToggleRepeat(onToggleRepeat: (event: KeyboardEvent) => void, disabledGetter: () => boolean, capture = false) {
        const shortcut = this.keyBindSet.toggleRepeat.keys;

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onToggleRepeat(event);
            return true;
        };

        return this._bind(shortcut, capture, handler);
    }

    bindMarkHoveredToken(
        onMarkHoveredToken: (event: KeyboardEvent, tokenStatus: TokenStatus) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcuts = [
            this.keyBindSet.markHoveredToken0.keys,
            this.keyBindSet.markHoveredToken1.keys,
            this.keyBindSet.markHoveredToken2.keys,
            this.keyBindSet.markHoveredToken3.keys,
            this.keyBindSet.markHoveredToken4.keys,
            this.keyBindSet.markHoveredToken5.keys,
        ];

        if (shortcuts.length === 0) {
            return () => {};
        }

        const delegate = (event: KeyboardEvent, tokenStatus: TokenStatus) => {
            if (disabledGetter()) {
                return false;
            }

            onMarkHoveredToken(event, tokenStatus);
            return true;
        };
        let unbindHandlers: (() => void)[] = [];

        for (let i = 0; i < shortcuts.length; ++i) {
            const handler = (event: KeyboardEvent) => delegate(event, i as TokenStatus);
            const unbindHandler = shortcuts[i] ? this._bind(shortcuts[i], capture, handler) : () => {};
            unbindHandlers.push(unbindHandler);
        }

        return () => {
            for (let i = 0; i < shortcuts.length; ++i) {
                const unbindHandler = unbindHandlers[i];
                unbindHandler();
            }
        };
    }

    bindToggleHoveredTokenIgnored(
        onToggleHoveredTokenIgnored: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcut = this.keyBindSet.toggleHoveredTokenIgnored.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onToggleHoveredTokenIgnored(event);
            return true;
        };
        return this._bind(shortcut, capture, handler);
    }

    bindOpenStatistics(
        onOpenStatistics: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        capture = false
    ) {
        const shortcut = this.keyBindSet.openStatistics.keys;

        if (!shortcut) {
            return () => {};
        }

        const handler = (event: KeyboardEvent) => {
            if (disabledGetter()) {
                return false;
            }

            onOpenStatistics(event);
            return true;
        };
        return this._bind(shortcut, capture, handler);
    }

    private _bind(shortcut: string, capture: boolean, handler: (event: KeyboardEvent) => boolean) {
        let handled: boolean | undefined = undefined;

        const wrappedHandler = (event: KeyboardEvent) => {
            if (event.type === 'keydown') {
                handled = handler(event);
            } else if (event.type === 'keyup') {
                if (handled) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }

                handled = undefined;
            }
        };

        hotkeys(shortcut, { capture, keydown: true, keyup: true }, wrappedHandler);
        return () => hotkeys.unbind(shortcut, wrappedHandler);
    }
}
