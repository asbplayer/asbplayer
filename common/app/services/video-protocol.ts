import type { Message } from '@project/common';

export interface VideoProtocol {
    postMessage: (message: Message) => void;
    close: () => void;
    onMessage?: (message: VideoProtocolMessage) => void;
}

export interface VideoProtocolMessage {
    data: Message;
}
