import { Message, TabsMessage } from './message';

export interface Command<T extends Message> {
    readonly sender: string;
    readonly message: T;
}

export interface AsbPlayerToVideoCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer';
    readonly tabId: number;
    readonly src?: string;
}

export interface AsbPlayerToVideoCommandV2<T extends Message> extends Command<T> {
    readonly sender: 'asbplayerv2';
    readonly tabId: number;
    readonly src: string;
}

export interface AsbPlayerToTabCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayerv2';
    readonly tabId: number;
}

export interface AsbPlayerCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayerv2';
    readonly asbplayerId?: string;
}

export interface ExtensionToVideoCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-extension-to-video';
    readonly src?: string;
}

export interface VideoToExtensionCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-video';
    readonly src: string;
}

export interface TabToExtensionCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-video-tab';
}

export interface ForegroundToExtensionCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-foreground';
}

export interface ExtensionToAsbPlayerCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-extension-to-player';
    readonly tabId?: number;
    readonly src?: string;
    readonly asbplayerId?: string;
}

export interface PopupToExtensionCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-popup';
}

export interface ExtensionToAsbPlayerCommandTabsCommand extends Command<TabsMessage> {
    readonly sender: 'asbplayer-extension-to-player';
}

export interface ExtensionToOffscreenDocumentCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-extension-to-offscreen-document';
}

export interface OffscreenDocumentToExtensionCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-offscreen-document';
}

export interface MobileOverlayToVideoCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-mobile-overlay-to-video';
    readonly src: string;
}

export interface StatisticsOverlayToTabCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-statistics-overlay-to-tab';
}

export interface StatisticsOverlayCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-statistics-overlay';
}

export interface VideoToMobileOverlayCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-video-to-mobile-overlay';
    readonly src: string;
}

export interface MobileOverlayCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-mobile-overlay';
}

export interface DictionaryDBCommand<T extends Message> extends Command<T> {
    readonly sender: 'asbplayer-dictionary';
}
