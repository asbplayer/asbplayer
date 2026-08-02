import {
    MobileOverlayToVideoCommand,
    MobileOverlayModel,
    UpdateMobileOverlayModelMessage,
    VideoToExtensionCommand,
    PlayModeMessage,
} from '@project/common';
import type Binding from '../services/binding';
import { CachingElementOverlay, OffsetAnchor } from '../services/element-overlay';
import { adjacentSubtitle } from '@project/common/key-binder';
import { frameColorScheme, frameColorSchemeClass } from '../services/frame-color-scheme';
import { v4 as uuidv4 } from 'uuid';
import { PlayMode } from '@project/common';

const smallScreenVideoHeightThreshold = 300;

interface FrameParams {
    width: number;
    height: number;
    anchor: 'bottom' | 'top';
    src: string;
    tooltips: boolean;
}

export class MobileVideoOverlayController {
    private readonly _context: Binding;
    private _overlay: CachingElementOverlay;
    private _pauseListener?: () => void;
    private _playListener?: () => void;
    private _seekedListener?: () => void;
    private _forceHiding: boolean = false;
    private _showing: boolean = false;
    private _uiInitialized: boolean = false;
    private _messageListener?: (
        message: any,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;
    private _bound = false;
    private _frameParams?: FrameParams;
    private _enabled = false;
    private _configuredOffsetAnchor: OffsetAnchor;
    private _playModeSelectorRequest?: number;
    private _playModeSelectorOpen = false;
    private _overlayInstanceId = uuidv4();
    private _playModes = new Set<PlayMode>([PlayMode.normal]);

    constructor(context: Binding, offsetAnchor: OffsetAnchor) {
        this._context = context;
        this._configuredOffsetAnchor = offsetAnchor;
        this._overlay = MobileVideoOverlayController._elementOverlay(context.video, offsetAnchor);
    }

    private static _elementOverlay(video: HTMLMediaElement, offsetAnchor: OffsetAnchor) {
        const containerClassName =
            offsetAnchor === OffsetAnchor.top
                ? 'asbplayer-mobile-video-overlay-container-top'
                : 'asbplayer-mobile-video-overlay-container-bottom';
        return new CachingElementOverlay({
            targetElement: video,
            nonFullscreenContainerClassName: containerClassName,
            fullscreenContainerClassName: containerClassName,
            nonFullscreenContentClassName: 'asbplayer-mobile-video-overlay',
            fullscreenContentClassName: 'asbplayer-mobile-video-overlay',
            offsetAnchor,
            contentPositionOffset: 8,
            contentWidthPercentage: -1,
            onMouseOver: () => {},
            onMouseOut: () => {},
        });
    }

    set offsetAnchor(value: OffsetAnchor) {
        this._configuredOffsetAnchor = value;
        if (this._playModeSelectorRequest !== undefined) return;

        this._setOverlayOffsetAnchor(value);
    }

    private _setOverlayOffsetAnchor(value: OffsetAnchor) {
        if (this._overlay.offsetAnchor === value) {
            return false;
        }

        this._overlay.dispose();
        this._overlay = MobileVideoOverlayController._elementOverlay(this._context.video, value);
        this._overlayInstanceId = uuidv4();

        if (this._showing) {
            this._doShow();
        }

        return true;
    }

    set enabled(value: boolean) {
        this._enabled = value;
        if (value) {
            this.bind();
        } else if (this._playModeSelectorRequest === undefined) {
            this.unbind();
        }
    }

    set forceHide(forceHide: boolean) {
        if (!this._bound) return;

        if (forceHide) {
            if (this._showing) this._doHide();
            this._forceHiding = true;
        } else if (this._forceHiding) {
            this._forceHiding = false;
            this._show();
        }
    }

    bind() {
        if (this._bound) {
            return;
        }

        this._pauseListener = () => {
            if (this._enabled) {
                this._show();
                void this.updateModel();
            }
        };
        this._playListener = () => {
            if (this._playModeSelectorRequest === undefined) this._hide();
        };
        this._seekedListener = () => {
            void this.updateModel();
        };

        this._context.video.addEventListener('pause', this._pauseListener);
        this._context.video.addEventListener('play', this._playListener);
        this._context.video.addEventListener('seeked', this._seekedListener);
        this._messageListener = (
            message: any,
            sender: Browser.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (
                message.sender !== 'asbplayer-mobile-overlay-to-video' ||
                message.src !== this._context.registeredVideoSrc
            ) {
                return;
            }

            if (message.message.command === 'request-mobile-overlay-model') {
                void this._model().then(sendResponse);
                this._uiInitialized = true;
                return true;
            }

            if (message.message.command === 'playMode') {
                const command = message as MobileOverlayToVideoCommand<PlayModeMessage>;
                this._playModeSelectorOpen = true;
                this._context.togglePlayMode(command.message.playMode);
            } else if (message.message.command === 'playback-mode-selector-opened') {
                this._playModeSelectorOpen = true;
            } else if (message.message.command === 'hidden') {
                this._doHide();
            } else if (message.message.command === 'playback-mode-selector-closed') {
                this._playModeSelectorClosed();
            }
        };
        browser.runtime.onMessage.addListener(this._messageListener);
        this._bound = true;

        if (this._context.video.paused && this._enabled) {
            this._show();
        }
    }

    async updateModel() {
        if (!this._bound || !this._uiInitialized) {
            return;
        }

        const model = await this._model();
        const command: VideoToExtensionCommand<UpdateMobileOverlayModelMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'update-mobile-overlay-model',
                model,
            },
            src: this._context.registeredVideoSrc,
        };
        void browser.runtime.sendMessage(command);
    }

    setPlaybackModes(modes: ReadonlySet<PlayMode>): void {
        this._playModes = new Set(modes);
    }

    private async _model() {
        const subtitles = this._context.subtitleController.subtitles;
        const subtitleDisplaying =
            subtitles.length > 0 && this._context.subtitleController.currentSubtitle()[0] !== null;
        const timestamp = this._context.currentTimeMs;
        const { language, clickToMineDefaultAction, themeType, streamingDisplaySubtitles, seekableTracks } =
            await this._context.settings.get([
                'language',
                'clickToMineDefaultAction',
                'themeType',
                'streamingDisplaySubtitles',
                'seekableTracks',
            ]);
        const model: MobileOverlayModel = {
            offset: subtitles.length === 0 ? 0 : subtitles[0].start - subtitles[0].originalStart,
            playbackRate: this._context.video.playbackRate,
            emptySubtitleTrack: subtitles.length === 0,
            recordingEnabled: this._context.recordMedia,
            recording: this._context.recordingMedia,
            previousSubtitleTimestamp:
                adjacentSubtitle(false, timestamp, subtitles, seekableTracks)?.originalStart ?? undefined,
            nextSubtitleTimestamp:
                adjacentSubtitle(true, timestamp, subtitles, seekableTracks)?.originalStart ?? undefined,
            currentTimestamp: timestamp,
            language,
            postMineAction: clickToMineDefaultAction,
            subtitleDisplaying,
            subtitlesAreVisible: streamingDisplaySubtitles,
            playModes: Array.from(this._playModes),
            playModeSelectorRequest: this._playModeSelectorRequest,
            overlayInstanceId: this._overlayInstanceId,
            themeType,
        };
        return model;
    }

    show() {
        if (!this._bound) {
            return;
        }

        this._show();
    }

    showPlaybackModes() {
        if (this._playModeSelectorOpen) {
            void this.updateModel();
            return;
        }
        if (this._playModeSelectorRequest !== undefined) {
            this._playModeSelectorRequest += 1;
            void this.updateModel();
            return;
        }
        this._playModeSelectorRequest = (this._playModeSelectorRequest ?? 0) + 1;
        if (this._forceHiding) return;
        this._setOverlayOffsetAnchor(OffsetAnchor.top);
        this.bind();
        this._show();
        void this.updateModel();
    }

    private _playModeSelectorClosed() {
        this._playModeSelectorOpen = false;
        this._playModeSelectorRequest = undefined;

        if (!this._enabled) {
            this.unbind();
            return;
        }

        if (!this._context.video.paused) this._doHide();
        const anchorChanged = this._setOverlayOffsetAnchor(this._configuredOffsetAnchor);
        if (this._showing && !anchorChanged) this._doShow();
        void this.updateModel();
    }

    disposeOverlay() {
        this._overlay.dispose();
        this._overlay = MobileVideoOverlayController._elementOverlay(this._context.video, this._overlay.offsetAnchor);
        this._overlayInstanceId = uuidv4();
    }

    private _show() {
        if (
            !this._context.synced ||
            this._forceHiding ||
            (!this._enabled && this._playModeSelectorRequest === undefined)
        ) {
            return;
        }

        this._doShow();
    }

    private _doShow() {
        const frameParams = this._getFrameParams();
        const { width, height, anchor, src, tooltips } = frameParams;

        if (this._frameParams !== undefined && this._differentFrameParams(frameParams, this._frameParams)) {
            this._overlay.uncacheHtml();
            this._overlayInstanceId = uuidv4();
        }

        const colorScheme = frameColorScheme();
        const colorSchemeClass = frameColorSchemeClass();
        this._overlay.setHtml([
            {
                key: 'ui',
                html: () =>
                    `<iframe class="${colorSchemeClass}" allowtransparency="true" style="border: 0; color-scheme: ${colorScheme}; width: ${width}px; height: ${height}px" src="${browser.runtime.getURL(
                        '/mobile-video-overlay-ui.html'
                    )}?src=${src}&anchor=${anchor}&tooltips=${tooltips}&colorScheme=${encodeURIComponent(
                        colorScheme
                    )}&overlayId=${encodeURIComponent(this._overlayInstanceId)}"/>`,
            },
        ]);

        this._frameParams = frameParams;
        this._showing = true;
    }

    private _getFrameParams(): FrameParams {
        const anchor = this._overlay.offsetAnchor === OffsetAnchor.bottom ? 'bottom' : 'top';
        const videoRect = this._context.video.getBoundingClientRect();
        const smallScreen = videoRect.height < smallScreenVideoHeightThreshold;
        const height = this._playModeSelectorRequest === undefined ? (smallScreen ? 64 : 108) : 128;
        const tooltips = !smallScreen;
        const width = Math.min(window.innerWidth, this._playModeSelectorRequest === undefined ? 410 : 1000);
        const src = encodeURIComponent(this._context.registeredVideoSrc);

        return { width, height, anchor, src, tooltips };
    }

    private _differentFrameParams(a: FrameParams, b: FrameParams) {
        if (a.width !== b.width) {
            return true;
        }

        if (a.height !== b.height) {
            return true;
        }

        if (a.anchor !== b.anchor) {
            return true;
        }

        if (a.src !== b.src) {
            return true;
        }

        if (a.tooltips !== b.tooltips) {
            return true;
        }

        return false;
    }

    hide() {
        if (!this._bound) {
            return;
        }

        this._hide();
    }

    private _hide() {
        if (!this._context.synced || this._context.recordingMedia) {
            return;
        }

        this._doHide();
    }

    private _doHide() {
        this._overlay.hide();
        this._showing = false;
    }

    unbind() {
        this._playModeSelectorOpen = false;
        this._playModeSelectorRequest = undefined;
        if (this._pauseListener) {
            this._context.video.removeEventListener('pause', this._pauseListener);
            this._pauseListener = undefined;
        }

        if (this._playListener) {
            this._context.video.removeEventListener('play', this._playListener);
            this._playListener = undefined;
        }

        if (this._seekedListener) {
            this._context.video.removeEventListener('seeked', this._seekedListener);
            this._seekedListener = undefined;
        }

        if (this._messageListener) {
            browser.runtime.onMessage.removeListener(this._messageListener);
            this._messageListener = undefined;
        }

        this._overlay.dispose();
        this._overlay = MobileVideoOverlayController._elementOverlay(this._context.video, this._configuredOffsetAnchor);
        this._overlayInstanceId = uuidv4();
        this._showing = false;
        this._uiInitialized = false;
        this._bound = false;
    }
}
