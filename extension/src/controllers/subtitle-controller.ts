import {
    CopyToClipboardMessage,
    OffsetFromVideoMessage,
    SubtitlesUpdatedFromVideoMessage,
    SubtitleModel,
    SubtitleHtml,
    VideoToExtensionCommand,
    Fetcher,
    HttpPostMessage,
    IndexedSubtitleModel,
} from '@project/common';
import {
    AutoCopyableTracks,
    DictionaryTrack,
    SettingsProvider,
    SubtitleAlignment,
    SubtitleSettings,
    TextSubtitleSettings,
    allTextSubtitleSettings,
    calculateAutoCopyableTracksValue,
    isTrackAutoCopyable,
    tokenAnnotationStyleValues,
} from '@project/common/settings';
import { SubtitleCollectionOptions } from '@project/common/subtitle-collection';
import {
    renderRichTextOntoSubtitles,
    getAnnotationsHtml,
    SubtitleAnnotations,
    ANNOTATIONS_VIDEO_RENDER_BEHIND_MS,
    ANNOTATIONS_VIDEO_RENDER_AHEAD_MS,
} from '@project/common/annotations';
import {
    arrayEquals,
    compareSubtitlesForDisplay,
    computeStyleString,
    surroundingSubtitles,
} from '@project/common/util';
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
import Binding from '@/services/binding';

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
    private readonly context: Binding;
    private readonly dictionary: DictionaryProvider;
    private readonly settings: SettingsProvider;

    private showingSubtitles?: IndexedSubtitleModel[];
    private timelineShowingSubtitles: readonly IndexedSubtitleModel[] = [];
    private lastOffsetChangeTimestamp: number;
    private showingOffset?: number;
    private loadedMessageHideTimeout?: ReturnType<typeof setTimeout>;
    private offsetHideTimeout?: ReturnType<typeof setTimeout>;
    private showingLoadedMessage: boolean;
    private subtitleSettings?: SubtitleSettings;
    private subtitleStyles?: string[];
    private subtitleClasses?: string[];
    private notificationElementOverlayHideTimeout?: ReturnType<typeof setTimeout>;
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
    autoCopyableTracks: AutoCopyableTracks = calculateAutoCopyableTracksValue([0]);
    convertNetflixRuby: boolean;
    subtitleHtml: SubtitleHtml;
    refreshCurrentSubtitle: boolean;
    _preCacheDom;
    dictionaryTrackSettings?: DictionaryTrack[];
    onOffsetChange?: (offset: number, previousOffset: number) => Promise<void>;
    onMouseOver?: (event: MouseEvent) => void;
    onMouseOut?: (event: MouseEvent) => void;

    constructor(context: Binding, dictionary: DictionaryProvider, settings: SettingsProvider) {
        this.context = context;
        this.dictionary = dictionary;
        this.settings = settings;
        this._preCacheDom = false;
        this.showingSubtitles = [];
        this.shouldRenderBottomOverlay = true;
        this.shouldRenderTopOverlay = false;
        this.unblurredSubtitleTracks = {};
        this.disabledSubtitleTracks = {};
        this.subtitleTrackAlignments = { 0: 'bottom' };
        this._forceHideSubtitles = false;
        this._displaySubtitles = true;
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
        const subtitleCollectionOptions: SubtitleCollectionOptions = {
            showingCheckRadiusMs: 150,
            returnLastShown: true,
            returnNextToShow: true,
        };
        this.subtitleAnnotations = new SubtitleAnnotations(
            this.dictionary,
            this.settings,
            subtitleCollectionOptions,
            this.context.registeredVideoSrc,
            (updatedSubtitles) => this._subtitleAnnotationsUpdated(updatedSubtitles),
            () => this.context.currentTimeMs,
            new VideoFetcher(() => this.context.registeredVideoSrc)
        );
    }

    get subtitles() {
        return this.subtitleAnnotations.subtitles;
    }

    set subtitles(subtitles) {
        this.subtitleAnnotations.setSubtitles(subtitles);
    }

    reset() {
        this.subtitles = [];
        this.subtitleFileNames = undefined;
        this.cacheHtml();
        this.subtitleAnnotations.reset();
    }

    cacheHtml() {
        const htmls = this._buildSubtitlesHtml(this._windowSubtitles());

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

    private _windowSubtitles(): IndexedSubtitleModel[] {
        const now = this.context.currentTimeMs;
        const windowSubtitles = this.subtitleAnnotations.subtitlesIn(
            now - ANNOTATIONS_VIDEO_RENDER_BEHIND_MS,
            now + ANNOTATIONS_VIDEO_RENDER_AHEAD_MS
        );
        if (!windowSubtitles.length) {
            const { lastShown, nextToShow } = this.subtitleAnnotations.subtitlesAt(now);
            for (const subtitle of lastShown ?? []) windowSubtitles.push(subtitle);
            for (const subtitle of nextToShow ?? []) windowSubtitles.push(subtitle);
        }
        return windowSubtitles;
    }

    private _refreshCachedHtmlWindow() {
        const bottomWindowSubtitles: IndexedSubtitleModel[] = [];
        const topWindowSubtitles: IndexedSubtitleModel[] = [];
        for (const subtitle of this._windowSubtitles()) {
            if (this._getSubtitleTrackAlignment(subtitle.track) === 'bottom') bottomWindowSubtitles.push(subtitle);
            else topWindowSubtitles.push(subtitle);
        }

        const updateOverlay = (subtitles: IndexedSubtitleModel[], overlay: ElementOverlay, shouldRender: boolean) => {
            if (!(overlay instanceof CachingElementOverlay)) return;
            const keep = new Set(subtitles.map((s) => String(s.index)));
            for (const key of overlay.cachedHtmlKeys()) {
                if (!keep.has(key)) overlay.removeCachedHtml(key);
            }
            if (!shouldRender) return;
            const uncachedSubtitles = subtitles.filter((s) => !overlay.hasCachedHtml(String(s.index)));
            const htmls = this._buildSubtitlesHtml(uncachedSubtitles);
            for (const html of htmls) overlay.cacheHtml(html.key, html.html());
        };

        updateOverlay(bottomWindowSubtitles, this.bottomSubtitlesElementOverlay, this.shouldRenderBottomOverlay);
        updateOverlay(topWindowSubtitles, this.topSubtitlesElementOverlay, this.shouldRenderTopOverlay);
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
            this.shouldRenderBottomOverlay = Object.values(this.subtitleTrackAlignments).includes('bottom');
            this.shouldRenderTopOverlay = Object.values(this.subtitleTrackAlignments).includes('top');
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
        return allTextSubtitleSettings(settings).map((s, track) => {
            const dt = this.dictionaryTrackSettings?.[track];
            const annotationStyleValues = tokenAnnotationStyleValues(dt?.dictionaryTokenAnnotationConfig.video);
            return computeStyleString(s, annotationStyleValues);
        });
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
        this.refreshShowingSubtitles();
    }

    set forceHideSubtitles(forceHideSubtitles: boolean) {
        this._forceHideSubtitles = forceHideSubtitles;
        this.showingSubtitles = undefined;
        this.refreshShowingSubtitles();
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
            targetElement: this.context.video,
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
            targetElement: this.context.video,
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
                      targetElement: this.context.video,
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
                      targetElement: this.context.video,
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

    private _subtitleAnnotationsUpdated(updatedSubtitles: IndexedSubtitleModel[]): void {
        const updatedIndexes = new Set(updatedSubtitles.map((s) => s.index));
        const updatedWindowSubtitles = this._windowSubtitles().filter((s) => updatedIndexes.has(s.index));
        if (updatedWindowSubtitles.length) {
            const htmls = this._buildSubtitlesHtml(updatedWindowSubtitles);
            for (const [index, updatedWindowSubtitle] of updatedWindowSubtitles.entries()) {
                const html = htmls[index];
                if (this._getSubtitleTrackAlignment(updatedWindowSubtitle.track) === 'bottom') {
                    if (
                        this.shouldRenderBottomOverlay &&
                        this.bottomSubtitlesElementOverlay instanceof CachingElementOverlay
                    ) {
                        this.bottomSubtitlesElementOverlay.cacheHtml(html.key, html.html());
                    }
                } else {
                    if (
                        this.shouldRenderTopOverlay &&
                        this.topSubtitlesElementOverlay instanceof CachingElementOverlay
                    ) {
                        this.topSubtitlesElementOverlay.cacheHtml(html.key, html.html());
                    }
                }
                if (this.showingSubtitles?.some((s) => s.index === updatedWindowSubtitle.index)) {
                    this.refreshCurrentSubtitle = true;
                }
            }
        }
        const command: VideoToExtensionCommand<SubtitlesUpdatedFromVideoMessage> = {
            sender: 'asbplayer-video',
            message: {
                command: 'subtitlesUpdated',
                updatedSubtitles,
            },
            src: this.context.registeredVideoSrc,
        };
        void browser.runtime.sendMessage(command);
        if (this.refreshCurrentSubtitle) this.refreshShowingSubtitles();
    }

    bind() {
        this.subtitleAnnotations.bind();
    }

    showingSubtitlesChanged(subtitles: readonly IndexedSubtitleModel[]): void {
        this.timelineShowingSubtitles = subtitles;
        this.refreshShowingSubtitles();
    }

    refreshShowingSubtitles(): void {
        if (this.showingLoadedMessage) return;

        const showingSubtitles = this.timelineShowingSubtitles
            .filter((subtitle) => this._trackEnabled(subtitle))
            .slice()
            .sort(compareSubtitlesForDisplay);
        const subtitlesAreNew =
            this.showingSubtitles === undefined ||
            !arrayEquals(showingSubtitles, this.showingSubtitles, (left, right) => left.index === right.index);

        if (subtitlesAreNew) {
            this.showingSubtitles = showingSubtitles;
            this._autoCopyToClipboard(showingSubtitles);
            this._refreshCachedHtmlWindow();
        }

        const showOffset = this.lastOffsetChangeTimestamp > 0 && Date.now() - this.lastOffsetChangeTimestamp < 1000;
        const offset = showOffset ? this._computeOffset() : 0;
        const shouldRenderOffset =
            (showOffset && offset !== this.showingOffset) || (!showOffset && this.showingOffset !== undefined);

        if ((!showOffset && !this._displaySubtitles) || this._forceHideSubtitles) {
            this.bottomSubtitlesElementOverlay.hide();
            this.topSubtitlesElementOverlay.hide();
            return;
        }
        if (!subtitlesAreNew && !shouldRenderOffset && !this.refreshCurrentSubtitle) return;

        this.refreshCurrentSubtitle = false;
        this._resetUnblurState();
        if (this.shouldRenderBottomOverlay) {
            this._renderSubtitles(
                showingSubtitles.filter((subtitle) => this._getSubtitleTrackAlignment(subtitle.track) === 'bottom'),
                OffsetAnchor.bottom
            );
        }
        if (this.shouldRenderTopOverlay) {
            this._renderSubtitles(
                showingSubtitles.filter((subtitle) => this._getSubtitleTrackAlignment(subtitle.track) === 'top'),
                OffsetAnchor.top
            );
        }

        if (showOffset) {
            this._appendSubtitlesHtml(this._buildTextHtml(this._formatOffset(offset)));
            this.showingOffset = offset;
        } else {
            this.showingOffset = undefined;
        }
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
                .filter((s) => isTrackAutoCopyable(this.autoCopyableTracks, s.track))
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
                    src: this.context.registeredVideoSrc,
                };

                void browser.runtime.sendMessage(command);
            }
        }
    }

    private _trackEnabled(subtitle: SubtitleModel) {
        return subtitle.track === undefined || !this.disabledSubtitleTracks[subtitle.track];
    }

    private _buildSubtitlesHtml(subtitles: IndexedSubtitleModel[]) {
        const buffer = renderRichTextOntoSubtitles(subtitles, 'video', this.dictionaryTrackSettings);

        return subtitles.map((subtitle) => {
            const rendered = buffer.get(subtitle.index);
            return {
                html: () => {
                    if (subtitle.textImage) {
                        const className = this.subtitleClasses?.[subtitle.track] ?? '';
                        const imageScale =
                            ((this.subtitleSettings?.imageBasedSubtitleScaleFactor ?? 1) *
                                this.context.video.getBoundingClientRect().width) /
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
                        return this._buildTextHtml(
                            subtitle.text,
                            subtitle.track,
                            rendered?.richText,
                            rendered?.richTextOnHover
                        );
                    }
                },
                key: String(subtitle.index),
            };
        });
    }

    private _buildTextHtml(text: string, track?: number, richText?: string, richTextOnHover?: string) {
        return `<span data-track="${track ?? 0}" class="${this._subtitleClasses(track)}" style="${this._subtitleStyles(
            track
        )}">${getAnnotationsHtml(text, richText, richTextOnHover)}</span>`;
    }

    unbind() {
        this.subtitleAnnotations.unbind();

        if (this.loadedMessageHideTimeout) clearTimeout(this.loadedMessageHideTimeout);
        this.loadedMessageHideTimeout = undefined;
        if (this.offsetHideTimeout) clearTimeout(this.offsetHideTimeout);
        this.offsetHideTimeout = undefined;

        if (this.notificationElementOverlayHideTimeout) {
            clearTimeout(this.notificationElementOverlayHideTimeout);
            this.notificationElementOverlayHideTimeout = undefined;
        }

        this.bottomSubtitlesElementOverlay.dispose();
        this.topSubtitlesElementOverlay.dispose();
        this.notificationElementOverlay.dispose();
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
        const now = this.context.currentTimeMs;
        let index = null;

        for (let i = 0; i < this.subtitles.length; ++i) {
            const s = this.subtitles[i];

            if (
                now >= s.start &&
                now < s.end &&
                (typeof s.track === 'undefined' || !this.disabledSubtitleTracks[s.track])
            ) {
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

        const previousOffset = this._computeOffset();

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
        if (this.offsetHideTimeout) clearTimeout(this.offsetHideTimeout);
        this.offsetHideTimeout = setTimeout(() => {
            this.offsetHideTimeout = undefined;
            this.refreshShowingSubtitles();
        }, 1000);
        this.refreshShowingSubtitles();

        if (!skipNotifyPlayer) {
            const command: VideoToExtensionCommand<OffsetFromVideoMessage> = {
                sender: 'asbplayer-video',
                message: {
                    command: 'offset',
                    value: offset,
                },
                src: this.context.registeredVideoSrc,
            };

            void browser.runtime.sendMessage(command);
        }

        void this.onOffsetChange?.(offset, previousOffset);

        void this.settings.getSingle('rememberSubtitleOffset').then((rememberSubtitleOffset) => {
            if (rememberSubtitleOffset) {
                void this.settings.set({ lastSubtitleOffset: offset });
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

    notification({
        replacements,
        locKey,
        text,
    }: {
        replacements?: { [key: string]: string };
        locKey?: string;
        text?: string;
    }) {
        if (!text && !locKey) {
            return;
        }

        const notificationText = text ?? i18n.t(locKey!, replacements ?? {});
        this.notificationElementOverlay.setHtml([{ html: () => this._buildTextHtml(notificationText) }]);

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
        if (this.loadedMessageHideTimeout) clearTimeout(this.loadedMessageHideTimeout);
        this.loadedMessageHideTimeout = setTimeout(() => {
            this.loadedMessageHideTimeout = undefined;
            this.showingLoadedMessage = false;
            this.refreshShowingSubtitles();
        }, 1000);
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
