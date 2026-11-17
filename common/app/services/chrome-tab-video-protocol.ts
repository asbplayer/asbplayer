import { v4 as uuid } from 'uuid';
import type { InitToVideoMessage, Message, ReadyFromVideoMessage } from '@project/common';
import type { ExtensionMessage } from '@project/common/app/services/chrome-extension';
import type ChromeExtension from '@project/common/app/services/chrome-extension';
import type { VideoProtocol, VideoProtocolMessage } from '@project/common/app/services/video-protocol';

export default class ChromeTabVideoProtocol implements VideoProtocol {
    private readonly channelId = uuid();
    private readonly unsubscribeFromExtension: () => void;
    onMessage?: (message: VideoProtocolMessage) => void;

    constructor(
        private readonly tabId: number,
        private readonly src: string,
        private readonly extension: Pick<ChromeExtension, 'subscribe' | 'sendMessageToVideoElement'>
    ) {
        this.unsubscribeFromExtension = extension.subscribe((message: ExtensionMessage) => {
            if (message.tabId !== tabId || message.src !== src) return;
            if (message.data.command === 'ready') {
                const ready = message.data as ReadyFromVideoMessage;
                if (ready.channelId !== undefined && ready.channelId !== this.channelId) return;
            }
            this.onMessage?.({ data: message.data });
        });
    }

    postMessage(message: Message) {
        const outgoing =
            message.command === 'init'
                ? ({ command: 'init', channelId: this.channelId } satisfies InitToVideoMessage)
                : message;
        this.extension.sendMessageToVideoElement(outgoing, this.tabId, this.src);
    }

    close() {
        this.unsubscribeFromExtension();
    }
}
