import { Message } from '@project/common';
import { VideoProtocol, VideoProtocolMessage } from './video-protocol';

export default class BroadcastChannelVideoProtocol implements VideoProtocol {
    private channel?: BroadcastChannel;

    onMessage?: (message: VideoProtocolMessage) => void;

    constructor(channelId: string) {
        this.channel = new BroadcastChannel(channelId);
        this.channel.onmessage = (event) => {
            this.onMessage?.(event as VideoProtocolMessage);
        };
    }

    postMessage(message: Message) {
        this.channel?.postMessage(message);
    }

    close() {
        this.channel?.close();
        this.channel = undefined;
    }
}
