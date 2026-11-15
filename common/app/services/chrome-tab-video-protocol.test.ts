import { describe, expect, it, jest } from '@jest/globals';
import type { InitToVideoMessage, Message, ReadyFromVideoMessage } from '@project/common';
import type { ExtensionMessage } from '@project/common/app/services/chrome-extension';
import ChromeTabVideoProtocol from '@project/common/app/services/chrome-tab-video-protocol';
import VideoChannel from '@project/common/app/services/video-channel';

class Extension {
    readonly listeners = new Set<(message: ExtensionMessage) => void>();
    readonly sent: Message[] = [];

    subscribe(callback: (message: ExtensionMessage) => void) {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    sendMessageToVideoElement(message: Message) {
        this.sent.push(message);
        if (message.command === 'init') this.ready((message as InitToVideoMessage).channelId);
    }

    ready(channelId?: string) {
        const data: ReadyFromVideoMessage = {
            command: 'ready',
            channelId,
            duration: 120,
            currentTime: 0,
            paused: true,
            playbackRate: 1,
        };
        for (const listener of this.listeners) listener({ data, tabId: 1, src: 'video' });
    }
}

describe('video channel initialization', () => {
    it('replies only to the initiating viewer and still broadcasts binding readiness', () => {
        const extension = new Extension();
        const app = new VideoChannel(new ChromeTabVideoProtocol(1, 'video', extension));
        const appReady = jest.fn();
        app.onReady(appReady);
        app.init();
        expect(appReady).toHaveBeenCalledTimes(1);

        const viewer = new VideoChannel(new ChromeTabVideoProtocol(1, 'video', extension));
        const viewerReady = jest.fn();
        viewer.onReady(viewerReady);
        viewer.init();
        expect(viewerReady).toHaveBeenCalledTimes(1);
        expect(appReady).toHaveBeenCalledTimes(1);

        // Binding broadcasts and older extensions' unscoped replies still reach both players.
        extension.ready();
        expect(appReady).toHaveBeenCalledTimes(2);
        expect(viewerReady).toHaveBeenCalledTimes(2);
        app.close();
        viewer.close();
        expect(extension.listeners.size).toBe(0);
    });
});
