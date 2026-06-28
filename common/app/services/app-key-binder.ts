import { CopySubtitleMessage, PostMineAction, SubtitleModel } from '@project/common';
import { DefaultKeyBinder, KeyBinder } from '@project/common/key-binder';
import { SeekableTracks, TokenStatus } from '@project/common/settings';
import ChromeExtension, { ExtensionMessage } from './chrome-extension';

export default class AppKeyBinder implements KeyBinder {
    private readonly defaultKeyBinder: DefaultKeyBinder;
    private readonly extension: ChromeExtension;
    private readonly copyHandlers: ((event: KeyboardEvent) => void)[] = [];
    private readonly ankiExportHandlers: ((event: KeyboardEvent) => void)[] = [];
    private readonly updateLastCardHandlers: ((event: KeyboardEvent) => void)[] = [];
    private readonly exportCardHandlers: ((event: KeyboardEvent) => void)[] = [];
    private readonly takeScreenshotHandlers: ((event: KeyboardEvent) => void)[] = [];
    private readonly toggleRecordingHandlers: ((event: KeyboardEvent) => void)[] = [];
    private _unsubscribeExtension?: () => void;

    constructor(keyBinder: DefaultKeyBinder, extension: ChromeExtension) {
        this.defaultKeyBinder = keyBinder;
        this.extension = extension;

        if (this.extension.installed) {
            const listener = (message: ExtensionMessage) => {
                let handlers: ((event: KeyboardEvent) => void)[] | undefined;
                if (message.data.command === 'copy-subtitle') {
                    const command = message.data as CopySubtitleMessage;

                    switch (command.postMineAction) {
                        case PostMineAction.none:
                            handlers = this.copyHandlers;
                            break;
                        case PostMineAction.showAnkiDialog:
                            handlers = this.ankiExportHandlers;
                            break;
                        case PostMineAction.updateLastCard:
                            handlers = this.updateLastCardHandlers;
                            break;
                        case PostMineAction.exportCard:
                            handlers = this.exportCardHandlers;
                            break;
                        default:
                            console.error('Unknown post mine action ' + command.postMineAction);
                    }
                } else if (message.data.command === 'take-screenshot') {
                    handlers = this.takeScreenshotHandlers;
                } else if (message.data.command === 'toggle-recording') {
                    handlers = this.toggleRecordingHandlers;
                }

                if (handlers !== undefined) {
                    for (const h of handlers) {
                        h(new KeyboardEvent('mock'));
                    }
                }
            };
            this._unsubscribeExtension = extension.subscribe(listener);
        }
    }

    bindCopy<T extends SubtitleModel = SubtitleModel>(
        onCopy: (event: KeyboardEvent, subtitle: T) => void,
        disabledGetter: () => boolean,
        subtitleGetter: () => T | undefined,
        useCapture?: boolean | undefined
    ): () => void {
        if (this.extension.installed) {
            const handler = this.defaultKeyBinder.copyHandler(onCopy, disabledGetter, subtitleGetter);
            this.copyHandlers.push(handler);
            return () => {
                this._remove(handler, this.copyHandlers);
            };
        }

        return this.defaultKeyBinder.bindCopy(onCopy, disabledGetter, subtitleGetter, useCapture);
    }

    bindAnkiExport(
        onAnkiExport: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        if (this.extension.installed) {
            const handler = this.defaultKeyBinder.ankiExportHandler(onAnkiExport, disabledGetter);
            this.ankiExportHandlers.push(handler);
            return () => {
                this._remove(handler, this.ankiExportHandlers);
            };
        }

        return this.defaultKeyBinder.bindAnkiExport(onAnkiExport, disabledGetter, useCapture);
    }

    bindUpdateLastCard(
        onUpdateLastCard: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        if (this.extension.installed) {
            const handler = this.defaultKeyBinder.updateLastCardHandler(onUpdateLastCard, disabledGetter);
            this.updateLastCardHandlers.push(handler);
            return () => {
                this._remove(handler, this.updateLastCardHandlers);
            };
        }

        return this.defaultKeyBinder.bindUpdateLastCard(onUpdateLastCard, disabledGetter, useCapture);
    }

    bindExportCard(
        onExportCard: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        if (this.extension.installed) {
            const handler = this.defaultKeyBinder.exportCardHandler(onExportCard, disabledGetter);
            this.exportCardHandlers.push(handler);
            return () => {
                this._remove(handler, this.exportCardHandlers);
            };
        }

        return this.defaultKeyBinder.bindExportCard(onExportCard, disabledGetter, useCapture);
    }

    bindTakeScreenshot(
        onTakeScreenshot: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        if (this.extension.installed) {
            const handler = this.defaultKeyBinder.takeScreenshotHandler(onTakeScreenshot, disabledGetter);
            this.takeScreenshotHandlers.push(handler);
            return () => {
                this._remove(handler, this.takeScreenshotHandlers);
            };
        }

        return this.defaultKeyBinder.bindTakeScreenshot(onTakeScreenshot, disabledGetter, useCapture);
    }

    bindToggleRecording(
        onToggleRecording: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        if (this.extension.installed) {
            const handler = this.defaultKeyBinder.toggleRecordingHandler(onToggleRecording, disabledGetter);
            this.toggleRecordingHandlers.push(handler);
            return () => {
                this._remove(handler, this.toggleRecordingHandlers);
            };
        }

        return this.defaultKeyBinder.bindToggleRecording(onToggleRecording, disabledGetter, useCapture);
    }

    private _remove(callback: (event: KeyboardEvent) => void, list: ((event: KeyboardEvent) => void)[]) {
        for (let i = list.length - 1; i >= 0; --i) {
            if (callback === list[i]) {
                list.splice(i, 1);
                break;
            }
        }
    }

    bindSeekToSubtitle(
        onSeekToSubtitle: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        seekableTracksGetter: () => SeekableTracks,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindSeekToSubtitle(
            onSeekToSubtitle,
            disabledGetter,
            timeGetter,
            subtitlesGetter,
            seekableTracksGetter,
            useCapture
        );
    }

    bindSeekToBeginningOfCurrentSubtitle(
        onSeekToBeginningOfCurrentSubtitle: (event: KeyboardEvent, subtitle: SubtitleModel) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        seekableTracksGetter: () => SeekableTracks,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindSeekToBeginningOfCurrentSubtitle(
            onSeekToBeginningOfCurrentSubtitle,
            disabledGetter,
            timeGetter,
            subtitlesGetter,
            seekableTracksGetter,
            useCapture
        );
    }

    bindSeekBackwardOrForward(
        onSeekBackwardOrForward: (event: KeyboardEvent, forward: boolean) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindSeekBackwardOrForward(onSeekBackwardOrForward, disabledGetter, useCapture);
    }

    bindOffsetToSubtitle(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        timeGetter: () => number,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        seekableTracksGetter: () => SeekableTracks,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindOffsetToSubtitle(
            onOffsetChange,
            disabledGetter,
            timeGetter,
            subtitlesGetter,
            seekableTracksGetter,
            useCapture
        );
    }

    bindAdjustOffset(
        onOffsetChange: (event: KeyboardEvent, newOffset: number) => void,
        disabledGetter: () => boolean,
        subtitlesGetter: () => SubtitleModel[] | undefined,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindAdjustOffset(onOffsetChange, disabledGetter, subtitlesGetter, useCapture);
    }

    bindResetOffet(
        onResetOffset: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindResetOffet(onResetOffset, disabledGetter, useCapture);
    }

    bindAdjustPlaybackRate(
        onAdjustPlaybackRate: (event: KeyboardEvent, increase: boolean) => void,
        disabledGetter: () => boolean,
        useCapture = false
    ) {
        return this.defaultKeyBinder.bindAdjustPlaybackRate(onAdjustPlaybackRate, disabledGetter, useCapture);
    }

    bindToggleSubtitles(
        onToggleSubtitles: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindToggleSubtitles(onToggleSubtitles, disabledGetter, useCapture);
    }

    bindToggleSubtitleTrackInVideo(
        onToggleSubtitleTrack: (event: KeyboardEvent, extra: any) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindToggleSubtitleTrackInVideo(onToggleSubtitleTrack, disabledGetter, useCapture);
    }

    bindToggleSubtitleTrackInList(
        onToggleSubtitleTrackInList: (event: KeyboardEvent, extra: any) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindToggleSubtitleTrackInList(
            onToggleSubtitleTrackInList,
            disabledGetter,
            useCapture
        );
    }

    bindUnblurTrack(
        onUnblurTrack: (event: KeyboardEvent, track: number) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindUnblurTrack(onUnblurTrack, disabledGetter, useCapture);
    }

    bindMarkHoveredToken(
        onMarkHoveredToken: (event: KeyboardEvent, tokenStatus: TokenStatus) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindMarkHoveredToken(onMarkHoveredToken, disabledGetter, useCapture);
    }

    bindToggleHoveredTokenIgnored(
        onToggleHoveredTokenIgnored: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindToggleHoveredTokenIgnored(
            onToggleHoveredTokenIgnored,
            disabledGetter,
            useCapture
        );
    }

    bindOpenStatistics(
        onOpenStatistics: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindOpenStatistics(onOpenStatistics, disabledGetter, useCapture);
    }

    bindPlay(
        onPlay: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindPlay(onPlay, disabledGetter, useCapture);
    }

    bindAutoPause(
        onAutoPause: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindAutoPause(onAutoPause, disabledGetter, useCapture);
    }

    bindCondensedPlayback(
        onCondensedPlayback: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindCondensedPlayback(onCondensedPlayback, disabledGetter, useCapture);
    }

    bindFastForwardPlayback(
        onFastForwardPlayback: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindFastForwardPlayback(onFastForwardPlayback, disabledGetter, useCapture);
    }

    bindToggleSidePanel(
        onToggleSidePanel: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindToggleSidePanel(onToggleSidePanel, disabledGetter, useCapture);
    }

    bindToggleRepeat(
        onToggleRepeat: (event: KeyboardEvent) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindToggleRepeat(onToggleRepeat, disabledGetter, useCapture);
    }

    bindAdjustSubtitlePositionOffset(
        onAdjustSubtitlePositionOffset: (event: KeyboardEvent, increase: boolean) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindAdjustSubtitlePositionOffset(
            onAdjustSubtitlePositionOffset,
            disabledGetter,
            useCapture
        );
    }

    bindAdjustTopSubtitlePositionOffset(
        onAdjustTopSubtitlePositionOffset: (event: KeyboardEvent, increase: boolean) => void,
        disabledGetter: () => boolean,
        useCapture?: boolean | undefined
    ): () => void {
        return this.defaultKeyBinder.bindAdjustTopSubtitlePositionOffset(
            onAdjustTopSubtitlePositionOffset,
            disabledGetter,
            useCapture
        );
    }

    unsubscribeExtension() {
        this._unsubscribeExtension?.();
    }
}
