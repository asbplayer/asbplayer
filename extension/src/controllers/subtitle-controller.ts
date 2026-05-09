import {
    AutoPauseContext,
    CopyToClipboardMessage,
    OffsetFromVideoMessage,
    SubtitlesUpdatedFromVideoMessage,
    SubtitleModel,
    SubtitleHtml,
    VideoToExtensionCommand,
    Fetcher,
    HttpPostMessage,
    IndexedSubtitleModel,
    RichSubtitleModel,
    SeekableTracks,
} from '@project/common';
import {
    DictionaryTrack,
    SettingsProvider,
    SubtitleAlignment,
    SubtitleSettings,
    TextSubtitleSettings,
    allTextSubtitleSettings,
} from '@project/common/settings';
import { SubtitleSlice } from '@project/common/subtitle-collection';
import { renderRichTextOntoSubtitles, SubtitleAnnotations } from '@project/common/subtitle-annotations';
import { arrayEquals, computeStyleString, surroundingSubtitles } from '@project/common/util';
import i18n from 'i18next';
import {
    CachingElementOverlay,
    ElementOverlay,
    ElementOverlayParams,
    KeyedHtml,
    OffsetAnchor,
} from '../services/element-overlay';
import { v4 as uuidv4 } from 'uuid';
import { DictionaryProvider } from '@project/common/dictionary-db';

const BOUNDING_BOX_PADDING = 25;

const _intersects = (clientX: number, clientY: number, element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    return (
        clientX >= rect.x - BOUNDING_BOX_PADDING &&
        clientX <= rect.x + rect.width + BOUNDING_BOX_PADDING &&
        clientY >= rect.y - BOUNDING_BOX_PADDING &&
        clientY <= rect.y + rect.height + BOUNDING_BOX_PADDING
    );
};

class VideoFetcher implements Fetcher {
    private readonly videoSrcCB: () => string;

    constructor(videoSrcCB: () => string) {
        this.videoSrcCB = videoSrcCB;
    }

    fetch(url: string, body: any) {
        const httpPostCommand: VideoToExtensionCommand<HttpPostMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'http-post',
                url,
                body,
                messageId: uuidv4(),
            },
            src: this.videoSrcCB(),
        };
        return browser.runtime.sendMessage(httpPostCommand);
    }
}

export default class SubtitleController {
    private readonly video: HTMLMediaElement;
    private readonly dictionary: DictionaryProvider;
    private readonly settings: SettingsProvider;

    private showingSubtitles?: IndexedSubtitleModel[];
    private lastLoadedMessageTimestamp: number;
    private lastOffsetChangeTimestamp: number;
    private showingOffset?: number;
    private subtitlesInterval?: NodeJS.Timeout;
    private showingLoadedMessage: boolean;
    private subtitleSettings?: SubtitleSettings;
    private subtitleStyles?: string[];
    private subtitleClasses?: string[];
    private notificationElementOverlayHideTimeout?: NodeJS.Timeout;
    subtitleAnnotations: SubtitleAnnotations;
    private bottomSubtitlesElementOverlay: ElementOverlay;
    private topSubtitlesElementOverlay: ElementOverlay;
    private notificationElementOverlay: ElementOverlay;
    private shouldRenderBottomOverlay: boolean;
    private shouldRenderTopOverlay: boolean;
    private subtitleTrackAlignments: { [key: number]: SubtitleAlignment | undefined };
    private unblurredSubtitleTracks: { [key: number]: boolean | undefined };
    disabledSubtitleTracks: { [key: number]: boolean | undefined };
    subtitleFileNames?: string[];
    _forceHideSubtitles: boolean;
    _displaySubtitles: boolean;
    surroundingSubtitlesCountRadius: number;
    surroundingSubtitlesTimeRadius: number;
    autoCopyCurrentSubtitle: boolean;
    convertNetflixRuby: boolean;
    subtitleHtml: SubtitleHtml;
    refreshCurrentSubtitle: boolean;
    _preCacheDom;
    dictionaryTrackSettings?: DictionaryTrack[];
    seekableTracks: () => SeekableTracks;

    readonly autoPauseContext: AutoPauseContext = new AutoPauseContext();

    onNextToShow?: (subtitle: SubtitleModel) => void;
    onSlice?: (subtitle: SubtitleSlice<IndexedSubtitleModel>) => void;
    onOffsetChange?: () => void;
    onMouseOver?: (event: MouseEvent) => void;
    onMouseOut?: (event: MouseEvent) => void;

    constructor(
        video: HTMLMediaElement,
        dictionary: DictionaryProvider,
        settings: SettingsProvider,
        seekableTracks: () => SeekableTracks
    ) {
        this.video = video;
        this.dictionary = dictionary;
        this.settings = settings;
        this.seekableTracks = seekableTracks;
        this._preCacheDom = false;
        this.showingSubtitles = [];
        this.shouldRenderBottomOverlay = true;
        this.shouldRenderTopOverlay = false;
        this.unblurredSubtitleTracks = {};
        this.disabledSubtitleTracks = {};
        this.subtitleTrackAlignments = { 0: 'bottom' };
        this._forceHideSubtitles = false;
        this._displaySubtitles = true;
        this.lastLoadedMessageTimestamp = 0;
        this.lastOffsetChangeTimestamp = 0;
        this.showingOffset = undefined;
        this.surroundingSubtitlesCountRadius = 1;
        this.surroundingSubtitlesTimeRadius = 5000;
        this.showingLoadedMessage = false;
        this.autoCopyCurrentSubtitle = false;
        this.convertNetflixRuby = false;
        this.subtitleHtml = SubtitleHtml.remove;
        this.refreshCurrentSubtitle = false;
        const { subtitlesElementOverlay, topSubtitlesElementOverlay, notificationElementOverlay } = this._overlays();
        this.bottomSubtitlesElementOverlay = subtitlesElementOverlay;
        this.topSubtitlesElementOverlay = topSubtitlesElementOverlay;
        this.notificationElementOverlay = notificationElementOverlay;
        this.subtitleAnnotations = new SubtitleAnnotations(
            this.dictionary,
            this.settings,
            { showingCheckRadiusMs: 150 },
            this.video.src,
            (updatedSubtitles) => this._subtitleAnnotationsUpdated(updatedSubtitles),
            () => this.video.currentTime * 1000,
            new VideoFetcher(() => this.video.src)
        );
    }

    get subtitles() {
        return this.subtitleAnnotations.subtitles;
    }

    set subtitles(subtitles) {
        this.subtitleAnnotations.setSubtitles(subtitles);
        this.autoPauseContext.clear();
    }

    reset() {
        this.subtitles = [];
        this.subtitleFileNames = undefined;
        this.cacheHtml();
        this.subtitleAnnotations.reset();
    }

    cacheHtml() {
        const htmls = this._buildSubtitlesHtml(this.subtitles);

        if (this.shouldRenderBottomOverlay && this.bottomSubtitlesElementOverlay instanceof CachingElementOverlay) {
            this.bottomSubtitlesElementOverlay.uncacheHtml();
            for (const html of htmls) {
                this.bottomSubtitlesElementOverlay.cacheHtml(html.key, html.html());
            }
        }
        if (this.shouldRenderTopOverlay && this.topSubtitlesElementOverlay instanceof CachingElementOverlay) {
            this.topSubtitlesElementOverlay.uncacheHtml();
            for (const html of htmls) {
                this.topSubtitlesElementOverlay.cacheHtml(html.key, html.html());
            }
        }
    }

    get bottomSubtitlePositionOffset(): number {
        return this.bottomSubtitlesElementOverlay.contentPositionOffset;
    }

    set bottomSubtitlePositionOffset(value: number) {
        this.bottomSubtitlesElementOverlay.contentPositionOffset = value;
    }

    get topSubtitlePositionOffset(): number {
        return this.topSubtitlesElementOverlay.contentPositionOffset;
    }

    set topSubtitlePositionOffset(value: number) {
        this.topSubtitlesElementOverlay.contentPositionOffset = value;
    }

    set subtitlesWidth(value: number) {
        this.bottomSubtitlesElementOverlay.contentWidthPercentage = value;
        this.topSubtitlesElementOverlay.contentWidthPercentage = value;
    }

    setSubtitleSettings(newSubtitleSettings: SubtitleSettings) {
        const styles = this._computeStyles(newSubtitleSettings);
        const classes = this._computeClasses(newSubtitleSettings);
        if (
            this.subtitleStyles === undefined ||
            !arrayEquals(styles, this.subtitleStyles, (a, b) => a === b) ||
            this.subtitleClasses === undefined ||
            !arrayEquals(classes, this.subtitleClasses, (a, b) => a === b)
        ) {
            this.subtitleStyles = styles;
            this.subtitleClasses = classes;
            this.cacheHtml();
        }

        const newAlignments = allTextSubtitleSettings(newSubtitleSettings).map((s) => s.subtitleAlignment);
        if (!arrayEquals(newAlignments, Object.values(this.subtitleTrackAlignments), (a, b) => a === b)) {
            this.subtitleTrackAlignments = newAlignments;
            this.shouldRenderBottomOverlay = Object.values(this.subtitleTrackAlignments).includes(
                'bottom' as SubtitleAlignment
            );
            this.shouldRenderTopOverlay = Object.values(this.subtitleTrackAlignments).includes(
                'top' as SubtitleAlignment
            );
            const { subtitleOverlayParams, topSubtitleOverlayParams, notificationOverlayParams } =
                this._elementOverlayParams();
            this._applyElementOverlayParams(this.bottomSubtitlesElementOverlay, subtitleOverlayParams);
            this._applyElementOverlayParams(this.topSubtitlesElementOverlay, topSubtitleOverlayParams);
            this._applyElementOverlayParams(this.notificationElementOverlay, notificationOverlayParams);
            this.bottomSubtitlesElementOverlay.hide();
            this.topSubtitlesElementOverlay.hide();
            this.notificationElementOverlay.hide();
        }

        this.unblurredSubtitleTracks = {};

        this.subtitleSettings = newSubtitleSettings;
    }

    private _computeStyles(settings: SubtitleSettings) {
        return allTextSubtitleSettings(settings).map((s) => computeStyleString(s));
    }

    private _computeClasses(settings: SubtitleSettings) {
        return allTextSubtitleSettings(settings).map((s) => this._computeClassesForTrack(s));
    }

    private _computeClassesForTrack(settings: TextSubtitleSettings) {
        return settings.subtitleBlur ? 'asbplayer-subtitles-blurred' : '';
    }

    private _getSubtitleTrackAlignment(trackIndex: number) {
        return this.subtitleTrackAlignments[trackIndex] || this.subtitleTrackAlignments[0];
    }

    private _applyElementOverlayParams(overlay: ElementOverlay, params: ElementOverlayParams) {
        overlay.offsetAnchor = params.offsetAnchor;
        overlay.fullscreenContainerClassName = params.fullscreenContainerClassName;
        overlay.fullscreenContentClassName = params.fullscreenContentClassName;
        overlay.nonFullscreenContainerClassName = params.nonFullscreenContainerClassName;
        overlay.nonFullscreenContentClassName = params.nonFullscreenContentClassName;
    }

    set displaySubtitles(displaySubtitles: boolean) {
        this._displaySubtitles = displaySubtitles;
        this.showingSubtitles = undefined;
    }

    set forceHideSubtitles(forceHideSubtitles: boolean) {
        this._forceHideSubtitles = forceHideSubtitles;
        this.showingSubtitles = undefined;
    }

    private _overlays() {
        const { subtitleOverlayParams, topSubtitleOverlayParams, notificationOverlayParams } =
            this._elementOverlayParams();

        return {
            subtitlesElementOverlay: new CachingElementOverlay(subtitleOverlayParams),
            topSubtitlesElementOverlay: new CachingElementOverlay(topSubtitleOverlayParams),
            notificationElementOverlay: new CachingElementOverlay(notificationOverlayParams),
        };
    }

    private _elementOverlayParams() {
        const subtitleOverlayParams: ElementOverlayParams = {
            targetElement: this.video,
            nonFullscreenContainerClassName: 'asbplayer-subtitles-container-bottom',
            nonFullscreenContentClassName: 'asbplayer-subtitles',
            fullscreenContainerClassName: 'asbplayer-subtitles-container-bottom',
            fullscreenContentClassName: 'asbplayer-fullscreen-subtitles',
            offsetAnchor: OffsetAnchor.bottom,
            contentWidthPercentage: -1,
            onMouseOver: (event: MouseEvent) => this.onMouseOver?.(event),
            onMouseOut: (event: MouseEvent) => this.onMouseOut?.(event),
        };
        const topSubtitleOverlayParams: ElementOverlayParams = {
            targetElement: this.video,
            nonFullscreenContainerClassName: 'asbplayer-subtitles-container-top',
            nonFullscreenContentClassName: 'asbplayer-subtitles',
            fullscreenContainerClassName: 'asbplayer-subtitles-container-top',
            fullscreenContentClassName: 'asbplayer-fullscreen-subtitles',
            offsetAnchor: OffsetAnchor.top,
            contentWidthPercentage: -1,
            onMouseOver: (event: MouseEvent) => this.onMouseOver?.(event),
            onMouseOut: (event: MouseEvent) => this.onMouseOut?.(event),
        };
        const notificationOverlayParams: ElementOverlayParams =
            this._getSubtitleTrackAlignment(0) === 'bottom'
                ? {
                      targetElement: this.video,
                      nonFullscreenContainerClassName: 'asbplayer-notification-container-top',
                      nonFullscreenContentClassName: 'asbplayer-notification',
                      fullscreenContainerClassName: 'asbplayer-notification-container-top',
                      fullscreenContentClassName: 'asbplayer-notification',
                      offsetAnchor: OffsetAnchor.top,
                      contentWidthPercentage: -1,
                      onMouseOver: (event: MouseEvent) => this.onMouseOver?.(event),
                      onMouseOut: (event: MouseEvent) => this.onMouseOut?.(event),
                  }
                : {
                      targetElement: this.video,
                      nonFullscreenContainerClassName: 'asbplayer-notification-container-bottom',
                      nonFullscreenContentClassName: 'asbplayer-notification',
                      fullscreenContainerClassName: 'asbplayer-notification-container-bottom',
                      fullscreenContentClassName: 'asbplayer-notification',
                      offsetAnchor: OffsetAnchor.bottom,
                      contentWidthPercentage: -1,
                      onMouseOver: (event: MouseEvent) => this.onMouseOver?.(event),
                      onMouseOut: (event: MouseEvent) => this.onMouseOut?.(event),
                  };

        return { subtitleOverlayParams, topSubtitleOverlayParams, notificationOverlayParams };
    }

    private _subtitleAnnotationsUpdated(updatedSubtitles: RichSubtitleModel[]): void {
        if (this.dictionaryTrackSettings) {
            renderRichTextOntoSubtitles(updatedSubtitles, this.dictionaryTrackSettings);
        }

        const htmls = this._buildSubtitlesHtml(updatedSubtitles);
        for (const [index, updatedSubtitle] of updatedSubtitles.entries()) {
            const html = htmls[index];
            if (this._getSubtitleTrackAlignment(updatedSubtitle.track) === 'bottom') {
                if (
                    this.shouldRenderBottomOverlay &&
                    this.bottomSubtitlesElementOverlay instanceof CachingElementOverlay
                ) {
                    this.bottomSubtitlesElementOverlay.cacheHtml(html.key, html.html());
                }
            } else {
                if (this.shouldRenderTopOverlay && this.topSubtitlesElementOverlay instanceof CachingElementOverlay) {
                    this.topSubtitlesElementOverlay.cacheHtml(html.key, html.html());
                }
            }
            if (this.showingSubtitles?.some((s) => s.index === updatedSubtitle.index)) {
                this.refreshCurrentSubtitle = true;
            }
        }
        const command: VideoToExtensionCommand<SubtitlesUpdatedFromVideoMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'subtitlesUpdated',
                updatedSubtitles,
            },
            src: this.video.src,
        };
        browser.runtime.sendMessage(command);
    }

    bind() {
        this.subtitleAnnotations.bind();

        this.subtitlesInterval = setInterval(() => {
            if (this.lastLoadedMessageTimestamp > 0 && Date.now() - this.lastLoadedMessageTimestamp < 1000) {
                return;
            }

            if (this.showingLoadedMessage) {
                this._setSubtitlesHtml(this.bottomSubtitlesElementOverlay, [{ html: () => '' }]);
                this._setSubtitlesHtml(this.topSubtitlesElementOverlay, [{ html: () => '' }]);
                this.showingLoadedMessage = false;
            }

            if (this.subtitles.length === 0) {
                return;
            }

            const showOffset = this.lastOffsetChangeTimestamp > 0 && Date.now() - this.lastOffsetChangeTimestamp < 1000;
            const offset = showOffset ? this._computeOffset() : 0;
            const slice = this.subtitleAnnotations.subtitlesAt(this.video.currentTime * 1000, this.seekableTracks());

            const showingSubtitles = this._findShowingSubtitles(slice);

            this.onSlice?.(slice);

            if (slice.willStopShowing && this._trackEnabled(slice.willStopShowing)) {
                this.autoPauseContext.willStopShowing(slice.willStopShowing);
            }

            if (slice.startedShowing && this._trackEnabled(slice.startedShowing)) {
                this.autoPauseContext.startedShowing(slice.startedShowing);
            }

            if (slice.nextToShow && slice.nextToShow.length > 0) {
                this.onNextToShow?.(slice.nextToShow[0]);
            }

            const subtitlesAreNew =
                this.showingSubtitles === undefined ||
                !arrayEquals(showingSubtitles, this.showingSubtitles, (a, b) => a.index === b.index);

            if (subtitlesAreNew) {
                this.showingSubtitles = showingSubtitles;
                this._autoCopyToClipboard(showingSubtitles);
            }

            const shouldRenderOffset =
                (showOffset && offset !== this.showingOffset) || (!showOffset && this.showingOffset !== undefined);

            if ((!showOffset && !this._displaySubtitles) || this._forceHideSubtitles) {
                this.bottomSubtitlesElementOverlay.hide();
                this.topSubtitlesElementOverlay.hide();
            } else if (subtitlesAreNew || shouldRenderOffset || this.refreshCurrentSubtitle) {
                if (this.refreshCurrentSubtitle) this.refreshCurrentSubtitle = false;
                this._resetUnblurState();
                if (this.shouldRenderBottomOverlay) {
                    const showingSubtitlesBottom = showingSubtitles.filter(
                        (s) => this._getSubtitleTrackAlignment(s.track) === 'bottom'
                    );
                    this._renderSubtitles(showingSubtitlesBottom, OffsetAnchor.bottom);
                }
                if (this.shouldRenderTopOverlay) {
                    const showingSubtitlesTop = showingSubtitles.filter(
                        (s) => this._getSubtitleTrackAlignment(s.track) === 'top'
                    );
                    this._renderSubtitles(showingSubtitlesTop, OffsetAnchor.top);
                }

                if (showOffset) {
                    this._appendSubtitlesHtml(this._buildTextHtml(this._formatOffset(offset)));
                    this.showingOffset = offset;
                } else {
                    this.showingOffset = undefined;
                }
            }
        }, 100);
    }

    private _renderSubtitles(subtitles: IndexedSubtitleModel[], offset: OffsetAnchor) {
        if (offset == OffsetAnchor.top) {
            this._setSubtitlesHtml(this.topSubtitlesElementOverlay, this._buildSubtitlesHtml(subtitles));
        } else {
            this._setSubtitlesHtml(this.bottomSubtitlesElementOverlay, this._buildSubtitlesHtml(subtitles));
        }
    }

    private _resetUnblurState() {
        if (Object.keys(this.unblurredSubtitleTracks).length === 0) {
            return;
        }

        for (const element of [
            ...this.bottomSubtitlesElementOverlay.displayingElements(),
            ...this.topSubtitlesElementOverlay.displayingElements(),
        ]) {
            const track = Number(element.dataset.track);

            if (this.unblurredSubtitleTracks[track] === true) {
                element.classList.add('asbplayer-subtitles-blurred');
            }
        }

        this.unblurredSubtitleTracks = {};
    }

    private _autoCopyToClipboard(subtitles: SubtitleModel[]) {
        if (this.autoCopyCurrentSubtitle && subtitles.length > 0 && document.hasFocus()) {
            const text = subtitles
                .map((s) => s.text)
                .filter((text) => text !== '')
                .join('\n');

            if (text !== '') {
                const command: VideoToExtensionCommand<CopyToClipboardMessage> = {
                    sender: 'asbplayer-video',
                    message: {
                        command: 'copy-to-clipboard',
                        dataUrl: `data:,${encodeURIComponent(text)}`,
                    },
                    src: this.video.src,
                };

                browser.runtime.sendMessage(command);
            }
        }
    }

    private _findShowingSubtitles(slice: SubtitleSlice<IndexedSubtitleModel>): IndexedSubtitleModel[] {
        return slice.showing.filter((s) => this._trackEnabled(s)).sort((s1, s2) => s1.track - s2.track);
    }

    private _trackEnabled(subtitle: SubtitleModel) {
        return subtitle.track === undefined || !this.disabledSubtitleTracks[subtitle.track];
    }

    private _buildSubtitlesHtml(subtitles: IndexedSubtitleModel[]) {
        return subtitles.map((subtitle) => {
            return {
                html: () => {
                    if (subtitle.textImage) {
                        const className = this.subtitleClasses?.[subtitle.track] ?? '';
                        const imageScale =
                            ((this.subtitleSettings?.imageBasedSubtitleScaleFactor ?? 1) *
                                this.video.getBoundingClientRect().width) /
                            subtitle.textImage.screen.width;
                        const width = imageScale * subtitle.textImage.image.width;

                        return `
                            <div data-track="${
                                subtitle.track ?? 0
                            }" style="max-width:${width}px;margin:auto;" class="${className}"}">
                                <img
                                    style="width:100%;"
                                    alt="subtitle"
                                    src="${subtitle.textImage.dataUrl}"
                                />
                            </div>
                        `;
                    } else {
                        return this._buildTextHtml(subtitle.text, subtitle.track, subtitle.richText);
                    }
                },
                key: String(subtitle.index),
            };
        });
    }

    private _buildTextHtml(text: string, track?: number, richText?: string) {
        if (richText && this.subtitleAnnotations.hoverOnly(track!)) {
            return `<span data-track="${track!}" class="${this._subtitleClasses(track)}" style="${this._subtitleStyles(track)}"><span class="asbplayer-subtitle-text">${text}</span><span class="asbplayer-subtitle-rich">${richText}</span></span>`;
        }
        return `<span data-track="${track ?? 0}" class="${this._subtitleClasses(track)}" style="${this._subtitleStyles(track)}">${richText ?? text}</span>`;
    }

    unbind() {
        this.subtitleAnnotations.unbind();

        if (this.subtitlesInterval) {
            clearInterval(this.subtitlesInterval);
            this.subtitlesInterval = undefined;
        }

        if (this.notificationElementOverlayHideTimeout) {
            clearTimeout(this.notificationElementOverlayHideTimeout);
            this.notificationElementOverlayHideTimeout = undefined;
        }

        this.bottomSubtitlesElementOverlay.dispose();
        this.topSubtitlesElementOverlay.dispose();
        this.notificationElementOverlay.dispose();
        this.onNextToShow = undefined;
        this.onSlice = undefined;
        this.onOffsetChange = undefined;
        this.onMouseOver = undefined;
        this.onMouseOut = undefined;
    }

    refresh() {
        if (this.shouldRenderBottomOverlay) this.bottomSubtitlesElementOverlay.refresh();
        if (this.shouldRenderTopOverlay) this.topSubtitlesElementOverlay.refresh();
        this.notificationElementOverlay.refresh();
    }

    subtitleAtIndex(index: number): [IndexedSubtitleModel | null, SubtitleModel[] | null] {
        const subtitle = this.subtitles[index];
        if (!subtitle) return [null, null];
        return [
            subtitle,
            surroundingSubtitles(
                this.subtitles,
                index,
                this.surroundingSubtitlesCountRadius,
                this.surroundingSubtitlesTimeRadius
            ),
        ];
    }

    currentSubtitle(): [IndexedSubtitleModel | null, SubtitleModel[] | null] {
        const now = 1000 * this.video.currentTime;
        let subtitle = null;
        let index = null;

        for (let i = 0; i < this.subtitles.length; ++i) {
            const s = this.subtitles[i];

            if (
                now >= s.start &&
                now < s.end &&
                (typeof s.track === 'undefined' || !this.disabledSubtitleTracks[s.track])
            ) {
                subtitle = s;
                index = i;
                break;
            }
        }

        if (index === null) return [null, null];
        return this.subtitleAtIndex(index);
    }

    unblur(track: number) {
        for (const element of [
            ...this.bottomSubtitlesElementOverlay.displayingElements(),
            ...this.topSubtitlesElementOverlay.displayingElements(),
        ]) {
            const elementTrack = Number(element.dataset.track);

            if (track === elementTrack && element.classList.contains('asbplayer-subtitles-blurred')) {
                this.unblurredSubtitleTracks[track] = true;
                element.classList.remove('asbplayer-subtitles-blurred');
            }
        }
    }

    offset(offset: number, skipNotifyPlayer = false) {
        if (!this.subtitles || this.subtitles.length === 0) {
            return;
        }

        this.subtitles = this.subtitles.map((s) => ({
            text: s.text,
            textImage: s.textImage,
            start: s.originalStart + offset,
            originalStart: s.originalStart,
            end: s.originalEnd + offset,
            originalEnd: s.originalEnd,
            track: s.track,
            index: s.index,
        }));

        this.lastOffsetChangeTimestamp = Date.now();

        if (!skipNotifyPlayer) {
            const command: VideoToExtensionCommand<OffsetFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'offset',
                    value: offset,
                },
                src: this.video.src,
            };

            browser.runtime.sendMessage(command);
        }

        this.onOffsetChange?.();

        this.settings.getSingle('rememberSubtitleOffset').then((rememberSubtitleOffset) => {
            if (rememberSubtitleOffset) {
                this.settings.set({ lastSubtitleOffset: offset });
            }
        });
    }

    private _computeOffset(): number {
        if (!this.subtitles || this.subtitles.length === 0) {
            return 0;
        }

        const s = this.subtitles[0];
        return s.start - s.originalStart;
    }

    private _formatOffset(offset: number): string {
        const roundedOffset = Math.floor(offset);
        return roundedOffset >= 0 ? '+' + roundedOffset + ' ms' : roundedOffset + ' ms';
    }

    notification(locKey: string, replacements?: { [key: string]: string }) {
        const text = i18n.t(locKey, replacements ?? {});
        this.notificationElementOverlay.setHtml([{ html: () => this._buildTextHtml(text) }]);

        if (this.notificationElementOverlayHideTimeout) {
            clearTimeout(this.notificationElementOverlayHideTimeout);
        }

        this.notificationElementOverlayHideTimeout = setTimeout(() => {
            this.notificationElementOverlay.hide();
            this.notificationElementOverlayHideTimeout = undefined;
        }, 3000);
    }

    showLoadedMessage(nonEmptyTrackIndex: number[]) {
        if (!this.subtitleFileNames) {
            return;
        }

        let loadedMessage: string;

        const nonEmptySubtitleFileNames: string[] = this._nonEmptySubtitleNames(nonEmptyTrackIndex);

        if (nonEmptySubtitleFileNames.length === 0) {
            loadedMessage = this.subtitleFileNames[0];
        } else {
            loadedMessage = nonEmptySubtitleFileNames.join('<br>');
        }

        if (this.subtitles.length > 0) {
            const offset = this.subtitles[0].start - this.subtitles[0].originalStart;

            if (offset !== 0) {
                loadedMessage += `<br>${this._formatOffset(offset)}`;
            }
        }

        const overlay =
            this._getSubtitleTrackAlignment(0) === 'bottom'
                ? this.bottomSubtitlesElementOverlay
                : this.topSubtitlesElementOverlay;
        this._setSubtitlesHtml(overlay, [
            {
                html: () => {
                    return this._buildTextHtml(loadedMessage);
                },
            },
        ]);
        this.showingLoadedMessage = true;
        this.lastLoadedMessageTimestamp = Date.now();
    }

    private _nonEmptySubtitleNames(nonEmptyTrackIndex: number[]) {
        if (nonEmptyTrackIndex.length === 0) return [];

        const nonEmptySubtitleFileNames = [];
        for (let i = 0; i < nonEmptyTrackIndex.length; i++) {
            nonEmptySubtitleFileNames.push(this.subtitleFileNames![nonEmptyTrackIndex[i]]);
        }

        return nonEmptySubtitleFileNames;
    }

    private _setSubtitlesHtml(subtitlestOverlay: ElementOverlay, htmls: KeyedHtml[]) {
        subtitlestOverlay.setHtml(htmls);
    }

    private _appendSubtitlesHtml(html: string) {
        if (this.shouldRenderBottomOverlay) this.bottomSubtitlesElementOverlay.appendHtml(html);
        if (this.shouldRenderTopOverlay) this.topSubtitlesElementOverlay.appendHtml(html);
    }

    private _subtitleClasses(track?: number) {
        if (track === undefined || this.subtitleClasses === undefined) {
            return '';
        }

        return this.subtitleClasses[track] ?? this.subtitleClasses;
    }

    private _subtitleStyles(track?: number) {
        if (this.subtitleStyles === undefined) {
            return '';
        }

        if (track === undefined) {
            return this.subtitleStyles[0] ?? '';
        }

        return this.subtitleStyles[track] ?? this.subtitleStyles[0] ?? '';
    }

    intersects(clientX: number, clientY: number): boolean {
        const bottomContainer = this.bottomSubtitlesElementOverlay.containerElement;

        if (bottomContainer !== undefined && _intersects(clientX, clientY, bottomContainer)) {
            return true;
        }

        const topContainer = this.topSubtitlesElementOverlay.containerElement;

        if (topContainer !== undefined && _intersects(clientX, clientY, topContainer)) {
            return true;
        }

        return false;
    }
}
