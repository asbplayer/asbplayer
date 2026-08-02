import { CachingElementOverlay, OffsetAnchor } from '../services/element-overlay';
import { frameColorScheme, frameColorSchemeClass } from '../services/frame-color-scheme';
import UiFrame, { uiFrameForSrc } from '../services/ui-frame';
import { type OpenStatisticsOverlayOneUncollectedDialogMessage } from '../ui/components/StatisticsOverlayUi';
import { type UiState } from '../ui/components/StatisticsOverlayOneUncollectedUi';
import {
    CloseStatisticsOverlayMessage,
    Command,
    Message,
    MoveStatisticsOverlayMessage,
    OpenStatisticsOverlayMessage,
    ResizeStatisticsOverlayMessage,
    StatisticsOverlayToTabCommand,
} from '@project/common';

type State = 'open' | 'fullscreen' | 'closed';

export class StatisticsOverlayController {
    private static readonly _mobileOverlaySelector = '.asbplayer-mobile-video-overlay-container-top';
    private static readonly _overlayGap = 8;
    private _messageListener?: (
        message: any,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void;
    private _windowMessageListener?: (event: MessageEvent) => void;
    private _overlay?: CachingElementOverlay;
    private _oneUncollectedDialogFrame?: UiFrame;
    private _height?: string;
    private _mediaId?: string;
    private _restoreWidth?: string;
    private _width?: string;
    private _state: State = 'closed';
    private _lastClosedMediaId?: string;
    private _xOffset = 0;
    private _yOffset = 0;
    private _mobileOverlayOffset = 0;
    private _mobileOverlayManuallyMoved = false;
    private _mobileOverlayObserver?: MutationObserver;
    private _mobileOverlayResizeObserver?: ResizeObserver;
    private _observedMobileOverlays = new Set<HTMLElement>();
    private _mobileOverlayLayoutListener = () => this._updateMobileOverlayOffset();

    unbind() {
        if (this._messageListener !== undefined) {
            browser.runtime.onMessage.removeListener(this._messageListener);
            this._messageListener = undefined;
        }
        if (this._windowMessageListener !== undefined) {
            window.removeEventListener('message', this._windowMessageListener);
            this._windowMessageListener = undefined;
        }
        this._overlay?.dispose();
        this._overlay = undefined;
        this._mobileOverlayObserver?.disconnect();
        this._mobileOverlayObserver = undefined;
        this._mobileOverlayResizeObserver?.disconnect();
        this._mobileOverlayResizeObserver = undefined;
        this._observedMobileOverlays.clear();
        window.removeEventListener('resize', this._mobileOverlayLayoutListener);
        window.removeEventListener('scroll', this._mobileOverlayLayoutListener);
        this._oneUncollectedDialogFrame?.unbind();
        this._oneUncollectedDialogFrame = undefined;
    }

    bind() {
        this._setHeight('0px');
        this._messageListener = (message: any) => {
            if (message.sender === 'asbplayer-statistics-overlay-to-tab') {
                this._handleMessageFromOverlay(message);
            } else {
                this._handleMessage(message);
            }
        };
        this._ensureOverlay();
        this._mobileOverlayObserver = new MutationObserver(() => this._updateMobileOverlayOffset());
        this._mobileOverlayObserver.observe(document.body, { childList: true, subtree: true });
        if (typeof ResizeObserver !== 'undefined') {
            this._mobileOverlayResizeObserver = new ResizeObserver(() => this._updateMobileOverlayOffset());
        }
        window.addEventListener('resize', this._mobileOverlayLayoutListener);
        window.addEventListener('scroll', this._mobileOverlayLayoutListener);
        this._updateMobileOverlayOffset();
        browser.runtime.onMessage.addListener(this._messageListener);
        this._windowMessageListener = (event: MessageEvent) => {
            if (event.source === window) {
                return;
            }

            if (event.data?.sender !== 'asbplayer-statistics-overlay-to-tab') {
                return;
            }

            this._handleMessageFromOverlay(event.data);
        };
        window.addEventListener('message', this._windowMessageListener);
    }

    private _handleMessageFromOverlay(message: any) {
        const command = message as StatisticsOverlayToTabCommand<Message>;

        switch (command.message.command) {
            case 'open-statistics-overlay-one-uncollected-dialog': {
                const openDialogMessage = command.message as OpenStatisticsOverlayOneUncollectedDialogMessage;
                const { entries, totalSentences, mediaId } = openDialogMessage;
                void this._getOneUncollectedDialogFrame().then(async (frame) => {
                    const state: UiState = {
                        open: true,
                        mediaId,
                        entries,
                        totalSentences,
                    };
                    const client = await frame.client();
                    client.updateState(state);
                    frame.show();
                });
                break;
            }
            case 'open-statistics-overlay': {
                const openMessage = command.message as OpenStatisticsOverlayMessage;
                this._handleOpen(openMessage);
                break;
            }
            case 'move-statistics-overlay': {
                if (this._state === 'fullscreen') {
                    break;
                }

                const moveMessage = command.message as MoveStatisticsOverlayMessage;
                if (this._mobileOverlayOffset !== 0) {
                    // Preserve the position the user is dragging from when the automatic offset is removed.
                    this._yOffset += this._mobileOverlayOffset;
                    this._mobileOverlayOffset = 0;
                }
                if (this._visibleMobileOverlayBounds().length > 0) {
                    this._mobileOverlayManuallyMoved = true;
                }
                this._xOffset += moveMessage.deltaX;
                this._yOffset = Math.max(0, this._yOffset + moveMessage.deltaY);
                this._applyCurrentContainerStyles();
                break;
            }
            case 'close-statistics-overlay': {
                const closeMessage = command.message as CloseStatisticsOverlayMessage;
                this._close(closeMessage.mediaId);
                break;
            }
            case 'resize-statistics-overlay': {
                const resizeMessage = command.message as ResizeStatisticsOverlayMessage;
                this._setWidth(`${resizeMessage.width + 50}px`);
                break;
            }
        }
    }

    private _handleMessage(message: any) {
        const command = message as Command<Message>;
        if (command.sender !== 'asbplayer-extension-to-video') {
            return;
        }

        if (command.message.command === 'open-statistics-overlay') {
            const openMessage = (command as Command<OpenStatisticsOverlayMessage>).message;
            this._handleOpen(openMessage);
        }
    }

    private _handleOpen(message: OpenStatisticsOverlayMessage) {
        if (message.force && this._state !== 'closed' && this._mediaId === message.mediaId) {
            this._close(message.mediaId);
            return;
        }

        if (this._state !== 'closed' && this._mediaId === message.mediaId) {
            return;
        }

        if (!message.force && this._state === 'closed' && this._lastClosedMediaId === message.mediaId) {
            return;
        }

        this._state = 'open';
        this._mediaId = message.mediaId;
        this._resetPosition();
        this._setWidth(this._width ?? '100%');
        this._setHeight('68px');
        this._updateMobileOverlayOffset();
    }

    private _close(mediaId: string) {
        if (this._state === 'closed') {
            return;
        }

        this._state = 'closed';
        this._mediaId = undefined;
        this._setWidth(this._restoreWidth ?? '100%');
        this._setHeight('0px');
        this._mobileOverlayOffset = 0;
        this._mobileOverlayManuallyMoved = false;
        this._lastClosedMediaId = mediaId;
    }

    private _resetPosition() {
        this._xOffset = 0;
        this._yOffset = 0;
        this._mobileOverlayOffset = 0;
        this._mobileOverlayManuallyMoved = false;
        this._applyCurrentContainerStyles();
    }

    private _visibleMobileOverlayBounds() {
        return Array.from(document.querySelectorAll<HTMLElement>(StatisticsOverlayController._mobileOverlaySelector))
            .map((container) => ({ container, bounds: container.getBoundingClientRect() }))
            .filter(({ bounds }) => bounds.width > 0 && bounds.height > 0);
    }

    private _updateMobileOverlayOffset() {
        if (this._state !== 'open') {
            return;
        }

        const mobileOverlays = this._visibleMobileOverlayBounds();

        for (const container of this._observedMobileOverlays) {
            if (!mobileOverlays.some(({ container: current }) => current === container)) {
                this._mobileOverlayResizeObserver?.unobserve(container);
            }
        }
        for (const { container } of mobileOverlays) {
            if (!this._observedMobileOverlays.has(container)) {
                this._mobileOverlayResizeObserver?.observe(container);
            }
        }
        this._observedMobileOverlays = new Set(mobileOverlays.map(({ container }) => container));

        if (mobileOverlays.length === 0) {
            this._mobileOverlayManuallyMoved = false;
            this._setMobileOverlayOffset(0);
            return;
        }

        if (this._mobileOverlayManuallyMoved) {
            return;
        }

        const baseTop = 8 + this._yOffset;
        const overlayHeight = this._overlay?.containerElement?.getBoundingClientRect().height ?? 0;
        const height = overlayHeight || Number.parseFloat(this._height ?? '0');
        let requiredOffset = 0;

        for (const { bounds } of mobileOverlays) {
            if (bounds.top < baseTop + height && bounds.bottom > baseTop) {
                requiredOffset = Math.max(
                    requiredOffset,
                    (bounds.bottom + StatisticsOverlayController._overlayGap - baseTop) / 1.5
                );
            }
        }

        this._setMobileOverlayOffset(requiredOffset);
    }

    private _setMobileOverlayOffset(offset: number) {
        if (this._mobileOverlayOffset === offset) {
            return;
        }

        this._mobileOverlayOffset = offset;
        this._applyCurrentContainerStyles();
    }

    private _applyCurrentContainerStyles() {
        const container = this._overlay?.containerElement;

        if (container !== undefined) {
            this._applyOverlayContainerStyles(container);
        }
    }

    private _applyOverlayContainerStyles(container: HTMLElement) {
        if (this._state === 'fullscreen') {
            container.style.setProperty('top', '0px', 'important');
            container.style.setProperty('left', '0px', 'important');
            container.style.setProperty('bottom', 'auto', 'important');
            container.style.setProperty('transform', 'none', 'important');
        } else {
            container.style.setProperty('top', `${8 + this._yOffset + this._mobileOverlayOffset}px`, 'important');
            container.style.setProperty('left', `calc(50% + ${this._xOffset}px)`, 'important');
            container.style.setProperty('bottom', 'auto', 'important');
            container.style.setProperty('transform', 'translateX(-50%)', 'important');
        }

        container.style.setProperty('height', this._height ?? null, 'important');
        container.style.setProperty('width', this._width ?? '100%', 'important');
    }

    private _setHeight(height: string) {
        this._height = height;
        this._overlay?.refresh();
    }

    private _setWidth(width: string) {
        this._width = width;
        this._overlay?.refresh();
    }

    private _ensureOverlay() {
        if (this._overlay !== undefined) {
            return;
        }
        this._overlay = new CachingElementOverlay({
            targetElement: document.body,
            nonFullscreenContainerClassName: 'asbplayer-statistics-overlay-container',
            nonFullscreenContentClassName: 'asbplayer-statistics-overlay-content',
            fullscreenContainerClassName: 'asbplayer-statistics-overlay-container',
            fullscreenContentClassName: 'asbplayer-statistics-overlay-content',
            offsetAnchor: OffsetAnchor.bottom,
            contentWidthPercentage: undefined,
            onMouseOut: () => {},
            onMouseOver: () => {},
            onContainerStyles: (container) => {
                this._applyOverlayContainerStyles(container);
            },
        });
        const colorScheme = frameColorScheme();
        const colorSchemeClass = frameColorSchemeClass();
        this._overlay.setHtml([
            {
                key: 'ui',
                html: () => {
                    return `<iframe class="${colorSchemeClass} asbplayer-statistics-overlay-frame " allowtransparency="true" style="color-scheme: ${colorScheme}" src="${browser.runtime.getURL(
                        '/statistics-overlay-ui.html'
                    )}?colorScheme=${encodeURIComponent(colorScheme)}"/>`;
                },
            },
        ]);
    }

    private async _getOneUncollectedDialogFrame() {
        if (this._oneUncollectedDialogFrame !== undefined) {
            return this._oneUncollectedDialogFrame;
        }
        this._oneUncollectedDialogFrame = uiFrameForSrc(
            browser.runtime.getURL('/statistics-overlay-one-uncollected-ui.html')
        );
        await this._oneUncollectedDialogFrame.bind();
        const client = await this._oneUncollectedDialogFrame.client();
        client.onMessage((message) => {
            switch (message.command) {
                case 'close':
                    this._oneUncollectedDialogFrame?.hide();
                    break;
            }
        });
        this._oneUncollectedDialogFrame.hide();
        return this._oneUncollectedDialogFrame;
    }
}
