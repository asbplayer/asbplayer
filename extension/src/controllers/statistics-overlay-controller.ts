import { CachingElementOverlay, OffsetAnchor } from '@/services/element-overlay';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { frameColorScheme } from '@/services/frame-color-scheme';
import UiFrame, { uiFrameForSrc } from '@/services/ui-frame';
import { type OpenStatisticsOverlayOneUncollectedDialogMessage } from '@/ui/components/StatisticsOverlayUi';
import { type UiState } from '@/ui/components/StatisticsOverlayOneUncollectedUi';
import {
    CloseStatisticsOverlayMessage,
    Command,
    Message,
    MoveStatisticsOverlayMessage,
    OpenStatisticsOverlayMessage,
    ResizeStatisticsOverlayMessage,
    StatisticsOverlayToTabCommand,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';

type State = 'open' | 'fullscreen' | 'closed';

const settings = new SettingsProvider(new ExtensionSettingsStorage());

export class StatisticsOverlayController {
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
    private _restoreTimeout?: NodeJS.Timeout;
    private _lastClosedMediaId?: string;
    private _xOffset = 0;
    private _yOffset = 0;

    unbind() {
        if (this._messageListener !== undefined) {
            browser.runtime.onMessage.removeListener(this._messageListener);
            this._messageListener = undefined;
        }
        if (this._windowMessageListener !== undefined) {
            window.removeEventListener('message', this._windowMessageListener);
            this._windowMessageListener = undefined;
        }
        if (this._restoreTimeout !== undefined) {
            clearTimeout(this._restoreTimeout);
        }
        this._overlay?.dispose();
        this._overlay = undefined;
        this._oneUncollectedDialogFrame?.unbind();
        this._oneUncollectedDialogFrame = undefined;
    }

    bind() {
        this._setHeight('0px');
        this._messageListener = (
            message: any,
            sender: Browser.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (message.sender === 'asbplayer-statistics-overlay-to-tab') {
                this._handleMessageFromOverlay(message);
            } else {
                this._handleMessage(message);
            }
        };
        this._ensureOverlay();
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
            case 'open-statistics-overlay-one-uncollected-dialog':
                const openDialogMessage = command.message as OpenStatisticsOverlayOneUncollectedDialogMessage;
                const { entries, totalSentences, mediaId } = openDialogMessage;
                this._getOneUncollectedDialogFrame().then(async (frame) => {
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
            case 'open-statistics-overlay':
                const openMessage = command.message as OpenStatisticsOverlayMessage;
                this._handleOpen(openMessage);
                break;
            case 'move-statistics-overlay':
                if (this._state === 'fullscreen') {
                    break;
                }

                const moveMessage = command.message as MoveStatisticsOverlayMessage;
                this._xOffset += moveMessage.deltaX;
                this._yOffset = Math.max(0, this._yOffset + moveMessage.deltaY);
                this._applyCurrentContainerStyles();
                break;
            case 'close-statistics-overlay':
                const closeMessage = command.message as CloseStatisticsOverlayMessage;
                this._close(closeMessage.mediaId);
                break;
            case 'resize-statistics-overlay':
                const resizeMessage = command.message as ResizeStatisticsOverlayMessage;
                this._setWidth(`${resizeMessage.width + 50}px`);
                break;
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
    }

    private _close(mediaId: string) {
        if (this._state === 'closed') {
            return;
        }

        this._state = 'closed';
        this._mediaId = undefined;
        this._setWidth(this._restoreWidth ?? '100%');
        this._setHeight('0px');
        this._lastClosedMediaId = mediaId;
    }

    private _resetPosition() {
        this._xOffset = 0;
        this._yOffset = 0;
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
            container.style.setProperty('top', `${8 + this._yOffset}px`, 'important');
            container.style.setProperty('left', `calc(50% + ${this._xOffset}px)`, 'important');
            container.style.setProperty('bottom', 'auto', 'important');
            container.style.setProperty('transform', 'translateX(-50%)', 'important');
        }

        container.style.setProperty('height', this._height ?? null, 'important');
        container.style.setProperty('width', this._width ?? '100%', 'important');
    }

    private _setHeight(height: string) {
        this._height = height;
        if (this._overlay !== undefined) {
            for (const elm of this._overlay.displayingElements()) {
                (elm as HTMLIFrameElement).style.setProperty('height', height, 'important');
            }
            this._overlay.refresh();
        }
    }

    private _setWidth(width: string) {
        this._width = width;
        if (this._overlay !== undefined) {
            for (const elm of this._overlay.displayingElements()) {
                (elm as HTMLIFrameElement).style.setProperty('width', width, 'important');
            }
            this._overlay.refresh();
        }
    }

    private _ensureOverlay() {
        if (this._overlay !== undefined) {
            return;
        }
        this._overlay = new CachingElementOverlay({
            targetElement: document.body,
            nonFullscreenContainerClassName: 'asbplayer-statistics-overlay-container',
            nonFullscreenContentClassName: '',
            fullscreenContainerClassName: 'asbplayer-statistics-overlay-container',
            fullscreenContentClassName: '',
            offsetAnchor: OffsetAnchor.bottom,
            contentWidthPercentage: -1,
            onMouseOut: () => {},
            onMouseOver: () => {},
            onContainerStyles: (container) => {
                this._applyOverlayContainerStyles(container);
            },
        });
        const colorScheme = frameColorScheme();
        this._overlay.setHtml([
            {
                key: 'ui',
                html: () =>
                    `<iframe style="display: block !important; border: 0 !important; color-scheme: ${colorScheme} !important; width: 100% !important; height: 0px !important" src="${browser.runtime.getURL(
                        '/statistics-overlay-ui.html'
                    )}"/>`,
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
